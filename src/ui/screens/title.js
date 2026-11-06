import { h } from "../core/dom.js";
import { uiAsset } from "../core/assets.js";
import { embers, hintBar, icon } from "../core/widgets.js";

export function createTitleScreen(ui) {
  const label = h("span", null, "Press Start");
  const prompt = h("button", { class: "fs-title__start", type: "button" }, label);
  const hints = hintBar(ui, [["confirm", "Start", { noTouch: true }], ["start", "Settings"]]);
  const install = h("button", { class: "fs-chip-btn fs-title__install", type: "button", hidden: true }, icon("controls"), "Play fullscreen");
  const el = h("section", { class: "fs-screen fs-title", "aria-label": "Title screen" },
    h("div", { class: "fs-title__bg", style: { backgroundImage: `url(${uiAsset("backgrounds/title.jpg")})` } }),
    h("div", { class: "fs-title__fog", "aria-hidden": "true" }),
    embers(30),
    h("div", { class: "fs-title__vignette", "aria-hidden": "true" }),
    h("div", { class: "fs-title__center" },
      h("img", { class: "fs-title__logo", src: uiAsset("logo.png"), alt: "Frontier Showdown" }),
      h("p", { class: "fs-title__tagline" }, "The frontier labs settle it in the ring"),
      prompt),
    h("footer", { class: "fs-title__footer" },
      h("span", null, "A parody fighting game. Every fighter is a fictionalised tribute, and no real lab endorses it."),
      install,
      hints));

  let ready = false;
  function go() {
    if (!ready) return;
    ready = false;
    ui.requestFullscreen?.();
    ui.sound("confirm");
    el.classList.add("is-leaving");
    ui.show("mode");
  }
  prompt.addEventListener("click", go);
  install.addEventListener("click", (e) => {
    e.stopPropagation();
    ui.sound("confirm");
    ui.openOverlay("install");
  });

  const syncLabels = () => {
    label.textContent = ui.input.lastDevice === "touch" ? "Tap to Start" : "Press Start";
    install.hidden = !ui.canInstall;
  };
  ui.input.onDevice(syncLabels);
  ui.on("install", syncLabels);

  return {
    el,
    enter() {
      el.classList.remove("is-leaving");
      ui.game.endMatch?.();
      syncLabels();
      setTimeout(() => {
        ready = true;
        if (!ui.overlayOpen) prompt.focus({ preventScroll: true });
      }, 350);
    },
    leave() { ready = false; },
    overlayClosed() { prompt.focus({ preventScroll: true }); },
    input(evt) {
      if (evt.action === "confirm") go();
      else if (evt.action === "start" || evt.action === "info") {
        ui.sound("confirm");
        ui.openOverlay("settings");
      }
    },
  };
}
