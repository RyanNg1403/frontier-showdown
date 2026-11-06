import { DT } from "../combat/constants.js";
import { Match } from "../combat/match.js";
import { createCpu } from "../combat/ai.js";
import { describeCharacter } from "../characters/schema.js";
import { loadAllCharacters } from "../characters/index.js";
import { createEmitter } from "./emitter.js";
import { Camera, VIEW_H, VIEW_W } from "./camera.js";
import { InputDevices } from "./input.js";
import { createLoop } from "./loop.js";
import { assetApi, loadAtlas } from "./assets.js";
import { loadModules } from "./modules.js";
import { createFallbackVfx, drawBarrier, drawDebug, drawFallbackHud, drawFallbackStage, drawFighter, drawProjectileFallback, drawShadow } from "./render.js";
import { mountFallbackUI } from "./fallback-ui.js";
import { drawMechanics, drawMechProjectile } from "./mechanics-render.js";
import { adaptVfx } from "./vfx-adapter.js";
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

export async function createGame({ canvas, uiRoot, modules: preloaded = null } = {}) {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const events = createEmitter();
  const devices = new InputDevices(window);
  const modules = preloaded || (await loadModules());
  const characters = await loadAllCharacters();
  const charMap = new Map(characters.map((c) => [c.id, c]));
  const atlasReady = new Map();
  await Promise.all(characters.map((c) => loadAtlas(c.id).then((a) => atlasReady.set(c.id, Boolean(a)))));

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
  let hudFailed = !modules.ui?.drawHud;
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
    events.emit(name, payload);
  }

  function buildSnapshot() {
    if (!match) {
      return { phase: loading ? "loading" : "menu", paused: false, sides: [], fighters: [], announce: null, winner: null, stage: stageDef.id, camera: camera.toJSON() };
    }
    return { ...match.snapshot(), paused, camera: camera.toJSON() };
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
    if (!url) return;
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

  async function startMatch(config = {}) {
    const mode = config.mode === "2v2" ? "2v2" : "1v1";
    const fallbackIds = characters.map((c) => c.id);
    const sides = [0, 1].map((i) => {
      const s = config.sides?.[i] || {};
      let team = (s.team || []).filter((id) => charMap.has(id));
      const need = mode === "2v2" ? 2 : 1;
      while (team.length < need) team.push(fallbackIds[(i + team.length) % fallbackIds.length]);
      team = team.slice(0, need);
      return { team, control: s.control === "cpu" ? "cpu" : s.control === "human" ? "human" : i === 0 ? "human" : "cpu", difficulty: s.difficulty || "normal" };
    });
    lastConfig = { ...config, mode, sides };
    loading = true;
    paused = false;
    match = null;
    vfx.clearProjectiles?.();
    refreshSnapshot();
    const stageId = config.stage || listStages()[0]?.id || "default";
    const [stage, atlases] = await Promise.all([
      loadStageDef(stageId),
      Promise.all(sides.flatMap((s) => s.team).map(async (id) => [id, await loadAtlas(id)])),
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
  }

  devices.onKey((code) => {
    if (code === "Escape") togglePause();
    if (code === "F1") debug = !debug;
  });

  function step() {
    if (devices.startPressed(0) || devices.startPressed(1)) togglePause();
    if (!match || paused) return;
    const inputs = match.sides.map((s) => (s.control === "human" ? devices.read(s.side) : null));
    match.step(inputs);
    if (vfx.syncProjectiles) {
      vfxCall(() => vfx.syncProjectiles(match.projectiles.filter((p) => !p.def.mech?.look).map((p) => ({ id: p.id, x: p.x, y: p.y, facing: p.facing, labId: p.owner.def.labId, scale: p.category === "super" ? 1.6 : 1 }))));
    }
    const targets = [match.point(0), match.point(1)].filter((f) => f.onField && f.state !== "bench");
    camera.update(targets, match.bounds, match.shakeFrames);
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
      drawMechanics(ctx, match, t, "back");
      for (const f of order) drawFighter(ctx, f);
      drawMechanics(ctx, match, t, "front");
      ctx.restore();
      const now = performance.now();
      for (const p of match.projectiles) {
        const view = { id: p.id, x: p.x, y: p.y, vx: p.vx, facing: p.facing, vfx: p.vfx, ownerId: p.ownerId, side: p.side, age: p.age, palette: p.palette };
        let drawn = drawMechProjectile(ctx, camera, p, now);
        if (!drawn && vfx.drawProjectile) {
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
    if (!hudFailed) {
      ctx.save();
      hudCall(() => modules.ui.drawHud(ctx, snapshot));
      ctx.restore();
    }
    if (hudFailed) drawFallbackHud(ctx, snapshot);
  }

  const loop = createLoop({ step, render });

  const game = {
    events,
    get state() {
      return snapshot;
    },
    get match() {
      return match;
    },
    get modules() {
      return { stage: Boolean(modules.stage) && !stageFailed, vfx: vfx !== fallbackVfx, ui: Boolean(modules.ui) };
    },
    camera,
    canvas,
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

  let uiMounted = false;
  if (modules.ui?.mountUI) {
    try {
      await modules.ui.mountUI(uiRoot, game);
      uiMounted = true;
    } catch (error) {
      console.error("[engine] mountUI failed; using the built-in menu.", error);
    }
  }
  if (!uiMounted) mountFallbackUI(uiRoot, game);
  const firstStage = listStages()[0]?.id;
  if (firstStage && modules.stage) loadStageDef(firstStage).then((def) => {
    if (!match) stageDef = def;
  });
  loop.start();
  return game;
}
