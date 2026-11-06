import { h } from "../core/dom.js";
import { createNav } from "../core/widgets.js";

export function createConfirmOverlay(ui, { title, body, yes = "Yes", no = "Cancel", onYes }) {
  const buttons = [
    h("button", { class: "fs-menu-btn is-compact", type: "button" }, h("span", null, no)),
    h("button", { class: "fs-menu-btn is-compact is-danger", type: "button" }, h("span", null, yes)),
  ];
  const el = h("div", { class: "fs-overlay fs-confirm", role: "alertdialog", "aria-modal": "true", "aria-label": title },
    h("div", { class: "fs-overlay__scrim" }),
    h("div", { class: "fs-panel fs-confirm__panel" },
      h("h2", { class: "fs-panel__title" }, title),
      h("p", { class: "fs-confirm__body" }, body),
      h("div", { class: "fs-confirm__actions" }, buttons)));
  const nav = createNav({ items: [], columns: 2, wrap: true, sound: ui.sound, onConfirm: (i) => run(i) });
  nav.bind(buttons);

  function run(i) {
    if (i === 1) {
      ui.sound("confirm");
      onYes?.();
    } else {
      ui.sound("back");
      ui.closeOverlay();
    }
  }

  return {
    el,
    input(evt) {
      if (evt.action === "left" || evt.action === "right") nav.move(evt.action);
      else if (evt.action === "confirm") run(nav.index);
      else if (evt.action === "back") run(0);
    },
  };
}
