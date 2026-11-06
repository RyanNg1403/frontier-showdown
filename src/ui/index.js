/**
 * Frontier Showdown UI: DOM menus, overlays and fight HUD.
 *
 *   import { mountUI } from "./src/ui/index.js";
 *   const ui = mountUI(document.getElementById("ui-root"), game);
 *
 * The UI reads from `game` (all optional members degrade gracefully):
 *   game.events.on(type, fn)        hit, block, ko, roundStart, roundEnd, tag, special, super,
 *                                   plus optional fightStart, finishThem, comboEnd, matchEnd
 *   game.state                      read-only snapshot, see hud/hud.js for the fields the HUD uses
 *   game.getRoster() | game.roster  character data (contract shape) plus optional `portrait`
 *   game.getStages() | game.stages  [{ id, name, lab?, preview?, description? }]
 *   game.startMatch(config)         config: { mode, matchup, stageId, difficulty, roundTime,
 *                                   roundsToWin, sides: [{ control, player, fighters: [ids] }] }
 *   game.pause() / game.resume() / game.endMatch() / game.applySettings(settings)
 *
 * The UI owns pause (Escape or pad Start during a fight) and screen flow:
 * title > mode > select > stage > versus > fight > results.
 */
import { h } from "./core/dom.js";
import { createSettings } from "./core/settings.js";
import { createMenuInput } from "./core/input.js";
import { createUiAudio } from "./core/audio.js";
import { preload, uiAsset, portraitUrl } from "./core/assets.js";
import { statRanges } from "./core/widgets.js";
import { createHud } from "./hud/hud.js";
import { createTitleScreen } from "./screens/title.js";
import { createModeScreen } from "./screens/mode-select.js";
import { createSelectScreen } from "./screens/character-select.js";
import { createStageScreen } from "./screens/stage-select.js";
import { createVersusScreen } from "./screens/versus.js";
import { createFightScreen } from "./screens/fight.js";
import { createResultsScreen } from "./screens/results.js";
import { createPauseOverlay } from "./overlays/pause.js";
import { createMoveListOverlay } from "./overlays/move-list.js";
import { createSettingsOverlay } from "./overlays/settings.js";
import { createConfirmOverlay } from "./overlays/confirm.js";

export { createHud } from "./hud/hud.js";
export { drawHud } from "./hud/draw-hud.js";
export { DEFAULT_BINDINGS, DEFAULT_SETTINGS } from "./core/settings.js";

const LOGICAL_W = 1280;
const LOGICAL_H = 720;

const SCREENS = {
  title: createTitleScreen, mode: createModeScreen, select: createSelectScreen, stage: createStageScreen,
  versus: createVersusScreen, fight: createFightScreen, results: createResultsScreen,
};
const OVERLAYS = { pause: createPauseOverlay, movelist: createMoveListOverlay, settings: createSettingsOverlay, confirm: createConfirmOverlay };

function listen(game, type, fn) {
  const ev = game?.events;
  if (!ev) return () => {};
  if (typeof ev.on === "function") {
    const off = ev.on(type, fn);
    return typeof off === "function" ? off : () => ev.off?.(type, fn);
  }
  if (typeof ev.addEventListener === "function") {
    const wrapped = (e) => fn(e.detail ?? e);
    ev.addEventListener(type, wrapped);
    return () => ev.removeEventListener(type, wrapped);
  }
  return () => {};
}

export function mountUI(rootEl, game, options = {}) {
  const settings = createSettings(options.settings);
  const input = createMenuInput({ settings });
  const audio = createUiAudio(settings);

  const screensEl = h("div", { class: "fs-ui__screens" });
  const hudEl = h("div", { class: "fs-ui__hud" });
  const overlaysEl = h("div", { class: "fs-ui__overlays" });
  const wipeEl = h("div", { class: "fs-wipe", "aria-hidden": "true" }, h("div", { class: "fs-wipe__blade" }), h("div", { class: "fs-wipe__blade fs-wipe__blade--2" }));
  const live = h("div", { class: "fs-sr-only", "aria-live": "polite", "aria-atomic": "true" });
  const stage = h("div", { class: "fs-ui__stage" }, screensEl, hudEl, overlaysEl, wipeEl, live);
  const root = h("div", { class: "fs-ui", role: "application", "aria-label": "Frontier Showdown" }, stage);
  rootEl.append(root);

  const fit = () => {
    const r = rootEl.getBoundingClientRect();
    const scale = Math.min(r.width / LOGICAL_W, r.height / LOGICAL_H) || 1;
    stage.style.setProperty("--fs-scale", scale);
  };
  const ro = new ResizeObserver(fit);
  ro.observe(rootEl);
  fit();

  const screens = {};
  const overlayStack = [];
  const subscribers = new Map();
  let current = null;
  let currentId = null;
  let transitioning = false;

  const ui = {
    game, settings, input, audio, root, stage, live,
    session: { mode: "1v1", matchup: "cpu", sides: [], stageId: null, stats: null },
    get roster() { return game.getRoster?.() ?? game.roster ?? []; },
    get stages() { return game.getStages?.() ?? game.stages ?? []; },
    get ranges() { return statRanges(ui.roster); },
    fighter(id) { return ui.roster.find((f) => f.id === id); },
    stageInfo(id) { return ui.stages.find((s) => s.id === id); },
    sound(name) { audio.play(name); },
    say(text) { live.textContent = text; },
    show,
    openOverlay,
    closeOverlay,
    closeAllOverlays() { while (overlayStack.length) closeOverlay(true); },
    get screen() { return currentId; },
    emit(type, payload) { subscribers.get(type)?.forEach((fn) => fn(payload)); },
    matchConfig,
  };

  ui.hud = createHud(hudEl, ui);

  function getScreen(id) {
    if (!screens[id]) {
      screens[id] = SCREENS[id](ui);
      screens[id].el.dataset.screen = id;
    }
    return screens[id];
  }

  async function show(id, params = {}) {
    if (transitioning && !params.force) return;
    transitioning = true;
    const next = getScreen(id);
    const reduce = settings.get().accessibility.reduceMotion;
    const animate = current && !params.instant;
    if (animate) {
      wipeEl.classList.remove("is-wiping", "is-fading");
      void wipeEl.offsetWidth;
      wipeEl.classList.add(reduce ? "is-fading" : "is-wiping");
      if (!reduce) audio.play("whoosh");
      await new Promise((r) => setTimeout(r, reduce ? 160 : 300));
    }
    const prev = current;
    const prevId = currentId;
    if (prev) {
      prev.leave?.(id);
      prev.el.classList.remove("is-active");
      prev.el.remove();
    }
    current = next;
    currentId = id;
    screensEl.append(next.el);
    next.el.classList.add("is-active");
    root.dataset.screen = id;
    next.enter?.(params, prevId);
    ui.emit("screen", { id, from: prevId });
    // Accept input once the new screen is in place; the rest of the wipe is cosmetic.
    if (animate) await new Promise((r) => setTimeout(r, 120));
    transitioning = false;
  }

  function openOverlay(id, params = {}) {
    const ov = OVERLAYS[id](ui, params);
    overlaysEl.append(ov.el);
    overlayStack.push(ov);
    requestAnimationFrame(() => ov.el.classList.add("is-open"));
    ov.enter?.(params);
    input.setContext("menu");
    return ov;
  }

  function closeOverlay(instant = false) {
    const ov = overlayStack.pop();
    if (!ov) return;
    ov.leave?.();
    ov.el.classList.remove("is-open");
    if (instant) ov.el.remove();
    else setTimeout(() => ov.el.remove(), 220);
    if (!overlayStack.length) {
      current?.overlayClosed?.();
      if (currentId === "fight") input.setContext("fight");
    } else overlayStack.at(-1).resume?.();
  }

  input.on((evt) => {
    if (transitioning) return;
    const target = overlayStack.at(-1) || current;
    target?.input?.(evt);
  });

  function matchConfig() {
    const s = ui.session;
    const g = settings.get().gameplay;
    return {
      mode: s.mode, matchup: s.matchup, stageId: s.stageId, difficulty: g.difficulty,
      roundTime: g.roundTime, roundsToWin: g.roundsToWin,
      sides: s.sides.map((side) => ({ control: side.control, player: side.player, fighters: [...side.picks] })),
    };
  }

  // Match statistics for the results screen, collected from engine events.
  const resetStats = () => {
    ui.session.stats = { startedAt: performance.now(), sides: [0, 1].map(() => ({ damage: 0, maxCombo: 0, specials: 0, supers: 0, perfects: 0, tags: 0 })) };
  };
  ui.resetStats = resetStats;
  resetStats();
  const offs = [
    listen(game, "hit", (e) => {
      const st = ui.session.stats.sides[e.side ?? 0];
      if (!st) return;
      st.damage += e.damage || 0;
      st.maxCombo = Math.max(st.maxCombo, (typeof e.combo === "number" ? e.combo : e.combo?.hits) || 1);
    }),
    listen(game, "special", (e) => { const st = ui.session.stats.sides[e.side ?? 0]; if (st) st.specials++; }),
    listen(game, "super", (e) => { const st = ui.session.stats.sides[e.side ?? 0]; if (st) st.supers++; }),
    listen(game, "tag", (e) => { const st = ui.session.stats.sides[e.side ?? 0]; if (st) st.tags++; }),
    listen(game, "roundEnd", (e) => { if (e.perfect) { const st = ui.session.stats.sides[e.winner]; if (st) st.perfects++; } }),
  ];
  for (const type of ["hit", "block", "ko", "roundStart", "roundEnd", "tag", "special", "super", "fightStart", "finishThem", "comboEnd", "matchEnd"]) {
    offs.push(listen(game, type, (e) => ui.hud.onEvent(type, e || {})));
  }
  offs.push(listen(game, "matchEnd", (e) => screens.fight?.matchEnded?.(e || {})));

  const applySettings = (value) => {
    root.classList.toggle("is-reduced-motion", !!value.accessibility.reduceMotion);
    root.classList.toggle("is-reduced-flash", !!value.accessibility.reduceFlashes);
    game.applySettings?.(value);
  };
  settings.subscribe(applySettings);
  applySettings(settings.get());

  preload([uiAsset("logo.png"), uiAsset("backgrounds/title.jpg"), uiAsset("frames/portrait-frame.png"), uiAsset("frames/timer-medallion.png")]);
  queueMicrotask(() => preload(ui.roster.map(portraitUrl)));

  show(options.initialScreen || "title", options.initialParams || {});

  return {
    show: (id, params) => show(id, { force: true, ...params }),
    openOverlay,
    closeOverlay,
    hud: ui.hud,
    settings,
    session: ui.session,
    get screen() { return currentId; },
    on(type, fn) {
      if (!subscribers.has(type)) subscribers.set(type, new Set());
      subscribers.get(type).add(fn);
      return () => subscribers.get(type).delete(fn);
    },
    destroy() {
      offs.forEach((off) => off());
      ro.disconnect();
      input.destroy();
      ui.hud.destroy();
      root.remove();
    },
    /** Exposed for the preview page and tests. */
    _ui: ui,
  };
}
