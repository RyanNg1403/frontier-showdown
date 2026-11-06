import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createAudio } from "../src/audio/index.js";
import { bindGameEvents, screenVoice } from "../src/audio/events.js";
import { CLIP_FALLBACK, VOICE, soundFiles } from "../src/audio/catalog.js";
import { ROSTER_ORDER, loadCharacter } from "../src/characters/index.js";
import { BTN, RULES } from "../src/combat/constants.js";
import { dario, hold, makeMatch, play, sam, until } from "./helpers.mjs";

const audioDir = fileURLToPath(new URL("../assets/audio/", import.meta.url));
const voicesDir = `${audioDir}voices/`;
const manifest = JSON.parse(readFileSync(`${voicesDir}manifest.json`, "utf8"));
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

test("voice manifest: 143 unique clips, every file present and listed", () => {
  assert.equal(manifest.length, 143);
  assert.equal(new Set(manifest.map((c) => c.id)).size, 143);
  for (const c of manifest) assert.ok(existsSync(voicesDir + c.file), `${c.file} exists`);
  const listed = new Set(manifest.map((c) => c.file));
  for (const f of readdirSync(voicesDir).filter((f) => f.endsWith(".ogg"))) assert.ok(listed.has(f), `${f} is listed`);
});

test("every fighter has versus, taunt, win and tag-in clips plus one per special and super", async () => {
  const ids = new Set(manifest.map((c) => c.id));
  for (const c of await Promise.all(ROSTER_ORDER.map(loadCharacter))) {
    for (const line of ["versus", "taunt", "win", "tag-in"]) assert.ok(ids.has(`${c.id}.${line}`), `${c.id}.${line}`);
    for (const sp of c.specials) assert.ok(ids.has(`${c.id}.special.${sp.id}`), `${c.id}.special.${sp.id}`);
    assert.ok(ids.has(`${c.id}.super.${c.super.id}`), `${c.id}.super.${c.super.id}`);
  }
});

test("every announcer clip with a recorded fallback names a real clip and a recorded line", () => {
  const ids = new Set(manifest.map((c) => c.id));
  for (const [clip, line] of Object.entries(CLIP_FALLBACK)) {
    assert.ok(ids.has(clip), clip);
    for (const file of soundFiles(VOICE[line])) assert.ok(existsSync(audioDir + file), `${line}: ${file}`);
  }
});

// ---- event mapping ------------------------------------------------------------------

function recordingAudio() {
  const calls = [];
  const rec = (kind) => (id, o) => { calls.push([kind, id, o]); return kind === "speak" ? { id } : null; };
  return {
    calls,
    of: (kind) => calls.filter((c) => c[0] === kind).map((c) => c[1]),
    announce: rec("announce"),
    announceWinner: rec("winner"),
    speak: rec("speak"),
    play: rec("play"),
    hush() {},
    loadVoices: () => Promise.resolve(),
    music() {},
    setSlowMotion() {},
    setPaused() {},
    currentMusic: "fight",
  };
}

function wiredMatch(opts = {}) {
  const handlers = {};
  const emitter = { on: (n, fn) => { (handlers[n] ??= []).push(fn); return () => {}; } };
  const audio = recordingAudio();
  bindGameEvents(audio, emitter, { winnerDelay: 0 });
  const log = [];
  log.push = (e) => { Array.prototype.push.call(log, e); for (const fn of handlers[e.name] || []) fn(e.payload); return log.length; };
  const m = makeMatch({ ...opts, events: log });
  return { m, audio, log };
}

test("specials and supers call out the fighter's clip for that move id", () => {
  const { m, audio, log } = wiredMatch();
  m.sides[0].meter = 300;
  const fire = (steps) => { play(m, 0, steps); until(m, () => m.point(0).isNeutral, 240); };
  fire([{ dir: 2, frames: 2 }, { dir: 3, frames: 2 }, { dir: 6, frames: 2 }, { dir: 6, buttons: BTN.LP, frames: 1 }, { frames: 1 }]);
  fire([{ dir: 2, frames: 2 }, { dir: 3, frames: 2 }, { dir: 6, frames: 2 }, { dir: 2, frames: 2 }, { dir: 3, frames: 2 }, { dir: 6, frames: 2 }, { dir: 6, buttons: BTN.HP, frames: 1 }, { frames: 1 }]);
  const special = log.find((e) => e.name === "special");
  const sup = log.find((e) => e.name === "super");
  assert.ok(special && sup, "engine emitted a special and a super");
  assert.ok(audio.of("speak").includes(`sam.special.${special.payload.moveId}`));
  assert.ok(audio.of("speak").includes(`sam.super.${sup.payload.moveId}`));
});

test("2v2: a tag plays the incoming fighter's tag-in line", () => {
  const { m, audio } = wiredMatch({ mode: "2v2", p1: [sam, dario], p2: [dario, sam] });
  play(m, 0, [{ buttons: BTN.TAG, frames: RULES.tagHoldFrames + 2 }, { frames: 1 }]);
  hold(m, 5);
  assert.deepEqual(audio.of("speak"), ["dario.tag-in"]);
});

test("match end: the announcer's call, then the winner's own win clip instead of 'Winner!'", async () => {
  const { m, audio, log } = wiredMatch({ roundsToWin: 1 });
  m.sides[1].control = "cpu";
  log.push({ name: "matchStart", payload: { sides: [{ team: ["sam"], control: "human" }, { team: ["dario"], control: "cpu" }] } });
  m.point(1).health = 0;
  until(m, () => log.some((e) => e.name === "roundEnd"), 1200);
  await tick();
  assert.ok(audio.of("announce").includes("announcer.ko"));
  assert.ok(audio.of("announce").includes("announcer.you-win"));
  assert.deepEqual(audio.of("speak"), ["sam.win"]);
  assert.deepEqual(audio.of("winner"), [], "no shared 'Winner!' when the win clip plays");
});

test("a round won short of the match plays the winner's taunt", () => {
  const { m, audio, log } = wiredMatch({ roundsToWin: 2 });
  m.point(0).health = 0;
  until(m, () => log.some((e) => e.name === "roundEnd"), 1200);
  assert.deepEqual(audio.of("speak"), ["dario.taunt"]);
});

test("screens: character select calls 'Choose your fighter!', versus plays each point fighter's line", async () => {
  const audio = recordingAudio();
  await screenVoice(audio, "select", { from: "mode" });
  assert.deepEqual(audio.of("announce"), ["announcer.choose-your-fighter"]);
  await screenVoice(audio, "versus", { session: { sides: [{ picks: ["yann", "noam"] }, { picks: ["feifei", "chris"] }] } });
  assert.deepEqual(audio.of("speak"), ["yann.versus", "feifei.versus"]);
});

// ---- loading and fallback -----------------------------------------------------------

function fakeAudio({ fail = [] } = {}) {
  const fetched = [];
  const started = [];
  const param = () => ({ value: 1, setTargetAtTime() {}, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = (extra = {}) => ({ connect: (n) => n, disconnect() {}, gain: param(), frequency: param(), pan: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), ...extra });
  const context = {
    state: "running", currentTime: 0, destination: node(),
    createGain: () => node(), createBiquadFilter: () => node(), createDynamicsCompressor: () => node(), createStereoPanner: () => node(),
    createBufferSource() { const s = node({ playbackRate: param(), start() { started.push(s.buffer.path); }, stop() {} }); return s; },
    decodeAudioData: (data) => Promise.resolve({ duration: 1, path: data.path }),
  };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (href) => {
    const path = decodeURIComponent(new URL(href).pathname).split("/assets/audio/")[1];
    fetched.push(path);
    if (fail.includes(path) || !existsSync(audioDir + path)) return { ok: false, status: 404 };
    return { ok: true, json: async () => JSON.parse(readFileSync(audioDir + path, "utf8")), arrayBuffer: async () => ({ path }) };
  };
  const audio = createAudio({ context, preload: false, autoUnlock: false });
  return { audio, fetched, started, restore: () => { globalThis.fetch = realFetch; } };
}

test("voice packs load with the match: the announcer and the two fighters, nothing else", async () => {
  const { audio, fetched, started, restore } = fakeAudio();
  try {
    assert.deepEqual(fetched, [], "nothing loads up front");
    await audio.loadGroup("fight", { fighters: ["sam", "dario"] });
    const voices = fetched.filter((p) => p.startsWith("voices/") && p.endsWith(".ogg"));
    assert.equal(voices.length, 14 + 8 + 8);
    assert.ok(voices.every((p) => /^voices\/(announcer|sam|dario)-/.test(p)));
    assert.ok(!fetched.includes("voice/ko.wav"), "the recorded K.O. stays unloaded while the clip works");
    audio.announce("announcer.ko");
    audio.speak("sam.special.prompt_burst");
    assert.deepEqual(started, ["voices/announcer-ko.ogg", "voices/sam-special-prompt-burst.ogg"]);
  } finally {
    restore();
  }
});

test("the next match frees the voice packs of fighters no longer in it (mobile memory)", async () => {
  const { audio, restore } = fakeAudio();
  try {
    await audio.loadGroup("fight", { fighters: ["sam", "dario"] });
    await audio.loadGroup("fight", { fighters: ["yann", "dario"] });
    assert.ok(!audio.clipReady("sam.win"), "sam's pack is released");
    assert.ok(audio.clipReady("dario.win") && audio.clipReady("yann.win") && audio.clipReady("announcer.ko"));
  } finally {
    restore();
  }
});

test("a clip that fails to load falls back to the recorded announcer, never to silence or speech", async () => {
  const { audio, fetched, started, restore } = fakeAudio({ fail: ["voices/announcer-ko.ogg", "voices/sam-win.ogg"] });
  try {
    await audio.loadGroup("fight", { fighters: ["sam"] });
    assert.ok(fetched.includes("voice/ko.wav") && fetched.includes("voice/winner.wav"));
    audio.announce("announcer.ko");
    assert.equal(audio.speak("sam.win", { queue: true }), null);
    audio.announceWinner("openai");
    assert.deepEqual(started, ["voice/ko.wav", "voice/winner.wav"]);
  } finally {
    restore();
  }
});
