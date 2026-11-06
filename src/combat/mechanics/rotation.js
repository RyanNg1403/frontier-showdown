import { BTN, RULES } from "../constants.js";
import { fullRotation, relDir } from "../input.js";
import { registerMechanic } from "../mechanics.js";

/**
 * 360 motions for command grabs (roster doc 2.1: "360 = full rotation, also accepts HCB,F").
 * The engine parses `"360+P"` itself (HCB,F or all four cardinals). Up starts a jump, so this
 * fighter-level mechanic ("rotation-360") also lets a 360 special start during the 4 prejump
 * frames, the genre's standard 360 leniency.
 */

export { fullRotation };
export const ROTATION_WINDOW = 36;
const FINAL_GAP = 12;

/** Forward, down, back, forward in order (HCB,F with or without diagonals). */
export function halfCircleForward(chrono, window = ROTATION_WINDOW) {
  const last = chrono.length - 1;
  const order = [(d) => d % 3 === 0, (d) => d <= 3, (d) => d % 3 === 1, (d) => d % 3 === 0];
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
    if (!b || !env.canAct || f.state !== "jump_start") return;
    for (const sp of f.def.specialsByRank) {
      if (!sp.motion?.rotation) continue;
      const press = b.findPress(sp.motion.buttonMask, RULES.bufferFrames);
      if (!press || !rotationIn(chronoBefore(b, f.facing, press.age))) continue;
      const name = BUTTON_NAMES.find(([bit]) => press.entry.pressed & bit)?.[1];
      f.startMove(sp.variants?.[name] || sp, env);
      f.moveFrame = 0;
      return;
    }
  },
});
