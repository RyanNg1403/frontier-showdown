/**
 * Reference-counted fighter atlases. `acquireAtlas(id)` loads an atlas the first time and
 * shares it after that; `releaseAtlas(id)` drops a reference and closes its ImageBitmaps once
 * nobody holds it, so the decoded pixels are freed between matches instead of waiting for GC.
 *
 * Sprite-pipeline atlases (`images: { webp, png }`, `size.decodedBytes`) are already trimmed and
 * packed, so at full resolution the WebP is decoded and drawn as-is. The repacker in
 * atlas-pack.js handles half-resolution copies for the low tier and older cell-grid atlases.
 *
 * Resolves to null when the atlas is missing or broken; the renderer then draws the procedural
 * placeholder fighter.
 */
import { assetUrl, atlasIds } from "../platform/assets.js";
import { applyPlacements, packAtlas } from "./atlas-pack.js";

const entries = new Map();
/** Released atlases kept briefly (menu browsing), oldest first; trimmed when a match starts. */
const cold = new Map();
// iOS WebKit backs ImageBitmaps and canvases with GPU surfaces that count against a per-page
// canvas memory cap and can be purged under memory pressure; past the cap, or after a purge,
// they draw nothing while the rest of the scene still renders. Image elements keep their
// encoded bytes and redecode on demand, so on iOS (every browser there is WebKit) atlases are
// drawn from images, and repacked pages are re-encoded once as PNG images.
const IOS = (() => {
  const nav = globalThis.navigator;
  if (!nav) return false;
  return /iP(hone|ad|od)/.test(nav.userAgent || "") || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
})();
const COLD_MAX = IOS || (globalThis.navigator?.deviceMemory ?? 8) <= 4 ? 1 : 2;
let worker = null;
let workerBroken = false;
let jobs = 0;
const pending = new Map();
let queue = Promise.resolve();

function validAtlas(json) {
  return json && typeof json === "object" && json.animations && typeof json.animations === "object" && Object.keys(json.animations).length > 0;
}

function getWorker() {
  if (worker || workerBroken || typeof Worker === "undefined") return worker;
  try {
    worker = new Worker(new URL("./atlas-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      const p = pending.get(data.job);
      if (!p) return;
      pending.delete(data.job);
      p.resolve(data);
    };
    worker.onerror = (e) => {
      e.preventDefault?.();
      workerBroken = true;
      worker?.terminate();
      worker = null;
      for (const p of pending.values()) p.resolve({ unsupported: true });
      pending.clear();
    };
  } catch {
    workerBroken = true;
    worker = null;
  }
  return worker;
}

function packInWorker(url, json, scale) {
  const w = getWorker();
  if (!w) return Promise.resolve({ unsupported: true });
  const job = ++jobs;
  return new Promise((resolve) => {
    pending.set(job, { resolve });
    w.postMessage({ job, url, json: { animations: json.animations }, scale });
  });
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

async function loadImage(src) {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

async function decodeOnMainThread(url) {
  if (IOS || typeof createImageBitmap !== "function") return loadImage(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return createImageBitmap(await res.blob());
}

/** A packed page as an image element; its object URL lives until the atlas is closed. */
async function pageImage(canvas) {
  const blob = canvas.convertToBlob
    ? await canvas.convertToBlob({ type: "image/png" })
    : await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
  canvas.width = canvas.height = 1;
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await loadImage(objectUrl);
    img.objectUrl = objectUrl;
    return img;
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function packOnMainThread(url, json, scale) {
  const source = await decodeOnMainThread(url);
  try {
    const out = await packAtlas(source, json, makeCanvas, () => new Promise((r) => setTimeout(r, 0)), scale);
    const bitmaps = IOS ? await Promise.all(out.pages.map(pageImage)) : typeof createImageBitmap === "function" ? await Promise.all(out.pages.map((c) => createImageBitmap(c))) : out.pages;
    if (bitmaps !== out.pages) for (const c of out.pages) c.width = c.height = 1;
    return { bitmaps, placements: Object.fromEntries(out.placements), stats: out.stats };
  } finally {
    source.close?.();
    if (source instanceof Image) source.src = "";
  }
}

/** Image files to try, best first: the sprite pipeline lists `images: { webp, png }`. */
function imageCandidates(json) {
  const list = [json.images?.webp, json.images?.png, json.image, "atlas.png"].filter(Boolean);
  return [...new Set(list)];
}

/** Decode an atlas sheet as-is (pipeline atlases are already trimmed and packed). */
async function decodeSheet(base, json) {
  let lastError = null;
  for (const file of imageCandidates(json)) {
    try {
      return { image: await decodeOnMainThread(assetUrl(base + file)), file };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("no atlas image");
}

async function loadPacked(id, scale) {
  const base = `assets/fighters/${id}/`;
  const res = await fetch(assetUrl(`${base}atlas.json`));
  if (!res.ok) return null;
  const json = await res.json();
  if (!validAtlas(json)) {
    console.warn(`Atlas for "${id}" has no animations; using placeholder.`);
    return null;
  }
  const anchor = json.anchor || { x: 128, y: 244 };
  const prepacked = Boolean(json.size?.decodedBytes || json.images);
  if (prepacked && scale === 1) {
    const { image, file } = await decodeSheet(base, json);
    const bytes = image.width * image.height * 4;
    return { ...json, anchor, image, pages: [image], packStats: { sourceBytes: json.size?.decodedBytes || bytes, packedBytes: bytes, scale, file } };
  }
  let packed = null;
  for (const file of imageCandidates(json)) {
    const url = assetUrl(base + file);
    packed = IOS ? { unsupported: true } : await packInWorker(url, json, scale);
    if (packed.unsupported) packed = await packOnMainThread(url, json, scale).catch((error) => ({ error: String(error?.message || error) }));
    if (!packed.error) break;
  }
  if (packed.error) throw new Error(packed.error);
  applyPlacements(json, packed.placements, packed.bitmaps);
  return { ...json, anchor, image: null, pages: packed.bitmaps, packStats: { ...packed.stats, sourceBytes: json.size?.decodedBytes || packed.stats.sourceBytes, scale } };
}

function closeAtlas(atlas) {
  if (!atlas) return;
  atlas.released = true;
  atlas.image = null;
  for (const page of atlas.pages || []) {
    if (typeof page.close === "function") page.close();
    else if (typeof HTMLImageElement !== "undefined" && page instanceof HTMLImageElement) {
      page.src = "";
      if (page.objectUrl) URL.revokeObjectURL(page.objectUrl);
    }
    else if ("width" in page) page.width = page.height = 0;
  }
  atlas.pages = [];
}

const keyOf = (id, scale) => (scale === 1 ? id : `${id}@${scale}`);

/**
 * Load (or share) a fighter atlas. Loads run one at a time so the transient decode of a full
 * source sheet happens once at a time, which keeps the loading peak low on phones.
 * `scale: 0.5` stores the frames at half resolution (low quality tier on small screens).
 */
export function acquireAtlas(id, { scale = 1 } = {}) {
  const known = atlasIds();
  if (known && !known.has(id)) return Promise.resolve(null);
  const key = keyOf(id, scale);
  let entry = entries.get(key);
  if (entry && cold.has(key)) cold.delete(key);
  if (!entry) {
    entry = { refs: 0, atlas: null, promise: null };
    const wanted = entry;
    const run = queue.then(() => (entries.get(key) === wanted ? loadPacked(id, scale) : null)).catch((error) => {
      console.warn(`Atlas for "${id}" unavailable; using placeholder.`, error?.message || error);
      return null;
    });
    queue = run.then(() => undefined);
    entry.promise = run.then((atlas) => {
      if (entries.get(key) !== entry) {
        closeAtlas(atlas);
        return null;
      }
      entry.atlas = atlas;
      return atlas;
    });
    entries.set(key, entry);
  }
  entry.refs += 1;
  return entry.promise;
}

export function releaseAtlas(id, { scale = 1 } = {}) {
  const key = keyOf(id, scale);
  const entry = entries.get(key);
  if (!entry || entry.refs <= 0) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  cold.set(key, entry);
  while (cold.size > COLD_MAX) evict(cold.keys().next().value);
}

function evict(id) {
  const entry = cold.get(id);
  cold.delete(id);
  if (!entry || entry.refs > 0) return;
  entries.delete(id);
  closeAtlas(entry.atlas);
}

/** Close every atlas nobody holds (call when a match starts and when returning to the menus). */
export function trimAtlasCache() {
  for (const id of [...cold.keys()]) evict(id);
}

/** Decoded bytes currently held by packed atlases, for the perf harness and debugging. */
export function atlasStats() {
  const out = { live: [], bytes: 0 };
  for (const [id, e] of entries) {
    if (!e.atlas) continue;
    const bytes = e.atlas.pages.reduce((n, p) => n + p.width * p.height * 4, 0);
    out.live.push({ id, refs: e.refs, MB: +(bytes / 1048576).toFixed(1), sourceMB: +((e.atlas.packStats?.sourceBytes || 0) / 1048576).toFixed(1), scale: e.atlas.packStats?.scale ?? 1 });
    out.bytes += bytes;
  }
  out.MB = +(out.bytes / 1048576).toFixed(1);
  return out;
}
