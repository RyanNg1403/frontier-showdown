import test from "node:test";
import assert from "node:assert/strict";
import { applyUiSettings } from "../src/engine/ui-adapter.js";
import { DEFAULT_BINDINGS } from "../src/ui/core/settings.js";
import { drawMechanics } from "../src/engine/mechanics-render.js";

function fakeDevices() {
  const bindings = { p1: {}, p2: {} };
  return { bindings, padBindings: { p1: {}, p2: {} }, refreshBound() {} };
}

test("UI default bindings keep the contract's P2 laptop alternates", () => {
  const devices = fakeDevices();
  applyUiSettings({ controls: DEFAULT_BINDINGS }, { devices, audio: null, options: {} });
  assert.deepEqual(devices.bindings.p2.LP, ["Numpad4", "Comma"]);
  assert.deepEqual(devices.bindings.p2.HP, ["Numpad5", "Period"]);
  assert.deepEqual(devices.bindings.p2.LK, ["Numpad1", "KeyM"]);
  assert.deepEqual(devices.bindings.p2.HK, ["Numpad2", "Slash"]);
  assert.deepEqual(devices.bindings.p2.BLOCK, ["Numpad6", "ShiftRight"]);
  assert.deepEqual(devices.bindings.p2.TAG, ["Numpad8", "Semicolon"]);
  assert.deepEqual(devices.bindings.p1.BLOCK, ["KeyL"], "P1 matches the engine: Block on L");
  assert.deepEqual(devices.bindings.p1.TAG, ["KeyO"]);
});

test("an alternate that collides with a remapped primary key is dropped", () => {
  const devices = fakeDevices();
  const controls = structuredClone(DEFAULT_BINDINGS);
  controls.p1.keyboard.lightPunch = "Comma";
  applyUiSettings({ controls }, { devices, audio: null, options: {} });
  assert.deepEqual(devices.bindings.p1.LP, ["Comma"]);
  assert.deepEqual(devices.bindings.p2.LP, ["Numpad4"], "P2 loses Comma rather than sharing it");
});

function recordingCtx() {
  const fills = [];
  const strokes = [];
  const handler = {
    get(target, key) {
      if (key in target) return target[key];
      return () => {};
    },
    set(target, key, value) {
      if (key === "fillStyle") fills.push(value);
      if (key === "strokeStyle") strokes.push(value);
      target[key] = value;
      return true;
    },
  };
  return { ctx: new Proxy({}, handler), fills, strokes };
}

function slowedMatch(status) {
  const f = { x: 0, y: 0, onField: true, state: "idle", uid: 1, facing: 1 };
  return { fighters: [f], mech: { objects: [], status: (_, name) => (name === "slow" ? status : null) } };
}

test("slow overlays follow their source: icing only for the cake, wind for the gust", () => {
  const icing = recordingCtx();
  drawMechanics(icing.ctx, slowedMatch({ frames: 30, look: "icing" }), 0, "back");
  assert.ok(icing.fills.includes("#f7e7ef"), "cake slow draws icing");

  const gust = recordingCtx();
  drawMechanics(gust.ctx, slowedMatch({ frames: 30, wind: true }), 0, "back");
  assert.ok(!gust.fills.includes("#f7e7ef"), "Mistral Gust does not draw icing");
  assert.ok(gust.strokes.includes("#9be7ff"), "Mistral Gust draws its wind trail");

  const plain = recordingCtx();
  drawMechanics(plain.ctx, slowedMatch({ frames: 30 }), 0, "back");
  assert.ok(!plain.fills.includes("#f7e7ef"), "an unlabeled slow draws no icing");
});
