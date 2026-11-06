// Pure helpers for touch input: stick deflection to a numpad direction, and the frame-by-frame
// script that "simple specials" plays into the engine's input buffer. No DOM access here.
import { BTN } from "../../combat/constants.js";
import { parseMotion, mirrorDir } from "../../combat/input.js";

const AXES = { 1: [-1, -1], 2: [0, -1], 3: [1, -1], 4: [-1, 0], 5: [0, 0], 6: [1, 0], 7: [-1, 1], 8: [0, 1], 9: [1, 1] };
// Counter-clockwise from screen-right, 45 degree sectors.
const SECTORS = [6, 9, 8, 7, 4, 1, 2, 3];

/** Numpad direction to `{x, y}` axes, x > 0 right, y > 0 up. */
export const dirAxes = (dir) => AXES[dir] || AXES[5];

/**
 * Stick deflection (screen px, y down) to a numpad direction. `dead` and `upDead` are fractions of
 * `radius`; up-directions need a longer pull so sweeping motions don't jump by accident.
 */
export function stickDir(dx, dy, radius, { dead = 0.26, upDead = 0.42 } = {}) {
  const dist = Math.hypot(dx, dy);
  if (dist < dead * radius) return 5;
  const angle = Math.atan2(-dy, dx);
  const idx = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  const dir = SECTORS[idx];
  if (dir >= 7 && dist < upDead * radius) {
    // Short pulls into an up sector read as the horizontal neighbour (or neutral straight up).
    return dir === 8 ? 5 : dir === 7 ? 4 : 6;
  }
  return dir;
}

const BUTTON_FOR = { LP: BTN.LP, HP: BTN.HP, LK: BTN.LK, HK: BTN.HK, P: BTN.LP, K: BTN.LK, BL: BTN.BLOCK, BLOCK: BTN.BLOCK };

/**
 * Frames that perform `input` (a contract motion string) for a fighter facing `facing`.
 * Each frame is `{dir, buttons}` in absolute numpad notation, one per 60 Hz step.
 * `strength` picks HP/HK for generic P/K buttons.
 */
export function motionScript(input, facing = 1, { strength = "light", chargeFrames } = {}) {
  const m = parseMotion(input);
  const abs = (d) => (facing < 0 ? mirrorDir(d) : d);
  const frames = [];
  const push = (dir, buttons = 0, n = 1) => { for (let i = 0; i < n; i++) frames.push({ dir: abs(dir), buttons }); };
  if (m.charge) push(m.charge.dir, 0, (chargeFrames ?? m.charge.frames) + 2);
  let prev = m.charge ? m.charge.dir : 5;
  for (const d of m.seq) {
    if (d === prev && d !== 5) push(5);
    push(d);
    prev = d;
  }
  let buttons = 0;
  for (const part of m.button.split("&").filter(Boolean)) {
    let b = BUTTON_FOR[part] ?? 0;
    if (strength === "heavy" && part === "P") b = BTN.HP;
    if (strength === "heavy" && part === "K") b = BTN.HK;
    buttons |= b;
  }
  const last = m.seq.length ? m.seq[m.seq.length - 1] : m.charge ? 5 : 5;
  push(last, buttons, 3);
  return frames;
}

/** Simple-specials mapping: stick direction (facing-relative) to a move slot. */
export function simpleSlot(relDir) {
  if (relDir === 1 || relDir === 2 || relDir === 3) return "super";
  if (relDir === 6 || relDir === 9) return 1;
  if (relDir === 4 || relDir === 7) return 2;
  return 0;
}

/** The move a simple-special press performs for a fighter: `{name, input}` or null. */
export function simpleMove(fighter, relDir) {
  if (!fighter) return null;
  const slot = simpleSlot(relDir);
  if (slot === "super") return fighter.super?.input ? fighter.super : null;
  const specials = fighter.specials || [];
  return specials[slot] || specials[0] || null;
}
