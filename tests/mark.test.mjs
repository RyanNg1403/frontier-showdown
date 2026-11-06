import test from "node:test";
import assert from "node:assert/strict";
import { BTN, N, dario, events, hold, makeMatch, place, play, sam, until } from "./helpers.mjs";
import mark from "../src/characters/mark.js";
import { InputBuffer, matchMotion, parseMotion } from "../src/combat/input.js";
import { fullRotation, halfCircleForward, rotationIn } from "../src/combat/mechanics/rotation.js";
import { GUARD_BREAK_STUN } from "../src/combat/mechanics/guard-crush.js";
import { RULES } from "../src/combat/constants.js";
import { motionSteps } from "../src/combat/ai.js";

const GUARD = { dir: 5, buttons: BTN.BLOCK };
const LOW_GUARD = { dir: 2, buttons: BTN.BLOCK };
const motion = (dirs, button) => dirs.map((dir, i) => ({ dir, buttons: i === dirs.length - 1 ? button : 0 }));
const QCF = (b) => motion([2, 3, 6], b);
const BF = (b) => motion([4, 6], b);
const HCBF = (b) => motion([6, 3, 2, 1, 4, 6], b);
const SUPER = motion([2, 3, 6, 2, 3, 6], BTN.HP);

test("Mark follows the roster doc kit", () => {
  assert.deepEqual(mark.specials.map((s) => [s.id, s.input]), [["send_me_location", "HCB,F+P"], ["hydrofoil_rush", "B,F+K"], ["move_fast", "QCF+P"]]);
  assert.ok(mark.specials[0].mechanicData.rotation, "Send Me Location also takes a full 360");
  assert.equal(mark.super.id, "metaverse_submission");
  assert.deepEqual([mark.finisher.id, mark.finisher.input, mark.finisher.rangeName], ["fourth_of_july", "D,D,B+LP", "close"]);
  assert.deepEqual({ ...mark.assists }, { a: "move_fast", b: "hydrofoil_rush" });
  assert.deepEqual([mark.stats.health, mark.stats.walkSpeed, mark.stats.runSpeed, mark.stats.jump, mark.stats.weight, mark.stats.height], [1080, 200, 460, 200, 1.1, 192]);
  assert.equal(mark.palette.accent, "#1877f2");
  assert.equal(mark.palette.hair, "#9a7550");
  assert.equal(mark.passive, "Move Fast (with Stable Infra)");
  assert.equal(mark.quotes.intro, "Send me location.");
  assert.deepEqual(mark.quotes.victory, ["Senator, we run ads."]);
  assert.equal(mark.quotes.rival.elon, "Send me location.");
  assert.equal(mark.normals.hk.level, "low", "Muay Thai leg kick is low");
  assert.equal(mark.throw.name, "Back Take");
  assert.deepEqual([...mark.mechanics], ["rotation-360", "grab-hold", "guard-crush"]);
});

test("Mark's special frame data matches the doc (startup / active / recovery)", () => {
  const table = { send_me_location: [6, 2, 46], hydrofoil_rush: [14, 20, 24], move_fast: [13, 10, 22] };
  for (const s of mark.specials) assert.deepEqual([s.startup, s.active, s.recovery], table[s.id], s.id);
  assert.equal(mark.moves.get("move_fast").hits, 4);
  const sml = mark.moves.get("send_me_location");
  assert.deepEqual([sml.variants.LP.grab.damage, sml.variants.HP.grab.damage, sml.variants.HP.grab.range], [160, 170, 90]);
  assert.equal(mark.super.startup, 7);
  assert.equal(mark.super.grab.range, 100);
});

const dirs = (list, button = BTN.LP) => list.map((dir, i) => ({ dir, buttons: i === list.length - 1 ? button : 0 }));
const feed = (list) => {
  const b = new InputBuffer();
  for (const e of list) b.push(e);
  return b;
};

test("360: a full rotation or HCB,F; QCF, HCB and partial circles do not count", () => {
  assert.ok(halfCircleForward([6, 3, 2, 1, 4, 6]));
  assert.ok(halfCircleForward([6, 2, 4, 6]), "keyboard HCB,F without diagonals");
  assert.ok(fullRotation([4, 1, 2, 3, 6, 9, 8]), "rotation through up");
  assert.ok(fullRotation([8, 6, 2, 4, 5]), "any order of the four cardinals");
  assert.ok(!rotationIn([2, 3, 6]), "QCF");
  assert.ok(!rotationIn([6, 3, 2, 1, 4]), "HCB without the final forward");
  assert.ok(!rotationIn([4, 2, 6]));
  assert.ok(!rotationIn([6, 2, 4, 6, ...Array(12).fill(5)]), "stale rotation");
  assert.ok(matchMotion(feed(dirs([6, 2, 4, 6])), mark.specials[0].motion, 1) >= 0, "the engine matches HCB,F itself");
});

test("360 through up: the grab starts from neutral or the prejump frames", () => {
  for (const steps of [[4, 2, 6, 8, 8, 8], [4, 2, 6, 8]]) {
    const m = makeMatch({ p1: [mark], p2: [sam] });
    place(m, -60, 30);
    play(m, 0, [...steps.map((dir, i) => ({ dir, buttons: i === steps.length - 1 ? BTN.HP : 0 })), { frames: 40 }]);
    assert.deepEqual(events(m, "special").map((s) => s.moveId), ["send_me_location"], steps.join(""));
    assert.equal(events(m, "throw").length, 1);
    assert.equal(events(m, "hit")[0].damage, 170, "HP version");
    assert.equal(m.point(0).airborne, false);
  }
});

test("CPU macros for Mark's inputs are accepted by the parser", () => {
  for (const input of ["HCB,F+P", "B,F+K", "D,D,B+LP"]) {
    const b = new InputBuffer();
    for (const s of motionSteps(input)) for (let i = 0; i < s.frames; i += 1) b.push({ dir: s.dir, buttons: s.buttons || 0 });
    assert.ok(matchMotion(b, parseMotion(input), 1, 6) >= 0 || matchMotion(b, parseMotion(input), 1, 3) >= 0, input);
  }
});

test("Send Me Location: unblockable, untechable, held 24 frames, whiffs out of range", () => {
  const m = makeMatch({ p1: [mark], p2: [dario] });
  place(m, -60, 30);
  hold(m, 6, N, GUARD);
  play(m, 0, HCBF(BTN.LP), GUARD);
  until(m, () => m.point(1).state === "thrown", 10, N, GUARD);
  let held = 0;
  play(m, 1, [{ buttons: BTN.LP | BTN.LK }]);
  while (m.point(1).state === "thrown" && held < 60) {
    hold(m, 1);
    held += 1;
  }
  hold(m, 30);
  assert.equal(events(m, "tech").length, 0, "command grabs cannot be teched");
  assert.ok(held >= 22 && held <= 24, `held ${held + 1} frames`);
  assert.equal(events(m, "hit")[0].damage, 160);

  const far = makeMatch({ p1: [mark], p2: [sam] });
  place(far, -150, 150);
  play(far, 0, [...HCBF(BTN.LP), { frames: 60 }]);
  assert.equal(events(far, "throw").length, 0);
  assert.equal(events(far, "special").length, 1);
});

test("Metaverse Submission holds 70 frames for 360 and whiffs beyond 100 px", () => {
  const m = makeMatch({ p1: [mark], p2: [sam] });
  place(m, -40, 40);
  m.sides[0].meter = 300;
  play(m, 0, SUPER);
  until(m, () => m.point(1).state === "thrown", 60);
  const held = until(m, () => m.point(1).state !== "thrown", 120);
  assert.ok(held >= 68 && held <= 70, `held ${held}`);
  hold(m, 20);
  assert.deepEqual(events(m, "hit").map((h) => [h.moveId, h.damage]), [["metaverse_submission", 360]]);
  const far = makeMatch({ p1: [mark], p2: [sam] });
  place(far, -130, 130);
  far.sides[0].meter = 300;
  play(far, 0, [...SUPER, { frames: 120 }]);
  assert.equal(events(far, "throw").length, 0);
});

test("guard crush: Move Fast drains 40 Runway on block, once per use", () => {
  const m = makeMatch({ p1: [mark], p2: [sam] });
  place(m, -55, 55);
  hold(m, 6, N, GUARD);
  play(m, 0, [...QCF(BTN.LP), { frames: 50 }], GUARD);
  assert.equal(events(m, "block").length, 4);
  assert.equal(Math.round(m.sides[1].runway), RULES.runwayMax - 40);
});

test("guard crush: an empty Runway turns the block into a guard break", () => {
  const m = makeMatch({ p1: [mark], p2: [sam] });
  place(m, -55, 55);
  hold(m, 6, N, GUARD);
  m.sides[1].runway = 30;
  play(m, 0, QCF(BTN.LP), GUARD);
  until(m, () => events(m, "guardBreak").length > 0, 60, N, GUARD);
  const d = m.point(1);
  assert.equal(events(m, "guardBreak").length, 1);
  assert.equal(d.state, "hitstun");
  assert.ok(d.stun > GUARD_BREAK_STUN - 5);
  assert.equal(m.sides[1].runway, 0);
  hold(m, 30, N, GUARD);
  assert.ok(events(m, "hit").some((h) => h.attacker === "mark"), "the rest of the rush lands on the broken guard");
});

test("low profile: Hydrofoil Rush slides under fireballs and keeps a low body", () => {
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
  play(m, 0, BF(BTN.HK));
  until(m, () => m.point(0).moveFrame >= 10, 20);
  assert.ok(m.point(0).hurtboxes().every((b) => b.y >= -64), "body is under 64 px during the glide");
  shoot(m);
  assert.equal(events(m, "hit").length, 0, "the fireball passes over the hydrofoil");
  const control = makeMatch({ p1: [mark], p2: [sam] });
  place(control, -500, 500);
  shoot(control);
  assert.equal(events(control, "hit").length, 1, "the same fireball hits a standing Mark");
});

test("stop on contact: a blocked glide skips its remaining active frames", () => {
  const m = makeMatch({ p1: [mark], p2: [sam] });
  place(m, -120, 60);
  hold(m, 6, N, LOW_GUARD);
  play(m, 0, BF(BTN.HK), LOW_GUARD);
  until(m, () => events(m, "block").length > 0, 40, N, LOW_GUARD);
  hold(m, 14, N, LOW_GUARD);
  const mk = m.point(0);
  assert.ok(mk.moveFrame >= mk.move.startup + mk.move.active, "in recovery right after the block");
  assert.ok(Math.abs(mk.x - m.point(1).x) < 200);
});

test("Meta passive (engine): forward dash 2 frames shorter", () => {
  const dashLength = (def) => {
    const m = makeMatch({ p1: [def], p2: [dario] });
    place(m, -600, 600);
    play(m, 0, [{ dir: 6 }, { dir: 5 }, { dir: 6 }]);
    return until(m, () => m.point(0).state !== "dash_fwd", 40) + 1;
  };
  assert.equal(dashLength(sam) - dashLength(mark), 2);
});
