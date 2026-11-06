import { BTN } from "../combat/constants.js";
import { dirFromAxes } from "../combat/input.js";

export const DEFAULT_BINDINGS = Object.freeze({
  p1: {
    up: ["KeyW"], down: ["KeyS"], left: ["KeyA"], right: ["KeyD"],
    LP: ["KeyU"], HP: ["KeyI"], LK: ["KeyJ"], HK: ["KeyK"],
    BLOCK: ["KeyL"], TAG: ["KeyO"], ASSIST: ["KeyP"],
  },
  p2: {
    up: ["ArrowUp"], down: ["ArrowDown"], left: ["ArrowLeft"], right: ["ArrowRight"],
    LP: ["Numpad4", "Comma"], HP: ["Numpad5", "Period"], LK: ["Numpad1", "KeyM"], HK: ["Numpad2", "Slash"],
    BLOCK: ["Numpad6", "ShiftRight"], TAG: ["Numpad8", "Semicolon"], ASSIST: ["Numpad9", "Quote"],
  },
});

const PAD_BUTTONS = { up: [12], down: [13], left: [14], right: [15], LP: [2], HP: [3], LK: [0], HK: [1], BLOCK: [5, 7], TAG: [4], ASSIST: [6] };
const clonePad = () => Object.fromEntries(Object.entries(PAD_BUTTONS).map(([k, v]) => [k, [...v]]));
const DEADZONE = 0.45;

function cloneBindings() {
  return {
    p1: Object.fromEntries(Object.entries(DEFAULT_BINDINGS.p1).map(([k, v]) => [k, [...v]])),
    p2: Object.fromEntries(Object.entries(DEFAULT_BINDINGS.p2).map(([k, v]) => [k, [...v]])),
  };
}

/** Keyboard + Gamepad API reader. Produces `{dir, buttons}` per player per step. */
export class InputDevices {
  constructor(target = window) {
    this.down = new Set();
    this.bindings = cloneBindings();
    this.padBindings = { p1: clonePad(), p2: clonePad() };
    this.listeners = new Set();
    this.padStart = [false, false];
    this.boundCodes = new Set();
    this.refreshBound();
    this.onKeyDown = (e) => {
      if (e.repeat) return;
      if (this.boundCodes.has(e.code) && !isTyping(e)) e.preventDefault();
      this.down.add(e.code);
      for (const fn of this.listeners) fn(e.code, e);
    };
    this.onKeyUp = (e) => {
      this.down.delete(e.code);
    };
    this.onBlur = () => this.down.clear();
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("blur", this.onBlur);
  }

  refreshBound() {
    this.boundCodes = new Set(Object.values(this.bindings).flatMap((b) => Object.values(b).flat()));
  }

  onKey(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Accepts either a code string or a list of codes for each binding. */
  isDown(codes) {
    if (!codes) return false;
    if (typeof codes === "string") return this.down.has(codes);
    for (const c of codes) if (this.down.has(c)) return true;
    return false;
  }

  pads() {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return [];
    return [...navigator.getGamepads()].filter((p) => p && p.connected);
  }

  read(player) {
    const b = this.bindings[player === 0 ? "p1" : "p2"];
    let x = (this.isDown(b.right) ? 1 : 0) - (this.isDown(b.left) ? 1 : 0);
    let y = (this.isDown(b.up) ? 1 : 0) - (this.isDown(b.down) ? 1 : 0);
    let buttons = 0;
    for (const name of ["LP", "HP", "LK", "HK", "BLOCK", "TAG", "ASSIST"]) {
      if (this.isDown(b[name])) buttons |= BTN[name];
    }
    const pad = this.pads()[player];
    if (pad) {
      const map = this.padBindings[player === 0 ? "p1" : "p2"];
      const pressed = (i) => Boolean(pad.buttons[i]?.pressed || pad.buttons[i]?.value > 0.5);
      const any = (list) => (list || []).some(pressed);
      let px = (any(map.right) ? 1 : 0) - (any(map.left) ? 1 : 0);
      let py = (any(map.up) ? 1 : 0) - (any(map.down) ? 1 : 0);
      const ax = pad.axes[0] || 0;
      const ay = pad.axes[1] || 0;
      if (Math.abs(ax) > DEADZONE) px = Math.sign(ax);
      if (Math.abs(ay) > DEADZONE) py = -Math.sign(ay);
      if (px) x = px;
      if (py) y = py;
      for (const name of ["LP", "HP", "LK", "HK", "BLOCK", "TAG", "ASSIST"]) {
        if (any(map[name])) buttons |= BTN[name];
      }
      if (pressed(9)) buttons |= BTN.START;
    }
    if (x !== 0 && this.isDown(b.left) && this.isDown(b.right)) x = 0;
    return { dir: dirFromAxes(Math.sign(x), Math.sign(y)), buttons };
  }

  /** Rising edge of a gamepad Start button for pause. */
  startPressed(player) {
    const pad = this.pads()[player];
    const now = Boolean(pad?.buttons[9]?.pressed);
    const edge = now && !this.padStart[player];
    this.padStart[player] = now;
    return edge;
  }

  dispose(target = window) {
    target.removeEventListener("keydown", this.onKeyDown);
    target.removeEventListener("keyup", this.onKeyUp);
    target.removeEventListener("blur", this.onBlur);
  }
}

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}
