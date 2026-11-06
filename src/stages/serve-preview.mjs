// Static server for the stage preview: node src/stages/serve-preview.mjs [port]
// then open http://127.0.0.1:4180/src/stages/preview.html
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const port = Number(process.argv[2] ?? process.env.PORT ?? 4180);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };
const allowed = ["src/stages/", "assets/stages/"];

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname).slice(1) || "src/stages/preview.html";
  const file = resolve(root, path);
  if (!allowed.some((prefix) => path.startsWith(prefix)) || !file.startsWith(root + sep)) {
    res.writeHead(404).end("Not found");
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Stage preview: http://127.0.0.1:${port}/src/stages/preview.html`);
});
