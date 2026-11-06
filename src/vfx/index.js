// Frontier Showdown combat VFX.
//
//   import { createVfx, loadVfxAssets } from "./src/vfx/index.js";
//   const vfx = createVfx(ctx, await loadVfxAssets());
//   vfx.spawn("hit_heavy", x, y, { dir: 1 });
//   vfx.update(dt);                       // seconds, real time
//   vfx.draw(ctx, camera, "back");        // optional, behind fighters
//   vfx.draw(ctx, camera);                // "front", after fighters
//
// Camera: `{ x, y, zoom }` where x/y is the world point at the top-left of the
// 1280x720 view. `{ centerX, centerY, zoom }` is also accepted.

import { createPainter } from "./painter.js";
import { mulberry32, clamp } from "./util.js";
import { impactEffects } from "./effects/impacts.js";
import { dustEffects } from "./effects/dust.js";
import { motionEffects } from "./effects/motion.js";
import { cinematicEffects } from "./effects/cinematic.js";
import { labEffects, LABS, LAB_IDS } from "./effects/labs.js";

export { LABS, LAB_IDS };
export { createFrameEventRouter, inferFootfallEvents, DUST_EVENT_TYPES } from "./frame-events.js";
export { bindVfxToGame } from "./game-bridge.js";

const REGISTRY = new Map();

export function registerEffect(type, def) {
  REGISTRY.set(type, def);
}

for (const family of [impactEffects, dustEffects, motionEffects, cinematicEffects, labEffects]) {
  for (const [type, def] of Object.entries(family)) registerEffect(type, def);
}

export function effectTypes() {
  return [...REGISTRY.keys()];
}

// Ordered catalog used by the preview page and docs.
export function effectCatalog() {
  return [...REGISTRY.entries()]
    .filter(([, def]) => def.family)
    .map(([type, def]) => ({ type, family: def.family, label: def.label || type, demo: def.demo || {} }));
}

export async function loadVfxAssets(base = "/assets/vfx/") {
  const root = base.endsWith("/") ? base : `${base}/`;
  const meta = await fetch(`${root}vfx-atlas.json`).then((r) => {
    if (!r.ok) throw new Error(`vfx atlas: ${r.status}`);
    return r.json();
  });
  const image = new Image();
  image.src = `${root}${meta.image}`;
  await image.decode();
  return { atlas: { image, frames: meta.frames } };
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function normalizeAtlas(assets) {
  if (!assets) return null;
  if (assets.atlas && assets.atlas.frames) return assets.atlas;
  if (assets.vfx && assets.vfx.atlas) return assets.vfx.atlas;
  if (assets.frames && assets.image) return assets;
  return null;
}

export function createVfx(ctx, assets, options = {}) {
  const viewW = options.width || 1280;
  const viewH = options.height || 720;
  const pixelScale = options.pixelScale || 2;
  const maxEffects = options.maxEffects || 256;
  const atlas = normalizeAtlas(assets);
  const painter = createPainter(atlas);
  const rand = mulberry32(options.seed ?? 0x5eed);

  const bw = Math.ceil(viewW / pixelScale) + 2;
  const bh = Math.ceil(viewH / pixelScale) + 2;
  const addBuf = makeCanvas(bw, bh);
  const normBuf = makeCanvas(bw, bh);
  const addCtx = addBuf.getContext("2d");
  const normCtx = normBuf.getContext("2d");
  addCtx.globalCompositeOperation = "lighter";

  const effects = [];
  let nextId = 1;
  let hitstopFrames = 0;
  let shakeAmp = 0;
  let shakeFrames = 0;
  let shakeTotal = 1;
  let shakeTick = 0;
  let slowScale = 1;
  let slowLeft = 0;
  let slowTotal = 0;
  let backDrawn = false;
  let clock = 0;

  const vfx = {
    ctx,
    viewW,
    viewH,
    pixelScale,
    atlas,
    painter,
    rand,
    effects,

    spawn(type, x = 0, y = 0, opts = {}) {
      const def = REGISTRY.get(type);
      if (!def) {
        if (options.strict) throw new Error(`Unknown VFX type: ${type}`);
        return null;
      }
      if (effects.length >= maxEffects) {
        const victim = effects.findIndex((e) => !e.def.persistent);
        if (victim >= 0) effects.splice(victim, 1);
      }
      const fx = {
        id: nextId++,
        type,
        def,
        x,
        y,
        opts,
        t: -(opts.delay || 0),
        life: opts.life ?? def.life ?? 0.5,
        dir: opts.dir === undefined ? 1 : opts.dir < 0 ? -1 : 1,
        alive: true,
        layer: opts.layer || def.layer || "front",
        rand: mulberry32(Math.floor(rand() * 2 ** 32)),
        parts: [],
        kill() { fx.alive = false; },
      };
      if (def.init) def.init(fx, vfx);
      effects.push(fx);
      return fx;
    },

    update(dt) {
      if (!(dt > 0)) return;
      clock += dt;
      hitstopFrames = Math.max(0, hitstopFrames - dt * 60);
      if (shakeFrames > 0) shakeFrames = Math.max(0, shakeFrames - dt * 60);
      shakeTick += 1;
      if (slowLeft > 0) slowLeft = Math.max(0, slowLeft - dt);
      const frozen = vfx.isFrozen();
      const scale = vfx.timeScale();
      for (let i = effects.length - 1; i >= 0; i -= 1) {
        const fx = effects[i];
        const def = fx.def;
        const step = def.realtime ? dt : frozen && !def.ignoreFreeze ? 0 : dt * scale;
        if (step > 0) {
          fx.t += step;
          if (def.update && fx.t >= 0) def.update(fx, step, vfx);
        }
        if (!fx.alive || (!def.persistent && fx.t >= fx.life)) {
          if (def.end) def.end(fx, vfx);
          fx.alive = false;
          effects.splice(i, 1);
        }
      }
    },

    draw(drawCtx = ctx, camera = {}, layer = "front") {
      const cam = normalizeCamera(camera, viewW, viewH);
      if (layer === "back") {
        backDrawn = true;
        screenPass(drawCtx, "back");
        worldPass(drawCtx, cam, "back");
        return;
      }
      if (!backDrawn) screenPass(drawCtx, "back");
      worldPass(drawCtx, cam, "front");
      screenPass(drawCtx, "front");
      backDrawn = false;
    },

    // Timing helpers. The engine reads these each sim step; VFX never pauses
    // the simulation on its own.
    hitstop(frames) {
      hitstopFrames = Math.max(hitstopFrames, frames);
    },
    isHitstopped() {
      return hitstopFrames > 0;
    },
    hitstopRemaining() {
      return Math.ceil(hitstopFrames);
    },
    shake(amp, frames = 8) {
      if (options.shake === false) return;
      if (amp * (frames / shakeTotal) >= shakeAmp * (shakeFrames / shakeTotal)) {
        shakeAmp = amp;
        shakeFrames = frames;
        shakeTotal = Math.max(1, frames);
      }
    },
    getShakeOffset() {
      if (shakeFrames <= 0) return { x: 0, y: 0 };
      const k = shakeAmp * (shakeFrames / shakeTotal);
      const a = Math.sin(shakeTick * 2.7) * 0.6 + Math.sin(shakeTick * 5.3) * 0.4;
      const b = Math.cos(shakeTick * 3.1) * 0.6 + Math.sin(shakeTick * 4.1) * 0.4;
      return { x: Math.round(a * k), y: Math.round(b * k * 0.7) };
    },
    applyShake(camera = {}) {
      const o = vfx.getShakeOffset();
      const cam = normalizeCamera(camera, viewW, viewH);
      return { ...cam, x: cam.x - o.x / cam.zoom, y: cam.y - o.y / cam.zoom };
    },
    slowmo(scale, seconds) {
      slowScale = clamp(scale, 0.05, 1);
      slowLeft = seconds;
      slowTotal = seconds;
    },
    // Game-time multiplier (KO slow motion). Eases back to 1 over the last 30%.
    timeScale() {
      if (slowLeft <= 0) return 1;
      const tail = slowTotal * 0.3;
      if (slowLeft > tail) return slowScale;
      return slowScale + (1 - slowScale) * (1 - slowLeft / tail);
    },
    // True while a super freeze is running; fighters should not advance.
    isFrozen() {
      return effects.some((e) => e.def.freezes && e.alive && e.t < (e.freezeFor ?? e.life));
    },
    flash(color = "#fff", frames = 4, alpha = 0.8) {
      return vfx.spawn("screen_flash", 0, 0, { color, frames, alpha });
    },
    clear() {
      effects.length = 0;
      hitstopFrames = 0;
      shakeFrames = 0;
      slowLeft = 0;
    },
    get count() {
      return effects.length;
    },
    get clock() {
      return clock;
    },
  };

  function worldPass(drawCtx, cam, layer) {
    // Full-resolution passes (afterimages of fighter sprites) go under the
    // pixel buffers so sparks stay on top.
    for (const fx of effects) {
      if (fx.layer !== layer || !fx.def.direct || fx.t < 0) continue;
      drawCtx.save();
      drawCtx.imageSmoothingEnabled = false;
      fx.def.direct(fx, drawCtx, cam, vfx);
      drawCtx.restore();
    }
    let any = false;
    for (const fx of effects) if (fx.layer === layer && fx.def.draw) { any = true; break; }
    if (!any) return;
    addCtx.globalCompositeOperation = "source-over";
    addCtx.globalAlpha = 1;
    addCtx.clearRect(0, 0, bw, bh);
    addCtx.globalCompositeOperation = "lighter";
    normCtx.globalAlpha = 1;
    normCtx.clearRect(0, 0, bw, bh);
    // Snap the camera to the art-pixel grid so effects do not shimmer.
    const snap = pixelScale / cam.zoom;
    const camSnapped = { x: Math.floor(cam.x / snap) * snap, y: Math.floor(cam.y / snap) * snap, zoom: cam.zoom };
    const fracX = ((cam.x - camSnapped.x) * cam.zoom);
    const fracY = ((cam.y - camSnapped.y) * cam.zoom);
    painter.begin(addCtx, normCtx, camSnapped, pixelScale);
    for (const fx of effects) {
      if (fx.layer !== layer || !fx.def.draw || fx.t < 0) continue;
      fx.def.draw(fx, painter, vfx);
    }
    drawCtx.save();
    drawCtx.imageSmoothingEnabled = false;
    drawCtx.globalAlpha = 1;
    drawCtx.globalCompositeOperation = "source-over";
    drawCtx.drawImage(normBuf, -fracX, -fracY, bw * pixelScale, bh * pixelScale);
    drawCtx.globalCompositeOperation = "lighter";
    drawCtx.drawImage(addBuf, -fracX, -fracY, bw * pixelScale, bh * pixelScale);
    drawCtx.restore();
  }

  function screenPass(drawCtx, layer) {
    for (const fx of effects) {
      if (!fx.def.screen || fx.t < 0) continue;
      drawCtx.save();
      drawCtx.imageSmoothingEnabled = false;
      fx.def.screen(fx, drawCtx, vfx, layer, normalizeCamera({}, viewW, viewH));
      drawCtx.restore();
    }
  }

  return vfx;
}

export function normalizeCamera(camera = {}, viewW = 1280, viewH = 720) {
  const zoom = camera.zoom || 1;
  if (camera.centerX !== undefined || camera.centerY !== undefined) {
    return {
      x: (camera.centerX ?? viewW / 2) - viewW / 2 / zoom,
      y: (camera.centerY ?? viewH / 2) - viewH / 2 / zoom,
      zoom,
    };
  }
  return { x: camera.x || 0, y: camera.y || 0, zoom };
}

export function worldToScreen(camera, wx, wy, viewW = 1280, viewH = 720) {
  const cam = normalizeCamera(camera, viewW, viewH);
  return { x: (wx - cam.x) * cam.zoom, y: (wy - cam.y) * cam.zoom };
}
