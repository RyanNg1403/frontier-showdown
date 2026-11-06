import { createGame } from "./engine/game.js";
import { loadManifest } from "./engine/modules.js";

function linkStylesheet(href) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

/** `?quick&mode=&p1=&p2=&p1c=&p2c=&d=&stage=`: start a match and go straight to the fight screen. */
async function quickStart(game, params) {
  const mode = params.get("mode") === "2v2" ? "2v2" : "1v1";
  const team = (key, fallback) => (params.get(key) || fallback).split(",");
  const sides = [
    { team: team("p1", mode === "2v2" ? "sam,dario" : "sam"), control: params.get("p1c") || "human" },
    { team: team("p2", mode === "2v2" ? "dario,sam" : "dario"), control: params.get("p2c") || "cpu" },
  ];
  const difficulty = params.get("d") || "normal";
  const stage = params.get("stage") || undefined;
  await game.startMatch({ mode, stage, sides: sides.map((s) => ({ ...s, difficulty })) });
  const ui = game.ui;
  if (!ui) return;
  const humans = sides.filter((s) => s.control === "human").length;
  Object.assign(ui.session, {
    mode,
    matchup: humans === 2 ? "local" : humans === 1 ? "cpu" : "cpuvcpu",
    stageId: game.state.stage,
    sides: sides.map((s, i) => ({ control: s.control, player: s.control === "human" ? i : null, picks: [...s.team] })),
  });
  ui._ui?.resetStats?.();
  await ui.show("fight", { instant: true });
}

async function boot() {
  const canvas = document.getElementById("game");
  const uiRoot = document.getElementById("ui-root");
  try {
    const manifest = await loadManifest();
    if (!manifest || manifest.styles?.ui) linkStylesheet("/styles/ui.css");
    const game = await createGame({ canvas, uiRoot, manifest });
    window.frontierShowdown = game;
    const params = new URLSearchParams(location.search);
    if (params.has("quick")) await quickStart(game, params);
  } catch (error) {
    console.error(error);
    const el = document.getElementById("boot-error");
    el.style.display = "grid";
    el.textContent = `Frontier Showdown failed to start: ${error.message}`;
  }
}

boot();
