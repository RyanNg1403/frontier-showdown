/**
 * Reference-counted fighter atlases. `acquireAtlas(id)` loads and repacks an atlas (see
 * atlas-pack.js) the first time and shares it after that; `releaseAtlas(id)` drops a reference
 * and closes the packed ImageBitmaps once nobody holds it, so the decoded pixels are freed
 * between matches instead of waiting for garbage collection.
 *
 * Resolves to null when the atlas is missing or broken; the renderer then draws the procedural
 * placeholder fighter.
 */
import { assetUrl, atlasIds } from "../platform/assets.js";
import { applyPlacements, packAtlas } from "./atlas-pack.js";

const entries = new Map();
/** Released atlases kept briefly (menu browsing), oldest first; trimmed when a match starts. */
const cold = new Map();
const COLD_MAX = (globalThis.navigator?.deviceMemory ?? 8) <= 4 ? 1 : 2;
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

function packInWorker(url, json) {
  const w = getWorker();
  if (!w) return Promise.resolve({ unsupported: true });
  const job = ++jobs;
  return new Promise((resolve) => {
    pending.set(job, { resolve });
    w.postMessage({ job, url, json: { animations: json.animations } });
  });
}

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

async function decodeOnMainThread(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const blob = await res.blob();
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  const img = new Image();
  const objectUrl = URL.createObjectURL(blob);
  try {
    img.src = objectUrl;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function packOnMainThread(url, json) {
  const source = await decodeOnMainThread(url);
  try {
    const out = await packAtlas(source, json, makeCanvas, () => new Promise((r) => setTimeout(r, 0)));
    const bitmaps = typeof createImageBitmap === "function" ? await Promise.all(out.pages.map((c) => createImageBitmap(c))) : out.pages;
    if (bitmaps !== out.pages) for (const c of out.pages) c.width = c.height = 1;
    return { bitmaps, placements: Object.fromEntries(out.placements), stats: out.stats };
  } finally {
    source.close?.();
    if (source instanceof Image) source.src = "";
  }
}

async function loadPacked(id) {
  const base = `assets/fighters/${id}/`;
  const res = await fetch(assetUrl(`${base}atlas.json`));
  if (!res.ok) return null;
  const json = await res.json();
  if (!validAtlas(json)) {
    console.warn(`Atlas for "${id}" has no animations; using placeholder.`);
    return null;
  }
  const url = assetUrl(base + (json.image || "atlas.png"));
  let packed = await packInWorker(url, json);
  if (packed.unsupported) packed = await packOnMainThread(url, json);
  if (packed.error) throw new Error(packed.error);
  applyPlacements(json, packed.placements, packed.bitmaps);
  return { ...json, anchor: json.anchor || { x: 128, y: 244 }, image: null, pages: packed.bitmaps, packStats: packed.stats };
}

function closeAtlas(atlas) {
  if (!atlas) return;
  atlas.released = true;
  for (const page of atlas.pages || []) {
    if (typeof page.close === "function") page.close();
    else if ("width" in page) page.width = page.height = 0;
  }
  atlas.pages = [];
}

/**
 * Load (or share) a fighter atlas. Loads run one at a time so the transient decode of a full
 * source sheet happens once at a time, which keeps the loading peak low on phones.
 */
export function acquireAtlas(id) {
  const known = atlasIds();
  if (known && !known.has(id)) return Promise.resolve(null);
  let entry = entries.get(id);
  if (entry && cold.has(id)) cold.delete(id);
  if (!entry) {
    entry = { refs: 0, atlas: null, promise: null };
    const wanted = entry;
    const run = queue.then(() => (entries.get(id) === wanted ? loadPacked(id) : null)).catch((error) => {
      console.warn(`Atlas for "${id}" unavailable; using placeholder.`, error?.message || error);
      return null;
    });
    queue = run.then(() => undefined);
    entry.promise = run.then((atlas) => {
      if (entries.get(id) !== entry) {
        closeAtlas(atlas);
        return null;
      }
      entry.atlas = atlas;
      return atlas;
    });
    entries.set(id, entry);
  }
  entry.refs += 1;
  return entry.promise;
}

export function releaseAtlas(id) {
  const entry = entries.get(id);
  if (!entry || entry.refs <= 0) return;
  entry.refs -= 1;
  if (entry.refs > 0) return;
  cold.set(id, entry);
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
    out.live.push({ id, refs: e.refs, MB: +(bytes / 1048576).toFixed(1), sourceMB: +((e.atlas.packStats?.sourceBytes || 0) / 1048576).toFixed(1) });
    out.bytes += bytes;
  }
  out.MB = +(out.bytes / 1048576).toFixed(1);
  return out;
}
