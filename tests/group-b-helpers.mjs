import demis from "../src/characters/demis.js";
import jensen from "../src/characters/jensen.js";
import ilya from "../src/characters/ilya.js";
import arthur from "../src/characters/arthur.js";
import { mirrorDir } from "../src/combat/input.js";
import { motionSteps } from "../src/combat/ai.js";
import { N, play } from "./helpers.mjs";

export { demis, jensen, ilya, arthur };

/**
 * Perform a special for `side`: plays the motion and presses `button` on the last direction for
 * one frame, so the move starts with moveFrame 1 when this returns.
 */
export function special(m, side, input, button, other = N) {
  const facing = m.point(side).facing;
  const steps = motionSteps(input, button).slice(0, -1).map((s) => ({ ...s, dir: facing < 0 ? mirrorDir(s.dir) : s.dir }));
  steps[steps.length - 1].frames = 1;
  play(m, side, steps, other);
}

/** Step with constant inputs until `pred()`; returns the number of steps taken. */
export function stepsUntil(m, pred, cap = 400, p1 = N, p2 = N) {
  let n = 0;
  while (!pred() && n < cap) {
    m.step([p1, p2]);
    n += 1;
  }
  return n;
}

/** Contact props for probing `match.applyContact` directly. */
export function probe(id, o = {}) {
  return {
    id, kind: o.kind || "heavy", category: o.category || "normal", damage: o.damage ?? 40, chip: 0,
    hitstun: o.hitstun ?? 20, blockstun: 14, hitstop: 8, knockback: { x: 0, y: 0 }, level: o.level || "mid",
    knockdown: false, meterGain: 0, juggle: 1, special: false,
  };
}
