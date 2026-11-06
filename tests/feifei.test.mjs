import test from "node:test";
import assert from "node:assert/strict";
import { BTN, N, dario, events, hold, makeMatch, place, play, sam, until } from "./helpers.mjs";
import { Match } from "../src/combat/match.js";
import { createCpu } from "../src/combat/ai.js";
import { loadCharacter } from "../src/characters/index.js";
import { RULES } from "../src/combat/constants.js";
import { constructsOf, propsFor as contactProps } from "../src/combat/mechanics/targeting.js";
import feifei from "../src/characters/feifei.js";

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

test("feifei: specials match the roster doc table (S / A / R)", () => {
  const rows = [
  ["imagenet", "QCF+P", 17, 2, 30],
  ["marble_world", "D,N,B+P", 20, 2, 18],
  ["spatial_step", "QCB+K", 10, 1, 18],
];
  assert.deepEqual(feifei.specials.map((s) => s.id), rows.map((r) => r[0]));
  rows.forEach(([sid, input, s, a, r], i) => {
    const m = feifei.specials[i];
    assert.equal(m.input, input, `${sid} input`);
    assert.deepEqual([m.startup, m.active, m.recovery], [s, a, r], `${sid} S/A/R`);
    assert.equal(m.total, s + a + r - 1);
    assert.equal(m.anim, `special_${i + 1}`);
  });
  assert.equal(feifei.super.input, "QCF,QCF+HP");
  assert.equal(feifei.super.meterCost, 300);
});

test("feifei: doc numbers that live in mechanic data", () => {
  const im = sp(feifei, "imagenet");
  assert.equal(im.variants.LP.projectile.damage, 55);
  assert.deepEqual([im.variants.HP.projectile.damage, im.variants.HP.projectile.spread.length], [25, 3]);
  assert.deepEqual([im.scaled.projectile.damage, im.scaled.projectile.hits], [15, 5]);
  assert.equal(sp(feifei, "marble_world").mechanicData.lifetime, 300);
  assert.equal(sp(feifei, "spatial_step").scaled.damage, 60);
});

test("feifei: super startup, total damage, invulnerability and finisher", () => {
  const mv = feifei.super;
  const data = mv.mechanicData;
  const total = data?.hits && data?.damage ? data.hits * data.damage
    : mv.projectile ? mv.projectile.hits * mv.projectile.damage + (data?.spawns || []).reduce((t, x) => t + x.projectile.hits * x.projectile.damage, 0)
    : mv.hits * mv.damage;
  assert.deepEqual([mv.startup, total], [9, 330]);
  assert.equal(mv.invuln.to, mv.startup, "invulnerable through startup");
  assert.deepEqual([feifei.finisher.input, feifei.finisher.rangeName], ["B,F,B+LK", "far"]);
});

test("feifei: whiffed specials return to neutral after their total frames", () => {
  for (const [sid, motion] of [["imagenet", qcf(BTN.LP)], ["marble_world", dnb(BTN.LP)], ["spatial_step", qcb(BTN.HK)]]) {
    const m = makeMatch({ p1: [feifei], p2: [sam] });
    place(m, -700, 700);
    play(m, 0, motion);
    const f = m.point(0);
    assert.equal(f.move?.id, sid);
    let n = 1;
    while (f.state === "attack" && n < 200) {
      m.step([N, N]);
      n += 1;
    }
    assert.equal(n, sp(feifei, sid).total, `${sid} lasts ${sp(feifei, sid).total} frames`);
  }
});

test("feifei: finisher triggers from its input at its listed range", () => {
  const m = makeMatch({ p1: [feifei], p2: [sam], roundsToWin: 1 });
  place(m, -40, 40);
  m.point(1).health = 1;
  play(m, 0, [{ buttons: BTN.LP }, { frames: 30 }]);
  assert.equal(m.phase, "finish", "FINAL COMMIT");
  for (let i = 0; i < 40 && m.point(1).state !== "dazed"; i += 1) m.step([N, N]);
  place(m, -900 / 2, 900 / 2);
  play(m, 0, [...[{ dir: 4 }, { dir: 6 }, { dir: 4, buttons: BTN.LK }], { frames: 4 }]);
  assert.equal(events(m, "finisher")[0]?.id, feifei.finisher.id);
});

// ---------------------------------------------------------------- 2v2 and CPU

test("feifei: assist A and B run their mechanics, then go home", () => {
  const m = makeMatch({ mode: "2v2", p1: [sam, feifei], p2: [dario, sam] });
  place(m, -250, 250);
  play(m, 0, [{ buttons: BTN.TAG }, { frames: 2 }]);
  assert.equal(events(m, "assist")[0].moveId, "imagenet");
  hold(m, 520);
  play(m, 0, [{ dir: 4, buttons: BTN.TAG }, { dir: 4, frames: 2 }]);
  assert.equal(events(m, "assist")[1]?.moveId, "marble_world");
  hold(m, 160);
  assert.equal(m.sides[0].members[1].onField, false);
});

test("feifei: CPU kit plays all three specials and a Marble construct", async () => {
  const r = await cpuMatch({ p1: ["feifei"], p2: ["sam"] });
  const used = new Set(r.of("special").map((s) => s.moveId));
  for (const s of ["imagenet", "marble_world", "spatial_step"]) assert.ok(used.has(s), `uses ${s} (used: ${[...used].join(", ")})`);
  assert.ok(((r) => r.of("construct").length > 0)(r), "signature mechanic");
  assert.ok(r.log.filter((e) => e.name === "hit" && e.payload.side === 0).length > 10, "lands hits");
});

// ---------------------------------------------------------------- mechanics

test("Marble platform: fighters land on it, stand on it and drop off the edge", () => {
  const m = makeMatch({ p1: [feifei], p2: [sam] });
  place(m, -400, 400);
  play(m, 0, [...dnb(BTN.LP), { frames: 20 }]);
  const plat = constructs(m)[0];
  assert.equal(plat.type, "platform");
  assert.equal(plat.top, -150);
  const s = m.point(1);
  s.x = plat.x;
  s.y = -260;
  s.setState("jump");
  until(m, () => !s.airborne, 60);
  assert.equal(s.y, -150, "lands on the platform");
  hold(m, 10);
  assert.equal(s.y, -150);
  assert.ok(s.isNeutral, "can stand and act up there");
  until(m, () => s.airborne, 60, N, { dir: 6 });
  until(m, () => !s.airborne, 60, N, { dir: 6 });
  assert.equal(s.y, 0, "walked off and fell to the floor");
});

test("Marble wall blocks ground movement and enemy projectiles, breaks at 150 HP, can be jumped", () => {
  const m = makeMatch({ p1: [feifei], p2: [sam] });
  place(m, -300, 300);
  play(m, 0, [...dnb(BTN.HP), { frames: 20 }]);
  const wall = constructs(m)[0];
  assert.equal(wall.type, "wall");
  assert.equal(wall.hp, 150);
  const s = m.point(1);
  hold(m, 90, N, { dir: 4 });
  assert.ok(s.x >= wall.x + wall.w / 2 + s.push.w / 2 - 0.5, "Sam is stopped by the wall");
  place(m, -300, 300);
  hold(m, 20);
  wall.life = 9999;
  const hp = [];
  const wallHp = () => constructs(m)[0]?.hp ?? 0;
  for (let i = 0; i < 3; i += 1) {
    const prev = wallHp();
    play(m, 1, [{ dir: 2 }, { dir: 1 }, { dir: 4, buttons: BTN.LP }]);
    until(m, () => wallHp() < prev, 150);
    hp.push(wallHp());
    hold(m, 20);
  }
  assert.deepEqual(hp, [95, 40, 0]);
  assert.deepEqual(events(m, "hit").map((h) => [h.moveId, h.x]), [], "Fei-Fei is shielded");
  assert.equal(constructs(m).length, 0, "three fireballs (165) break it");
  assert.equal(events(m, "constructEnd")[0].broken, true);
});

test("fighters can jump over and stand on top of a Marble wall", () => {
  const m = makeMatch({ p1: [feifei], p2: [sam] });
  place(m, -300, 300);
  play(m, 0, [...dnb(BTN.HP), { frames: 20 }]);
  const wall = constructs(m)[0];
  const s = m.point(1);
  s.x = wall.x + 140;
  play(m, 1, [{ dir: 7, frames: 2 }, { frames: 60 }]);
  assert.ok(s.x < wall.x, "jumped clean over");
  s.x = wall.x;
  s.y = -200;
  s.setState("jump");
  until(m, () => !s.airborne, 60);
  assert.equal(s.y, wall.top, "stands on top");
});

test("Spatial Step: LK lands on her platform, HK behind the opponent", () => {
  const m = makeMatch({ p1: [feifei], p2: [sam] });
  place(m, -400, 300);
  play(m, 0, dnb(BTN.LP));
  until(m, () => m.point(0).isNeutral, 60);
  const plat = constructs(m)[0];
  play(m, 0, [...qcb(BTN.LK), { frames: 30 }]);
  const f = m.point(0);
  assert.equal(f.x, plat.x);
  assert.equal(f.y, plat.top);
  assert.ok(f.isNeutral);

  const b = makeMatch({ p1: [feifei], p2: [sam] });
  place(b, -300, 100);
  play(b, 0, qcb(BTN.HK));
  let hidden = false;
  for (let i = 0; i < 8; i += 1) {
    b.step([N, N]);
    hidden ||= b.point(0).hidden;
  }
  assert.ok(hidden, "folds out of view");
  hold(b, 24);
  assert.ok(b.point(0).x > 100, "behind Sam");
});

test("Marble World Scale Up builds both; Spatial Intelligence extends lifetime 25%", () => {
  const m = makeMatch({ p1: [feifei], p2: [sam] });
  place(m, -400, 400);
  m.sides[0].meter = 100;
  play(m, 0, [...dnb(BTN.LP), { buttons: BTN.BLOCK }, { frames: 20 }]);
  const list = constructs(m);
  assert.deepEqual(list.map((c) => c.type).sort(), ["platform", "wall"]);
  assert.equal(list[0].maxLife, 375);
  assert.equal(m.point(0).def.passive, "Spatial Intelligence");
});

// ---------------------------------------------------------------- passives

test("Fei-Fei: ImageNet on 17 (HP = 3 rows), construct on 20, Spatial Step reappears on 9, worlds hit on 9/21/33", () => {
  assert.equal(frameOf(feifei, qcf(BTN.LP), (m) => m.projectiles.length > 0, { at: [-400, 400] }).frame, 17);
  const hp = frameOf(feifei, qcf(BTN.HP), (m) => m.projectiles.length > 0, { at: [-400, 400] });
  assert.equal(hp.m.projectiles.length, 3);
  assert.equal(frameOf(feifei, dnb(BTN.HP), (m) => constructsOf(m).length > 0, { at: [-400, 400] }).frame, 20);
  let vanished = 0;
  const back = frameOf(feifei, qcb(BTN.HK), (m, f) => {
    if (f.hidden && !vanished) vanished = f.moveFrame;
    return vanished && !f.hidden;
  }, { at: [-300, 100] });
  assert.deepEqual([vanished, back.frame], [3, 9]);
  const worlds = [];
  frameOf(feifei, superQcf, (m, f) => {
    const n = events(m, "hit").length;
    if (n > worlds.length) worlds.push(f.moveFrame);
    return worlds.length >= 3;
  }, { at: [-120, 40], meter: 300, cap: 120 });
  assert.deepEqual(worlds, [9, 21, 33]);
});

test("Group D CPU teams play a full 2v2 with assists", async () => {
  const r = await cpuMatch({ mode: "2v2", p1: ["geoffrey", "noam"], p2: ["chris", "feifei"], frames: 60 * 150, seed: 5 });
  const assists = r.log.filter((e) => e.name === "assist").map((e) => e.payload.fighter);
  assert.ok(assists.length >= 2, `assists were called (${assists.join(", ")})`);
  const snap = r.m.snapshot();
  assert.ok(Array.isArray(snap.mechanics.objects) && Array.isArray(snap.mechanics.stances) && Array.isArray(snap.mechanics.beams));
});
