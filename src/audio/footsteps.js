// Atlas-driven locomotion sounds. Step sounds fire on the frames an atlas marks with a
// step event; atlases without events fall back to the contact frames of an even cycle.
//
// Accepted atlas event shapes (contract: optional per-frame "events"):
//   animations.walk_fwd.events = [{ frame: 3, type: "step" }, ...]
//   animations.walk_fwd.frames[3].events = [{ type: "step" }]   or   frames[3].event = "step"

const STEP = /step|foot|contact/i;

// Frame-event type -> sound id. `anim` disambiguates steps and whooshes.
export function soundForFrameEvent(type, anim = "") {
  const t = String(type ?? "").toLowerCase();
  const a = String(anim ?? "").toLowerCase();
  if (STEP.test(t)) return /run|dash/.test(a) ? "step.run" : "step.walk";
  if (/whoosh|swing|whiff|swipe/.test(t)) return `whoosh.${weightFromAnim(a)}`;
  if (/^land|landing/.test(t)) return "move.land";
  if (/jump|takeoff/.test(t)) return "move.jump";
  if (/dash/.test(t)) return "move.dash";
  if (/body|fall|thud|knockdown/.test(t)) return "body.fall";
  if (/grab/.test(t)) return "throw.grab";
  if (/slam/.test(t)) return "throw.slam";
  if (/tag/.test(t)) return "tag.in";
  return null;
}

export function weightFromAnim(anim) {
  const a = String(anim ?? "").toLowerCase();
  if (/heavy|super|special|throw/.test(a)) return "heavy";
  if (/light|jab/.test(a)) return "light";
  return "medium";
}

function eventsOf(animation) {
  const out = [];
  for (const e of animation?.events ?? []) if (Number.isInteger(e?.frame)) out.push({ frame: e.frame, type: e.type ?? e.name });
  (animation?.frames ?? []).forEach((f, i) => {
    for (const e of [].concat(f?.events ?? [], f?.event ?? [])) out.push({ frame: i, type: typeof e === "string" ? e : e?.type ?? e?.name });
  });
  return out;
}

// Map of frame index -> [sound ids] for one animation.
export function frameSounds(animation, animName) {
  const map = new Map();
  const add = (frame, id) => { if (id) map.set(frame, [...(map.get(frame) ?? []), id]); };
  const events = eventsOf(animation);
  for (const e of events) add(e.frame, soundForFrameEvent(e.type, animName));
  const n = animation?.frames?.length ?? 0;
  const loco = /walk|run/.test(animName);
  if (loco && n && !events.some((e) => STEP.test(e.type ?? ""))) {
    add(0, soundForFrameEvent("step", animName));
    add(Math.floor(n / 2), soundForFrameEvent("step", animName));
  }
  return map;
}

// Sounds triggered when an animation starts, for atlases that carry no events for them.
const ON_ENTER = { dash_back: "move.dash", dash_fwd: "move.dash", dash: "move.dash", jump_start: "move.jump", jump_land: "move.land", tag_in: "tag.in" };

const fighterList = (state) => {
  const list = state?.fighters ?? state?.players ?? state?.entities ?? [];
  return Array.isArray(list) ? list : Object.values(list);
};

// Call `update(game.state)` each tick (or rendered frame). Fighter fields read:
// id/key, character/characterId/charId, anim/animation/state, frame/animFrame, x.
export function createFootstepTracker(audio, { atlases = {}, width = 1280 } = {}) {
  const cache = new Map(); // `${char}:${anim}` -> Map(frame -> ids)
  const last = new Map(); // fighter key -> { anim, frame }

  function soundsFor(char, anim) {
    const key = `${char}:${anim}`;
    if (!cache.has(key)) {
      const atlas = atlases[char];
      const animation = atlas?.animations?.[anim];
      cache.set(key, animation ? frameSounds(animation, anim) : frameSounds({ frames: /walk|run/.test(anim) ? new Array(8).fill(0) : [] }, anim));
    }
    return cache.get(key);
  }

  function update(state) {
    fighterList(state).forEach((f, index) => {
      if (!f || f.active === false || f.onScreen === false) return;
      const key = f.key ?? f.slot ?? f.id ?? index;
      const char = f.character?.id ?? f.characterId ?? f.charId ?? f.character ?? f.id;
      const anim = f.anim?.name ?? f.anim ?? f.animation?.name ?? f.animation ?? f.state;
      const frame = f.frame ?? f.animFrame ?? f.anim?.frame ?? 0;
      if (typeof anim !== "string") return;
      const prev = last.get(key);
      last.set(key, { anim, frame });
      const opts = { x: f.x ?? f.pos?.x, width, pixels: true };
      const entered = !prev || prev.anim !== anim;
      if (entered && ON_ENTER[anim]) audio.play(ON_ENTER[anim], opts);
      if (!entered && prev.frame === frame) return;
      const ids = soundsFor(char, anim).get(frame);
      if (ids) for (const id of ids) if (!(entered && id === ON_ENTER[anim])) audio.play(id, opts);
    });
  }

  return { update, reset: () => last.clear(), soundsFor };
}
