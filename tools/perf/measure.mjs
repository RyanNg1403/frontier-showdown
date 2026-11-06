#!/usr/bin/env node
/**
 * Performance harness: transfer size, memory and frame pacing for a 2v2 CPU-vs-CPU match.
 *
 *   npm i --no-save puppeteer-core
 *   node tools/perf/measure.mjs --url http://127.0.0.1:5173/frontier-showdown/ --out perf.json
 *
 * Options: --chrome <path>, --throttle 4 (CPU slowdown for the frame-pacing pass), --mobile
 * (Moto G-class viewport and DPR), --seconds 15, --label <name>, --screenshot <png>,
 * --profile <cpuprofile path>. The page is proxied through a local server that adds COOP/COEP
 * headers so `performance.measureUserAgentSpecificMemory()` is available.
 */
import { createServer, request as httpRequest } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]);
  return acc;
}, []));
const target = new URL(args.url || "http://127.0.0.1:4173/");
const seconds = Number(args.seconds || 15);
const throttle = Number(args.throttle || 4);
const mobile = Boolean(args.mobile);
const chromePath = args.chrome || process.env.CHROME_PATH || "/usr/local/bin/google-chrome";
const team1 = args.p1 || "elon,dario";
const team2 = args.p2 || "sam,jensen";
const stage = args.stage || "openai-mission-bay";

const { default: puppeteer } = await import("puppeteer-core");

/** Reverse proxy that adds cross-origin isolation headers. */
function startProxy() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const up = httpRequest({ host: target.hostname, port: target.port || 80, path: req.url, method: req.method, headers: { ...req.headers, host: target.host } }, (r) => {
        const headers = { ...r.headers, "cross-origin-opener-policy": "same-origin", "cross-origin-embedder-policy": "require-corp", "cross-origin-resource-policy": "same-origin" };
        res.writeHead(r.statusCode, headers);
        r.pipe(res);
      });
      up.on("error", () => { res.writeHead(502); res.end(); });
      req.pipe(up);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function procMemory(pid) {
  try {
    const text = readFileSync(`/proc/${pid}/smaps_rollup`, "utf8");
    const kb = (k) => Number(text.match(new RegExp(`^${k}:\\s+(\\d+)`, "m"))?.[1] || 0);
    return { pssMB: +(kb("Pss") / 1024).toFixed(1), privateMB: +((kb("Private_Clean") + kb("Private_Dirty")) / 1024).toFixed(1) };
  } catch {
    return null;
  }
}

async function processMemory(cdpBrowser) {
  const { processInfo } = await cdpBrowser.send("SystemInfo.getProcessInfo");
  const out = {};
  for (const p of processInfo) {
    if (p.type !== "renderer" && p.type !== "GPU") continue;
    const m = procMemory(p.id);
    if (!m) continue;
    const key = p.type === "GPU" ? "gpu" : "renderer";
    out[key] = out[key] ? { pssMB: out[key].pssMB + m.pssMB, privateMB: out[key].privateMB + m.privateMB } : m;
  }
  return out;
}

async function uaMemory(page) {
  return page.evaluate(async () => {
    if (!self.crossOriginIsolated || !performance.measureUserAgentSpecificMemory) return null;
    const r = await Promise.race([performance.measureUserAgentSpecificMemory(), new Promise((res) => setTimeout(() => res(null), 60000))]);
    if (!r) return null;
    const byType = {};
    for (const b of r.breakdown) for (const t of b.types) byType[t] = (byType[t] || 0) + b.bytes / b.types.length;
    return { totalMB: +(r.bytes / 1048576).toFixed(1), byTypeMB: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, +(v / 1048576).toFixed(1)])) };
  });
}

async function jsHeap(cdp) {
  const { metrics } = await cdp.send("Performance.getMetrics");
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  return { jsHeapUsedMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), jsHeapTotalMB: +(m.JSHeapTotalSize / 1048576).toFixed(1), nodes: m.Nodes };
}

async function snapshot(page, cdp, browserCdp, label) {
  await cdp.send("HeapProfiler.collectGarbage");
  await sleep(500);
  const [ua, heap, proc] = [await uaMemory(page), await jsHeap(cdp), await processMemory(browserCdp)];
  const images = await page.evaluate(() => window.__fsImageStats?.() ?? null);
  return { label, ua, heap, proc, images };
}

function trackTransfer(cdp) {
  const reqs = new Map();
  const state = { bytes: 0, count: 0, byType: {}, files: [] };
  cdp.on("Network.responseReceived", (e) => reqs.set(e.requestId, { url: e.response.url, type: e.type, fromSW: e.response.fromServiceWorker, cache: e.response.fromDiskCache }));
  cdp.on("Network.loadingFinished", (e) => {
    const r = reqs.get(e.requestId);
    if (!r || r.url.startsWith("data:")) return;
    state.bytes += e.encodedDataLength;
    state.count += 1;
    const ext = (new URL(r.url).pathname.match(/\.([a-z0-9]+)$/i)?.[1] || "html").toLowerCase();
    state.byType[ext] = (state.byType[ext] || 0) + e.encodedDataLength;
    state.files.push([new URL(r.url).pathname, e.encodedDataLength]);
  });
  return {
    take() {
      const out = { MB: +(state.bytes / 1048576).toFixed(2), requests: state.count, byTypeKB: Object.fromEntries(Object.entries(state.byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round(v / 1024)])), top: state.files.sort((a, b) => b[1] - a[1]).slice(0, 12).map(([p, b]) => `${p} ${Math.round(b / 1024)}KB`) };
      state.bytes = 0; state.count = 0; state.byType = {}; state.files = [];
      return out;
    },
  };
}

const FRAME_PROBE = `(() => {
  const d = []; let last = 0; let on = false;
  const tick = (t) => { if (on && last) d.push(t - last); last = t; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const long = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (on) long.push(e.duration); }).observe({ type: "longtask", buffered: false }); } catch {}
  window.__fsFrames = { start() { d.length = 0; long.length = 0; last = 0; on = true; }, stop() { on = false; return { d: d.slice(), long: long.slice() }; } };
})();`;

function frameStats({ d, long }) {
  const s = [...d].sort((a, b) => a - b);
  const q = (p) => +(s[Math.min(s.length - 1, Math.floor(p * s.length))] || 0).toFixed(1);
  const mean = d.reduce((a, b) => a + b, 0) / (d.length || 1);
  return { frames: d.length, fps: +(1000 / mean).toFixed(1), p50: q(0.5), p95: q(0.95), p99: q(0.99), over20ms: +(100 * d.filter((x) => x > 20).length / (d.length || 1)).toFixed(1), over33ms: +(100 * d.filter((x) => x > 33.4).length / (d.length || 1)).toFixed(1), longTasks: long.length, longTaskMs: Math.round(long.reduce((a, b) => a + b, 0)) };
}

function topFunctions(profile, n = 15) {
  const self = new Map();
  const byId = new Map(profile.nodes.map((nd) => [nd.id, nd]));
  const dt = profile.timeDeltas;
  const counts = new Map();
  profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) || 0) + (dt[i] || 0)));
  let total = 0;
  for (const [id, us] of counts) {
    const nd = byId.get(id);
    const cf = nd.callFrame;
    const key = `${cf.functionName || "(anon)"} ${cf.url.split("/").slice(-2).join("/")}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) || 0) + us);
    total += us;
  }
  return [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, us]) => `${(100 * us / total).toFixed(1)}% ${k}`);
}

const proxy = await startProxy();
const base = new URL(target.pathname, `http://127.0.0.1:${proxy.address().port}`);
const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--no-sandbox", "--enable-precise-memory-info", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
});
const browserCdp = await browser.target().createCDPSession();
const page = await browser.newPage();
await page.setCacheEnabled(false);
if (mobile) await page.emulate({ viewport: { width: 915, height: 412, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true, isLandscape: true }, userAgent: "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36" });
else await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
const cdp = await page.createCDPSession();
await cdp.send("Network.enable");
await cdp.send("Performance.enable");
await page.evaluateOnNewDocument(FRAME_PROBE);
const transfer = trackTransfer(cdp);
const logs = [];
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`.slice(0, 300)); });
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));

const result = { label: args.label || "run", url: target.href, mobile, chrome: await browser.version() };

// 1. First load: title screen, until the network is quiet.
const t0 = Date.now();
await page.goto(base.href, { waitUntil: "load", timeout: 120000 });
await page.waitForNetworkIdle({ idleTime: 1500, timeout: 30000 }).catch(() => {});
await sleep(1500);
result.firstLoad = { ...transfer.take(), ms: Date.now() - t0 };
result.memMenu = await snapshot(page, cdp, browserCdp, "menu");

// 2. Quick-start 2v2 match.
const quick = new URL(base.href);
quick.search = `?quick&mode=2v2&p1=${team1}&p2=${team2}&p1c=cpu&p2c=cpu&d=hard&stage=${stage}${args.quality ? `&quality=${args.quality}` : ""}`;
const t1 = Date.now();
await page.goto(quick.href, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => ["intro", "fight"].includes(window.frontierShowdown?.state?.phase), { timeout: 180000, polling: 200 });
result.toMatch = { ...transfer.take(), ms: Date.now() - t1 };
// Show the fight screen (HUD over the canvas) the same way for every build.
await page.evaluate(() => { const ui = window.frontierShowdown.ui; if (ui?.screen !== "fight") ui?.show?.("fight", { instant: true }); });
await sleep(seconds * 1000);
result.memMatch = await snapshot(page, cdp, browserCdp, "2v2 match");
if (args.screenshot) await page.screenshot({ path: args.screenshot });

// 3. Frame pacing under CPU throttle with a CPU profile.
await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await page.evaluate(() => window.__fsFrames.start());
await cdp.send("Profiler.start");
await sleep(seconds * 1000);
const { profile } = await cdp.send("Profiler.stop");
result.frames = { throttle, ...frameStats(await page.evaluate(() => window.__fsFrames.stop())) };
result.hotspots = topFunctions(profile);
if (args.profile) writeFileSync(args.profile, JSON.stringify(profile));
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
result.phaseAfter = await page.evaluate(() => window.frontierShowdown?.state?.phase);

// 4. A second, different 2v2 in the same session, to check that the first match's images are released.
await page.evaluate(() => window.frontierShowdown.quitToMenu?.());
await sleep(1000);
await page.evaluate(() => { const ui = window.frontierShowdown.ui; if (ui?.screen !== "fight") ui?.show?.("fight", { instant: true }); });
await page.evaluate((s) => window.frontierShowdown.startMatch({ mode: "2v2", stage: s, sides: [{ team: ["mark", "demis"], control: "cpu", difficulty: "hard" }, { team: ["ilya", "noam"], control: "cpu", difficulty: "hard" }] }), stage);
await sleep(8000);
result.memSecondMatch = await snapshot(page, cdp, browserCdp, "second 2v2 match");
result.secondMatchTransfer = transfer.take();
result.quality = await page.evaluate(() => window.frontierShowdown?.quality ?? null);
result.console = logs.slice(0, 30);

await browser.close();
proxy.close();
const json = JSON.stringify(result, null, 2);
if (args.out) writeFileSync(args.out, json);
console.log(json);
