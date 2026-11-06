import { h, replace } from "../core/dom.js";
import { embers, hintBar, icon, screenHeader } from "../core/widgets.js";

const FORMATS = [
  { id: "1v1", icon: "mode-1v1", title: "1v1 Duel", sub: "Best of three rounds", blurb: "One fighter each. Classic rounds against the clock: deplete the health bar or lead when time runs out." },
  { id: "2v2", icon: "mode-2v2", title: "2v2 Tag Team", sub: "Two fighters per side", blurb: "Pick a pair. Tag out to recover red health, call assists, and finish both opponents to win the round." },
];

const MATCHUPS = [
  { id: "cpu", icon: "vs-cpu", title: "Versus CPU", sub: "1 player", blurb: "Fight the local AI. Choose its fighters yourself or leave it to chance. Set its strength under Settings > Gameplay." },
  { id: "local", icon: "local-versus", title: "Local Versus", sub: "2 players", blurb: "Head-to-head on one machine. Share the keyboard (WASD vs arrows) or plug in two gamepads." },
  { id: "cpuvcpu", icon: "cpu-vs-cpu", title: "CPU vs CPU", sub: "Spectate", blurb: "Sit back and watch two AI fighters go at it. Great for scouting matchups." },
];

export function createModeScreen(ui) {
  const formatCards = FORMATS.map((f) =>
    h("button", { class: "fs-format", type: "button", role: "radio", "aria-checked": "false", dataset: { id: f.id } },
      icon(f.icon, "fs-format__icon"),
      h("span", { class: "fs-format__text" }, h("strong", null, f.title), h("small", null, f.sub))));
  const matchCards = MATCHUPS.map((m) =>
    h("button", { class: "fs-matchup", type: "button", dataset: { id: m.id } },
      h("span", { class: "fs-matchup__glow", "aria-hidden": "true" }),
      icon(m.icon, "fs-matchup__icon"),
      h("strong", { class: "fs-matchup__title" }, m.title),
      h("small", { class: "fs-matchup__sub" }, m.sub)));
  const footerBtns = [
    h("button", { class: "fs-chip-btn", type: "button", dataset: { id: "settings" } }, icon("settings"), "Settings"),
    h("button", { class: "fs-chip-btn", type: "button", dataset: { id: "title" } }, icon("quit"), "Title Screen"),
  ];
  const detail = h("div", { class: "fs-mode__detail", "aria-live": "polite" });
  const hints = hintBar(ui, [["move", "Navigate"], ["confirm", "Select"], ["tabs", "1v1 / 2v2"], ["back", "Back"]]);

  const el = h("section", { class: "fs-screen fs-mode fs-bg", "aria-label": "Mode select" },
    embers(14),
    screenHeader("Select Mode", "Choose a format, then who is fighting"),
    h("div", { class: "fs-mode__body" },
      h("div", { class: "fs-mode__label" }, "Format"),
      h("div", { class: "fs-mode__formats", role: "radiogroup", "aria-label": "Format" }, formatCards),
      h("div", { class: "fs-mode__label" }, "Matchup"),
      h("div", { class: "fs-mode__matchups" }, matchCards),
      detail,
      h("div", { class: "fs-mode__footer" }, footerBtns)),
    hints);

  const rows = [formatCards, matchCards, footerBtns];
  let row = 1;
  let col = 0;
  let format = "1v1";

  function setFormat(id, sound = true) {
    if (format !== id && sound) ui.sound("move");
    format = id;
    formatCards.forEach((c) => {
      const on = c.dataset.id === id;
      c.classList.toggle("is-selected", on);
      c.setAttribute("aria-checked", String(on));
    });
    el.dataset.format = id;
    renderDetail();
  }

  function focus(r, c, sound = true) {
    const prev = rows[row][col];
    row = Math.max(0, Math.min(rows.length - 1, r));
    col = Math.max(0, Math.min(rows[row].length - 1, c));
    const next = rows[row][col];
    if (prev !== next) {
      prev?.classList.remove("is-focused");
      if (sound) ui.sound("move");
    }
    next.classList.add("is-focused");
    next.focus({ preventScroll: true });
    renderDetail();
  }

  function renderDetail() {
    const id = rows[row][col]?.dataset.id;
    const f = FORMATS.find((x) => x.id === format);
    const m = MATCHUPS.find((x) => x.id === id) || (row === 1 ? MATCHUPS[col] : null);
    const pads = ui.input.padCount();
    const lines = [];
    if (row === 0) lines.push(h("strong", null, FORMATS.find((x) => x.id === id).title), h("p", null, FORMATS.find((x) => x.id === id).blurb));
    else if (m) {
      lines.push(h("strong", null, `${f.title} · ${m.title}`), h("p", null, m.blurb));
      if (m.id === "local") lines.push(h("p", { class: "fs-mode__note" }, pads >= 2 ? "2 gamepads connected" : `${pads} gamepad${pads === 1 ? "" : "s"} connected · keyboard split: P1 WASD, P2 arrows`));
    } else if (id === "settings") lines.push(h("strong", null, "Settings"), h("p", null, "Controls remap, audio levels, CPU difficulty and accessibility options."));
    else lines.push(h("strong", null, "Title Screen"), h("p", null, "Return to the title screen."));
    replace(detail, lines);
  }

  function activate(r, c) {
    const btn = rows[r][c];
    const id = btn.dataset.id;
    if (r === 0) {
      setFormat(id);
      ui.sound("confirm");
      focus(1, col, false);
      return;
    }
    if (r === 1) {
      ui.sound("confirm");
      ui.session.mode = format;
      ui.session.matchup = id;
      ui.show("select", { fresh: true });
      return;
    }
    if (id === "settings") {
      ui.sound("confirm");
      ui.openOverlay("settings");
    } else {
      ui.sound("back");
      ui.show("title");
    }
  }

  rows.forEach((list, r) => list.forEach((btn, c) => {
    btn.addEventListener("pointerenter", () => focus(r, c));
    btn.addEventListener("click", () => { focus(r, c, false); activate(r, c); });
  }));
  formatCards.forEach((c) => c.addEventListener("click", () => setFormat(c.dataset.id)));

  return {
    el,
    enter() {
      setFormat(ui.session.mode || "1v1", false);
      rows.flat().forEach((b) => b.classList.remove("is-focused"));
      row = 1;
      col = Math.max(0, MATCHUPS.findIndex((m) => m.id === ui.session.matchup));
      focus(row, col, false);
    },
    input(evt) {
      switch (evt.action) {
        case "up": focus(row - 1, row - 1 === 1 ? col : Math.min(col, rows[Math.max(0, row - 1)].length - 1)); break;
        case "down": focus(row + 1, Math.min(col, rows[Math.min(rows.length - 1, row + 1)].length - 1)); break;
        case "left": focus(row, (col - 1 + rows[row].length) % rows[row].length); break;
        case "right": focus(row, (col + 1) % rows[row].length); break;
        case "tabPrev": case "tabNext": setFormat(format === "1v1" ? "2v2" : "1v1"); break;
        case "confirm": activate(row, col); break;
        case "back": ui.sound("back"); ui.show("title"); break;
        case "start": ui.openOverlay("settings"); break;
        default: break;
      }
    },
  };
}
