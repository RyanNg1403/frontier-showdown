const images = new Map();
const atlases = new Map();

export function loadImage(url) {
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

function validAtlas(json) {
  return json && typeof json === "object" && json.animations && typeof json.animations === "object" && Object.keys(json.animations).length > 0;
}

/**
 * Load `assets/fighters/<id>/atlas.json` + its image. Resolves to null when missing or broken,
 * so the renderer can fall back to the procedural placeholder.
 */
export function loadAtlas(id) {
  if (atlases.has(id)) return atlases.get(id);
  const base = `/assets/fighters/${id}/`;
  const p = (async () => {
    try {
      const res = await fetch(`${base}atlas.json`, { cache: "no-cache" });
      if (!res.ok) return null;
      const json = await res.json();
      if (!validAtlas(json)) {
        console.warn(`Atlas for "${id}" has no animations; using placeholder.`);
        return null;
      }
      const image = await loadImage(base + (json.image || "atlas.png"));
      const anchor = json.anchor || { x: 128, y: 244 };
      return { ...json, anchor, image };
    } catch (error) {
      console.warn(`Atlas for "${id}" unavailable; using placeholder.`, error.message);
      return null;
    }
  })();
  atlases.set(id, p);
  return p;
}

export const assetApi = Object.freeze({ loadImage, loadAtlas });
