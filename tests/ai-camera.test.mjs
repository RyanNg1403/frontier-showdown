import test from "node:test";
import assert from "node:assert/strict";
import { Match } from "../src/combat/match.js";
import { DIFFICULTIES, createCpu, motionSteps } from "../src/combat/ai.js";
import { InputBuffer, matchMotion, parseMotion } from "../src/combat/input.js";
import { Camera } from "../src/engine/camera.js";
import { createLoop } from "../src/engine/loop.js";
import { dario, sam } from "./helpers.mjs";

const PHASES = new Set(["intro", "fight", "ko", "finish", "finisher", "roundEnd", "matchEnd"]);

function cpuMatch({ mode = "1v1", d0 = "normal", d1 = "normal", seed = 1 }) {
  const teams = mode === "2v2" ? [[sam, dario], [dario, sam]] : [[sam], [dario]];
  const m = new Match({
    mode,
    seed,
    sides: [
      { team: teams[0], control: "cpu", cpu: createCpu(d0, seed * 7 + 1) },
      { team: teams[1], control: "cpu", cpu: createCpu(d1, seed * 13 + 5) },
    ],
  });
  m.start();
  return m;
}

function runToEnd(m, cap = 60 * 60 * 8) {
  let n = 0;
  while (m.phase !== "matchEnd" && n < cap) {
    m.step();
    n += 1;
    for (const f of m.allFighters) {
      assert.ok(f.health >= 0 && f.health <= f.maxHealth, `health out of range: ${f.health}`);
      assert.ok(Number.isFinite(f.x) && Number.isFinite(f.y));
      if (f.onField && f.state !== "bench" && !f.state.startsWith("tag") && !f.state.startsWith("assist")) {
        assert.ok(f.x >= m.bounds.left - 1 && f.x <= m.bounds.right + 1, `x out of stage: ${f.x} (${f.state})`);
      }
    }
    assert.ok(PHASES.has(m.phase));
  }
  return n;
}

test("CPU motion macros produce inputs the parser accepts", () => {
  for (const input of ["QCF+P", "DP+P", "QCB+K", "[4]6+P", "[2]8+K", "QCF,QCF+K", "F,B,F+HP", "D,D,B+HK"]) {
    const b = new InputBuffer();
    for (const s of motionSteps(input)) for (let i = 0; i < s.frames; i += 1) b.push({ dir: s.dir, buttons: s.buttons || 0 });
    const ok = [0, 1, 2].some(() => matchMotion(b, parseMotion(input), 1, 6) >= 0);
    assert.ok(ok, `${input} macro`);
  }
});

for (const diff of Object.keys(DIFFICULTIES)) {
  test(`CPU vs CPU (${diff}) finishes 1v1 and 2v2 matches without breaking invariants`, () => {
    for (const mode of ["1v1", "2v2"]) {
      const m = cpuMatch({ mode, d0: diff, d1: "normal", seed: 3 });
      runToEnd(m);
      assert.equal(m.phase, "matchEnd", `${mode} ${diff} did not finish`);
    }
  });
}

test("harder CPUs beat easier ones", () => {
  let hardWins = 0;
  const seeds = [1, 2, 3, 4, 5, 6, 7];
  for (const seed of seeds) {
    const m = cpuMatch({ d0: "hard", d1: "easy", seed });
    runToEnd(m);
    if (m.winner === 0) hardWins += 1;
  }
  assert.ok(hardWins >= 5, `hard won ${hardWins}/${seeds.length}`);
});

test("camera keeps both fighters on screen and stays inside the stage", () => {
  const cam = new Camera();
  const bounds = { left: -900, right: 900 };
  for (const [a, b] of [[-100, 100], [-500, 500], [-880, -700], [600, 880]]) {
    const fs = [{ x: a, y: 0 }, { x: b, y: 0 }];
    cam.snap(fs, bounds);
    for (const f of fs) {
      const s = cam.worldToScreen(f.x, f.y - 100);
      assert.ok(s.x > 0 && s.x < cam.viewW, `fighter at ${f.x} off screen (${s.x})`);
    }
    assert.ok(cam.left >= bounds.left - 1e-6 && cam.right <= bounds.right + 1e-6);
    assert.ok(cam.zoom >= cam.minZoom && cam.zoom <= cam.maxZoom);
    const ground = cam.worldToScreen(0, 0);
    assert.ok(Math.abs(ground.y - 640) < 1e-6, "ground rests near screen y 640");
  }
  cam.snap([{ x: 0, y: -400 }, { x: 100, y: 0 }], bounds);
  assert.ok(cam.worldToScreen(0, -600).y >= 49, "camera rises to keep a high jumper's head visible");
});

test("fixed-step loop runs whole steps at 60 Hz independent of frame rate", () => {
  let steps = 0;
  let renders = 0;
  let t = 0;
  let cb = null;
  const loop = createLoop({ step: () => (steps += 1), render: () => (renders += 1), raf: (fn) => (cb = fn) });
  loop.start();
  for (let i = 0; i < 30; i += 1) {
    t += 1000 / 30;
    cb(t);
  }
  assert.ok(Math.abs(steps - 58) <= 2, `steps ${steps}`);
  assert.equal(renders, 30);
  loop.stop();
});
