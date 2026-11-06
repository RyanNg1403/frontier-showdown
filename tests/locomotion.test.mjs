import test from "node:test";
import assert from "node:assert/strict";
import { N, hold, makeMatch, place, play, sam } from "./helpers.mjs";

const frames = (n) => Array.from({ length: n }, (_, i) => ({ x: i * 256, y: 0, w: 256, h: 256 }));
const atlas = {
  id: "sam",
  cell: { w: 256, h: 256 },
  anchor: { x: 128, y: 244 },
  animations: {
    idle: { fps: 8, loop: true, frames: frames(6) },
    walk_fwd: { fps: 12, loop: true, strideSpeed: 111, frames: frames(8) },
    walk_back: { fps: 10, loop: true, strideSpeed: 90, frames: frames(8) },
    run: { fps: 14, loop: true, strideSpeed: 404, frames: frames(8) },
    light_punch: { fps: 20, loop: false, frames: frames(6), events: [{ frame: 2, type: "hit" }] },
  },
};

test("walking moves at exactly the atlas strideSpeed", () => {
  const m = makeMatch({ atlases: new Map([["sam", atlas]]) });
  place(m, -400, 400);
  const f = m.point(0);
  hold(m, 2, { dir: 6, buttons: 0 });
  const x0 = f.x;
  const t0 = f.anim.t;
  hold(m, 60, { dir: 6, buttons: 0 });
  assert.ok(Math.abs(f.x - x0 - 111) < 1e-6, `moved ${f.x - x0}`);
  assert.ok(Math.abs(f.anim.t - t0 - 12) < 1e-6, "cycle advances fps / strideSpeed frames per px");

  const xb = f.x;
  hold(m, 2, { dir: 4, buttons: 0 });
  const xb2 = f.x;
  hold(m, 60, { dir: 4, buttons: 0 });
  assert.ok(Math.abs(xb2 - f.x - 90) < 1e-6, `walked back ${xb2 - f.x}`);
  assert.ok(xb > f.x);
});

test("running uses the run animation's strideSpeed", () => {
  const m = makeMatch({ atlases: new Map([["sam", atlas]]) });
  place(m, -800, 400);
  const f = m.point(0);
  play(m, 0, [{ dir: 6 }, { dir: 5, frames: 2 }, { dir: 6 }]);
  hold(m, 20, { dir: 6, buttons: 0 });
  assert.equal(f.state, "run");
  const x0 = f.x;
  hold(m, 30, { dir: 6, buttons: 0 });
  assert.ok(Math.abs(f.x - x0 - 202) < 1e-6, `ran ${f.x - x0}`);
});

test("feet stay planted: animation distance per frame equals stride for every walk frame", () => {
  const m = makeMatch({ atlases: new Map([["sam", atlas]]) });
  place(m, -400, 400);
  const f = m.point(0);
  hold(m, 2, { dir: 6, buttons: 0 });
  const pxPerFrame = 111 / 12;
  let lastT = f.anim.t;
  let lastX = f.x;
  for (let i = 0; i < 30; i += 1) {
    hold(m, 1, { dir: 6, buttons: 0 });
    const dt = f.anim.t - lastT;
    const dx = f.x - lastX;
    assert.ok(Math.abs(dx - dt * pxPerFrame) < 1e-6);
    lastT = f.anim.t;
    lastX = f.x;
  }
});

test("without an atlas the character's stats drive speed", () => {
  const m = makeMatch();
  place(m, -400, 400);
  const f = m.point(0);
  hold(m, 2, { dir: 6, buttons: 0 });
  const x0 = f.x;
  hold(m, 60, { dir: 6, buttons: 0 });
  assert.ok(Math.abs(f.x - x0 - sam.stats.walkSpeed) < 1e-6);
});

test("walking into a cornered opponent still animates in place", () => {
  const m = makeMatch({ atlases: new Map([["sam", atlas]]) });
  place(m, 780, 868);
  const f = m.point(0);
  hold(m, 30, { dir: 6, buttons: 0 });
  const t0 = f.anim.t;
  hold(m, 12, { dir: 6, buttons: 0 });
  assert.ok(f.anim.t > t0, "walk cycle keeps playing while pushing");
});

test("attack animations sync the hit event to the first active frame", () => {
  const m = makeMatch({ atlases: new Map([["sam", atlas]]) });
  place(m, -400, 400);
  const f = m.point(0);
  m.step([{ dir: 5, buttons: 1 }, N]);
  const seen = [];
  while (f.state === "attack") {
    seen.push([f.moveFrame, f.frameIndex()]);
    m.step([N, N]);
  }
  const atStartup = seen.find(([mf]) => mf === f.def.normals.lp.startup);
  assert.equal(atStartup[1], 2, "hit event frame shows on the startup frame");
  assert.ok(seen.filter(([mf]) => mf < f.def.normals.lp.startup).every(([, idx]) => idx < 2));
  assert.equal(seen[seen.length - 1][1], 5, "last frame shows at the end of recovery");
});

test("missing animations fall back cleanly", () => {
  const m = makeMatch({ atlases: new Map([["sam", atlas]]) });
  const f = m.point(0);
  f.setAnim("dash_fwd");
  assert.equal(f.drawAnim, "run");
  f.setAnim("super");
  assert.equal(f.drawAnim, "idle");
});
