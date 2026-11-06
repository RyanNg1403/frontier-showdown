import { createGame } from "./engine/game.js";
import { SITE_ROOT, assetUrl, loadManifest } from "./platform/assets.js";
import { createLoadingScreen } from "./platform/loading.js";
import { createQuality } from "./platform/quality.js";
import { createStorage } from "./platform/storage.js";
import { createProgress } from "./platform/progress.js";
import { registerServiceWorker } from "./platform/sw-register.js";

function linkStylesheet(href) {
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = link.onerror = resolve;
    document.head.appendChild(link);
  });
}

async function offerResume(game, progress) {
  const cp = await progress.pendingResume();
  const ui = game.ui;
  if (!cp || !ui?.openOverlay) return;
  let resumed = false;
  const [title, detail] = progress.describe(cp).split("\n");
  const overlay = ui.openOverlay("confirm", {
    title: "Resume your match?",
    body: `${title}. ${detail}.`,
    yes: "Resume",
    no: "Discard",
    onYes() {
      resumed = true;
      ui.closeOverlay(true);
      const session = ui.session;
      session.mode = cp.config.mode;
      session.stageId = cp.config.stage;
      session.sides = cp.config.sides.map((s) => ({ control: s.control, player: s.player ?? null, picks: [...s.team] }));
      ui._ui?.resetStats?.();
      ui.show("fight", { instant: true });
      progress.resume(cp).catch((error) => console.error("[resume] failed", error));
    },
  });
  const leave = overlay?.leave;
  if (overlay) {
    overlay.leave = () => {
      leave?.();
      if (!resumed) progress.discardResume();
    };
  }
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
  const loading = createLoadingScreen();
  try {
    loading.set(0.1, "Loading game data");
    const manifest = await loadManifest();
    const css = !manifest || manifest.styles?.ui ? linkStylesheet(assetUrl("styles/ui.css")) : Promise.resolve();
    const quality = createQuality();
    const storage = createStorage();
    const game = await createGame({ canvas, uiRoot, manifest, quality, onProgress: (p, label) => loading.set(0.1 + p * 0.85, label) });
    await css;
    window.frontierShowdown = game;
    game.version = manifest?.version || "dev";
    loading.attach(game);
    const progress = createProgress(game, storage);
    game.progress = progress;
    progress.restoreMenus(game.ui);
    loading.hide();
    if (manifest?.build) registerServiceWorker(new URL("sw.js", SITE_ROOT), SITE_ROOT.pathname);
    const params = new URLSearchParams(location.search);
    if (params.has("quick")) await quickStart(game, params);
    else await offerResume(game, progress);
  } catch (error) {
    console.error(error);
    loading.hide();
    const el = document.getElementById("boot-error");
    el.style.display = "grid";
    el.textContent = `Frontier Showdown failed to start: ${error.message}`;
  }
}

boot();
