// Standalone static server for the VFX preview page.
//   node src/vfx/preview-server.mjs   ->  http://127.0.0.1:4180/
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const port = Number(process.env.VFX_PREVIEW_PORT || 4180);
const host = process.env.HOST || "127.0.0.1";
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};
const allowed = ["src/", "assets/"];

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname).slice(1);
  if (path === "") {
    res.writeHead(302, { Location: "/src/vfx/preview.html" });
    res.end();
    return;
  }
  const file = resolve(root, path);
  if (!allowed.some((p) => path.startsWith(p)) || !file.startsWith(root + sep)) {
    res.writeHead(404).end("Not found");
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, host, () => {
  console.log(`VFX preview: http://${host}:${port}/src/vfx/preview.html`);
});
