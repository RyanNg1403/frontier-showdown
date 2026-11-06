import test from "node:test";
import assert from "node:assert/strict";
import { InputBuffer, parseMotion, matchMotion, dirFromAxes } from "../src/combat/input.js";
import { BTN } from "../src/combat/constants.js";
import { motionScript, stickDir, dirAxes, simpleMove } from "../src/ui/touch/motion.js";

const R = 60;

function feed(frames) {
  const buf = new InputBuffer(60);
  for (const f of frames) buf.push(f);
  return buf;
}

/** A thumb sweeping through `points` (stick px, y down), sampled once per 60 Hz frame. */
function thumbPath(points, framesPerLeg = 3) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    for (let k = 0; k < framesPerLeg; k++) {
      const t = k / framesPerLeg;
      out.push(stickDir(ax + (bx - ax) * t, ay + (by - ay) * t, R));
    }
  }
  out.push(stickDir(...points.at(-1), R));
  return out;
}

const withButton = (dirs, mask) => [...dirs.map((dir) => ({ dir, buttons: 0 })), { dir: dirs.at(-1), buttons: mask }];

test("stick sectors map to all eight directions", () => {
  assert.equal(stickDir(0, 0, R), 5);
  assert.equal(stickDir(R, 0, R), 6);
  assert.equal(stickDir(-R, 0, R), 4);
  assert.equal(stickDir(0, R, R), 2);
  assert.equal(stickDir(0, -R, R), 8);
  assert.equal(stickDir(R, R, R), 3);
  assert.equal(stickDir(-R, R, R), 1);
  assert.equal(stickDir(R, -R, R), 9);
  assert.equal(stickDir(-R, -R, R), 7);
  // A short pull upward stays on the ground; horizontal stays horizontal.
  assert.equal(stickDir(0, -0.3 * R, R), 5);
  assert.equal(stickDir(0.25 * R, -0.25 * R, R), 6);
  for (let d = 1; d <= 9; d++) assert.equal(dirFromAxes(...dirAxes(d)), d);
});

test("thumb sweeps register QCF, QCB, DP, HCB and 360", () => {
  const cases = [
    ["QCF+P", [[0, R], [R * 0.7, R * 0.7], [R, 0]]],
    ["QCB+K", [[0, R], [-R * 0.7, R * 0.7], [-R, 0]]],
    ["DP+P", [[R, 0], [0, R], [R * 0.7, R * 0.7]]],
    ["HCB,F+P", [[R, 0], [R * 0.7, R * 0.7], [0, R], [-R * 0.7, R * 0.7], [-R, 0], [0, R * 0.2], [R, 0]]],
    ["360+P", [[R, 0], [0, R], [-R, 0], [0, -R], [R, 0]]],
  ];
  for (const [input, pts] of cases) {
    const m = parseMotion(input);
    const dirs = thumbPath(pts);
    assert.ok(matchMotion(feed(withButton(dirs, m.buttonMask & -m.buttonMask)), m, 1) >= 0, `${input} from a thumb sweep (${dirs.join("")})`);
  }
});

test("a held charge on the stick registers [4]6", () => {
  const m = parseMotion("[4]6+P");
  const dirs = [...Array(45).fill(stickDir(-R, 0, R)), stickDir(R, 0, R)];
  assert.ok(matchMotion(feed(withButton(dirs, BTN.LP)), m, 1) >= 0);
  const short = [...Array(20).fill(4), 6];
  assert.equal(matchMotion(feed(withButton(short, BTN.LP)), m, 1), -1);
});

test("simple-special scripts perform every roster motion on both sides", () => {
  const inputs = ["QCF+P", "QCB+K", "DP+P", "D,N,B+P", "F,F,F+LK", "F,D,F+HP", "B,F,B+LK", "D,U,U+HK", "360+P", "HCB,F+P", "QCF,QCF+HP", "[4]6+P", "[2]8+K", "D+HP"];
  for (const input of inputs) {
    const m = parseMotion(input);
    for (const facing of [1, -1]) {
      const frames = motionScript(input, facing);
      assert.ok(frames.length <= 50, `${input} script length`);
      const buf = new InputBuffer(60);
      let hit = -1;
      for (const f of frames) {
        buf.push(f);
        if (hit < 0) hit = matchMotion(buf, m, facing);
      }
      assert.ok(hit >= 0, `${input} facing ${facing}`);
    }
  }
});

test("simple mode picks specials by direction", () => {
  const f = { specials: [{ name: "A", input: "QCF+P" }, { name: "B", input: "DP+P" }, { name: "C", input: "QCB+K" }], super: { name: "S", input: "QCF,QCF+HP" } };
  assert.equal(simpleMove(f, 5).name, "A");
  assert.equal(simpleMove(f, 6).name, "B");
  assert.equal(simpleMove(f, 4).name, "C");
  assert.equal(simpleMove(f, 2).name, "S");
});
