/**
 * The site manifest: which optional modules exist and which characters have an atlas, so the
 * client never requests a file that isn't there. `npm run build` writes it to dist/manifest.json
 * (with transcoded formats, content hashes and the precache list); `npm start` serves the same
 * base fields live from the working tree.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const NON_CHARACTER_FILES = new Set(["index.js", "schema.js"]);

export function listCharacters(root) {
  let files = [];
  try {
    files = readdirSync(join(root, "src", "characters"));
  } catch {
    return [];
  }
  return files
    .filter((f) => /^[a-z0-9-]+\.js$/.test(f) && !NON_CHARACTER_FILES.has(f))
    .map((f) => f.slice(0, -3))
    .sort()
    .map((id) => {
      const file = join(root, "assets", "fighters", id, "atlas.json");
      if (!existsSync(file)) return { id, atlas: false };
      let decodedBytes = null;
      try {
        decodedBytes = JSON.parse(readFileSync(file, "utf8")).size?.decodedBytes ?? null;
      } catch {
        decodedBytes = null;
      }
      return decodedBytes ? { id, atlas: true, decodedBytes } : { id, atlas: true };
    });
}

export function baseManifest(root) {
  const has = (...parts) => existsSync(join(root, ...parts));
  return {
    build: false,
    modules: {
      stage: has("src", "stages", "index.js"),
      vfx: has("src", "vfx", "index.js"),
      ui: has("src", "ui", "index.js"),
      audio: has("src", "audio", "index.js"),
    },
    styles: { ui: has("styles", "ui.css") },
    characters: listCharacters(root),
  };
}
