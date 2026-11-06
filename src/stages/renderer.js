import { STAGE_GEOMETRY, getStageMeta } from "./stages.js";
import { assetUrl } from "../platform/assets.js";

const { viewW: VIEW_W, viewH: VIEW_H, floorTop: FLOOR_TOP, groundY: GROUND_Y } = STAGE_GEOMETRY;
const BACK_LAYERS = ["far", "mid", "floor", "near"];
const FRONT_LAYERS = ["fg"];
const DEPTH_TINT = { far: 0.26, mid: 0.1 };

let activeStage = null;
let ambientScale = 1;
// Alpha multiplier for additive effects drawn between a baked layer and a later depth tint.
let fade = 1;

/** `{ ambient }` in 0..1 thins rain, motes and fireflies (automatic quality tier). */
export function setStageQuality(q = {}) {
  if (typeof q.ambient === "number") ambientScale = Math.max(0, Math.min(1, q.ambient));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Stage asset failed to load: ${src}`));
    img.src = assetUrl(src);
  });
}

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// 4x4 Bayer matrix, used to dither soft shapes so they stay pixel-art crisp.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function ditheredSprite(w, h, color, alphaAt) {
  const c = makeCanvas(w, h);
  const g = c.getContext("2d");
  const data = g.createImageData(w, h);
  const [r, gr, b] = hexToRgb(color);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const a = alphaAt(x, y);
      const on = a > BAYER[(y & 3) * 4 + (x & 3)];
      const i = (y * w + x) * 4;
      data.data[i] = r;
      data.data[i + 1] = gr;
      data.data[i + 2] = b;
      data.data[i + 3] = on ? 255 : 0;
    }
  }
  g.putImageData(data, 0, 0);
  return c;
}

function puffSprite(color) {
  return ditheredSprite(16, 16, color, (x, y) => {
    const d = Math.hypot(x - 7.5, y - 7.5) / 8;
    return Math.max(0, 1 - d) ** 1.4;
  });
}

function hazeSprite(color, w, h) {
  return ditheredSprite(w, h, color, (x, y) => {
    const v = y / (h - 1);
    const band = Math.sin(v * Math.PI) ** 1.5;
    const noise = 0.55 + 0.25 * Math.sin(x * 0.09 + Math.sin(x * 0.023) * 3) + 0.2 * Math.sin(x * 0.31 + y * 0.7);
    return band * noise * 0.85;
  });
}

function shaftSprite(color, w, h) {
  return ditheredSprite(w, h, color, (x, y) => {
    const v = y / h;
    const center = w * 0.3 + v * w * 0.4;
    const d = Math.abs(x - center) / (w * 0.3);
    return Math.max(0, 1 - d) * (1 - v * 0.7) * 0.9;
  });
}

function prepareAmbient(stage) {
  const prepared = [];
  for (const fx of stage.ambient) {
    const entry = { ...fx };
    if (fx.type === "steam") entry.sprite = puffSprite(fx.color);
    if (fx.type === "beacon") entry.sprite = puffSprite(fx.color);
    if (fx.type === "flashes") entry.sprite = puffSprite("#ffffff");
    if (fx.type === "haze") entry.sprite = hazeSprite(fx.color, 320, Math.round(fx.h / 2));
    if (fx.type === "shafts") entry.sprite = shaftSprite(fx.color, 90, 220);
    prepared.push(entry);
  }
  return prepared;
}

function mixHex(a, b, t) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const m = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, "0");
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}

/**
 * Opaque regions of a mostly transparent layer as [sx, sy, sw, sh] rects in image px, from
 * 32 px column strips merged when their vertical extents match. Drawing only these is the same
 * image as drawing the whole layer, with a fraction of the fill. Null when not worth it.
 */
function opaqueSpans(img, strip = 32) {
  const w = img.width;
  const h = img.height;
  const c = makeCanvas(w, h);
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const px = new Uint32Array(g.getImageData(0, 0, w, h).data.buffer);
  c.width = c.height = 0;
  const strips = [];
  for (let x0 = 0; x0 < w; x0 += strip) {
    const x1 = Math.min(w, x0 + strip);
    let top = -1;
    let bottom = -1;
    for (let y = 0; y < h && top < 0; y += 1) {
      for (let x = x0; x < x1; x += 1) if (px[y * w + x] >>> 24) { top = y; break; }
    }
    if (top >= 0) {
      for (let y = h - 1; y >= top && bottom < 0; y -= 1) {
        for (let x = x0; x < x1; x += 1) if (px[y * w + x] >>> 24) { bottom = y; break; }
      }
    }
    strips.push(top < 0 ? null : [x0, top, x1 - x0, bottom - top + 1]);
  }
  const spans = [];
  for (const st of strips) {
    const last = spans[spans.length - 1];
    if (st && last && last[0] + last[2] === st[0] && Math.abs(last[1] - st[1]) <= 12 && Math.abs(last[1] + last[3] - st[1] - st[3]) <= 12) {
      const top = Math.min(last[1], st[1]);
      const bottom = Math.max(last[1] + last[3], st[1] + st[3]);
      last[1] = top;
      last[2] += st[2];
      last[3] = bottom - top;
    } else if (st) spans.push(st);
  }
  const area = spans.reduce((n, r) => n + r[2] * r[3], 0);
  return area > w * h * 0.8 ? null : spans;
}

/** Copy of a layer with its depth tint applied (alpha preserved). */
function bakeTint(img, color, amount) {
  const c = makeCanvas(img.width, img.height);
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.globalAlpha = amount;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

/**
 * Pre-render work done once per stage load: bake the depth tints into the far and mid images
 * (instead of two large alpha fills every frame) and find the opaque spans of sparse layers.
 * `after[name]` is how much a later tint would have dimmed effects drawn after `name`; additive
 * effects scale their alpha by it and source-over ones pre-tint their colour, which reproduces
 * the per-frame result.
 */
function prepareLayers(stage) {
  const shadow = stage.meta.palette.shadow;
  const after = {};
  let keep = 1;
  for (const name of [...BACK_LAYERS].reverse()) {
    after[name] = keep;
    keep *= 1 - (DEPTH_TINT[name] ?? 0);
  }
  stage.after = after;
  stage.spans = {};
  for (const name of BACK_LAYERS) {
    const img = stage.images[name];
    if (!img || name === "floor") continue;
    if (DEPTH_TINT[name]) {
      const cumulative = 1 - (1 - DEPTH_TINT[name]) * after[name];
      stage.images[name] = bakeTint(img, shadow, cumulative);
    }
  }
  for (const name of [...BACK_LAYERS, ...FRONT_LAYERS]) {
    const img = stage.images[name];
    if (img && name !== "floor") stage.spans[name] = opaqueSpans(img);
  }
  stage.baked = true;
}

/**
 * Load a stage's layer art and make it the active stage for drawStage.
 * Resolves to a stage handle that can also be passed to drawStage explicitly.
 */
export async function loadStage(id) {
  const meta = getStageMeta(id);
  const entries = [];
  for (const [name, layer] of Object.entries(meta.layers)) {
    entries.push(loadImage(layer.src).then((img) => [name, img]));
    if (layer.glow) entries.push(loadImage(layer.glow.src).then((img) => [`${name}-glow`, img]));
  }
  const images = Object.fromEntries(await Promise.all(entries));
  const stage = { id, meta, images, ambient: prepareAmbient(meta) };
  try {
    prepareLayers(stage);
  } catch (error) {
    console.warn("[stages] layer pre-render skipped", error);
  }
  activeStage = stage;
  return stage;
}

/** Drop the active stage's images so their decoded pixels can be freed between matches. */
export function releaseStage() {
  const stage = activeStage;
  activeStage = null;
  if (!stage) return;
  for (const img of Object.values(stage.images)) {
    if (typeof img.close === "function") img.close();
    else if (img instanceof HTMLImageElement) img.src = "";
  }
  stage.images = {};
}

export function getActiveStage() {
  return activeStage;
}

export function setActiveStage(stage) {
  activeStage = stage;
}

/** Clamp a camera x (logical left edge of the view) to the stage's scroll range. */
export function clampCameraX(x, stage = activeStage) {
  const { minX, maxX } = (stage?.meta ?? stage).camera;
  return Math.min(maxX, Math.max(minX, x));
}

function cameraState(camera, stage) {
  const time = camera?.time ?? performance.now() / 1000;
  return {
    x: clampCameraX(camera?.x ?? stage.meta.camera.startX, stage),
    y: camera?.y ?? 0,
    zoom: camera?.zoom ?? 1,
    time,
  };
}

function layerOrigin(stage, name, cam) {
  const layer = stage.meta.layers[name];
  const px = stage.meta.px;
  return {
    x: -Math.round(cam.x * layer.parallax),
    y: -Math.round(cam.y * layer.parallax),
    px,
    layer,
  };
}

function drawGlow(ctx, stage, name, origin, fx, t) {
  const img = stage.images[`${name}-glow`];
  const glow = origin.layer.glow;
  if (!img || !glow) return;
  const { px } = origin;
  const size = glow.tile;
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  for (const [tx, ty] of glow.tiles) {
    const sx = origin.x + tx * px;
    if (sx > VIEW_W || sx + size * px < 0) continue;
    const seed = tx * 0.137 + ty * 0.731 + name.length;
    const phase = hash(seed) * Math.PI * 2;
    let a = 0.5 + 0.5 * Math.sin(t * fx.speed * (0.6 + hash(seed + 3) * 0.8) + phase);
    if (fx.blink) a = a > 0.5 ? 1 : 0.25;
    if (fx.flicker && hash(Math.floor(t * 12) + seed * 17) < fx.flicker) a = 0;
    ctx.globalAlpha = Math.min(1, 0.12 + fx.amp * a) * fade;
    ctx.drawImage(img, tx, ty, size, size, sx, origin.y + ty * px, size * px, size * px);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prevOp;
}

function drawCrowdLayer(ctx, img, origin, fx, t) {
  const { px } = origin;
  const slice = fx.slice ?? 10;
  for (let sx = 0; sx < img.width; sx += slice) {
    const dx = origin.x + sx * px;
    if (dx > VIEW_W || dx + slice * px < 0) continue;
    const k = sx / slice;
    const wave = Math.sin(t * (fx.rate ?? 2) * (0.7 + hash(k) * 0.6) + hash(k + 9) * 6.28);
    const bob = wave > 0.55 ? -1 : 0;
    const w = Math.min(slice, img.width - sx);
    ctx.drawImage(img, sx, 0, w, img.height, dx, origin.y + bob * px, w * px, img.height * px);
  }
}

function drawFloor(ctx, stage, cam) {
  const img = stage.images.floor;
  const layer = stage.meta.layers.floor;
  const px = stage.meta.px;
  const [f0, f1] = layer.parallax;
  const tileW = img.width * px;
  const decal = stage.images.floorDecal;
  const decalMeta = stage.meta.layers.floorDecal;
  for (let r = 0; r < img.height; r += 1) {
    const y = FLOOR_TOP + r * px - Math.round(cam.y);
    const f = f0 + ((f1 - f0) * (FLOOR_TOP + r * px - FLOOR_TOP)) / (GROUND_Y - FLOOR_TOP);
    const off = Math.round(cam.x * f);
    let x = -(((off % tileW) + tileW) % tileW);
    for (; x < VIEW_W; x += tileW) ctx.drawImage(img, 0, r, img.width, 1, x, y, tileW, px);
    // Floor lettering shares the row's parallax so it stays glued to the pavement.
    if (decal && r < decal.height) {
      ctx.drawImage(decal, 0, r, decal.width, 1, decalMeta.x - off, y, decal.width * px, px);
    }
  }
}

function wrap(v, span) {
  return ((v % span) + span) % span;
}

function drawParticles(ctx, fx, cam, t, stage) {
  const span = VIEW_W + 40;
  const { y0, y1 } = fx.region;
  ctx.fillStyle = fx.color;
  const count = Math.ceil(fx.count * ambientScale);
  for (let i = 0; i < count; i += 1) {
    const h1 = hash(i + 1), h2 = hash(i + 51), h3 = hash(i + 97);
    let x = h1 * span * 2;
    let y;
    if (fx.drift === "rise") {
      y = y1 - wrap(t * (14 + h2 * 22) + h3 * (y1 - y0), y1 - y0);
      x += Math.sin(t * 0.8 + i) * 10;
    } else if (fx.drift === "fall") {
      y = y0 + wrap(t * (10 + h2 * 14) + h3 * (y1 - y0), y1 - y0);
      x += Math.sin(t * 0.6 + i * 1.7) * 24 + t * 6;
    } else {
      y = y0 + h3 * (y1 - y0) + Math.sin(t * (0.3 + h2 * 0.4) + i) * 18;
      x += Math.sin(t * (0.2 + h3 * 0.3) + i * 2.1) * 26;
    }
    const sx = wrap(x - cam.x * fx.parallax, span) - 20;
    const tw = 0.5 + 0.5 * Math.sin(t * (1.2 + h2 * 2) + i * 3.3);
    ctx.globalAlpha = 0.25 + 0.55 * tw;
    const size = h2 > 0.8 ? 4 : 2;
    ctx.fillRect(Math.round(sx / 2) * 2, Math.round((y - cam.y * fx.parallax) / 2) * 2, size, size);
  }
  ctx.globalAlpha = 1;
}

function drawFireflies(ctx, fx, cam, t) {
  const span = VIEW_W + 40;
  const { y0, y1 } = fx.region;
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = fx.color;
  const count = Math.ceil(fx.count * ambientScale);
  for (let i = 0; i < count; i += 1) {
    const h1 = hash(i + 7), h2 = hash(i + 31), h3 = hash(i + 63);
    const x = h1 * span * 2 + Math.sin(t * (0.35 + h2 * 0.3) + i) * 40 + Math.sin(t * 1.3 + i * 5) * 6;
    const y = y0 + h3 * (y1 - y0) + Math.cos(t * (0.3 + h3 * 0.3) + i * 2) * 26;
    const sx = Math.round((wrap(x - cam.x * fx.parallax, span) - 20) / 2) * 2;
    const sy = Math.round(y / 2) * 2;
    const pulse = Math.max(0, Math.sin(t * (1 + h2 * 1.5) + i * 4.1));
    if (pulse < 0.05) continue;
    ctx.globalAlpha = 0.25 * pulse;
    ctx.fillRect(sx - 4, sy - 2, 10, 6);
    ctx.fillRect(sx - 2, sy - 4, 6, 10);
    ctx.globalAlpha = 0.9 * pulse;
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prevOp;
}

function drawRain(ctx, fx, cam, t, stage) {
  const span = VIEW_W + 40;
  const { y0, y1 } = fx.region;
  let clipX0 = -Infinity, clipX1 = Infinity;
  if (fx.layerClip) {
    const origin = layerOrigin(stage, fx.layerClip.layer, cam);
    clipX0 = origin.x + fx.layerClip.x0 * origin.px;
    clipX1 = origin.x + fx.layerClip.x1 * origin.px;
  }
  if (fade < 1 && fx.fadedFor !== fade) {
    fx.faded = mixHex(fx.color, stage.meta.palette.shadow, 1 - fade);
    fx.fadedFor = fade;
  }
  ctx.fillStyle = fade < 1 ? fx.faded : fx.color;
  const count = Math.ceil(fx.count * ambientScale);
  for (let i = 0; i < count; i += 1) {
    const h1 = hash(i + 3), h2 = hash(i + 41), h3 = hash(i + 77);
    const speed = 380 + h2 * 260;
    const len = 10 + Math.round(h3 * 4) * 4;
    const y = y0 + wrap(t * speed + h3 * (y1 - y0), y1 - y0 + len) - len;
    const sx = Math.round((wrap(h1 * span * 3 - cam.x * fx.parallax, span) - 20) / 2) * 2;
    if (sx < clipX0 || sx > clipX1) continue;
    ctx.globalAlpha = fx.alpha * (0.6 + h2 * 0.6);
    ctx.fillRect(sx, Math.round(Math.max(y0, y) / 2) * 2, 2, Math.min(len, y1 - Math.max(y0, y)));
  }
  ctx.globalAlpha = 1;
}

function drawSteam(ctx, fx, cam, t) {
  const puffs = 9;
  for (const [e, em] of fx.emitters.entries()) {
    const ex = em.x - cam.x;
    if (ex < -200 || ex > VIEW_W + 200) continue;
    for (let k = 0; k < puffs; k += 1) {
      const seed = e * 13 + k;
      const age = wrap(t + (k / puffs) * fx.period + hash(seed) * 0.4, fx.period);
      const p = age / fx.period;
      const size = Math.round((14 + p * 52) / 2) * 2;
      const x = ex + Math.sin(seed * 2.1 + t * 0.7) * 10 + p * 30 * (hash(seed + 5) - 0.3) - size / 2;
      const y = em.y - cam.y - p * fx.rise - size / 2;
      ctx.globalAlpha = fx.alpha * Math.min(1, p * 5) * (1 - p);
      ctx.drawImage(fx.sprite, Math.round(x / 2) * 2, Math.round(y / 2) * 2, size, size);
    }
  }
  ctx.globalAlpha = 1;
}

function drawHaze(ctx, fx, cam, t) {
  const img = fx.sprite;
  const w = img.width * 2;
  const off = Math.round(cam.x * fx.parallax + t * fx.speed);
  ctx.globalAlpha = fx.alpha * (0.85 + 0.15 * Math.sin(t * 0.4));
  for (let x = -wrap(off, w); x < VIEW_W; x += w) {
    ctx.drawImage(img, x, Math.round(fx.y - cam.y * fx.parallax), w, img.height * 2);
  }
  const off2 = Math.round(cam.x * fx.parallax * 1.3 - t * fx.speed * 0.6);
  ctx.globalAlpha = fx.alpha * 0.5;
  for (let x = -wrap(off2, w); x < VIEW_W; x += w) {
    ctx.drawImage(img, x, Math.round(fx.y + fx.h * 0.25 - cam.y * fx.parallax), w, img.height * 2);
  }
  ctx.globalAlpha = 1;
}

function drawShafts(ctx, fx, stage, cam, t) {
  const origin = layerOrigin(stage, fx.layer, cam);
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  for (const [i, lx] of fx.xs.entries()) {
    ctx.globalAlpha = fx.alpha * (0.7 + 0.3 * Math.sin(t * 0.35 + i * 1.9)) * fade;
    ctx.drawImage(fx.sprite, origin.x + lx * origin.px, origin.y + fx.top * origin.px, fx.sprite.width * 2, fx.sprite.height * 2);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prevOp;
}

function drawBeacons(ctx, fx, stage, cam, t) {
  const origin = layerOrigin(stage, fx.layer, cam);
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  for (const [i, [bx, by]] of fx.points.entries()) {
    const a = Math.max(0, Math.sin(t * fx.rate * Math.PI + i * 2.1)) ** 6;
    if (a < 0.02) continue;
    const x = origin.x + bx * origin.px;
    const y = origin.y + by * origin.px;
    ctx.globalAlpha = 0.55 * a * fade;
    ctx.drawImage(fx.sprite, x - 24, y - 24, 48, 48);
    ctx.globalAlpha = a * fade;
    ctx.fillStyle = fx.color;
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prevOp;
}

function drawScan(ctx, fx, stage, cam, t) {
  const origin = layerOrigin(stage, fx.layer, cam);
  const [rx, ry, rw, rh] = fx.rect;
  const p = wrap(t / fx.period, 1);
  const x = origin.x + rx * origin.px;
  const y = origin.y + Math.round(ry + p * rh) * origin.px;
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = fx.color;
  ctx.globalAlpha = 0.35 * fade;
  ctx.fillRect(x, y, rw * origin.px, 2);
  ctx.globalAlpha = 0.12 * fade;
  ctx.fillRect(x, y - 6, rw * origin.px, 6);
  ctx.globalAlpha = 0.05 * fade;
  ctx.fillRect(x, y - 16, rw * origin.px, 10);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prevOp;
}

function drawFlashes(ctx, fx, stage, cam, t) {
  const origin = layerOrigin(stage, fx.layer, cam);
  const layerW = origin.layer.w;
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";
  const slotLen = 1 / fx.rate;
  const slot = Math.floor(t / slotLen);
  for (let s = slot - 1; s <= slot; s += 1) {
    const start = s * slotLen + hash(s * 3.7) * slotLen * 0.8;
    const age = t - start;
    if (age < 0 || age > 0.14) continue;
    const a = 1 - age / 0.14;
    const lx = hash(s * 9.1) * layerW;
    const ly = fx.yMin + hash(s * 5.3) * (fx.yMax - fx.yMin);
    const x = origin.x + Math.round(lx) * origin.px;
    const y = origin.y + Math.round(ly) * origin.px;
    ctx.globalAlpha = 0.6 * a * fade;
    ctx.drawImage(fx.sprite, x - 40, y - 40, 80, 80);
    ctx.globalAlpha = a * fade;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 10, y - 2, 20, 4);
    ctx.fillRect(x - 2, y - 10, 4, 20);
    ctx.fillRect(x - 4, y - 4, 8, 8);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = prevOp;
}

function ambientFor(stage, slot) {
  return stage.ambient.filter((fx) => (fx.slot ?? defaultSlot(fx)) === slot);
}

function defaultSlot(fx) {
  switch (fx.type) {
    case "glow":
    case "crowd":
    case "flashes":
      return `layer:${fx.layer}`;
    case "rain":
    case "shafts":
    case "beacon":
    case "scan":
      return "after:far";
    case "haze":
      return "after:mid";
    case "steam":
    case "motes":
    case "fireflies":
      return "after:near";
    default:
      return "after:near";
  }
}

function drawAmbient(ctx, stage, slot, cam) {
  const t = cam.time;
  fade = stage.baked && slot.startsWith("after:") ? stage.after[slot.slice(6)] ?? 1 : 1;
  for (const fx of ambientFor(stage, slot)) {
    switch (fx.type) {
      case "rain": drawRain(ctx, fx, cam, t, stage); break;
      case "shafts": drawShafts(ctx, fx, stage, cam, t); break;
      case "beacon": drawBeacons(ctx, fx, stage, cam, t); break;
      case "scan": drawScan(ctx, fx, stage, cam, t); break;
      case "haze": drawHaze(ctx, fx, cam, t); break;
      case "steam": drawSteam(ctx, fx, cam, t); break;
      case "motes": drawParticles(ctx, fx, cam, t, stage); break;
      case "fireflies": drawFireflies(ctx, fx, cam, t); break;
      default: break;
    }
  }
  fade = 1;
}

function drawImageLayer(ctx, stage, name, cam, options) {
  const img = stage.images[name];
  if (!img) return;
  const origin = layerOrigin(stage, name, cam);
  const layerFx = stage.ambient.filter((fx) => defaultSlot(fx) === `layer:${name}`);
  const crowd = options.ambient && layerFx.find((fx) => fx.type === "crowd");
  const spans = stage.spans?.[name];
  if (crowd) drawCrowdLayer(ctx, img, origin, crowd, cam.time);
  else if (spans) {
    const { px } = origin;
    for (const [sx, sy, sw, sh] of spans) {
      const dx = origin.x + sx * px;
      if (dx > VIEW_W || dx + sw * px < 0) continue;
      ctx.drawImage(img, sx, sy, sw, sh, dx, origin.y + sy * px, sw * px, sh * px);
    }
  } else ctx.drawImage(img, origin.x, origin.y, img.width * origin.px, img.height * origin.px);
  const tint = stage.baked ? 0 : DEPTH_TINT[name];
  if (tint) {
    // Atmospheric depth: sink distant layers toward the stage's shadow colour so
    // nearer props separate; glow is drawn afterwards so lights still punch through.
    ctx.globalAlpha = tint;
    ctx.fillStyle = stage.meta.palette.shadow;
    ctx.fillRect(0, 0, VIEW_W, FLOOR_TOP + 8);
    ctx.globalAlpha = 1;
  }
  if (!options.ambient) return;
  fade = stage.baked ? stage.after?.[name] ?? 1 : 1;
  for (const fx of layerFx) {
    if (fx.type === "glow") drawGlow(ctx, stage, name, origin, fx, cam.time);
    if (fx.type === "flashes") drawFlashes(ctx, fx, stage, cam, cam.time);
  }
  fade = 1;
}

/**
 * Draw the active stage in screen space (an untransformed 1280x720 logical canvas).
 *
 * camera: { x, y = 0, zoom = 1, time } where x is the world-space left edge of the
 * view in logical px (clamped to stage.camera.minX..maxX), y shifts the view
 * vertically, zoom scales about (640, groundY), and time is seconds (defaults to
 * performance.now()). layer: "back" (everything behind fighters) or "front".
 * options.layers / options.ambient let tools draw a subset.
 */
export function drawStage(ctx, camera, layer = "back", options = {}) {
  const stage = options.stage ?? activeStage;
  if (!stage) return;
  const cam = cameraState(camera, stage);
  const only = options.layers ? new Set(options.layers) : null;
  const opts = { ambient: options.ambient !== false };
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (cam.zoom !== 1) {
    ctx.translate(VIEW_W / 2, GROUND_Y);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-VIEW_W / 2, -GROUND_Y);
  }
  if (layer === "back") {
    ctx.fillStyle = stage.meta.palette.shadow;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    for (const name of BACK_LAYERS) {
      if (only && !only.has(name)) continue;
      if (name === "floor") drawFloor(ctx, stage, cam);
      else drawImageLayer(ctx, stage, name, cam, opts);
      if (opts.ambient) drawAmbient(ctx, stage, `after:${name}`, cam);
    }
  } else if (layer === "front") {
    if (opts.ambient) drawAmbient(ctx, stage, "front", cam);
    for (const name of FRONT_LAYERS) {
      if (only && !only.has(name)) continue;
      drawImageLayer(ctx, stage, name, cam, opts);
    }
  }
  ctx.restore();
}
