import test from "node:test";
import assert from "node:assert/strict";
import { InputBuffer, matchDoubleTap, matchMotion, mirrorDir, parseMotion, relDir } from "../src/combat/input.js";
import { BTN, RULES } from "../src/combat/constants.js";

function feed(buffer, steps) {
  for (const s of steps) {
    for (let i = 0; i < (s.frames ?? 1); i += 1) buffer.push({ dir: s.dir ?? 5, buttons: s.buttons ?? 0 });
  }
}

test("parseMotion understands named, numeric, MK-style and charge notation", () => {
  assert.deepEqual([...parseMotion("QCF+P").seq], [2, 3, 6]);
  assert.equal(parseMotion("QCF+P").buttonMask, BTN.LP | BTN.HP);
  assert.deepEqual([...parseMotion("DP+LP").seq], [6, 2, 3]);
  assert.deepEqual([...parseMotion("HCB+K").seq], [6, 3, 2, 1, 4]);
  assert.deepEqual([...parseMotion("236236+K").seq], [2, 3, 6, 2, 3, 6]);
  assert.deepEqual([...parseMotion("QCF,QCF+P").seq], [2, 3, 6, 2, 3, 6]);
  assert.deepEqual([...parseMotion("F,B,F+HP").seq], [6, 4, 6]);
  assert.deepEqual([...parseMotion("D,D,B+HK").seq], [2, 2, 4]);
  const charge = parseMotion("[4]6+P");
  assert.deepEqual(charge.charge, { dir: 4, frames: RULES.chargeFrames });
  assert.deepEqual([...charge.seq], [6]);
  assert.throws(() => parseMotion("XYZ+P"));
  assert.throws(() => parseMotion("QCF+Q"));
});

test("relDir mirrors left/right only", () => {
  assert.equal(mirrorDir(6), 4);
  assert.equal(mirrorDir(3), 1);
  assert.equal(mirrorDir(8), 8);
  assert.equal(relDir(6, -1), 4);
  assert.equal(relDir(6, 1), 6);
});

test("QCF+P matches facing right and mirrored facing left", () => {
  const right = new InputBuffer();
  feed(right, [{ dir: 2, frames: 2 }, { dir: 3, frames: 2 }, { dir: 6, frames: 1 }, { dir: 6, buttons: BTN.LP }]);
  assert.ok(matchMotion(right, parseMotion("QCF+P"), 1) >= 0);
  assert.equal(matchMotion(right, parseMotion("QCF+P"), -1), -1, "236 is QCB when facing left");

  const left = new InputBuffer();
  feed(left, [{ dir: 2, frames: 2 }, { dir: 1, frames: 2 }, { dir: 4, buttons: BTN.HP }]);
  assert.ok(matchMotion(left, parseMotion("QCF+P"), -1) >= 0);
});

test("motions need the right button and fail when too slow", () => {
  const b = new InputBuffer();
  feed(b, [{ dir: 2 }, { dir: 3 }, { dir: 6, buttons: BTN.LK }]);
  assert.equal(matchMotion(b, parseMotion("QCF+P"), 1), -1);
  assert.ok(matchMotion(b, parseMotion("QCF+K"), 1) >= 0);

  const slow = new InputBuffer();
  feed(slow, [{ dir: 2, frames: 2 }, { dir: 5, frames: 20 }, { dir: 3 }, { dir: 6, buttons: BTN.LP }]);
  assert.equal(matchMotion(slow, parseMotion("QCF+P"), 1), -1);
});

test("button presses stay buffered for the buffer window, then expire", () => {
  const b = new InputBuffer();
  feed(b, [{ dir: 2 }, { dir: 3 }, { dir: 6, buttons: BTN.LP }, { dir: 5, frames: RULES.bufferFrames - 1 }]);
  assert.ok(matchMotion(b, parseMotion("QCF+P"), 1) >= 0, "still inside the buffer");
  feed(b, [{ dir: 5, frames: 2 }]);
  assert.equal(matchMotion(b, parseMotion("QCF+P"), 1), -1, "expired");
});

test("consumed presses do not fire twice", () => {
  const b = new InputBuffer();
  feed(b, [{ dir: 2 }, { dir: 3 }, { dir: 6, buttons: BTN.LP }]);
  assert.ok(matchMotion(b, parseMotion("QCF+P"), 1) >= 0);
  b.consume();
  assert.equal(matchMotion(b, parseMotion("QCF+P"), 1), -1);
});

test("DP motion and its common 6-3-2-3 input both register", () => {
  const b = new InputBuffer();
  feed(b, [{ dir: 6 }, { dir: 3 }, { dir: 2 }, { dir: 3, buttons: BTN.LP }]);
  assert.ok(matchMotion(b, parseMotion("DP+P"), 1) >= 0);
});

test("repeated directions need a release in between (D,D)", () => {
  const held = new InputBuffer();
  feed(held, [{ dir: 2, frames: 6 }, { dir: 4, buttons: BTN.HK }]);
  assert.equal(matchMotion(held, parseMotion("D,D,B+HK"), 1), -1);
  const tapped = new InputBuffer();
  feed(tapped, [{ dir: 2, frames: 2 }, { dir: 5, frames: 2 }, { dir: 2, frames: 2 }, { dir: 4, buttons: BTN.HK }]);
  assert.ok(matchMotion(tapped, parseMotion("D,D,B+HK"), 1) >= 0);
});

test("charge motions require holding back long enough", () => {
  const short = new InputBuffer();
  feed(short, [{ dir: 4, frames: 20 }, { dir: 6, buttons: BTN.LP }]);
  assert.equal(matchMotion(short, parseMotion("[4]6+P"), 1), -1);

  const full = new InputBuffer();
  feed(full, [{ dir: 1, frames: RULES.chargeFrames + 2 }, { dir: 6, buttons: BTN.LP }]);
  assert.ok(matchMotion(full, parseMotion("[4]6+P"), 1) >= 0, "down-back also charges back");

  const late = new InputBuffer();
  feed(late, [{ dir: 4, frames: RULES.chargeFrames + 2 }, { dir: 5, frames: 20 }, { dir: 6, buttons: BTN.LP }]);
  assert.equal(matchMotion(late, parseMotion("[4]6+P"), 1), -1, "charge expires");

  const up = new InputBuffer();
  feed(up, [{ dir: 2, frames: RULES.chargeFrames + 2 }, { dir: 9, buttons: BTN.LK }]);
  assert.equal(matchMotion(up, parseMotion("[2]8+K"), 1), -1, "9 is not 8");
  const up2 = new InputBuffer();
  feed(up2, [{ dir: 2, frames: RULES.chargeFrames + 2 }, { dir: 8, buttons: BTN.LK }]);
  assert.ok(matchMotion(up2, parseMotion("[2]8+K"), 1) >= 0);
});

test("double tap detection for dashes", () => {
  const b = new InputBuffer();
  feed(b, [{ dir: 6, frames: 2 }, { dir: 5, frames: 3 }, { dir: 6 }]);
  assert.ok(matchDoubleTap(b, 6, 1));
  assert.equal(matchDoubleTap(b, 4, 1), false);
  assert.ok(matchDoubleTap(b, 4, -1), "forward on screen is back when facing left");

  const held = new InputBuffer();
  feed(held, [{ dir: 6, frames: 10 }]);
  assert.equal(matchDoubleTap(held, 6, 1), false);

  const slow = new InputBuffer();
  feed(slow, [{ dir: 6, frames: 2 }, { dir: 5, frames: 20 }, { dir: 6 }]);
  assert.equal(matchDoubleTap(slow, 6, 1), false);
});

test("charge info tracks hold length per direction group", () => {
  const b = new InputBuffer();
  feed(b, [{ dir: 1, frames: 30 }]);
  assert.equal(b.chargeInfo(4, 1).holding, 30);
  assert.equal(b.chargeInfo(2, 1).holding, 30);
  assert.equal(b.chargeInfo(4, -1).holding, 0, "back is right when facing left");
});
