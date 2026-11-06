import { h, replace } from "../core/dom.js";
import { portraitImg, sigilUrl } from "../core/assets.js";
import { createNav, embers, hintBar, icon } from "../core/widgets.js";
import { fighterAccent, labInfo, shortName } from "../data/labs.js";

export function createResultsScreen(ui) {
  const hero = h("div", { class: "fs-results__hero" });
  const panel = h("div", { class: "fs-results__panel" });
  const hints = hintBar(ui, [["move", "Choose"], ["confirm", "Select"]]);
  const el = h("section", { class: "fs-screen fs-results fs-bg", "aria-label": "Match results" },
    embers(26),
    h("div", { class: "fs-results__rays", "aria-hidden": "true" }),
    hero,
    panel,
    hints);
  let nav = null;
  let actions = [];

  function sideName(i, state) {
    const side = state.sides[i];
    return side.fighters.length > 1 ? side.fighters.map((f) => shortName(f)).join(" & ") : side.fighters[0]?.name;
  }

  return {
    el,
    enter() {
      const result = ui.session.result || { winner: 0, state: ui.game.state };
      const state = result.state;
      const w = result.winner;
      const stats = ui.session.stats;
      const winSide = state.sides[w];
      const winners = winSide.fighters.map((f) => ui.fighter(f.id) || f);
      const lead = winners[0];
      const lab = labInfo(lead.lab);
      const flawless = stats.sides[w].perfects >= (state.roundsToWin || 2);
      const who = winSide.control === "cpu" ? "CPU" : ui.session.matchup === "local" ? `Player ${w + 1}` : "Player 1";
      el.style.setProperty("--lab", fighterAccent(lead));
      el.dataset.winner = String(w);

      replace(hero,
        h("div", { class: "fs-results__portraits" }, winners.map((f, k) => h("div", { class: `fs-results__fighter ${k ? "is-partner" : ""}`, vars: { lab: fighterAccent(f) } }, portraitImg(f, "fs-results__img")))),
        h("div", { class: "fs-results__crest" },
          h("img", { src: sigilUrl(lead.lab), alt: "" }),
          h("span", null, lab.name)));

      const secs = Math.round((performance.now() - stats.startedAt) / 1000);
      const rows = [
        ["Rounds won", (s, i) => state.sides[i].roundWins],
        ["Damage dealt", (s) => Math.round(s.damage)],
        ["Best combo", (s) => `${s.maxCombo} hits`],
        ["Specials", (s) => s.specials],
        ["Supers", (s) => s.supers],
        ["Perfect rounds", (s) => s.perfects],
        ...(state.mode === "2v2" ? [["Tags", (s) => s.tags]] : []),
      ];
      actions = [
        { id: "rematch", label: "Rematch", icon: "rematch" },
        { id: "select", label: "Character Select", icon: "character-select" },
        { id: "quit", label: "Quit to Title", icon: "quit" },
      ];
      const buttons = actions.map((a) => h("button", { class: "fs-menu-btn", type: "button" }, icon(a.icon), h("span", null, a.label)));

      replace(panel,
        h("p", { class: "fs-results__who" }, `${who} wins`),
        h("h1", { class: "fs-results__title" }, sideName(w, state)),
        h("p", { class: "fs-results__sub" }, winners.map((f) => f.title).filter(Boolean).join(" · ")),
        flawless ? h("div", { class: "fs-results__badge" }, "Flawless Victory") : null,
        h("table", { class: "fs-results__table" },
          h("caption", { class: "fs-sr-only" }, "Match statistics"),
          h("thead", null, h("tr", null,
            h("th", { scope: "col" }, ""),
            h("th", { scope: "col", class: "is-p1" }, sideName(0, state)),
            h("th", { scope: "col", class: "is-p2" }, sideName(1, state)))),
          h("tbody", null, rows.map(([label, fn]) => {
            const a = fn(stats.sides[0], 0);
            const b = fn(stats.sides[1], 1);
            const na = parseFloat(a);
            const nb = parseFloat(b);
            return h("tr", null,
              h("th", { scope: "row" }, label),
              h("td", { class: na > nb ? "is-best" : "" }, String(a)),
              h("td", { class: nb > na ? "is-best" : "" }, String(b)));
          }))),
        h("p", { class: "fs-results__time" }, `Match time ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`),
        h("div", { class: "fs-results__actions" }, buttons));

      nav = createNav({ items: [], columns: 1, sound: ui.sound, onConfirm: (i) => run(actions[i].id) });
      nav.bind(buttons);
      el.classList.remove("is-playing");
      void el.offsetWidth;
      el.classList.add("is-playing");
      ui.say(`${sideName(w, state)} wins the match`);
    },
    input(evt) {
      if (evt.action === "up" || evt.action === "down") nav.move(evt.action);
      else if (evt.action === "confirm") run(actions[nav.index].id);
      else if (evt.action === "back") nav.set(actions.length - 1);
    },
  };

  function run(id) {
    ui.sound("confirm");
    if (id === "rematch") ui.show("versus");
    else if (id === "select") {
      ui.game.endMatch?.();
      ui.show("select", { fresh: true });
    } else {
      ui.game.endMatch?.();
      ui.show("title");
    }
  }
}
