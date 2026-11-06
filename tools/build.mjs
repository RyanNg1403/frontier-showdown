#!/usr/bin/env node
/**
 * Static build for GitHub Pages (or any static host): `npm run build` writes dist/.
 *
 *  - Copies only what the game loads at runtime (no WAV masters, stage sources, previews,
 *    tests, server code or the legacy game).
 *  - Transcodes audio to Ogg Opus plus an MP3 fallback (ffmpeg) and stage/UI art to WebP
 *    (sharp). A file whose WebP is not smaller keeps its original format.
 *  - Writes manifest.json (modules, characters, formats, content hashes, loop lengths) and
 *    sw.js (service worker with the precache list and build version).
 *  - All URLs are relative, so dist/ works at `/` or under a subpath like /frontier-showdown/.
 *
 * Options: --out <dir> (default dist), --no-audio, --no-images, --atlas-webp (lossless WebP
 * fighter atlases; off by default because the atlas format belongs to the sprite pipeline).
 * Environment: FFMPEG=<path to ffmpeg>.
 */
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { baseManifest } from "./manifest.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const outDir = resolve(root, argv.includes("--out") ? argv[argv.indexOf("--out") + 1] : "dist");
const ffmpeg = process.env.FFMPEG || "ffmpeg";
const started = Date.now();

const posix = (p) => p.split(sep).join("/");
const exists = (p) => existsSync(join(root, p));

function walk(dir) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  const out = [];
  for (const entry of readdirSync(abs, { withFileTypes: true })) {
    const rel = posix(join(dir, entry.name));
    if (entry.isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}

async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }));
  return results;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err += d; });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.slice(-400)}`))));
  });
}

function wavDuration(file) {
  const buf = readFileSync(file);
  let byteRate = 0;
  for (let o = 12; o + 8 <= buf.length;) {
    const id = buf.toString("ascii", o, o + 4);
    const size = buf.readUInt32LE(o + 4);
    if (id === "fmt ") byteRate = buf.readUInt32LE(o + 16);
    if (id === "data" && byteRate) return +(size / byteRate).toFixed(6);
    o += 8 + size + (size & 1);
  }
  return null;
}

// ---------------------------------------------------------------------------------- inputs

const SRC_EXCLUDE = [/\/preview[^/]*$/, /\/build\//, /\/tools\//, /\/mock\//, /\.mjs$/, /\.md$/, /\.py$/, /\.html$/];
const srcFiles = walk("src").filter((f) => f.endsWith(".js") && !SRC_EXCLUDE.some((re) => re.test(f)));

const fighterFiles = [];
for (const id of readdirSync(join(root, "assets/fighters"), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const jsonPath = `assets/fighters/${id}/atlas.json`;
  if (!exists(jsonPath)) continue;
  let image = "atlas.png";
  try {
    image = JSON.parse(readFileSync(join(root, jsonPath), "utf8")).image || image;
  } catch {
    continue;
  }
  fighterFiles.push(jsonPath);
  if (exists(`assets/fighters/${id}/${image}`)) fighterFiles.push(`assets/fighters/${id}/${image}`);
}

const stageFiles = walk("assets/stages").filter((f) => /\.png$/i.test(f) && !/\/_(source|pipeline)\//.test(f));
const uiFiles = walk("assets/ui").filter((f) => /\.(png|jpe?g|webp|woff2|svg|txt)$/i.test(f));
const vfxFiles = ["assets/vfx/vfx-atlas.json", "assets/vfx/vfx-atlas.png"].filter(exists);
const audioFiles = [...walk("assets/audio").filter((f) => /\.wav$/i.test(f)), "assets/frontier-soundtrack.mp3"].filter(exists);
const docFiles = ["assets/ATTRIBUTIONS.md", "assets/audio/ATTRIBUTIONS.md", "assets/stages/SOURCES.md", "assets/ui/fonts/OFL.txt"].filter(exists);
const plainFiles = ["index.html", "favicon.svg", "styles/ui.css"].filter(exists);

// ---------------------------------------------------------------------------------- output

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const written = new Map();

function writeOut(rel, data) {
  const abs = join(outDir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, data);
  written.set(rel, statSync(abs).size);
}

function copy(rel) {
  const abs = join(outDir, rel);
  mkdirSync(dirname(abs), { recursive: true });
  cpSync(join(root, rel), abs);
  written.set(rel, statSync(abs).size);
}

const uiOther = uiFiles.filter((f) => !/\.(png|jpe?g)$/i.test(f));
for (const f of [...srcFiles, ...docFiles, ...uiOther, ...plainFiles.filter((f) => f !== "styles/ui.css"), "assets/vfx/vfx-atlas.json"].filter(exists)) copy(f);
for (const f of fighterFiles.filter((f) => f.endsWith(".json"))) copy(f);

// ---------------------------------------------------------------------------------- images

let sharp = null;
if (!flag("no-images")) {
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.warn("[build] sharp is not installed; images are copied unconverted (npm install to enable WebP).");
  }
}
const LOSSLESS_DIRS = ["assets/stages/", "assets/vfx/", "assets/fighters/"];
const imageDirs = ["assets/stages/", "assets/ui/", "assets/vfx/", ...(flag("atlas-webp") ? ["assets/fighters/"] : [])];
const except = [];
const sourceBytes = { images: 0, audio: 0 };

const images = [...stageFiles, ...uiFiles.filter((f) => /\.(png|jpe?g)$/i.test(f)), ...vfxFiles.filter((f) => f.endsWith(".png")), ...fighterFiles.filter((f) => f.endsWith(".png"))];
await pool(images, Math.max(2, cpus().length), async (rel) => {
  const src = join(root, rel);
  const size = statSync(src).size;
  sourceBytes.images += size;
  const convertible = sharp && imageDirs.some((d) => rel.startsWith(d));
  if (!convertible) return copy(rel);
  const lossless = LOSSLESS_DIRS.some((d) => rel.startsWith(d));
  const target = rel.replace(/\.(png|jpe?g)$/i, ".webp");
  const data = await sharp(src, { limitInputPixels: false })
    .webp(lossless ? { lossless: true, effort: 6 } : { quality: 84, alphaQuality: 90, effort: 6, smartSubsample: true })
    .toBuffer();
  if (data.length >= size) {
    except.push(rel);
    return copy(rel);
  }
  writeOut(target, data);
});
except.sort();

// CSS: point url(...) at the converted files (hashes are added after hashing, below).
const cssUrlRe = /url\((["']?)(\.\.\/assets\/[^"')]+)\1\)/g;

// ---------------------------------------------------------------------------------- audio

const haveFfmpeg = !flag("no-audio") && spawnSync(ffmpeg, ["-hide_banner", "-version"]).status === 0;
if (!haveFfmpeg && !flag("no-audio")) console.warn("[build] ffmpeg not found; audio is copied as WAV (set FFMPEG or install ffmpeg).");
const audioDurations = {};
const AUDIO_PROFILES = {
  music: { opus: ["-b:a", "48k"], mp3: ["-q:a", "6"] },
  soundtrack: { opus: ["-b:a", "80k"], mp3: ["-q:a", "7"] },
  sfx: { opus: ["-b:a", "48k"], mp3: ["-q:a", "6"] },
};
await pool(audioFiles, Math.max(2, cpus().length), async (rel) => {
  const src = join(root, rel);
  sourceBytes.audio += statSync(src).size;
  if (rel.startsWith("assets/audio/music/") && rel.endsWith(".wav")) audioDurations[rel] = wavDuration(src);
  if (!haveFfmpeg) return copy(rel);
  const profile = rel.endsWith("frontier-soundtrack.mp3") ? AUDIO_PROFILES.soundtrack : rel.includes("/music/") ? AUDIO_PROFILES.music : AUDIO_PROFILES.sfx;
  const stem = rel.replace(/\.(wav|mp3)$/i, "");
  for (const [ext, codec] of [["ogg", ["-c:a", "libopus", "-application", "audio", "-vbr", "on", ...profile.opus]], ["mp3", ["-c:a", "libmp3lame", ...profile.mp3]]]) {
    const out = join(outDir, `${stem}.${ext}`);
    mkdirSync(dirname(out), { recursive: true });
    await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", src, "-vn", "-map_metadata", "-1", ...codec, out]);
    written.set(`${stem}.${ext}`, statSync(out).size);
  }
});

// ---------------------------------------------------------------------------------- manifest

const hashes = {};
for (const rel of [...written.keys()].sort()) {
  if (!rel.startsWith("assets/")) continue;
  hashes[rel] = createHash("sha256").update(readFileSync(join(outDir, rel))).digest("hex").slice(0, 10);
}

const imageRule = sharp ? { from: ["png", "jpg", "jpeg"], to: "webp", dirs: imageDirs, except } : null;
const servedImage = (rel) => {
  if (!imageRule || !imageRule.dirs.some((d) => rel.startsWith(d)) || except.includes(rel)) return rel;
  return rel.replace(/\.(png|jpe?g)$/i, ".webp");
};

if (exists("styles/ui.css")) {
  const css = readFileSync(join(root, "styles/ui.css"), "utf8").replace(cssUrlRe, (all, q, url) => {
    const rel = posix(join("styles", url)).replace(/^styles\/\.\.\//, "");
    const served = servedImage(rel);
    const hash = hashes[served];
    return `url(${q}../${served}${hash ? `?v=${hash}` : ""}${q})`;
  });
  writeOut("styles/ui.css", css);
}

// index.html: preload the whole boot module graph so the browser fetches it in parallel instead
// of discovering ~130 modules one import level at a time.
function importGraph(entries) {
  const seen = new Set();
  const stack = [...entries];
  const re = /(?:^|[;\s])(?:import|export)\s*(?:[\w*{}\s,$]+from\s*)?["'](\.{1,2}\/[^"']+)["']/g;
  while (stack.length) {
    const rel = stack.pop();
    if (seen.has(rel) || !written.has(rel)) continue;
    seen.add(rel);
    const text = readFileSync(join(outDir, rel), "utf8");
    for (const m of text.matchAll(re)) stack.push(posix(join(dirname(rel), m[1])));
  }
  return [...seen];
}
const characterModules = srcFiles.filter((f) => /^src\/characters\/[a-z0-9-]+\.js$/.test(f) && !/\/(index|schema)\.js$/.test(f));
const bootEntries = ["src/main.js", "src/stages/index.js", "src/vfx/index.js", "src/ui/index.js", "src/audio/index.js", ...characterModules];
const preload = importGraph(bootEntries).filter((f) => f !== "src/main.js").sort();
const html = readFileSync(join(root, "index.html"), "utf8").replace(
  /(\s*)<script type="module" src="\.\/src\/main\.js"><\/script>/,
  (all, indent) => `${preload.map((f) => `${indent}<link rel="modulepreload" href="./${f}" />`).join("")}${all}`,
);
writeOut("index.html", html);

const base = baseManifest(root);
const manifest = {
  ...base,
  build: true,
  features: { decisionProxy: false },
  formats: {
    images: imageRule,
    audio: haveFfmpeg ? ["ogg", "mp3"] : [],
    audioDirs: ["assets/audio/", "assets/frontier-soundtrack."],
  },
  audioDurations,
  hashes,
};

const SHELL_ASSETS = [/^assets\/ui\/(fonts|frames|icons|sigils|backgrounds)\//, /^assets\/ui\/logo\./, /^assets\/vfx\//];
const precache = [
  "./",
  "index.html",
  "manifest.json",
  ...[...written.keys()].filter((f) => f.endsWith(".js") || f.endsWith(".css") || f === "favicon.svg"),
  ...Object.keys(hashes).filter((f) => SHELL_ASSETS.some((re) => re.test(f)) && !/\.(txt|md)$/.test(f)).map((f) => `${f}?v=${hashes[f]}`),
].filter((v, i, a) => a.indexOf(v) === i);

const version = createHash("sha256").update(JSON.stringify({ hashes, precache, src: [...written.keys()].filter((f) => !f.startsWith("assets/")).map((f) => [f, createHash("sha1").update(readFileSync(join(outDir, f))).digest("hex")]) })).digest("hex").slice(0, 12);
manifest.version = version;
writeOut("manifest.json", JSON.stringify(manifest));
const sw = readFileSync(join(root, "tools/sw.template.js"), "utf8")
  .replace("__VERSION__", version)
  .replace("__PRECACHE__", JSON.stringify(precache));
writeOut("sw.js", sw);
writeOut(".nojekyll", "");

// ---------------------------------------------------------------------------------- report

const sum = (pred) => [...written.entries()].filter(([f]) => pred(f)).reduce((n, [, s]) => n + s, 0);
const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;
const oggOnly = sum((f) => f.endsWith(".ogg"));
const mp3Only = sum((f) => f.endsWith(".mp3"));
const report = {
  version,
  files: written.size,
  total: mb(sum(() => true)),
  js: mb(sum((f) => f.endsWith(".js"))),
  images: `${mb(sourceBytes.images)} source -> ${mb(sum((f) => /\.(png|jpe?g|webp)$/.test(f)))}`,
  audio: `${mb(sourceBytes.audio)} source -> ${mb(oggOnly)} Opus (+ ${mb(mp3Only)} MP3 fallback)`,
  webpExceptions: except.length,
  seconds: ((Date.now() - started) / 1000).toFixed(1),
};
console.log(`[build] dist/ ready: ${JSON.stringify(report, null, 2)}`);
if (relative(root, outDir).startsWith("..")) console.warn(`[build] note: output is outside the repo (${outDir})`);
