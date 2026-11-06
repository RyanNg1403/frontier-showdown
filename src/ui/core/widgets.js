import { h, replace } from "./dom.js";
import { iconUrl } from "./assets.js";
import { keyName } from "./settings.js";

const PAD_GLYPHS = {
  confirm: ["A", "is-a"], back: ["B", "is-b"], info: ["Y", "is-y"], tabs: ["LB RB", "is-bumper"],
  start: ["☰", "is-menu"], move: ["✛", "is-dpad"], adjust: ["◀ ▶", "is-dpad"],
};

function keyboardGlyph(action, settings) {
  const p1 = settings.get().controls.p1.keyboard;
  switch (action) {
    case "confirm": return `Enter / ${keyName(p1.lightPunch)}`;
    case "back": return "Esc";
    case "info": return keyName(p1.heavyPunch);
    case "tabs": return "Q / E";
    case "start": return "Esc";
    case "move": return "WASD / Arrows";
    case "adjust": return "← →";
    default: return action;
  }
}

/** Button prompt bar that re-renders when the player switches between keyboard and gamepad. */
export function hintBar(ui, hints) {
  const el = h("div", { class: "fs-hints", role: "note", "aria-label": "Controls" });
  let current = hints;
  const render = () => {
    const pad = ui.input.lastDevice === "gamepad";
    replace(el, current.map(([action, label]) => {
      const [glyph, cls] = pad ? PAD_GLYPHS[action] || [action, ""] : [keyboardGlyph(action, ui.settings), "is-key"];
      return h("span", { class: "fs-hint" }, h("kbd", { class: `fs-glyph ${cls}` }, glyph), h("span", { class: "fs-hint__label" }, label));
    }));
  };
  render();
  const off = ui.input.onDevice(render);
  el.update = (next) => { current = next; render(); };
  el.dispose = off;
  return el;
}

/**
 * Focus tracking for a list or grid of elements. Elements get `.is-focused`; mouse hover moves focus
 * and click confirms, so pointer users get the same flow as pad users.
 */
export function createNav({ items = [], columns = 1, wrap = true, index = 0, onChange, onConfirm, sound }) {
  const nav = {
    items,
    columns,
    index,
    set(next, silent = false) {
      if (!nav.items.length) return;
      const clampTo = Math.max(0, Math.min(nav.items.length - 1, next));
      const changed = clampTo !== nav.index;
      nav.items[nav.index]?.classList.remove("is-focused");
      nav.items[nav.index]?.setAttribute("aria-selected", "false");
      nav.index = clampTo;
      const el = nav.items[nav.index];
      el.classList.add("is-focused");
      el.setAttribute("aria-selected", "true");
      if (document.activeElement && document.activeElement !== el && el.closest(".fs-ui")?.contains(document.activeElement)) el.focus({ preventScroll: true });
      el.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      if (changed && !silent) sound?.("move");
      if (changed || silent) onChange?.(nav.index, el);
    },
    move(action) {
      const n = nav.items.length;
      if (!n) return false;
      const cols = nav.columns;
      let i = nav.index;
      if (action === "left") i = cols === 1 ? i : i % cols === 0 ? (wrap ? Math.min(n - 1, i + cols - 1) : i) : i - 1;
      else if (action === "right") i = cols === 1 ? i : i % cols === cols - 1 || i === n - 1 ? (wrap ? i - (i % cols) : i) : i + 1;
      else if (action === "up") i = i - cols < 0 ? (wrap ? lastInColumn(i % cols, cols, n) : i) : i - cols;
      else if (action === "down") i = i + cols >= n ? (wrap ? i % cols : i) : i + cols;
      else return false;
      nav.set(i);
      return true;
    },
    bind(list) {
      nav.items = list;
      list.forEach((el, i) => {
        el.addEventListener("pointerenter", () => nav.set(i));
        el.addEventListener("click", () => { nav.set(i); onConfirm?.(i, el); });
      });
      nav.set(Math.min(nav.index, list.length - 1), true);
    },
  };
  if (items.length) nav.bind(items);
  return nav;
}

function lastInColumn(col, cols, n) {
  let i = col;
  while (i + cols < n) i += cols;
  return i;
}

export function screenHeader(title, sub) {
  return h("header", { class: "fs-screen__header" },
    h("div", { class: "fs-screen__title-wrap" },
      h("h1", { class: "fs-screen__title" }, title),
      sub ? h("p", { class: "fs-screen__sub" }, sub) : null),
    h("div", { class: "fs-screen__rule", "aria-hidden": "true" }));
}

export function icon(name, cls = "") {
  return h("img", { class: `fs-icon ${cls}`, src: iconUrl(name), alt: "", "aria-hidden": "true", draggable: "false" });
}

/** Drifting ember particles; purely decorative, removed under reduced motion via CSS. */
export function embers(count = 22) {
  const el = h("div", { class: "fs-embers", "aria-hidden": "true" });
  for (let i = 0; i < count; i++) {
    el.append(h("span", {
      vars: {
        x: `${Math.random() * 100}%`,
        d: `${6 + Math.random() * 8}s`,
        delay: `${-Math.random() * 12}s`,
        s: `${2 + Math.random() * 4}px`,
        drift: `${(Math.random() - 0.5) * 120}px`,
      },
    }));
  }
  return el;
}

export function statBars(fighter, ranges) {
  const s = fighter?.stats || {};
  const rows = [
    ["Health", "stat-health", "health"],
    ["Speed", "stat-speed", "walkSpeed"],
    ["Rush", "stat-speed", "runSpeed"],
    ["Jump", null, "jump"],
    ["Weight", "stat-power", "weight"],
  ];
  return h("dl", { class: "fs-stats" }, rows.map(([label, ic, key]) => {
    const r = ranges[key] || { min: 0, max: 1 };
    const raw = Number(s[key] ?? 0);
    const t = r.max > r.min ? (raw - r.min) / (r.max - r.min) : 0.5;
    const pct = Math.round(18 + t * 82);
    return h("div", { class: "fs-stat" },
      h("dt", null, ic ? icon(ic, "fs-stat__icon") : h("span", { class: "fs-stat__icon fs-stat__icon--jump", "aria-hidden": "true" }, "⤒"), label),
      h("dd", null,
        h("span", { class: "fs-stat__track", role: "meter", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(pct), "aria-label": `${label} ${pct} of 100` },
          Array.from({ length: 10 }, (_, i) => h("i", { class: i < Math.round(pct / 10) ? "is-on" : "" })))));
  }));
}

export function statRanges(roster) {
  const keys = ["health", "walkSpeed", "runSpeed", "jump", "weight"];
  const out = {};
  for (const k of keys) {
    const vals = roster.map((f) => Number(f.stats?.[k])).filter((v) => Number.isFinite(v));
    out[k] = { min: Math.min(...vals), max: Math.max(...vals) };
  }
  return out;
}
