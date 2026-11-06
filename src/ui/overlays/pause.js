import { h } from "../core/dom.js";
import { portraitImg, sigilUrl } from "../core/assets.js";
import { createNav, hintBar, icon } from "../core/widgets.js";
import { fighterAccent, shortName } from "../data/labs.js";

export function createPauseOverlay(ui) {
  const items = [
    { id: "resume", label: "Resume", icon: "mode-1v1" },
    { id: "movelist", label: "Move List", icon: "move-list" },
    { id: "settings", label: "Settings", icon: "settings" },
    { id: "select", label: "Character Select", icon: "character-select" },
    { id: "quit", label: "Quit to Title", icon: "quit" },
  ];
  const buttons = items.map((it) => h("button", { class: "fs-menu-btn", type: "button" }, icon(it.icon), h("span", null, it.label)));
  const state = ui.game.state;
  const matchInfo = state?.sides?.length
    ? h("div", { class: "fs-pause__match" }, state.sides.slice(0, 2).map((side, i) => {
      const f = side.fighters[side.active ?? 0];
      const data = ui.fighter(f.id) || f;
      return h("div", { class: `fs-pause__fighter ${i ? "is-p2" : "is-p1"}`, vars: { lab: fighterAccent(data) } },
        portraitImg(data, "fs-pause__img", { alt: "" }),
        h("div", null,
          h("small", null, side.label || (side.control === "cpu" ? "CPU" : `P${i + 1}`)),
          h("strong", null, shortName(data)),
          h("span", null, h("img", { src: sigilUrl(data.lab), alt: "" }), `${side.roundWins} round${side.roundWins === 1 ? "" : "s"}`)));
    }), h("div", { class: "fs-pause__round" }, `Round ${state.round || 1}`))
    : null;
  const hints = hintBar(ui, [["move", "Choose"], ["confirm", "Select"], ["back", "Resume"]]);
  const el = h("div", { class: "fs-overlay fs-pause", role: "dialog", "aria-modal": "true", "aria-label": "Paused" },
    h("div", { class: "fs-overlay__scrim" }),
    h("div", { class: "fs-panel fs-pause__panel" },
      h("h2", { class: "fs-panel__title" }, "Paused"),
      matchInfo,
      h("div", { class: "fs-pause__menu" }, buttons),
      hints));

  const nav = createNav({ items: [], columns: 1, sound: ui.sound, onConfirm: (i) => run(items[i].id) });
  nav.bind(buttons);

  function run(id) {
    if (id === "resume") {
      ui.sound("back");
      ui.closeOverlay();
    } else if (id === "movelist") {
      ui.sound("confirm");
      const st = ui.game.state;
      ui.openOverlay("movelist", { fighters: st?.sides?.flatMap((s) => s.fighters.map((f) => f.id)) || [] });
    } else if (id === "settings") {
      ui.sound("confirm");
      ui.openOverlay("settings");
    } else {
      ui.sound("confirm");
      ui.openOverlay("confirm", {
        title: id === "quit" ? "Quit to title?" : "Leave for character select?",
        body: "The current match will be lost.",
        yes: id === "quit" ? "Quit" : "Leave",
        onYes: () => {
          ui.closeAllOverlays();
          ui.game.endMatch?.();
          ui.show(id === "quit" ? "title" : "select", { fresh: true });
        },
      });
    }
  }

  return {
    el,
    enter() { buttons[0].focus({ preventScroll: true }); ui.say("Paused"); },
    input(evt) {
      if (evt.action === "up" || evt.action === "down") nav.move(evt.action);
      else if (evt.action === "confirm") run(items[nav.index].id);
      else if (evt.action === "back" || evt.action === "start") run("resume");
    },
  };
}
