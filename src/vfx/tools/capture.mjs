// Headless captures of the VFX preview (contact sheets and GIFs).
//
//   npm i --no-save puppeteer-core          # or set PUPPETEER_DIR to an install
//   node src/vfx/preview-server.mjs &
//   node src/vfx/tools/capture.mjs sheet hits out.png
//   node src/vfx/tools/capture.mjs sheet all out.png
//   node src/vfx/tools/capture.mjs overview all out.png
//   node src/vfx/tools/capture.mjs gif showcase out.gif     # needs ffmpeg
//
// CHROME_PATH overrides the browser binary (default /usr/local/bin/google-chrome).
import { createRequire } from "node:module";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const require = createRequire(process.env.PUPPETEER_DIR ? join(resolve(process.env.PUPPETEER_DIR), "x.js") : import.meta.url);
const puppeteer = require("puppeteer-core");

const [mode, what, outPath] = process.argv.slice(2);
const url = process.env.VFX_PREVIEW_URL || "http://127.0.0.1:4180/src/vfx/preview.html";
if (!mode || !what || !outPath) {
  console.error("usage: capture.mjs sheet <family|all|a,b> <out.png> | overview all <out.png> | gif <script|family> <out.gif>");
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--use-gl=swiftshader"],
});
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text()); });
  await page.setViewport({ width: 1600, height: 900 });
  await page.goto(url, { waitUntil: "networkidle0" });
  await page.evaluate(() => window.vfxPreview.ready);

  if (mode === "sheet") {
    const family = what === "all" ? null : what.includes(",") ? what.split(",") : what;
    const opts = JSON.parse(process.env.SHEET_OPTS || "{}");
    const data = await page.evaluate((f, o) => window.vfxPreview.sheet(f, o), family, opts);
    await writeFile(outPath, Buffer.from(data.split(",")[1], "base64"));
  } else if (mode === "overview") {
    const data = await page.evaluate(() => window.vfxPreview.overview());
    await writeFile(outPath, Buffer.from(data.split(",")[1], "base64"));
  } else if (mode === "gif") {
    const { frames, fps: pageFps } = await page.evaluate((name) => window.vfxPreview.recordScript(name), what);
    const dir = await mkdtemp(join(tmpdir(), "vfx-gif-"));
    await Promise.all(frames.map((d, i) => writeFile(join(dir, `f${String(i).padStart(4, "0")}.png`), Buffer.from(d.split(",")[1], "base64"))));
    const fps = Number(process.env.GIF_FPS || pageFps);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(dir, "f%04d.png"),
      "-vf", "split[a][b];[a]palettegen=max_colors=200:stats_mode=full[p];[b][p]paletteuse=dither=none", outPath]);
    await rm(dir, { recursive: true, force: true });
  }
  console.log(`wrote ${outPath}`);
} finally {
  await browser.close();
}
