#!/usr/bin/env node
/**
 * Voice-clip play-test against a static build: walks the real UI (mode, character select, stage,
 * versus, fight) for a 1v1 and a 2v2, and records every audio buffer that starts, by file, plus
 * what the voice packs cost to download and decode. `--phone` emulates a landscape phone with
 * touch and a 4x slower CPU.
 *
 *   npm run build && npm run preview          # or any static server for dist/
 *   npm i --no-save puppeteer-core
 *   node tools/qa/voice-verify.mjs --url http://127.0.0.1:5173/frontier-showdown/ [--phone] [--out qa-out/voices.json]
 *
 * Test aids: both supers are pre-filled, P1 holds Tag in 2v2, and the losing side's health is
 * cut so the match ends in a few rounds. Everything else (CPU specials, KOs, win) is the game.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]);
  return acc;
}, []));
const url = args.url || "http://127.0.0.1:5173/frontier-showdown/";
const phone = Boolean(args.phone);
const out = args.out || `qa-out/voices${phone ? "-phone" : ""}.json`;
const chromePath = args.chrome || process.env.CHROME_PATH || "/usr/local/bin/google-chrome";
const { default: puppeteer } = await import("puppeteer-core");

const SCENARIOS = [
  { id: "1v1", mode: "1v1", matchup: "cpu", sides: [["sam"], ["jensen"]] },
  { id: "2v2", mode: "2v2", matchup: "cpu", sides: [["dario", "yann"], ["chris", "liang"]] },
];

// Installed before any module loads: tags each decoded buffer with the URL it came from.
function probe() {
  const urls = new WeakMap();
  const rab = Response.prototype.arrayBuffer;
  Response.prototype.arrayBuffer = function () { return rab.call(this).then((b) => { urls.set(b, this.url); return b; }); };
  const AC = window.AudioContext;
  const decode = AC.prototype.decodeAudioData;
  AC.prototype.decodeAudioData = function (data, ok, fail) {
    const src = urls.get(data);
    return decode.call(this, data, (b) => { b.__src = src; ok?.(b); }, fail).then((b) => { if (b) b.__src = src; return b; });
  };
  const qa = (window.__voices = { starts: [], decodedBytes: {} });
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when = 0, ...rest) {
    const src = this.buffer?.__src || "";
    const file = decodeURIComponent(new URL(src || "about:blank").pathname).split("/assets/audio/")[1] || src;
    qa.starts.push({ file, at: performance.now(), screen: document.querySelector(".fs-screen.is-active")?.dataset.screen ?? null });
    return start.call(this, when, ...rest);
  };
}

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: "new",
  args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
});
const page = await browser.newPage();
const cdp = await page.createCDPSession();
if (phone) {
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true, isLandscape: true });
  await page.setUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
} else {
  await page.setViewport({ width: 1280, height: 720 });
}
await page.evaluateOnNewDocument(probe);

const requests = [];
const issues = [];
page.on("response", async (r) => {
  const u = decodeURIComponent(new URL(r.url()).pathname);
  if (!u.includes("/assets/audio/")) return;
  const len = Number(r.headers()["content-length"] || 0);
  requests.push({ file: u.split("/assets/audio/")[1], status: r.status(), bytes: len, t: Date.now() });
  if (r.status() >= 400) issues.push(`http ${r.status()} ${u}`);
});
page.on("console", (m) => { if (["error", "warn", "warning"].includes(m.type()) && /audio|voice/i.test(m.text())) issues.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => issues.push(`pageerror ${e.message}`));

const t0 = Date.now();
await page.goto(url, { waitUntil: "load", timeout: 120000 });
await page.waitForFunction(() => window.frontierShowdown?.ui, { timeout: 120000 });
await sleep(1500);
const bootVoiceRequests = requests.filter((r) => r.file.startsWith("voices/")).length;

const ui = (fn, ...a) => page.evaluate(fn, ...a);
const screenIs = (id, timeout = 60000) => page.waitForFunction((s) => window.frontierShowdown.ui.screen === s, { timeout }, id);

async function holdKey(code, ms) {
  await page.keyboard.down(code);
  await sleep(ms);
  await page.keyboard.up(code);
}

const results = [];
for (const sc of SCENARIOS) {
  const mark = await ui(() => window.__voices.starts.length);
  const reqMark = requests.length;
  await ui(() => window.frontierShowdown.ui.show("mode"));
  await screenIs("mode");
  await ui((s) => { const u = window.frontierShowdown.ui; u.session.mode = s.mode; u.session.matchup = s.matchup; return u.show("select", { fresh: true }); }, sc);
  await screenIs("select");
  await sleep(2500);
  await ui((s) => {
    const u = window.frontierShowdown.ui;
    u.session.sides = s.sides.map((picks, i) => ({ control: i === 0 ? "human" : "cpu", player: i, picks: [...picks] }));
    u.session.stageId = window.frontierShowdown.getStages()[0]?.id;
    return u.show("stage");
  }, sc);
  await screenIs("stage");
  await sleep(1200);
  await ui(() => window.frontierShowdown.ui.show("versus"));
  await screenIs("versus");
  await screenIs("fight", 30000);
  await page.waitForFunction(() => window.frontierShowdown.match?.phase === "fight", { timeout: 120000 });
  const matchStartedAt = Date.now();

  // Frame pacing during the fight (rAF intervals), sampled for 4 s.
  const frames = await ui(() => new Promise((res) => {
    const d = [];
    let last = performance.now();
    const end = last + 4000;
    const f = (t) => { d.push(t - last); last = t; if (t < end) requestAnimationFrame(f); else res(d); };
    requestAnimationFrame(f);
  }));

  let tagged = sc.mode !== "2v2";
  while (Date.now() - matchStartedAt < 240000) {
    const st = await ui(() => {
      const m = window.frontierShowdown.match;
      if (!m) return null;
      for (const s of m.sides) if (s.meter < 300) s.meter = 300;
      // Shorten each round: the CPU side takes the losses, but only after some fighting.
      if (m.phase === "fight" && m.phaseFrame > 420) for (const f of m.sides[1].members) if (f.onField && f.health > 1) f.health = Math.min(f.health, 1);
      return { phase: m.phase, tagCd: m.sides[0].tagCooldown, round: m.round };
    });
    if (!st || st.phase === "matchEnd") break;
    if (!tagged && st.phase === "fight" && !st.tagCd) {
      await holdKey("KeyO", 400);
      tagged = await ui(() => window.__voices.starts.some((s) => /-tag-in\.ogg$/.test(s.file)));
      continue;
    }
    if (st.phase === "fight") {
      // QCF,QCF + HP: every fighter's super motion in this roster.
      for (const k of ["KeyS", "KeyD"]) { await page.keyboard.down(k); await sleep(30); }
      await page.keyboard.up("KeyS"); await page.keyboard.up("KeyD");
      for (const k of ["KeyS", "KeyD"]) { await page.keyboard.down(k); await sleep(30); }
      await page.keyboard.up("KeyS");
      await page.keyboard.down("KeyI"); await sleep(50); await page.keyboard.up("KeyI"); await page.keyboard.up("KeyD");
    }
    await sleep(500);
  }
  await sleep(6000);
  const starts = await ui((m) => window.__voices.starts.slice(m), mark);
  const voices = starts.filter((s) => s.file.startsWith("voices/") || s.file.startsWith("voice/"));
  const voiceReq = requests.slice(reqMark).filter((r) => r.file.startsWith("voices/"));
  results.push({
    scenario: sc.id,
    fighters: sc.sides,
    voiceStarts: voices.map((v) => `${v.screen}: ${v.file}`),
    kenneyFallbacks: voices.filter((v) => v.file.startsWith("voice/") && !/round-3|finish-them/.test(v.file)).map((v) => v.file),
    voiceRequests: voiceReq.length,
    voiceBytes: voiceReq.reduce((n, r) => n + r.bytes, 0),
    voiceFilesFetched: [...new Set(voiceReq.map((r) => r.file.split("/")[1].split("-")[0]))],
    frames: { avgMs: +(frames.reduce((a, b) => a + b, 0) / frames.length).toFixed(2), p95Ms: +[...frames].sort((a, b) => a - b)[Math.floor(frames.length * 0.95)].toFixed(2) },
  });
  await ui(() => window.frontierShowdown.endMatch?.());
  await sleep(800);
}

const report = { url, phone, seconds: Math.round((Date.now() - t0) / 1000), bootVoiceRequests, issues: [...new Set(issues)], results };
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
