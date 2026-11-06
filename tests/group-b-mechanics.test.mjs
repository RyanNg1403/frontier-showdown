import test from "node:test";
import assert from "node:assert/strict";
import { BTN, N, events, hold, makeMatch, place, play, sam, until } from "./helpers.mjs";
import { arthur, demis, ilya, jensen, probe, special, stepsUntil } from "./group-b-helpers.mjs";
import { RULES } from "../src/combat/constants.js";
import { stonesOf as trapsOf } from "../src/combat/mechanics/group-b/stones.js";
import { echoOf } from "../src/combat/mechanics/group-b/echo.js";
import { turretsOf } from "../src/combat/mechanics/group-b/turret.js";

const GUARD = { dir: 5, buttons: BTN.BLOCK };
const LOW_GUARD = { dir: 2, buttons: BTN.BLOCK };
const hitsOf = (m, moveId) => events(m, "hit").filter((h) => h.moveId === moveId);

// ---------------------------------------------------------------- placed traps (Move 37)

test("traps: Move 37 lands a stone on frame 20 that bursts when the opponent walks onto it", () => {
  const m = makeMatch({ p1: [demis], p2: [sam] });
  place(m, -300, 200);
  const d = m.point(0);
  special(m, 0, "QCB+P", BTN.LP);
  assert.equal(d.move.id, "move_37");
  assert.equal(1 + stepsUntil(m, () => trapsOf(m, d).length > 0, 40), 20);
  assert.equal(trapsOf(m, d)[0].x, -300 + 120, "LP stone lands near");
  until(m, () => hitsOf(m, "move_37").length > 0, 400, N, { dir: 4 });
  const hit = hitsOf(m, "move_37")[0];
  assert.ok(hit, "stepping on the stone bursts it");
  assert.equal(hit.damage, 60);
  assert.equal(trapsOf(m, d).length, 0);
});

test("traps: HP places far, max two stones, a third removes the oldest, stones expire", () => {
  const m = makeMatch({ p1: [demis], p2: [sam] });
  place(m, -500, 600);
  const d = m.point(0);
  special(m, 0, "QCB+P", BTN.HP);
  hold(m, 45);
  assert.equal(trapsOf(m, d)[0].x, -500 + 260, "HP stone lands far");
  special(m, 0, "QCB+P", BTN.LP);
  hold(m, 45);
  const [first, second] = trapsOf(m, d);
  special(m, 0, "QCB+P", BTN.HP);
  hold(m, 45);
  const now = trapsOf(m, d);
  assert.equal(now.length, 2);
  assert.ok(!now.includes(first) && now.includes(second), "oldest stone removed");
  hold(m, 300);
  assert.equal(trapsOf(m, d).length, 0, "stones expire after 300 frames");
});

test("traps: D,N,B+P remotely detonates every stone near the opponent", () => {
  const m = makeMatch({ p1: [demis], p2: [sam] });
  place(m, -300, 300);
  const d = m.point(0);
  special(m, 0, "QCB+P", BTN.LP);
  hold(m, 45);
  const stone = trapsOf(m, d)[0];
  m.point(1).x = stone.x + 60;
  special(m, 0, "D,N,B+P", BTN.LP);
  hold(m, 2);
  assert.equal(events(m, "trapDetonate").length, 1);
  assert.equal(hitsOf(m, "move_37")[0].damage, 60);
  assert.notEqual(d.move?.id, "lp", "the detonation press does not also jab");
  assert.equal(trapsOf(m, d).length, 0);
});

test("traps: Scale Up makes the stone invisible; an assist drops it under the opponent", () => {
  const m = makeMatch({ p1: [demis], p2: [sam] });
  place(m, -300, 300);
  m.sides[0].meter = 100;
  special(m, 0, "QCB+P", BTN.LP);
  play(m, 0, [{ buttons: BTN.BLOCK }, { frames: 30 }]);
  assert.equal(trapsOf(m, m.point(0))[0].invisible, true);

  const t = makeMatch({ mode: "2v2", p1: [sam, demis], p2: [jensen, sam] });
  place(t, -300, 250);
  play(t, 0, [{ buttons: BTN.ASSIST }, { frames: 60 }]);
  const stone = t.mech.objects.find((o) => o.type === "stone");
  assert.ok(stone, "assist A places a stone");
  assert.ok(Math.abs(stone.x - 250) < 40, "under the opponent");
});

// ---------------------------------------------------------------- puppet / delayed echo (Self-Play)

test("echo: Self-Play HK appears behind the opponent and repeats normals 20 frames later at 70%", () => {
  const m = makeMatch({ p1: [demis], p2: [sam] });
  place(m, -200, 100);
  const d = m.point(0);
  special(m, 0, "D,B+K", BTN.HK);
  assert.equal(1 + stepsUntil(m, () => echoOf(m, d), 40), 14, "echo appears on the startup frame");
  const e = echoOf(m, d);
  assert.equal(e.body.x, 100 + 80);
  assert.equal(e.body.facing, -1);
  hold(m, 20);
  play(m, 0, [{ buttons: BTN.LP, frames: 1 }]);
  const pressed = m.frame;
  until(m, () => hitsOf(m, "lp").length > 0, 60);
  const hit = m.log.find((x) => x.name === "hit" && x.payload.moveId === "lp");
  assert.equal(hit.frame - pressed, 20 + demis.normals.lp.startup - 1);
  assert.equal(hit.payload.damage, Math.round(demis.normals.lp.damage * 0.7));
});

test("echo: LK places it beside Demis; destroying it stuns him for 30 frames; it expires", () => {
  const m = makeMatch({ p1: [demis], p2: [sam] });
  place(m, -200, 100);
  const d = m.point(0);
  special(m, 0, "D,B+K", BTN.LK);
  hold(m, 30);
  const e = echoOf(m, d);
  assert.equal(e.body.x, -200 - 70);
  e.body.x = 30;
  e.hp = 40;
  play(m, 1, [{ buttons: BTN.HP, frames: 1 }, { frames: 14 }]);
  assert.equal(echoOf(m, d), null, "echo destroyed");
  assert.equal(events(m, "echoBroken").length, 1);
  assert.equal(d.state, "hitstun");
  const stunned = stepsUntil(m, () => d.state !== "hitstun", 60);
  assert.ok(stunned >= 18 && stunned <= 30, `stunned ${stunned}`);

  const m2 = makeMatch({ p1: [demis], p2: [sam] });
  place(m2, -200, 600);
  special(m2, 0, "D,B+K", BTN.LK);
  hold(m2, 20);
  assert.ok(echoOf(m2, m2.point(0)));
  hold(m2, 360);
  assert.equal(echoOf(m2, m2.point(0)), null, "expires after 360 frames");
});

// ---------------------------------------------------------------- turret with HP (AI Factory)

test("turret: AI Factory deploys on frame 24 and fires a token every 60 frames", () => {
  const m = makeMatch({ p1: [jensen], p2: [sam] });
  place(m, -400, 300);
  const j = m.point(0);
  special(m, 0, "D,B+K", BTN.LK);
  assert.equal(1 + stepsUntil(m, () => turretsOf(m, j).length > 0, 40), 24);
  const t = turretsOf(m, j)[0];
  assert.equal(t.x, -400 + 80);
  const seen = new Set();
  const fired = [];
  for (let i = 0; i < 300; i += 1) {
    m.step([N, N]);
    for (const p of m.projectiles) {
      if (String(p.ownerUid).startsWith("turret:") && !seen.has(p.id)) {
        seen.add(p.id);
        fired.push(i + 1);
      }
    }
  }
  assert.deepEqual(fired, [30, 90, 150, 210, 270]);
  assert.equal(hitsOf(m, "ai_factory")[0].damage, 25);
  assert.equal(turretsOf(m, j).length, 0, "gone after its 300-frame lifetime");
});

test("turret: 150 HP, destroyed by strikes; tokens don't lock out Jensen's projectile; Scale Up fires two", () => {
  const m = makeMatch({ p1: [jensen], p2: [sam] });
  place(m, -400, 100);
  const j = m.point(0);
  special(m, 0, "D,B+K", BTN.LK);
  hold(m, 60);
  const t = turretsOf(m, j)[0];
  assert.equal(t.hp, 150);
  t.x = 40;
  t.timer = 999;
  m.projectiles = [];
  play(m, 1, [{ buttons: BTN.HP, frames: 1 }, { frames: 14 }]);
  assert.equal(t.hp, 150 - sam.normals.hp.damage);
  for (let i = 0; i < 2; i += 1) {
    until(m, () => m.point(1).isNeutral, 60);
    play(m, 1, [{ buttons: BTN.HP, frames: 1 }, { frames: 14 }]);
  }
  assert.equal(turretsOf(m, j).length, 0);
  assert.equal(events(m, "turretDestroyed").length, 1);

  const m2 = makeMatch({ p1: [jensen], p2: [sam] });
  place(m2, -400, 800);
  m2.sides[0].meter = 100;
  special(m2, 0, "D,B+K", BTN.LK);
  play(m2, 0, [{ buttons: BTN.BLOCK }, { frames: 60 }]);
  assert.equal(turretsOf(m2, m2.point(0))[0].shots, 2);
  assert.equal(m2.projectiles.filter((p) => String(p.ownerUid).startsWith("turret:")).length, 2);
  special(m2, 0, "QCB+P", BTN.HP);
  hold(m2, 24);
  assert.ok(m2.projectiles.some((p) => p.moveId === "been_cooking"), "Jensen can still throw his own projectile");
});

// ---------------------------------------------------------------- single-instance projectile (Peak Data)

test("single-instance projectile: repeating Peak Data detonates the live orb instead of firing another", () => {
  const m = makeMatch({ p1: [ilya], p2: [sam] });
  place(m, -400, 400);
  special(m, 0, "QCF+P", BTN.LP);
  assert.equal(1 + stepsUntil(m, () => m.projectiles.length > 0, 30), ilya.specials[0].startup);
  const orb = m.projectiles[0];
  m.point(1).x = orb.x + 118;
  special(m, 0, "QCF+P", BTN.LP);
  hold(m, 3);
  assert.equal(events(m, "detonate").length, 1);
  assert.equal(hitsOf(m, "peak_data")[0].damage, 40);
  hold(m, 30);
  assert.equal(m.projectiles.filter((p) => p.moveId === "peak_data").length, 0, "no second orb");
});

test("single-instance projectile: Scale Up Pre-training Ends erases opposing projectiles and keeps going", () => {
  const m = makeMatch({ p1: [ilya], p2: [sam] });
  place(m, -500, 500);
  m.sides[0].meter = 100;
  special(m, 1, "QCF+P", BTN.LP);
  special(m, 0, "QCF+P", BTN.LP);
  play(m, 0, [{ buttons: BTN.BLOCK }, { frames: 85 }]);
  const orb = m.projectiles.find((p) => p.moveId === "peak_data");
  assert.ok(orb, "orb survives the clash");
  assert.ok(!m.projectiles.some((p) => p.moveId === "prompt_burst"), "Sam's fireball erased");
});

// ---------------------------------------------------------------- teleport strike (Straight Shot)

test("teleport strike: hidden and invulnerable on frames 6-10, LP lands in front, HP crosses up", () => {
  const m = makeMatch({ p1: [ilya], p2: [sam] });
  place(m, -200, 100);
  const i = m.point(0);
  special(m, 0, "B,F+P", BTN.LP);
  const hidden = [];
  for (let f = 2; f <= 12; f += 1) {
    m.step([N, N]);
    if (i.hidden) hidden.push(i.moveFrame);
    if (i.hidden) assert.ok(i.invulnTo("strike") && i.invulnTo("projectile"));
  }
  assert.deepEqual(hidden, [6, 7, 8, 9, 10]);
  assert.equal(i.x, 100 - 80);
  hold(m, 6);
  assert.equal(hitsOf(m, "straight_shot")[0].damage, 80);

  const m2 = makeMatch({ p1: [ilya], p2: [sam] });
  place(m2, -200, 100);
  special(m2, 0, "B,F+P", BTN.HP);
  hold(m2, 11);
  assert.equal(m2.point(0).x, 100 + 80, "HP passes behind");
  assert.equal(m2.point(0).facing, -1);
});

test("teleport strike: with a bar, Straight Shot works in the air as its Scale Up version", () => {
  const m = makeMatch({ p1: [ilya], p2: [sam] });
  place(m, -250, 100);
  m.sides[0].meter = 100;
  play(m, 0, [{ dir: 8, frames: 2 }, { frames: 8 }]);
  const i = m.point(0);
  assert.equal(i.state, "jump");
  special(m, 0, "B,F+P", BTN.HP);
  assert.equal(i.state, "attack");
  assert.ok(i.move.isScaled && i.move.id === "straight_shot");
  assert.equal(m.sides[0].meter, 0);
  assert.equal(events(m, "scaleUp")[0].air, true);
  hold(m, 14);
  assert.ok(hitsOf(m, "straight_shot").length, "lands level with the opponent and strikes");
  const m2 = makeMatch({ p1: [ilya], p2: [sam] });
  place(m2, -250, 100);
  play(m2, 0, [{ dir: 8, frames: 2 }, { frames: 8 }]);
  special(m2, 0, "B,F+P", BTN.HP);
  assert.notEqual(m2.point(0).move?.id, "straight_shot", "no bar, no air Straight Shot");
});

// ---------------------------------------------------------------- prescient counter (What Did Ilya See?)

test("prescient counter: a low strike into What Did Ilya See? is countered from behind", () => {
  const m = makeMatch({ p1: [ilya], p2: [sam] });
  place(m, -60, 60);
  special(m, 0, "D,B+K", BTN.LK);
  assert.equal(m.point(0).move.id, "ilya_saw");
  play(m, 1, [{ dir: 2, buttons: BTN.LK, frames: 1 }, { dir: 2, frames: 30 }]);
  assert.equal(events(m, "parry").length, 1, "lows are read too");
  const hit = hitsOf(m, "parry_counter")[0];
  assert.ok(hit, "counter strike lands");
  assert.equal(hit.damage, 90);
  assert.ok(m.point(0).x > m.point(1).x, "Ilya reappears behind the attacker");
});

test("prescient counter: shows a vision over the opponent; throws beat it", () => {
  const m = makeMatch({ p1: [ilya], p2: [sam] });
  place(m, -300, 300);
  special(m, 1, "QCF+P", BTN.LP);
  hold(m, 50);
  special(m, 0, "D,B+K", BTN.LK);
  hold(m, 2);
  const vision = m.snapshot().mechanics.visions[0];
  assert.ok(vision, "vision listed in game.state.mechanics");
  assert.equal(vision.fighter, "sam");
  assert.equal(vision.text, "Prompt Burst", "predicts the opponent's last special");

  const t = makeMatch({ p1: [ilya], p2: [sam] });
  place(t, -40, 40);
  special(t, 0, "D,B+K", BTN.LK);
  play(t, 1, [{ buttons: BTN.LP | BTN.LK, frames: 2 }, { frames: 30 }]);
  assert.equal(events(t, "throw").length, 1);
  assert.equal(events(t, "parry").length, 0);
});

// ---------------------------------------------------------------- push and slow (Mistral Gust)

test("push and slow: Mistral Gust pushes about 150 px and slows walking by 30% for 90 frames", () => {
  const m = makeMatch({ p1: [arthur], p2: [sam] });
  place(m, -400, 0);
  const s = m.point(1);
  special(m, 0, "QCB+K", BTN.LK);
  until(m, () => hitsOf(m, "mistral_gust").length > 0, 60);
  const hitAt = s.x;
  assert.equal(m.mech.status(s, "slow").speedMul, 0.7);
  until(m, () => s.state === "idle", 60);
  assert.ok(s.x - hitAt >= 120 && s.x - hitAt <= 220, `pushed ${s.x - hitAt}`);
  const x0 = s.x;
  hold(m, 30, N, { dir: 6 });
  const walked = s.x - x0;
  assert.ok(Math.abs(walked - sam.stats.backWalkSpeed * 0.7 * 0.5) < 6, `walked ${walked}`);
  hold(m, 60, N, N);
  assert.equal(s.mods.speedMul, 1, "slow wears off");
  assert.equal(m.mech.status(s, "slow"), null);
});

test("push and slow: the gust also slows on block; Scale Up blows airborne opponents back", () => {
  const m = makeMatch({ p1: [arthur], p2: [sam] });
  place(m, -400, 0);
  hold(m, 4, N, GUARD);
  special(m, 0, "QCB+K", BTN.HK, GUARD);
  until(m, () => events(m, "block").length > 0, 80, N, GUARD);
  assert.ok(m.mech.status(m.point(1), "slow"), "slowed through block");

  const a = makeMatch({ p1: [arthur], p2: [sam] });
  place(a, -400, 0);
  a.sides[0].meter = 100;
  special(a, 0, "QCB+K", BTN.LK);
  play(a, 0, [{ buttons: BTN.BLOCK }]);
  a.step([N, { dir: 7 }]);
  until(a, () => hitsOf(a, "mistral_gust").length > 0, 80, N, { dir: 7 });
  const s = a.point(1);
  assert.ok(s.vx > 0, "airborne opponent blown away from Arthur");
});

// ---------------------------------------------------------------- pull (Magnet Link)

test("pull: Magnet Link LP drags the opponent about 200 px toward Arthur", () => {
  const m = makeMatch({ p1: [arthur], p2: [sam] });
  place(m, -300, 0);
  special(m, 0, "QCF+P", BTN.LP);
  until(m, () => hitsOf(m, "magnet_link").length > 0, 30);
  hold(m, 30);
  const s = m.point(1);
  assert.ok(s.x < -150, `pulled to ${s.x}`);
  assert.ok(s.x - m.point(0).x >= 60, "never pulled through Arthur");
});

test("pull: Magnet Link HP reels Arthur in for a free LP; Scale Up drops an overhead magnet", () => {
  const m = makeMatch({ p1: [arthur], p2: [sam] });
  place(m, -300, 0);
  const a = m.point(0);
  special(m, 0, "QCF+P", BTN.HP);
  until(m, () => hitsOf(m, "magnet_link").length > 0, 30);
  until(m, () => a.state !== "attack", 60);
  assert.ok(Math.abs(m.point(1).x - a.x) <= 100, "Arthur zipped in");
  play(m, 0, [{ buttons: BTN.LP, frames: 1 }, { frames: 8 }]);
  const jab = hitsOf(m, "lp")[0];
  assert.ok(jab && jab.combo >= 2, "LP follow-up combos");

  const d = makeMatch({ p1: [arthur], p2: [sam] });
  place(d, -300, 100);
  d.sides[0].meter = 100;
  hold(d, 4, N, LOW_GUARD);
  special(d, 0, "QCF+P", BTN.LP, LOW_GUARD);
  play(d, 0, [{ buttons: BTN.BLOCK }], LOW_GUARD);
  hold(d, 14, N, LOW_GUARD);
  const magnet = d.projectiles.find((p) => p.moveId === "magnet_link");
  assert.ok(magnet && Math.abs(magnet.x - d.point(1).x) < 1 && magnet.y < -200, "falls from above the opponent");
  until(d, () => hitsOf(d, "magnet_link").length > 0, 60, N, LOW_GUARD);
  assert.equal(hitsOf(d, "magnet_link")[0].level, "overhead", "beats a crouch block");
});

// ---------------------------------------------------------------- air-only special (Le Chonk Drop)

test("air-only special: D+HK is a sweep on the ground and Le Chonk Drop in the air", () => {
  const m = makeMatch({ p1: [arthur], p2: [sam] });
  place(m, -300, 300);
  const a = m.point(0);
  play(m, 0, [{ dir: 2, buttons: BTN.HK, frames: 1 }]);
  assert.equal(a.move.id, "c_hk");
  hold(m, 50);
  play(m, 0, [{ dir: 8, frames: 2 }, { frames: 8 }]);
  play(m, 0, [{ dir: 2, buttons: BTN.HK, frames: 1 }]);
  assert.equal(a.move.id, "le_chonk");
  assert.ok(a.hasArmor());
  const before = a.health;
  m.applyContact(m.point(1), a, probe("test", { damage: 60, kind: "heavy", category: "normal" }), { x: a.x, y: a.y - 100 }, { dir: -1 });
  assert.equal(events(m, "hit").at(-1).armor, true, "one hit of armor");
  assert.equal(a.state, "attack");
  assert.ok(a.health < before);
  until(m, () => a.state === "jump_land", 60);
  assert.equal(a.landingRecovery, 22);
});

test("air-only special: Scale Up Le Chonk Drop sends a low shockwave on landing", () => {
  const m = makeMatch({ p1: [arthur], p2: [sam] });
  place(m, -100, 60);
  m.sides[0].meter = 100;
  play(m, 0, [{ dir: 8, frames: 2 }, { frames: 10 }]);
  play(m, 0, [{ dir: 2, buttons: BTN.HK, frames: 1 }, { buttons: BTN.BLOCK, frames: 1 }]);
  assert.ok(m.point(0).move.isScaled);
  until(m, () => hitsOf(m, "le_chonk_shockwave").length > 0, 60);
  const wave = hitsOf(m, "le_chonk_shockwave")[0];
  assert.ok(wave, "shockwave hit");
  assert.equal(wave.level, "low");
});

// ---------------------------------------------------------------- command grab, wall bounce, throws

test("command grab: Hand-Delivered DGX is unblockable and untechable; HP reaches farther", () => {
  const m = makeMatch({ p1: [jensen], p2: [sam] });
  place(m, -40, 40);
  hold(m, 4, N, GUARD);
  special(m, 0, "HCB,F+P", BTN.LP, GUARD);
  assert.equal(m.point(0).move.id, "dgx_delivery");
  play(m, 1, [{ buttons: BTN.LP | BTN.LK, frames: 2 }, { frames: 40 }]);
  assert.equal(events(m, "throw").length, 1);
  assert.equal(events(m, "tech").length, 0);
  assert.equal(hitsOf(m, "dgx_delivery")[0].damage, 170);

  const far = makeMatch({ p1: [jensen], p2: [sam] });
  place(far, -50, 52);
  special(far, 0, "HCB,F+P", BTN.LP);
  hold(far, 20);
  assert.equal(events(far, "throw").length, 0, "LP whiffs at 100 px");
  const hp = makeMatch({ p1: [jensen], p2: [sam] });
  place(hp, -50, 52);
  special(hp, 0, "HCB,F+P", BTN.HP);
  hold(hp, 20);
  assert.equal(events(hp, "throw").length, 1, "HP reaches 110 px");
});

test("command grab: Scale Up adds 40 damage and a wall bounce", () => {
  const m = makeMatch({ p1: [jensen], p2: [sam] });
  place(m, 740, 820);
  m.sides[0].meter = 100;
  special(m, 0, "HCB,F+P", BTN.LP);
  play(m, 0, [{ buttons: BTN.BLOCK }, { frames: 20 }]);
  assert.equal(hitsOf(m, "dgx_delivery")[0].damage, 210);
  const s = m.point(1);
  until(m, () => s.vx < 0 || s.state !== "juggle", 80);
  assert.ok(s.vx < 0, "bounced off the right wall");
});

test("Seq2Seq throw swaps sides", () => {
  const m = makeMatch({ p1: [ilya], p2: [sam] });
  place(m, -40, 40);
  play(m, 0, [{ buttons: BTN.LP | BTN.LK, frames: 2 }, { frames: 40 }]);
  assert.equal(events(m, "throw").length, 1);
  assert.ok(m.point(1).x < m.point(0).x, "victim ends up on the other side");
});

// ---------------------------------------------------------------- bind (AlphaFold)

test("bind: AlphaFold holds the opponent in place for 30 frames; Scale Up pulls them 120 px", () => {
  const m = makeMatch({ p1: [demis], p2: [sam] });
  place(m, -300, 50);
  special(m, 0, "QCF+P", BTN.LP);
  until(m, () => hitsOf(m, "alphafold").length > 0, 60);
  const s = m.point(1);
  const x0 = s.x;
  assert.ok(m.mech.status(s, "bind").frames >= 29);
  hold(m, 20);
  assert.ok(Math.abs(s.x - x0) < 2, "bound in place");

  const p = makeMatch({ p1: [demis], p2: [sam] });
  place(p, -300, 50);
  p.sides[0].meter = 100;
  special(p, 0, "QCF+P", BTN.LP);
  play(p, 0, [{ buttons: BTN.BLOCK }]);
  until(p, () => hitsOf(p, "alphafold").length > 0, 60);
  const y0 = p.point(1).x;
  hold(p, 20);
  assert.ok(y0 - p.point(1).x >= 100, `pulled ${y0 - p.point(1).x}`);
});

// ---------------------------------------------------------------- lab passives

test("NVIDIA passive: +3% damage per stored bar", () => {
  const m = makeMatch({ p1: [jensen], p2: [sam] });
  place(m, -50, 50);
  m.sides[0].meter = 300;
  play(m, 0, [{ buttons: BTN.LP, frames: 1 }, { frames: 10 }]);
  assert.equal(hitsOf(m, "lp")[0].damage, Math.round(26 * 1.09));
});

test("SSI passive: combo scaling starts one hit later", () => {
  const run = (attacker) => {
    const m = makeMatch({ p1: [attacker], p2: [sam] });
    place(m, -50, 50);
    for (let i = 0; i < 4; i += 1) m.applyContact(m.point(0), m.point(1), probe("lp", { damage: 50, kind: "light", hitstun: 40 }), { x: 0, y: -120 }, { dir: 1 });
    return events(m, "hit").map((h) => h.damage);
  };
  assert.deepEqual(run(ilya), [50, 50, 50, 45]);
  assert.deepEqual(run(sam), [50, 50, 45, 40]);
});

test("Mistral passive: Runway regenerates 25% faster", () => {
  const m = makeMatch({ p1: [arthur], p2: [sam] });
  place(m, -300, 300);
  for (const s of m.sides) s.runway = 100;
  hold(m, 60);
  assert.ok(Math.abs(m.sides[0].runway - (100 + 30 * 1.25)) < 1);
  assert.ok(Math.abs(m.sides[1].runway - 130) < 1);
});

test("Google DeepMind passive: after blocking the same special twice, the next hit deals +15%", () => {
  const m = makeMatch({ p1: [demis], p2: [sam] });
  place(m, -300, 300);
  const d = m.point(0);
  for (let i = 0; i < 2; i += 1) {
    special(m, 1, "QCF+P", BTN.LP, GUARD);
    until(m, () => events(m, "block").length > i && m.point(1).isNeutral, 120, GUARD, N);
    hold(m, 10, GUARD, N);
  }
  assert.equal(d.passive.selfPlayArmed, true);
  until(m, () => d.isNeutral, 60);
  place(m, -50, 50);
  play(m, 0, [{ buttons: BTN.LP, frames: 1 }, { frames: 10 }]);
  assert.equal(hitsOf(m, "lp")[0].damage, Math.round(22 * 1.15));
  assert.equal(d.passive.selfPlayArmed, false, "once per round");
});

test("SSI passive: Ilya's assist cooldown is one second longer in 2v2", () => {
  const cooldown = (partner) => {
    const m = makeMatch({ mode: "2v2", p1: [sam, partner], p2: [jensen, sam] });
    place(m, -300, 300);
    play(m, 0, [{ buttons: BTN.ASSIST }]);
    until(m, () => !m.sides[0].assist, 200);
    return m.sides[0].assistCooldown;
  };
  assert.equal(cooldown(ilya) - cooldown(demis), 60);
});

test("mechanic objects are cleared between rounds and exposed in the snapshot", () => {
  const m = makeMatch({ p1: [jensen], p2: [demis] });
  place(m, -400, 300);
  special(m, 0, "D,B+K", BTN.LK);
  special(m, 1, "QCB+P", BTN.LP);
  hold(m, 40);
  const types = m.snapshot().mechanics.objects.map((o) => o.type).sort();
  assert.deepEqual(types, ["stone", "turret"]);
  m.point(1).health = 0;
  until(m, () => m.round === 2, 600);
  assert.deepEqual(m.snapshot().mechanics.objects, []);
  assert.equal(RULES.scaleUpCost, 100);
});
