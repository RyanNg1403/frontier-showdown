#!/usr/bin/env node
// Rebuilds every file under assets/audio/ from third-party recordings (CC0, CC BY, CC BY-SA).
// Each output is a recipe: source clips (trim, speed, filters), mixed at offsets, then
// cleaned, normalized and written as a mono 16-bit WAV (SFX, voice) or an MP3 (music).
// Sources and licenses are listed in assets/ATTRIBUTIONS.md.
//
//   node src/audio/build/recordings.mjs               # everything
//   node src/audio/build/recordings.mjs sfx voice     # subsets: sfx | voice | music
//
// Needs ffmpeg, unzip, and 7z (or `pip install py7zr`). Downloads are cached in
// $AUDIO_SOURCES (default: <tmp>/frontier-audio-sources).
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { MUSIC, SOUNDS, VOICE, soundFiles } from "../catalog.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = join(root, "assets/audio");
const cache = process.env.AUDIO_SOURCES || join(tmpdir(), "frontier-audio-sources");
const RATE = 44100;
const UA = "Mozilla/5.0 (X11; Linux x86_64) frontier-showdown-audio-build";

// ------------------------------------------------------------------------------- sources

const OGA = "https://opengameart.org/sites/default/files/";
const fs = (id, preview) => ({ url: preview, file: `freesound-${id}.mp3` });
const archive = (url, name) => ({ url, file: name, archive: true });
const km = (title) => ({ url: `https://incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(title)}.mp3`, file: `macleod-${title.replace(/\W+/g, "-").toLowerCase()}.mp3` });

const SOURCES = {
  kenney: archive(`${OGA}kenney_voiceoverFighter.zip`, "kenney-voiceover-fighter.zip"),
  indnu: archive(`${OGA}independent_nu_ljudbank-hits_and_punches.7z`, "independent-nu-hits.7z"),
  starninjas: archive(`${OGA}impact_-_starninjas.zip`, "starninjas-impact.zip"),
  gamevoice: archive(`${OGA}all_game_voice_audio_files_0.zip`, "tim-rockk-game-voice.zip"),
  dragonKo: { url: `${OGA}17._ko.wav`, file: "voicebosch-dragon-ko.wav" },
  warlordDouble: { url: `${OGA}03._double_kill.wav`, file: "voicebosch-warlord-double-kill.wav" },
  fiveArmies: km("Five Armies"),
  rynos: km("Rynos Theme"),
  cyborgNinja: km("Cyborg Ninja"),
  fanfare: km("Fanfare for Space"),
  fs390462: fs(390462, "https://cdn.freesound.org/previews/390/390462_1325505-hq.mp3"),
  fs564230: fs(564230, "https://cdn.freesound.org/previews/564/564230_10435241-hq.mp3"),
  fs244513: fs(244513, "https://cdn.freesound.org/previews/244/244513_2756077-hq.mp3"),
  fs222507: fs(222507, "https://cdn.freesound.org/previews/222/222507_71257-hq.mp3"),
  fs321810: fs(321810, "https://cdn.freesound.org/previews/321/321810_5501856-hq.mp3"),
  fs59988: fs(59988, "https://cdn.freesound.org/previews/59/59988_71257-hq.mp3"),
  fs420668: fs(420668, "https://cdn.freesound.org/previews/420/420668_6544098-hq.mp3"),
  fs60013: fs(60013, "https://cdn.freesound.org/previews/60/60013_71257-hq.mp3"),
  fs352719: fs(352719, "https://cdn.freesound.org/previews/352/352719_6513636-hq.mp3"),
  fs521590: fs(521590, "https://cdn.freesound.org/previews/521/521590_9395330-hq.mp3"),
  fs316923: fs(316923, "https://cdn.freesound.org/previews/316/316923_4921277-hq.mp3"),
  fs166509: fs(166509, "https://cdn.freesound.org/previews/166/166509_2792951-hq.mp3"),
  fs149302: fs(149302, "https://cdn.freesound.org/previews/149/149302_336074-hq.mp3"),
  fs464488: fs(464488, "https://cdn.freesound.org/previews/464/464488_4814007-hq.mp3"),
  fs512677: fs(512677, "https://cdn.freesound.org/previews/512/512677_10360410-hq.mp3"),
  fs572459: fs(572459, "https://cdn.freesound.org/previews/572/572459_7139862-hq.mp3"),
  fs540272: fs(540272, "https://cdn.freesound.org/previews/540/540272_11242864-hq.mp3"),
  fs417994: fs(417994, "https://cdn.freesound.org/previews/417/417994_7482766-hq.mp3"),
  fs346695: fs(346695, "https://cdn.freesound.org/previews/346/346695_2104797-hq.mp3"),
  fs504626: fs(504626, "https://cdn.freesound.org/previews/504/504626_4437257-hq.mp3"),
  fs447922: fs(447922, "https://cdn.freesound.org/previews/447/447922_9159316-hq.mp3"),
  fs187136: fs(187136, "https://cdn.freesound.org/previews/187/187136_2524193-hq.mp3"),
  fs667271: fs(667271, "https://cdn.freesound.org/previews/667/667271_2531187-hq.mp3"),
  fs609569: fs(609569, "https://cdn.freesound.org/previews/609/609569_13355471-hq.mp3"),
  fs107589: fs(107589, "https://cdn.freesound.org/previews/107/107589_1855536-hq.mp3"),
  fs237980: fs(237980, "https://cdn.freesound.org/previews/237/237980_2971294-hq.mp3"),
  fs385011: fs(385011, "https://cdn.freesound.org/previews/385/385011_270868-hq.mp3"),
  fs193170: fs(193170, "https://cdn.freesound.org/previews/193/193170_3012047-hq.mp3"),
  fs364638: fs(364638, "https://cdn.freesound.org/previews/364/364638_6387885-hq.mp3"),
  fs467997: fs(467997, "https://cdn.freesound.org/previews/467/467997_9897889-hq.mp3"),
  fs160678: fs(160678, "https://cdn.freesound.org/previews/160/160678_1554918-hq.mp3"),
  fs278205: fs(278205, "https://cdn.freesound.org/previews/278/278205_4965320-hq.mp3"),
  fs215772: fs(215772, "https://cdn.freesound.org/previews/215/215772_4027196-hq.mp3"),
  fs348239: fs(348239, "https://cdn.freesound.org/previews/348/348239_4067257-hq.mp3"),
};

// ------------------------------------------------------------------------------- recipes
//
// A layer is `[source, opts]` or `[source, path inside archive, opts]`. Layer opts:
//   start, dur   trim (s)          at     offset in the mix (s)
//   gain         dB                rate   tape-style speed/pitch factor
//   af           ffmpeg filters    reverse  play backwards
// Output opts: peak (dBFS), af (filters on the mix), fade (s, fade-out at the end),
// maxDur (s), gate (dB below peak treated as silence when trimming), onset (fraction of the
// layer's peak that marks its start).

const L = (src, a, b) => (typeof a === "string" ? { src, path: a, ...b } : { src, ...a });
const ind = (n, o) => L("indnu", `hits/hit${String(n).padStart(2, "0")}.mp3.flac`, o);
const kv = (name, o) => L("kenney", `Audio/${name}.ogg`, o);
const PUNCH_EQ = "highpass=f=45,equalizer=f=110:t=q:w=1:g=4,acompressor=threshold=-14dB:ratio=3:attack=2:release=80";
const HEAVY_EQ = "highpass=f=35,equalizer=f=90:t=q:w=1:g=6,equalizer=f=3500:t=q:w=1.5:g=-2,acompressor=threshold=-16dB:ratio=4:attack=3:release=120";
const VOICE_DRY = "highpass=f=70,equalizer=f=180:t=q:w=1:g=2,acompressor=threshold=-20dB:ratio=3:attack=4:release=150";
const VOICE_FX = `${VOICE_DRY},aecho=0.9:0.6:45|95:0.12|0.06`;

const SFX = {
  "hit.light": [
    { layers: [ind(10)], af: PUNCH_EQ, peak: -1, maxDur: 0.45 },
    { layers: [ind(14)], af: PUNCH_EQ, peak: -1, maxDur: 0.45 },
    { layers: [ind(12)], af: PUNCH_EQ, peak: -1, maxDur: 0.45 },
  ],
  "hit.heavy": [
    { layers: [ind(34), L("fs417994", { start: 0.28, dur: 0.3, gain: -10, at: 0.005 })], af: HEAVY_EQ, peak: -0.5, maxDur: 0.7 },
    { layers: [ind(37), L("fs346695", { start: 0.6, dur: 0.3, gain: -12, at: 0.005 })], af: HEAVY_EQ, peak: -0.5, maxDur: 0.7 },
    { layers: [ind(20), L("fs417994", { start: 0.28, dur: 0.3, gain: -10, at: 0.005, rate: 0.9 })], af: HEAVY_EQ, peak: -0.5, maxDur: 0.7 },
  ],
  "hit.counter": [
    { layers: [L("fs390462", {}), L("fs564230", { start: 0.2, dur: 0.5, gain: -7, at: 0.01 }), ind(21, { gain: -6, rate: 0.85 })], af: HEAVY_EQ, peak: -0.3, maxDur: 0.9 },
    { layers: [L("fs244513", {}), ind(35, { gain: -4, rate: 0.85 }), L("fs222507", { gain: -8, at: 0.01 })], af: HEAVY_EQ, peak: -0.3, maxDur: 0.9 },
  ],
  "hit.block": [
    { layers: [L("starninjas", "impact.2.ogg", {}), L("fs321810", { start: 0.08, gain: -6 })], af: "lowpass=f=6000,equalizer=f=250:t=q:w=1:g=3", peak: -2, maxDur: 0.45 },
    { layers: [L("starninjas", "impact.7.ogg", {}), L("fs321810", { start: 0.08, gain: -8, rate: 1.1 })], af: "lowpass=f=6000,equalizer=f=250:t=q:w=1:g=3", peak: -2, maxDur: 0.45 },
    { layers: [L("starninjas", "impact.8.ogg", {}), L("fs321810", { start: 0.08, gain: -8, rate: 0.92 })], af: "lowpass=f=6000,equalizer=f=250:t=q:w=1:g=3", peak: -2, maxDur: 0.45 },
  ],

  "whoosh.light": [
    { layers: [L("fs59988", { rate: 1.15 })], af: "highpass=f=200", onset: 0.005, peak: -3 },
    { layers: [L("fs420668", {})], af: "highpass=f=200", onset: 0.005, peak: -3 },
  ],
  "whoosh.medium": [
    { layers: [L("fs60013", {})], af: "highpass=f=120", onset: 0.005, peak: -2 },
    { layers: [L("fs352719", {})], af: "highpass=f=120", onset: 0.005, peak: -2 },
  ],
  "whoosh.heavy": [
    { layers: [L("fs60013", { rate: 0.78 })], af: "highpass=f=80,equalizer=f=200:t=q:w=1:g=3", onset: 0.005, peak: -1.5 },
    { layers: [L("fs352719", { rate: 0.8 })], af: "highpass=f=80,equalizer=f=200:t=q:w=1:g=3", onset: 0.005, peak: -1.5 },
  ],

  "step.walk": [0.1, 0.698, 1.262, 1.811].map((start) => ({ layers: [L("fs521590", { start: start - 0.01, dur: 0.32 })], af: "highpass=f=90", peak: -3, fade: 0.06 })),
  "step.run": [
    { layers: [L("fs316923", { start: 0.49, dur: 0.24 })], af: "highpass=f=90", peak: -3, fade: 0.05 },
    { layers: [L("fs316923", { start: 0.745, dur: 0.26 })], af: "highpass=f=90", peak: -3, fade: 0.05 },
    { layers: [L("fs316923", { start: 1.045, dur: 0.26 })], af: "highpass=f=90", peak: -3, fade: 0.05 },
    { layers: [L("fs166509", { dur: 0.25, rate: 1.05 })], af: "highpass=f=90", peak: -3, fade: 0.05 },
  ],
  "move.dash": [
    { layers: [L("fs149302", { start: 0.45, dur: 0.6, gain: 6 }), L("fs59988", { gain: -2 })], af: "highpass=f=120", peak: -2, fade: 0.08 },
    { layers: [L("fs149302", { start: 0.45, dur: 0.6, gain: 6, rate: 1.15 }), L("fs60013", { gain: -3, rate: 1.1 })], af: "highpass=f=120", peak: -2, fade: 0.08 },
  ],
  "move.jump": [
    { layers: [L("fs464488", { start: 0.4, dur: 0.5 })], af: "highpass=f=100", peak: -3, fade: 0.08 },
    { layers: [L("fs512677", {})], af: "highpass=f=100", peak: -3, fade: 0.08 },
  ],
  "move.land": [
    { layers: [L("fs572459", {})], af: "highpass=f=50,equalizer=f=120:t=q:w=1:g=3", peak: -2, fade: 0.06 },
    { layers: [L("fs540272", {})], af: "highpass=f=50,equalizer=f=120:t=q:w=1:g=3", peak: -2, fade: 0.06 },
  ],
  "body.fall": [
    { layers: [L("fs417994", { start: 0.2 })], af: "highpass=f=40", peak: -1, fade: 0.15 },
    { layers: [L("fs346695", { start: 0.55 })], af: "highpass=f=40", peak: -1, fade: 0.15 },
  ],

  "throw.grab": [
    { layers: [L("fs667271", { dur: 0.6 })], af: "highpass=f=120", peak: -3, fade: 0.1 },
    { layers: [L("fs609569", {})], af: "highpass=f=120", peak: -3, fade: 0.08 },
  ],
  "throw.slam": [
    { layers: [L("fs504626", { start: 0.1, dur: 1.1 }), ind(34, { gain: -4, at: 0.02 })], af: HEAVY_EQ, peak: -0.5, fade: 0.25 },
    { layers: [L("fs447922", {}), L("fs187136", { start: 0.35, gain: -3, at: 0.03 })], af: HEAVY_EQ, peak: -0.5, fade: 0.2 },
  ],
  "throw.break": [
    { layers: [L("fs222507", {}), L("fs60013", { gain: -6, at: 0.03, rate: 1.2 })], af: "highpass=f=100", peak: -2, fade: 0.1 },
  ],

  "stinger.special": [
    { layers: [L("fs237980", { start: 0.6, dur: 1.4, gain: -2 }), L("fs107589", { at: 0.35, gain: -3 })], af: "highpass=f=60", peak: -1.5, fade: 0.4 },
  ],
  "stinger.super": [
    { layers: [L("fs385011", { dur: 2.6 }), L("fs107589", { gain: -6, at: 0.02 })], af: "highpass=f=35", peak: -0.5, fade: 0.8 },
  ],
  "ko.impact": [
    { layers: [L("fs390462", {}), ind(34, { gain: -3 }), L("fs193170", { start: 0.6, dur: 3.2, gain: 2, at: 0.03 })], af: "highpass=f=30,equalizer=f=70:t=q:w=1:g=4", peak: -0.3, fade: 1.2 },
  ],
  "fx.slowmo-in": [
    { layers: [L("fs385011", { dur: 1.6, reverse: true })], af: "highpass=f=200,lowpass=f=9000", peak: -3, fade: 0.05 },
  ],
  "fx.slowmo-out": [
    { layers: [L("fs364638", { start: 0.55, dur: 0.8, rate: 0.85 })], af: "highpass=f=80,lowpass=f=6000", peak: -4, fade: 0.25 },
  ],
  "tag.in": [
    { layers: [L("fs467997", { start: 0.2, dur: 0.35 }), L("fs59988", { gain: -8, at: 0.0 })], af: "highpass=f=120", peak: -2, fade: 0.08 },
  ],
  "stinger.tag": [
    { layers: [L("fs385011", { dur: 1.6, rate: 0.9 })], af: "highpass=f=35,lowpass=f=7000", peak: -2, fade: 0.6 },
  ],

  "ui.move": [{ layers: [L("fs160678", {})], af: "highpass=f=300", peak: -6, fade: 0.02 }],
  "ui.confirm": [{ layers: [L("fs278205", { dur: 0.2 }), L("fs348239", { gain: -6, at: 0.02 })], af: "highpass=f=150", peak: -4, fade: 0.04 }],
  "ui.back": [{ layers: [L("fs215772", { rate: 0.75 })], af: "highpass=f=150,lowpass=f=7000", peak: -5, fade: 0.02 }],
  "ui.lock": [{ layers: [L("fs107589", { dur: 0.8 }), ind(34, { gain: -5, rate: 0.9 })], af: "highpass=f=60", peak: -2, fade: 0.25 }],
};

const kvLine = (name, o = {}) => ({ layers: [kv(name)], af: VOICE_FX, peak: -1, fade: 0.12, onset: 0.003, gate: -45, ...o });
const VOICE_RECIPES = {
  "ann.round1": kvLine("round_1"),
  "ann.round2": kvLine("round_2"),
  "ann.round3": kvLine("round_3"),
  "ann.final": kvLine("final_round"),
  "ann.fight": kvLine("fight"),
  "ann.time": kvLine("time"),
  "ann.draw": kvLine("it's_a_tie"),
  "ann.perfect": kvLine("flawless_victory"),
  "ann.winner": kvLine("winner"),
  "ann.wins.player1": { layers: [kv("player_1"), kv("winner", { at: 0.95 })], af: VOICE_FX, peak: -1, fade: 0.12, onset: 0.003, gate: -45 },
  "ann.wins.player2": { layers: [kv("player_2"), kv("winner", { at: 0.95 })], af: VOICE_FX, peak: -1, fade: 0.12, onset: 0.003, gate: -45 },
  "ann.ko": { layers: [L("dragonKo", { start: 0.12 })], af: VOICE_FX, peak: -1, fade: 0.2, onset: 0.003, gate: -45 },
  "ann.doubleko": { layers: [L("warlordDouble", { start: 0.04, dur: 0.44, af: "afade=t=out:st=0.4:d=0.04" }), L("dragonKo", { start: 0.12, at: 0.5 })], af: VOICE_FX, peak: -1, fade: 0.2, onset: 0.003, gate: -45 },
  "ann.finish": { layers: [L("gamevoice", "GF FINISH IT.wav", {})], af: VOICE_DRY, peak: -1, fade: 0.1, onset: 0.003, gate: -45 },
};

const MUSIC_RECIPES = {
  menu: { src: "fiveArmies" },
  select: { src: "rynos", dur: 96, fade: 4 },
  fight: { src: "cyborgNinja" },
  victory: { src: "fanfare", dur: 11, fade: 3 },
};

// ------------------------------------------------------------------------------- helpers

function run(cmd, args, input) {
  const r = spawnSync(cmd, args, { input, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed: ${String(r.stderr).slice(-600)}`);
  return r.stdout;
}

function fetchSource(key) {
  const s = SOURCES[key];
  if (!s) throw new Error(`unknown source ${key}`);
  mkdirSync(cache, { recursive: true });
  const file = join(cache, s.file);
  if (!existsSync(file)) {
    console.log(`  download ${s.url}`);
    run("curl", ["-sSfL", "-A", UA, "-o", file, s.url]);
  }
  if (!s.archive) return file;
  const dir = `${file}.d`;
  if (!existsSync(dir) || !readdirSync(dir).length) {
    mkdirSync(dir, { recursive: true });
    if (file.endsWith(".zip")) run("unzip", ["-o", "-q", file, "-d", dir]);
    else if (spawnSync("7z", ["--help"]).status === 0) run("7z", ["x", "-y", `-o${dir}`, file]);
    else run("python3", ["-c", "import py7zr,sys; py7zr.SevenZipFile(sys.argv[1]).extractall(sys.argv[2])", file, dir]);
  }
  return dir;
}

function findIn(dir, path) {
  const direct = join(dir, path);
  if (existsSync(direct)) return direct;
  const name = path.split("/").pop();
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) stack.push(join(d, e.name));
      else if (e.name === name) return join(d, e.name);
    }
  }
  throw new Error(`${path} not found in ${dir}`);
}

function decodeLayer(layer) {
  const base = fetchSource(layer.src);
  const file = layer.path ? findIn(base, layer.path) : base;
  const filters = [`aresample=${RATE}`];
  if (layer.start || layer.dur) filters.push(`atrim=start=${layer.start ?? 0}${layer.dur ? `:duration=${layer.dur}` : ""}`, "asetpts=N/SR/TB");
  if (layer.reverse) filters.push("areverse");
  if (layer.rate && layer.rate !== 1) filters.push(`asetrate=${Math.round(RATE * layer.rate)}`, `aresample=${RATE}`);
  if (layer.af) filters.push(layer.af);
  const raw = run("ffmpeg", ["-v", "error", "-i", file, "-af", filters.join(","), "-ac", "1", "-ar", String(RATE), "-f", "f32le", "-"]);
  return new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4);
}

function filter(samples, af) {
  if (!af) return samples;
  const input = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const raw = run("ffmpeg", ["-v", "error", "-f", "f32le", "-ar", String(RATE), "-ac", "1", "-i", "-", "-af", af, "-f", "f32le", "-"], input);
  return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
}

const peakOf = (x) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

function render(recipe) {
  const clips = recipe.layers.map((l) => ({ data: decodeLayer(l), at: Math.round((l.at ?? 0) * RATE), gain: 10 ** ((l.gain ?? 0) / 20) }));
  // Align every layer to its first transient so offsets are relative to the hit, not to the file's
  // lead-in. Speech starts with quiet consonants, so voice recipes use a much lower `onset`.
  const onset = recipe.onset ?? 0.05;
  const preroll = Math.round((onset < 0.01 ? 0.03 : 0.004) * RATE);
  for (const c of clips) {
    const p = peakOf(c.data);
    let i = 0;
    while (i < c.data.length && Math.abs(c.data[i]) < p * onset) i++;
    c.data = c.data.subarray(Math.max(0, i - preroll));
  }
  const length = Math.max(...clips.map((c) => c.at + c.data.length));
  let mix = new Float32Array(length);
  for (const c of clips) for (let i = 0; i < c.data.length; i++) mix[c.at + i] += c.data[i] * c.gain;
  // Headroom before the output filters (compressors and EQ boosts can overshoot).
  const pre = peakOf(mix);
  if (pre > 0) for (let i = 0; i < mix.length; i++) mix[i] *= 0.5 / pre;
  mix = filter(mix, recipe.af);

  const peak = peakOf(mix);
  const gate = peak * 10 ** ((recipe.gate ?? -50) / 20);
  let end = mix.length;
  while (end > 0 && Math.abs(mix[end - 1]) < gate) end--;
  end = Math.min(mix.length, end + Math.round(0.01 * RATE));
  if (recipe.maxDur) end = Math.min(end, Math.round(recipe.maxDur * RATE));
  mix = mix.slice(0, end);
  const fade = Math.min(mix.length, Math.round((recipe.fade ?? 0.03) * RATE));
  for (let i = 0; i < fade; i++) mix[mix.length - fade + i] *= Math.cos((i / fade) * Math.PI / 2) ** 2;
  const target = 10 ** ((recipe.peak ?? -1) / 20) / (peakOf(mix) || 1);
  for (let i = 0; i < mix.length; i++) mix[i] *= target;
  return mix;
}

function writeWav(path, samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.concat([header, data]));
}

const log = (path, seconds) => console.log(`${relative(root, path).padEnd(40)} ${seconds.toFixed(2)}s`);

// ------------------------------------------------------------------------------- main

const args = process.argv.slice(2);
const want = (part) => args.length === 0 || args.includes(part);

if (want("sfx")) {
  for (const [id, entry] of Object.entries(SOUNDS)) {
    const recipes = SFX[id];
    const files = soundFiles(entry);
    if (!recipes || recipes.length !== files.length) throw new Error(`${id}: ${files.length} files in the catalog, ${recipes?.length ?? 0} recipes`);
    files.forEach((file, i) => {
      const data = render(recipes[i]);
      writeWav(join(out, file), data);
      log(join(out, file), data.length / RATE);
    });
  }
}

if (want("voice")) {
  const written = new Set();
  for (const [id, entry] of Object.entries(VOICE)) {
    const file = soundFiles(entry)[0];
    if (written.has(file)) continue;
    const recipe = VOICE_RECIPES[id] ?? VOICE_RECIPES[entry.recipe];
    if (!recipe) throw new Error(`no recipe for ${id}`);
    const data = render(recipe);
    writeWav(join(out, file), data);
    written.add(file);
    log(join(out, file), data.length / RATE);
  }
}

if (want("music")) {
  for (const [id, track] of Object.entries(MUSIC)) {
    const recipe = MUSIC_RECIPES[id];
    if (!recipe) throw new Error(`no recipe for music ${id}`);
    const src = fetchSource(recipe.src);
    const path = join(out, track.file);
    mkdirSync(dirname(path), { recursive: true });
    rmSync(path, { force: true });
    const af = ["silenceremove=start_periods=1:start_threshold=-60dB", "areverse", "silenceremove=start_periods=1:start_threshold=-60dB", "areverse"];
    if (recipe.dur) af.push(`atrim=duration=${recipe.dur}`, `afade=t=out:st=${recipe.dur - recipe.fade}:d=${recipe.fade}`);
    af.push("loudnorm=I=-16:TP=-1.5:LRA=11");
    run("ffmpeg", ["-v", "error", "-y", "-i", src, "-af", af.join(","), "-ar", String(RATE), "-ac", "2", "-map_metadata", "-1", "-c:a", "libmp3lame", "-q:a", "4", path]);
    const seconds = Number(String(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path])).trim());
    log(path, seconds);
  }
}
