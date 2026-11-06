/**
 * Loader-side atlas repacking. Fighter atlases ship as 256x256 cells on sheets up to
 * 3072x7680 (about 90 MB decoded each), mostly transparent and with repeated hold frames.
 * This trims every referenced frame to its opaque bounds, drops exact duplicates and
 * shelf-packs the rest into pages at most PAGE_W wide, typically a quarter of the memory.
 *
 * Pure canvas code with no DOM: it runs in a worker (OffscreenCanvas) or on the main thread.
 * The source atlas files are untouched; atlas.json frames keep their original rects (combat
 * reads boxes and events from them) and gain a `draw` placement for the renderer.
 */
export const PAGE_W = 2048;
export const PAGE_MAX_H = 4096;
const PAD = 1;

export function frameKey(f) {
  return `${f.x},${f.y},${f.w},${f.h}`;
}

/** Unique frame rects referenced by the atlas animations. */
export function uniqueRects(json) {
  const seen = new Map();
  for (const anim of Object.values(json.animations || {})) {
    for (const f of anim.frames || []) {
      if (!f || !(f.w > 0) || !(f.h > 0)) continue;
      const key = frameKey(f);
      if (!seen.has(key)) seen.set(key, { key, x: f.x | 0, y: f.y | 0, w: f.w | 0, h: f.h | 0 });
    }
  }
  return [...seen.values()];
}

function scan(u32, stride, r, srcY) {
  let minX = r.w;
  let minY = r.h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < r.h; y += 1) {
    const row = (srcY + y) * stride + r.x;
    let any = false;
    for (let x = 0; x < r.w; x += 1) {
      if (u32[row + x] >>> 24) {
        any = true;
        if (x < minX) minX = x;
        break;
      }
    }
    if (!any) continue;
    for (let x = r.w - 1; x >= 0; x -= 1) {
      if (u32[row + x] >>> 24) {
        if (x > maxX) maxX = x;
        break;
      }
    }
    if (y < minY) minY = y;
    maxY = y;
  }
  if (maxY < 0) return null;
  let h1 = 0x811c9dc5;
  let h2 = 0x2545f491;
  for (let y = minY; y <= maxY; y += 1) {
    const row = (srcY + y) * stride + r.x;
    for (let x = minX; x <= maxX; x += 1) {
      const v = u32[row + x];
      h1 = Math.imul(h1 ^ v, 0x01000193);
      h2 = Math.imul(h2 ^ v, 0x5bd1e995) ^ (h2 >>> 15);
    }
  }
  return { dx: minX, dy: minY, w: maxX - minX + 1, h: maxY - minY + 1, hash: `${h1 >>> 0}:${h2 >>> 0}` };
}

/** Lowest position (then leftmost) where a `w`-wide rect fits on the skyline. */
function skylineFit(sky, w, pageW) {
  let best = null;
  for (let i = 0; i < sky.length; i += 1) {
    const x = sky[i].x;
    if (x + w > pageW) break;
    let y = 0;
    let span = 0;
    for (let j = i; j < sky.length && span < w; j += 1) {
      y = Math.max(y, sky[j].y);
      span += sky[j].w;
    }
    if (span < w) break;
    if (!best || y < best.y) best = { x, y };
  }
  return best;
}

function skylinePlace(sky, x, w, top) {
  const end = x + w;
  const next = [];
  for (const s of sky) {
    const sEnd = s.x + s.w;
    if (sEnd <= x || s.x >= end) {
      next.push(s);
      continue;
    }
    if (s.x < x) next.push({ x: s.x, w: x - s.x, y: s.y });
    if (sEnd > end) next.push({ x: end, w: sEnd - end, y: s.y });
  }
  next.push({ x, w, y: top });
  next.sort((a, b) => a.x - b.x);
  sky.length = 0;
  for (const s of next) {
    const last = sky[sky.length - 1];
    if (last && last.y === s.y && last.x + last.w === s.x) last.w += s.w;
    else sky.push({ ...s });
  }
}

/**
 * @param {CanvasImageSource} source decoded atlas (ImageBitmap or image)
 * @param {object} json atlas.json
 * @param {(w:number, h:number, read?:boolean) => OffscreenCanvas|HTMLCanvasElement} makeCanvas
 * @param {() => Promise<void>} [pause] called between strips so the main thread stays responsive
 * @param {number} [scale] 1, or 0.5 to store frames at half resolution for low render scales
 *   (placements then carry `dw`/`dh`, the size to draw them at)
 * @returns {{ pages, placements: Map<string, object>, stats }}
 */
export async function packAtlas(source, json, makeCanvas, pause = null, scale = 1) {
  const width = source.width;
  const height = source.height;
  const rects = uniqueRects(json).filter((r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= width && r.y + r.h <= height);
  const bands = new Map();
  for (const r of rects) {
    const k = `${r.y}:${r.h}`;
    if (!bands.has(k)) bands.set(k, []);
    bands.get(k).push(r);
  }
  const bandH = Math.max(1, ...rects.map((r) => r.h));
  const strip = makeCanvas(width, bandH, true);
  const sctx = strip.getContext("2d", { willReadFrequently: true });
  const trimmed = new Map();
  for (const group of bands.values()) {
    const { y, h } = group[0];
    sctx.clearRect(0, 0, width, bandH);
    sctx.drawImage(source, 0, y, width, h, 0, 0, width, h);
    const data = sctx.getImageData(0, 0, width, h);
    const u32 = new Uint32Array(data.data.buffer);
    for (const r of group) trimmed.set(r.key, scan(u32, width, r, 0));
    if (pause) await pause();
  }
  strip.width = strip.height = 1;

  const byHash = new Map();
  const unique = [];
  for (const r of rects) {
    const t = trimmed.get(r.key);
    if (!t) continue;
    const dupKey = `${t.hash}:${t.w}x${t.h}`;
    if (byHash.has(dupKey)) {
      t.same = byHash.get(dupKey);
      continue;
    }
    byHash.set(dupKey, t);
    t.sx = r.x + t.dx;
    t.sy = r.y + t.dy;
    t.pw = Math.max(1, Math.ceil(t.w * scale));
    t.ph = Math.max(1, Math.ceil(t.h * scale));
    unique.push(t);
  }

  const area = unique.reduce((n, t) => n + (t.pw + PAD) * (t.ph + PAD), 0);
  const widest = Math.max(64, ...unique.map((t) => t.pw + PAD * 2));
  const pageW = Math.min(PAGE_W, Math.max(widest, 2 ** Math.ceil(Math.log2(Math.sqrt(area)))));
  const order = [...unique].sort((a, b) => b.ph - a.ph || b.pw - a.pw);
  const pageHeights = [];
  let page = 0;
  let sky = [{ x: 0, w: pageW, y: PAD }];
  for (const t of order) {
    let spot = skylineFit(sky, t.pw + PAD, pageW);
    if (!spot || spot.y + t.ph + PAD > PAGE_MAX_H) {
      pageHeights[page] = Math.max(...sky.map((s) => s.y));
      page += 1;
      sky = [{ x: 0, w: pageW, y: PAD }];
      spot = skylineFit(sky, t.pw + PAD, pageW);
    }
    t.page = page;
    t.px = spot.x + PAD;
    t.py = spot.y;
    skylinePlace(sky, spot.x, t.pw + PAD, spot.y + t.ph + PAD);
  }
  pageHeights[page] = Math.max(...sky.map((s) => s.y));

  const pages = pageHeights.map((h) => makeCanvas(pageW, Math.max(1, h), false));
  const ctxs = pages.map((c) => {
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = scale !== 1;
    if (scale !== 1) g.imageSmoothingQuality = "high";
    return g;
  });
  for (const t of order) ctxs[t.page].drawImage(source, t.sx, t.sy, t.w, t.h, t.px, t.py, t.pw, t.ph);

  const placements = new Map();
  for (const r of rects) {
    const t = trimmed.get(r.key);
    if (!t) {
      placements.set(r.key, { empty: true });
      continue;
    }
    const src = t.same || t;
    const place = { page: src.page, x: src.px, y: src.py, w: src.pw, h: src.ph, dx: t.dx, dy: t.dy };
    if (scale !== 1) Object.assign(place, { dw: t.w, dh: t.h });
    placements.set(r.key, place);
  }
  const packedBytes = pages.reduce((n, c) => n + c.width * c.height * 4, 0);
  return {
    pages,
    placements,
    stats: { sourceBytes: width * height * 4, packedBytes, frames: rects.length, unique: unique.length, pages: pages.length },
  };
}

/** Attach placements to every frame object of the atlas json (frames sharing a rect share one). */
export function applyPlacements(json, placements, images) {
  for (const anim of Object.values(json.animations || {})) {
    for (const f of anim.frames || []) {
      const p = f && placements[frameKey(f)];
      if (!p) continue;
      f.draw = p.empty ? { empty: true } : { img: images[p.page], x: p.x, y: p.y, w: p.w, h: p.h, dx: p.dx, dy: p.dy, dw: p.dw ?? p.w, dh: p.dh ?? p.h };
    }
  }
  return json;
}
