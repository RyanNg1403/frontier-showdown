import { h } from "../core/dom.js";

// The fight screen is transparent: the engine's canvas shows through and the HUD sits on top.
export function createFightScreen(ui) {
  const el = h("section", { class: "fs-screen fs-fight", "aria-label": "Fight" });
  let resultsTimer = 0;
  let ended = false;

  function pause() {
    if (ended) return;
    ui.game.pause?.();
    ui.sound("confirm");
    ui.openOverlay("pause");
  }

  return {
    el,
    enter(params = {}) {
      ended = false;
      ui.hud.show();
      ui.input.setContext("fight");
      if (params.fresh) {
        ui.resetStats();
        ui.game.startMatch?.(ui.matchConfig());
      }
    },
    leave() {
      clearTimeout(resultsTimer);
      ui.hud.hide();
      ui.input.setContext("menu");
    },
    overlayClosed() {
      if (!ended) ui.game.resume?.();
    },
    matchEnded(e) {
      if (ui.screen !== "fight" || ended) return;
      ended = true;
      ui.session.result = { winner: e.winner ?? ui.game.state?.winner ?? 0, state: structuredClone(ui.game.state) };
      resultsTimer = setTimeout(() => ui.show("results"), ui.settings.get().accessibility.reduceMotion ? 1800 : 2900);
    },
    input(evt) {
      if (evt.action === "start") pause();
    },
  };
}
