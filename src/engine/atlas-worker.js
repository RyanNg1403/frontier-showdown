/**
 * Decodes and repacks one fighter atlas off the main thread. Replies with the packed pages as
 * transferable ImageBitmaps, or `{ unsupported: true }` when this browser lacks OffscreenCanvas
 * in workers (the store then packs on the main thread).
 */
import { packAtlas } from "./atlas-pack.js";

self.onmessage = async ({ data }) => {
  const { job, url, json, scale = 1 } = data;
  if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap === "undefined") {
    self.postMessage({ job, unsupported: true });
    return;
  }
  let source = null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    source = await createImageBitmap(await res.blob());
    const { pages, placements, stats } = await packAtlas(source, json, (w, h) => new OffscreenCanvas(w, h), null, scale);
    const bitmaps = pages.map((c) => c.transferToImageBitmap());
    self.postMessage({ job, bitmaps, placements: Object.fromEntries(placements), stats }, bitmaps);
  } catch (error) {
    self.postMessage({ job, error: String(error?.message || error) });
  } finally {
    source?.close?.();
  }
};
