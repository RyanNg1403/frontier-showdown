import test from "node:test";
import assert from "node:assert/strict";
import { InputDevices } from "../src/engine/input.js";
import { BTN } from "../src/combat/constants.js";

function fakeWindow() {
  const handlers = {};
  return {
    addEventListener: (type, fn) => {
      handlers[type] = fn;
    },
    removeEventListener: () => {},
    key(type, code) {
      handlers[type]({ code, repeat: false, preventDefault() {}, target: { tagName: "BODY" } });
    },
  };
}

test("keyboard: P1 WASD and buttons map to numpad directions and button bits", () => {
  const win = fakeWindow();
  const dev = new InputDevices(win);
  win.key("keydown", "KeyS");
  assert.equal(dev.read(0).dir, 2);
  win.key("keydown", "KeyD");
  assert.equal(dev.read(0).dir, 3);
  win.key("keyup", "KeyS");
  win.key("keydown", "KeyW");
  assert.equal(dev.read(0).dir, 9);
  win.key("keydown", "KeyU");
  win.key("keydown", "KeyL");
  const r = dev.read(0);
  assert.equal(r.buttons & BTN.LP, BTN.LP);
  assert.equal(r.buttons & BTN.BLOCK, BTN.BLOCK);
  assert.equal(dev.read(1).dir, 5, "P2 unaffected");
});

test("keyboard: P2 arrows plus numpad and laptop alternates", () => {
  const win = fakeWindow();
  const dev = new InputDevices(win);
  win.key("keydown", "ArrowLeft");
  win.key("keydown", "ArrowDown");
  assert.equal(dev.read(1).dir, 1);
  win.key("keydown", "Comma");
  assert.equal(dev.read(1).buttons & BTN.LP, BTN.LP);
  win.key("keydown", "Numpad2");
  assert.equal(dev.read(1).buttons & BTN.HK, BTN.HK);
});

test("keyboard: opposite directions cancel out", () => {
  const win = fakeWindow();
  const dev = new InputDevices(win);
  win.key("keydown", "KeyA");
  win.key("keydown", "KeyD");
  assert.equal(dev.read(0).dir, 5);
});

test("bindings are editable at runtime", () => {
  const win = fakeWindow();
  const dev = new InputDevices(win);
  dev.bindings.p1.LP = ["KeyF"];
  dev.refreshBound();
  win.key("keydown", "KeyF");
  assert.equal(dev.read(0).buttons & BTN.LP, BTN.LP);
});
