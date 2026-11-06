import { BTN, RULES } from "./constants.js";

const MIRROR = [0, 3, 2, 1, 6, 5, 4, 9, 8, 7];

export function mirrorDir(dir) {
  return MIRROR[dir] || 5;
}

export function relDir(dir, facing) {
  return facing < 0 ? mirrorDir(dir) : dir;
}

/** Numpad direction from axes where x > 0 is right and y > 0 is up. */
export function dirFromAxes(x, y) {
  const col = x < 0 ? 0 : x > 0 ? 2 : 1;
  const row = y < 0 ? 0 : y > 0 ? 2 : 1;
  return row * 3 + col + 1;
}

export const isDown = (d) => d === 1 || d === 2 || d === 3;
export const isUp = (d) => d === 7 || d === 8 || d === 9;
export const isBack = (d) => d === 1 || d === 4 || d === 7;
export const isFwd = (d) => d === 3 || d === 6 || d === 9;

const CHARGE_GROUPS = {
  4: isBack,
  2: isDown,
  6: isFwd,
  8: isUp,
};

export const NEUTRAL_INPUT = Object.freeze({ dir: 5, buttons: 0 });

/** Per-player history of raw (absolute-direction) inputs, newest last. */
export class InputBuffer {
  constructor(size = 60) {
    this.size = size;
    this.entries = [];
    this.frame = 0;
    this.holds = { left: 0, right: 0, down: 0, up: 0 };
    this.lastHold = { left: null, right: null, down: null, up: null };
    this.consumed = 0;
  }

  push(input = NEUTRAL_INPUT) {
    const dir = input.dir || 5;
    const buttons = input.buttons | 0;
    const prev = this.entries[this.entries.length - 1];
    const prevButtons = prev ? prev.buttons : 0;
    this.frame += 1;
    const entry = {
      frame: this.frame,
      dir,
      buttons,
      pressed: buttons & ~prevButtons,
      released: prevButtons & ~buttons,
    };
    this.entries.push(entry);
    if (this.entries.length > this.size) this.entries.shift();
    this.#trackHold("left", dir === 1 || dir === 4 || dir === 7);
    this.#trackHold("right", dir === 3 || dir === 6 || dir === 9);
    this.#trackHold("down", isDown(dir));
    this.#trackHold("up", isUp(dir));
    return entry;
  }

  #trackHold(key, held) {
    if (held) {
      this.holds[key] += 1;
    } else if (this.holds[key] > 0) {
      this.lastHold[key] = { frames: this.holds[key], endFrame: this.frame };
      this.holds[key] = 0;
    }
  }

  /** age 0 = newest entry. */
  at(age = 0) {
    return this.entries[this.entries.length - 1 - age] || null;
  }

  get current() {
    return this.at(0) || { frame: this.frame, dir: 5, buttons: 0, pressed: 0, released: 0 };
  }

  held(mask) {
    return (this.current.buttons & mask) !== 0;
  }

  dir(facing = 1) {
    return relDir(this.current.dir, facing);
  }

  /** Newest unconsumed press of any bit in `mask` within the last `window` frames. */
  findPress(mask, window = RULES.bufferFrames) {
    for (let age = 0; age < window; age += 1) {
      const e = this.at(age);
      if (!e) break;
      if (e.frame <= this.consumed) break;
      if (e.pressed & mask) return { age, entry: e };
    }
    return null;
  }

  /** Was any bit in `mask` pressed in the last `window` frames, ignoring consumption? */
  pressedWithin(mask, window) {
    for (let age = 0; age < window; age += 1) {
      const e = this.at(age);
      if (!e) break;
      if (e.pressed & mask) return true;
    }
    return false;
  }

  pressedNow(mask) {
    const e = this.current;
    return e.frame > this.consumed && (e.pressed & mask) !== 0;
  }

  consume() {
    this.consumed = this.frame;
  }

  /** Frames a relative direction group has been held, for charge moves. */
  chargeInfo(chargeDir, facing) {
    let key;
    if (chargeDir === 2) key = "down";
    else if (chargeDir === 8) key = "up";
    else if (chargeDir === 4) key = facing >= 0 ? "left" : "right";
    else key = facing >= 0 ? "right" : "left";
    return { holding: this.holds[key], last: this.lastHold[key] };
  }

  clear() {
    this.entries.length = 0;
    this.holds = { left: 0, right: 0, down: 0, up: 0 };
    this.lastHold = { left: null, right: null, down: null, up: null };
    this.consumed = this.frame;
  }
}

const NAMED = {
  QCF: [2, 3, 6],
  QCB: [2, 1, 4],
  DP: [6, 2, 3],
  RDP: [4, 2, 1],
  HCF: [4, 1, 2, 3, 6],
  HCB: [6, 3, 2, 1, 4],
  F: [6], B: [4], U: [8], D: [2], N: [5],
  DF: [3], DB: [1], UF: [9], UB: [7],
};

const BUTTON_TOKENS = {
  LP: BTN.LP, HP: BTN.HP, LK: BTN.LK, HK: BTN.HK,
  P: BTN.LP | BTN.HP, K: BTN.LK | BTN.HK,
  BL: BTN.BLOCK, BLOCK: BTN.BLOCK,
};

const cache = new Map();

/**
 * Parse a motion string such as "QCF+P", "[4]6+HP", "F,B,F+HP" or "236236+K".
 * Returns { raw, seq, charge, button, buttonMask, all }.
 */
export function parseMotion(raw) {
  if (cache.has(raw)) return cache.get(raw);
  const text = String(raw).toUpperCase().replace(/\s+/g, "");
  const plus = text.lastIndexOf("+");
  const motionPart = plus >= 0 ? text.slice(0, plus) : text;
  const buttonPart = plus >= 0 ? text.slice(plus + 1) : "";
  let charge = null;
  const seq = [];
  let body = motionPart;
  const chargeMatch = body.match(/^\[([1-9])\]/);
  if (chargeMatch) {
    charge = { dir: Number(chargeMatch[1]), frames: RULES.chargeFrames };
    body = body.slice(chargeMatch[0].length);
  }
  const tokens = body.split(",").filter(Boolean);
  for (const token of tokens) {
    if (NAMED[token]) seq.push(...NAMED[token]);
    else if (/^[1-9]+$/.test(token)) seq.push(...token.split("").map(Number));
    else throw new Error(`Unknown motion token "${token}" in "${raw}"`);
  }
  let buttonMask = 0;
  let all = false;
  if (buttonPart) {
    const parts = buttonPart.split("&");
    for (const p of parts) {
      if (!(p in BUTTON_TOKENS)) throw new Error(`Unknown button "${p}" in "${raw}"`);
      buttonMask |= BUTTON_TOKENS[p];
    }
    all = parts.length > 1;
  }
  const parsed = Object.freeze({ raw, seq: Object.freeze(seq), charge, button: buttonPart, buttonMask, all });
  cache.set(raw, parsed);
  return parsed;
}

/** Ranking used to try longer / harder commands first. */
export function motionPriority(motion) {
  return motion.seq.length + (motion.charge ? 3 : 0);
}

const STEP_GAP = 12;
const FINAL_GAP = 9;

/**
 * Check whether `motion` was performed, ending with an unconsumed button press
 * within the buffer window. Returns the press age or -1.
 */
export function matchMotion(buffer, motion, facing, window = RULES.bufferFrames) {
  if (!motion.buttonMask) return -1;
  for (let pressAge = 0; pressAge < window; pressAge += 1) {
    const press = buffer.at(pressAge);
    if (!press || press.frame <= buffer.consumed) break;
    if (!(press.pressed & motion.buttonMask)) continue;
    if (motion.all && (press.buttons & motion.buttonMask) !== motion.buttonMask) continue;
    if (sequenceBefore(buffer, motion, facing, pressAge)) return pressAge;
  }
  return -1;
}

function sequenceBefore(buffer, motion, facing, pressAge) {
  const seq = motion.seq;
  const span = Math.min(buffer.entries.length - 1 - pressAge, STEP_GAP * (seq.length + 1) + 4);
  const chrono = [];
  for (let age = pressAge + span; age >= pressAge; age -= 1) {
    const e = buffer.at(age);
    if (e) chrono.push(relDir(e.dir, facing));
  }
  const last = chrono.length - 1;
  let earliest = 0;
  if (motion.charge) {
    const ok = chargeSatisfied(buffer, motion.charge, facing, pressAge);
    if (!ok) return false;
    earliest = Math.max(0, last - ok.sinceEnd - 1);
  }
  if (seq.length === 0) return true;

  for (let start = earliest; start <= last; start += 1) {
    if (chrono[start] !== seq[0]) continue;
    let pos = start;
    let ok = true;
    for (let k = 1; k < seq.length; k += 1) {
      const want = seq[k];
      const needFresh = want === seq[k - 1];
      let found = -1;
      let sawOther = false;
      for (let i = pos + 1; i <= Math.min(last, pos + STEP_GAP); i += 1) {
        if (chrono[i] !== want) {
          sawOther = true;
          continue;
        }
        if (needFresh && !sawOther) continue;
        found = i;
        break;
      }
      if (found < 0) {
        ok = false;
        break;
      }
      pos = found;
    }
    if (ok && last - pos <= FINAL_GAP) return true;
  }
  return false;
}

function chargeSatisfied(buffer, charge, facing, pressAge) {
  const info = buffer.chargeInfo(charge.dir, facing);
  const pressFrame = buffer.frame - pressAge;
  if (info.last && info.last.frames >= charge.frames) {
    const sinceEnd = pressFrame - info.last.endFrame;
    if (sinceEnd >= 0 && sinceEnd <= STEP_GAP) return { sinceEnd };
  }
  return null;
}

/** "F,F" / "B,B" dash detection: two fresh taps of a relative direction within `window` frames. */
export function matchDoubleTap(buffer, want, facing, window = 14) {
  const newest = buffer.at(0);
  if (!newest || newest.frame <= buffer.consumed) return false;
  const prev = buffer.at(1);
  if (relDir(newest.dir, facing) !== want || (prev && relDir(prev.dir, facing) === want)) return false;
  let sawOther = false;
  for (let age = 1; age <= window; age += 1) {
    const e = buffer.at(age);
    if (!e) return false;
    const d = relDir(e.dir, facing);
    if (d !== want) {
      sawOther = true;
      continue;
    }
    if (sawOther) {
      const before = buffer.at(age + 1);
      if (!before || relDir(before.dir, facing) !== want) return true;
    }
  }
  return false;
}

export function chargeGroup(dir) {
  return CHARGE_GROUPS[dir];
}
