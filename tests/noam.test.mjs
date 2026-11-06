import test from "node:test";
import assert from "node:assert/strict";
import { BTN, N, dario, events, hold, makeMatch, place, play, sam, until } from "./helpers.mjs";
import { Match } from "../src/combat/match.js";
import { createCpu } from "../src/combat/ai.js";
import { loadCharacter } from "../src/characters/index.js";
import { RULES } from "../src/combat/constants.js";
import { constructsOf, propsFor as contactProps } from "../src/combat/mechanics/targeting.js";
import noam from "../src/characters/noam.js";
import { activeBeam } from "../src/combat/mechanics/tracking-beam.js";
import { stanceNormals } from "../src/combat/mechanics/stance-router.js";

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

test("noam: specials match the roster doc table (S / A / R)", () => {
  const rows = [
  ["attention", "QCF+P", 17, 24, 28],
  ["mixture_of_experts", "D,N,B+K", 8, 40, 8],
  ["one_write_head", "B,F+P", 14, 12, 26],
];
  assert.deepEqual(noam.specials.map((s) => s.id), rows.map((r) => r[0]));
  rows.forEach(([sid, input, s, a, r], i) => {
    const m = noam.specials[i];
    assert.equal(m.input, input, `${sid} input`);
    assert.deepEqual([m.startup, m.active, m.recovery], [s, a, r], `${sid} S/A/R`);
    assert.equal(m.total, s + a + r - 1);
    assert.equal(m.anim, `special_${i + 1}`);
  });
  assert.equal(noam.super.input, "QCF,QCF+HP");
  assert.equal(noam.super.meterCost, 300);
});

test("noam: doc numbers that live in mechanic data", () => {
  const at = sp(noam, "attention");
  assert.deepEqual([at.mechanicData.lockFrame, at.mechanicData.duration, at.mechanicData.hits, at.mechanicData.damage], [17, 24, 5, 14]);
  assert.equal(at.variants.HP.mechanicData.duration, 32);
  assert.deepEqual([sp(noam, "one_write_head").hits, sp(noam, "one_write_head").damage], [3, 30]);
  const moe = sp(noam, "mixture_of_experts");
  assert.deepEqual([moe.variants.HK.scaled.mechanicData.step, moe.variants.HK.scaled.mechanicData.top2], [-1, 240]);
  assert.equal(moe.variants.LK.scaled.mechanicData.step, 1);
});

test("noam: super startup, total damage, invulnerability and finisher", () => {
  const mv = noam.super;
  const data = mv.mechanicData;
  const total = data?.hits && data?.damage ? data.hits * data.damage
    : mv.projectile ? mv.projectile.hits * mv.projectile.damage + (data?.spawns || []).reduce((t, x) => t + x.projectile.hits * x.projectile.damage, 0)
    : mv.hits * mv.damage;
  assert.deepEqual([mv.startup, total], [8, 340]);
  assert.equal(mv.invuln.to, mv.startup, "invulnerable through startup");
  assert.deepEqual([noam.finisher.input, noam.finisher.rangeName], ["D,F,D+HP", "mid"]);
});

test("noam: whiffed specials return to neutral after their total frames", () => {
  for (const [sid, motion] of [["attention", qcf(BTN.LP)], ["one_write_head", bf(BTN.LP)]]) {
    const m = makeMatch({ p1: [noam], p2: [sam] });
    place(m, -700, 700);
    play(m, 0, motion);
    const f = m.point(0);
    assert.equal(f.move?.id, sid);
    let n = 1;
    while (f.state === "attack" && n < 200) {
      m.step([N, N]);
      n += 1;
    }
    assert.equal(n, sp(noam, sid).total, `${sid} lasts ${sp(noam, sid).total} frames`);
  }
});

test("noam: finisher triggers from its input at its listed range", () => {
  const m = makeMatch({ p1: [noam], p2: [sam], roundsToWin: 1 });
  place(m, -40, 40);
  m.point(1).health = 1;
  play(m, 0, [{ buttons: BTN.LP }, { frames: 30 }]);
  assert.equal(m.phase, "finish", "FINAL COMMIT");
  for (let i = 0; i < 40 && m.point(1).state !== "dazed"; i += 1) m.step([N, N]);
  place(m, -300 / 2, 300 / 2);
  play(m, 0, [...[{ dir: 2 }, { dir: 6 }, { dir: 2, buttons: BTN.HP }], { frames: 4 }]);
  assert.equal(events(m, "finisher")[0]?.id, noam.finisher.id);
});

// ---------------------------------------------------------------- 2v2 and CPU

test("noam: assist A and B run their mechanics, then go home", () => {
  const m = makeMatch({ mode: "2v2", p1: [sam, noam], p2: [dario, sam] });
  place(m, -250, 250);
  play(m, 0, [{ buttons: BTN.TAG }, { frames: 2 }]);
  assert.equal(events(m, "assist")[0].moveId, "attention");
  hold(m, 520);
  play(m, 0, [{ dir: 4, buttons: BTN.TAG }, { dir: 4, frames: 2 }]);
  assert.equal(events(m, "assist")[1]?.moveId, "one_write_head");
  hold(m, 160);
  assert.equal(m.sides[0].members[1].onField, false);
});

test("noam: CPU kit plays all three specials and a stance route", async () => {
  const r = await cpuMatch({ p1: ["noam"], p2: ["sam"] });
  const used = new Set(r.of("special").map((s) => s.moveId));
  for (const s of ["attention", "mixture_of_experts", "one_write_head"]) assert.ok(used.has(s), `uses ${s} (used: ${[...used].join(", ")})`);
  assert.ok(((r) => r.of("stance").length > 0)(r), "signature mechanic");
  assert.ok(r.log.filter((e) => e.name === "hit" && e.payload.side === 0).length > 10, "lands hits");
});

// ---------------------------------------------------------------- mechanics

test("Mixture of Experts: LK routes forward, HK back, extra presses cycle, lock-in swaps HP/HK", () => {
  const m = makeMatch({ p1: [noam], p2: [sam] });
  place(m, -400, 300);
  route(m, BTN.LK);
  assert.equal(events(m, "stance").at(-1).stance, "striker");
  play(m, 0, [{ buttons: BTN.HP }]);
  assert.equal(m.point(0).move.id, "hp_striker");
  assert.equal(m.point(0).move.startup, 9);
  until(m, () => m.point(0).isNeutral, 40);
  route(m, BTN.LK, [BTN.LK]);
  assert.equal(events(m, "stance").at(-1).stance, "zoner");
  route(m, BTN.HK);
  assert.equal(events(m, "stance").at(-1).stance, "grappler");
  assert.equal(m.snapshot().mechanics.stances[0].stance, "grappler");
});

test("router locks 8 frames after the last press and ends the move early", () => {
  const m = makeMatch({ p1: [noam], p2: [sam] });
  place(m, -400, 300);
  play(m, 0, dnb(BTN.LK));
  const start = m.frame;
  until(m, () => events(m, "stance").length > 0, 60);
  assert.equal(m.frame - start + 1, 16, "opens on 8, locks on 16");
  until(m, () => m.point(0).isNeutral, 40);
  assert.ok(m.frame - start < 30, "move ends well before its 55-frame maximum");
});

test("experts: Grappler HP is a command grab, Zoner HK fires a dart, Guard HP parries", () => {
  const g = makeMatch({ p1: [noam], p2: [sam] });
  place(g, -400, 300);
  route(g, BTN.HK, [BTN.HK]);
  assert.equal(events(g, "stance").at(-1).stance, "zoner");
  play(g, 0, [{ buttons: BTN.HK }, { frames: 14 }]);
  assert.equal(g.projectiles.filter((p) => p.moveId === "hk_zoner").length, 1);

  const gr = makeMatch({ p1: [noam], p2: [sam] });
  place(gr, -400, 300);
  route(gr, BTN.LK, [BTN.LK]);
  assert.equal(events(gr, "stance").at(-1).stance, "grappler");
  place(gr, -40, 40);
  hold(gr, 2, N, GUARD);
  play(gr, 0, [{ buttons: BTN.HP }, { frames: 30 }], GUARD);
  const thr = events(gr, "throw")[0];
  assert.ok(thr && thr.moveId === "hp_grappler", "grabs a blocking opponent");

  const gu = makeMatch({ p1: [noam], p2: [sam] });
  place(gu, -400, 300);
  route(gu, BTN.HK);
  assert.equal(events(gu, "stance").at(-1).stance, "guard");
  place(gu, -60, 60);
  play(gu, 0, [{ buttons: BTN.HP }]);
  play(gu, 1, [{ buttons: BTN.LP }, { frames: 30 }]);
  assert.equal(events(gu, "parry").length, 1);
  assert.ok(gu.point(1).health < 1000);
});

test("Scale Up router: top-2 experts for 240 frames", () => {
  const m = makeMatch({ p1: [noam], p2: [sam] });
  place(m, -400, 300);
  m.sides[0].meter = 100;
  play(m, 0, [...dnb(BTN.HK), { buttons: BTN.BLOCK }, { frames: 4 }]);
  until(m, () => m.point(0).isNeutral, 40);
  const st = events(m, "stance").at(-1);
  assert.deepEqual([st.stance, st.second], ["guard", "striker"]);
  const sn = stanceNormals(m.point(0));
  assert.equal(sn.hp.id, "hp_guard");
  assert.equal(sn.hk.id, "hk_striker", "the second expert fills HK");
  hold(m, 240);
  assert.equal(stanceNormals(m.point(0)).hk, undefined);
  assert.equal(stanceNormals(m.point(0)).hp.id, "hp_guard");
});

test("Residual: c.HP's copy hits again 10 frames later", () => {
  const m = makeMatch({ p1: [noam], p2: [sam] });
  place(m, -50, 50);
  play(m, 0, [{ dir: 2, buttons: BTN.HP }, { dir: 2, frames: 40 }]);
  const hits = events(m, "hit");
  assert.equal(hits[0].moveId, "c_hp");
  assert.equal(hits[1]?.moveId, "c_hp_echo");
  const frames = m.log.filter((e) => e.name === "hit").map((e) => e.frame);
  assert.ok(frames[1] - frames[0] >= 10, "echo lands at least 10 frames after the original");
});

// ---------------------------------------------------------------- tracking beam

test("Attention beam locks on at 17 and follows a moving opponent", () => {
  const m = makeMatch({ p1: [noam], p2: [sam] });
  place(m, -300, 100);
  play(m, 0, qcf(BTN.LP));
  const beam = () => activeBeam(m.point(0));
  until(m, () => beam(), 30);
  const lockX = beam().tx;
  m.point(1).x += 150;
  hold(m, 5);
  const moved = beam().tx - lockX;
  assert.ok(moved > 30 && moved <= 9 * 5 + 0.01, `aim sweeps after the opponent at up to 9 px/frame (moved ${moved})`);
  hold(m, 30);
  assert.equal(hitsBy(m, "attention").length, 5);
});

test("Attention tracks a jump; HP lasts longer; Scale Up fires three beams", () => {
  const j = makeMatch({ p1: [noam], p2: [sam] });
  place(j, -300, 150);
  play(j, 0, qcf(BTN.LP));
  hold(j, 14, N, { dir: 8 });
  hold(j, 40);
  assert.ok(hitsBy(j, "attention").length >= 2, "hits the jumping opponent");

  const hp = makeMatch({ p1: [noam], p2: [sam] });
  place(hp, -300, 300);
  play(hp, 0, qcf(BTN.HP));
  hold(hp, 16 + 29);
  assert.ok(activeBeam(hp.point(0)), "HP beam still live at frame 47");

  const up = makeMatch({ p1: [noam], p2: [sam] });
  place(up, -300, 100);
  up.sides[0].meter = 100;
  play(up, 0, [...qcf(BTN.LP), { buttons: BTN.BLOCK }]);
  until(up, () => activeBeam(up.point(0)), 30);
  assert.equal(activeBeam(up.point(0)).segments.length, 3);
  hold(up, 50);
  assert.equal(hitsBy(up, "attention").length, 7);
});

test("beams are cut short by an enemy barrier", () => {
  const m = makeMatch({ p1: [noam], p2: [dario] });
  place(m, -300, 200);
  play(m, 1, [{ dir: 2 }, { dir: 5 }, { dir: 6, buttons: BTN.LP }, { frames: 20 }]);
  assert.equal(m.barriers.length, 1);
  play(m, 0, qcf(BTN.LP));
  hold(m, 40);
  assert.equal(hitsBy(m, "attention").length, 0);
});

// ---------------------------------------------------------------- Mark debuff

test("Noam: beam first hit on 17, LP beam ends after 40, HP after 48; Write-Head hits on 14; super on 8", () => {
  assert.equal(frameOf(noam, qcf(BTN.LP), hitWith("attention"), { at: [-300, 100] }).frame, 17);
  for (const [bit, last] of [[BTN.LP, 40], [BTN.HP, 48]]) {
    let seen = 0;
    frameOf(noam, qcf(bit), (m, f) => {
      if (activeBeam(f)) seen = f.moveFrame;
      return f.state !== "attack";
    }, { at: [-300, 600] });
    assert.equal(seen, last, `beam live through frame ${last}`);
  }
  const owh = frameOf(noam, bf(BTN.LP), hitWith("one_write_head"), { at: [-100, 40] });
  assert.equal(owh.frame, 14);
  for (let i = 0; i < 40; i += 1) owh.m.step([N, N]);
  assert.equal(events(owh.m, "hit").filter((h) => h.moveId === "one_write_head").length, 3);
  assert.equal(frameOf(noam, superQcf, hitWith("divine_benevolence"), { at: [-300, 100], meter: 300 }).frame, 8);
});
