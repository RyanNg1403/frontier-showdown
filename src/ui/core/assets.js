import { labInfo } from "../data/labs.js";

const ROOT = new URL("../../../", import.meta.url);

export function asset(path) {
  if (!path) return "";
  if (/^(https?:|data:|blob:|\/)/.test(path)) return path;
  return new URL(path, ROOT).href;
}

export const uiAsset = (path) => asset(`assets/ui/${path}`);
export const iconUrl = (name) => uiAsset(`icons/${name}.png`);
export const sigilUrl = (lab) => uiAsset(`sigils/${labInfo(lab).sigil}.png`);

export function portraitUrl(fighter) {
  if (!fighter) return "";
  return asset(fighter.portrait || `assets/ui/portraits/${fighter.id}.png`);
}

export function initials(name = "?") {
  const parts = String(name).trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)).toUpperCase();
}

/** Silhouette placeholder for fighters that have no portrait art yet. */
export function placeholderPortrait(fighter) {
  const { color } = labInfo(fighter?.lab);
  const text = initials(fighter?.name || fighter?.id);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 384">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".55"/><stop offset="1" stop-color="#0b0d12"/></linearGradient></defs>
<path d="M192 70c46 0 78 34 78 82s-32 86-78 86-78-38-78-86 32-82 78-82zM40 384c8-84 70-128 152-128s144 44 152 128z" fill="url(#g)" stroke="${color}" stroke-opacity=".6" stroke-width="4"/>
<text x="192" y="178" font-family="Teko,Impact,sans-serif" font-size="88" font-weight="700" fill="#f3ede2" text-anchor="middle">${text}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function portraitImg(fighter, className = "", extra = {}) {
  const img = new Image();
  img.className = className;
  img.alt = extra.alt ?? (fighter ? `${fighter.name} portrait` : "");
  img.decoding = "async";
  img.draggable = false;
  if (!fighter) return img;
  img.src = portraitUrl(fighter);
  img.addEventListener("error", () => {
    img.src = placeholderPortrait(fighter);
    img.classList.add("is-placeholder");
  }, { once: true });
  return img;
}

const preloaded = new Map();
export function preload(urls) {
  return Promise.all(urls.filter(Boolean).map((url) => {
    if (!preloaded.has(url)) {
      preloaded.set(url, new Promise((resolve) => {
        const img = new Image();
        img.onload = img.onerror = () => resolve(img);
        img.src = url;
      }));
    }
    return preloaded.get(url);
  }));
}
