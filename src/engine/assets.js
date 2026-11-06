import { assetUrl } from "../platform/assets.js";
import { acquireAtlas } from "./atlas-store.js";

const images = new Map();

/** Load an image by repo-relative path (or absolute URL); cached for the session. */
export function loadImage(path) {
  const url = /^(https?:|data:|blob:|\/)/.test(path) ? path : assetUrl(path);
  if (images.has(url)) return images.get(url);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image failed: ${url}`));
    img.src = url;
  });
  images.set(url, p);
  p.catch(() => images.delete(url));
  return p;
}

/**
 * Packed fighter atlas (see atlas-store.js). Each call takes a reference; pair it with
 * `releaseAtlas(id)` from atlas-store.js when done.
 */
export function loadAtlas(id) {
  return acquireAtlas(id);
}

export const assetApi = Object.freeze({ loadImage, loadAtlas });
