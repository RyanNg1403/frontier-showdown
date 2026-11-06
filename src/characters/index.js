import { defineCharacter } from "./schema.js";

/**
 * Roster order from docs/roster-and-moves.md section 0. Characters are discovered at runtime
 * (manifest.json from the build or `npm start`, or the folder in node), so adding a fighter only means
 * adding `src/characters/<id>.js`; this list only sorts the select screen.
 */
export const ROSTER_ORDER = Object.freeze([
  "sam", "dario", "mark", "elon", "demis", "jensen", "ilya", "arthur",
  "andrej", "yann", "liang", "mustafa", "geoffrey", "noam", "chris", "feifei",
]);

/** Fallback when discovery is unavailable (static hosting). */
export const characterIds = Object.freeze(["sam", "dario"]);

const NON_CHARACTER_FILES = new Set(["index.js", "schema.js"]);
const cache = new Map();
let discovered = null;

function rosterSort(ids) {
  const rank = (id) => {
    const i = ROSTER_ORDER.indexOf(id);
    return i < 0 ? ROSTER_ORDER.length : i;
  };
  return [...new Set(ids)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * Discover `{ ids, atlases }`: character module ids in roster order, and the set of ids
 * that have `assets/fighters/<id>/atlas.json`.
 */
export async function discoverCharacters() {
  if (discovered) return discovered;
  let entries = null;
  if (typeof window === "undefined") {
    try {
      const fs = await import("node:fs");
      const url = await import("node:url");
      const dir = url.fileURLToPath(new URL(".", import.meta.url));
      const fighters = url.fileURLToPath(new URL("../../assets/fighters/", import.meta.url));
      entries = fs.readdirSync(dir)
        .filter((f) => /^[a-z0-9-]+\.js$/.test(f) && !NON_CHARACTER_FILES.has(f))
        .map((f) => ({ id: f.slice(0, -3), atlas: fs.existsSync(`${fighters}${f.slice(0, -3)}/atlas.json`) }));
    } catch {
      entries = null;
    }
  } else {
    const { getManifest, loadManifest } = await import("../platform/assets.js");
    entries = (getManifest() || (await loadManifest()))?.characters ?? null;
  }
  if (!Array.isArray(entries)) {
    discovered = { ids: [...characterIds], atlases: null };
  } else {
    discovered = { ids: rosterSort(entries.map((e) => e.id)), atlases: new Set(entries.filter((e) => e.atlas).map((e) => e.id)) };
  }
  return discovered;
}

/** Load and normalize `src/characters/<id>.js`. Works in the browser and in node. */
export async function loadCharacter(id) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Invalid character id "${id}"`);
  if (cache.has(id)) return cache.get(id);
  const promise = import(`./${id}.js`).then((mod) => {
    const data = mod.default || mod.character;
    if (!data) throw new Error(`src/characters/${id}.js has no default export`);
    return data.moves instanceof Map ? data : defineCharacter(data);
  });
  cache.set(id, promise);
  promise.catch(() => cache.delete(id));
  return promise;
}

export async function loadAllCharacters(ids = null) {
  const list = ids || (await discoverCharacters()).ids;
  const out = [];
  for (const id of list) {
    try {
      out.push(await loadCharacter(id));
    } catch (error) {
      console.warn(`Character "${id}" failed to load:`, error);
    }
  }
  return out;
}
