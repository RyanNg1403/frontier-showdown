import test from "node:test";
import assert from "node:assert/strict";
import { BTN, N, dario, events, hold, makeMatch, place, play, sam, until } from "./helpers.mjs";
import elon from "../src/characters/elon.js";
import mark from "../src/characters/mark.js";
import { Match } from "../src/combat/match.js";
import { createCpu } from "../src/combat/ai.js";
import { canGrab } from "../src/combat/mechanics/grabs.js";
import { applyGroundBounce } from "../src/combat/mechanics/air-dive.js";
import { RULES } from "../src/combat/constants.js";
import { getMechanic, systems } from "../src/combat/mechanics.js";
import { kitFor } from "../src/combat/ai-kits/index.js";

const GUARD = { dir: 5, buttons: BTN.BLOCK };
const LOW_GUARD = { dir: 2, buttons: BTN.BLOCK };
const motion = (dirs, button) => dirs.map((dir, i) => ({ dir, buttons: i === dirs.length - 1 ? button : 0 }));
const QCF = (b) => motion([2, 3, 6], b);
const DP = (b) => motion([6, 2, 3], b);
const BF = (b) => motion([4, 6], b);
const SUPER = motion([2, 3, 6, 2, 3, 6], BTN.HP);

test("Elon follows the roster doc kit", () => {
  assert.deepEqual(elon.specials.map((s) => [s.id, s.input]), [["not_a_flamethrower", "QCF+P"], ["mechazilla_catch", "DP+P"], ["armor_glass", "B,F+P"]]);
  assert.equal(elon.super.id, "colossus_launch");
  assert.deepEqual([elon.finisher.id, elon.finisher.input, elon.finisher.rangeName], ["to_the_moon", "D,U,U+HK", "far"]);
  assert.deepEqual({ ...elon.assists }, { a: "not_a_flamethrower", b: "mechazilla_catch" });
  assert.deepEqual([elon.stats.health, elon.stats.walkSpeed, elon.stats.runSpeed, elon.stats.jump, elon.stats.weight, elon.stats.height], [1000, 225, 520, 225, 1.1, 214]);
  assert.equal(elon.palette.accent, "#ff3b30");
  assert.equal(elon.palette.hair, "#6a4a33");
  assert.equal(elon.passive, "Colossus Spin-up");
  assert.deepEqual(elon.quotes.victory, ["To the moon!"]);
  assert.ok(elon.quotes.intro.includes("The Walrus"));
  assert.ok(elon.quotes.rival.mark.includes("Walrus"));
  assert.equal(elon.normals.f_hk.name, "Cybertruck Charge");
  assert.equal(elon.raw.ai.jumpIn.name, "The Walrus", "ai hints point at the Walrus move");
  assert.equal(elon.throw.name, "Cage Match");
  assert.ok(elon.hurtboxes.stand[0].y < mark.hurtboxes.stand[0].y, "Elon is taller than Mark");
});

test("Elon's special frame data matches the doc (startup / active / recovery)", () => {
  const table = { not_a_flamethrower: [12, 18, 22], mechazilla_catch: [7, 6, 34], armor_glass: [18, 2, 28] };
  for (const s of elon.specials) assert.deepEqual([s.startup, s.active, s.recovery], table[s.id], s.id);
  assert.equal(elon.moves.get("not_a_flamethrower").hits, 6);
  assert.equal(elon.moves.get("not_a_flamethrower").variants.HP.recovery, 28, "HP flame has more recovery");
  assert.equal(elon.super.startup, 7);
});

/** Frame (1 = the press) on which the first hit, block, throw or projectile happens. */
function firstContact(def, steps, { dist, guard = N, jump = false }) {
  const m = makeMatch({ p1: [def], p2: [sam] });
  place(m, -dist / 2, dist / 2);
  if (jump) hold(m, 8, N, { dir: 8 });
  else hold(m, 4, N, guard);
  play(m, 0, steps, jump ? N : guard);
  const press = m.frame;
  const count = () => m.log.filter((e) => ["hit", "block", "throw"].includes(e.name)).length + m.projectiles.length;
  until(m, () => count() > 0, 60, N, guard);
  return m.frame - press + 1;
}

/** On-block advantage as played: both sides hold up after the block; who starts a jump first. */
function onBlock(def, steps, { dist, guard = GUARD, meter = 0, scaleUp = false }) {
  const m = makeMatch({ p1: [def], p2: [sam] });
  place(m, -dist / 2, dist / 2);
  m.sides[0].meter = meter;
  hold(m, 6, N, guard);
  play(m, 0, scaleUp ? [...steps, { buttons: BTN.BLOCK }] : steps, guard);
  const a = m.point(0);
  const d = m.point(1);
  until(m, () => a.state === "attack" && a.isRecovering && d.state === "blockstun", 90, N, guard);
  assert.ok(events(m, "block").length > 0 && !events(m, "hit").length, "blocked");
  let as = -1;
  let ds = -1;
  for (let f = 0; f < 120 && (as < 0 || ds < 0); f += 1) {
    m.step([{ dir: 8, buttons: 0 }, { dir: 8, buttons: 0 }]);
    if (as < 0 && a.state === "jump_start") as = f;
    if (ds < 0 && d.state === "jump_start") ds = f;
  }
  return { adv: ds - as, blocks: events(m, "block").length };
}

test("specials connect on their listed startup frames (both fighters)", () => {
  assert.equal(firstContact(mark, motion([6, 3, 2, 1, 4, 6], BTN.LP), { dist: 80 }), 6, "Send Me Location LP");
  assert.equal(firstContact(mark, motion([6, 3, 2, 1, 4, 6], BTN.HP), { dist: 80 }), 8, "Send Me Location HP");
  assert.equal(firstContact(mark, BF(BTN.LK), { dist: 150, guard: LOW_GUARD }), 14, "Hydrofoil Rush");
  assert.equal(firstContact(mark, QCF(BTN.LP), { dist: 100, guard: GUARD }), 13, "Move Fast");
  assert.equal(firstContact(elon, QCF(BTN.LP), { dist: 110, guard: GUARD }), 12, "Not-a-Flamethrower");
  assert.equal(firstContact(elon, DP(BTN.LP), { dist: 110, jump: true }), 7, "Mechazilla Catch");
  assert.equal(firstContact(elon, BF(BTN.LP), { dist: 500 }), 18, "Armor Glass leaves his hand");
});

test("on-block advantage matches the doc (both fighters)", () => {
  assert.deepEqual(onBlock(mark, QCF(BTN.LP), { dist: 110 }), { adv: -4, blocks: 4 }, "Move Fast -4");
  assert.deepEqual(onBlock(mark, QCF(BTN.LP), { dist: 110, meter: 100, scaleUp: true }), { adv: 2, blocks: 4 }, "Stable Infra +2");
  assert.equal(onBlock(mark, BF(BTN.LK), { dist: 200, guard: LOW_GUARD }).adv, -8, "Hydrofoil Rush LK -8");
  assert.equal(onBlock(mark, BF(BTN.HK), { dist: 300, guard: LOW_GUARD }).adv, -8, "Hydrofoil Rush HK -8");
  assert.deepEqual(onBlock(elon, QCF(BTN.LP), { dist: 110 }), { adv: -6, blocks: 6 }, "Not-a-Flamethrower LP -6");
  assert.ok(onBlock(elon, QCF(BTN.HP), { dist: 110 }).adv < -6, "HP flame is less safe");
});

test("Scale Up versions: the flame gains 3 hits, Armor Glass throws two balls, Stable Infra armors", () => {
  const m = makeMatch({ p1: [elon], p2: [sam] });
  place(m, -55, 55);
  m.sides[0].meter = 100;
  hold(m, 4, N, GUARD);
  play(m, 0, [...QCF(BTN.LP), { buttons: BTN.BLOCK }, { frames: 100 }], GUARD);
  assert.equal(events(m, "block").length, 9);

  const g = makeMatch({ p1: [elon], p2: [sam] });
  place(g, -400, 400);
  g.sides[0].meter = 100;
  play(g, 0, [...BF(BTN.LP), { buttons: BTN.BLOCK }]);
  until(g, () => g.projectiles.length > 0, 30);
  assert.equal(g.projectiles.length, 2);
  assert.ok(g.projectiles[1].vy > g.projectiles[0].vy, "the second ball is on a lower arc");

  const a = makeMatch({ p1: [mark], p2: [sam] });
  place(a, -55, 55);
  a.sides[0].meter = 100;
  play(a, 0, [...QCF(BTN.LP), { buttons: BTN.BLOCK }]);
  a.step([N, { dir: 5, buttons: BTN.LP }]);
  hold(a, 40);
  assert.ok(events(a, "hit").find((h) => h.attacker === "sam")?.armor, "Sam's jab is absorbed");
  assert.ok(events(a, "hit").some((h) => h.attacker === "mark"), "the rush still lands");
});

test("damage: grabs, rush, slide, flame and both supers", () => {
  const dealt = (def, steps, dist, meter = 0) => {
    const m = makeMatch({ p1: [def], p2: [sam] });
    place(m, -dist / 2, dist / 2);
    m.sides[0].meter = meter;
    play(m, 0, [...steps, { frames: 180 }]);
    return events(m, "hit").filter((h) => h.attacker === def.id);
  };
  assert.deepEqual(dealt(mark, motion([6, 3, 2, 1, 4, 6], BTN.LP), 80).map((h) => h.damage), [160]);
  assert.deepEqual(dealt(mark, QCF(BTN.LP), 100).map((h) => h.damage), [22, 22, 20, 18]);
  assert.equal(dealt(mark, BF(BTN.LK), 150)[0].damage, 80);
  assert.deepEqual(dealt(mark, SUPER, 80, 300).map((h) => h.damage), [360], "Metaverse Submission");
  assert.equal(dealt(elon, QCF(BTN.LP), 100).length, 6);
  const eSuper = dealt(elon, SUPER, 80, 300);
  assert.equal(eSuper.length, 7, "Colossus Launch hits seven times");
  assert.ok(eSuper.reduce((t, h) => t + h.damage, 0) >= 270);
});

test("anti-air grab: catches jumpers, whiffs on grounded opponents and is punishable", () => {
  const air = { onField: true, ko: false, hidden: false, invulnFrames: 0, state: "jump", x: 60, y: -150, airborne: true };
  const e = { x: 0, airborne: false };
  const only = { air: "only", range: 140, reach: 300 };
  assert.ok(canGrab(e, air, only));
  assert.ok(!canGrab(e, { ...air, y: -320 }, only), "above the reach");
  assert.ok(!canGrab(e, { ...air, state: "juggle" }, only), "not juggled opponents");
  const ground = { ...air, y: 0, airborne: false, invulnTo: () => false };
  assert.ok(!canGrab(e, ground, only));
  assert.ok(canGrab(e, ground, { air: "also", range: 140, groundRange: 80 }));
  assert.ok(!canGrab(e, { ...ground, x: 100 }, { air: "also", range: 140, groundRange: 80 }));

  const m = makeMatch({ p1: [elon], p2: [sam] });
  place(m, -60, 60);
  hold(m, 8, N, { dir: 8 });
  play(m, 0, [...DP(BTN.LP), { frames: 70 }]);
  assert.equal(events(m, "throw").length, 1);
  assert.deepEqual(events(m, "hit").map((h) => [h.moveId, h.damage]), [["mechazilla_catch", 140]]);

  const g = makeMatch({ p1: [elon], p2: [sam] });
  place(g, -60, 40);
  play(g, 0, DP(BTN.LP));
  const frames = until(g, () => g.point(0).isNeutral, 80) + 1;
  assert.equal(events(g, "throw").length, 0);
  assert.equal(frames, elon.moves.get("mechazilla_catch").total);
});

test("Mechazilla carries the victim up the tower, holds 34 frames, then drops them", () => {
  const m = makeMatch({ p1: [elon], p2: [sam] });
  place(m, -60, 60);
  hold(m, 8, N, { dir: 8 });
  play(m, 0, DP(BTN.LP));
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
  assert.ok(victim.y <= -150, "dropped from the top of the tower");
  until(m, () => victim.state === "knockdown", 80);
  assert.equal(victim.state, "knockdown");
});

test("Scale Up Mechazilla also grabs grounded opponents within 80 px", () => {
  const m = makeMatch({ p1: [elon], p2: [sam] });
  place(m, -40, 30);
  m.sides[0].meter = 100;
  play(m, 0, [...DP(BTN.LP), { buttons: BTN.BLOCK }, { frames: 60 }]);
  assert.equal(events(m, "scaleUp").length, 1);
  assert.equal(events(m, "throw").length, 1);
});

test("guard crack: Armor Glass makes the next block within 2 s 6 frames longer, then expires", () => {
  const blockstunOfJab = (crackFirst, wait = 0) => {
    const m = makeMatch({ p1: [elon], p2: [sam] });
    place(m, -210, 210);
    hold(m, 6, N, GUARD);
    if (crackFirst) {
      play(m, 0, BF(BTN.LP), GUARD);
      until(m, () => events(m, "block").length > 0, 90, N, GUARD);
      until(m, () => m.point(1).isNeutral && m.point(0).isNeutral, 90, N, GUARD);
      hold(m, wait, N, GUARD);
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
  const plain = blockstunOfJab(false);
  assert.equal(blockstunOfJab(true) - plain, 6);
  assert.equal(blockstunOfJab(true, 130) - plain, 0, "expired after 2 s");
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

test("air dive: short landing recovery on hit, long on whiff, and the bounce combos", () => {
  const m = makeMatch({ p1: [elon], p2: [sam] });
  walrus(m);
  const e = m.point(0);
  until(m, () => e.state === "jump_land", 60);
  hold(m, 1);
  assert.equal(e.landingRecovery, 4);
  until(m, () => e.isNeutral, 30);
  play(m, 0, [{ dir: 2, buttons: BTN.HP }, { dir: 2, frames: 30 }]);
  assert.deepEqual(events(m, "hit").map((h) => [h.moveId, h.combo]), [["j_d_hp", 1], ["c_hp", 2]], "Walrus, ground bounce, Rocket Uppercut");

  const whiff = makeMatch({ p1: [elon], p2: [sam] });
  place(whiff, -400, 400);
  play(whiff, 0, [{ dir: 8, frames: 3 }, { dir: 5, frames: 14 }, { dir: 2, buttons: BTN.HP }]);
  until(whiff, () => whiff.point(0).state === "jump_land", 60);
  hold(whiff, 1);
  assert.equal(whiff.point(0).landingRecovery, 14);
});

test("ground bounce happens once per combo", () => {
  const ctx = { state: {} };
  const d = { state: "juggle", side: 1, combo: { hits: 3, bounced: true }, vy: -300, y: -50, def: { stats: { weight: 1 } } };
  assert.equal(applyGroundBounce(ctx, d, { bounce: 700, slam: 900 }), false);
  assert.equal(d.vy, -300);
  d.combo = { hits: 1 };
  assert.equal(applyGroundBounce(ctx, d, { bounce: 700, slam: 900 }), true);
  assert.equal(d.vy, 900, "slammed into the floor");
  assert.equal(applyGroundBounce(ctx, d, { bounce: 700, slam: 900 }), false, "already bounced this combo");
  assert.equal(ctx.state.groundBounces.get(d), 700, "the ground-bounce system has the bounce queued");
});

test("Elon's modules are on the unified registry and his CPU kit is registered", () => {
  const names = systems().map((sys) => sys.name);
  for (const name of ["guard-crush", "ground-bounce", "anti-air-grab"]) assert.ok(names.includes(name), `system ${name}`);
  for (const name of ["elon-walrus", "finisher-no-jump", "ground-bounce", "anti-air-grab"]) assert.ok(getMechanic(name), `mechanic ${name}`);
  assert.equal(typeof kitFor("elon"), "function");
});

test("xAI passive (engine): +15% Compute gain below 50% health", () => {
  const gain = (health) => {
    const m = makeMatch({ p1: [elon], p2: [sam] });
    place(m, -60, 60);
    m.point(0).health = health;
    play(m, 0, [{ buttons: BTN.HP }, { frames: 30 }]);
    return m.sides[0].meter;
  };
  assert.equal(gain(400), gain(1000) * 1.15);
});

test("finish phase: Elon's up inputs don't jump, so D,U,U+HK can be entered", () => {
  const m = makeMatch({ p1: [elon], p2: [sam] });
  m.sides[0].wins = 1;
  place(m, 220, 300);
  m.point(1).health = 1;
  play(m, 0, [{ buttons: BTN.LP }, { frames: 20 }]);
  until(m, () => m.phase === "finish", 60);
  until(m, () => m.point(1).state === "dazed" && m.point(0).isNeutral, 60);
  play(m, 0, [{ dir: 2, frames: 2 }, { dir: 8, frames: 2 }, { dir: 5, frames: 2 }, { dir: 8, buttons: BTN.HK, frames: 2 }]);
  assert.equal(m.point(0).airborne, false);
  assert.equal(m.phase, "finisher");
  assert.equal(events(m, "finisher")[0].id, "to_the_moon");
});

test("assist B Mechazilla grabs at 70% and the partner stays until the release", () => {
  const m = makeMatch({ mode: "2v2", p1: [mark, elon], p2: [sam, dario] });
  place(m, -100, 60);
  hold(m, 2);
  m.step([{ dir: 4, buttons: BTN.ASSIST }, N]);
  assert.equal(events(m, "assist")[0].moveId, "mechazilla_catch");
  const assist = m.sides[0].members[1];
  until(m, () => assist.state === "attack", 40);
  const d = m.point(1);
  d.x = assist.x + 70;
  d.y = -120;
  d.vy = -200;
  d.setState("jump");
  until(m, () => d.state === "thrown", 20);
  assert.ok(assist.onField && assist.state === "attack");
  until(m, () => d.state !== "thrown", 60);
  const hit = events(m, "hit").find((h) => h.moveId === "mechazilla_catch");
  assert.equal(hit.damage, Math.round(140 * RULES.assistDamageScale));
});

function cpuMatch(teams, mode, seed, d = ["hard", "hard"]) {
  const log = [];
  const m = new Match({
    mode,
    seed,
    emit: (name, payload) => {
      if (name === "special" || name === "super" || name === "hit" || name === "throw") log.push({ name, payload });
    },
    sides: teams.map((team, i) => ({ team, control: "cpu", cpu: createCpu(d[i], seed * 11 + i * 5 + 1) })),
  });
  m.start();
  let n = 0;
  while (m.phase !== "matchEnd" && n < 60 * 60 * 8) {
    m.step();
    n += 1;
    for (const f of m.allFighters) assert.ok(f.health >= 0 && Number.isFinite(f.x) && Number.isFinite(f.y));
  }
  assert.equal(m.phase, "matchEnd", `${teams.map((t) => t.map((c) => c.id).join("+")).join(" vs ")} did not finish`);
  return log;
}

test("CPU matches with Mark and Elon finish in 1v1 and 2v2, against each other and Sam and Dario", () => {
  const pairs = [[[mark], [elon]], [[elon], [sam]], [[mark], [dario]], [[elon], [mark]]];
  for (const [i, teams] of pairs.entries()) cpuMatch(teams, "1v1", i + 2);
  cpuMatch([[mark, elon], [sam, dario]], "2v2", 9);
  cpuMatch([[dario, elon], [mark, sam]], "2v2", 10);
});

test("the CPU plays both kits", () => {
  const used = { mark: new Set(), elon: new Set() };
  for (let seed = 1; seed <= 6; seed += 1) {
    for (const e of cpuMatch([[mark], [elon]], "1v1", seed)) {
      const who = e.payload.fighter || e.payload.attacker;
      if (used[who] && e.payload.moveId) used[who].add(e.payload.moveId);
    }
  }
  for (const id of ["send_me_location", "hydrofoil_rush", "move_fast"]) assert.ok(used.mark.has(id), `Mark CPU uses ${id}`);
  for (const id of ["not_a_flamethrower", "mechazilla_catch", "armor_glass", "j_d_hp"]) assert.ok(used.elon.has(id), `Elon CPU uses ${id}`);
});
