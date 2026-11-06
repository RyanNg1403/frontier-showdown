import test from "node:test";
import assert from "node:assert/strict";
import { BTN, N, events, hold, makeMatch, place, play, sam, dario, until } from "./helpers.mjs";
import andrej from "../src/characters/andrej.js";
import yann from "../src/characters/yann.js";
import liang from "../src/characters/liang.js";
import mustafa from "../src/characters/mustafa.js";
import { RULES } from "../src/combat/constants.js";
import { createCpu } from "../src/combat/ai.js";
import { Match } from "../src/combat/match.js";

const GUARD = { dir: 5, buttons: BTN.BLOCK };
const LOW_GUARD = { dir: 2, buttons: BTN.BLOCK };
const qcf = (bit = BTN.LP) => [{ dir: 2 }, { dir: 3 }, { dir: 6, buttons: bit }];
const qcb = (bit = BTN.LP) => [{ dir: 2 }, { dir: 1 }, { dir: 4, buttons: bit }];
const dp = (bit = BTN.LK) => [{ dir: 6 }, { dir: 2 }, { dir: 3, buttons: bit }];
const dnb = (bit = BTN.LP) => [{ dir: 2 }, { dir: 5 }, { dir: 4, buttons: bit }];
const bf = (bit = BTN.LK) => [{ dir: 4 }, { dir: 6, buttons: bit }];
const superInput = [{ dir: 2 }, { dir: 3 }, { dir: 6 }, { dir: 2 }, { dir: 3 }, { dir: 6, buttons: BTN.HP }];
const MIRROR = [0, 3, 2, 1, 6, 5, 4, 9, 8, 7];
const mirror = (steps) => steps.map((st) => ({ ...st, dir: MIRROR[st.dir ?? 5] }));
const special = (m, id) => events(m, "special").filter((e) => e.moveId === id);
const mine = (m, side) => m.projectiles.filter((p) => p.side === side);

// ------------------------------------------------------------------ frame data

const FRAME_DATA = {
  andrej: { tokenizer: [16, 30], vibe_coding: [12, 14], rubiks_rotation: [6, 34, 10] },
  yann: { convolution: [16, 28], rc_air_strike: [18, 26], cake_analogy: [20, 18] },
  liang: { aha_moment: [3, 24, 12], latent_attention: [13, 26], group_relative: [14, 26, 9] },
  mustafa: { containment_field: [18, 20], coming_wave: [18, 28], copilot: [10, 18] },
};
const DEFS = { andrej, yann, liang, mustafa };

for (const [id, moves] of Object.entries(FRAME_DATA)) {
  test(`${id}: specials follow the roster doc frame data (startup / recovery / active)`, () => {
    const c = DEFS[id];
    assert.deepEqual(c.specials.map((s) => s.id), Object.keys(moves));
    for (const [moveId, [startup, recovery, active]] of Object.entries(moves)) {
      const m = c.moves.get(moveId);
      assert.equal(m.startup, startup, `${moveId} startup`);
      assert.equal(m.recovery, recovery, `${moveId} recovery`);
      if (active) assert.equal(m.active, active, `${moveId} active`);
      for (const v of Object.values(m.variants || {})) assert.equal(v.startup, startup, `${moveId} variant startup`);
      if (m.scaled) assert.equal(m.scaled.startup, startup, `${moveId} Scale Up startup`);
    }
  });
}

test("Group C kits, inputs, supers, finishers and assists match the doc", () => {
  const inputs = (c) => c.specials.map((s) => s.input);
  assert.deepEqual(inputs(andrej), ["QCF+P", "D,N,B+P", "DP+K"]);
  assert.deepEqual(inputs(yann), ["QCF+P", "QCB+P", "D,N,B+K"]);
  assert.deepEqual(inputs(liang), ["D,N,B+P", "QCF+P", "B,F+K"]);
  assert.deepEqual(inputs(mustafa), ["D,N,B+P", "QCF+K", "QCB+P"]);
  assert.deepEqual([andrej, yann, liang, mustafa].map((c) => c.super.id), ["microgpt", "jepa", "whale_breach", "modern_turing_test"]);
  assert.deepEqual([andrej, yann, liang, mustafa].map((c) => c.super.meterCost), [300, 300, 200, 300]);
  assert.deepEqual([andrej, yann, liang, mustafa].map((c) => [c.finisher.input, c.finisher.rangeName]), [
    ["B,D,F+HP", "mid"], ["D,B,F+LK", "far"], ["F,D,B+LK", "mid"], ["B,B,F+HP", "mid"],
  ]);
  assert.deepEqual([andrej, yann, liang, mustafa].map((c) => ({ ...c.assists })), [
    { a: "tokenizer", b: "rubiks_rotation" },
    { a: "convolution", b: "rc_air_strike" },
    { a: "latent_attention", b: "group_relative" },
    { a: "coming_wave", b: "containment_field" },
  ]);
  assert.deepEqual([andrej, yann, liang, mustafa].map((c) => c.passive), ["Responsible Scaling", "World Model", "Cheap Training", "Copilot"]);
  assert.deepEqual([andrej, yann, liang, mustafa].map((c) => c.stats.health), [980, 1000, 900, 1020]);
  assert.equal(liang.normals.lp.startup, 6, "fastest jab in the game");
  for (const c of [andrej, yann, liang, mustafa]) {
    assert.ok(c.quotes.intro && c.quotes.victory.length === 2, `${c.id} quotes`);
    for (const k of ["primary", "secondary", "accent", "skin", "hair"]) assert.match(c.palette[k], /^#[0-9a-f]{6}$/i);
  }
  assert.ok(yann.palette.glasses && mustafa.palette.glasses && liang.palette.glasses && !andrej.palette.glasses);
  assert.ok(mustafa.palette.beard, "Mustafa has a full short beard");
});

test("projectile specials spawn on their startup frame", () => {
  for (const [def, steps, id] of [[andrej, qcf(), "tokenizer"], [yann, qcf(), "convolution"], [yann, qcb(), "rc_air_strike"], [liang, qcf(), "latent_attention"], [mustafa, qcf(BTN.LK), "coming_wave"]]) {
    const m = makeMatch({ p1: [def], p2: [dario] });
    place(m, -400, 400);
    play(m, 0, steps);
    const f = m.point(0);
    assert.equal(f.move?.id, id);
    const startup = f.move.startup;
    until(m, () => mine(m, 0).length > 0, 40);
    assert.equal(f.moveFrame, startup, `${id} spawns on frame ${startup}`);
  }
});

// ------------------------------------------------------------------ Andrej

test("Tokenizer splits into three tokens (up, straight, low); LP early, HP late", () => {
  const splitAge = (bit) => {
    const m = makeMatch({ p1: [andrej], p2: [dario] });
    place(m, -700, 700);
    play(m, 0, qcf(bit));
    until(m, () => mine(m, 0).length > 0, 40);
    const first = mine(m, 0)[0];
    const n = until(m, () => mine(m, 0).length === 3, 60);
    const kids = mine(m, 0);
    assert.equal(kids.length, 3);
    assert.ok(first.dead && !kids.includes(first));
    assert.deepEqual(kids.map((k) => Math.sign(k.vy)), [-1, 0, 1]);
    assert.deepEqual(kids.map((k) => k.def.level), ["mid", "mid", "low"]);
    assert.ok(kids.every((k) => k.def.damage === 20));
    return n;
  };
  const early = splitAge(BTN.LP);
  const late = splitAge(BTN.HP);
  assert.ok(late - early >= 15, `HP splits later (${early} vs ${late})`);
});

test("Tokenizer low token rides the floor and must be crouch-blocked; Scale Up throws five", () => {
  const m = makeMatch({ p1: [andrej], p2: [dario] });
  place(m, -700, 700);
  m.sides[0].meter = 100;
  play(m, 0, [...qcf(), { buttons: BTN.BLOCK }]);
  assert.equal(events(m, "scaleUp").length, 1);
  until(m, () => mine(m, 0).length === 5, 60);
  const kids = mine(m, 0);
  assert.equal(kids.length, 5, "five tokens");
  assert.equal(kids.filter((k) => k.def.level === "low").length, 1, "one aimed low");
  hold(m, 40);
  const low = mine(m, 0).find((k) => k.def.level === "low");
  assert.ok(low.y >= -18.01 && low.y <= -17.99, "low token hugs the floor");
});

test("Vibe Coding: no hold-block, free chaining, whiff cancels; ends when hit; Scale Up lasts 6 s", () => {
  const m = makeMatch({ p1: [andrej], p2: [sam] });
  place(m, -60, 60);
  play(m, 0, [...dnb(), { frames: 14 }]);
  const a = m.point(0);
  assert.equal(m.mech.status(a, "stance").frames > 200, true, "4 s stance");
  assert.equal(a.mods.noBlock, true);
  hold(m, 16, GUARD);
  // Holding BLK does not guard: Sam's jab hits.
  play(m, 1, [{ buttons: BTN.LP }, { frames: 12 }], GUARD);
  const hits = events(m, "hit").filter((h) => h.side === 1);
  assert.equal(hits.length, 1, "holding block does nothing in Vibe Coding");
  assert.equal(m.mech.status(a, "stance"), null, "stance ends when hit");

  // Chaining LP into HK (not in Andrej's normal cancel list) and whiff-cancelling into a special.
  const m2 = makeMatch({ p1: [andrej], p2: [dario] });
  place(m2, -60, 60);
  play(m2, 0, [...dnb(), { frames: 30 }]);
  play(m2, 0, [{ buttons: BTN.LP }, { frames: 8 }, { buttons: BTN.HK }, { frames: 10 }]);
  assert.equal(m2.point(0).move?.id, "hk", "LP chains into HK during Vibe Coding");
  const m3 = makeMatch({ p1: [andrej], p2: [dario] });
  place(m3, -500, 500);
  play(m3, 0, [...dnb(), { frames: 30 }, { buttons: BTN.HP }, { frames: 12 }, ...qcf(), { frames: 2 }]);
  assert.equal(m3.point(0).move?.id, "tokenizer", "whiffed HP cancels into Tokenizer");
  const m4 = makeMatch({ p1: [andrej], p2: [dario] });
  place(m4, -500, 500);
  play(m4, 0, [{ buttons: BTN.HP }, { frames: 12 }, ...qcf(), { frames: 2 }]);
  assert.notEqual(m4.point(0).move?.id, "tokenizer", "no whiff cancel outside the stance");

  const m5 = makeMatch({ p1: [andrej], p2: [dario] });
  place(m5, -500, 500);
  m5.sides[0].meter = 100;
  play(m5, 0, [...dnb(), { buttons: BTN.BLOCK }, { frames: 14 }]);
  const st = m5.mech.status(m5.point(0), "stance");
  assert.ok(st.frames > 330 && st.damage === 1.08, "Scale Up: 6 s and +8% damage");
});

test("Vibe Coding still allows an Alignment Block", () => {
  const m = makeMatch({ p1: [andrej], p2: [sam] });
  place(m, -60, 60);
  play(m, 0, [...dnb(), { frames: 30 }]);
  m.step([N, { dir: 5, buttons: BTN.LP }]);
  for (let i = 0; i < 12 && !events(m, "block").length && !events(m, "hit").length; i += 1) {
    const s = m.point(1);
    const press = s.state === "attack" && s.moveFrame === s.move.startup - 2;
    m.step([press ? GUARD : N, N]);
  }
  const block = events(m, "block")[0];
  assert.ok(block && block.aligned, "a fresh BLK tap just before the hit still guards");
  assert.ok(m.mech.status(m.point(0), "stance"), "blocking does not end the stance");
});

test("micrograd target combo: F+LP (low), LP, HP", () => {
  const m = makeMatch({ p1: [andrej], p2: [dario] });
  place(m, -60, 60);
  assert.equal(andrej.normals.f_lp.level, "low");
  play(m, 0, [{ dir: 6, buttons: BTN.LP }, { frames: 11 }, { buttons: BTN.LP }, { frames: 13 }, { buttons: BTN.HP }, { frames: 30 }]);
  const ids = events(m, "hit").filter((h) => h.side === 0).map((h) => h.moveId);
  assert.deepEqual(ids, ["f_lp", "lp", "hp"]);
});

test("Rubik's Rotation: 3 hits, invulnerable 1-6; Scale Up hits 5 times and wall-bounces", () => {
  const m = makeMatch({ p1: [andrej], p2: [dario] });
  place(m, -60, 60);
  play(m, 0, [...dp(), { frames: 40 }]);
  assert.equal(events(m, "hit").filter((h) => h.moveId === "rubiks_rotation").length, 3);
  const inv = makeMatch({ p1: [andrej], p2: [dario] });
  place(inv, -60, 400);
  play(inv, 0, dp());
  const f = inv.point(0);
  assert.equal(f.moveFrame, 1);
  assert.equal(f.invulnTo("strike"), true);
  hold(inv, 5);
  assert.equal(f.moveFrame, 6);
  assert.equal(f.invulnTo("strike"), true);
  hold(inv, 1);
  assert.equal(f.invulnTo("strike"), false);

  const w = makeMatch({ p1: [andrej], p2: [dario] });
  place(w, 700, 790);
  w.sides[0].meter = 100;
  play(w, 0, [...dp(), { buttons: BTN.BLOCK }, { frames: 70 }]);
  assert.equal(events(w, "hit").filter((h) => h.moveId === "rubiks_rotation").length, 5);
  assert.equal(events(w, "wallBounce").length, 1, "bounced off the wall once");
});

test("microgpt drops a transformer block onto the opponent from above (overhead)", () => {
  const m = makeMatch({ p1: [andrej], p2: [dario] });
  place(m, -500, 300);
  m.sides[0].meter = 300;
  play(m, 0, superInput);
  until(m, () => m.projectiles.some((p) => p.category === "super"), 80);
  const p = m.projectiles.find((q) => q.category === "super");
  assert.ok(Math.abs(p.x - m.point(1).x) < 1 && p.y < -400, "spawns over the opponent");
  hold(m, 30, N, LOW_GUARD);
  hold(m, 60);
  const hits = events(m, "hit").filter((h) => h.moveId === "microgpt");
  assert.ok(hits.length >= 3, "crouch-blocking an overhead fails");
});

// ------------------------------------------------------------------ Yann

test("Convolution: a ground kernel that hits 4 times low; Scale Up stacks a mid kernel", () => {
  const m = makeMatch({ p1: [yann], p2: [dario] });
  place(m, -300, 0);
  play(m, 0, qcf(BTN.HP));
  until(m, () => mine(m, 0).length > 0, 40);
  const k = mine(m, 0)[0];
  assert.ok(k.y > -40, "slides along the floor");
  assert.equal(k.def.level, "low");
  hold(m, 90, N, GUARD);
  assert.equal(events(m, "hit").filter((h) => h.moveId === "convolution").length, 4, "standing guard loses to a low");

  const b = makeMatch({ p1: [yann], p2: [dario] });
  place(b, -300, 0);
  play(b, 0, qcf(BTN.HP), LOW_GUARD);
  hold(b, 90, N, LOW_GUARD);
  assert.equal(events(b, "block").filter((h) => h.moveId === "convolution").length, 4, "crouch guard blocks all four");

  const s = makeMatch({ p1: [yann], p2: [dario] });
  place(s, -500, 500);
  s.sides[0].meter = 100;
  play(s, 0, [...qcf(), { buttons: BTN.BLOCK }]);
  until(s, () => mine(s, 0).length > 0, 40);
  assert.deepEqual(mine(s, 0).map((p) => p.def.level).sort(), ["low", "mid"]);
  const [lo, hi] = [...mine(s, 0)].sort((a, c) => c.y - a.y);
  assert.ok(lo.y - hi.y > 80, "second kernel at mid height");
});

test("Convolution LP is slow and HP is fast", () => {
  const speed = (bit) => {
    const m = makeMatch({ p1: [yann], p2: [dario] });
    place(m, -700, 700);
    play(m, 0, qcf(bit));
    until(m, () => mine(m, 0).length > 0, 40);
    return Math.abs(mine(m, 0)[0].vx);
  };
  assert.ok(speed(BTN.HP) > speed(BTN.LP) * 1.5);
});

test("RC Air Strike climbs then dives as an overhead; LP lands near, HP far; Scale Up loops back", () => {
  const landing = (bit, meter = 0) => {
    const m = makeMatch({ p1: [yann], p2: [dario] });
    place(m, -800, 800);
    m.sides[0].meter = meter;
    play(m, 0, meter ? [...qcb(bit), { buttons: BTN.BLOCK }] : qcb(bit));
    until(m, () => mine(m, 0).length > 0, 40);
    const p = mine(m, 0)[0];
    assert.equal(p.def.level, "overhead");
    const y0 = p.y;
    let top = p.y;
    let flips = 0;
    let vx = p.vx;
    let lastX = p.x;
    for (let i = 0; i < 200 && !p.dead; i += 1) {
      m.step([N, N]);
      top = Math.min(top, p.y);
      if (Math.sign(p.vx) !== Math.sign(vx)) flips += 1;
      vx = p.vx;
      lastX = p.x;
    }
    assert.ok(top < y0 - 150, "climbs first");
    return { dist: lastX - (-800), flips };
  };
  const near = landing(BTN.LP);
  const far = landing(BTN.HP);
  assert.ok(far.dist > near.dist + 150, `HP dives farther (${near.dist} vs ${far.dist})`);
  assert.equal(near.flips, 0);
  assert.equal(landing(BTN.LP, 100).flips, 1, "Scale Up plane loops back once");
});

test("The Cake: stepping in springs it (20 + cherry 20), slows and stops dashing; max one cake", () => {
  const m = makeMatch({ p1: [yann], p2: [sam] });
  place(m, -300, 200);
  play(m, 0, [...dnb(BTN.LK), { frames: 22 }]);
  const cakes = () => m.mech.objects.filter((o) => o.look === "cake");
  assert.equal(cakes().length, 1);
  const cake = cakes()[0];
  assert.ok(Math.abs(cake.x - (-300 + 150)) < 1);
  play(m, 0, [...dnb(BTN.LK), { frames: 40 }]);
  assert.equal(cakes().length, 1, "max one cake");
  const victim = m.point(1);
  until(m, () => events(m, "trap").length > 0, 200, N, { dir: 4 });
  assert.equal(events(m, "trap").length, 1);
  assert.equal(cakes().length, 0, "the cake is eaten");
  assert.ok(m.mech.status(victim, "slow"), "stuck in icing");
  assert.equal(victim.mods.noDash, false, "mods refresh next step");
  m.step([N, N]);
  assert.ok(victim.mods.noDash && victim.mods.speedMul < 0.5);
  hold(m, 40);
  const dmg = events(m, "hit").filter((h) => h.side === 0).map((h) => h.moveId);
  assert.ok(dmg.includes("cake_trap") && dmg.includes("cake_pop"), `icing and cherry both hit (${dmg})`);
  hold(m, 30);
  assert.equal(m.mech.status(victim, "slow"), null, "slow wears off");
});

test("The Cake expires after 5 s; Scale Up cherry homes", () => {
  const m = makeMatch({ p1: [yann], p2: [dario] });
  place(m, -600, 600);
  play(m, 0, dnb(BTN.LK));
  until(m, () => m.mech.objects.length > 0, 40);
  hold(m, 299);
  assert.equal(m.mech.objects.length, 1);
  hold(m, 2);
  assert.equal(m.mech.objects.length, 0);
  assert.ok(yann.moves.get("cake_analogy").scaled.mech.place.trigger.pop.home > 0);
});

test("World Model: anti-air hits on a jumping opponent deal +10%", () => {
  const run = (def) => {
    const m = makeMatch({ p1: [def], p2: [dario] });
    place(m, -40, 40);
    play(m, 1, [{ dir: 8, frames: 4 }]);
    play(m, 0, [{ dir: 2, buttons: BTN.HP }, { dir: 2, frames: 14 }]);
    return events(m, "hit").find((h) => h.side === 0);
  };
  const y = run(yann);
  const s = run(sam);
  assert.ok(y && s, "both launchers connect in the air");
  assert.equal(y.moveId, "c_hp");
  assert.equal(y.damage, 110, "Max Pool (100) deals 110 as an anti-air");
  assert.equal(s.damage, 100);
});

test("Optimal Brain Damage (B+HP) prunes an enemy projectile", () => {
  const m = makeMatch({ p1: [sam], p2: [yann] });
  place(m, -500, 0);
  play(m, 0, qcf());
  until(m, () => mine(m, 0).length > 0, 40);
  until(m, () => Math.abs(mine(m, 0)[0].x - m.point(1).x) < 275, 80);
  play(m, 1, [{ dir: 6, buttons: BTN.HP }, { dir: 6, frames: 24 }]);
  assert.equal(events(m, "prune").length, 1);
  assert.equal(mine(m, 0).length, 0);
  assert.equal(events(m, "hit").filter((h) => h.side === 0).length, 0, "Yann is not hit");
});

// ------------------------------------------------------------------ Liang

test("Aha Moment parries a strike: +25 Compute and +12 f advantage", () => {
  const m = makeMatch({ p1: [liang], p2: [sam] });
  place(m, -60, 60);
  play(m, 0, dnb());
  m.step([N, { dir: 5, buttons: BTN.LP }]);
  until(m, () => events(m, "parry").length > 0, 20);
  const parry = events(m, "parry")[0];
  assert.ok(parry, "parried");
  assert.equal(m.sides[0].meter, 25);
  assert.equal(events(m, "hit").length, 0);
  const l = m.point(0);
  const s = m.point(1);
  let free = 0;
  for (let i = 0; i < 40 && !s.isNeutral; i += 1) {
    m.step([N, N]);
    if (l.isNeutral) free += 1;
  }
  assert.ok(free >= 12, `Liang acts ${free} frames before Sam`);
});

test("Aha Moment also parries projectiles but loses to throws and whiffs safely", () => {
  const m = makeMatch({ p1: [sam], p2: [liang] });
  place(m, -400, 0);
  play(m, 0, qcf(BTN.HP));
  until(m, () => mine(m, 0).length && Math.abs(mine(m, 0)[0].x - m.point(1).x) < 160, 60);
  play(m, 1, [...mirror(dnb()), { frames: 10 }]);
  assert.equal(events(m, "parry").length, 1);
  assert.equal(events(m, "parry")[0].projectile, true);
  assert.equal(events(m, "hit").length, 0);
  assert.equal(m.sides[1].meter, 25);

  const t = makeMatch({ p1: [sam], p2: [liang] });
  place(t, -40, 40);
  play(t, 1, [{ dir: 2 }, { dir: 5 }, { dir: 6, buttons: BTN.LP }]);
  play(t, 0, [{ buttons: BTN.LP | BTN.LK }, { frames: 30 }]);
  assert.equal(events(t, "throw").length, 1, "throws beat the parry");
  assert.equal(events(t, "parry").length, 0);
});

test("Aha Moment Scale Up adds a 90-damage follow-up on success, for 75 Compute", () => {
  const m = makeMatch({ p1: [liang], p2: [sam] });
  place(m, -60, 60);
  m.sides[0].meter = 75;
  play(m, 0, [...dnb(), { buttons: BTN.BLOCK }]);
  assert.equal(events(m, "scaleUp").length, 1, "Cheap Training: Scale Up costs 75");
  assert.equal(m.sides[0].meter, 0);
  m.step([N, { dir: 5, buttons: BTN.LP }]);
  until(m, () => events(m, "hit").length > 0, 40);
  const hit = events(m, "hit")[0];
  assert.equal(hit.side, 0);
  assert.equal(hit.moveId, "aha_moment_followup");
  assert.equal(hit.damage, 90);
  assert.equal(m.sides[0].meter > 0, true, "the parry still paid out");
});

test("Cheap Training: other fighters still pay 100 for Scale Up", () => {
  const m = makeMatch({ p1: [sam], p2: [dario] });
  place(m, -500, 500);
  m.sides[0].meter = 75;
  play(m, 0, [...qcf(), { buttons: BTN.BLOCK }]);
  assert.equal(events(m, "scaleUp").length, 0);
});

test("Latent Attention: tiny fast pellet; HP pierces one projectile; Scale Up fires two", () => {
  assert.ok(liang.specials[1].projectile.hitbox.h <= 16, "low-profile pellet");
  const m = makeMatch({ p1: [liang], p2: [sam] });
  place(m, -400, 400);
  play(m, 1, mirror(qcf()));
  hold(m, 4);
  play(m, 0, qcf(BTN.HP));
  hold(m, 120);
  assert.ok(events(m, "hit").some((h) => h.moveId === "latent_attention"), "HP pellet went through the fireball");
  const l = makeMatch({ p1: [liang], p2: [sam] });
  place(l, -400, 400);
  play(l, 1, mirror(qcf()));
  hold(l, 4);
  play(l, 0, qcf(BTN.LP));
  hold(l, 120);
  assert.ok(!events(l, "hit").some((h) => h.moveId === "latent_attention"), "LP pellet trades with the fireball");

  const s = makeMatch({ p1: [liang], p2: [dario] });
  place(s, -700, 700);
  s.sides[0].meter = 100;
  play(s, 0, [...qcf(), { buttons: BTN.BLOCK }]);
  until(s, () => mine(s, 0).length > 0, 40);
  hold(s, 9);
  assert.equal(mine(s, 0).length, 2, "two pellets");
});

test("Group Relative Strike: high, mid and low shadows, then a reinforced strike on hit", () => {
  const levels = liang.specials[2].mech.hitLevels;
  assert.deepEqual(levels, ["high", "mid", "low"]);
  const m = makeMatch({ p1: [liang], p2: [dario] });
  place(m, -180, 0);
  play(m, 0, [...bf(), { frames: 50 }], GUARD);
  const blocks = events(m, "block").filter((b) => b.moveId === "group_relative");
  const hits = events(m, "hit").filter((h) => h.side === 0);
  assert.equal(blocks.length, 2, "standing guard stops the high and mid shadows");
  assert.equal(hits[0].moveId, "group_relative", "the low shadow lands");
  assert.ok(hits.some((h) => h.moveId === "group_relative_followup" && h.damage > 0), "reinforced fourth strike follows");

  const c = makeMatch({ p1: [liang], p2: [dario] });
  place(c, -180, 0);
  play(c, 0, [...bf(), { frames: 50 }], LOW_GUARD);
  assert.equal(events(c, "hit").filter((h) => h.side === 0).length, 0, "crouch guard: the high whiffs, mid and low are blocked");
  assert.ok(!special(c, "group_relative_followup").length);

  const s = makeMatch({ p1: [liang], p2: [dario] });
  s.sides[0].meter = 100;
  place(s, -180, 0);
  play(s, 0, [...bf(), { buttons: BTN.BLOCK }, { frames: 50 }], LOW_GUARD);
  assert.ok(events(s, "hit").some((h) => h.moveId === "group_relative"), "Scale Up overhead shadow beats a crouch guard");
});

test("Group Relative Strike: LK is short, HK is long", () => {
  const travel = (bit) => {
    const m = makeMatch({ p1: [liang], p2: [dario] });
    place(m, -800, 800);
    play(m, 0, [...bf(bit), { frames: 40 }]);
    return m.point(0).x + 800;
  };
  assert.ok(travel(BTN.HK) > travel(BTN.LK) + 40);
});

test("The Whale Breach costs 2 bars (Liang only) and erupts under the opponent", () => {
  const m = makeMatch({ p1: [liang], p2: [dario] });
  place(m, -500, 300);
  m.sides[0].meter = 200;
  play(m, 0, superInput);
  assert.equal(events(m, "super").length, 1);
  assert.equal(m.sides[0].meter, 0);
  hold(m, 80);
  const hits = events(m, "hit").filter((h) => h.moveId === "whale_breach");
  assert.ok(hits.length >= 3, "full-screen eruption under the opponent");

  const s = makeMatch({ p1: [sam], p2: [dario] });
  place(s, -100, 100);
  s.sides[0].meter = 200;
  play(s, 0, superInput);
  assert.equal(events(s, "super").length, 0, "everyone else still needs 3 bars");
});

// ------------------------------------------------------------------ Mustafa

test("Containment Field: no dash or run inside, 40% slower walk, 30 to leave", () => {
  const m = makeMatch({ p1: [mustafa], p2: [sam] });
  place(m, -250, -60);
  play(m, 0, [...dnb(), { frames: 20 }]);
  const field = m.mech.objects.find((o) => o.look === "containment");
  assert.ok(field && Math.abs(field.x - (-250 + 170)) < 1, "LP field lands near");
  const s = m.point(1);
  m.step([N, N]);
  assert.equal(s.mods.noDash, true);
  assert.ok(Math.abs(s.mods.speedMul - 0.6) < 1e-9);
  play(m, 1, [{ dir: 6 }, { dir: 5 }, { dir: 6 }, { dir: 6, frames: 6 }]);
  assert.equal(s.state, "walk_back", "cannot back dash out; walks instead");
  const x0 = s.x;
  m.step([N, { dir: 6 }]);
  assert.ok(Math.abs(Math.abs(s.x - x0) - 168 * 0.6 / 60) < 0.2, "walks at 60% speed");
  until(m, () => events(m, "hit").length > 0, 160, N, { dir: 6 });
  const zap = events(m, "hit")[0];
  assert.equal(zap.moveId, "containment_exit");
  assert.equal(zap.damage, 30);
  until(m, () => !m.mech.objects.length, 260);
  assert.ok(m.mech.objects.length === 0, "field fades after 4 s");
});

test("Containment Field: HP lands far; Scale Up edges stop projectiles", () => {
  const m = makeMatch({ p1: [mustafa], p2: [sam] });
  place(m, -500, 500);
  play(m, 0, [...dnb(BTN.HP), { frames: 20 }]);
  assert.ok(Math.abs(m.mech.objects[0].x - (-500 + 330)) < 1);
  const s = makeMatch({ p1: [mustafa], p2: [sam] });
  place(s, -600, 400);
  s.sides[0].meter = 100;
  play(s, 0, [...dnb(), { buttons: BTN.BLOCK }, { frames: 20 }]);
  play(s, 1, mirror(qcf()));
  hold(s, 120);
  assert.equal(events(s, "hit").length, 0, "the fireball never reaches Mustafa");
});

test("The Coming Wave grows with distance (45 close, ~80 full screen) and must be blocked low", () => {
  const dmgAt = (x1) => {
    const m = makeMatch({ p1: [mustafa], p2: [dario] });
    place(m, -800, x1);
    play(m, 0, qcf(BTN.LK));
    until(m, () => events(m, "hit").length > 0 || events(m, "block").length > 0, 300);
    return events(m, "hit")[0]?.damage;
  };
  const close = dmgAt(-640);
  const far = dmgAt(200);
  assert.ok(close >= 45 && close <= 52, `close ${close}`);
  assert.ok(far >= 75 && far <= 80, `far ${far}`);
  const b = makeMatch({ p1: [mustafa], p2: [dario] });
  place(b, -400, 0);
  play(b, 0, qcf(BTN.LK), GUARD);
  hold(b, 90, N, GUARD);
  assert.ok(events(b, "hit").some((h) => h.moveId === "coming_wave"), "standing guard loses");
});

test("The Coming Wave Scale Up sends a second wave 30 f later", () => {
  const m = makeMatch({ p1: [mustafa], p2: [dario] });
  place(m, -800, 800);
  m.sides[0].meter = 100;
  play(m, 0, [...qcf(BTN.LK), { buttons: BTN.BLOCK }]);
  until(m, () => mine(m, 0).length > 0, 40);
  const f0 = m.frame;
  until(m, () => mine(m, 0).length === 2, 60);
  assert.equal(m.frame - f0, 30);
});

test("Copilot: the orb floats ahead and strikes 40 f after launch, or at once when recast", () => {
  const m = makeMatch({ p1: [mustafa], p2: [dario] });
  place(m, -300, -100);
  play(m, 0, qcb());
  until(m, () => m.mech.objects.some((o) => o.type === "companion"), 20);
  const orb = m.mech.objects.find((o) => o.type === "companion");
  const t0 = m.frame;
  until(m, () => events(m, "companionStrike").length > 0, 60);
  assert.equal(m.frame - t0, 40, "strikes 40 f later");
  assert.ok(Math.abs(orb.x - (-300 + 180)) < 2, "LP orb floats near");
  assert.ok(events(m, "hit").some((h) => h.moveId === "copilot_strike" && h.damage === 50));

  const r = makeMatch({ p1: [mustafa], p2: [dario] });
  place(r, -600, 600);
  play(r, 0, [...qcb(BTN.HP), { frames: 30 }]);
  const t1 = r.frame;
  play(r, 0, qcb());
  until(r, () => events(r, "companionStrike").length > 0, 60);
  assert.ok(r.frame - t1 < 15, "recasting triggers the strike");
  assert.equal(r.mech.objects.filter((o) => o.type === "companion").length, 1, "no second orb");

  const s = makeMatch({ p1: [mustafa], p2: [dario] });
  place(s, -600, 600);
  s.sides[0].meter = 100;
  play(s, 0, [...qcb(), { buttons: BTN.BLOCK }]);
  hold(s, 90);
  assert.equal(events(s, "companionStrike").length, 2, "Scale Up strikes twice");
});

test("Copilot easter egg: LP x12 during the intro turns the orb into a paperclip", () => {
  const log = [];
  const m = new Match({ sides: [{ team: [mustafa] }, { team: [dario] }], emit: (n, p) => log.push({ n, p }) });
  m.start();
  for (let i = 0; i < 12; i += 1) {
    m.step([{ dir: 5, buttons: BTN.LP }, N]);
    m.step([N, N]);
  }
  assert.equal(m.phase, "intro");
  assert.ok(log.some((e) => e.n === "easterEgg" && e.p.id === "paperclip"));
  assert.deepEqual(m.snapshot().mechanics.skins, ["paperclip", null]);
});

test("Copilot passive auto-techs the first throw each round only", () => {
  const m = makeMatch({ p1: [sam], p2: [mustafa] });
  place(m, -40, 40);
  play(m, 0, [{ buttons: BTN.LP | BTN.LK }, { frames: 40 }]);
  assert.equal(events(m, "tech").length, 1, "first throw teched automatically");
  hold(m, 30);
  place(m, -40, 40);
  play(m, 0, [{ buttons: BTN.LP | BTN.LK }, { frames: 40 }]);
  assert.equal(events(m, "tech").length, 1, "second throw lands");
  assert.ok(events(m, "hit").some((h) => h.kind === "throw"));
});

test("Copilot passive: Mustafa's 2v2 assist cooldown is 20% shorter", () => {
  const cooldown = (team) => {
    const m = makeMatch({ mode: "2v2", p1: team, p2: [dario, sam] });
    place(m, -300, 300);
    play(m, 0, [{ buttons: BTN.TAG }, { frames: 2 }]);
    until(m, () => !m.sides[0].assist && events(m, "assist").length > 0, 300);
    return m.sides[0].assistCooldown;
  };
  const base = cooldown([sam, dario]) + 1;
  const mus = cooldown([sam, mustafa]) + 1;
  assert.equal(base, RULES.assistCooldown);
  assert.equal(mus, Math.round(RULES.assistCooldown * 0.8));
});

test("Modern Turing Test: 8-hit Breakthrough", () => {
  const m = makeMatch({ p1: [mustafa], p2: [dario] });
  place(m, -100, 60);
  m.sides[0].meter = 300;
  play(m, 0, [...superInput, { frames: 160 }]);
  assert.equal(events(m, "hit").filter((h) => h.moveId === "modern_turing_test").length, 8);
});

// ------------------------------------------------------------------ 2v2 assists and CPU

for (const def of [andrej, yann, liang, mustafa]) {
  test(`${def.id}: both 2v2 assists come out and leave`, () => {
    for (const which of ["a", "b"]) {
      const m = makeMatch({ mode: "2v2", p1: [sam, def], p2: [dario, sam] });
      place(m, -200, 200);
      play(m, 0, [{ dir: which === "b" ? 4 : 5, buttons: BTN.TAG }, { frames: 2 }]);
      const ev = events(m, "assist")[0];
      assert.equal(ev.moveId, def.assists[which]);
      until(m, () => m.allFighters.some((f) => f.assistMode && f.state === "attack" && f.move?.id === def.assists[which]), 60);
      until(m, () => !m.sides[0].assist, 400);
      assert.equal(m.sides[0].assist, null, "assist went home");
    }
  });
}

for (const def of [andrej, yann, liang, mustafa]) {
  test(`${def.id}: CPU uses its kit and plays a clean match against every Group C fighter`, () => {
    const used = new Set();
    for (const [i, opp] of [andrej, yann, liang, mustafa].entries()) {
      for (const mode of ["1v1", "2v2"]) {
        const m = new Match({
          mode,
          skipIntro: true,
          sides: [
            { team: mode === "2v2" ? [def, opp] : [def], control: "cpu", cpu: createCpu("hard", 3 + i) },
            { team: mode === "2v2" ? [opp, def] : [opp], control: "cpu", cpu: createCpu("hard", 11 + i) },
          ],
          emit: (n, p) => {
            if ((n === "special" || n === "super") && p.side === 0) used.add(p.moveId);
          },
        });
        m.start();
        for (let f = 0; f < 60 * 50 && m.phase !== "matchEnd"; f += 1) m.step([null, null]);
        for (const f of m.allFighters) assert.ok(Number.isFinite(f.x) && Number.isFinite(f.health));
      }
    }
    for (const sp of def.specials) assert.ok(used.has(sp.id), `${def.id} CPU used ${sp.id} (used: ${[...used]})`);
  });
}
