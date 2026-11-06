import { RULES } from "../constants.js";

/**
 * Grab targeting and timing beyond the plain throw.
 *
 * Move data: `grab: { range, damage, techable, knockback, air, groundRange, reach, hold, lift, liftFrames }`
 * - `air`: "ground" (default, the throw rules), "only" (anti-air grab: airborne targets only,
 *   whiffs on grounded ones) or "also" (both; grounded targets use `groundRange`).
 * - `reach`: how high above the floor an air grab connects (px).
 * - `hold`: frames the victim is held before the release (default: tech window + 2, or 10 when
 *   untechable). `lift` / `liftFrames`: how high the victim is carried and how fast.
 */

const NO_AIR_GRAB = new Set(["juggle", "thrown", "tech", "ko", "finished", "finisher", "breaker", "tag_in", "tag_out", "assist_in", "assist_out", "bench"]);

function airGrabbable(d) {
  if (!d.onField || d.ko || d.hidden || d.invulnFrames > 0 || NO_AIR_GRAB.has(d.state)) return false;
  const inv = d.state === "attack" ? d.move?.invuln : null;
  if (inv && d.moveFrame >= inv.from && d.moveFrame <= inv.to && (inv.type === "all" || inv.type === "throw")) return false;
  return true;
}

/** Can grabber `a` take defender `d` with `grab` this frame? Matches the throw rules for ground grabs. */
export function canGrab(a, d, grab) {
  if (!d || a.airborne) return false;
  const dx = Math.abs(a.x - d.x);
  const mode = grab.air || "ground";
  if (d.airborne) {
    if (mode === "ground") return false;
    return airGrabbable(d) && dx <= grab.range && -d.y <= (grab.reach ?? 260);
  }
  if (mode === "only" || d.invulnTo("throw")) return false;
  return dx <= (mode === "also" ? grab.groundRange ?? grab.range : grab.range);
}

/** Release frame, thrower lock length, and carry height for a grab move. */
export function grabTiming(move) {
  const g = move.grab;
  const release = g.hold ?? (g.techable ? RULES.throwTechWindow + 2 : 10);
  return {
    release,
    length: Math.max(30, move.recovery + 10, release + 8),
    lift: g.lift ?? 30,
    liftFrames: g.liftFrames ?? 6,
  };
}

/** Height of a held victim: eases from where it was grabbed up to the carry height. */
export function thrownHeight(g, frame) {
  const t = Math.min(1, frame / (g.liftFrames ?? 6));
  const from = g.fromY ?? 0;
  return from + (-(g.lift ?? 30) - from) * t;
}
