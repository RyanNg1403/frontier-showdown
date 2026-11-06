import test from "node:test";
import assert from "node:assert/strict";
import { BTN, N, dario, events, hold, makeMatch, place, play, sam, until } from "./helpers.mjs";
import mark from "../src/characters/mark.js";
import elon from "../src/characters/elon.js";
import { Match } from "../src/combat/match.js";
import { createCpu } from "../src/combat/ai.js";
import { characterIds } from "../src/characters/index.js";

const GUARD = { dir: 5, buttons: BTN.BLOCK };
const LOW_GUARD = { dir: 2, buttons: BTN.BLOCK };
const motion = (dirs, button) => dirs.map((dir, i) => ({ dir, buttons: i === dirs.length - 1 ? button : 0 }));
const QCF = (b) => motion([2, 3, 6], b);
const DP = (b) => motion([6, 2, 3], b);
const BF = (b) => motion([4, 6], b);
const HCBF = (b) => motion([6, 3, 2, 1, 4, 6], b);
const SUPER = motion([2, 3, 6, 2, 3, 6], BTN.HP);

test("Mark and Elon are registered and follow the roster doc kits", () => {
  assert.ok(characterIds.includes("mark") && characterIds.includes("elon"));
  assert.deepEqual(mark.specials.map((s) => [s.id, s.input]), [["send_me_location", "360+P"], ["hydrofoil_rush", "B,F+K"], ["move_fast", "QCF+P"]]);
  assert.deepEqual(elon.specials.map((s) => [s.id, s.input]), [["not_a_flamethrower", "QCF+P"], ["mechazilla_catch", "DP+P"], ["armor_glass", "B,F+P"]]);
  assert.equal(mark.super.id, "metaverse_submission");
  assert.equal(elon.super.id, "colossus_launch");
  assert.deepEqual([mark.finisher.id, mark.finisher.input, mark.finisher.rangeName], ["fourth_of_july", "D,D,B+LP", "close"]);
  assert.deepEqual([elon.finisher.id, elon.finisher.input, elon.finisher.rangeName], ["to_the_moon", "D,U,U+HK", "far"]);
  assert.deepEqual({ ...mark.assists }, { a: "move_fast", b: "hydrofoil_rush" });
  assert.deepEqual({ ...elon.assists }, { a: "not_a_flamethrower", b: "mechazilla_catch" });
  assert.deepEqual({ ...mark.stats, backWalkSpeed: 0, jumpHeight: 0 }, { health: 1080, walkSpeed: 200, backWalkSpeed: 0, runSpeed: 460, jump: 200, jumpHeight: 0, weight: 1.1, height: 192 });
  assert.deepEqual({ ...elon.stats, backWalkSpeed: 0, jumpHeight: 0 }, { health: 1000, walkSpeed: 225, backWalkSpeed: 0, runSpeed: 520, jump: 225, jumpHeight: 0, weight: 1.1, height: 214 });
  assert.equal(mark.palette.accent, "#1877f2");
  assert.equal(elon.palette.accent, "#ff3b30");
  assert.equal(mark.palette.hair, "#9a7550");
  assert.equal(elon.palette.hair, "#6a4a33");
  assert.equal(mark.passive, "Move Fast (with Stable Infra)");
  assert.equal(elon.passive, "Colossus Spin-up");
  assert.equal(mark.quotes.intro, "Send me location.");
  assert.deepEqual(mark.quotes.victory, ["Senator, we run ads."]);
  assert.deepEqual(elon.quotes.victory, ["To the moon!"]);
  assert.ok(elon.quotes.intro.includes("The Walrus"));
  assert.equal(mark.quotes.rival.elon, "Send me location.");
  assert.ok(elon.quotes.rival.mark.includes("Walrus"));
  assert.equal(elon.normals.j_d_hp.name, "The Walrus");
  assert.equal(elon.normals.f_hk.name, "Cybertruck Charge");
  assert.equal(mark.normals.hk.level, "low", "Muay Thai leg kick is low");
  assert.ok(elon.hurtboxes.stand[0].y < mark.hurtboxes.stand[0].y, "Elon is taller than Mark");
});

test("special frame data matches the doc (startup / active / recovery)", () => {
  const table = {
    send_me_location: [6, 2, 46],
    hydrofoil_rush: [14, 20, 24],
    move_fast: [13, 10, 22],
    not_a_flamethrower: [12, 18, 22],
    mechazilla_catch: [7, 6, 34],
    armor_glass: [18, 2, 28],
  };
  for (const c of [mark, elon]) {
    for (const s of c.specials) assert.deepEqual([s.startup, s.active, s.recovery], table[s.id], s.id);
  }
  assert.equal(mark.moves.get("move_fast").hits, 4);
  assert.equal(elon.moves.get("not_a_flamethrower").hits, 6);
  assert.equal(elon.moves.get("not_a_flamethrower").variants.HP.recovery, 28, "HP flame has more recovery");
  assert.equal(mark.moves.get("send_me_location").variants.HP.grab.damage, 170);
  assert.equal(mark.moves.get("send_me_location").variants.HP.grab.range, 90);
  assert.equal(mark.super.startup, 7);
  assert.equal(elon.super.startup, 7);
  assert.equal(mark.super.grab.range, 100);
});

/** Frame (1 = the press) on which the first hit, block, throw or projectile happens. */
function firstContact(def, steps, { dist, guard = N, jump = false } = {}) {
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

test("each special connects on its listed startup frame", () => {
  assert.equal(firstContact(mark, HCBF(BTN.LP), { dist: 80 }), 6, "Send Me Location LP");
  assert.equal(firstContact(mark, HCBF(BTN.HP), { dist: 80 }), 8, "Send Me Location HP");
  assert.equal(firstContact(mark, BF(BTN.LK), { dist: 150, guard: LOW_GUARD }), 14, "Hydrofoil Rush");
  assert.equal(firstContact(mark, QCF(BTN.LP), { dist: 100, guard: GUARD }), 13, "Move Fast");
  assert.equal(firstContact(elon, QCF(BTN.LP), { dist: 110, guard: GUARD }), 12, "Not-a-Flamethrower");
  assert.equal(firstContact(elon, DP(BTN.LP), { dist: 110, jump: true }), 7, "Mechazilla Catch");
  assert.equal(firstContact(elon, BF(BTN.LP), { dist: 500 }), 18, "Armor Glass leaves his hand");
});

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

test("on-block advantage matches the doc", () => {
  assert.deepEqual(onBlock(mark, QCF(BTN.LP), { dist: 110 }), { adv: -4, blocks: 4 }, "Move Fast -4");
  assert.deepEqual(onBlock(mark, QCF(BTN.LP), { dist: 110, meter: 100, scaleUp: true }), { adv: 2, blocks: 4 }, "Stable Infra +2");
  assert.equal(onBlock(mark, BF(BTN.LK), { dist: 200, guard: LOW_GUARD }).adv, -8, "Hydrofoil Rush LK -8");
  assert.equal(onBlock(mark, BF(BTN.HK), { dist: 300, guard: LOW_GUARD }).adv, -8, "Hydrofoil Rush HK -8");
  assert.deepEqual(onBlock(elon, QCF(BTN.LP), { dist: 110 }), { adv: -6, blocks: 6 }, "Not-a-Flamethrower LP -6");
  assert.ok(onBlock(elon, QCF(BTN.HP), { dist: 110 }).adv < -6, "HP flame is less safe");
});

test("Scale Up versions: Stable Infra armors, the flame gains 3 hits, Armor Glass throws two balls", () => {
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
  const armored = events(a, "hit").find((h) => h.attacker === "sam");
  assert.ok(armored?.armor, "Sam's jab is absorbed");
  assert.ok(events(a, "hit").some((h) => h.attacker === "mark"), "the rush still lands");
});

test("damage: grabs, rush, flame and both supers", () => {
  const dealt = (def, steps, dist, meter = 0) => {
    const m = makeMatch({ p1: [def], p2: [sam] });
    place(m, -dist / 2, dist / 2);
    m.sides[0].meter = meter;
    play(m, 0, [...steps, { frames: 180 }]);
    return events(m, "hit").filter((h) => h.attacker === def.id);
  };
  assert.deepEqual(dealt(mark, HCBF(BTN.LP), 80).map((h) => h.damage), [160]);
  assert.deepEqual(dealt(mark, HCBF(BTN.HP), 80).map((h) => h.damage), [170]);
  assert.deepEqual(dealt(mark, QCF(BTN.LP), 100).map((h) => h.damage), [22, 22, 20, 18]);
  assert.equal(dealt(mark, BF(BTN.LK), 150)[0].damage, 80);
  assert.equal(dealt(elon, QCF(BTN.LP), 100).length, 6);
  const mSuper = dealt(mark, SUPER, 80, 300);
  assert.deepEqual(mSuper.map((h) => [h.damage, h.kind]), [[360, "super"]], "Metaverse Submission");
  assert.equal(dealt(mark, SUPER, 260, 300).length, 0, "the super grab whiffs beyond 100 px");
  const eSuper = dealt(elon, SUPER, 80, 300);
  assert.equal(eSuper.length, 7, "Colossus Launch hits seven times");
  assert.ok(eSuper.reduce((t, h) => t + h.damage, 0) >= 270);
});

test("Mechazilla whiffs on grounded opponents and is punishable", () => {
  const m = makeMatch({ p1: [elon], p2: [sam] });
  place(m, -60, 40);
  play(m, 0, DP(BTN.LP));
  const e = m.point(0);
  const frames = until(m, () => e.isNeutral, 80) + 1;
  assert.equal(events(m, "throw").length, 0);
  assert.equal(frames, elon.moves.get("mechazilla_catch").total);
  assert.ok(frames >= 46);
});

test("Send Me Location beats a blocking opponent; Mark's throw is Back Take", () => {
  const m = makeMatch({ p1: [mark], p2: [dario] });
  place(m, -60, 30);
  hold(m, 6, N, GUARD);
  play(m, 0, [...HCBF(BTN.LP), { frames: 60 }], GUARD);
  assert.equal(events(m, "hit")[0].moveId, "send_me_location");
  assert.equal(mark.throw.name, "Back Take");
  assert.equal(elon.throw.name, "Cage Match");
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

test("the CPU plays their kits", () => {
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
