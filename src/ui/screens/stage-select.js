import { h, replace, pulseClass } from "../core/dom.js";
import { sigilUrl } from "../core/assets.js";
import { createNav, embers, hintBar, screenHeader } from "../core/widgets.js";
import { labInfo } from "../data/labs.js";

const RANDOM = { id: "__random", name: "Random Stage", description: "Let fate pick the arena.", lab: "Independent" };

export function createStageScreen(ui) {
  const hero = h("div", { class: "fs-stage-hero" });
  const strip = h("div", { class: "fs-stage-strip", role: "listbox", "aria-label": "Stages" });
  const hints = hintBar(ui, [["adjust", "Browse"], ["confirm", "Fight here"], ["info", "Random"], ["back", "Back"]]);
  const el = h("section", { class: "fs-screen fs-stagesel fs-bg", "aria-label": "Stage select" },
    embers(10),
    screenHeader("Select Arena"),
    hero,
    strip,
    hints);

  let list = [];
  let nav = null;
  let chosen = false;

  function renderHero(st) {
    const lab = labInfo(st.lab);
    const isRandom = st.id === RANDOM.id;
    hero.style.setProperty("--lab", lab.color);
    replace(hero,
      h("div", { class: "fs-stage-hero__img", style: isRandom ? null : { backgroundImage: `url(${st.preview})` } },
        isRandom ? h("span", { class: "fs-stage-hero__q" }, "?") : null),
      h("div", { class: "fs-stage-hero__frame", "aria-hidden": "true" }),
      h("div", { class: "fs-stage-hero__info" },
        h("div", { class: "fs-stage-hero__lab" }, h("img", { src: sigilUrl(st.lab), alt: "" }), lab.name),
        h("h2", null, st.name),
        h("p", null, st.description || "")),
      h("div", { class: "fs-stage-hero__count" }, isRandom ? "" : `${list.indexOf(st) + 1} / ${list.length - 1}`));
    pulseClass(hero, "is-swapping");
  }

  function choose(idx) {
    if (chosen) return;
    let st = list[idx];
    if (st.id === RANDOM.id) {
      const real = list.filter((s) => s.id !== RANDOM.id);
      st = real[Math.floor(Math.random() * real.length)];
      nav.set(list.indexOf(st), true);
    }
    chosen = true;
    ui.session.stageId = st.id;
    ui.sound("lock");
    pulseClass(hero, "is-chosen");
    setTimeout(() => ui.show("versus"), 520);
  }

  return {
    el,
    enter() {
      chosen = false;
      list = [...ui.stages, RANDOM];
      const thumbs = list.map((st) => h("button", { class: "fs-stage-thumb", type: "button", role: "option", "aria-label": st.name },
        st.id === RANDOM.id
          ? h("span", { class: "fs-stage-thumb__img is-random" }, "?")
          : h("span", { class: "fs-stage-thumb__img", style: { backgroundImage: `url(${st.preview})` } }),
        h("span", { class: "fs-stage-thumb__name" }, st.name)));
      replace(strip, thumbs);
      const start = Math.max(0, list.findIndex((s) => s.id === ui.session.stageId));
      nav = createNav({ items: [], columns: list.length, index: start, sound: ui.sound, onChange: (i) => renderHero(list[i]), onConfirm: (i) => choose(i), touchPreview: true });
      nav.bind(thumbs);
    },
    input(evt) {
      if (chosen) return;
      if (evt.action === "left" || evt.action === "right") nav.move(evt.action);
      else if (evt.action === "confirm") choose(nav.index);
      else if (evt.action === "info") choose(list.length - 1);
      else if (evt.action === "back") {
        ui.sound("back");
        ui.show("select");
      }
    },
  };
}
