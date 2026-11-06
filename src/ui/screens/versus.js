import { h, replace } from "../core/dom.js";
import { portraitImg, sigilUrl, uiAsset } from "../core/assets.js";
import { fighterAccent, labInfo } from "../data/labs.js";

export function createVersusScreen(ui) {
  const sidesEl = [h("div", { class: "fs-vs__side is-p1" }), h("div", { class: "fs-vs__side is-p2" })];
  const footer = h("div", { class: "fs-vs__footer" });
  const skip = h("div", { class: "fs-vs__skip" }, "Press confirm or tap to skip");
  const el = h("section", { class: "fs-screen fs-vs", "aria-label": "Versus" },
    h("div", { class: "fs-vs__bg is-p1" }),
    h("div", { class: "fs-vs__bg is-p2" }),
    h("div", { class: "fs-vs__seam", "aria-hidden": "true" }, h("i"), h("i"), h("i")),
    sidesEl[0],
    sidesEl[1],
    h("div", { class: "fs-vs__medal", "aria-hidden": "true" },
      h("img", { src: uiAsset("frames/timer-medallion.png"), alt: "" }),
      h("span", null, "VS")),
    footer,
    skip);

  let timer = 0;
  let done = false;
  el.addEventListener("click", () => go());

  function renderSide(i) {
    const side = ui.session.sides[i];
    const fighters = side.picks.map((id) => ui.fighter(id)).filter(Boolean);
    const label = side.control === "cpu" ? "CPU" : ui.session.matchup === "local" ? `Player ${i + 1}` : "Player 1";
    replace(sidesEl[i],
      h("div", { class: "fs-vs__portraits" }, fighters.map((f, k) => h("div", {
        class: `fs-vs__fighter ${k > 0 ? "is-partner" : ""}`, vars: { lab: fighterAccent(f), delay: `${0.15 + k * 0.18}s` },
      }, portraitImg(f, "fs-vs__img")))),
      h("div", { class: "fs-vs__names" },
        h("span", { class: "fs-vs__who" }, label),
        fighters.map((f) => h("div", { class: "fs-vs__name" },
          h("img", { src: sigilUrl(f.lab), alt: "" }),
          h("strong", null, f.name),
          h("small", null, f.title || labInfo(f.lab).name)))));
  }

  function go() {
    if (done) return;
    done = true;
    clearTimeout(timer);
    ui.show("fight", { fresh: true });
  }

  return {
    el,
    enter() {
      done = false;
      renderSide(0);
      renderSide(1);
      const st = ui.stageInfo(ui.session.stageId);
      const rtw = ui.settings.get().gameplay.roundsToWin;
      replace(footer,
        h("span", null, st?.name || "Arena"),
        h("i", { "aria-hidden": "true" }, "◆"),
        h("span", null, ui.session.mode === "2v2" ? "Tag Team" : "Duel"),
        h("i", { "aria-hidden": "true" }, "◆"),
        h("span", null, `First to ${rtw} round${rtw > 1 ? "s" : ""}`));
      const names = ui.session.sides.map((s) => s.picks.map((id) => ui.fighter(id)?.name).join(" and "));
      ui.say(`${names[0]} versus ${names[1]}`);
      ui.sound("gong");
      el.classList.remove("is-playing");
      void el.offsetWidth;
      el.classList.add("is-playing");
      timer = setTimeout(go, ui.settings.get().accessibility.reduceMotion ? 2200 : 3400);
    },
    leave() { clearTimeout(timer); },
    input(evt) {
      if (evt.action === "confirm" || evt.action === "start") go();
    },
  };
}
