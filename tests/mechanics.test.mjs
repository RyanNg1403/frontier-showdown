import test from "node:test";
import assert from "node:assert/strict";
import { BTN, N, events, hold, makeMatch, place, play, sam, dario, until } from "./helpers.mjs";
import mark from "../src/characters/mark.js";
import elon from "../src/characters/elon.js";
import { InputBuffer, matchMotion, parseMotion } from "../src/combat/input.js";
import { rotationIn } from "../src/combat/mechanics/rotation.js";
import { canGrab } from "../src/combat/mechanics/grabs.js";
import { applyGroundBounce, groundBounce } from "../src/combat/mechanics/air-dive.js";
import { GUARD_BREAK_STUN } from "../src/combat/mechanics/guard-crush.js";
import { RULES } from "../src/combat/constants.js";
import { motionSteps } from "../src/combat/ai.js";

const GUARD = { dir: 5, buttons: BTN.BLOCK };
const LOW_GUARD = { dir: 2, buttons: BTN.BLOCK };
const dirs = (list, button = BTN.LP) => list.map((dir, i) => ({ dir, buttons: i === list.length - 1 ? button : 0 }));

function feed(list) {
  const b = new InputBuffer();
  for (const e of list) b.push(e);
  return b;
}

test("360: a full rotation or HCB,F completes the motion; QCF and HCB alone do not", () => {
  const motion = parseMotion("360+P");
  assert.equal(motion.rotation, true);
  assert.deepEqual([...motion.seq], [6, 3, 2, 1, 4, 6], "HCB,F is the canonical sequence");
  const ok = (list) => matchMotion(feed(list), motion, 1) >= 0;
  assert.ok(ok(dirs([6, 3, 2, 1, 4, 6])), "HCB,F");
  assert.ok(ok(dirs([6, 2, 4, 6])), "HCB,F without diagonals (keyboard)");
  assert.ok(ok(dirs([4, 1, 2, 3, 6, 9, 8])), "rotation through up");
  assert.ok(ok(dirs([8, 6, 2, 4, 5])), "any order of the four cardinals");
  assert.ok(!ok(dirs([2, 3, 6])), "QCF");
  assert.ok(!ok(dirs([6, 3, 2, 1, 4])), "HCB without the final forward");
  assert.ok(!ok(dirs([4, 2, 6])), "back, down, forward");
  const mirrored = feed(dirs([4, 1, 2, 3, 6, 4]));
  assert.ok(matchMotion(mirrored, motion, -1) >= 0, "facing left mirrors the rotation");
});

test("360: the rotation must be recent", () => {
  const stale = [...dirs([6, 2, 4, 6], 0), ...Array.from({ length: 12 }, () => ({ dir: 5, buttons: 0 })), { dir: 5, buttons: BTN.LP }];
  assert.equal(rotationIn(stale.map((e) => e.dir)), false);
  assert.equal(matchMotion(feed(stale), parseMotion("360+P"), 1), -1);
});

test("360: the press can land in the prejump frames after up", () => {
  const m = makeMatch({ p1: [mark], p2: [sam] });
  place(m, -60, 30);
  play(m, 0, [{ dir: 4 }, { dir: 2 }, { dir: 6 }, { dir: 8 }, { dir: 8 }, { dir: 8, buttons: BTN.LP }, { frames: 40 }]);
  assert.deepEqual(events(m, "special").map((s) => s.moveId), ["send_me_location"]);
  assert.equal(events(m, "throw").length, 1);
});

test("CPU macros for the new inputs are accepted by the parser", () => {
  for (const input of ["360+P", "B,F+K", "B,F+P", "D,U,U+HK", "D,D,B+LP"]) {
    const b = new InputBuffer();
    for (const s of motionSteps(input)) for (let i = 0; i < s.frames; i += 1) b.push({ dir: s.dir, buttons: s.buttons || 0 });
    assert.ok([0, 1, 2].some(() => matchMotion(b, parseMotion(input), 1, 6) >= 0), input);
  }
});

test("command grab: unblockable, untechable, and whiffs out of range", () => {
  const m = makeMatch({ p1: [mark], p2: [sam] });
  place(m, -60, 30);
  hold(m, 6, N, GUARD);
  play(m, 0, dirs([6, 3, 2, 1, 4, 6]), GUARD);
  until(m, () => m.point(1).state === "thrown", 10, N, GUARD);
  play(m, 1, [{ buttons: BTN.LP | BTN.LK }, { frames: 50 }]);
  assert.equal(events(m, "throw").length, 1);
  assert.equal(events(m, "tech").length, 0, "command grabs cannot be teched");
  assert.equal(events(m, "hit")[0].damage, 160);

  const far = makeMatch({ p1: [mark], p2: [sam] });
  place(far, -150, 150);
  play(far, 0, [...dirs([6, 3, 2, 1, 4, 6]), { frames: 60 }]);
  assert.equal(events(far, "throw").length, 0);
  assert.equal(events(far, "special").length, 1);
});

test("anti-air grab: catches jumpers, whiffs on grounded opponents", () => {
  const air = { onField: true, ko: false, hidden: false, invulnFrames: 0, state: "jump", x: 60, y: -150, airborne: true };
  const elonF = { x: 0, airborne: false };
  const only = { air: "only", range: 140, reach: 300 };
  assert.ok(canGrab(elonF, air, only));
  assert.ok(!canGrab(elonF, { ...air, y: -320 }, only), "above the reach");
  assert.ok(!canGrab(elonF, { ...air, state: "juggle" }, only), "not juggled opponents");
  const ground = { ...air, y: 0, airborne: false, invulnTo: () => false };
  assert.ok(!canGrab(elonF, ground, only));
  assert.ok(canGrab(elonF, ground, { air: "also", range: 140, groundRange: 80 }));
  assert.ok(!canGrab(elonF, { ...ground, x: 100 }, { air: "also", range: 140, groundRange: 80 }));
  assert.ok(!canGrab(elonF, air, { range: 140 }), "plain throws never take airborne targets");

  const m = makeMatch({ p1: [elon], p2: [sam] });
  place(m, -60, 60);
  hold(m, 8, N, { dir: 8 });
  play(m, 0, [...dirs([6, 2, 3]), { frames: 70 }]);
  assert.equal(events(m, "throw").length, 1);
  assert.equal(events(m, "hit")[0].moveId, "mechazilla_catch");
  assert.equal(events(m, "hit")[0].damage, 140);
});

test("grab hold and lift: Mechazilla carries the victim up the tower before dropping them", () => {
  const m = makeMatch({ p1: [elon], p2: [sam] });
  place(m, -60, 60);
  hold(m, 8, N, { dir: 8 });
  play(m, 0, dirs([6, 2, 3]));
  until(m, () => m.point(1).state === "thrown", 20);
  const victim = m.point(1);
  let top = 0;
  let held = 0;
  while (victim.state === "thrown" && held < 80) {
    hold(m, 1);
    top = Math.min(top, victim.y);
    held += 1;
  }
  assert.ok(top <= -165, `lifted to ${top}`);
  assert.ok(held >= 33 && held <= 36, `held ${held} frames`);
  until(m, () => victim.state === "knockdown", 80);
  assert.equal(victim.state, "knockdown");
});

test("Scale Up Mechazilla also grabs grounded opponents within 80 px", () => {
  const m = makeMatch({ p1: [elon], p2: [sam] });
  place(m, -40, 30);
  m.sides[0].meter = 100;
  play(m, 0, [...dirs([6, 2, 3]), { buttons: BTN.BLOCK }, { frames: 60 }]);
  assert.equal(events(m, "scaleUp").length, 1);
  assert.equal(events(m, "throw").length, 1);
});

test("guard crush: Move Fast drains 40 Runway on block, once per move", () => {
  const m = makeMatch({ p1: [mark], p2: [sam] });
  place(m, -55, 55);
  hold(m, 6, N, GUARD);
  play(m, 0, [...dirs([2, 3, 6]), { frames: 50 }], GUARD);
  assert.equal(events(m, "block").length, 4);
  assert.equal(Math.round(m.sides[1].runway), RULES.runwayMax - 40);
});

test("guard crush: an empty Runway turns the block into a guard break", () => {
  const m = makeMatch({ p1: [mark], p2: [sam] });
  place(m, -55, 55);
  m.sides[1].runway = 30;
  hold(m, 6, N, GUARD);
  play(m, 0, dirs([2, 3, 6]), GUARD);
  until(m, () => events(m, "guardBreak").length > 0, 60, N, GUARD);
  const d = m.point(1);
  assert.equal(events(m, "guardBreak").length, 1);
  assert.equal(d.state, "hitstun");
  assert.ok(d.stun > GUARD_BREAK_STUN - 5);
  assert.equal(m.sides[1].runway, 0);
});

test("guard crack: Armor Glass makes the next block within 2 s 6 frames longer", () => {
  const blockstunOfJab = (crackFirst) => {
    const m = makeMatch({ p1: [elon], p2: [sam] });
    place(m, -210, 210);
    hold(m, 6, N, GUARD);
    if (crackFirst) {
      play(m, 0, dirs([4, 6]), GUARD);
      until(m, () => events(m, "block").length > 0, 90, N, GUARD);
      assert.ok(m.point(1).crack, "guard cracked");
      until(m, () => m.point(1).isNeutral && m.point(0).isNeutral, 90, N, GUARD);
    }
    place(m, -60, 60);
    const before = events(m, "block").length;
    play(m, 0, [{ buttons: BTN.LP }], GUARD);
    until(m, () => events(m, "block").length > before, 20, N, GUARD);
    const d = m.point(1);
    let frames = 0;
    while (d.state === "blockstun" && frames < 60) {
      hold(m, 1, N, GUARD);
      frames += 1;
    }
    return frames;
  };
  assert.equal(blockstunOfJab(true) - blockstunOfJab(false), 6);
});

test("guard crack expires after 2 s", () => {
  const m = makeMatch({ p1: [elon], p2: [sam] });
  place(m, -210, 210);
  hold(m, 6, N, GUARD);
  play(m, 0, dirs([4, 6]), GUARD);
  until(m, () => events(m, "block").length > 0, 90, N, GUARD);
  hold(m, 130, N, GUARD);
  place(m, -60, 60);
  play(m, 0, [{ buttons: BTN.LP }], GUARD);
  until(m, () => events(m, "block").length > 1, 20, N, GUARD);
  assert.equal(m.point(1).crack, null);
  assert.equal(m.point(1).stun <= 13, true);
});

function walrus(m, guard = N) {
  place(m, -150, 60);
  play(m, 0, [{ dir: 9, frames: 3 }, { dir: 5, frames: 14 }, { dir: 2, buttons: BTN.HP }, { dir: 5 }], guard);
}

test("air dive: The Walrus is down+HP in the air, an overhead that ground-bounces", () => {
  const m = makeMatch({ p1: [elon], p2: [sam] });
  walrus(m);
  until(m, () => events(m, "hit").length > 0, 40);
  const hit = events(m, "hit")[0];
  assert.equal(hit.moveId, "j_d_hp");
  assert.equal(hit.level, "overhead");
  const d = m.point(1);
  let bounced = false;
  for (let i = 0; i < 40 && d.state === "juggle"; i += 1) {
    hold(m, 1);
    if (d.vy < 0 && d.combo.bounced && d.y < -10) bounced = true;
  }
  assert.ok(bounced, "bounced off the floor");

  const low = makeMatch({ p1: [elon], p2: [sam] });
  walrus(low, LOW_GUARD);
  hold(low, 30);
  assert.equal(events(low, "hit").length, 1, "crouch-blocking loses to the overhead");
  const stand = makeMatch({ p1: [elon], p2: [sam] });
  walrus(stand, GUARD);
  hold(stand, 30, N, GUARD);
  assert.equal(events(stand, "block").length, 1);
});

test("air dive: landing recovery is short on hit, long on whiff, and the bounce combos", () => {
  const m = makeMatch({ p1: [elon], p2: [sam] });
  walrus(m);
  const e = m.point(0);
  until(m, () => e.state === "jump_land", 60);
  assert.equal(e.landingRecovery, 4);
  until(m, () => e.isNeutral, 30);
  play(m, 0, [{ dir: 2, buttons: BTN.HP }, { dir: 2, frames: 30 }]);
  const combo = events(m, "hit").map((h) => [h.moveId, h.combo]);
  assert.deepEqual(combo, [["j_d_hp", 1], ["c_hp", 2]], "Walrus, ground bounce, Rocket Uppercut");

  const whiff = makeMatch({ p1: [elon], p2: [sam] });
  place(whiff, -400, 400);
  play(whiff, 0, [{ dir: 8, frames: 3 }, { dir: 5, frames: 14 }, { dir: 2, buttons: BTN.HP }]);
  until(whiff, () => whiff.point(0).state === "jump_land", 60);
  assert.equal(whiff.point(0).landingRecovery, 14);
});

test("ground bounce happens once per combo", () => {
  const props = { move: { groundBounce: { vy: 700, slam: 900 } } };
  const d = { state: "juggle", combo: { hits: 3, bounced: true }, vy: -300, y: -50 };
  assert.equal(applyGroundBounce(d, props), false);
  assert.equal(d.vy, -300);
  d.combo = { hits: 1 };
  assert.equal(applyGroundBounce(d, props), true);
  assert.equal(d.combo.bounce, 700);
  assert.equal(d.vy, 900, "slammed into the floor");
  assert.equal(applyGroundBounce(d, props), false, "already bounced this combo");
  const env = { vfx: () => {}, shake: () => {} };
  const f = { ...d, x: 0, facing: 1, side: 1, vx: 100, def: { stats: { weight: 1 } } };
  assert.equal(groundBounce(f, env, 900), true);
  assert.equal(f.vy, -700);
  assert.equal(groundBounce(f, env, 900), false, "the bounce is spent");
});

test("low profile: Hydrofoil Rush slides under highs and through projectiles", () => {
  const fireball = sam.specials.find((s) => s.id === "prompt_burst");
  const shoot = (m) => {
    const mk = m.point(0);
    const [p] = m.spawnProjectile(m.point(1), fireball);
    p.x = mk.x + 20;
    p.y = mk.y - 110;
    hold(m, 3);
  };
  const m = makeMatch({ p1: [mark], p2: [sam] });
  place(m, -500, 500);
  play(m, 0, dirs([4, 6], BTN.HK));
  until(m, () => m.point(0).moveFrame >= 10, 20);
  shoot(m);
  assert.equal(events(m, "hit").length, 0, "the fireball passes over the hydrofoil");
  const control = makeMatch({ p1: [mark], p2: [sam] });
  place(control, -500, 500);
  shoot(control);
  assert.equal(events(control, "hit").length, 1, "the same fireball hits a standing Mark");

  const j = makeMatch({ p1: [mark], p2: [sam] });
  place(j, -200, 0);
  play(j, 0, dirs([4, 6], BTN.LK));
  until(j, () => j.point(0).moveFrame >= 9, 20);
  const boxes = j.point(0).hurtboxes();
  assert.ok(boxes.every((b) => b.y >= -64), "body is under 64 px during the glide");
});

test("stop on contact: a blocked glide skips its remaining active frames", () => {
  const m = makeMatch({ p1: [mark], p2: [sam] });
  place(m, -120, 60);
  hold(m, 6, N, LOW_GUARD);
  play(m, 0, dirs([4, 6], BTN.HK), LOW_GUARD);
  until(m, () => events(m, "block").length > 0, 40, N, LOW_GUARD);
  hold(m, 14, N, LOW_GUARD);
  const mk = m.point(0);
  assert.ok(mk.moveFrame >= mk.move.startup + mk.move.active, "in recovery right after the block");
  assert.ok(Math.abs(mk.x - m.point(1).x) < 200);
});

test("Meta passive: forward dash 2 frames shorter, hand-off entry 4 frames faster", () => {
  const dashLength = (def) => {
    const m = makeMatch({ p1: [def], p2: [dario] });
    place(m, -600, 600);
    play(m, 0, [{ dir: 6 }, { dir: 5 }, { dir: 6 }]);
    return until(m, () => m.point(0).state !== "dash_fwd", 40) + 1;
  };
  assert.equal(dashLength(sam) - dashLength(mark), 2);

  const entry = (team) => {
    const m = makeMatch({ mode: "2v2", p1: team, p2: [dario, sam] });
    hold(m, 2);
    play(m, 0, [{ buttons: BTN.TAG, frames: RULES.tagHoldFrames + 1 }]);
    const incoming = m.sides[0].members[1];
    return until(m, () => incoming.state !== "tag_in", 60) + RULES.tagHoldFrames + 1;
  };
  assert.equal(entry([sam, dario]) - entry([sam, mark]), 4);
});

test("xAI passive: +15% Compute gain below 50% health", () => {
  const gain = (health) => {
    const m = makeMatch({ p1: [elon], p2: [sam] });
    place(m, -60, 60);
    m.point(0).health = health;
    play(m, 0, [{ buttons: BTN.HP }, { frames: 30 }]);
    return m.sides[0].meter;
  };
  assert.equal(gain(1000), 5);
  assert.equal(gain(400), 5 * 1.15);
});

test("finish phase: up inputs do not jump, so D,U,U+HK finishers can be entered", () => {
  const m = makeMatch({ p1: [elon], p2: [sam] });
  m.sides[0].wins = 1;
  place(m, -300, 300);
  m.point(1).health = 1;
  m.point(0).x = 220;
  play(m, 0, [{ buttons: BTN.LP }, { frames: 20 }]);
  until(m, () => m.phase === "finish", 60);
  until(m, () => m.point(1).state === "dazed" && m.point(0).isNeutral, 60);
  play(m, 0, [{ dir: 2, frames: 2 }, { dir: 8, frames: 2 }, { dir: 5, frames: 2 }, { dir: 8, buttons: BTN.HK, frames: 2 }]);
  assert.equal(m.point(0).airborne, false);
  assert.equal(m.phase, "finisher");
  assert.equal(events(m, "finisher")[0].id, "to_the_moon");
});

test("assists can grab: the partner stays until the grab is released", () => {
  const m = makeMatch({ mode: "2v2", p1: [mark, elon], p2: [sam, dario] });
  place(m, -100, 60);
  hold(m, 2);
  m.step([{ dir: 4, buttons: BTN.ASSIST }, N]);
  const assist = m.sides[0].members[1];
  assert.equal(events(m, "assist")[0].moveId, "mechazilla_catch", "back+ASSIST calls assist B");
  until(m, () => assist.state === "attack", 40);
  const d = m.point(1);
  d.x = assist.x + 70;
  d.y = -120;
  d.vy = -200;
  d.setState("jump");
  until(m, () => assist.state !== "attack", 20);
  assert.equal(assist.state, "throwing");
  until(m, () => d.state !== "thrown", 60);
  const hit = events(m, "hit").find((h) => h.moveId === "mechazilla_catch");
  assert.equal(hit.damage, Math.round(140 * RULES.assistDamageScale), "assists deal 70%");
});
