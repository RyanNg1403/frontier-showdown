import { DT } from "../combat/constants.js";
import { Match } from "../combat/match.js";
import { createCpu } from "../combat/ai.js";
import { describeCharacter } from "../characters/schema.js";
import { discoverCharacters, loadAllCharacters } from "../characters/index.js";
import { createEmitter } from "./emitter.js";
import { Camera, VIEW_H, VIEW_W } from "./camera.js";
import { InputDevices } from "./input.js";
import { createLoop } from "./loop.js";
import { assetApi } from "./assets.js";
import { acquireAtlas, atlasStats, releaseAtlas, trimAtlasCache } from "./atlas-store.js";
import { loadManifest, loadModules } from "./modules.js";
import { assetUrl, atlasDecodedBytes } from "../platform/assets.js";
import { createFallbackVfx, drawBarrier, drawDebug, drawFallbackHud, drawFallbackStage, drawFighter, drawProjectileFallback, drawShadow } from "./render.js";
import { mountFallbackUI } from "./fallback-ui.js";
import { drawMechanics, drawMechProjectile } from "./mechanics-render.js";
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

export async function createGame({ canvas, uiRoot, modules: preloaded = null, manifest = undefined, quality = null, onProgress = () => {} } = {}) {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;
  const events = createEmitter();
  const devices = new InputDevices(window);
  const info = manifest === undefined ? await loadManifest() : manifest;
  onProgress(0.1, "Loading modules");
  const modules = preloaded || (await loadModules(info));
  onProgress(0.45, "Loading fighters");
  const roster = await discoverCharacters();
  const characters = await loadAllCharacters(roster.ids);
  onProgress(0.75, "Loading effects");
  const charMap = new Map(characters.map((c) => [c.id, c]));
  const hasAtlasFile = (id) => !roster.atlases || roster.atlases.has(id);
  /** Atlas animation data (no images) of the fighters in the current match, for the audio footsteps. */
  const atlases = {};
  /** Fighter ids whose atlases the current match holds a reference to. */
  let heldAtlases = [];

  const fallbackVfx = createFallbackVfx();
  let vfx = fallbackVfx;
  if (modules.vfx) {
    try {
      let vfxAssets = assetApi;
      if (typeof modules.vfx.loadVfxAssets === "function") {
        vfxAssets = await modules.vfx.loadVfxAssets(assetUrl("assets/vfx/").split("?")[0]).then((a) => ({ ...assetApi, ...a })).catch(() => assetApi);
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
  let loadToken = 0;
  const atlasMap = new Map();
  const DEFAULT_STAGE = adaptStageDef("default", { name: "Training Lab" });
  let stageDef = DEFAULT_STAGE;
  let paused = false;
  let debug = false;
  let loading = false;
  let snapshot = deepFreeze({ phase: "menu", paused: false, sides: [], fighters: [], announce: null, winner: null });
  let snapshotDirty = false;
  let music = null;
  let loadProgress = null;

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
      return { phase: loading ? "loading" : "menu", paused: false, sides: [], fighters: [], announce: null, winner: null, stage: stageDef.id, camera: camera.toJSON(), loading: loadProgress };
    }
    return decorateSnapshot({ ...match.snapshot(), paused, camera: camera.toJSON() }, charMap);
  }

  /** The snapshot is rebuilt on first read after a change, not on every simulation step. */
  function refreshSnapshot() {
    snapshotDirty = true;
  }

  function currentSnapshot() {
    if (snapshotDirty) {
      snapshotDirty = false;
      snapshot = deepFreeze(buildSnapshot());
    }
    return snapshot;
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
    const { resume: _resume, ...persistent } = config;
    lastConfig = { ...persistent, mode, sides };
    sidePlayers = sides.map((s) => s.player);
    loading = true;
    paused = false;
    match = null;
    vfx.clearProjectiles?.();
    const token = ++loadToken;
    const stageId = config.stage || listStages()[0]?.id || "default";
    const ids = [...new Set(sides.flatMap((s) => s.team))];
    const tasks = ids.length + 2;
    let done = 0;
    const progress = (label) => {
      loadProgress = { done, total: tasks, progress: done / tasks, label };
      refreshSnapshot();
      events.emit("loading", { ...loadProgress, stage: stageId, fighters: ids });
    };
    progress("Preparing the arena");
    const stagePromise = loadStageDef(stageId).then((def) => {
      done += 1;
      progress("Stage ready");
      return def;
    });
    const audioPromise = audio?.loadGroup
      ? Promise.resolve(audioCall(() => audio.loadGroup("fight"))).catch(() => {}).then(() => {
        done += 1;
        progress("Sound ready");
      })
      : Promise.resolve().then(() => { done += 1; });
    // Half-resolution frames take a quarter of the memory. Use them when the scene is drawn at
    // about half size anyway (low tier on a small screen), or when the match's atlases
    // (`decodedBytes` from the sprite pipeline) exceed the quality tier's budget.
    const atlasMB = ids.reduce((n, id) => n + (atlasDecodedBytes(id) || 0), 0) / 1048576;
    const budgetMB = quality?.tier.atlasBudgetMB ?? Infinity;
    const atlasScale = renderScale <= 0.6 || atlasMB > budgetMB ? 0.5 : 1;
    const kept = heldAtlases.filter((h) => ids.includes(h.id) && h.scale === atlasScale);
    for (const h of heldAtlases) if (!kept.includes(h)) releaseAtlas(h.id, h);
    heldAtlases = kept;
    const loaded = [];
    for (const id of ids) {
      progress(`Loading ${charMap.get(id)?.shortName || charMap.get(id)?.name || id}`);
      const atlas = hasAtlasFile(id) ? await acquireAtlas(id, { scale: atlasScale }) : null;
      loaded.push({ id, scale: atlasScale });
      done += 1;
      if (atlas) atlases[id] = { id, anchor: atlas.anchor, animations: atlas.animations };
      atlasMap.set(id, atlas);
    }
    const [stage] = await Promise.all([stagePromise, audioPromise]);
    if (token !== loadToken) {
      for (const h of loaded) releaseAtlas(h.id, h);
      return currentSnapshot();
    }
    swapHeldAtlases(loaded);
    trimAtlasCache();
    progress("Fight!");
    stageDef = stage;
    loading = false;
    loadProgress = null;
    match = new Match({
      mode,
      stage: stage.id,
      bounds: stage.bounds,
      roundsToWin: config.roundsToWin ?? 2,
      timer: config.timer ?? null,
      backBlocks: Boolean(config.backBlocks),
      atlases: new Map(ids.map((id) => [id, atlasMap.get(id)]).filter(([, a]) => a)),
      emit: onMatchEvent,
      seed: (Date.now() & 0xffff) | 1,
      sides: sides.map((s, i) => ({
        team: s.team.map((id) => charMap.get(id)),
        control: s.control,
        difficulty: s.difficulty,
        cpu: s.control === "cpu" ? createCpu(s.difficulty, 101 + i * 17 + (Date.now() & 0xff)) : null,
      })),
    });
    if (config.resume) applyResume(match, config.resume);
    match.start();
    camera.snap([match.point(0), match.point(1)], match.bounds);
    playMusic(stage.music);
    refreshSnapshot();
    events.emit("loaded", { stage: stage.id, fighters: ids });
    return currentSnapshot();
  }

  /** Hold the new match's atlases before dropping the old ones, so a rematch never reloads. */
  function swapHeldAtlases(next) {
    const previous = heldAtlases;
    heldAtlases = next;
    for (const h of previous) releaseAtlas(h.id, h);
    const ids = next.map((h) => h.id);
    for (const id of Object.keys(atlases)) if (!ids.includes(id)) delete atlases[id];
    for (const id of [...atlasMap.keys()]) if (!ids.includes(id)) atlasMap.delete(id);
  }

  /**
   * Continue a saved match at a round boundary: `resume = { round, sides: [{ wins, meter,
   * lastCheckpointUsed }] }` restores the score and the meter carried between rounds.
   */
  function applyResume(m, resume) {
    const round = Math.floor(Number(resume.round) || 0);
    if (round < 2) return;
    m.sides.forEach((s, i) => {
      const saved = resume.sides?.[i];
      if (!saved) return;
      s.wins = Math.max(0, Math.min(m.roundsToWin - 1, Math.floor(Number(saved.wins) || 0)));
      s.meter = Math.max(0, Math.min(300, Number(saved.meter) || 0));
      s.lastCheckpointUsed = Boolean(saved.lastCheckpointUsed);
    });
    m.emit("matchStart", { mode: m.mode, stage: m.stage, resumed: true, sides: m.sides.map((s) => ({ team: s.members.map((f) => f.id), control: s.control })) });
    m.round = round - 1;
    m.startRound();
  }

  /** Free fighter images and stage art once no match is running. */
  function releaseMatchAssets() {
    loadToken += 1;
    swapHeldAtlases([]);
    trimAtlasCache();
    if (modules.stage?.releaseStage) stageCall(() => modules.stage.releaseStage());
  }

  function listCharacters() {
    return characters.map((c) => describeCharacter(c, hasAtlasFile(c.id)));
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
    return Promise.resolve(currentSnapshot());
  }

  function quitToMenu() {
    match = null;
    releaseMatchAssets();
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
      vfxCall(() => vfx.syncProjectiles(match.projectiles.filter((p) => !p.def.mech?.look).map((p) => ({ id: p.id, x: p.x, y: p.y, facing: p.facing, labId: p.owner.def.labId, scale: p.category === "super" ? 1.6 : 1 }))));
    }
    const targets = [match.point(0), match.point(1)].filter((f) => f.onField && f.state !== "bench");
    const offset = helpers?.getShakeOffset ? vfxCall(() => helpers.getShakeOffset()) : null;
    if (uiOptions.screenShake) camera.update(targets, match.bounds, match.shakeFrames, Math.random, offset || null);
    else camera.update(targets, match.bounds, 0, Math.random, { x: 0, y: 0 });
    if (!stageFailed && modules.stage?.updateStage) stageCall(() => modules.stage.updateStage(DT, currentSnapshot()));
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

  /**
   * Mechanic entities: `draw(ctx, camera, layer)` for their `layer` ("back" before fighters,
   * "front" after them; default "front"), or `drawBack` / `drawFront` for both. `space:
   * "screen"` draws untransformed (super backdrops), otherwise the camera transform is applied.
   */
  function drawEntities(layer) {
    for (const e of match.entities) {
      if (e.dead || e.drawFailed) continue;
      const fn = layer === "back" ? e.drawBack || ((e.layer || "front") === "back" ? e.draw : null) : e.drawFront || ((e.layer || "front") === "front" ? e.draw : null);
      if (typeof fn !== "function") continue;
      ctx.save();
      if (e.space !== "screen") camera.apply(ctx);
      try {
        fn.call(e, ctx, camera, layer);
      } catch (error) {
        e.drawFailed = true;
        console.error("[engine] entity draw failed; skipping it.", error);
      }
      ctx.restore();
    }
  }

  /**
   * Backing-store scale from the quality tier: the scene is always drawn in 1280x720 logical
   * px under a base transform, so modules never see the difference.
   */
  let renderScale = 1;
  let lastFrameAt = 0;
  function applyQuality() {
    if (!quality) return;
    const tier = quality.tier;
    const cssWidth = canvas.getBoundingClientRect().width || VIEW_W;
    const scale = Math.round(quality.scaleFor(cssWidth, VIEW_W) * 40) / 40;
    if (scale !== renderScale) {
      renderScale = scale;
      canvas.width = Math.round(VIEW_W * scale);
      canvas.height = Math.round(VIEW_H * scale);
    }
    if (fx()?.setQuality) vfxCall(() => fx().setQuality({ particles: tier.particles }));
    if (!stageFailed && modules.stage?.setStageQuality) stageCall(() => modules.stage.setStageQuality({ ambient: tier.ambient }));
  }
  if (quality) {
    quality.onChange(applyQuality);
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => applyQuality()).observe(canvas);
  }

  let idleCleared = false;
  function render() {
    // The DOM menus cover the canvas whenever no match is running; skip drawing there.
    if (!match && uiMounted) {
      if (!idleCleared) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#0d0b18";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        idleCleared = true;
      }
      lastFrameAt = 0;
      return;
    }
    idleCleared = false;
    const now = performance.now();
    if (quality && match && !paused && lastFrameAt) quality.sample(now - lastFrameAt);
    lastFrameAt = now;
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    drawStage("back");
    ctx.save();
    vfxCall(() => vfx.draw(ctx, camera, "back"));
    ctx.restore();
    if (match) drawEntities("back");
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
    if (match) drawEntities("front");
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
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    if (domHud) return;
    if (!hudFailed) {
      ctx.save();
      hudCall(() => modules.ui.drawHud(ctx, currentSnapshot()));
      ctx.restore();
    }
    if (hudFailed) drawFallbackHud(ctx, currentSnapshot());
  }

  const loop = createLoop({ step, render });

  function endMatch() {
    match = null;
    releaseMatchAssets();
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
      return currentSnapshot();
    },
    get match() {
      return match;
    },
    /** Normalized config of the current or last match (what `rematch()` replays). */
    get lastConfig() {
      return lastConfig;
    },
    atlasStats,
    get quality() {
      return quality ? { tier: quality.tier.id, pinned: quality.pinned, downgrades: quality.downgrades, renderScale, canvas: [canvas.width, canvas.height] } : null;
    },
    get modules() {
      return { stage: Boolean(modules.stage) && !stageFailed, vfx: vfx !== fallbackVfx, ui: Boolean(modules.ui), audio: Boolean(audio) };
    },
    camera,
    canvas,
    get audio() {
      return audio;
    },
    get ui() {
      return uiInstance;
    },
    bindings: devices.bindings,
    refreshBindings: () => devices.refreshBound(),
    addInputSource: (fn) => devices.addSource(fn),
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

  onProgress(0.9, "Building menus");
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
  if (firstStage && modules.stage && !uiMounted) loadStageDef(firstStage).then((def) => {
    if (!match) stageDef = def;
  });
  applyQuality();
  loop.start();
  return game;
}
