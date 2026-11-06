import test from "node:test";
import assert from "node:assert/strict";
import { BTN, N, dario, events, hold, makeMatch, place, play, sam, until } from "./helpers.mjs";
import { Match } from "../src/combat/match.js";
import { createCpu } from "../src/combat/ai.js";
import { loadCharacter } from "../src/characters/index.js";
import { RULES } from "../src/combat/constants.js";
import { constructsOf, propsFor as contactProps } from "../src/combat/mechanics/targeting.js";
import geoffrey from "../src/characters/geoffrey.js";
import { cloudVelocity } from "../src/combat/mechanics/drift-cloud.js";

// Motions for side 0 facing right.
const qcf = (bit) => [{ dir: 2 }, { dir: 3 }, { dir: 6, buttons: bit }];
const qcb = (bit) => [{ dir: 2 }, { dir: 1 }, { dir: 4, buttons: bit }];
const dnb = (bit) => [{ dir: 2 }, { dir: 5 }, { dir: 4, buttons: bit }];
const bf = (bit) => [{ dir: 4 }, { dir: 6, buttons: bit }];
const superQcf = [{ dir: 2 }, { dir: 3 }, { dir: 6 }, { dir: 5 }, { dir: 2 }, { dir: 3 }, { dir: 6, buttons: BTN.HP }];
const GUARD = { dir: 5, buttons: BTN.BLOCK };
const hitsBy = (m, moveId) => events(m, "hit").filter((h) => h.moveId === moveId);
const hitWith = (id) => (m) => events(m, "hit").some((h) => h.moveId === id);
const sp = (def, id) => def.specials.find((s) => s.id === id);
const constructs = (m) => constructsOf(m);
const bridges = (m) => m.mech.objects.filter((o) => o.look === "golden_gate" && !o.dead);
const statusOf = (m, id, name) => m.snapshot().mechanics.statuses?.find((s) => s.fighter === id)?.[name];
const markSam = (m) => m.mech.ctx.addStatus(m.point(1), "mark", { frames: 600, mul: 1.12 });
const route = (m, button, extra = []) => {
  play(m, 0, [...dnb(button), { frames: 6 }]);
  for (const b of extra) play(m, 0, [{ buttons: b }, { frames: 2 }]);
  until(m, () => m.point(0).isNeutral, 40);
};

/** Start a move for side 0 and step until `pred`; returns the move frame it happened on. */
function frameOf(def, motion, pred, { at = [-120, 60], meter = 0, cap = 200 } = {}) {
  const m = makeMatch({ p1: [def], p2: [sam] });
  place(m, at[0], at[1]);
  m.sides[0].meter = meter;
  const f = m.point(0);
  play(m, 0, motion);
  for (let i = 0; i < cap; i += 1) {
    if (pred(m, f)) return { frame: f.moveFrame, m, f };
    m.step([N, N]);
  }
  return { frame: -1, m, f };
}

async function cpuMatch({ mode = "1v1", p1, p2, difficulty = "hard", frames = 60 * 90, seed = 3 }) {
  const load = (ids) => Promise.all(ids.map((id) => loadCharacter(id)));
  const log = [];
  const m = new Match({
    mode, skipIntro: true, seed,
    sides: [
      { team: await load(p1), control: "cpu", cpu: createCpu(difficulty, 11) },
      { team: await load(p2), control: "cpu", cpu: createCpu(difficulty, 29) },
    ],
    emit: (name, payload) => {
      if (name !== "tick" && name !== "vfx") log.push({ name, payload });
    },
  });
  m.start();
  for (let i = 0; i < frames && m.phase !== "matchEnd"; i += 1) m.step([]);
  const of = (name, side = 0) => log.filter((e) => e.name === name && e.payload.side === side).map((e) => e.payload);
  return { m, log, of };
}

// ---------------------------------------------------------------- data, frames and finisher

test("geoffrey: specials match the roster doc table (S / A / R)", () => {
  const rows = [
  ["backpropagation", "D,N,B+P", 4, 18, 28],
  ["dropout", "QCB+K", 26, 4, 16],
  ["boltzmann_machine", "QCF+P", 18, 2, 26],
];
  assert.deepEqual(geoffrey.specials.map((s) => s.id), rows.map((r) => r[0]));
  rows.forEach(([sid, input, s, a, r], i) => {
    const m = geoffrey.specials[i];
    assert.equal(m.input, input, `${sid} input`);
    assert.deepEqual([m.startup, m.active, m.recovery], [s, a, r], `${sid} S/A/R`);
    assert.equal(m.total, s + a + r - 1);
    assert.equal(m.anim, `special_${i + 1}`);
  });
  assert.equal(geoffrey.super.input, "QCF,QCF+HP");
  assert.equal(geoffrey.super.meterCost, 300);
});

test("geoffrey: doc numbers that live in mechanic data", () => {
  const bp = sp(geoffrey, "backpropagation");
  assert.deepEqual([bp.mechanicData.from, bp.mechanicData.to], [4, 21], "18-frame window from frame 4");
  assert.deepEqual(bp.variants.LP.mechanicData.levels, ["high", "mid", "overhead"]);
  assert.deepEqual(bp.variants.HP.mechanicData.levels, ["mid", "low"]);
  const dr = sp(geoffrey, "dropout");
  assert.deepEqual([dr.mechanicData.from, dr.mechanicData.to - dr.mechanicData.from + 1], [6, 20], "intangible from 6 for 20 frames");
  assert.deepEqual([dr.invuln.from, dr.invuln.to, dr.invuln.type, dr.passThrough.from, dr.passThrough.to], [6, 25, "all", 6, 25]);
  assert.equal(dr.damage, 60);
  const bm = sp(geoffrey, "boltzmann_machine").mechanicData;
  assert.deepEqual([bm.frame, bm.projectile.lifetime, bm.projectile.hits, bm.damage, bm.max], [18, 180, 3, 18, 2]);
});

test("geoffrey: super startup, total damage, invulnerability and finisher", () => {
  const mv = geoffrey.super;
  const data = mv.mechanicData;
  const total = data?.hits && data?.damage ? data.hits * data.damage
    : mv.projectile ? mv.projectile.hits * mv.projectile.damage + (data?.spawns || []).reduce((t, x) => t + x.projectile.hits * x.projectile.damage, 0)
    : mv.hits * mv.damage;
  assert.deepEqual([mv.startup, total], [10, 340]);
  assert.equal(mv.invuln.to, mv.startup, "invulnerable through startup");
  assert.deepEqual([geoffrey.finisher.input, geoffrey.finisher.rangeName], ["F,B,F+LP", "close"]);
});

test("geoffrey: whiffed specials return to neutral after their total frames", () => {
  for (const [sid, motion] of [["boltzmann_machine", qcf(BTN.LP)]]) {
    const m = makeMatch({ p1: [geoffrey], p2: [sam] });
    place(m, -700, 700);
    play(m, 0, motion);
    const f = m.point(0);
    assert.equal(f.move?.id, sid);
    let n = 1;
    while (f.state === "attack" && n < 200) {
      m.step([N, N]);
      n += 1;
    }
    assert.equal(n, sp(geoffrey, sid).total, `${sid} lasts ${sp(geoffrey, sid).total} frames`);
  }
});

test("geoffrey: finisher triggers from its input at its listed range", () => {
  const m = makeMatch({ p1: [geoffrey], p2: [sam], roundsToWin: 1 });
  place(m, -40, 40);
  m.point(1).health = 1;
  play(m, 0, [{ buttons: BTN.LP }, { frames: 30 }]);
  assert.equal(m.phase, "finish", "FINAL COMMIT");
  for (let i = 0; i < 40 && m.point(1).state !== "dazed"; i += 1) m.step([N, N]);
  place(m, -150 / 2, 150 / 2);
  play(m, 0, [...[{ dir: 6 }, { dir: 4 }, { dir: 6, buttons: BTN.LP }], { frames: 4 }]);
  assert.equal(events(m, "finisher")[0]?.id, geoffrey.finisher.id);
});

// ---------------------------------------------------------------- 2v2 and CPU

test("geoffrey: assist A and B run their mechanics, then go home", () => {
  const m = makeMatch({ mode: "2v2", p1: [sam, geoffrey], p2: [dario, sam] });
  place(m, -250, 250);
  play(m, 0, [{ buttons: BTN.TAG }, { frames: 2 }]);
  assert.equal(events(m, "assist")[0].moveId, "boltzmann_machine");
  hold(m, 520);
  play(m, 0, [{ dir: 4, buttons: BTN.TAG }, { dir: 4, frames: 2 }]);
  assert.equal(events(m, "assist")[1]?.moveId, "dropout");
  hold(m, 160);
  assert.equal(m.sides[0].members[1].onField, false);
});

test("geoffrey: CPU kit plays all three specials and a drifting cloud", async () => {
  const r = await cpuMatch({ p1: ["geoffrey"], p2: ["sam"] });
  const used = new Set(r.of("special").map((s) => s.moveId));
  for (const s of ["boltzmann_machine", "dropout", "backpropagation"]) assert.ok(used.has(s), `uses ${s} (used: ${[...used].join(", ")})`);
  assert.ok(((r) => r.of("special").some((s) => s.moveId === "boltzmann_machine"))(r), "signature mechanic");
  assert.ok(r.log.filter((e) => e.name === "hit" && e.payload.side === 0).length > 10, "lands hits");
});

// ---------------------------------------------------------------- mechanics

test("Backpropagation returns 120 to a jab that lands in its window", () => {
  const m = makeMatch({ p1: [geoffrey], p2: [sam] });
  place(m, -60, 60);
  play(m, 0, dnb(BTN.LP));
  hold(m, 2);
  play(m, 1, [{ buttons: BTN.LP }, { frames: 40 }]);
  const rc = events(m, "returnCounter");
  assert.equal(rc.length, 1);
  assert.equal(rc[0].damage, 120);
  assert.equal(m.point(0).health, 1000, "Geoffrey takes nothing");
  assert.equal(m.point(1).health, 880);
  assert.ok(["juggle", "knockdown", "getup"].includes(m.point(1).state));
});

test("Backpropagation returns 1.2x a big hit and ignores hits outside its window", () => {
  const m = makeMatch({ p1: [geoffrey], p2: [sam] });
  place(m, -60, 60);
  play(m, 0, dnb(BTN.LP));
  const g = m.point(0);
  const s = m.point(1);
  assert.ok(g.moveFrame >= 1 && g.moveFrame < 4);
  m.applyContact(s, g, contactProps("test", { damage: 50 }, "normal"), { x: 0, y: -120 }, { dir: -1 });
  assert.equal(events(m, "returnCounter").length, 0, "frames 1-3 are not covered");
  assert.equal(g.health, 1000 - 60, "a counter hit on startup instead");
  const m2 = makeMatch({ p1: [geoffrey], p2: [sam] });
  place(m2, -60, 60);
  play(m2, 0, dnb(BTN.LP));
  hold(m2, 4);
  m2.applyContact(m2.point(1), m2.point(0), contactProps("big", { damage: 150, level: "mid" }, "normal"), { x: 0, y: -120 }, { dir: -1 });
  assert.equal(events(m2, "returnCounter")[0].damage, 180);
  assert.equal(m2.point(1).health, 1000 - 180);
});

test("Backpropagation: lows beat LP, HP catches lows, throws beat both", () => {
  const low = (variant) => {
    const m = makeMatch({ p1: [geoffrey], p2: [sam] });
    place(m, -60, 60);
    play(m, 0, dnb(variant));
    play(m, 1, [{ dir: 2, buttons: BTN.LK }, { dir: 2, frames: 30 }]);
    return m;
  };
  const vsLp = low(BTN.LP);
  assert.equal(events(vsLp, "returnCounter").length, 0);
  assert.ok(vsLp.point(0).health < 1000, "the low hits Geoffrey");
  const vsHp = low(BTN.HP);
  assert.equal(events(vsHp, "returnCounter").length, 1);
  assert.equal(vsHp.point(0).health, 1000);

  const t = makeMatch({ p1: [geoffrey], p2: [sam] });
  place(t, -35, 35);
  play(t, 0, dnb(BTN.LP));
  play(t, 1, [{ buttons: BTN.LP | BTN.LK }, { frames: 60 }]);
  assert.equal(events(t, "throw").length, 1);
  assert.equal(events(t, "returnCounter").length, 0);
});

test("Backpropagation returns a projectile as a silver spark", () => {
  const m = makeMatch({ p1: [geoffrey], p2: [sam] });
  place(m, -260, 260);
  play(m, 1, [{ dir: 2 }, { dir: 1 }, { dir: 4, buttons: BTN.HP }]);
  until(m, () => m.projectiles.length && Math.abs(m.projectiles[0].x - m.point(0).x) < 170, 80);
  play(m, 0, dnb(BTN.HP));
  until(m, () => events(m, "returnCounter").length > 0, 40);
  const rc = events(m, "returnCounter");
  assert.equal(rc.length, 1);
  assert.equal(rc[0].projectile, true);
  const spark = m.projectiles.find((p) => p.def.mech?.look === "spark");
  assert.ok(spark && spark.side === 0 && spark.vx > 0, "a spark flies back at Sam");
  until(m, () => hitsBy(m, "backpropagation").length > 0, 90);
  assert.equal(m.point(1).health, 880);
  assert.equal(m.point(0).health, 1000);
});

// ---------------------------------------------------------------- intangible phase

test("Dropout is intangible on frames 6-25, walks through the opponent and re-enters behind", () => {
  const m = makeMatch({ p1: [geoffrey], p2: [sam] });
  place(m, -120, 40);
  play(m, 0, qcb(BTN.HK));
  const g = m.point(0);
  const s = m.point(1);
  let sawPassThrough = false;
  while (g.state === "attack" && g.moveFrame < 25) {
    m.step([N, g.moveFrame === 8 ? { dir: 5, buttons: BTN.LP } : N]);
    if (g.moveFrame >= 6 && g.moveFrame <= 25) {
      assert.ok(g.invulnTo("strike") && g.invulnTo("throw") && g.invulnTo("projectile"), `invulnerable on ${g.moveFrame}`);
      sawPassThrough ||= g.passesThrough;
    }
  }
  assert.ok(sawPassThrough);
  assert.equal(events(m, "hit").filter((h) => h.attacker === "sam").length, 0, "Sam's jab passes through");
  assert.ok(g.x > s.x, "Geoffrey re-materializes behind Sam");
  until(m, () => hitsBy(m, "dropout").length > 0, 10);
  assert.equal(hitsBy(m, "dropout").length, 1, "the re-entry palm connects");
});

test("Dropout LK re-enters in place", () => {
  const m = makeMatch({ p1: [geoffrey], p2: [sam] });
  place(m, -300, 200);
  play(m, 0, qcb(BTN.LK));
  hold(m, 30);
  assert.ok(Math.abs(m.point(0).x + 300) < 2);
});

// ---------------------------------------------------------------- drifting deterministic projectile

test("Boltzmann cloud path is deterministic per frame and settles onto the opponent", () => {
  const run = () => {
    const m = makeMatch({ p1: [geoffrey], p2: [sam] });
    place(m, -300, 200);
    play(m, 0, qcf(BTN.LP));
    const path = [];
    for (let i = 0; i < 110; i += 1) {
      m.step([N, N]);
      const p = m.projectiles.find((q) => q.cloud);
      if (p) path.push([Math.round(p.x * 100), Math.round(p.y * 100)]);
    }
    hold(m, 80);
    return { m, path };
  };
  const a = run();
  const b = run();
  assert.deepEqual(a.path, b.path, "same seed, same path");
  const ys = new Set(a.path.slice(0, 40).map((p) => p[1]));
  assert.ok(ys.size > 10, "it wanders rather than flying straight");
  const hits = hitsBy(a.m, "boltzmann_machine");
  assert.equal(hits.length, 3, "three hits once it settles");
});

test("Boltzmann velocity: wander before settleAt, homing after", () => {
  const opp = { x: 300, y: 0, isLying: false, crouching: false };
  const p = { x: 0, y: -150, age: 10, facing: 1, cloud: { seed: 5, settleAt: 70, drift: 90, wander: 90, homing: 330 } };
  const early = cloudVelocity(p, opp);
  assert.ok(early.vx > 0 && early.vx < 200);
  p.age = 80;
  const late = cloudVelocity(p, opp);
  assert.ok(Math.abs(Math.hypot(late.vx, late.vy) - 330) < 1e-6);
  assert.ok(late.vx > 0 && late.vy > 0, "homes down toward the body");
});

test("at most two clouds per Geoffrey; Scale Up settles on the opponent at once", () => {
  const m = makeMatch({ p1: [geoffrey], p2: [sam] });
  place(m, -700, 700);
  for (let i = 0; i < 3; i += 1) {
    play(m, 0, qcf(BTN.LP));
    hold(m, 46);
  }
  assert.equal(m.projectiles.filter((p) => p.cloud && !p.dead).length, 2);

  const s = makeMatch({ p1: [geoffrey], p2: [sam] });
  place(s, -500, 300);
  s.sides[0].meter = 100;
  play(s, 0, [...qcf(BTN.LP), { buttons: BTN.BLOCK }]);
  until(s, () => s.projectiles.length > 0, 30);
  const p = s.projectiles[0];
  assert.equal(p.cloud.settleAt, 0);
  assert.ok(Math.abs(p.x - 300) < 1, "spawned over Sam");
});

// ---------------------------------------------------------------- stance router


test("Emeritus: Geoffrey's Rollback breaker costs one bar", () => {
  const m = makeMatch({ p1: [sam], p2: [geoffrey] });
  place(m, -60, 60);
  m.sides[1].meter = 100;
  const g = m.point(1);
  for (let i = 0; i < 2; i += 1) m.applyContact(m.point(0), g, contactProps("jab", { damage: 20, hitstun: 30 }, "normal"), { x: 0, y: -120 }, { dir: 1 });
  m.sides[1].meter = 100;
  assert.ok(g.isStunned && g.combo.hits >= 2);
  hold(m, 9, N, { dir: 4 });
  const before = m.sides[1].meter;
  assert.ok(before < RULES.breakerCost);
  m.step([N, { dir: 4, buttons: BTN.BLOCK }]);
  assert.equal(events(m, "breaker").length, 1);
  assert.equal(m.sides[1].meter, before - 100);
  assert.equal(RULES.breakerCost, 200, "everyone else still pays two");
});

// ---------------------------------------------------------------- 2v2 assists

test("Geoffrey: counter window is exactly frames 4-21", () => {
  for (const [frame, expect] of [[3, 0], [4, 1], [21, 1], [22, 0]]) {
    const m = makeMatch({ p1: [geoffrey], p2: [sam] });
    place(m, -60, 60);
    play(m, 0, dnb(BTN.LP));
    const g = m.point(0);
    while (g.moveFrame < frame) m.step([N, N]);
    m.applyContact(m.point(1), g, contactProps("probe", { damage: 30, level: "mid" }, "normal"), { x: 0, y: -120 }, { dir: -1 });
    assert.equal(events(m, "returnCounter").length, expect, `frame ${frame}`);
  }
});

test("Geoffrey: Dropout palm lands on 26, Boltzmann spawns on 18, Forward-Forward waves on 10 and 28", () => {
  assert.equal(frameOf(geoffrey, qcb(BTN.LK), hitWith("dropout"), { at: [-60, 40] }).frame, 26);
  assert.equal(frameOf(geoffrey, qcf(BTN.LP), (m) => m.projectiles.length > 0, { at: [-400, 400] }).frame, 18);
  const waves = [];
  frameOf(geoffrey, superQcf, (m, f) => {
    if (m.projectiles.length > waves.length) waves.push(f.moveFrame);
    return waves.length >= 2;
  }, { at: [-600, 600], meter: 300 });
  assert.deepEqual(waves, [10, 28]);
});
