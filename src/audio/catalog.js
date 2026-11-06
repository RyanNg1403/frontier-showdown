// Sound catalog shared by the runtime (`createAudio`) and the offline builder
// (`src/audio/build/recordings.mjs`). Paths are relative to `assets/audio/`.
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
  "stinger.tag": sfx("sfx/stinger", "tag", 1, { gain: -4, maxVoices: 1 }),

  "ui.move": ui("move", { pitchVar: 0.3, maxVoices: 3 }),
  "ui.confirm": ui("confirm"),
  "ui.back": ui("back"),
  "ui.lock": ui("lock", { gain: -1 }),
};

// Labs the announcer recognises. Every lab's win line is the recorded "Winner!", heard only when
// the winning fighter's own win clip can't load; players 1 and 2 have their own
// "Player one/two... Winner!" lines.
export const LABS = {
  openai: { name: "OpenAI", aliases: ["open-ai"] },
  anthropic: { name: "Anthropic" },
  deepmind: { name: "Google DeepMind", aliases: ["google", "google-deepmind", "gdm"] },
  meta: { name: "Meta", aliases: ["meta-ai", "fair"] },
  xai: { name: "xAI", aliases: ["x-ai"] },
  mistral: { name: "Mistral", aliases: ["mistral-ai"] },
  deepseek: { name: "DeepSeek" },
  microsoft: { name: "Microsoft", aliases: ["microsoft-ai"] },
  nvidia: { name: "NVIDIA" },
  qwen: { name: "Qwen", aliases: ["alibaba"] },
  ssi: { name: "Safe Superintelligence", aliases: ["safe-superintelligence"] },
  "ami-labs": { name: "AMI Labs", aliases: ["ami", "advanced-machine-intelligence"] },
  uoft: { name: "University of Toronto", aliases: ["university-of-toronto", "u-of-t"] },
  "world-labs": { name: "World Labs", aliases: ["worldlabs"] },
  player1: { name: "Player 1", aliases: ["p1"] },
  player2: { name: "Player 2", aliases: ["p2"] },
};

// `text` is the line as heard.
const voice = (name, text, opts = {}) => ({ bus: "voice", dir: "voice", name, variants: 1, gain: 0, pitchVar: 0, volVar: 0, maxVoices: 1, text, ...opts });

export const VOICE = {
  "ann.round1": voice("round-1", "Round one!"),
  "ann.round2": voice("round-2", "Round two!"),
  "ann.round3": voice("round-3", "Round three!"),
  "ann.final": voice("round-final", "Final round!"),
  "ann.fight": voice("fight", "Fight!"),
  "ann.ko": voice("ko", "K.O.!"),
  "ann.doubleko": voice("double-ko", "Double K.O.!"),
  "ann.perfect": voice("perfect", "Flawless victory!"),
  "ann.finish": voice("finish-them", "Finish it!"),
  "ann.time": voice("time", "Time!"),
  "ann.draw": voice("draw", "It's a tie!"),
  "ann.winner": voice("winner", "Winner!"),
  ...Object.fromEntries(Object.keys(LABS).map((id) => [
    `ann.wins.${id}`,
    id.startsWith("player") ? voice(`wins-${id}`, `Player ${id === "player1" ? "one" : "two"}... Winner!`) : voice("winner", "Winner!", { recipe: "ann.winner" }),
  ])),
};

// Music tracks. `stream` tracks play through a media element (long files, never decoded into
// memory); the rest are decoded buffers, with sample-exact loop points (seconds) when looped.
export const MUSIC = {
  menu: { file: "music/menu.mp3", stream: true, loop: true, gain: -3, title: "Five Armies (Kevin MacLeod)" },
  select: { file: "music/select.mp3", stream: true, loop: true, gain: -3, title: "Rynos Theme (Kevin MacLeod)" },
  fight: { file: "music/fight.mp3", stream: true, loop: true, gain: -4, title: "Cyborg Ninja (Kevin MacLeod)" },
  victory: { file: "music/victory.mp3", loop: false, gain: -2, title: "Fanfare for Space (Kevin MacLeod)" },
};

export const ALL_SOUNDS = { ...SOUNDS, ...VOICE };

// Character and announcer voice clips, listed in `voices/manifest.json` as { id, character,
// text, file }. Ids: `announcer.<slug>`, `<fighter>.versus | taunt | win | tag-in`,
// `<fighter>.special.<moveId>` and `<fighter>.super.<moveId>`. They load per pack (the
// announcer, and each fighter in the match), never all up front.
export const VOICE_CLIPS = "voices/manifest.json";

export const clipEntry = ({ id, character, text, file }) => ({
  bus: "voice", files: [`voices/${file}`], variants: 1, gain: 0, pitchVar: 0, volVar: 0, maxVoices: 1, id, character, text,
});

// The recorded line that stands in for an announcer clip that failed to load. Fighter win
// clips fall back to the lab's "Winner!" (`ann.wins.<lab>`).
export const CLIP_FALLBACK = {
  "announcer.round-1": "ann.round1",
  "announcer.round-2": "ann.round2",
  "announcer.final-round": "ann.final",
  "announcer.fight": "ann.fight",
  "announcer.ko": "ann.ko",
  "announcer.double-ko": "ann.doubleko",
  "announcer.perfect": "ann.perfect",
  "announcer.time-up": "ann.time",
  "announcer.draw": "ann.draw",
  "announcer.you-win": "ann.winner",
  "announcer.player-1": "ann.wins.player1",
  "announcer.player-2": "ann.wins.player2",
};

// Recorded lines with no clip of their own; they load with the fight sounds.
export const VOICE_ONLY = ["ann.round3", "ann.finish"];

export function soundFiles(entry) {
  if (entry.files) return entry.files;
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
