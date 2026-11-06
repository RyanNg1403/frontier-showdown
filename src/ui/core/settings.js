const STORAGE_KEY = "frontier-showdown.settings.v1";

export const ACTIONS = [
  { id: "up", label: "Up / Jump" },
  { id: "down", label: "Down / Crouch" },
  { id: "left", label: "Left" },
  { id: "right", label: "Right" },
  { id: "lightPunch", label: "Light Punch" },
  { id: "heavyPunch", label: "Heavy Punch" },
  { id: "lightKick", label: "Light Kick" },
  { id: "heavyKick", label: "Heavy Kick" },
  { id: "block", label: "Block" },
  { id: "tag", label: "Tag / Assist" },
];

// Keyboard values are KeyboardEvent.code; gamepad values are standard-mapping button indices.
export const DEFAULT_BINDINGS = {
  p1: {
    keyboard: {
      up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD",
      lightPunch: "KeyU", heavyPunch: "KeyI", lightKick: "KeyJ", heavyKick: "KeyK", block: "KeyL", tag: "KeyO",
    },
    gamepad: { up: 12, down: 13, left: 14, right: 15, lightPunch: 2, heavyPunch: 3, lightKick: 0, heavyKick: 1, block: 7, tag: 4 },
  },
  p2: {
    keyboard: {
      up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight",
      lightPunch: "Numpad4", heavyPunch: "Numpad5", lightKick: "Numpad1", heavyKick: "Numpad2", block: "Numpad6", tag: "Numpad8",
    },
    // Laptop alternates from the contract, for keyboards without a numpad.
    keyboardAlt: {
      lightPunch: "Comma", heavyPunch: "Period", lightKick: "KeyM", heavyKick: "Slash", block: "ShiftRight", tag: "Semicolon",
    },
    gamepad: { up: 12, down: 13, left: 14, right: 15, lightPunch: 2, heavyPunch: 3, lightKick: 0, heavyKick: 1, block: 7, tag: 4 },
  },
};

export const DIFFICULTIES = [
  { id: "easy", label: "Novice", blurb: "Slow reactions, rarely blocks. Good for learning specials." },
  { id: "normal", label: "Contender", blurb: "Blocks, punishes obvious mistakes, uses specials." },
  { id: "hard", label: "Champion", blurb: "Fast reads, combos into supers, tags at the right time." },
  { id: "brutal", label: "Frontier", blurb: "Frame-tight punishes and anti-airs. Expect no mercy." },
];

export const DEFAULT_SETTINGS = {
  version: 2,
  controls: DEFAULT_BINDINGS,
  audio: { master: 0.8, music: 0.6, sfx: 0.8, announcer: 0.9 },
  gameplay: { difficulty: "normal", roundTime: 99, roundsToWin: 2 },
  accessibility: { reduceMotion: false, reduceFlashes: false, screenShake: true },
  // `layout` holds drag offsets for the stick and the button cluster as fractions of the viewport.
  touch: {
    mode: "auto", stick: "floating", size: 1, opacity: 0.7, leftHanded: false, simple: false, haptics: true,
    fullscreen: true, twoPlayer: true, layout: { stick: { x: 0, y: 0 }, buttons: { x: 0, y: 0 } },
  },
};

const clone = (v) => JSON.parse(JSON.stringify(v));

function merge(base, over) {
  if (!over || typeof over !== "object") return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" ? merge(base[k], v) : v;
  }
  return out;
}

export function createSettings(initial) {
  let value = clone(DEFAULT_SETTINGS);
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (stored?.version === 2) value = merge(value, stored);
    else if (stored?.version === 1) {
      // v1 shipped Block and Tag swapped relative to the engine; keep everything but the controls.
      const { controls: _old, ...rest } = stored;
      value = merge(value, { ...rest, version: 2 });
    }
  } catch { /* storage unavailable: keep defaults */ }
  if (initial) value = merge(value, initial);
  const listeners = new Set();

  const api = {
    get: () => value,
    set(path, next) {
      const keys = path.split(".");
      const draft = clone(value);
      let node = draft;
      for (const k of keys.slice(0, -1)) node = node[k];
      node[keys.at(-1)] = next;
      value = draft;
      persist();
      listeners.forEach((fn) => fn(value, path));
    },
    reset(section) {
      value = section ? { ...value, [section]: clone(DEFAULT_SETTINGS[section]) } : clone(DEFAULT_SETTINGS);
      persist();
      listeners.forEach((fn) => fn(value, section || "*"));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* ignore */ }
  }
  return api;
}

const KEY_NAMES = {
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Space: "Space", Enter: "Enter",
  Escape: "Esc", Backspace: "Bksp", ShiftLeft: "L-Shift", ShiftRight: "R-Shift", ControlLeft: "L-Ctrl",
  ControlRight: "R-Ctrl", AltLeft: "L-Alt", AltRight: "R-Alt", Semicolon: ";", Quote: "'", Comma: ",",
  Period: ".", Slash: "/", Backslash: "\\", BracketLeft: "[", BracketRight: "]", Minus: "-", Equal: "=",
  Backquote: "`", Tab: "Tab", NumpadEnter: "Num Ent",
};

export function keyName(code) {
  if (!code) return "—";
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
  return code;
}

const PAD_NAMES = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "View", "Menu", "LS", "RS", "D↑", "D↓", "D←", "D→", "Home"];
export const padButtonName = (index) => (index == null ? "—" : PAD_NAMES[index] ?? `B${index}`);
