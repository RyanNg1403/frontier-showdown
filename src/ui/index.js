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
import { createInstallOverlay } from "./overlays/install.js";
import { createTouchControls } from "./touch/touch-controls.js";
import { canFullscreen, enterFullscreen, fitScreen, hasTouch, isIOS, isStandalone } from "./touch/device.js";

export { createHud } from "./hud/hud.js";
export { drawHud } from "./hud/draw-hud.js";
export { DEFAULT_BINDINGS, DEFAULT_SETTINGS } from "./core/settings.js";

const LOGICAL_W = 1280;
const LOGICAL_H = 720;

const SCREENS = {
  title: createTitleScreen, mode: createModeScreen, select: createSelectScreen, stage: createStageScreen,
  versus: createVersusScreen, fight: createFightScreen, results: createResultsScreen,
};
const OVERLAYS = { pause: createPauseOverlay, movelist: createMoveListOverlay, settings: createSettingsOverlay, confirm: createConfirmOverlay, install: createInstallOverlay };
// Below this stage scale (about 1024x576 CSS px) menus switch to larger type and touch-sized targets.
const COMPACT_SCALE = 0.8;

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
  if (game?.audio?.announce) {
    // The audio module already voices every announcement from engine events, so the HUD's
    // speech fallback would double it; only the settings test line plays, through the module.
    const voice = game.audio;
    audio.announce = (text, opts) => {
      if (!opts?.test) return;
      voice.announce("announcer.round-1", { interrupt: true });
      voice.announce("announcer.fight");
    };
  }
  if (game?.audio?.play) {
    // Menu and HUD cues play the audio module's recorded sounds instead of the oscillator fallback.
    const sfx = game.audio;
    const cues = {
      move: ["ui.move"],
      confirm: ["ui.confirm"],
      back: ["ui.back"],
      error: ["ui.back", { pitch: -5 }],
      lock: ["ui.lock"],
      whoosh: ["whoosh.medium", { gainDb: -8 }],
      gong: ["stinger.tag", { gainDb: -3 }],
      tick: ["ui.move", { pitch: 4, volume: 0.6 }],
    };
    audio.play = (name) => {
      const cue = cues[name];
      if (cue) sfx.play(cue[0], { variation: 0.5, ...cue[1] });
    };
  }

  const screensEl = h("div", { class: "fs-ui__screens" });
  const hudEl = h("div", { class: "fs-ui__hud" });
  const overlaysEl = h("div", { class: "fs-ui__overlays" });
  const wipeEl = h("div", { class: "fs-wipe", "aria-hidden": "true" }, h("div", { class: "fs-wipe__blade" }), h("div", { class: "fs-wipe__blade fs-wipe__blade--2" }));
  const live = h("div", { class: "fs-sr-only", "aria-live": "polite", "aria-atomic": "true" });
  const stage = h("div", { class: "fs-ui__stage" }, screensEl, hudEl, overlaysEl, wipeEl, live);
  const root = h("div", { class: "fs-ui", role: "application", "aria-label": "Frontier Showdown" }, stage);
  rootEl.append(root);

  const screenEl = rootEl.parentElement?.id === "screen" ? rootEl.parentElement : null;
  const touchDevice = hasTouch();
  root.classList.toggle("is-lite", touchDevice);
  const fit = () => {
    const r = rootEl.getBoundingClientRect();
    const scale = Math.min(r.width / LOGICAL_W, r.height / LOGICAL_H) || 1;
    stage.style.setProperty("--fs-scale", scale);
    root.classList.toggle("is-compact", scale < COMPACT_SCALE);
  };
  const ro = new ResizeObserver(fit);
  ro.observe(rootEl);
  fit();
  const fitBox = () => { if (screenEl) fitScreen(screenEl); };
  let fitRaf = 0;
  const onViewport = () => { cancelAnimationFrame(fitRaf); fitRaf = requestAnimationFrame(fitBox); };
  fitBox();
  window.addEventListener("resize", onViewport);
  window.visualViewport?.addEventListener("resize", onViewport);
  screen.orientation?.addEventListener?.("change", onViewport);
  const rotate = createRotatePrompt();

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
    get overlayOpen() { return overlayStack.length > 0; },
    emit(type, payload) { subscribers.get(type)?.forEach((fn) => fn(payload)); },
    on(type, fn) {
      if (!subscribers.has(type)) subscribers.set(type, new Set());
      subscribers.get(type).add(fn);
      return () => subscribers.get(type).delete(fn);
    },
    matchConfig,
    touchDevice,
    /** Fullscreen plus landscape lock on phones and tablets; call from a tap or key press. */
    requestFullscreen() {
      if (!touchDevice || isStandalone() || !canFullscreen() || !settings.get().touch.fullscreen) return;
      enterFullscreen();
    },
    installPrompt: null,
    get canInstall() { return Boolean(ui.installPrompt) || (isIOS() && !isStandalone()); },
  };

  ui.hud = createHud(hudEl, ui);
  ui.touch = createTouchControls(ui);
  const syncDevice = (device) => root.classList.toggle("is-touch-ui", device === "touch");
  syncDevice(input.lastDevice);
  input.onDevice(syncDevice);
  const onTouchDown = (e) => { if (e.pointerType === "touch") input.setDevice("touch"); };
  window.addEventListener("pointerdown", onTouchDown, true);
  const onInstallPrompt = (e) => {
    e.preventDefault();
    ui.installPrompt = e;
    ui.emit("install", {});
  };
  window.addEventListener("beforeinstallprompt", onInstallPrompt);

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
    ui.touch.setFight(id === "fight");
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
    ui.touch.setOverlay(true);
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
      ui.touch.setOverlay(false);
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
  for (const type of ["hit", "block", "ko", "lastStanding", "roundStart", "roundEnd", "tag", "special", "super", "fightStart", "finishThem", "comboEnd", "matchEnd"]) {
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
    on: ui.on,
    touch: ui.touch,
    destroy() {
      offs.forEach((off) => off());
      ro.disconnect();
      window.removeEventListener("resize", onViewport);
      window.removeEventListener("pointerdown", onTouchDown, true);
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      ui.touch.destroy();
      rotate.remove();
      input.destroy();
      ui.hud.destroy();
      root.remove();
    },
    /** Exposed for the preview page and tests. */
    _ui: ui,
  };
}

/** Portrait prompt on phones and tablets (CSS decides when it shows). */
function createRotatePrompt() {
  const keep = h("button", { class: "fs-rotate__keep", type: "button" }, "Continue in portrait");
  const el = h("div", { class: "fs-rotate", role: "alertdialog", "aria-label": "Rotate your device" },
    h("div", { class: "fs-rotate__phone", "aria-hidden": "true" }, h("i")),
    h("strong", null, "Rotate to landscape"),
    h("p", null, "Frontier Showdown plays best sideways."),
    keep);
  keep.addEventListener("click", () => document.body.classList.add("fs-portrait-ok"));
  document.body.append(el);
  return el;
}
