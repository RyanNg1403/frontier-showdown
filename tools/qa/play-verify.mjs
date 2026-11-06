#!/usr/bin/env node
/**
 * Release play-through: drives the real UI in Chrome (title, mode, select, stage, versus, fight,
 * results, rematch, back to select) with a scripted player on the keyboard or on touch controls,
 * and records what happened.
 *
 *   npm run build && npm run preview          # or any static server for dist/
 *   npm i --no-save puppeteer-core
 *   node tools/qa/play-verify.mjs --url http://127.0.0.1:5173/frontier-showdown/ --out qa-out
 *
 * Options: --suite full|smoke (default full), --chrome <path>, --only <scenario id,...>.
 * Writes <out>/results.json and screenshots to <out>/shots/. The only test aid is filling the
 * player's super meter right before the super attempt.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseMotion } from "../../src/combat/input.js";

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : true]);
  return acc;
}, []));
const url = args.url || "http://127.0.0.1:5173/frontier-showdown/";
const out = args.out || "qa-out";
const suite = args.suite || "full";
const only = args.only ? String(args.only).split(",") : null;
const chromePath = args.chrome || process.env.CHROME_PATH || "/usr/local/bin/google-chrome";
mkdirSync(join(out, "shots"), { recursive: true });

const { default: puppeteer } = await import("puppeteer-core");

// ------------------------------------------------------------------ scenarios

const ONE = [
  { id: "1v1-a", mode: "1v1", p1: ["sam"], p2: ["dario"], stage: 0 },
  { id: "1v1-b", mode: "1v1", p1: ["mark"], p2: ["elon"], stage: 1 },
  { id: "1v1-c", mode: "1v1", p1: ["demis"], p2: ["jensen"], stage: 2 },
  { id: "1v1-d", mode: "1v1", p1: ["ilya"], p2: ["arthur"], stage: 3 },
  { id: "1v1-e", mode: "1v1", p1: ["elon"], p2: ["andrej"], stage: 4 },
  { id: "1v1-f", mode: "1v1", p1: ["dario"], p2: ["sam"], stage: 5 },
  { id: "1v1-g", mode: "1v1", p1: ["arthur"], p2: ["ilya"], stage: 6 },
  { id: "1v1-h", mode: "1v1", p1: ["jensen"], p2: ["demis"], stage: 7 },
];
const TWO = [
  { id: "2v2-a", mode: "2v2", p1: ["andrej", "yann"], p2: ["liang", "mustafa"], stage: 8 },
  { id: "2v2-b", mode: "2v2", p1: ["liang", "mustafa"], p2: ["geoffrey", "noam"], stage: 9 },
  { id: "2v2-c", mode: "2v2", p1: ["geoffrey", "noam"], p2: ["chris", "feifei"], stage: 10 },
  { id: "2v2-d", mode: "2v2", p1: ["chris", "feifei"], p2: ["andrej", "yann"], stage: 11 },
];
const MOBILE = [
  { id: "mobile-1v1", mode: "1v1", p1: ["noam"], p2: ["feifei"], stage: 2, touch: true },
  { id: "mobile-2v2", mode: "2v2", p1: ["yann", "chris"], p2: ["sam", "mark"], stage: 5, touch: true },
];
const SMOKE = [
  { id: "live-1v1", mode: "1v1", p1: ["sam"], p2: ["elon"], stage: 0 },
  { id: "live-2v2", mode: "2v2", p1: ["dario", "jensen"], p2: ["demis", "feifei"], stage: 3 },
  { id: "live-mobile", mode: "1v1", p1: ["mark"], p2: ["ilya"], stage: 6, touch: true },
];

// ------------------------------------------------------------------ browser helpers

const KEYS = { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", LP: "KeyU", HP: "KeyI", LK: "KeyJ", HK: "KeyK", BLOCK: "KeyL", TAG: "KeyO", ASSIST: "KeyP" };
const DIR_KEYS = { 1: ["down", "left"], 2: ["down"], 3: ["down", "right"], 4: ["left"], 5: [], 6: ["right"], 7: ["up", "left"], 8: ["up"], 9: ["up", "right"] };
const MIRROR = { 1: 3, 3: 1, 4: 6, 6: 4, 7: 9, 9: 7 };
const mirror = (d, facing) => (facing < 0 ? MIRROR[d] ?? d : d);

const PHONE = { width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true, isLandscape: true };
const PHONE_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Mobile Safari/537.36";

async function launch(userDataDir) {
  return puppeteer.launch({
    executablePath: chromePath,
    headless: "new",
    userDataDir,
    args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
  });
}

/** Record console problems, page errors and failed requests for one page. */
function watch(page, issues) {
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warn" || m.type() === "warning") issues.push({ kind: `console.${m.type()}`, text: m.text().slice(0, 300) });
  });
  page.on("pageerror", (e) => issues.push({ kind: "pageerror", text: String(e.message).slice(0, 300) }));
  page.on("requestfailed", (r) => {
    const why = r.failure()?.errorText || "";
    if (why.includes("ERR_ABORTED") && /\.(mp3|ogg|opus|webm|m4a)/.test(r.url())) return;
    issues.push({ kind: "requestfailed", text: `${r.url()} ${why}` });
  });
  page.on("response", (r) => { if (r.status() >= 400) issues.push({ kind: `http ${r.status()}`, text: r.url() }); });
}

/** In-page recorder: game events, a 100 ms sampler for stuck states and bad positions, audio starts. */
async function instrument(page) {
  await page.evaluate(() => {
    if (window.__qa) return;
    const g = window.frontierShowdown;
    const qa = (window.__qa = { counts: {}, moves: [], log: [], problems: [], sounds: 0 });
    g.events.on("*", (name, p = {}) => {
      qa.counts[name] = (qa.counts[name] || 0) + 1;
      if (name === "special" || name === "super") qa.moves.push({ name, side: p.side, fighter: p.fighter, moveId: p.moveId, assist: !!p.assist });
      if (["throw", "block", "tag", "assist", "ko", "roundEnd", "matchEnd", "matchStart", "lastStanding", "finisher", "finishThem"].includes(name)) qa.log.push({ name, ...p });
    });
    const ctx = window.AudioBufferSourceNode?.prototype;
    if (ctx && !ctx.__qa) {
      const start = ctx.start;
      ctx.start = function (...a) { qa.sounds += 1; return start.apply(this, a); };
      ctx.__qa = true;
    }
    const since = new Map();
    setInterval(() => {
      const m = g.match;
      if (!m || g.state?.paused) return;
      for (const f of m.fighters) {
        if (!Number.isFinite(f.x) || !Number.isFinite(f.y)) qa.problems.push({ kind: "non-finite", id: f.id, x: f.x, y: f.y });
        if (f.y > 1) qa.problems.push({ kind: "below-floor", id: f.id, y: f.y, state: f.state });
        const key = `${f.side}:${f.id}`;
        const neutral = f.isNeutral || ["bench", "ko", "dazed", "finished", "win", "lose", "intro"].includes(f.state) || m.phase !== "fight";
        const prev = since.get(key);
        if (neutral || !prev || prev.state !== f.state) since.set(key, { state: f.state, t: performance.now() });
        else if (performance.now() - prev.t > 5000 && !prev.flagged) {
          prev.flagged = true;
          qa.problems.push({ kind: "stuck", id: f.id, state: f.state, phase: m.phase });
        }
        if (f.state === "attack" && f.anim?.name === "idle") qa.problems.push({ kind: "attack-drawn-idle", id: f.id, move: f.move?.id });
      }
    }, 100);
  });
}

async function boot(page) {
  await page.goto(url, { waitUntil: "load", timeout: 90000 });
  await page.waitForFunction(() => window.frontierShowdown?.ui && !document.querySelector(".fs-loading:not([hidden]), #loading:not([hidden])"), { timeout: 90000 });
  await instrument(page);
  await sleep(600);
}

const screen = (page) => page.evaluate(() => document.querySelector(".fs-screen.is-active")?.getAttribute("aria-label") || null);
async function waitScreen(page, label, timeout = 30000) {
  await page.waitForFunction((l) => document.querySelector(".fs-screen.is-active")?.getAttribute("aria-label") === l, { timeout }, label);
  await sleep(450);
}

async function center(page, selector, index = 0) {
  return page.evaluate((s, i) => {
    const el = document.querySelectorAll(s)[i];
    if (!el) return null;
    el.scrollIntoView({ block: "nearest", inline: "center" });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, selector, index);
}

/** Click (mouse) or tap (touch) an element by selector, or by selector + visible text. */
async function press(page, touch, selector, { index = 0, text = null } = {}) {
  if (text) {
    index = await page.evaluate((s, t) => [...document.querySelectorAll(s)].findIndex((el) => el.textContent.trim().includes(t) && el.offsetParent !== null), selector, text);
    if (index < 0) throw new Error(`no ${selector} with text "${text}"`);
  }
  const at = await center(page, selector, index);
  if (!at) throw new Error(`no element ${selector}[${index}]`);
  if (touch) await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
  await sleep(180);
}

// ------------------------------------------------------------------ keyboard player

class Keyboard {
  constructor(page) {
    this.page = page;
    this.held = new Set();
  }
  async set(keys) {
    const want = new Set(keys.map((k) => KEYS[k] || k));
    for (const k of [...this.held]) if (!want.has(k)) { await this.page.keyboard.up(k); this.held.delete(k); }
    for (const k of want) if (!this.held.has(k)) { await this.page.keyboard.down(k); this.held.add(k); }
  }
  async dir(d, extra = []) { await this.set([...DIR_KEYS[d], ...extra]); }
  async release() { await this.set([]); }
  async tap(keys, ms = 50) {
    await this.set(keys);
    await sleep(ms);
    await this.release();
  }
}

function buttonsFor(motion) {
  const m = motion.buttonMask;
  const LP = 1, HP = 2, LK = 4, HK = 8;
  const out = [];
  if (motion.all) {
    if (m & LP) out.push("LP");
    if (m & HP) out.push("HP");
    if (m & LK) out.push("LK");
    if (m & HK) out.push("HK");
    return out;
  }
  if (m & LP) out.push("LP");
  else if (m & HP) out.push("HP");
  else if (m & LK) out.push("LK");
  else if (m & HK) out.push("HK");
  return out;
}

async function doMotion(kb, input, facing, { air = false } = {}) {
  const motion = parseMotion(input);
  if (air) {
    await kb.tap(["up"], 60);
    await sleep(260);
  }
  if (motion.charge) {
    await kb.dir(mirror(motion.charge.dir, facing));
    await sleep(800);
  }
  for (const d of motion.seq) {
    await kb.dir(mirror(d, facing));
    await sleep(34);
  }
  const last = motion.seq.length ? mirror(motion.seq.at(-1), facing) : 5;
  await kb.dir(last, buttonsFor(motion));
  await sleep(50);
  await kb.release();
}

// ------------------------------------------------------------------ touch player

class Touch {
  constructor(page, cdp) {
    this.page = page;
    this.cdp = cdp;
    this.points = new Map();
    this.nextId = 1;
  }
  async send() {
    const touchPoints = [...this.points.values()].map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 8, radiusY: 8, force: 1 }));
    if (!touchPoints.length && !this.started) return;
    await this.cdp.send("Input.dispatchTouchEvent", { type: touchPoints.length ? (this.started ? "touchMove" : "touchStart") : "touchEnd", touchPoints });
    this.started = touchPoints.length > 0;
  }
  async down(name, x, y) {
    const id = this.nextId++;
    this.points.set(name, { id, x, y });
    const touchPoints = [...this.points.values()].map((p) => ({ x: p.x, y: p.y, id: p.id, radiusX: 8, radiusY: 8, force: 1 }));
    await this.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints });
    this.started = true;
  }
  async move(name, x, y) {
    const p = this.points.get(name);
    if (!p) return;
    p.x = x;
    p.y = y;
    await this.send();
  }
  async up(name) {
    if (!this.points.delete(name)) return;
    await this.send();
  }
  async releaseAll() {
    this.points.clear();
    await this.send();
  }
}

async function touchGeometry(page) {
  return page.evaluate(() => {
    const set = document.querySelector('.fs-touch__set[data-player="0"]');
    const btns = {};
    for (const el of set?.querySelectorAll(".fs-touch__btn") || []) {
      const r = el.getBoundingClientRect();
      if (r.width) btns[el.dataset.id] = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    return { W: innerWidth, H: innerHeight, btns };
  });
}

/** Stick: a finger that lands in the left third and is dragged toward `dir`. */
async function touchDir(t, geo, d) {
  const home = { x: geo.W * 0.16, y: geo.H * 0.7 };
  const v = { 1: [-1, 1], 2: [0, 1], 3: [1, 1], 4: [-1, 0], 6: [1, 0], 7: [-1, -1], 8: [0, -1], 9: [1, -1] }[d];
  if (!v) return t.up("stick");
  const r = 60;
  if (!t.points.has("stick")) await t.down("stick", home.x, home.y);
  await t.move("stick", home.x + v[0] * r, home.y + v[1] * r);
}

async function touchButton(t, geo, id, ms = 70) {
  const b = geo.btns[id];
  if (!b) return false;
  await t.down(id, b.x, b.y);
  await sleep(ms);
  await t.up(id);
  return true;
}

// ------------------------------------------------------------------ fight bot

const readState = (page) => page.evaluate(() => {
  const g = window.frontierShowdown;
  const m = g.match;
  if (!m) return null;
  const a = m.point(0);
  const b = m.point(1);
  const s = m.sides[0];
  return {
    phase: m.phase, round: m.round, wins: m.sides.map((x) => x.wins), mode: m.mode, paused: !!g.state?.paused,
    a: { id: a.id, x: a.x, facing: a.facing, state: a.state, neutral: a.isNeutral, air: a.airborne, health: a.health },
    b: { id: b.id, x: b.x, state: b.state, health: b.health },
    meter: s.meter, tagCd: s.tagCooldown, assistCd: s.assistCooldown, partnerUp: s.members.some((f) => f !== a && !f.ko && f.health > 0),
    team: s.members.map((f) => f.id),
  };
});

async function fillMeter(page) {
  await page.evaluate(() => { const m = window.frontierShowdown.match; if (m) m.sides[0].meter = 300; });
}

async function qaSnapshot(page) {
  return page.evaluate(() => ({ counts: { ...window.__qa.counts }, moves: [...window.__qa.moves], log: [...window.__qa.log], problems: [...window.__qa.problems], sounds: window.__qa.sounds }));
}

function moveDone(qa, side, fighter, moveId) {
  return qa.moves.some((m) => m.side === side && m.fighter === fighter && m.moveId === moveId && !m.assist);
}

/** Plays one match as P1 until matchEnd. Returns per-fighter coverage of the moves. */
async function playMatch(page, sc, defs, { touch = null, shots = {}, maxSeconds = 420, refreshHook = null } = {}) {
  const kb = touch ? null : new Keyboard(page);
  let geo = touch ? await touchGeometry(page) : null;
  const started = Date.now();
  const goals = {};
  for (const id of sc.p1) {
    const d = defs[id];
    goals[id] = { specials: d.sp.map((s) => s[0]), super: d.su[0], tries: {} };
  }
  const flags = { throw: false, block: false, assistA: false, assistB: false, assistBtn: false, handoff: false };
  const shot = async (name) => {
    if (shots[name] && !shots[name].done) {
      shots[name].done = true;
      await page.screenshot({ path: shots[name].path });
    }
  };
  let lastAct = 0;
  let lastRound = 0;
  while (Date.now() - started < maxSeconds * 1000) {
    const st = await readState(page);
    if (!st) break;
    if (st.phase === "matchEnd") break;
    if (refreshHook && (await refreshHook(st))) return { refreshed: true };
    if (st.round !== lastRound) {
      lastRound = st.round;
      if (touch) geo = await touchGeometry(page);
    }
    if (st.phase !== "fight" || st.paused) {
      if (kb) await kb.release();
      else await touch.releaseAll();
      if (st.phase === "finish") {
        // Leave the finisher window to time out sometimes; perform it when we won the round.
        await shot("finish");
      }
      await sleep(120);
      continue;
    }
    const qa = await qaSnapshot(page);
    const me = st.a;
    const dx = st.b.x - me.x;
    const dist = Math.abs(dx);
    const toward = dx >= 0 ? 6 : 4;
    const away = dx >= 0 ? 4 : 6;
    const g = goals[me.id];
    if (!me.neutral || me.air) { await sleep(60); continue; }
    const theirAttack = st.b.state === "attack";

    // Coverage bookkeeping.
    flags.throw ||= qa.log.some((e) => e.name === "throw" && e.side === 0);
    flags.block ||= qa.log.some((e) => e.name === "block" && e.side === 1);
    flags.assistA ||= qa.log.some((e) => e.name === "assist" && e.side === 0 && e.assist === "a");
    flags.assistB ||= qa.log.some((e) => e.name === "assist" && e.side === 0 && e.assist === "b");
    flags.handoff ||= qa.log.some((e) => e.name === "tag" && e.side === 0 && !e.forced);

    const pendingSpecial = g?.specials.find((m) => !moveDone(qa, 0, me.id, m) && (g.tries[m] || 0) < 14);
    const pendingSuper = g && !moveDone(qa, 0, me.id, g.super) && (g.tries[g.super] || 0) < 8;
    const now = Date.now();
    if (now - lastAct < 180) { await sleep(40); continue; }
    lastAct = now;

    // Blocking: hold block when the opponent is attacking close by.
    if (!flags.block && theirAttack && dist < 260) {
      if (kb) { await kb.set(["BLOCK"]); await sleep(500); await kb.release(); }
      else { const b = geo.btns.BLOCK; await touch.down("BLOCK", b.x, b.y); await sleep(500); await touch.up("BLOCK"); }
      await shot("block");
      continue;
    }

    if (pendingSpecial) {
      const def = defs[me.id].sp.find((s) => s[0] === pendingSpecial);
      g.tries[pendingSpecial] = (g.tries[pendingSpecial] || 0) + 1;
      if (dist < 110 && g.tries[pendingSpecial] % 3 === 0) {
        if (kb) { await kb.dir(away); await sleep(260); await kb.release(); }
        else { await touchDir(touch, geo, away); await sleep(260); await touch.up("stick"); }
        continue;
      }
      if (kb) await doMotion(kb, def[1], me.facing, { air: def[3] });
      else await touchSpecial(touch, geo, defs[me.id], pendingSpecial, me.facing);
      await sleep(250);
      await shot("special");
      continue;
    }
    if (pendingSuper) {
      g.tries[g.super] = (g.tries[g.super] || 0) + 1;
      await fillMeter(page);
      if (kb) await doMotion(kb, defs[me.id].su[1], me.facing);
      else await touchSuper(touch, geo);
      await sleep(400);
      await shot("super");
      continue;
    }
    if (sc.mode === "2v2" && st.partnerUp) {
      if (!flags.assistA && st.assistCd <= 0) {
        if (kb) await kb.tap(["TAG"], 40);
        else await touchButton(touch, geo, "TAG", 40);
        await sleep(300);
        await shot("assist");
        continue;
      }
      if (!flags.assistB && st.assistCd <= 0) {
        if (kb) { await kb.dir(away); await sleep(40); await kb.set([...DIR_KEYS[away], "TAG"]); await sleep(40); await kb.release(); }
        else { await touchDir(touch, geo, away); await sleep(50); await touchButton(touch, geo, "TAG", 40); await touch.up("stick"); }
        await sleep(300);
        continue;
      }
      if (!flags.assistBtn && kb && st.assistCd <= 0) {
        await kb.tap(["ASSIST"], 40);
        flags.assistBtn = qa.log.some((e) => e.name === "assist" && e.side === 0);
        await sleep(300);
        continue;
      }
      const otherPending = sc.p1.some((id) => id !== me.id && goals[id] && (goals[id].specials.some((m) => !moveDone(qa, 0, id, m) && (goals[id].tries[m] || 0) < 14) || !moveDone(qa, 0, id, goals[id].super)));
      if ((otherPending || !flags.handoff) && st.tagCd <= 0) {
        if (kb) await kb.tap(["TAG"], 300);
        else await touchButton(touch, geo, "TAG", 300);
        await sleep(700);
        await shot("tag");
        continue;
      }
    }
    // Throw: walk in and press LP+LK (touch: the Throw button).
    if (!flags.throw || Math.random() < 0.25) {
      if (dist > 72) {
        if (kb) { await kb.dir(toward); await sleep(Math.min(500, dist * 2)); await kb.release(); }
        else { await touchDir(touch, geo, toward); await sleep(Math.min(500, dist * 2)); await touch.up("stick"); }
        continue;
      }
      if (kb) await kb.tap(["LP", "LK"], 50);
      else await touchButton(touch, geo, "THROW", 60);
      await sleep(400);
      await shot("throw");
      continue;
    }
    // Free play: pressure with normals and specials until the match ends.
    if (dist > 150) {
      if (kb) { await kb.dir(toward); await sleep(350); await kb.release(); }
      else { await touchDir(touch, geo, toward); await sleep(350); await touch.up("stick"); }
    } else {
      const pick = ["HP", "HK", "LP", "LK", "special"][Math.floor(Math.random() * 5)];
      if (pick === "special") {
        const d = defs[me.id].sp[Math.floor(Math.random() * defs[me.id].sp.length)];
        if (kb) await doMotion(kb, d[1], me.facing, { air: d[3] });
        else await touchSpecial(touch, geo, defs[me.id], d[0], me.facing);
      } else if (kb) await kb.tap([pick], 50);
      else await touchButton(touch, geo, pick, 60);
    }
  }
  if (kb) await kb.release();
  else await touch.releaseAll();
  const qa = await qaSnapshot(page);
  const coverage = {};
  for (const id of sc.p1) {
    coverage[id] = {
      specials: Object.fromEntries(defs[id].sp.map((s) => [s[0], moveDone(qa, 0, id, s[0])])),
      super: moveDone(qa, 0, id, defs[id].su[0]),
    };
  }
  return { coverage, flags, timedOut: Date.now() - started >= maxSeconds * 1000 };
}

/** Simple specials on touch: SP (neutral), forward + SP, back + SP; down + SP is the super. */
async function touchSpecial(t, geo, def, moveId, facing) {
  const k = def.sp.findIndex((s) => s[0] === moveId);
  const rel = [5, 6, 4][k] ?? 5;
  const d = mirror(rel, facing);
  if (d !== 5) { await touchDir(t, geo, d); await sleep(60); }
  await touchButton(t, geo, "SP", 60);
  await sleep(40);
  await t.up("stick");
  await sleep(400);
}

async function touchSuper(t, geo) {
  await touchDir(t, geo, 2);
  await sleep(60);
  await touchButton(t, geo, "SP", 60);
  await sleep(40);
  await t.up("stick");
  await sleep(500);
}

// ------------------------------------------------------------------ menu flow

async function toSelect(page, sc, touch) {
  const s = await screen(page);
  if (s === "Title screen") {
    await press(page, touch, ".fs-title__start");
    await waitScreen(page, "Mode select");
  }
  if ((await screen(page)) === "Mode select") {
    await press(page, touch, `.fs-format[data-id="${sc.mode}"]`);
    await press(page, touch, '.fs-matchup[data-id="cpu"]');
    await waitScreen(page, "Character select");
  }
}

/** Touch: from the mode screen, turn on Settings > Touch > Simple specials (the SP button). */
async function enableSimpleSpecials(page) {
  await press(page, true, '.fs-chip-btn[data-id="settings"]');
  await page.waitForSelector(".fs-settings", { timeout: 5000 });
  await press(page, true, ".fs-settings .fs-tab", { text: "Touch" });
  await sleep(300);
  const on = () => page.evaluate(() => [...document.querySelectorAll(".fs-settings .fs-opt")].find((r) => r.querySelector(".fs-opt__label")?.textContent === "Simple specials")?.querySelector('[role="switch"]')?.getAttribute("aria-checked") === "true");
  if (!(await on())) await press(page, true, ".fs-settings .fs-opt", { text: "Simple specials" });
  const enabled = await on();
  await page.screenshot({ path: shotPath("mobile-settings-touch") });
  await press(page, true, ".fs-settings .fs-hint.is-back");
  await sleep(400);
  return enabled;
}

async function pickFighters(page, sc, touch, rosterIds) {
  for (const id of [...sc.p1, ...sc.p2]) {
    const idx = rosterIds.indexOf(id);
    await press(page, touch, ".fs-tile", { index: idx });
    if (touch) await press(page, touch, ".fs-tile", { index: idx });
    await sleep(200);
  }
  await waitScreen(page, "Stage select", 15000);
}

async function pickStage(page, sc, touch) {
  await press(page, touch, ".fs-stage-thumb", { index: sc.stage });
  if (touch && (await screen(page)) === "Stage select") await press(page, touch, ".fs-stage-thumb", { index: sc.stage });
  await waitScreen(page, "Versus", 15000);
}

async function waitFight(page) {
  await waitScreen(page, "Fight", 30000);
  await page.waitForFunction(() => window.frontierShowdown.match?.phase === "fight", { timeout: 30000 });
}

async function pauseToSelect(page, touch) {
  if (touch) await press(page, true, ".fs-touch__pause");
  else await page.keyboard.press("Escape");
  await sleep(500);
  await press(page, touch, ".fs-overlay button, .fs-menu-btn", { text: "Character Select" });
  await sleep(400);
  await press(page, touch, ".fs-overlay button", { text: "Leave" });
  await waitScreen(page, "Character select");
}

// ------------------------------------------------------------------ runs

const results = { url, suite, startedAt: new Date().toISOString(), scenarios: [], checks: {} };
const save = () => writeFileSync(join(out, "results.json"), JSON.stringify(results, null, 2));
const shotPath = (name) => join(out, "shots", `${name}.png`);

async function loadDefs() {
  const { ROSTER_ORDER } = await import("../../src/characters/index.js");
  const defs = {};
  for (const id of ROSTER_ORDER) {
    const c = (await import(`../../src/characters/${id}.js`)).default;
    defs[id] = { sp: c.specials.map((s) => [s.id, s.input, s.range, !!s.air]), su: [c.super.id, c.super.input] };
  }
  return { defs, order: [...ROSTER_ORDER] };
}

async function runScenario(browser, sc, defs, order, { first = false, rematch = true } = {}) {
  const page = await browser.newPage();
  const issues = [];
  watch(page, issues);
  let cdp = null;
  if (sc.touch) {
    await page.emulate({ viewport: PHONE, userAgent: PHONE_UA });
    cdp = await page.createCDPSession();
  } else await page.setViewport({ width: 1280, height: 720 });
  const touch = sc.touch ? new Touch(page, cdp) : null;
  const t0 = Date.now();
  const rec = { id: sc.id, mode: sc.mode, p1: sc.p1, p2: sc.p2, touch: !!sc.touch, screens: [], issues };
  try {
    await boot(page);
    // A resume prompt can be left over from an earlier run; discard it.
    const prompt = await page.$(".fs-overlay button");
    if (prompt && (await page.evaluate(() => document.querySelector(".fs-overlay")?.textContent.includes("Resume")))) await press(page, !!touch, ".fs-overlay button", { text: "Discard" });
    const tag = sc.id;
    if (first) await page.screenshot({ path: shotPath(`${tag}-01-title`) });
    if (touch) {
      await press(page, true, ".fs-title__start");
      await waitScreen(page, "Mode select");
      rec.simpleSpecials = await enableSimpleSpecials(page);
    }
    await toSelect(page, sc, !!touch);
    rec.screens.push("title", "mode", "select");
    if (first) await page.screenshot({ path: shotPath(`${tag}-02-select`) });
    await pickFighters(page, sc, !!touch, order);
    rec.screens.push("stage");
    if (first) await page.screenshot({ path: shotPath(`${tag}-03-stage`) });
    await pickStage(page, sc, !!touch);
    rec.screens.push("versus");
    await sleep(1200);
    await page.screenshot({ path: shotPath(`${tag}-04-versus`) });
    await waitFight(page);
    rec.screens.push("fight");
    const shots = Object.fromEntries(["special", "super", "throw", "block", "assist", "tag", "finish"].map((k) => [k, { path: shotPath(`${tag}-fight-${k}`) }]));
    const play = await playMatch(page, sc, defs, { touch, shots });
    Object.assign(rec, play);
    await waitScreen(page, "Match results", 30000);
    rec.screens.push("results");
    await page.screenshot({ path: shotPath(`${tag}-05-results`) });
    rec.matchLog = (await qaSnapshot(page)).log.filter((e) => ["roundEnd", "matchEnd"].includes(e.name));
    if (rematch) {
      await press(page, !!touch, ".fs-results__actions .fs-menu-btn", { text: "Rematch" });
      await waitFight(page);
      rec.screens.push("rematch");
      const reset = await page.evaluate(() => {
        const m = window.frontierShowdown.match;
        return { round: m.round, wins: m.sides.map((s) => s.wins), fullHealth: m.allFighters.every((f) => f.health === f.maxHealth || f.health === f.def?.stats?.health) };
      });
      rec.rematchReset = reset;
      await sleep(4000);
      await pauseToSelect(page, !!touch);
      rec.screens.push("select (via pause)");
      rec.matchClosed = await page.evaluate(() => !window.frontierShowdown.match);
    }
  } catch (error) {
    rec.error = String(error?.stack || error).slice(0, 800);
    await page.screenshot({ path: shotPath(`${sc.id}-error`) }).catch(() => {});
  }
  const qa = await qaSnapshot(page).catch(() => null);
  if (qa) {
    rec.eventCounts = qa.counts;
    rec.problems = qa.problems;
    rec.sounds = qa.sounds;
    rec.moves = qa.moves.length;
  }
  rec.seconds = Math.round((Date.now() - t0) / 1000);
  await page.close();
  results.scenarios.push(rec);
  save();
  console.log(`[qa] ${sc.id}: ${rec.error ? "ERROR " + rec.error.split("\n")[0] : "ok"} in ${rec.seconds}s, issues ${issues.length}, problems ${rec.problems?.length ?? "?"}`);
  return rec;
}

/** Refresh in the middle of a match: the resume prompt brings back the round, settings and picks. */
async function refreshCheck(browser, defs, order) {
  const page = await browser.newPage();
  const issues = [];
  watch(page, issues);
  await page.setViewport({ width: 1280, height: 720 });
  const sc = { id: "refresh", mode: "2v2", p1: ["sam", "jensen"], p2: ["elon", "noam"], stage: 4 };
  const rec = { issues };
  try {
    await boot(page);
    // Change two settings through the settings overlay on the title screen.
    await page.keyboard.press("KeyI");
    await page.waitForSelector(".fs-settings", { timeout: 5000 });
    await press(page, false, ".fs-settings .fs-tab", { text: "Gameplay" });
    await sleep(300);
    // Round timer 99 s -> 60 s with the row's left arrow; Music to 40 % with the fourth pip.
    const rowIndex = (label) => page.evaluate((l) => [...document.querySelectorAll(".fs-settings .fs-opt")].findIndex((r) => r.querySelector(".fs-opt__label")?.textContent === l), label);
    await press(page, false, `.fs-settings .fs-opt:nth-child(${(await rowIndex("Round timer")) + 1}) .fs-opt__arrow`);
    await press(page, false, ".fs-settings .fs-tab", { text: "Audio" });
    await sleep(300);
    await press(page, false, `.fs-settings .fs-opt:nth-child(${(await rowIndex("Music")) + 1}) .fs-opt__track i`, { index: 3 });
    await page.mouse.move(5, 5);
    await page.screenshot({ path: shotPath("refresh-01-settings") });
    await page.keyboard.press("Escape");
    await sleep(400);
    rec.settingsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("frontier-showdown.settings.v1")));
    await toSelect(page, sc, false);
    await pickFighters(page, sc, false, order);
    await pickStage(page, sc, false);
    await waitFight(page);
    // Play until round 1 ends, then refresh during round 2.
    const hook = async (st) => st.round >= 2 && st.phase === "fight";
    const play = await playMatch(page, sc, defs, { refreshHook: hook, maxSeconds: 240 });
    rec.beforeRefresh = await page.evaluate(() => { const m = window.frontierShowdown.match; return { round: m.round, wins: m.sides.map((s) => s.wins), stage: m.stage?.id ?? m.stage, teams: m.sides.map((s) => s.members.map((f) => f.id)) }; });
    rec.reachedRound2 = !!play.refreshed;
    await sleep(1500);
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => window.frontierShowdown?.ui, { timeout: 60000 });
    await page.waitForSelector(".fs-overlay", { timeout: 15000 });
    await sleep(600);
    rec.prompt = await page.evaluate(() => document.querySelector(".fs-overlay")?.innerText);
    rec.focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
    await page.screenshot({ path: shotPath("refresh-02-resume-prompt") });
    await press(page, false, ".fs-overlay button", { text: "Resume" });
    await waitFight(page);
    await sleep(1500);
    await page.screenshot({ path: shotPath("refresh-03-resumed") });
    rec.afterResume = await page.evaluate(() => { const m = window.frontierShowdown.match; return { round: m.round, wins: m.sides.map((s) => s.wins), stage: m.stage?.id ?? m.stage, teams: m.sides.map((s) => s.members.map((f) => f.id)), timer: m.timer ?? null, roundTime: m.roundTime ?? m.timerMax ?? null }; });
    rec.settingsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("frontier-showdown.settings.v1")));
    rec.settingsUi = await page.evaluate(() => window.frontierShowdown.ui.settings.get().gameplay);
    await pauseToSelect(page, false);
    // Reload once more: menus come back on the last mode, and the select cursor on the last pick.
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => window.frontierShowdown?.ui, { timeout: 60000 });
    await sleep(1500);
    rec.lastPicks = await page.evaluate(() => window.frontierShowdown.ui.session.lastPicks);
    rec.modeAfterReload = await page.evaluate(() => window.frontierShowdown.ui.session.mode);
    await press(page, false, ".fs-title__start");
    await waitScreen(page, "Mode select");
    await press(page, false, '.fs-matchup[data-id="cpu"]');
    await waitScreen(page, "Character select");
    await page.mouse.move(5, 5);
    await sleep(300);
    rec.selectCursor = await page.evaluate(() => document.querySelector(".fs-tile .fs-tile__cursor.is-p1.is-on")?.closest(".fs-tile")?.getAttribute("aria-label"));
    rec.selectMode = await page.evaluate(() => document.querySelector(".fs-select__mode-chip")?.textContent);
    await page.screenshot({ path: shotPath("refresh-04-select-remembers-picks") });
    rec.lastSession = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith("frontier")).map((k) => [k, localStorage.getItem(k).slice(0, 400)])));
  } catch (error) {
    rec.error = String(error?.stack || error).slice(0, 800);
    await page.screenshot({ path: shotPath("refresh-error") }).catch(() => {});
  }
  await page.close();
  results.checks.refresh = rec;
  save();
  console.log(`[qa] refresh: ${rec.error ? "ERROR " + rec.error.split("\n")[0] : "ok"}`);
}

/** Offline reload: after a first visit the service worker serves the shell and cached art. */
async function offlineCheck(browser) {
  const page = await browser.newPage();
  const issues = [];
  watch(page, issues);
  await page.setViewport({ width: 1280, height: 720 });
  const rec = { issues };
  try {
    await boot(page);
    await page.waitForFunction(() => navigator.serviceWorker?.controller, { timeout: 30000 }).catch(() => {});
    rec.controlledBefore = await page.evaluate(() => !!navigator.serviceWorker?.controller);
    if (!rec.controlledBefore) {
      await page.reload({ waitUntil: "load" });
      await page.waitForFunction(() => navigator.serviceWorker?.controller, { timeout: 30000 });
    }
    rec.caches = await page.evaluate(async () => { const keys = await caches.keys(); const out = {}; for (const k of keys) out[k] = (await (await caches.open(k)).keys()).length; return out; });
    await page.setOfflineMode(true);
    issues.length = 0;
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => window.frontierShowdown?.ui, { timeout: 60000 });
    await instrument(page);
    await sleep(1500);
    rec.offlineBoot = await screen(page);
    await page.screenshot({ path: shotPath("offline-01-title") });
    // The fighters and stage from the previous visit are cached; play a CPU vs CPU round offline.
    await press(page, false, ".fs-title__start");
    await waitScreen(page, "Mode select");
    await press(page, false, '.fs-format[data-id="1v1"]');
    await press(page, false, '.fs-matchup[data-id="cpuvcpu"]');
    await waitScreen(page, "Character select");
    const order = (await page.evaluate(() => window.frontierShowdown.roster.map((f) => f.id)));
    for (const id of ["sam", "dario"]) await press(page, false, ".fs-tile", { index: order.indexOf(id) });
    await waitScreen(page, "Stage select", 15000);
    await press(page, false, ".fs-stage-thumb", { index: 0 });
    await waitScreen(page, "Versus", 15000);
    await waitFight(page);
    await sleep(6000);
    await page.screenshot({ path: shotPath("offline-02-fight") });
    rec.offlineFight = await page.evaluate(() => ({ phase: window.frontierShowdown.match?.phase, hits: window.__qa.counts.hit || 0 }));
    await page.setOfflineMode(false);
  } catch (error) {
    rec.error = String(error?.stack || error).slice(0, 800);
    await page.screenshot({ path: shotPath("offline-error") }).catch(() => {});
  }
  await page.close();
  results.checks.offline = rec;
  save();
  console.log(`[qa] offline: ${rec.error ? "ERROR " + rec.error.split("\n")[0] : "ok"}`);
}

const { defs, order } = await loadDefs();
const profile = join(out, "profile");
let browser = await launch(profile);
const list = suite === "smoke" ? SMOKE : [...ONE.slice(0, 4), ...TWO, ...ONE.slice(4), ...MOBILE];
let first = true;
for (const sc of list) {
  if (only && !only.includes(sc.id)) continue;
  await runScenario(browser, sc, defs, order, { first });
  first = false;
}
if (!only || only.includes("refresh")) await refreshCheck(browser, defs, order);
if (!only || only.includes("offline")) await offlineCheck(browser);
await browser.close();
results.finishedAt = new Date().toISOString();
save();
console.log(`[qa] wrote ${join(out, "results.json")}`);
