// Capture stage screenshots with headless Chrome (needs the preview server running).
//   node src/stages/capture.mjs --out <dir> [--progress <what>] [--stages a,b] [--x 320] [--t 2.5] [--guides]
// With --progress, files are named progress-NN-<what>-<stage>.png using the next free NN
// in <dir>, so earlier captures are never overwritten. Without it, files are <stage>.png.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { STAGE_IDS } from "./stages.js";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const out = opt("out");
if (!out) throw new Error("--out <dir> is required");
const progress = opt("progress");
const stages = opt("stages")?.split(",") ?? STAGE_IDS;
const x = opt("x");
const t = opt("t", "2.5");
const guides = args.includes("--guides");
const base = opt("base", "http://127.0.0.1:4180/src/stages/preview.html");
const chrome = opt("chrome", process.env.CHROME ?? "google-chrome");

mkdirSync(out, { recursive: true });
let next = 1 + Math.max(0, ...readdirSync(out)
  .map((f) => /^progress-(\d+)-/.exec(f)?.[1])
  .filter(Boolean)
  .map(Number));

for (const id of stages) {
  let file;
  if (progress) {
    do {
      file = join(out, `progress-${String(next).padStart(2, "0")}-${progress}-${id}.png`);
      next += 1;
    } while (existsSync(file));
  } else {
    file = join(out, `${id}.png`);
  }
  const url = new URL(base);
  url.searchParams.set("stage", id);
  url.searchParams.set("capture", "1");
  url.searchParams.set("t", t);
  if (x !== undefined) url.searchParams.set("x", x);
  if (guides) url.searchParams.set("guides", "1");
  await shoot(file, url.href);
  if (!existsSync(file) || statSync(file).size < 10_000) throw new Error(`Capture failed: ${file}`);
  console.log(`${file} ${statSync(file).size} bytes`);
}

// Headless Chrome writes the screenshot but can linger afterwards, so wait for a
// stable file and then stop the process ourselves.
async function shoot(file, href) {
  const child = spawn(chrome, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-sandbox",
    "--force-device-scale-factor=1", "--window-size=1280,720",
    `--user-data-dir=/tmp/stage-capture-profile-${process.pid}`,
    "--virtual-time-budget=6000", `--screenshot=${file}`, href,
  ], { stdio: "ignore", detached: true });
  const deadline = Date.now() + 45_000;
  let lastSize = -1;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 400));
    if (child.exitCode !== null) break;
    const size = existsSync(file) ? statSync(file).size : -1;
    if (size > 0 && size === lastSize) break;
    lastSize = size;
  }
  try { process.kill(-child.pid, "SIGKILL"); } catch { /* already exited */ }
}
