import { normalizeMove } from "../../characters/schema.js";

const perFighter = new WeakMap();

/** Mechanics-only state for a fighter, kept off the Fighter object. */
export function fighterData(f) {
  let d = perFighter.get(f);
  if (!d) {
    d = { status: {}, token: null, fired: new Set(), flags: {} };
    perFighter.set(f, d);
  }
  return d;
}

/**
 * True the first time `key` is seen during the fighter's current move execution.
 * `startMove` gives every execution a fresh `hitLog` map, which serves as the token.
 */
export function fireOnce(f, key) {
  const d = fighterData(f);
  if (d.token !== f.hitLog) {
    d.token = f.hitLog;
    d.fired = new Set();
  }
  if (d.fired.has(key)) return false;
  d.fired.add(key);
  return true;
}

/** The move a fighter is executing, or null. */
export function currentMove(f) {
  return f.state === "attack" ? f.move : null;
}

const moveCache = new WeakMap();

/** Normalize an inline move (follow-ups, counters) once and reuse it. */
export function mechMove(id, raw, category = "special") {
  let m = moveCache.get(raw);
  if (!m) {
    m = Object.freeze(normalizeMove(id, raw, category, { anim: raw.anim || "heavy_punch" }));
    moveCache.set(raw, m);
  }
  return m;
}

export function boxesOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Contact props for a hit that does not come from a move's own hitbox (traps, orbs, zaps). */
export function contactProps(id, o) {
  return {
    id,
    kind: "special",
    category: "special",
    damage: o.damage ?? 30,
    chip: o.chip ?? Math.round((o.damage ?? 30) * 0.12),
    hitstun: o.hitstun ?? 18,
    blockstun: o.blockstun ?? 14,
    hitstop: o.hitstop ?? 8,
    knockback: { x: o.knockback?.x ?? 160, y: o.knockback?.y ?? 0 },
    level: o.level || "mid",
    knockdown: Boolean(o.knockdown),
    meterGain: o.meterGain ?? 4,
    juggle: o.juggle ?? 1,
    special: true,
  };
}
