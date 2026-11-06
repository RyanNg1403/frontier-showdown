/**
 * Static-hosting asset layer. Every runtime URL is resolved against the site root (the
 * folder that holds index.html), so the game works at `/` and under a subpath such as
 * `/frontier-showdown/` on GitHub Pages.
 *
 * `manifest.json` (written by `npm run build`, or generated on the fly by `npm start`) lists
 * the optional modules, the characters and their atlases, and, for a build, the transcoded
 * formats and per-file content hashes. `assetUrl(path)` applies both: `.png` becomes `.webp`
 * where the build converted it, `.wav` becomes `.ogg`/`.mp3`, and `?v=<hash>` busts caches.
 */
export const SITE_ROOT = new URL("../../", import.meta.url);

let manifest = null;
let audioExt = null;

export async function loadManifest() {
  try {
    const res = await fetch(new URL("manifest.json", SITE_ROOT), { cache: "no-cache" });
    manifest = res.ok ? await res.json() : null;
  } catch {
    manifest = null;
  }
  return manifest;
}

export const getManifest = () => manifest;

function imageTarget(path) {
  const rule = manifest?.formats?.images;
  if (!rule) return path;
  const m = path.match(/\.(png|jpe?g)$/i);
  if (!m || !rule.from?.includes(m[1].toLowerCase())) return path;
  if (!rule.dirs?.some((d) => path.startsWith(d))) return path;
  if (rule.except?.some((d) => path.startsWith(d))) return path;
  return `${path.slice(0, -m[0].length)}.${rule.to}`;
}

/** First transcoded audio container this browser can decode, or null for the original WAVs. */
export function audioExtension() {
  if (audioExt !== null) return audioExt || null;
  const list = manifest?.formats?.audio || [];
  audioExt = "";
  if (typeof Audio === "undefined") return null;
  const probe = new Audio();
  const types = { ogg: 'audio/ogg; codecs="opus"', mp3: "audio/mpeg", m4a: 'audio/mp4; codecs="mp4a.40.2"' };
  for (const ext of list) {
    if (types[ext] && probe.canPlayType(types[ext])) {
      audioExt = ext;
      break;
    }
  }
  return audioExt || null;
}

function audioTarget(path) {
  if (!/\.(wav|mp3)$/i.test(path) || !path.startsWith("assets/")) return path;
  const ext = audioExtension();
  if (!ext) return path;
  const rule = manifest.formats.audioDirs;
  if (rule && !rule.some((d) => path.startsWith(d))) return path;
  return path.replace(/\.(wav|mp3)$/i, `.${ext}`);
}

/** Repo-relative path ("assets/ui/logo.png") as served by this deployment. */
export function assetPath(path) {
  const clean = String(path).replace(/^\.?\//, "");
  return audioTarget(imageTarget(clean));
}

/** Absolute URL for a repo-relative path, with format rewrite and cache-busting hash. */
export function assetUrl(path) {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  const served = assetPath(path);
  const hash = manifest?.hashes?.[served];
  const url = new URL(served, SITE_ROOT);
  if (hash) url.searchParams.set("v", hash);
  return url.href;
}

/** Resolve a URL that a module built relative to its own location (`new URL(x, import.meta.url)`). */
export function resolveUrl(href) {
  if (!href || /^(data:|blob:)/.test(href)) return href;
  const url = new URL(href, SITE_ROOT);
  if (url.origin !== SITE_ROOT.origin || !url.pathname.startsWith(SITE_ROOT.pathname)) return url.href;
  return assetUrl(decodeURIComponent(url.pathname.slice(SITE_ROOT.pathname.length)));
}

/** Character ids with an atlas, or null when the manifest is unavailable. */
export function atlasIds() {
  const list = manifest?.characters;
  return Array.isArray(list) ? new Set(list.filter((c) => c.atlas).map((c) => c.id)) : null;
}

/** Decoded size of a fighter's atlas from the sprite pipeline (`size.decodedBytes`), or null. */
export function atlasDecodedBytes(id) {
  return manifest?.characters?.find((c) => c.id === id)?.decodedBytes ?? null;
}

export function audioDuration(path) {
  return manifest?.audioDurations?.[path] ?? null;
}
