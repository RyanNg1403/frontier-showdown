import { DT } from "../combat/constants.js";
import { Match } from "../combat/match.js";
import { createCpu } from "../combat/ai.js";
import { describeCharacter } from "../characters/schema.js";
import { discoverCharacters, loadAllCharacters } from "../characters/index.js";
import { createEmitter } from "./emitter.js";
import { Camera, VIEW_H, VIEW_W } from "./camera.js";
import { InputDevices } from "./input.js";
import { createLoop } from "./loop.js";
import { assetApi, loadAtlas } from "./assets.js";
import { loadManifest, loadModules } from "./modules.js";
import { createFallbackVfx, drawBarrier, drawDebug, drawFallbackHud, drawFallbackStage, drawFighter, drawProjectileFallback, drawShadow } from "./render.js";
import { mountFallbackUI } from "./fallback-ui.js";
import { adaptVfx } from "./vfx-adapter.js";
import { SCREEN_MUSIC, applyUiSettings, decorateEvent, decorateSnapshot, normalizeMatchConfig, uiRoster, uiStages } from "./ui-adapter.js";
import { adaptStageDef, listModuleStages, stageCamera } from "./stage-adapter.js";

const DEFAULT_STAGES = [{ id: "default", name: "Training Lab" }];

function deepFreeze(o) {
  if (o && typeof o === "object" && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

/**
 * Wraps calls into an optional module. After the first exception the module is dropped
 * and the engine stub takes over, so a broken sibling module can't take the game down.
 */
function guarded(label, onFail) {
  let failed = false;
  return (fn) => {
    if (failed) return onFail();
    try {
      return fn();
    } catch (error) {
      failed = true;
      console.error(`[engine] ${label} module threw; switching to the built-in stub.`, error);
      return onFail();
    }
  };
}

export async function createGame({ canvas, uiRoot, modules: preloaded = null, manifest = undefined } = {}) {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const events = createEmitter();
  const devices = new InputDevices(window);
  const info = manifest === undefined ? await loadManifest() : manifest;
  const modules = preloaded || (await loadModules(info));
  const roster = await discoverCharacters();
  const characters = await loadAllCharacters(roster.ids);
  const charMap = new Map(characters.map((c) => [c.id, c]));
  const atlasReady = new Map();
  const hasAtlasFile = (id) => !roster.atlases || roster.atlases.has(id);
  const fetchAtlas = (id) => (hasAtlasFile(id) ? loadAtlas(id) : Promise.resolve(null));
  const atlases = {};
  await Promise.all(characters.map((c) => fetchAtlas(c.id).then((a) => {
    atlasReady.set(c.id, Boolean(a));
    if (a) atlases[c.id] = a;
  })));

  const fallbackVfx = createFallbackVfx();
  let vfx = fallbackVfx;
  if (modules.vfx) {
    try {
      let vfxAssets = assetApi;
      if (typeof modules.vfx.loadVfxAssets === "function") {
        vfxAssets = await modules.vfx.loadVfxAssets("/assets/vfx/").then((a) => ({ ...assetApi, ...a })).catch(() => assetApi);
      }
      const instance = modules.vfx.createVfx(ctx, vfxAssets);
      vfx = instance ? adaptVfx(modules.vfx, instance) : fallbackVfx;
    } catch (error) {
      console.error("[engine] createVfx failed; using built-in sparks.", error);
    }
  }
  const vfxCall = guarded("vfx", () => {
    vfx = fallbackVfx;
    return undefined;
  });
  let stageFailed = !modules.stage;
  const stageCall = guarded("stage", () => {
    stageFailed = true;
    return undefined;
  });
  let audio = null;
  if (modules.audio) {
    try {
      audio = modules.audio.createAudio();
    } catch (error) {
      console.error("[engine] createAudio failed; continuing without sound.", error);
    }
  }
  const audioCall = guarded("audio", () => {
    audio = null;
    return undefined;
  });
  /** VFX timing helpers (hitstop, freeze, shake, slow-mo) when the VFX module provides them. */
  const fx = () => (vfx !== fallbackVfx ? vfx.module : null);
  let holdFrames = 0;
  const uiOptions = { screenShake: true, gameplay: null };
  let uiInstance = null;
  let sidePlayers = [0, 1];
  let lastShake = 0;
  let hudFailed = !modules.ui?.drawHud;
  let uiMounted = false;
  let domHud = false;
  const hudCall = guarded("ui", () => {
    hudFailed = true;
    return undefined;
  });

  const camera = new Camera();
  let match = null;
  let lastConfig = null;
  const DEFAULT_STAGE = adaptStageDef("default", { name: "Training Lab" });
  let stageDef = DEFAULT_STAGE;
  let paused = false;
  let debug = false;
  let loading = false;
  let snapshot = deepFreeze({ phase: "menu", paused: false, sides: [], fighters: [], announce: null, winner: null });
  let music = null;

  function onMatchEvent(name, payload) {
    if (name === "vfx") {
      vfxCall(() => vfx.spawn(payload.type, payload.x, payload.y, payload.opts));
      return;
    }
    if (name === "tick") {
      vfxCall(() => vfx.update(payload.dt));
      return;
    }
    if (name === "slowmo" && payload.active && fx()?.slowmo) vfxCall(() => fx().slowmo(payload.rate, payload.seconds));
    events.emit(name, decorateEvent(name, payload));
    if (name === "finishThem" && uiInstance?.hud?.announce) {
      setTimeout(() => {
        uiInstance.hud.clearAnnouncer?.();
        uiInstance.hud.announce("Final Commit!", "finish");
      }, 0);
    }
  }

  function buildSnapshot() {
    if (!match) {
      return { phase: loading ? "loading" : "menu", paused: false, sides: [], fighters: [], announce: null, winner: null, stage: stageDef.id, camera: camera.toJSON() };
    }
    return decorateSnapshot({ ...match.snapshot(), paused, camera: camera.toJSON() }, charMap);
  }

  function refreshSnapshot() {
    snapshot = deepFreeze(buildSnapshot());
  }

  async function loadStageDef(id) {
    if (!modules.stage?.loadStage || stageFailed) return DEFAULT_STAGE;
    try {
      return adaptStageDef(id, await modules.stage.loadStage(id));
    } catch (error) {
      console.error(`[engine] loadStage("${id}") failed; using the training stage.`, error);
      return DEFAULT_STAGE;
    }
  }

  function playMusic(url) {
    stopMusic();
    if (!url || audio) return;
    try {
      music = new Audio(url);
      music.loop = true;
      music.volume = 0.35;
      music.play().catch(() => {});
    } catch {
      music = null;
    }
  }

  function stopMusic() {
    if (music) {
      music.pause();
      music = null;
    }
  }

  async function startMatch(rawConfig = {}) {
    const config = normalizeMatchConfig(rawConfig);
    const mode = config.mode === "2v2" ? "2v2" : "1v1";
    const fallbackIds = characters.map((c) => c.id);
    const sides = [0, 1].map((i) => {
      const s = config.sides?.[i] || {};
      let team = (s.team || []).filter((id) => charMap.has(id));
      const need = mode === "2v2" ? 2 : 1;
      while (team.length < need) team.push(fallbackIds[(i + team.length) % fallbackIds.length]);
      team = team.slice(0, need);
      return { team, control: s.control === "cpu" ? "cpu" : s.control === "human" ? "human" : i === 0 ? "human" : "cpu", difficulty: s.difficulty || "normal", player: Number.isInteger(s.player) ? s.player : i };
    });
    lastConfig = { ...config, mode, sides };
    sidePlayers = sides.map((s) => s.player);
    loading = true;
    paused = false;
    match = null;
    vfx.clearProjectiles?.();
    refreshSnapshot();
    const stageId = config.stage || listStages()[0]?.id || "default";
    const [stage, atlases] = await Promise.all([
      loadStageDef(stageId),
      Promise.all(sides.flatMap((s) => s.team).map(async (id) => [id, await fetchAtlas(id)])),
    ]);
    stageDef = stage;
    loading = false;
    match = new Match({
      mode,
      stage: stage.id,
      bounds: stage.bounds,
      roundsToWin: config.roundsToWin ?? 2,
      timer: config.timer ?? null,
      backBlocks: Boolean(config.backBlocks),
      atlases: new Map(atlases.filter(([, a]) => a)),
      emit: onMatchEvent,
      seed: (Date.now() & 0xffff) | 1,
      sides: sides.map((s, i) => ({
        team: s.team.map((id) => charMap.get(id)),
        control: s.control,
        difficulty: s.difficulty,
        cpu: s.control === "cpu" ? createCpu(s.difficulty, 101 + i * 17 + (Date.now() & 0xff)) : null,
      })),
    });
    match.start();
    camera.snap([match.point(0), match.point(1)], match.bounds);
    playMusic(stage.music);
    refreshSnapshot();
    return snapshot;
  }

  function listCharacters() {
    return characters.map((c) => describeCharacter(c, atlasReady.get(c.id) || false));
  }

  function listStages() {
    if (modules.stage && !stageFailed) {
      try {
        const list = listModuleStages(modules.stage);
        if (list) return list;
      } catch (error) {
        console.error("[engine] listStages failed", error);
      }
    }
    return DEFAULT_STAGES;
  }

  function pause() {
    if (!match || paused || match.phase === "matchEnd") return;
    paused = true;
    music?.pause();
    refreshSnapshot();
    events.emit("pause", {});
  }

  function resume() {
    if (!paused) return;
    paused = false;
    music?.play().catch(() => {});
    refreshSnapshot();
    events.emit("resume", {});
  }

  function togglePause() {
    if (paused) resume();
    else pause();
  }

  function rematch() {
    if (lastConfig) return startMatch(lastConfig);
    return Promise.resolve(snapshot);
  }

  function quitToMenu() {
    match = null;
    vfx.clearProjectiles?.();
    paused = false;
    stopMusic();
    refreshSnapshot();
    events.emit("menu", {});
    if (audio) audioCall(() => audio.music("menu"));
  }

  devices.onKey((code) => {
    if (code === "Escape" && !uiMounted) togglePause();
    if (code === "F1") debug = !debug;
  });

  function step() {
    if ((devices.startPressed(0) || devices.startPressed(1)) && !uiMounted) togglePause();
    if (!match || paused) {
      loop.timeScale = 1;
      return;
    }
    const inputs = match.sides.map((s) => (s.control === "human" ? devices.read(sidePlayers[s.side] ?? s.side) : null));
    const helpers = fx();
    const vfxHold = Boolean(helpers && vfxCall(() => helpers.isHitstopped?.() || helpers.isFrozen?.()));
    holdFrames = vfxHold ? holdFrames + 1 : 0;
    match.step(inputs, { hold: vfxHold && holdFrames <= 90 });
    if (helpers?.timeScale) loop.timeScale = vfxCall(() => helpers.timeScale()) ?? 1;
    else loop.timeScale = match.slowmo ? match.slowmo.rate : 1;
    if (match.shakeFrames > lastShake && helpers?.shake && uiOptions.screenShake) vfxCall(() => helpers.shake(Math.min(12, match.shakeFrames), match.shakeFrames));
    lastShake = match.shakeFrames;
    if (vfx.syncProjectiles) {
      vfxCall(() => vfx.syncProjectiles(match.projectiles.map((p) => ({ id: p.id, x: p.x, y: p.y, facing: p.facing, labId: p.owner.def.labId, scale: p.category === "super" ? 1.6 : 1 }))));
    }
    const targets = [match.point(0), match.point(1)].filter((f) => f.onField && f.state !== "bench");
    const offset = helpers?.getShakeOffset ? vfxCall(() => helpers.getShakeOffset()) : null;
    if (uiOptions.screenShake) camera.update(targets, match.bounds, match.shakeFrames, Math.random, offset || null);
    else camera.update(targets, match.bounds, 0, Math.random, { x: 0, y: 0 });
    if (!stageFailed && modules.stage?.updateStage) stageCall(() => modules.stage.updateStage(DT, snapshot));
    refreshSnapshot();
  }

  function drawStage(layer) {
    if (!stageFailed && modules.stage) {
      ctx.save();
      stageCall(() => modules.stage.drawStage(ctx, stageCamera(stageDef, camera), layer));
      ctx.restore();
      if (!stageFailed) return;
    }
    drawFallbackStage(ctx, camera, layer, stageDef.bounds);
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    drawStage("back");
    ctx.save();
    vfxCall(() => vfx.draw(ctx, camera, "back"));
    ctx.restore();
    if (match) {
      const order = [...match.fighters].sort((a, b) => {
        const rank = (f) => (f.assistMode ? 0 : f.isLying || f.ko ? 1 : f.state === "attack" || f.state === "throwing" ? 3 : 2);
        return rank(a) - rank(b);
      });
      ctx.save();
      camera.apply(ctx);
      for (const f of order) drawShadow(ctx, f);
      const t = performance.now();
      for (const w of match.barriers) drawBarrier(ctx, w, t);
      for (const f of order) drawFighter(ctx, f);
      ctx.restore();
      const now = performance.now();
      for (const p of match.projectiles) {
        const view = { id: p.id, x: p.x, y: p.y, vx: p.vx, facing: p.facing, vfx: p.vfx, ownerId: p.ownerId, side: p.side, age: p.age, palette: p.palette };
        let drawn = false;
        if (vfx.drawProjectile) {
          ctx.save();
          drawn = vfxCall(() => vfx.drawProjectile(ctx, camera, view)) === true;
          ctx.restore();
        }
        if (!drawn) {
          ctx.save();
          camera.apply(ctx);
          drawProjectileFallback(ctx, p, now);
          ctx.restore();
        }
      }
    }
    drawStage("front");
    ctx.save();
    vfxCall(() => vfx.draw(ctx, camera, "front"));
    ctx.restore();
    if (match && debug) {
      ctx.save();
      camera.apply(ctx);
      drawDebug(ctx, match);
      ctx.restore();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (domHud) return;
    if (!hudFailed) {
      ctx.save();
      hudCall(() => modules.ui.drawHud(ctx, snapshot));
      ctx.restore();
    }
    if (hudFailed) drawFallbackHud(ctx, snapshot);
  }

  const loop = createLoop({ step, render });

  function endMatch() {
    match = null;
    paused = false;
    loop.timeScale = 1;
    vfx.clearProjectiles?.();
    refreshSnapshot();
    events.emit("matchClosed", {});
  }

  const game = {
    events,
    getRoster: () => uiRoster(listCharacters()),
    get roster() {
      return uiRoster(listCharacters());
    },
    getStages: () => uiStages(listStages()),
    get stages() {
      return uiStages(listStages());
    },
    endMatch,
    applySettings: (settings) => applyUiSettings(settings, { devices, audio, options: uiOptions }),
    get state() {
      return snapshot;
    },
    get match() {
      return match;
    },
    get modules() {
      return { stage: Boolean(modules.stage) && !stageFailed, vfx: vfx !== fallbackVfx, ui: Boolean(modules.ui), audio: Boolean(audio) };
    },
    camera,
    canvas,
    get audio() {
      return audio;
    },
    bindings: devices.bindings,
    refreshBindings: () => devices.refreshBound(),
    listCharacters,
    listStages,
    startMatch,
    pause,
    resume,
    togglePause,
    rematch,
    quitToMenu,
    setDebug(v) {
      debug = Boolean(v);
    },
    loop,
  };

  if (modules.ui?.mountUI) {
    try {
      uiInstance = await modules.ui.mountUI(uiRoot, game);
      uiMounted = true;
      domHud = Boolean(uiInstance?.hud);
      if (audio && typeof uiInstance?.on === "function") {
        uiInstance.on("screen", ({ id }) => {
          if (SCREEN_MUSIC[id]) audioCall(() => audio.music(SCREEN_MUSIC[id]));
        });
      }
    } catch (error) {
      console.error("[engine] mountUI failed; using the built-in menu.", error);
    }
  }
  if (audio) {
    audioCall(() => audio.attach(game, { atlases }));
    audioCall(() => audio.music("menu"));
  }
  if (!uiMounted) mountFallbackUI(uiRoot, game);
  const firstStage = listStages()[0]?.id;
  if (firstStage && modules.stage) loadStageDef(firstStage).then((def) => {
    if (!match) stageDef = def;
  });
  loop.start();
  return game;
}
