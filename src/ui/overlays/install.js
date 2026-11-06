import { h } from "../core/dom.js";
import { createNav } from "../core/widgets.js";
import { isIOS } from "../touch/device.js";

// "Add to Home Screen": the browser's install prompt where one was offered, otherwise iOS steps.
export function createInstallOverlay(ui) {
  const native = Boolean(ui.installPrompt);
  const steps = native
    ? [h("p", null, "Install Frontier Showdown to launch it fullscreen from your home screen, with no browser bars.")]
    : [
      h("p", null, isIOS() ? "Safari can't go fullscreen in a tab. Add the game to your home screen to play without browser bars:" : "Add the game to your home screen to play fullscreen:"),
      h("ol", { class: "fs-install__steps" },
        h("li", null, isIOS() ? "Tap the Share button" : "Open the browser menu"),
        h("li", null, "Choose ", h("b", null, "Add to Home Screen")),
        h("li", null, "Open Frontier Showdown from the new icon")),
    ];
  const buttons = native
    ? [h("button", { class: "fs-menu-btn is-compact", type: "button" }, h("span", null, "Not now")), h("button", { class: "fs-menu-btn is-compact", type: "button" }, h("span", null, "Install"))]
    : [h("button", { class: "fs-menu-btn is-compact", type: "button" }, h("span", null, "Got it"))];
  const el = h("div", { class: "fs-overlay fs-confirm fs-install", role: "dialog", "aria-modal": "true", "aria-label": "Add to Home Screen" },
    h("div", { class: "fs-overlay__scrim" }),
    h("div", { class: "fs-panel fs-confirm__panel" },
      h("h2", { class: "fs-panel__title" }, "Play Fullscreen"),
      h("div", { class: "fs-confirm__body" }, steps),
      h("div", { class: ["fs-confirm__actions", !native && "is-single"] }, buttons)));
  const nav = createNav({ items: [], columns: buttons.length, sound: ui.sound, onConfirm: (i) => run(i) });
  nav.bind(buttons);
  nav.set(buttons.length - 1, true);

  async function run(i) {
    if (native && i === 1) {
      const prompt = ui.installPrompt;
      ui.installPrompt = null;
      ui.closeOverlay();
      try {
        await prompt.prompt();
        await prompt.userChoice;
      } catch { /* dismissed */ }
      ui.emit("install", {});
      return;
    }
    ui.sound("back");
    ui.closeOverlay();
  }

  return {
    el,
    input(evt) {
      if (evt.action === "left" || evt.action === "right") nav.move(evt.action);
      else if (evt.action === "confirm") run(nav.index);
      else if (evt.action === "back" || evt.action === "start") run(0);
    },
  };
}
