import { BTN, RULES } from "../constants.js";
import { relDir } from "../input.js";
import { registerMechanic } from "../mechanics.js";

/**
 * 360 motions for command grabs (roster doc 2.1: "360 = full rotation, also accepts HCB,F").
 *
 * The move's `input` is "HCB,F+P", which the engine matches itself. This fighter-level mechanic
 * ("rotation-360") adds the full rotation through up: a rotation special with
 * `mechanicData.rotation` also starts when all four cardinals were touched, including during
 * the 4 prejump frames that pressing up begins (the genre's standard 360 leniency).
 */

const GROUPS = {
  up: (d) => d >= 7,
  down: (d) => d <= 3,
  back: (d) => d === 1 || d === 4 || d === 7,
  fwd: (d) => d === 3 || d === 6 || d === 9,
};

export const ROTATION_WINDOW = 36;
const FINAL_GAP = 9;

/** Directions (facing-relative, oldest first) end with all four cardinals inside the window. */
export function fullRotation(chrono, window = ROTATION_WINDOW) {
  const last = chrono.length - 1;
  const seen = { up: false, down: false, back: false, fwd: false };
  for (let i = Math.max(0, chrono.length - window); i <= last; i += 1) {
    for (const k of Object.keys(GROUPS)) if (GROUPS[k](chrono[i])) seen[k] = true;
    if (seen.up && seen.down && seen.back && seen.fwd) return last - i <= FINAL_GAP;
  }
  return false;
}

/** Forward, down, back, forward in order (HCB,F with or without diagonals). */
export function halfCircleForward(chrono, window = ROTATION_WINDOW) {
  const last = chrono.length - 1;
  const order = [GROUPS.fwd, GROUPS.down, GROUPS.back, GROUPS.fwd];
  let stage = 0;
  for (let i = Math.max(0, chrono.length - window); i <= last; i += 1) {
    if (!order[stage](chrono[i])) continue;
    stage += 1;
    if (stage === order.length) return last - i <= FINAL_GAP;
  }
  return false;
}

export function rotationIn(chrono, window = ROTATION_WINDOW) {
  return fullRotation(chrono, window) || halfCircleForward(chrono, window);
}

function chronoBefore(buffer, facing, pressAge) {
  const out = [];
  for (let age = pressAge + ROTATION_WINDOW; age >= pressAge; age -= 1) {
    const e = buffer.at(age);
    if (e) out.push(relDir(e.dir, facing));
  }
  return out;
}

const BUTTON_NAMES = [[BTN.HP, "HP"], [BTN.LP, "LP"], [BTN.HK, "HK"], [BTN.LK, "LK"]];

registerMechanic("rotation-360", {
  update(f, env) {
    const b = env.input;
    if (!b || !env.canAct || f.airborne) return;
    const prejump = f.state === "jump_start";
    if (!prejump && !f.isNeutral) return;
    for (const sp of f.def.specialsByRank) {
      if (!sp.mechanicData?.rotation) continue;
      const press = b.findPress(sp.motion.buttonMask, RULES.bufferFrames);
      if (!press) continue;
      const chrono = chronoBefore(b, f.facing, press.age);
      if (!(prejump ? rotationIn(chrono) : fullRotation(chrono))) continue;
      const name = BUTTON_NAMES.find(([bit]) => press.entry.pressed & bit)?.[1];
      f.startMove(sp.variants?.[name] || sp, env);
      f.moveFrame = 0;
      return;
    }
  },
});
