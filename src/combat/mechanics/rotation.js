/**
 * 360 motions for command grabs (roster doc 2.1: "360 = full rotation, also accepts HCB,F").
 * Directions here are facing-relative numpad digits (6 = forward), oldest first.
 */

const GROUPS = {
  up: (d) => d >= 7,
  down: (d) => d <= 3,
  back: (d) => d === 1 || d === 4 || d === 7,
  fwd: (d) => d === 3 || d === 6 || d === 9,
};

/** Display / CPU sequence for a 360: HCB,F, the keyboard-friendly form. */
export const ROTATION_SEQ = Object.freeze([6, 3, 2, 1, 4, 6]);

/** Frames the whole rotation must fit in, and how recent its last direction must be. */
export const ROTATION_WINDOW = 36;
const FINAL_GAP = 9;

/**
 * True when `chrono` (relative directions, newest last) ends with a 360: all four cardinal
 * groups touched within the window, or forward, down, back, forward in that order (HCB,F).
 */
export function rotationIn(chrono, window = ROTATION_WINDOW) {
  const last = chrono.length - 1;
  const start = Math.max(0, chrono.length - window);
  const seen = { up: false, down: false, back: false, fwd: false };
  let complete = -1;
  for (let i = start; i <= last; i += 1) {
    for (const k of Object.keys(GROUPS)) if (GROUPS[k](chrono[i])) seen[k] = true;
    if (complete < 0 && seen.up && seen.down && seen.back && seen.fwd) complete = i;
  }
  if (complete >= 0 && last - complete <= FINAL_GAP) return true;

  const order = [GROUPS.fwd, GROUPS.down, GROUPS.back, GROUPS.fwd];
  let stage = 0;
  for (let i = start; i <= last; i += 1) {
    if (!order[stage](chrono[i])) continue;
    stage += 1;
    if (stage === order.length) return last - i <= FINAL_GAP;
  }
  return false;
}

const prejumpCache = new WeakMap();

/**
 * Ids of a character's rotation specials. Pressing up during a 360 starts a jump, so these
 * may also start during the 4 prejump frames (the genre's standard 360 leniency).
 */
export function prejumpMoves(def) {
  let ids = prejumpCache.get(def);
  if (!ids) {
    ids = Object.freeze(def.specials.filter((s) => s.motion?.rotation).map((s) => s.id));
    prejumpCache.set(def, ids);
  }
  return ids;
}
