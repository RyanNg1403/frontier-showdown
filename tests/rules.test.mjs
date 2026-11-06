import test from "node:test";
import assert from "node:assert/strict";
import { applyDamage, comboScale, guardBlocks, regenRed, scaledDamage, timeUpWinner } from "../src/combat/rules.js";
import { overlaps, resolvePush, toWorld } from "../src/combat/boxes.js";
import { RULES } from "../src/combat/constants.js";

test("combo scaling: two full hits, then -10% per hit down to a floor", () => {
  assert.equal(comboScale(1), 1);
  assert.equal(comboScale(2), 1);
  assert.ok(Math.abs(comboScale(3) - 0.9) < 1e-9);
  assert.ok(Math.abs(comboScale(5) - 0.7) < 1e-9);
  assert.equal(comboScale(30), RULES.scalingMin);
  assert.equal(comboScale(30, { isSuper: true }), RULES.superScalingMin);
});

test("scaled damage applies counter bonus to the first hit only", () => {
  assert.equal(scaledDamage(100, 1), 100);
  assert.equal(scaledDamage(100, 1, { counter: true }), 120);
  assert.equal(scaledDamage(100, 2, { counter: true }), 100);
  assert.equal(scaledDamage(100, 4), 80);
  assert.equal(scaledDamage(3, 30), 1, "never zero");
});

test("guard rules: lows need crouch, overheads need stand, mids either", () => {
  assert.equal(guardBlocks("mid", false), true);
  assert.equal(guardBlocks("mid", true), true);
  assert.equal(guardBlocks("high", true), true);
  assert.equal(guardBlocks("low", false), false);
  assert.equal(guardBlocks("low", true), true);
  assert.equal(guardBlocks("overhead", true), false);
  assert.equal(guardBlocks("overhead", false), true);
  assert.equal(guardBlocks("unblockable", false), false);
});

test("red health is a recoverable slice of damage taken", () => {
  const f = { health: 1000, maxHealth: 1000, red: 0 };
  applyDamage(f, 200, { redRatio: 0.5 });
  assert.equal(f.health, 800);
  assert.equal(f.red, 100);
  const healed = regenRed(f, 1);
  assert.equal(healed, RULES.redRegenPerSecond);
  assert.equal(f.health, 800 + RULES.redRegenPerSecond);
  for (let i = 0; i < 100; i += 1) regenRed(f, 1);
  assert.equal(f.health, 900);
  assert.equal(f.red, 0);
});

test("damage floors keep assists alive and red never exceeds missing health", () => {
  const f = { health: 50, maxHealth: 1000, red: 0 };
  applyDamage(f, 500, { redRatio: 0.55, floor: 1 });
  assert.equal(f.health, 1);
  assert.ok(f.red <= f.maxHealth - f.health);
});

test("time-up winner by health share, draws are null", () => {
  assert.equal(timeUpWinner([0.6, 0.4]), 0);
  assert.equal(timeUpWinner([0.2, 0.4]), 1);
  assert.equal(timeUpWinner([0.5, 0.5]), null);
});

test("boxes mirror around the anchor when facing left", () => {
  const b = { x: 20, y: -100, w: 80, h: 20 };
  assert.deepEqual(toWorld(b, 100, 0, 1), { x: 120, y: -100, w: 80, h: 20 });
  assert.deepEqual(toWorld(b, 100, 0, -1), { x: 0, y: -100, w: 80, h: 20 });
  assert.ok(overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 9, w: 5, h: 5 }));
  assert.ok(!overlaps({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 5, h: 5 }));
});

test("pushboxes separate overlapping bodies and respect walls", () => {
  const mk = (x) => ({ x, y: 0, facing: 1, push: { w: 64, h: 180 } });
  const a = mk(0);
  const b = mk(20);
  resolvePush(a, b, -900, 900);
  assert.ok(Math.abs(Math.abs(b.x - a.x) - 64) < 0.01);
  assert.ok(Math.abs(a.x + 22) < 0.01 && Math.abs(b.x - 42) < 0.01, "split evenly");

  const wallA = mk(-868);
  const c = mk(-850);
  resolvePush(wallA, c, -900, 900);
  assert.equal(wallA.x, -868, "the cornered body stays");
  assert.ok(Math.abs(c.x - -804) < 0.01);

  const jumper = { x: 10, y: -200, facing: 1, push: { w: 54, h: 140 } };
  const ground = mk(0);
  assert.equal(resolvePush(jumper, ground, -900, 900), false, "airborne above the head passes over");
});
