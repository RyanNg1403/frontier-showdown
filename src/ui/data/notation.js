import { h } from "../core/dom.js";

// Numpad notation, assuming the fighter faces right.
const ARROWS = { 1: "↙", 2: "↓", 3: "↘", 4: "←", 5: "•", 6: "→", 7: "↖", 8: "↑", 9: "↗" };
const MOTIONS = {
  QCF: [2, 3, 6], QCB: [2, 1, 4], DP: [6, 2, 3], RDP: [4, 2, 1],
  HCF: [4, 1, 2, 3, 6], HCB: [6, 3, 2, 1, 4],
  // MK-style taps: BF = back, forward; DB / DF = down then back / forward (two taps, not diagonals).
  BF: [4, 6], FB: [6, 4], DB: [2, 4], DF: [2, 6], DD: [2, 2], FF: [6, 6], BB: [4, 4],
  F: [6], B: [4], D: [2], U: [8], UF: [9], UB: [7], N: [5],
};
const BUTTONS = {
  LP: { label: "LP", kind: "punch", name: "Light Punch" },
  HP: { label: "HP", kind: "punch", name: "Heavy Punch" },
  LK: { label: "LK", kind: "kick", name: "Light Kick" },
  HK: { label: "HK", kind: "kick", name: "Heavy Kick" },
  P: { label: "P", kind: "punch", name: "Any Punch" },
  K: { label: "K", kind: "kick", name: "Any Kick" },
  PP: { label: "PP", kind: "punch", name: "Both Punches" },
  KK: { label: "KK", kind: "kick", name: "Both Kicks" },
  BLK: { label: "BLK", kind: "block", name: "Block" },
  BL: { label: "BLK", kind: "block", name: "Block" },
  TAG: { label: "TAG", kind: "tag", name: "Tag" },
  THROW: { label: "THR", kind: "throw", name: "Throw" },
};

/**
 * Parse a move input such as "QCF+P", "D,D+K", "236P", "QCFx2+PP" or "B,F+HK" into tokens:
 * { type: "dir", value: 1-9 } | { type: "btn", value: "LP" } | { type: "sep", value: "+" | "," | "hold" }.
 */
export function parseInput(input) {
  const tokens = [];
  if (!input) return tokens;
  const parts = String(input).toUpperCase().replace(/\s+/g, "").split(/([+,~])/);
  for (const part of parts) {
    if (!part) continue;
    if (part === "+" || part === "," || part === "~") {
      tokens.push({ type: "sep", value: part === "~" ? "," : part });
      continue;
    }
    pushPart(tokens, part);
  }
  return tokens;
}

function pushPart(tokens, part) {
  const charge = part.match(/^\[([A-Z]+)\]([A-Z0-9]+)$/);
  if (charge) {
    pushPart(tokens, `[${charge[1]}]`);
    pushPart(tokens, charge[2]);
    return;
  }
  const hold = part.startsWith("[") && part.endsWith("]");
  if (hold) part = part.slice(1, -1);
  const repeat = part.match(/^(.+?)X(\d)$/);
  const times = repeat ? Number(repeat[2]) : 1;
  const body = repeat ? repeat[1] : part;
  for (let i = 0; i < times; i++) {
    if (hold) tokens.push({ type: "sep", value: "hold" });
    if (body === "360") {
      tokens.push({ type: "spin", value: 360 });
    } else if (MOTIONS[body]) {
      for (const d of MOTIONS[body]) tokens.push({ type: "dir", value: d });
    } else if (BUTTONS[body]) {
      tokens.push({ type: "btn", value: body });
    } else if (/^[1-9]+[A-Z]*$/.test(body)) {
      const [, dirs, btn] = body.match(/^([1-9]+)([A-Z]*)$/);
      for (const d of dirs) tokens.push({ type: "dir", value: Number(d) });
      if (btn) {
        tokens.push({ type: "sep", value: "+" });
        pushPart(tokens, btn);
      }
    } else {
      tokens.push({ type: "text", value: body });
    }
  }
}

export function describeInput(input) {
  return parseInput(input).map((t) => {
    if (t.type === "dir") return ARROWS[t.value];
    if (t.type === "spin") return "full circle";
    if (t.type === "btn") return BUTTONS[t.value].name;
    if (t.type === "sep") return t.value === "hold" ? "hold" : t.value === "+" ? "plus" : "then";
    return t.value;
  }).join(" ");
}

/** Render an input as keycap glyphs. `size` is "sm" or "md". */
export function renderInput(input, { size = "md", activeIndex = -1 } = {}) {
  const tokens = parseInput(input);
  let glyph = 0;
  const el = h("span", { class: `fs-input fs-input--${size}`, role: "img", "aria-label": describeInput(input) });
  for (const t of tokens) {
    if (t.type === "sep") {
      el.append(h("span", { class: "fs-input__sep", "aria-hidden": "true" }, t.value === "hold" ? "hold" : t.value === "," ? "›" : "+"));
      continue;
    }
    const state = glyph === activeIndex ? " is-active" : glyph < activeIndex ? " is-done" : "";
    glyph++;
    if (t.type === "dir") el.append(h("span", { class: `fs-input__dir${state}`, "aria-hidden": "true" }, ARROWS[t.value]));
    else if (t.type === "spin") el.append(h("span", { class: `fs-input__text is-spin${state}`, "aria-hidden": "true" }, "360°"));
    else if (t.type === "btn") {
      const b = BUTTONS[t.value];
      el.append(h("span", { class: `fs-input__btn is-${b.kind}${state}`, "aria-hidden": "true" }, b.label));
    } else el.append(h("span", { class: `fs-input__text${state}`, "aria-hidden": "true" }, t.value));
  }
  return el;
}

export function glyphCount(input) {
  return parseInput(input).filter((t) => t.type !== "sep").length;
}

// Labels for the contract's normal-move keys.
export const NORMAL_INPUTS = {
  light_punch: { name: "Jab", input: "LP" },
  heavy_punch: { name: "Straight", input: "HP" },
  light_kick: { name: "Snap Kick", input: "LK" },
  heavy_kick: { name: "Roundhouse", input: "HK" },
  crouch_light: { name: "Low Jab", input: "D+LP" },
  crouch_heavy: { name: "Sweep", input: "D+HK" },
  air_attack: { name: "Jump-In", input: "U,HP" },
  throw: { name: "Throw", input: "LP+LK" },
};

export function normalLabel(key, move = {}) {
  const base = NORMAL_INPUTS[key] || { name: key.replace(/_/g, " "), input: "" };
  return { name: move.name || base.name, input: move.input || base.input };
}
