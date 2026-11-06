import test from "node:test";
import assert from "node:assert/strict";
import { BTN, N, dario, events, hold, makeMatch, place, play, sam, until } from "./helpers.mjs";
import { Match } from "../src/combat/match.js";
import { createCpu } from "../src/combat/ai.js";
import { loadCharacter } from "../src/characters/index.js";
import { RULES } from "../src/combat/constants.js";
import { constructsOf, propsFor as contactProps } from "../src/combat/mechanics/targeting.js";
import chris from "../src/characters/chris.js";
import { isMarked } from "../src/combat/mechanics/mark.js";

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

test("chris: specials match the roster doc table (S / A / R)", () => {
  const rows = [
  ["feature_visualization", "QCF+P", 16, 2, 28],
  ["golden_gate", "D,N,B+P", 20, 2, 18],
  ["circuit_trace", "B,F+K", 15, 4, 24],
];
  assert.deepEqual(chris.specials.map((s) => s.id), rows.map((r) => r[0]));
  rows.forEach(([sid, input, s, a, r], i) => {
    const m = chris.specials[i];
    assert.equal(m.input, input, `${sid} input`);
    assert.deepEqual([m.startup, m.active, m.recovery], [s, a, r], `${sid} S/A/R`);
    assert.equal(m.total, s + a + r - 1);
    assert.equal(m.anim, `special_${i + 1}`);
  });
  assert.equal(chris.super.input, "QCF,QCF+HP");
  assert.equal(chris.super.meterCost, 300);
});

test("chris: doc numbers that live in mechanic data", () => {
  const fv = sp(chris, "feature_visualization");
  assert.deepEqual([fv.projectile.damage, fv.projectile.mech.mark.frames, fv.projectile.mech.mark.mul, fv.scaled.projectile.mech.mark.frames], [40, 240, 1.12, 360]);
  const gg = sp(chris, "golden_gate").mech.place;
  assert.deepEqual([gg.lifetime, gg.w / 2 + 16, gg.trigger.status.obsessed.frames, gg.trigger.damage], [300, 100, 40, 30]);
  const ct = sp(chris, "circuit_trace");
  assert.deepEqual([ct.damage, ct.mechanicData.markedBonus, ct.passThrough.from, ct.passThrough.to], [70, 20, 8, 14]);
  assert.equal(ct.variants.HK.scaled.hitbox, null);
  assert.equal(ct.variants.HK.scaled.mechanicData.markedRange, 1800);
});

test("chris: super startup, total damage, invulnerability and finisher", () => {
  const mv = chris.super;
  const data = mv.mechanicData;
  const total = data?.hits && data?.damage ? data.hits * data.damage
    : mv.projectile ? mv.projectile.hits * mv.projectile.damage + (data?.spawns || []).reduce((t, x) => t + x.projectile.hits * x.projectile.damage, 0)
    : mv.hits * mv.damage;
  assert.deepEqual([mv.startup, total], [9, 330]);
  assert.equal(mv.invuln.to, mv.startup, "invulnerable through startup");
  assert.deepEqual([chris.finisher.input, chris.finisher.rangeName], ["F,D,F+LK", "mid"]);
});

test("chris: whiffed specials return to neutral after their total frames", () => {
  for (const [sid, motion] of [["feature_visualization", qcf(BTN.LP)], ["golden_gate", dnb(BTN.LP)]]) {
    const m = makeMatch({ p1: [chris], p2: [sam] });
    place(m, -700, 700);
    play(m, 0, motion);
    const f = m.point(0);
    assert.equal(f.move?.id, sid);
    let n = 1;
    while (f.state === "attack" && n < 200) {
      m.step([N, N]);
      n += 1;
    }
    assert.equal(n, sp(chris, sid).total, `${sid} lasts ${sp(chris, sid).total} frames`);
  }
});

test("chris: finisher triggers from its input at its listed range", () => {
  const m = makeMatch({ p1: [chris], p2: [sam], roundsToWin: 1 });
  place(m, -40, 40);
  m.point(1).health = 1;
  play(m, 0, [{ buttons: BTN.LP }, { frames: 30 }]);
  assert.equal(m.phase, "finish", "FINAL COMMIT");
  for (let i = 0; i < 40 && m.point(1).state !== "dazed"; i += 1) m.step([N, N]);
  place(m, -300 / 2, 300 / 2);
  play(m, 0, [...[{ dir: 6 }, { dir: 2 }, { dir: 6, buttons: BTN.LK }], { frames: 4 }]);
  assert.equal(events(m, "finisher")[0]?.id, chris.finisher.id);
});

// ---------------------------------------------------------------- 2v2 and CPU

test("chris: assist A and B run their mechanics, then go home", () => {
  const m = makeMatch({ mode: "2v2", p1: [sam, chris], p2: [dario, sam] });
  place(m, -250, 250);
  play(m, 0, [{ buttons: BTN.TAG }, { frames: 2 }]);
  assert.equal(events(m, "assist")[0].moveId, "feature_visualization");
  hold(m, 520);
  play(m, 0, [{ dir: 4, buttons: BTN.TAG }, { dir: 4, frames: 2 }]);
  assert.equal(events(m, "assist")[1]?.moveId, "golden_gate");
  hold(m, 160);
  assert.equal(m.sides[0].members[1].onField, false);
});

test("chris: CPU kit plays all three specials and a Mark", async () => {
  const r = await cpuMatch({ p1: ["chris"], p2: ["sam"] });
  const used = new Set(r.of("special").map((s) => s.moveId));
  for (const s of ["feature_visualization", "golden_gate", "circuit_trace"]) assert.ok(used.has(s), `uses ${s} (used: ${[...used].join(", ")})`);
  assert.ok(((r) => r.log.some((e) => e.name === "mark" && e.payload.by === "chris"))(r), "signature mechanic");
  assert.ok(r.log.filter((e) => e.name === "hit" && e.payload.side === 0).length > 10, "lands hits");
});

// ---------------------------------------------------------------- mechanics

test("Feature Visualization marks on block; Marked takes +12% for 240 frames", () => {
  const m = makeMatch({ p1: [chris], p2: [sam] });
  place(m, -300, 100);
  play(m, 0, qcf(BTN.LP), GUARD);
  until(m, () => events(m, "block").length > 0, 60, N, GUARD);
  assert.equal(events(m, "mark").length, 1);
  const s = m.point(1);
  assert.ok(isMarked(m.mech, s));
  assert.ok(statusOf(m, "sam", "mark") > 200, "snapshot lists the Mark status");
  hold(m, 30);
  place(m, -60, 60);
  play(m, 0, [{ buttons: BTN.LP }, { frames: 20 }]);
  assert.equal(events(m, "hit")[0].damage, Math.round(22 * 1.12));
  hold(m, 240);
  assert.equal(isMarked(m.mech, s), false, "expires");
});

test("Feature Visualization Scale Up marks for 360 frames", () => {
  const m = makeMatch({ p1: [chris], p2: [sam] });
  place(m, -300, 100);
  m.sides[0].meter = 100;
  play(m, 0, [...qcf(BTN.LP), { buttons: BTN.BLOCK }]);
  until(m, () => events(m, "mark").length > 0, 60);
  assert.equal(events(m, "mark")[0].frames, 360);
});

// ---------------------------------------------------------------- compulsion pull

test("Golden Gate springs within 100 px and pulls the opponent toward it for 40 frames", () => {
  const m = makeMatch({ p1: [chris], p2: [sam] });
  place(m, -300, 200);
  play(m, 0, [...dnb(BTN.HP), { frames: 20 }]);
  const trap = bridges(m)[0];
  assert.ok(trap && Math.abs(trap.x - 0) < 1, "HP places it 300 px ahead");
  until(m, () => events(m, "compulsion").length > 0, 120, N, { dir: 4 });
  const s = m.point(1);
  assert.ok(Math.abs(s.x - trap.x) <= 100 + 4);
  const x0 = s.x;
  hold(m, 30, N, { dir: 6, buttons: BTN.BLOCK });
  assert.ok(s.x < x0 - 20, "pulled toward the bridge while holding away and blocking");
  assert.equal(bridges(m).length, 0, "trap consumed");
  hold(m, 20);
  assert.equal(statusOf(m, "sam", "obsessed"), undefined, "pull ends after 40 frames");
});

test("Golden Gate Scale Up doubles the range; only one bridge at a time", () => {
  const m = makeMatch({ p1: [chris], p2: [sam] });
  place(m, -400, 300);
  m.sides[0].meter = 100;
  play(m, 0, [...dnb(BTN.LP), { buttons: BTN.BLOCK }, { frames: 24 }]);
  assert.equal(bridges(m)[0].w, 368, "200 px obsession range");
  play(m, 0, [...dnb(BTN.HP), { frames: 24 }]);
  assert.equal(bridges(m).length, 1);
});

// ---------------------------------------------------------------- path-tracking strike


test("Circuit Trace HK goes full-screen and tracks a jumping Marked target", () => {
  const m = makeMatch({ p1: [chris], p2: [sam] });
  place(m, -600, 300);
  markSam(m);
  play(m, 0, bf(BTN.HK), { dir: 8 });
  until(m, () => hitsBy(m, "circuit_trace").length > 0, 20, N, { dir: 8 });
  const hit = hitsBy(m, "circuit_trace")[0];
  assert.ok(hit, "reaches a target 900 px away mid-jump");
  assert.equal(hit.damage, Math.round((70 + 20) * 1.12));
});

test("Circuit Trace against an unmarked target stops at its range", () => {
  const m = makeMatch({ p1: [chris], p2: [sam] });
  place(m, -600, 300);
  play(m, 0, [...bf(BTN.HK), { frames: 40 }]);
  assert.equal(hitsBy(m, "circuit_trace").length, 0);
  assert.ok(m.point(0).x < -600 + 300, "travels at most 300 px");
  const lk = makeMatch({ p1: [chris], p2: [sam] });
  place(lk, -100, 100);
  play(lk, 0, [...bf(BTN.LK), { frames: 20 }]);
  assert.equal(hitsBy(lk, "circuit_trace")[0].damage, 70);
});

test("Circuit Trace Scale Up: Rabbit lands the strike 30 frames later without Chris moving", () => {
  const m = makeMatch({ p1: [chris], p2: [sam] });
  place(m, -300, -110);
  m.sides[0].meter = 100;
  play(m, 0, [...bf(BTN.LK), { buttons: BTN.BLOCK }]);
  const start = m.frame - 1;
  until(m, () => hitsBy(m, "circuit_trace").length > 0, 60);
  assert.equal(m.frame - start + 1, 8 + 30, "rabbit fires on move frame dashFrom + 30");
  assert.ok(Math.abs(m.point(0).x + 300) < 5, "Chris stayed put");
});

// ---------------------------------------------------------------- platforms and walls

test("mechanic state resets every round", () => {
  const m = makeMatch({ p1: [chris], p2: [sam], roundsToWin: 2 });
  place(m, -300, 200);
  play(m, 0, [...dnb(BTN.LP), { frames: 24 }]);
  assert.equal(bridges(m).length, 1);
  markSam(m);
  m.point(1).health = 1;
  place(m, -60, 60);
  play(m, 0, [{ buttons: BTN.LP }, { frames: 20 }]);
  until(m, () => m.round === 2, 600);
  assert.equal(bridges(m).length, 0);
  assert.equal(isMarked(m.mech, m.point(1)), false);
});

test("Chris: orb on 16, bridge on 20, Circuit Trace hits on 15, super on 9", () => {
  assert.equal(frameOf(chris, qcf(BTN.LP), (m) => m.projectiles.length > 0, { at: [-400, 400] }).frame, 16);
  assert.equal(frameOf(chris, dnb(BTN.LP), (m) => m.mech.objects.some((o) => o.look === "golden_gate"), { at: [-400, 400] }).frame, 20);
  assert.equal(frameOf(chris, bf(BTN.LK), hitWith("circuit_trace"), { at: [-150, 60] }).frame, 15);
  assert.equal(frameOf(chris, superQcf, hitWith("scaling_monosemanticity"), { at: [-150, 60], meter: 300 }).frame, 9);
});
