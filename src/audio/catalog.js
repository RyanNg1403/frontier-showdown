// Sound catalog shared by the runtime (`createAudio`) and the offline generator
// (`src/audio/build/generate.mjs`). Paths are relative to `assets/audio/`.
//
// Per-sound playback defaults:
//   bus       "sfx" | "voice" (UI sounds share the sfx bus)
//   variants  number of round-robin files, named `<dir>/<name>-<n>.wav`
//   gain      dB trim applied to every play
//   pitchVar  random pitch spread in semitones (+/-)
//   volVar    random volume spread in dB (+/-)
//   maxVoices concurrent instances before the oldest is stolen

const sfx = (dir, name, variants, opts = {}) => ({ bus: "sfx", dir, name, variants, gain: 0, pitchVar: 0, volVar: 0, maxVoices: 4, ...opts });
const ui = (name, opts = {}) => ({ bus: "sfx", dir: "sfx/ui", name, variants: 1, gain: -4, pitchVar: 0, volVar: 0, maxVoices: 2, ...opts });

export const SOUNDS = {
  "hit.light": sfx("sfx/hit", "light", 3, { pitchVar: 1.5, volVar: 1.5, maxVoices: 4 }),
  "hit.heavy": sfx("sfx/hit", "heavy", 3, { pitchVar: 1.2, volVar: 1.5, maxVoices: 3 }),
  "hit.counter": sfx("sfx/hit", "counter", 2, { pitchVar: 0.8, volVar: 1, maxVoices: 2 }),
  "hit.block": sfx("sfx/hit", "block", 3, { pitchVar: 1.5, volVar: 2, maxVoices: 3, gain: -2 }),

  "whoosh.light": sfx("sfx/whoosh", "light", 2, { pitchVar: 2, volVar: 2, gain: -6 }),
  "whoosh.medium": sfx("sfx/whoosh", "medium", 2, { pitchVar: 2, volVar: 2, gain: -5 }),
  "whoosh.heavy": sfx("sfx/whoosh", "heavy", 2, { pitchVar: 1.5, volVar: 2, gain: -4 }),

  "step.walk": sfx("sfx/move", "step-walk", 4, { pitchVar: 1.5, volVar: 3, gain: -10, maxVoices: 4 }),
  "step.run": sfx("sfx/move", "step-run", 4, { pitchVar: 1.5, volVar: 3, gain: -8, maxVoices: 4 }),
  "move.dash": sfx("sfx/move", "dash", 2, { pitchVar: 1.5, volVar: 2, gain: -5 }),
  "move.jump": sfx("sfx/move", "jump", 2, { pitchVar: 1.5, volVar: 2, gain: -6 }),
  "move.land": sfx("sfx/move", "land", 2, { pitchVar: 1.5, volVar: 2, gain: -4 }),
  "body.fall": sfx("sfx/move", "body-fall", 2, { pitchVar: 1, volVar: 1.5, gain: -2 }),

  "throw.grab": sfx("sfx/throw", "grab", 2, { pitchVar: 1, volVar: 1.5, gain: -3 }),
  "throw.slam": sfx("sfx/throw", "slam", 2, { pitchVar: 0.8, volVar: 1, gain: 0 }),
  "throw.break": sfx("sfx/throw", "break", 1, { pitchVar: 1, volVar: 1, gain: -3 }),

  "stinger.special": sfx("sfx/stinger", "special", 1, { pitchVar: 0.5, gain: -3, maxVoices: 2 }),
  "stinger.super": sfx("sfx/stinger", "super", 1, { gain: -1, maxVoices: 1 }),
  "ko.impact": sfx("sfx/ko", "impact", 1, { gain: 0, maxVoices: 1 }),
  "fx.slowmo-in": sfx("sfx/ko", "slowmo-in", 1, { gain: -3, maxVoices: 1 }),
  "fx.slowmo-out": sfx("sfx/ko", "slowmo-out", 1, { gain: -5, maxVoices: 1 }),
  "tag.in": sfx("sfx/tag", "tag-in", 1, { pitchVar: 0.5, gain: -2, maxVoices: 2 }),

  "ui.move": ui("move", { pitchVar: 0.3, maxVoices: 3 }),
  "ui.confirm": ui("confirm"),
  "ui.back": ui("back"),
  "ui.lock": ui("lock", { gain: -1 }),
};

// Labs with pre-rendered "<lab> wins" lines. `say` lists pronunciations tried by the TTS.
export const LABS = {
  openai: { name: "OpenAI", say: ["Open A I", "Open A. I.", "Open ay eye"], aliases: ["open-ai"] },
  anthropic: { name: "Anthropic", say: ["Anthropic", "Ann thropic", "An-thropic"] },
  deepmind: { name: "Google DeepMind", say: ["Google DeepMind", "Google Deep Mind"], aliases: ["google", "google-deepmind", "gdm"] },
  meta: { name: "Meta", say: ["Meta", "Metta", "Mehta", "Maytah"], aliases: ["meta-ai", "fair"] },
  xai: { name: "xAI", say: ["X A I", "X. A. I.", "Ex, ay, eye", "X, A, I"], aliases: ["x-ai"] },
  mistral: { name: "Mistral", say: ["Mistral", "Miss trall", "Mis-trahl"], aliases: ["mistral-ai"] },
  deepseek: { name: "DeepSeek", say: ["Deep Seek", "DeepSeek"] },
  microsoft: { name: "Microsoft", say: ["Microsoft"], aliases: ["microsoft-ai"] },
  nvidia: { name: "NVIDIA", say: ["N Vidia", "En vidia", "Nvidia"] },
  qwen: { name: "Qwen", say: ["Kwen", "Qwen", "Kwenn"], aliases: ["alibaba"] },
  player1: { name: "Player 1", say: ["Player one"], aliases: ["p1"] },
  player2: { name: "Player 2", say: ["Player two"], aliases: ["p2"] },
};

// `text` is the line as heard (used to verify takes); `say` lists TTS spellings to try.
const voice = (name, text, say = [text], opts = {}) => ({ bus: "voice", dir: "voice", name, variants: 1, gain: 0, pitchVar: 0, volVar: 0, maxVoices: 1, text, say, ...opts });

export const VOICE = {
  "ann.round1": voice("round-1", "Round one!"),
  "ann.round2": voice("round-2", "Round two!"),
  "ann.round3": voice("round-3", "Round three!"),
  "ann.final": voice("round-final", "Final round!"),
  "ann.fight": voice("fight", "Fight!", ["Fight!", "FIGHT!"]),
  "ann.ko": voice("ko", "K.O.!", ["K O!", "Kay oh!", "K. O.!"]),
  "ann.doubleko": voice("double-ko", "Double K.O.!", ["Double K O!", "Double Kay oh!"]),
  "ann.perfect": voice("perfect", "Perfect!"),
  "ann.finish": voice("finish-them", "Finish them!"),
  "ann.time": voice("time", "Time!"),
  "ann.draw": voice("draw", "Draw!"),
  ...Object.fromEntries(Object.entries(LABS).map(([id, lab]) => [
    `ann.wins.${id}`, voice(`wins-${id}`, `${id === "xai" ? "X A I" : id === "openai" ? "Open A I" : lab.name} wins!`, lab.say.map((s) => `${s} wins!`)),
  ])),
};

// Music tracks. `stream` tracks play through a media element (long files);
// the rest are decoded loops with sample-exact loop points (seconds).
export const MUSIC = {
  menu: { file: "../frontier-soundtrack.mp3", stream: true, loop: true, gain: -3, title: "Frontier Showdown (existing soundtrack)" },
  select: { file: "music/select.wav", loop: true, gain: -2, title: "Character Select" },
  fight: { file: "music/fight.wav", loop: true, gain: -2, title: "Fight" },
  victory: { file: "music/victory.wav", loop: false, gain: -2, title: "Victory" },
};

export const ALL_SOUNDS = { ...SOUNDS, ...VOICE };

export function soundFiles(entry) {
  if (entry.variants <= 1) return [`${entry.dir}/${entry.name}.wav`];
  return Array.from({ length: entry.variants }, (_, i) => `${entry.dir}/${entry.name}-${i + 1}.wav`);
}

export function labId(lab) {
  if (!lab) return null;
  const key = String(typeof lab === "object" ? lab.id ?? lab.lab ?? lab.name : lab).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const compact = key.replace(/-/g, "");
  for (const [id, info] of Object.entries(LABS)) {
    if (id === key || id === compact) return id;
    if (info.name.toLowerCase().replace(/[^a-z0-9]/g, "") === compact) return id;
    if (info.aliases?.some((a) => a === key || a.replace(/-/g, "") === compact)) return id;
  }
  return null;
}
