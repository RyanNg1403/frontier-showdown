import { defineCharacter } from "./schema.js";

/** Playable character ids, in select-screen order. Each has `src/characters/<id>.js`. */
export const characterIds = Object.freeze(["sam", "dario"]);

const cache = new Map();

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

export async function loadAllCharacters(ids = characterIds) {
  const out = [];
  for (const id of ids) {
    try {
      out.push(await loadCharacter(id));
    } catch (error) {
      console.warn(`Character "${id}" failed to load:`, error);
    }
  }
  return out;
}
