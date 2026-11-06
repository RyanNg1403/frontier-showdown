import { createVfx, loadVfxAssets, effectCatalog, createFrameEventRouter, inferFootfallEvents, LAB_IDS } from "./index.js";

const W = 1280;
const H = 720;
const GROUND = 600;
const STEP = 1 / 60;
const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
const statusEl = document.getElementById("status");

const FAMILY_TITLES = {
  hits: "Hit, block and break",
  dust: "Dust and footfalls",
  motion: "Afterimages and trails",
  cinematic: "Super, KO and tag",
  labs: "Lab projectiles and specials",
  "lab-templates": "Reusable special templates",
};

// --- Stand-in fighters (old run atlases; the rebuild's fighters load from assets/fighters/<id>/) ---
const CELL = 256;
const ANCHOR = { x: 128, y: 246 };
const FIGHTER_SCALE = 1.6;

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// The old atlas has a right-facing 8-frame run on row 3 and idles from row 4.
function legacyAtlas(image) {
  const run = { fps: 14, loop: true, frames: [] };
  for (let i = 0; i < 8; i += 1) run.frames.push({ x: i * CELL, y: 3 * CELL, w: CELL, h: CELL });
  return {
    image,
    animations: {
      idle: { fps: 1, loop: true, frames: [{ x: 0, y: 7 * CELL, w: CELL, h: CELL }] },
      run: inferFootfallEvents(run, "run"),
    },
  };
}

function makeFighter(atlas, x, facing) {
  return { atlas, x, y: GROUND, facing, anim: "idle", frame: 0, frameT: 0, vx: 0, shakeT: 0 };
}

function fighterFrame(f) {
  const anim = f.atlas.animations[f.anim];
  return anim.frames[f.frame % anim.frames.length];
}

function fighterSprite(f) {
  const fr = fighterFrame(f);
  return { image: f.atlas.image, sx: fr.x, sy: fr.y, sw: fr.w, sh: fr.h, anchorX: ANCHOR.x, anchorY: ANCHOR.y, scale: FIGHTER_SCALE, flip: f.facing < 0, x: f.x, y: f.y };
}

function drawFighter(c, f, cam) {
  if (!f.atlas.image) return;
  const fr = fighterFrame(f);
  const jitter = f.shakeT > 0 ? (Math.floor(f.shakeT * 60) % 2 ? 3 : -3) : 0;
  c.save();
  c.translate(Math.round(f.x - cam.x + jitter), Math.round(f.y - cam.y));
  c.scale(f.facing * FIGHTER_SCALE, FIGHTER_SCALE);
  c.drawImage(f.atlas.image, fr.x, fr.y, fr.w, fr.h, -ANCHOR.x, -ANCHOR.y, fr.w, fr.h);
  c.restore();
}

// --- Backdrop ---
function drawBackdrop(c, cam) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1a1530");
  g.addColorStop(0.6, "#2b2140");
  g.addColorStop(1, "#120e1c");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  const ox = -cam.x;
  const oy = -cam.y;
  c.fillStyle = "#231b36";
  for (let i = -2; i < 12; i += 1) {
    const bx = Math.round(i * 150 + ((ox * 0.5) % 150));
    c.fillRect(bx, 170 + oy * 0.5, 96, 360);
    c.fillStyle = i % 2 ? "#3a2d5c" : "#2e2450";
    c.fillRect(bx + 12, 196 + oy * 0.5, 72, 8);
    c.fillRect(bx + 12, 230 + oy * 0.5, 40, 8);
    c.fillStyle = "#231b36";
  }
  c.fillStyle = "#3b3049";
  c.fillRect(0, GROUND + oy, W, H - GROUND);
  c.fillStyle = "#4d405f";
  c.fillRect(0, GROUND + oy, W, 6);
  c.fillStyle = "#2c2338";
  for (let x = ((ox % 64) + 64) % 64 - 64; x < W; x += 64) c.fillRect(Math.round(x), GROUND + oy + 6, 4, H - GROUND);
}

// --- Scene state ---
const state = {
  assets: null,
  useAtlas: true,
  vfx: null,
  router: null,
  p1: null,
  p2: null,
  portraits: {},
  last: null,
  playAll: false,
  queue: [],
  queueT: 0,
  footfall: null,
  timers: [],
};

function sceneInfo() {
  const { p1, p2 } = state;
  return {
    p1, p2, ground: GROUND,
    hit: { x: p2.x - 52, y: GROUND - 150 },
    mid: { x: (p1.x + p2.x) / 2, y: GROUND - 150 },
    portraits: state.portraits,
    sprite: () => fighterSprite(p1),
    sprite2: () => fighterSprite(p2),
  };
}

const HITSTOP = { hit_light: 7, hit_heavy: 12, hit_counter: 16, block: 6, throw_tech: 10, guard_break: 18, combo_breaker: 14 };

// Per-type demo scripts. Anything not listed falls back to its family default.
const DEMOS = {
  dust_step: (v, s) => { v.spawn("dust_step", s.p1.x - 10, s.ground, { dir: 1 }); v.spawn("dust_step", s.p1.x + 22, s.ground, { dir: 1, delay: 0.25 }); },
  afterimage: (v, s) => {
    for (let i = 1; i <= 3; i += 1) v.spawn("afterimage", 0, 0, { sprite: { ...s.sprite(), x: s.p1.x - i * 46 }, lab: "openai", life: 0.25 + i * 0.12, alpha: 0.8 - i * 0.15 });
  },
  afterimage_trail: (v, s) => {
    const x0 = s.p1.x;
    s.p1.x = x0 - 240;
    s.p1.vx = 1100;
    after(0.22, () => { s.p1.vx = 0; });
    after(0.9, () => { s.p1.x = x0; });
    v.spawn("dust_dash", s.p1.x, s.ground, { dir: 1 });
    return v.spawn("afterimage_trail", 0, 0, { sprite: s.sprite, lab: "openai", life: 0.3 });
  },
  motion_trail: (v, s) => v.spawn("motion_trail", 0, 0, {
    lab: "anthropic",
    width: 14,
    life: 0.6,
    follow: (t) => (t < 0.3 ? { x: s.p1.x + 10 + Math.cos(-2.6 + t * 9) * 90, y: s.ground - 90 + Math.sin(-2.6 + t * 9) * 90 } : null),
  }),
  slash_arc: (v, s) => v.spawn("slash_arc", s.p1.x + 10, s.ground - 110, { dir: 1, lab: "mistral", radius: 100 }),
  super_freeze: (v, s) => v.spawn("super_freeze", s.p1.x + 30, s.ground - 140, { lab: "openai", portrait: s.portraits.sam, side: "left" }),
  ko: (v, s) => v.spawn("ko", s.hit.x, s.hit.y, { dir: 1 }),
  tag_in: (v, s) => v.spawn("tag_in", s.p1.x, s.ground, { lab: "anthropic", side: "left" }),
  tag_out: (v, s) => v.spawn("tag_out", s.p2.x, s.ground, { lab: "deepmind", side: "right" }),
};

const HOLDS = { super_freeze: 1.4, ko: 2.4, afterimage_trail: 1.1, tag_in: 1.0, lab_aura: 1.3, lab_vortex: 1.4, lab_ground_wave: 1.1 };

function after(seconds, fn) {
  state.timers.push({ t: seconds, fn });
}

const TEMPLATE_DEMOS = {
  lab_burst: (v, s, o) => v.spawn("lab_burst", s.mid.x, s.mid.y, o),
  lab_pillar: (v, s, o) => v.spawn("lab_pillar", s.mid.x + 120, s.ground, o),
  lab_beam: (v, s, o) => v.spawn("lab_beam", s.p1.x + 60, s.ground - 120, { ...o, length: 640 }),
  lab_slash_x: (v, s, o) => v.spawn("lab_slash_x", s.mid.x + 60, s.mid.y, o),
  lab_aura: (v, s, o) => v.spawn("lab_aura", s.p1.x, s.ground, { ...o, follow: () => ({ x: s.p1.x, y: s.ground }) }),
  lab_ground_wave: (v, s, o) => v.spawn("lab_ground_wave", s.p1.x + 40, s.ground, o),
  lab_vortex: (v, s, o) => v.spawn("lab_vortex", s.mid.x + 80, s.mid.y, o),
  lab_charge: (v, s, o) => v.spawn("lab_charge", s.p1.x + 60, s.ground - 120, o),
};

const TEMPLATE_LAB = { lab_burst: "openai", lab_pillar: "anthropic", lab_beam: "deepmind", lab_slash_x: "xai", lab_aura: "meta", lab_ground_wave: "nvidia", lab_vortex: "deepseek", lab_charge: "mistral" };

function templateLabFor(type) {
  const pick = document.getElementById("optLab")?.value;
  return pick && pick !== "auto" ? pick : TEMPLATE_LAB[type];
}

function labDemo(item, v, s) {
  s.p2.x = 1040;
  s.mid.x = (s.p1.x + s.p2.x) / 2;
  if (item.type.startsWith("projectile_")) {
    const x0 = s.p1.x + 70;
    const fx = v.spawn(item.type, x0, s.ground - 130, { dir: 1, speed: 700 });
    after((s.p2.x - 50 - x0) / 700, () => fx && fx.impact());
    return fx;
  }
  if (item.type.startsWith("special_")) return v.spawn(item.type, s.p1.x + 20, s.ground, { dir: 1 });
  const lab = item.demo.lab || templateLabFor(item.type);
  return TEMPLATE_DEMOS[item.type](v, s, { dir: 1, lab });
}

function familyDefault(item, v, s) {
  if (item.family === "labs" || item.family === "lab-templates") return labDemo(item, v, s);
  const o = { dir: 1, ...(item.demo.opts || {}) };
  switch (item.family) {
    case "hits": return v.spawn(item.type, s.hit.x, s.hit.y, o);
    case "dust": return v.spawn(item.type, s.p1.x + (item.demo.dx || 0), s.ground + (item.demo.dy || 0), o);
    default: return v.spawn(item.type, s.mid.x + (item.demo.dx || 0), s.mid.y + (item.demo.dy || 0), o);
  }
}

function runDemo(item, v = state.vfx, live = true) {
  const s = sceneInfo();
  const fn = item.demo.script || DEMOS[item.type];
  const handle = fn ? fn(v, s, item) : familyDefault(item, v, s);
  if (live && item.family === "hits" && document.getElementById("optHitstop").checked) {
    v.hitstop(HITSTOP[item.type] || 0);
    state.p2.shakeT = (HITSTOP[item.type] || 0) / 60;
  }
  return handle;
}

function makeVfx(seed) {
  return createVfx(ctx, state.useAtlas ? state.assets : null, { seed, shake: document.getElementById("optShake")?.checked !== false });
}

function play(item) {
  state.last = item;
  runDemo(item);
  statusEl.textContent = `${item.label}  [${item.type}]`;
}

// --- Fixed-step loop ---
function simStep(dt) {
  const v = state.vfx;
  const gameDt = v.isFrozen() || v.isHitstopped() ? 0 : dt * v.timeScale();
  for (const f of [state.p1, state.p2]) {
    if (f.shakeT > 0) f.shakeT = Math.max(0, f.shakeT - dt);
    if (gameDt === 0) continue;
    const anim = f.atlas.animations[f.anim];
    f.frameT += gameDt;
    const spf = 1 / anim.fps;
    while (f.frameT >= spf) {
      f.frameT -= spf;
      f.frame = (f.frame + 1) % anim.frames.length;
      state.router.onFrame(f, f.anim, f.frame, anim);
    }
    f.x += f.vx * gameDt;
  }
  if (state.footfall) state.footfall(gameDt);
  for (let i = state.timers.length - 1; i >= 0; i -= 1) {
    const tm = state.timers[i];
    tm.t -= dt;
    if (tm.t <= 0) {
      state.timers.splice(i, 1);
      tm.fn();
    }
  }
  if (state.playAll) {
    state.queueT -= dt;
    if (state.queueT <= 0) {
      if (!state.queue.length) state.queue = effectCatalog().slice();
      const item = state.queue.shift();
      play(item);
      state.queueT = (item.demo.hold ?? HOLDS[item.type] ?? 0.9);
    }
  }
  v.update(dt);
}

function render(target = ctx) {
  const v = state.vfx;
  const cam = v.applyShake({ x: 0, y: 0 });
  drawBackdrop(target, cam);
  v.draw(target, cam, "back");
  drawFighter(target, state.p1, cam);
  drawFighter(target, state.p2, cam);
  v.draw(target, cam, "front");
}

let acc = 0;
let lastTime = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - (lastTime || now)) / 1000);
  lastTime = now;
  acc += dt;
  while (acc >= STEP) {
    simStep(STEP);
    acc -= STEP;
  }
  render();
  requestAnimationFrame(frame);
}

// --- Deterministic captures for docs and progress shots ---
function resetScene(seed = 1234) {
  state.vfx = makeVfx(seed);
  state.router = createFrameEventRouter(state.vfx);
  state.p1 = makeFighter(state.p1?.atlas || state.p1Atlas, 520, 1);
  state.p2 = makeFighter(state.p2?.atlas || state.p2Atlas, 760, -1);
  state.footfall = null;
  state.playAll = false;
  state.timers = [];
}

function cropFrom(src, focus, cw, chh) {
  const out = document.createElement("canvas");
  out.width = cw;
  out.height = chh;
  const c = out.getContext("2d");
  c.imageSmoothingEnabled = false;
  if (focus === "full") c.drawImage(src, 0, 0, W, H, 0, 0, cw, chh);
  else c.drawImage(src, Math.round(focus.x - cw / 2), Math.round(focus.y - chh / 2), cw, chh, 0, 0, cw, chh);
  return out;
}

function sheet(family, o = {}) {
  const items = effectCatalog().filter((i) => !family || i.family === family || (Array.isArray(family) && family.includes(i.family)));
  const frames = o.frames || [1, 3, 6, 10, 16, 24];
  const cw = o.cellW || 220;
  const chh = o.cellH || 200;
  const labelW = 190;
  const head = 54;
  const out = document.createElement("canvas");
  out.width = labelW + frames.length * (cw + 4) + 4;
  out.height = head + items.length * (chh + 4) + 4;
  const oc = out.getContext("2d");
  oc.imageSmoothingEnabled = false;
  oc.fillStyle = "#0b0a10";
  oc.fillRect(0, 0, out.width, out.height);
  oc.fillStyle = "#ffb02e";
  oc.font = "bold 18px monospace";
  oc.fillText(o.title || `Frontier Showdown VFX - ${family || "all"}`, 12, 24);
  oc.font = "12px monospace";
  oc.fillStyle = "#8d86a3";
  frames.forEach((f, i) => oc.fillText(`frame ${f}`, labelW + i * (cw + 4) + 8, 46));
  const scratch = document.createElement("canvas");
  scratch.width = W;
  scratch.height = H;
  const sc = scratch.getContext("2d");
  sc.imageSmoothingEnabled = false;
  items.forEach((item, row) => {
    const y = head + row * (chh + 4);
    oc.fillStyle = "#e9e4f5";
    oc.font = "13px monospace";
    oc.fillText(item.label, 10, y + chh / 2 - 6);
    oc.fillStyle = "#8d86a3";
    oc.font = "11px monospace";
    oc.fillText(item.type, 10, y + chh / 2 + 12);
    frames.forEach((f, col) => {
      resetScene(4321 + row);
      if (item.demo.pose) item.demo.pose(sceneInfo());
      const focusFn = item.demo.focus || ((s) => {
        if (item.family === "hits") return s.hit;
        if (item.family === "dust") return { x: s.p1.x, y: s.ground - 60 };
        if (item.family === "motion") return { x: s.p1.x - 20, y: s.ground - 130 };
        if (item.family === "labs" || item.family === "lab-templates") return { x: 760, y: s.ground - 160 };
        return s.mid;
      });
      runDemo(item, state.vfx, false);
      for (let i = 0; i < f; i += 1) simStep(STEP);
      render(sc);
      const focus = o.full || item.demo.full ? "full" : focusFn(sceneInfo());
      oc.drawImage(cropFrom(scratch, focus, cw, chh), labelW + col * (cw + 4), y);
    });
  });
  resetScene();
  return out.toDataURL("image/png");
}

// Steps a scripted timeline and returns PNG frames for GIF assembly.
function record(script, o = {}) {
  resetScene(o.seed || 99);
  if (o.setup) o.setup();
  const frames = [];
  const total = o.frames || 120;
  const every = o.every || 2;
  const scale = o.scale || 0.5;
  const out = document.createElement("canvas");
  out.width = Math.round(W * scale);
  out.height = Math.round(H * scale);
  const oc = out.getContext("2d");
  oc.imageSmoothingEnabled = false;
  const scratch = document.createElement("canvas");
  scratch.width = W;
  scratch.height = H;
  const sc = scratch.getContext("2d");
  for (let i = 0; i < total; i += 1) {
    for (const ev of script) {
      if (ev.at === i) {
        const item = effectCatalog().find((c) => c.type === ev.type);
        if (ev.fn) ev.fn(state.vfx, sceneInfo());
        else if (item) runDemo(item, state.vfx, true);
      }
    }
    simStep(STEP);
    if (i % every === 0) {
      render(sc);
      oc.drawImage(scratch, 0, 0, out.width, out.height);
      frames.push(out.toDataURL("image/png"));
    }
  }
  resetScene();
  return frames;
}

// Named timelines for GIF captures. Frame numbers are 60 Hz sim steps.
const SCRIPTS = {
  footfall: () => record([], { frames: 300, every: 2, setup: () => startFootfallDemo(true) }),
  showcase: () => {
    const items = effectCatalog();
    const script = [];
    let at = 4;
    for (const item of items) {
      script.push({ at, type: item.type });
      at += Math.round((item.demo.hold ?? HOLDS[item.type] ?? 0.9) * 60);
    }
    return record(script, { frames: at + 20, every: 3 });
  },
};

function recordScript(name, family) {
  if (SCRIPTS[name]) return SCRIPTS[name]();
  const items = effectCatalog().filter((i) => i.family === name || i.family === family);
  const script = [];
  let at = 4;
  for (const item of items) {
    script.push({ at, type: item.type });
    at += Math.round((item.demo.hold ?? HOLDS[item.type] ?? 0.9) * 60);
  }
  return record(script, { frames: at + 20, every: 2 });
}

// Runs the stand-in fighter across the floor so dust lands on contact frames.
function startFootfallDemo(keep = false) {
  if (!keep) resetScene(7);
  const p1 = state.p1;
  let phase = 0;
  let t = 0;
  p1.x = 240;
  state.p2.x = 1180;
  state.footfall = (dt) => {
    t += dt;
    if (phase === 0 && t > 0.3) {
      phase = 1;
      p1.anim = "run";
      p1.frame = 0;
      p1.vx = 360 * p1.facing;
      state.router.onState(p1, "idle", "run");
    }
    if (phase === 1 && ((p1.facing > 0 && p1.x > 1040) || (p1.facing < 0 && p1.x < 240))) {
      phase = 2;
      t = 0;
      state.router.onState(p1, "run", "skid");
      p1.anim = "idle";
      p1.vx = 0;
    }
    if (phase === 2 && t > 0.45) {
      p1.facing *= -1;
      phase = 0;
      t = 0;
    }
  };
  statusEl.textContent = "Footfall demo: dust spawns from atlas frame events on contact frames.";
}

function buildUi() {
  const root = document.getElementById("families");
  const groups = {};
  for (const item of effectCatalog()) (groups[item.family] ||= []).push(item);
  for (const [family, items] of Object.entries(groups)) {
    const h = document.createElement("h2");
    h.textContent = FAMILY_TITLES[family] || family;
    root.appendChild(h);
    const grid = document.createElement("div");
    grid.className = "grid";
    for (const item of items) {
      const b = document.createElement("button");
      b.textContent = item.label;
      b.title = item.type;
      b.onclick = () => { state.playAll = false; play(item); };
      grid.appendChild(b);
    }
    if (family === "dust") {
      const b = document.createElement("button");
      b.textContent = "Footfall run demo";
      b.onclick = startFootfallDemo;
      grid.appendChild(b);
    }
    root.appendChild(grid);
  }
  const labSel = document.getElementById("optLab");
  for (const id of LAB_IDS) labSel.add(new Option(id, id));
  const all = document.getElementById("playAll");
  all.onclick = () => {
    state.playAll = !state.playAll;
    all.classList.toggle("on", state.playAll);
    state.queue = [];
    state.queueT = 0;
  };
  document.getElementById("clear").onclick = () => resetScene();
  document.getElementById("optAtlas").onchange = (e) => { state.useAtlas = e.target.checked; resetScene(); };
  document.getElementById("optShake").onchange = () => resetScene();
  addEventListener("keydown", (e) => {
    if (e.code === "Space" && state.last) { e.preventDefault(); play(state.last); }
  });
}

async function boot() {
  const [assets, sam, dario] = await Promise.all([
    loadVfxAssets(new URL("../../assets/vfx/", import.meta.url).pathname).catch(() => null),
    loadImage(new URL("../../assets/frontier-sam-run-atlas.png", import.meta.url).href),
    loadImage(new URL("../../assets/frontier-dario-run-atlas.png", import.meta.url).href),
  ]);
  state.assets = assets;
  state.p1Atlas = legacyAtlas(sam);
  state.p2Atlas = legacyAtlas(dario);
  state.portraits = {
    sam: sam && { image: sam, sx: 40, sy: 7 * CELL + 52, sw: 176, sh: 120 },
    dario: dario && { image: dario, sx: 40, sy: 7 * CELL + 52, sw: 176, sh: 120 },
  };
  resetScene();
  buildUi();
  requestAnimationFrame(frame);
}

window.vfxPreview = { ready: boot(), sheet, record, recordScript, catalog: effectCatalog, labs: LAB_IDS, state };
