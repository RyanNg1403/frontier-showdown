import { h, replace } from "../core/dom.js";
import { hintBar, icon } from "../core/widgets.js";
import { ACTIONS, DIFFICULTIES, keyName, padButtonName } from "../core/settings.js";

const TABS = [
  { id: "controls", label: "Controls", icon: "controls" },
  { id: "audio", label: "Audio", icon: "audio" },
  { id: "gameplay", label: "Gameplay", icon: "difficulty" },
  { id: "access", label: "Accessibility", icon: "settings" },
];

export function createSettingsOverlay(ui, params = {}) {
  const S = ui.settings;
  const tabEls = TABS.map((t, i) => {
    const b = h("button", { class: "fs-tab", type: "button", role: "tab" }, icon(t.icon, "fs-tab__icon"), t.label);
    b.addEventListener("click", () => setTab(i));
    return b;
  });
  const list = h("div", { class: "fs-options", role: "list" });
  const note = h("p", { class: "fs-settings__note" });
  const hints = hintBar(ui, []);
  const el = h("div", { class: "fs-overlay fs-settings", role: "dialog", "aria-modal": "true", "aria-label": "Settings" },
    h("div", { class: "fs-overlay__scrim" }),
    h("div", { class: "fs-panel fs-settings__panel" },
      h("h2", { class: "fs-panel__title" }, "Settings"),
      h("div", { class: "fs-tabs", role: "tablist" }, tabEls),
      list,
      note,
      hints));

  let tab = Math.max(0, TABS.findIndex((t) => t.id === params.tab));
  let rows = [];
  let rowEls = [];
  let row = 0;
  let ctrlPlayer = "p1";
  let ctrlDevice = "keyboard";
  let capturing = false;

  const pct = (v) => `${Math.round(v * 100)}%`;

  function defs() {
    const v = S.get();
    if (TABS[tab].id === "controls") {
      const map = v.controls[ctrlPlayer][ctrlDevice];
      return [
        { type: "choice", label: "Player", get: () => ctrlPlayer, set: (x) => { ctrlPlayer = x; }, options: [{ value: "p1", label: "Player 1" }, { value: "p2", label: "Player 2" }] },
        { type: "choice", label: "Device", get: () => ctrlDevice, set: (x) => { ctrlDevice = x; }, options: [{ value: "keyboard", label: "Keyboard" }, { value: "gamepad", label: "Gamepad" }] },
        ...ACTIONS.map((a) => ({
          type: "binding", label: a.label, action: a.id,
          display: () => (ctrlDevice === "keyboard" ? keyName(map[a.id]) : padButtonName(map[a.id])),
        })),
        { type: "action", label: "Reset controls to default", run: () => S.reset("controls") },
      ];
    }
    if (TABS[tab].id === "audio") {
      return [
        ...[["master", "Master volume"], ["music", "Music"], ["sfx", "Effects"], ["announcer", "Announcer"]].map(([k, label]) => ({
          type: "slider", label, get: () => S.get().audio[k], set: (x) => S.set(`audio.${k}`, x), format: pct,
        })),
        { type: "action", label: "Test announcer", run: () => ui.audio.announce("Round one. Fight!", { test: true }) },
      ];
    }
    if (TABS[tab].id === "gameplay") {
      return [
        { type: "choice", label: "CPU difficulty", get: () => v.gameplay.difficulty, set: (x) => S.set("gameplay.difficulty", x),
          options: DIFFICULTIES.map((d) => ({ value: d.id, label: d.label, blurb: d.blurb })) },
        { type: "choice", label: "Round timer", get: () => v.gameplay.roundTime, set: (x) => S.set("gameplay.roundTime", x),
          options: [{ value: 30, label: "30 s" }, { value: 60, label: "60 s" }, { value: 99, label: "99 s" }, { value: null, label: "Unlimited" }] },
        { type: "choice", label: "Match length", get: () => v.gameplay.roundsToWin, set: (x) => S.set("gameplay.roundsToWin", x),
          options: [{ value: 1, label: "Best of 1" }, { value: 2, label: "Best of 3" }, { value: 3, label: "Best of 5" }] },
      ];
    }
    return [
      { type: "toggle", label: "Reduce motion", desc: "Replaces wipes, shakes and slams with simple fades.", get: () => v.accessibility.reduceMotion, set: (x) => S.set("accessibility.reduceMotion", x) },
      { type: "toggle", label: "Reduce flashes", desc: "Tones down hit flashes and announcer bursts.", get: () => v.accessibility.reduceFlashes, set: (x) => S.set("accessibility.reduceFlashes", x) },
      { type: "toggle", label: "Screen shake", desc: "Shake the HUD on heavy hits and KOs.", get: () => v.accessibility.screenShake, set: (x) => S.set("accessibility.screenShake", x) },
      { type: "action", label: "Reset all settings", run: () => S.reset() },
    ];
  }

  function renderRow(d) {
    const label = h("span", { class: "fs-opt__label" }, d.label);
    let control;
    if (d.type === "slider") {
      const v = d.get();
      control = h("span", { class: "fs-opt__slider" },
        h("span", { class: "fs-opt__arrow", "aria-hidden": "true" }, "◀"),
        h("span", { class: "fs-opt__track", role: "slider", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(v * 100)), "aria-label": d.label },
          Array.from({ length: 10 }, (_, i) => h("i", { class: i < Math.round(v * 10) ? "is-on" : "" }))),
        h("span", { class: "fs-opt__arrow", "aria-hidden": "true" }, "▶"),
        h("span", { class: "fs-opt__value" }, d.format(v)));
    } else if (d.type === "choice") {
      const cur = d.options.find((o) => o.value === d.get()) || d.options[0];
      control = h("span", { class: "fs-opt__choice" },
        h("span", { class: "fs-opt__arrow", "aria-hidden": "true" }, "◀"),
        h("span", { class: "fs-opt__value" }, cur.label),
        h("span", { class: "fs-opt__arrow", "aria-hidden": "true" }, "▶"),
        h("span", { class: "fs-opt__dots", "aria-hidden": "true" }, d.options.map((o) => h("i", { class: o === cur ? "is-on" : "" }))));
    } else if (d.type === "toggle") {
      const on = d.get();
      control = h("span", { class: ["fs-opt__toggle", on && "is-on"], role: "switch", "aria-checked": String(on), "aria-label": d.label }, h("i"), h("span", null, on ? "On" : "Off"));
    } else if (d.type === "binding") {
      control = h("kbd", { class: "fs-opt__bind" }, d.display());
    } else {
      control = h("span", { class: "fs-opt__go", "aria-hidden": "true" }, "›");
    }
    const r = h("div", { class: `fs-opt is-${d.type}`, role: "listitem", tabindex: "-1" }, label, control);
    return r;
  }

  function render(keepRow = true) {
    tabEls.forEach((t, i) => {
      t.classList.toggle("is-active", i === tab);
      t.setAttribute("aria-selected", String(i === tab));
    });
    rows = defs();
    rowEls = rows.map(renderRow);
    rowEls.forEach((r, i) => {
      r.addEventListener("pointerenter", () => focus(i, false));
      r.addEventListener("click", (e) => {
        focus(i, false);
        const arrow = e.target.closest(".fs-opt__arrow");
        if (arrow) adjust(arrow === r.querySelector(".fs-opt__arrow") ? -1 : 1);
        else activate();
      });
    });
    replace(list, rowEls);
    if (!keepRow) row = 0;
    focus(Math.min(row, rows.length - 1), false);
    hints.update(TABS[tab].id === "controls"
      ? [["tabs", "Tab"], ["move", "Choose"], ["confirm", "Rebind"], ["back", "Close"]]
      : [["tabs", "Tab"], ["move", "Choose"], ["adjust", "Change"], ["back", "Close"]]);
  }

  function updateNote() {
    const d = rows[row];
    if (TABS[tab].id === "controls") {
      note.textContent = capturing
        ? `Press a ${ctrlDevice === "keyboard" ? "key" : "gamepad button"} for "${d.label}". ${ctrlDevice === "keyboard" ? "Escape" : "View"} cancels.`
        : "Menus also accept Enter/Space to confirm and Esc to go back. Light Punch confirms, Light Kick goes back.";
    } else if (d?.type === "choice") {
      note.textContent = d.options.find((o) => o.value === d.get())?.blurb || "";
    } else note.textContent = d?.desc || "";
  }

  function focus(i, sound = true) {
    if (capturing) return;
    rowEls[row]?.classList.remove("is-focused");
    const changed = i !== row;
    row = Math.max(0, Math.min(rows.length - 1, i));
    rowEls[row]?.classList.add("is-focused");
    rowEls[row]?.scrollIntoView({ block: "nearest" });
    if (changed && sound) ui.sound("move");
    updateNote();
  }

  function adjust(dir) {
    const d = rows[row];
    if (!d) return;
    if (d.type === "slider") {
      const v = Math.round(Math.max(0, Math.min(1, d.get() + dir * 0.1)) * 10) / 10;
      d.set(v);
    } else if (d.type === "choice") {
      const idx = d.options.findIndex((o) => o.value === d.get());
      d.set(d.options[(idx + dir + d.options.length) % d.options.length].value);
    } else if (d.type === "toggle") d.set(!d.get());
    else return;
    ui.sound("move");
    render();
  }

  async function activate() {
    const d = rows[row];
    if (!d) return;
    if (d.type === "toggle" || d.type === "choice") return adjust(1);
    if (d.type === "action") {
      ui.sound("confirm");
      d.run();
      render();
      return;
    }
    if (d.type === "binding") {
      capturing = true;
      rowEls[row].classList.add("is-capturing");
      rowEls[row].querySelector(".fs-opt__bind").textContent = "Press…";
      updateNote();
      ui.sound("confirm");
      const res = await ui.input.captureNext();
      capturing = false;
      if (!res.cancel && res.device === ctrlDevice) {
        const value = ctrlDevice === "keyboard" ? res.code : res.button;
        const path = `controls.${ctrlPlayer}.${ctrlDevice}`;
        const map = { ...S.get().controls[ctrlPlayer][ctrlDevice] };
        const clash = Object.keys(map).find((k) => k !== d.action && map[k] === value);
        if (clash) map[clash] = map[d.action];
        map[d.action] = value;
        S.set(path, map);
        ui.sound("lock");
      } else ui.sound(res.cancel ? "back" : "error");
      render();
    }
  }

  function setTab(i) {
    tab = (i + TABS.length) % TABS.length;
    ui.sound("move");
    render(false);
  }

  render(false);

  return {
    el,
    leave() { ui.input.cancelCapture(); },
    input(evt) {
      if (capturing) return;
      switch (evt.action) {
        case "tabPrev": setTab(tab - 1); break;
        case "tabNext": setTab(tab + 1); break;
        case "up": focus(row - 1); break;
        case "down": focus(row + 1); break;
        case "left": adjust(-1); break;
        case "right": adjust(1); break;
        case "confirm": activate(); break;
        case "back": case "start": ui.sound("back"); ui.closeOverlay(); break;
        default: break;
      }
    },
  };
}
