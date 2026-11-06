// Frontier Showdown audio: Web Audio playback with master/music/sfx/voice buses,
// randomized SFX, crossfading music, a queued announcer that ducks the music,
// slow-motion, and a `game.events` binding (see events.js).
import { SOUNDS, VOICE, MUSIC, LABS, ALL_SOUNDS, soundFiles, labId } from "./catalog.js";
import { bindGameEvents } from "./events.js";
import { audioDuration, resolveUrl } from "../platform/assets.js";
import { createFootstepTracker } from "./footsteps.js";

export { SOUNDS, VOICE, MUSIC, LABS, labId, bindGameEvents, createFootstepTracker };

export const BUSES = ["master", "music", "sfx", "voice"];
const DEFAULT_VOLUMES = { master: 0.8, music: 0.6, sfx: 0.9, voice: 1 };
const MAX_VOICES = 48;
const OPEN = 20000;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const dbToGain = (d) => 10 ** (d / 20);
const spread = (range) => (Math.random() * 2 - 1) * range;

export function createAudio(options = {}) {
  const base = new URL(options.baseUrl ?? "../../assets/audio/", import.meta.url);
  const storageKey = options.storageKey ?? "frontier.audio";
  const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  const ctx = options.context ?? new Ctx({ latencyHint: "interactive" });
  const onPlay = options.onPlay ?? null;

  // Graph: sfx -> sfxFilter -> master, music -> duck -> musicFilter -> master, voice -> master,
  // master -> limiter -> destination.
  // DynamicsCompressorNode adds automatic make-up gain, so a fixed trim follows it.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.15;
  const trim = ctx.createGain();
  trim.gain.value = 0.8;
  limiter.connect(trim).connect(ctx.destination);

  const buses = Object.fromEntries(BUSES.map((name) => [name, ctx.createGain()]));
  buses.master.connect(limiter);
  const duck = ctx.createGain();
  const musicFilter = ctx.createBiquadFilter();
  musicFilter.type = "lowpass";
  musicFilter.frequency.value = OPEN;
  buses.music.connect(duck).connect(musicFilter).connect(buses.master);
  const sfxFilter = ctx.createBiquadFilter();
  sfxFilter.type = "lowpass";
  sfxFilter.frequency.value = OPEN;
  buses.sfx.connect(sfxFilter).connect(buses.master);
  buses.voice.connect(buses.master);

  const volumes = { ...DEFAULT_VOLUMES, ...readStored("volumes"), ...options.volumes };
  const muted = { master: false, music: false, sfx: false, voice: false, ...readStored("muted") };
  BUSES.forEach(applyVolume);

  const buffers = new Map(); // path -> AudioBuffer
  const pending = new Map(); // path -> Promise<AudioBuffer|null>
  const active = new Map(); // id -> [voice]
  const lastVariant = new Map();
  let voiceCount = 0;
  let slow = { active: false, rate: 1 };
  let voiceQueueEnd = 0;
  let duckUntil = 0;
  let musicState = { id: null, node: null, gain: null, element: null, token: 0 };
  let paused = false;

  function readStored(key) {
    try { return JSON.parse(globalThis.localStorage?.getItem(`${storageKey}.${key}`) ?? "null") ?? {}; } catch { return {}; }
  }
  function store(key, value) {
    try { globalThis.localStorage?.setItem(`${storageKey}.${key}`, JSON.stringify(value)); } catch { /* storage unavailable */ }
  }

  function applyVolume(bus) {
    const v = muted[bus] ? 0 : clamp(volumes[bus], 0, 1);
    buses[bus].gain.setTargetAtTime(v * v, ctx.currentTime, 0.015);
  }

  // ---- loading ----------------------------------------------------------------

  function url(path) {
    return resolveUrl(new URL(path, base).href);
  }

  // Sounds are fetched by group: UI blips at start-up, everything heard in a fight while the
  // match loads. A sound requested before its group has loaded is fetched on first use.
  const GROUPS = {
    ui: Object.keys(ALL_SOUNDS).filter((id) => id.startsWith("ui.")),
    fight: [...Object.keys(ALL_SOUNDS).filter((id) => !id.startsWith("ui.")), "fight", "victory"],
    select: ["select"],
  };
  function loadGroup(name) {
    return load(GROUPS[name] || []);
  }

  function decode(data) {
    return new Promise((resolve, reject) => {
      const p = ctx.decodeAudioData(data, resolve, reject);
      if (p?.then) p.then(resolve, reject);
    });
  }

  function loadPath(path) {
    if (buffers.has(path)) return Promise.resolve(buffers.get(path));
    if (!pending.has(path)) {
      pending.set(path, fetch(url(path))
        .then((res) => { if (!res.ok) throw new Error(`${res.status} ${path}`); return res.arrayBuffer(); })
        .then(decode)
        .then((b) => { buffers.set(path, b); return b; })
        .catch((err) => { console.warn(`[audio] failed to load ${path}:`, err.message ?? err); return null; }));
    }
    return pending.get(path);
  }

  function load(ids = Object.keys(ALL_SOUNDS)) {
    const paths = ids.flatMap((id) => (ALL_SOUNDS[id] ? soundFiles(ALL_SOUNDS[id]) : MUSIC[id] && !MUSIC[id].stream ? [MUSIC[id].file] : []));
    return Promise.all(paths.map(loadPath)).then(() => undefined);
  }

  function buffersFor(id) {
    const entry = ALL_SOUNDS[id];
    return entry ? soundFiles(entry).map((p) => buffers.get(p) ?? null) : [];
  }

  // ---- unlock -------------------------------------------------------------------

  const gestureEvents = ["pointerdown", "keydown", "touchend", "mousedown"];
  function unlock() {
    const p = ctx.state === "running" ? Promise.resolve() : ctx.resume();
    return p.then(() => {
      if (musicState.element?.paused && musicState.id) musicState.element.play().catch(() => {});
    }).catch(() => {});
  }
  function onGesture() {
    unlock().then(() => {
      if (ctx.state === "running") gestureEvents.forEach((e) => globalThis.removeEventListener?.(e, onGesture, true));
    });
  }
  if (options.autoUnlock !== false && ctx.state !== "running") {
    gestureEvents.forEach((e) => globalThis.addEventListener?.(e, onGesture, true));
  }

  // ---- sfx / voice playback ---------------------------------------------------------

  function panFor(opts) {
    if (typeof opts.pan === "number") return clamp(opts.pan, -1, 1);
    if (typeof opts.x === "number") {
      const width = opts.width ?? 1280;
      const nx = opts.x >= 0 && opts.x <= 1 && width > 1 && !opts.pixels ? opts.x : opts.x / width;
      return clamp((nx * 2 - 1) * 0.7, -1, 1);
    }
    return 0;
  }

  function pickVariant(id, count, requested) {
    if (Number.isInteger(requested)) return clamp(requested, 0, count - 1);
    if (count <= 1) return 0;
    const last = lastVariant.get(id);
    let i = Math.floor(Math.random() * count);
    if (i === last) i = (i + 1 + Math.floor(Math.random() * (count - 1))) % count;
    lastVariant.set(id, i);
    return i;
  }

  function stopVoice(v, fade = 0.03) {
    if (v.stopped) return;
    v.stopped = true;
    const t = ctx.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(v.gain.gain.value, t);
    v.gain.gain.linearRampToValueAtTime(0, t + fade);
    try { v.source.stop(t + fade + 0.01); } catch { /* already stopped */ }
  }

  function play(id, opts = {}) {
    const entry = ALL_SOUNDS[id];
    if (!entry) { console.warn(`[audio] unknown sound "${id}"`); return null; }
    const all = buffersFor(id);
    const ready = all.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
    if (!ready.length) { load([id]); return null; }
    const variant = pickVariant(id, all.length, opts.variant);
    const buffer = all[variant] ?? all[ready[0]];

    const list = active.get(id) ?? [];
    while (list.length >= (opts.maxVoices ?? entry.maxVoices)) stopVoice(list.shift(), 0.02);
    if (voiceCount >= MAX_VOICES) {
      const oldest = [...active.values()].flat().sort((a, b) => a.start - b.start)[0];
      if (oldest) stopVoice(oldest, 0.02);
    }

    const variation = opts.variation ?? 1;
    const busName = opts.bus ?? entry.bus;
    const semitones = (opts.pitch ?? 0) + spread(entry.pitchVar * variation);
    const slowRate = busName === "sfx" ? slow.rate : 1;
    const rate = 2 ** (semitones / 12) * (opts.rate ?? 1) * slowRate;
    const level = dbToGain(entry.gain + (opts.gainDb ?? 0) + spread(entry.volVar * variation)) * (opts.volume ?? 1);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.loop = Boolean(opts.loop);
    const gain = ctx.createGain();
    gain.gain.value = level;
    let tail = source.connect(gain);
    const pan = panFor(opts);
    if (pan && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      tail = tail.connect(panner);
    }
    tail.connect(buses[busName] ?? buses.sfx);

    const when = ctx.currentTime + Math.max(0, opts.delay ?? 0);
    const voice = { id, source, gain, start: when, bus: busName, baseRate: rate / slowRate, stopped: false };
    let resolveEnded;
    voice.ended = new Promise((r) => { resolveEnded = r; });
    source.onended = () => {
      const l = active.get(id);
      const i = l ? l.indexOf(voice) : -1;
      if (i >= 0) l.splice(i, 1);
      voiceCount--;
      resolveEnded();
    };
    list.push(voice);
    active.set(id, list);
    voiceCount++;
    source.start(when);
    if (busName === "voice" && opts.duck !== false) duckMusic(when, when + buffer.duration / rate);
    onPlay?.(id, { variant, rate, level, pan, when, duration: buffer.duration / rate });
    return { id, variant, source, duration: buffer.duration / rate, ended: voice.ended, stop: (fade) => stopVoice(voice, fade) };
  }

  function stopAll(fade = 0.05) {
    for (const list of active.values()) list.slice().forEach((v) => stopVoice(v, fade));
  }

  function duckMusic(from, to, depth = 0.45) {
    const g = duck.gain;
    if (from > duckUntil) {
      g.cancelScheduledValues(from);
      g.setTargetAtTime(depth, from, 0.03);
    }
    duckUntil = Math.max(duckUntil, to);
    g.setTargetAtTime(1, duckUntil + 0.1, 0.25);
  }

  // ---- announcer ------------------------------------------------------------------

  // Queued so lines never overlap; `interrupt` cuts the queue and plays now.
  function announce(line, opts = {}) {
    const id = VOICE[line] ? line : VOICE[`ann.${line}`] ? `ann.${line}` : null;
    const now = ctx.currentTime;
    if (opts.interrupt) { (active.get(id) ?? []).forEach((v) => stopVoice(v)); voiceQueueEnd = now; }
    const startAt = Math.max(now + (opts.delay ?? 0), voiceQueueEnd + (opts.gap ?? 0.12));
    if (!id) {
      console.warn(`[audio] no recorded announcer line for "${line}"`);
      return null;
    }
    const handle = play(id, { ...opts, delay: startAt - now });
    // The last quarter second of each line is room tail, which the next line may overlap.
    if (handle) voiceQueueEnd = startAt + Math.max(0.5, handle.duration - 0.25);
    return handle;
  }

  function announceWinner(lab, opts = {}) {
    const id = labId(lab);
    if (id && VOICE[`ann.wins.${id}`]) return announce(`ann.wins.${id}`, opts);
    // Labs the catalog doesn't know use the side's line, or the plain "Winner!".
    if (Number.isInteger(opts.side)) return announce(`ann.wins.player${opts.side + 1}`, opts);
    return announce("ann.winner", opts);
  }

  // ---- music --------------------------------------------------------------------------

  function music(trackId, opts = {}) {
    const fade = opts.fade ?? 1.2;
    if (!trackId || trackId === "none") { stopMusic(fade); return Promise.resolve(); }
    const track = MUSIC[trackId];
    if (!track) { console.warn(`[audio] unknown music "${trackId}"`); return Promise.resolve(); }
    if (musicState.id === trackId && !opts.restart) return Promise.resolve();
    const token = ++musicState.token;
    const prev = { ...musicState };
    musicState = { id: trackId, node: null, gain: null, element: null, token };

    const start = (node, element) => {
      if (token !== musicState.token) { try { node.stop?.(); } catch { /* not started */ } element?.pause(); return; }
      const gain = ctx.createGain();
      const target = Math.max(0.0002, dbToGain(track.gain ?? 0) * (opts.volume ?? 1));
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(target, t + Math.max(0.02, fade));
      node.connect(gain).connect(buses.music);
      musicState.node = node;
      musicState.gain = gain;
      musicState.element = element;
      if (element) {
        element.playbackRate = slow.active ? 0.85 : 1;
        element.play().catch(() => {});
      } else {
        node.playbackRate.value = slow.active ? 0.85 : 1;
        node.start();
        if (!track.loop) node.onended = () => { if (musicState.node === node) musicState = { ...musicState, id: null, node: null }; };
      }
      fadeOutTrack(prev, fade);
    };

    if (track.stream) {
      const element = new Audio(url(track.file));
      element.loop = track.loop !== false;
      // Nothing can play before the first gesture, so don't download the stream until then.
      element.preload = ctx.state === "running" ? "auto" : "none";
      element.preservesPitch = false;
      start(ctx.createMediaElementSource(element), element);
      return Promise.resolve();
    }
    return loadPath(track.file).then((buffer) => {
      if (!buffer) return;
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.loop = track.loop !== false;
      node.loopStart = track.loopStart ?? 0;
      node.loopEnd = track.loopEnd ?? Math.min(buffer.duration, audioDuration(`assets/audio/${track.file}`) ?? buffer.duration);
      start(node, null);
    });
  }

  function fadeOutTrack(state, fade) {
    if (!state.gain) return;
    const t = ctx.currentTime;
    state.gain.gain.cancelScheduledValues(t);
    state.gain.gain.setValueAtTime(Math.max(0.0001, state.gain.gain.value), t);
    state.gain.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.02, fade));
    setTimeout(() => {
      try { state.node?.stop?.(); } catch { /* already stopped */ }
      state.element?.pause();
      state.node?.disconnect();
    }, (fade + 0.1) * 1000);
  }

  function stopMusic(fade = 1) {
    musicState.token++;
    fadeOutTrack(musicState, fade);
    musicState = { id: null, node: null, gain: null, element: null, token: musicState.token };
  }

  // ---- slow motion / pause ------------------------------------------------------------

  function setSlowMotion(on, opts = {}) {
    const rate = on ? opts.rate ?? 0.6 : 1;
    if (on === slow.active && rate === slow.rate) return;
    const ramp = opts.ramp ?? 0.25;
    const t = ctx.currentTime;
    if (opts.sting !== false) play(on ? "fx.slowmo-in" : "fx.slowmo-out", { bus: "voice", duck: false });
    slow = { active: on, rate };
    for (const list of active.values()) {
      for (const v of list) if (v.bus === "sfx") v.source.playbackRate.setTargetAtTime(v.baseRate * rate, t, ramp / 3);
    }
    sfxFilter.frequency.setTargetAtTime(on ? opts.sfxCutoff ?? 2600 : OPEN, t, ramp / 3);
    if (!paused) musicFilter.frequency.setTargetAtTime(on ? opts.musicCutoff ?? 900 : OPEN, t, ramp / 3);
    if (musicState.node?.playbackRate) musicState.node.playbackRate.setTargetAtTime(on ? 0.85 : 1, t, ramp / 3);
    if (musicState.element) musicState.element.playbackRate = on ? 0.85 : 1;
  }

  // Muffles the music under a pause menu; UI sounds share the sfx bus and stay audible.
  function setPaused(on) {
    paused = on;
    musicFilter.frequency.setTargetAtTime(on ? 700 : slow.active ? 900 : OPEN, ctx.currentTime, 0.08);
  }

  // ---- volume API -------------------------------------------------------------------------

  function setVolume(bus, value) {
    if (!buses[bus]) return;
    volumes[bus] = clamp(Number(value), 0, 1);
    applyVolume(bus);
    store("volumes", volumes);
  }

  function setMuted(bus, on) {
    if (!buses[bus]) return;
    muted[bus] = Boolean(on);
    applyVolume(bus);
    store("muted", muted);
  }

  const audio = {
    context: ctx,
    buses,
    output: trim,
    ready: options.preload === false ? Promise.resolve() : options.preload === "all" ? load() : loadGroup("ui"),
    load,
    loadGroup,
    unlock,
    play,
    stopAll,
    music,
    stopMusic,
    get currentMusic() { return musicState.id; },
    announce,
    announceWinner,
    ui: (kind, opts) => play(`ui.${kind}`, opts),
    step: (kind = "walk", opts) => play(kind === "run" ? "step.run" : "step.walk", opts),
    setSlowMotion,
    get slowMotion() { return slow.active; },
    setPaused,
    setVolume,
    getVolume: (bus) => volumes[bus],
    setMuted,
    isMuted: (bus) => muted[bus],
    volumes: () => ({ ...volumes }),
    has: (id) => Boolean(ALL_SOUNDS[id]),
    ids: () => Object.keys(ALL_SOUNDS),
    buffer: (id, variant = 0) => buffersFor(id)[variant] ?? null,
    attach: (game, opts) => bindGameEvents(audio, game, opts),
    dispose() {
      stopAll(0.02);
      stopMusic(0.05);
      gestureEvents.forEach((e) => globalThis.removeEventListener?.(e, onGesture, true));
      if (!options.context) setTimeout(() => ctx.close(), 200);
    },
  };
  return audio;
}
