// Ties dust to fighter animation frames so footfalls land on contact poses.
//
// Atlas animations may carry events either at the animation level
//   "run": { "frames": [...], "events": [{ "frame": 2, "type": "footstep", "foot": "front" }] }
// or per frame
//   "frames": [{ "x": 0, ..., "events": [{ "type": "footstep" }] }]
// Each event may add `dx`/`dy` (px, relative to the feet anchor and facing)
// and `opts` passed to the spawned effect.

export const DUST_EVENT_TYPES = {
  footstep: "dust_step",
  step: "dust_step",
  foot: "dust_step",
  run_start: "dust_run_start",
  skid: "dust_skid",
  dash: "dust_dash",
  jump: "dust_jump",
  takeoff: "dust_jump",
  land: "dust_land",
  knockdown: "dust_knockdown",
  ground_bounce: "dust_knockdown",
};

// Fallback dust for state changes, used when the target animation carries no
// explicit event of that kind.
const STATE_DUST = [
  { from: /^(idle|walk_fwd|walk_back|crouch)$/, to: /^run$/, event: "run_start" },
  { from: /^run$/, to: /^(idle|walk_fwd|walk_back|crouch|skid|block)$/, event: "skid" },
  { from: /.*/, to: /^dash_back$/, event: "dash", reverse: true },
  { from: /.*/, to: /^dash(_fwd)?$/, event: "dash" },
  { from: /^jump_start$/, to: /^jump_air$/, event: "jump" },
  { from: /^jump_air|air_attack$/, to: /^jump_land$/, event: "land" },
  { from: /.*/, to: /^knockdown$/, event: "knockdown", delay: 0.18 },
];

const LOCOMOTION = /^(walk_fwd|walk_back|walk|run)$/;

function eventsAt(anim, frameIndex) {
  const out = [];
  if (!anim) return out;
  if (Array.isArray(anim.events)) {
    for (const ev of anim.events) if (ev.frame === frameIndex) out.push(ev);
  }
  const fr = anim.frames && anim.frames[frameIndex];
  if (fr) {
    if (Array.isArray(fr.events)) out.push(...fr.events);
    else if (fr.event) out.push(typeof fr.event === "string" ? { type: fr.event } : fr.event);
  }
  return out;
}

function hasEventType(anim, type) {
  if (!anim) return false;
  if (Array.isArray(anim.events) && anim.events.some((e) => e.type === type)) return true;
  return Boolean(anim.frames && anim.frames.some((f) => (f.events || []).some((e) => e.type === type) || f.event === type));
}

// Adds footstep events to walk/run cycles that do not author their own:
// contact poses at frame 0 and halfway through the cycle.
export function inferFootfallEvents(anim, name = "") {
  if (!anim || !anim.frames || anim.frames.length < 4) return anim;
  if (hasEventType(anim, "footstep") || hasEventType(anim, "step")) return anim;
  if (name && !LOCOMOTION.test(name)) return anim;
  const half = Math.floor(anim.frames.length / 2);
  return {
    ...anim,
    events: [
      ...(anim.events || []),
      { frame: 0, type: "footstep", foot: "front", inferred: true },
      { frame: half, type: "footstep", foot: "back", inferred: true },
    ],
  };
}

// fighter: { x, y, facing (+1/-1), scale?, dustTint? }; y is the ground line.
export function createFrameEventRouter(vfx, options = {}) {
  const footSpread = options.footSpread ?? 14;
  const onEvent = options.onEvent;

  function spawnDust(fighter, type, ev = {}, extra = {}) {
    const fx = DUST_EVENT_TYPES[type];
    if (!fx) return null;
    const facing = fighter.facing < 0 ? -1 : 1;
    const footDx = ev.foot === "front" ? footSpread : ev.foot === "back" ? -footSpread : 0;
    return vfx.spawn(fx, fighter.x + ((ev.dx || 0) + footDx) * facing, fighter.y + (ev.dy || 0), {
      dir: extra.dir ?? facing,
      tint: fighter.dustTint,
      ...(fighter.dustScale ? { scale: fighter.dustScale } : {}),
      ...extra.opts,
      ...(ev.opts || {}),
    });
  }

  return {
    // Call when a fighter's animation advances to `frameIndex`.
    onFrame(fighter, animName, frameIndex, anim) {
      const evs = eventsAt(anim, frameIndex);
      for (const ev of evs) {
        if (onEvent) onEvent(fighter, ev, animName);
        if (!DUST_EVENT_TYPES[ev.type]) continue;
        const walk = /^walk/.test(animName);
        spawnDust(fighter, ev.type, ev, {
          dir: animName === "walk_back" ? -(fighter.facing < 0 ? -1 : 1) : undefined,
          opts: walk && ev.type === "footstep" ? { scale: 0.65 } : {},
        });
      }
      return evs;
    },

    // Call when a fighter's animation state changes. `nextAnim` lets explicit
    // atlas events take priority over the fallback.
    onState(fighter, prev, next, nextAnim) {
      for (const rule of STATE_DUST) {
        if (!rule.to.test(next) || !rule.from.test(prev || "")) continue;
        if (nextAnim && hasEventType(nextAnim, rule.event)) return null;
        const facing = fighter.facing < 0 ? -1 : 1;
        return spawnDust(fighter, rule.event, {}, { dir: rule.reverse ? -facing : facing, opts: rule.delay ? { delay: rule.delay } : {} });
      }
      return null;
    },

    spawnDust,
  };
}
