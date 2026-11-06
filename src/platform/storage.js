/**
 * Persistent storage with graceful degradation: IndexedDB for records that grow (match history,
 * stats, the resume checkpoint), localStorage for small synchronous items (last session), and an
 * in-memory fallback when both are unavailable (private browsing, blocked storage, quota full).
 * Nothing here throws: failures are logged once and reported through `status()`.
 */
const DB_NAME = "frontier-showdown";
const DB_VERSION = 1;
const OPEN_TIMEOUT_MS = 3000;
const HISTORY_CAP = 200;
const LOCAL_PREFIX = "frontier-showdown.";

const memory = new Map();
let warned = false;
let lastError = null;

function note(error, what) {
  lastError = `${what}: ${error?.name || ""} ${error?.message || error}`.trim();
  if (!warned) {
    warned = true;
    console.warn(`[storage] ${lastError}; progress falls back to ${hasLocalStorage() ? "localStorage" : "memory"} for this session.`);
  }
}

function hasLocalStorage() {
  try {
    const k = `${LOCAL_PREFIX}probe`;
    localStorage.setItem(k, "1");
    localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

/** Small synchronous values (JSON) in localStorage, falling back to memory. */
export const local = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(LOCAL_PREFIX + key);
      return raw == null ? (memory.has(key) ? memory.get(key) : fallback) : JSON.parse(raw);
    } catch {
      return memory.has(key) ? memory.get(key) : fallback;
    }
  },
  set(key, value) {
    memory.set(key, value);
    try {
      localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(value));
      return true;
    } catch (error) {
      note(error, `localStorage.setItem(${key})`);
      return false;
    }
  },
  remove(key) {
    memory.delete(key);
    try {
      localStorage.removeItem(LOCAL_PREFIX + key);
    } catch {
      // Unavailable storage has nothing to remove.
    }
  },
};

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDb() {
  let idb = null;
  try {
    idb = globalThis.indexedDB ?? null;
  } catch (error) {
    note(error, "indexedDB");
  }
  if (!idb) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const done = (db) => {
      if (settled) {
        db?.close?.();
        return;
      }
      settled = true;
      resolve(db);
    };
    // Some browsers never answer open() in private mode; don't let that stall the game.
    const timer = setTimeout(() => {
      note(new Error("timed out"), "indexedDB.open");
      done(null);
    }, OPEN_TIMEOUT_MS);
    let req;
    try {
      req = idb.open(DB_NAME, DB_VERSION);
    } catch (error) {
      clearTimeout(timer);
      note(error, "indexedDB.open");
      done(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("matches")) db.createObjectStore("matches", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => {
      clearTimeout(timer);
      const db = req.result;
      db.onversionchange = () => db.close();
      done(db);
    };
    req.onerror = () => {
      clearTimeout(timer);
      note(req.error, "indexedDB.open");
      done(null);
    };
    req.onblocked = () => note(new Error("blocked by another tab"), "indexedDB.open");
  });
}

export function createStorage() {
  let dbPromise = null;
  const db = () => (dbPromise ||= openDb());

  async function tx(storeName, mode, fn) {
    const handle = await db();
    if (!handle) throw new Error("IndexedDB unavailable");
    return new Promise((resolve, reject) => {
      let result;
      const t = handle.transaction(storeName, mode);
      t.oncomplete = () => resolve(result);
      t.onabort = t.onerror = () => reject(t.error || new Error("transaction aborted"));
      Promise.resolve(fn(t.objectStore(storeName))).then((r) => { result = r; }, reject);
    });
  }

  return {
    async get(key, fallback = null) {
      try {
        const value = await tx("kv", "readonly", (s) => promisify(s.get(key)));
        return value === undefined ? local.get(`kv.${key}`, fallback) : value;
      } catch (error) {
        if (error?.message !== "IndexedDB unavailable") note(error, `get(${key})`);
        return local.get(`kv.${key}`, fallback);
      }
    },
    async set(key, value) {
      try {
        await tx("kv", "readwrite", (s) => promisify(s.put(value, key)));
        local.remove(`kv.${key}`);
        return true;
      } catch (error) {
        if (error?.message !== "IndexedDB unavailable") note(error, `set(${key})`);
        return local.set(`kv.${key}`, value);
      }
    },
    async remove(key) {
      local.remove(`kv.${key}`);
      try {
        await tx("kv", "readwrite", (s) => promisify(s.delete(key)));
      } catch {
        // Already gone or storage unavailable.
      }
    },
    /** Append a match record, keeping the newest HISTORY_CAP. */
    async addMatch(record) {
      try {
        await tx("matches", "readwrite", async (s) => {
          await promisify(s.add(record));
          const keys = await promisify(s.getAllKeys());
          for (const k of keys.slice(0, Math.max(0, keys.length - HISTORY_CAP))) s.delete(k);
        });
        return true;
      } catch (error) {
        if (error?.message !== "IndexedDB unavailable") note(error, "addMatch");
        const list = local.get("history", []);
        list.push(record);
        return local.set("history", list.slice(-50));
      }
    },
    async listMatches(limit = 20) {
      try {
        const all = await tx("matches", "readonly", (s) => promisify(s.getAll()));
        return all.slice(-limit).reverse();
      } catch {
        return local.get("history", []).slice(-limit).reverse();
      }
    },
    async clear() {
      for (const key of ["kv.stats", "kv.resume", "history", "session"]) local.remove(key);
      try {
        await tx("kv", "readwrite", (s) => promisify(s.clear()));
        await tx("matches", "readwrite", (s) => promisify(s.clear()));
      } catch {
        // Nothing stored.
      }
    },
    async status() {
      const handle = await db();
      let estimate = null;
      try {
        estimate = await navigator.storage?.estimate?.();
      } catch {
        estimate = null;
      }
      return { backend: handle ? "indexeddb" : hasLocalStorage() ? "localstorage" : "memory", lastError, usage: estimate?.usage ?? null, quota: estimate?.quota ?? null };
    },
  };
}
