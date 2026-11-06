#!/usr/bin/env node
/**
 * Serve dist/ the way GitHub Pages will: under the /frontier-showdown/ subpath, from a plain
 * static server (no server.mjs APIs). Run `npm run build` first.
 *
 *   npm run preview            -> http://localhost:5173/frontier-showdown/
 *   PORT=8080 npm run preview
 */
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const site = join(root, ".pages");
const sub = process.env.PAGES_SUBPATH || "frontier-showdown";
const port = process.env.PORT || "5173";

if (!existsSync(join(dist, "index.html"))) {
  console.error("dist/ is missing; run `npm run build` first.");
  process.exit(1);
}
rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });
cpSync(dist, join(site, sub), { recursive: true });
console.log(`Serving dist/ at http://localhost:${port}/${sub}/`);
const child = spawn("npx", ["--yes", "serve@14", "--no-clipboard", "-l", port, site], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
