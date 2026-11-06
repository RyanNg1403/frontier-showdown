import test from "node:test";
import assert from "node:assert/strict";
import { BTN, N, dario, events, hold, makeMatch, place, play, sam, tap, until } from "./helpers.mjs";
import { RULES } from "../src/combat/constants.js";

const GUARD = { dir: 5, buttons: BTN.BLOCK };
const LOW_GUARD = { dir: 2, buttons: BTN.BLOCK };
const dp = (bit = BTN.LP) => [{ dir: 6 }, { dir: 2 }, { dir: 3, buttons: bit }];
const qcf = (bit = BTN.LP) => [{ dir: 2 }, { dir: 3 }, { dir: 6, buttons: bit }];
const qcb = (bit = BTN.LK) => [{ dir: 2 }, { dir: 1 }, { dir: 4, buttons: bit }];

test("Scale Up: BLK early in a special spends a bar and amplifies it", () => {
  const m = makeMatch();
  place(m, -50, 50);
  m.sides[0].meter = 150;
  play(m, 0, [...dp(), { buttons: BTN.BLOCK }, { frames: 30 }]);
  assert.equal(events(m, "scaleUp").length, 1);
  assert.equal(m.sides[0].meter >= 50 && m.sides[0].meter < 150, true);
  const hits = events(m, "hit").filter((h) => h.moveId === "event_horizon");
  assert.equal(hits.length, 2, "scaled Event Horizon hits twice");
  assert.equal(hits[0].damage, 65);
});

test("Scale Up needs a bar and the first 8 frames", () => {
  const m = makeMatch();
  place(m, -400, 400);
  play(m, 0, [...qcf(), { buttons: BTN.BLOCK }, { frames: 10 }]);
  assert.equal(events(m, "scaleUp").length, 0, "no meter");
  const m2 = makeMatch();
  place(m2, -400, 400);
  m2.sides[0].meter = 300;
  play(m2, 0, [...qcf(), { frames: 9 }, { buttons: BTN.BLOCK }, { frames: 10 }]);
  assert.equal(events(m2, "scaleUp").length, 0, "too late");
});

test("Alignment Block: tapping BLK just before the hit removes chip and builds meter", () => {
  const m = makeMatch();
  place(m, -60, 60);
  m.step([{ dir: 6 }, N]);
  m.step([{ dir: 2 }, N]);
  m.step([{ dir: 3, buttons: BTN.LP }, N]);
  for (let i = 0; i < 20 && !events(m, "block").length; i += 1) {
    const sam = m.point(0);
    const late = sam.state === "attack" && sam.moveFrame >= sam.move.startup - 2;
    m.step([N, late ? GUARD : N]);
  }
  const block = events(m, "block")[0];
  assert.ok(block, "blocked");
  assert.equal(block.aligned, true);
  assert.equal(block.chip, 0);
  assert.equal(m.point(1).health, 1050);
  assert.ok(m.sides[1].meter >= RULES.alignmentMeter);
});

test("Anthropic passive cuts chip damage by 30%", () => {
  const m = makeMatch({ p1: [sam], p2: [dario] });
  place(m, -60, 60);
  hold(m, 8, N, GUARD);
  play(m, 0, [...dp(), { frames: 30 }], GUARD);
  const block = events(m, "block")[0];
  assert.equal(block.chip, Math.round(10 * 0.7));
  const m2 = makeMatch({ p1: [sam], p2: [sam] });
  place(m2, -60, 60);
  hold(m2, 8, N, GUARD);
  play(m2, 0, [...dp(), { frames: 30 }], GUARD);
  assert.equal(events(m2, "block")[0].chip, 10);
});

test("normal chip cannot KO, super chip can", () => {
  const m = makeMatch();
  place(m, -60, 60);
  m.point(1).health = 3;
  hold(m, 8, N, GUARD);
  play(m, 0, [...dp(), { frames: 40 }], GUARD);
  assert.equal(m.point(1).health, 1);
  assert.equal(events(m, "ko").length, 0);
});

test("punish counters add damage and hitstun on recovering opponents", () => {
  const m = makeMatch();
  place(m, -300, 60);
  m.step([N, { dir: 5, buttons: BTN.HK }]);
  const d = m.point(1);
  until(m, () => d.state === "attack" && d.isRecovering, 30);
  m.point(0).x = d.x - 80;
  play(m, 0, [{ buttons: BTN.LP }, { frames: 8 }]);
  const hit = events(m, "hit")[0];
  assert.ok(hit.punish);
  assert.equal(hit.damage, Math.round(24 * RULES.punishBonus));
});

test("counter hits on startup add 20%", () => {
  const m = makeMatch();
  place(m, -40, 40);
  m.step([N, { dir: 5, buttons: BTN.HK }]);
  play(m, 0, [{ buttons: BTN.LP }, { frames: 7 }]);
  const hit = events(m, "hit")[0];
  assert.ok(hit.counter);
  assert.equal(hit.damage, Math.round(24 * RULES.counterBonus));
});

test("Guardrail pushblock spends Runway and pushes the attacker away", () => {
  const m = makeMatch();
  place(m, -60, 60);
  hold(m, 6, N, GUARD);
  m.step([{ dir: 5, buttons: BTN.HK }, GUARD]);
  until(m, () => m.point(1).state === "blockstun", 30, N, GUARD);
  hold(m, 12, N, GUARD);
  const x0 = m.point(0).x;
  m.step([N, { dir: 5, buttons: BTN.BLOCK | BTN.HP | BTN.HK }]);
  hold(m, 10);
  assert.equal(events(m, "guardrail").length, 1);
  assert.ok(m.sides[1].runway < RULES.runwayMax);
  assert.ok(m.point(0).x < x0 - 30, "attacker pushed back");
});

test("Runway drains while running and ends the run when empty", () => {
  const m = makeMatch();
  place(m, -800, 800);
  m.sides[0].runway = 20;
  play(m, 0, [{ dir: 6 }, { dir: 5, frames: 2 }, { dir: 6 }]);
  hold(m, 20, { dir: 6, buttons: 0 });
  const runFrames = until(m, () => m.point(0).state !== "run", 120, { dir: 6, buttons: 0 });
  assert.ok(runFrames < 60);
  assert.ok(m.sides[0].runway <= 0.01);
  const before = m.sides[0].runway;
  hold(m, RULES.runwayDelay + 60);
  assert.ok(m.sides[0].runway > before, "regenerates after the delay");
});

test("Last Checkpoint: one free super below 30% health per match", () => {
  const m = makeMatch();
  place(m, -60, 60);
  m.point(0).health = 250;
  const motion = [{ dir: 2 }, { dir: 3 }, { dir: 6 }, { dir: 2 }, { dir: 3 }, { dir: 6, buttons: BTN.HP }];
  play(m, 0, motion);
  assert.equal(events(m, "super").length, 1);
  assert.equal(events(m, "lastCheckpoint").length, 1);
  assert.ok(m.sides[0].lastCheckpointUsed);
  hold(m, 160);
  play(m, 0, motion);
  assert.equal(events(m, "super").length, 1, "only once");
});

test("Constitutional Barrier absorbs one projectile", () => {
  const m = makeMatch();
  place(m, -400, 300);
  play(m, 1, [{ dir: 2 }, { dir: 5 }, { dir: 6, buttons: BTN.LP }, { frames: 20 }]);
  assert.equal(m.barriers.length, 1);
  play(m, 0, [...qcf(BTN.HP), { frames: 120 }]);
  assert.equal(events(m, "hit").length, 0, "the fireball never reaches Dario");
  assert.equal(m.barriers.length, 0, "barrier shattered");
});

test("Constitutional Barrier soaks two strikes, then breaks", () => {
  const m = makeMatch();
  place(m, -200, 60);
  play(m, 1, [{ dir: 2 }, { dir: 5 }, { dir: 6, buttons: BTN.LP }, { frames: 22 }]);
  const w = m.barriers[0];
  assert.ok(w);
  m.point(0).x = w.x - 70;
  for (let i = 0; i < 2; i += 1) {
    play(m, 0, [{ buttons: BTN.LP }, { frames: 22 }]);
  }
  assert.equal(events(m, "hit").length, 0);
  assert.equal(m.barriers.length, 0);
});

test("HP Country of Geniuses fires three arcing geniuses", () => {
  const m = makeMatch({ p1: [dario], p2: [sam] });
  place(m, -400, 400);
  play(m, 0, qcf(BTN.HP));
  until(m, () => m.projectiles.length > 0, 30);
  assert.equal(m.projectiles.length, 3);
  assert.ok(m.projectiles.every((p) => p.vy < 0));
  hold(m, 90);
  assert.equal(m.projectiles.length, 0, "they land and fizzle");
});

test("ASL Safeguard counters a high attack and raises the ASL level", () => {
  const m = makeMatch();
  place(m, -60, 60);
  play(m, 1, [{ dir: 2 }, { dir: 3 }, { dir: 6, buttons: BTN.LP }]);
  play(m, 0, [{ buttons: BTN.HP }, { frames: 40 }]);
  assert.equal(events(m, "parry").length, 1);
  assert.equal(m.point(1).aslLevel, 1);
  const counter = events(m, "hit").find((h) => h.moveId === "parry_counter");
  assert.ok(counter, "Safeguard Palm lands");
  assert.equal(counter.attacker, "dario");
  assert.equal(counter.damage, Math.round(110 * 1.1));
});

test("ASL Safeguard loses to lows", () => {
  const m = makeMatch();
  place(m, -60, 60);
  play(m, 1, [{ dir: 2 }, { dir: 3 }, { dir: 6, buttons: BTN.LP }]);
  play(m, 0, [{ dir: 2, buttons: BTN.LK }, { dir: 2, frames: 14 }]);
  assert.equal(events(m, "parry").length, 0);
  assert.equal(events(m, "hit")[0].attacker, "sam");
});

test("HK Stargate Rush reappears behind the opponent", () => {
  const m = makeMatch();
  place(m, -250, 100);
  play(m, 0, qcb(BTN.HK));
  until(m, () => m.point(0).moveFrame >= 13, 20);
  assert.ok(m.point(0).x > m.point(1).x, "crossed up");
  assert.equal(m.point(0).facing, -1);
  const m2 = makeMatch();
  place(m2, -250, 100);
  play(m2, 0, qcb(BTN.LK));
  until(m2, () => m2.point(0).moveFrame >= 13, 20);
  assert.ok(m2.point(0).x < m2.point(1).x, "LK lands in front");
});

test("air recovery after the juggle limit", () => {
  const m = makeMatch();
  place(m, -40, 40);
  play(m, 0, [{ dir: 2, buttons: BTN.HP }]);
  until(m, () => events(m, "hit").length > 0, 20, { dir: 2, buttons: 0 });
  const d = m.point(1);
  d.juggleLocked = true;
  until(m, () => d.vy > 0, 60);
  m.step([N, { dir: 5, buttons: BTN.LK }]);
  assert.equal(d.state, "jump");
  assert.equal(events(m, "airRecovery").length, 1);
  until(m, () => d.isNeutral, 80);
  assert.ok(d.isNeutral, "lands on their feet");
});

test("wake-up: hold down to delay, F/B to roll, BLK+P getup attack", () => {
  const knockdown = () => {
    const m = makeMatch();
    place(m, -40, 40);
    play(m, 0, [{ dir: 2, buttons: BTN.HK }]);
    until(m, () => m.point(1).state === "knockdown", 80, { dir: 2, buttons: 0 });
    return m;
  };
  const m = knockdown();
  const lying = until(m, () => m.point(1).state !== "knockdown", 120, N, { dir: 2, buttons: 0 });
  assert.equal(lying, RULES.knockdownFrames + RULES.delayedWakeup);

  const m2 = knockdown();
  until(m2, () => m2.point(1).state !== "knockdown", 120, N, { dir: 6, buttons: 0 });
  assert.equal(m2.point(1).state, "roll");
  assert.ok(m2.sides[1].runway < RULES.runwayMax);
  assert.ok(m2.point(1).invulnTo("strike"));

  const m3 = knockdown();
  m3.sides[1].meter = 100;
  until(m3, () => m3.point(1).stateFrame >= RULES.knockdownFrames - 4, 120);
  play(m3, 1, [{ buttons: BTN.BLOCK | BTN.LP }, { buttons: BTN.BLOCK, frames: 5 }]);
  assert.equal(m3.point(1).move?.id, "getup_attack");
  assert.equal(m3.sides[1].meter, 0);
});

test("OpenAI passive: each different special that hits adds 4% damage", () => {
  const m = makeMatch();
  place(m, -60, 60);
  const sam = m.point(0);
  play(m, 0, [...qcf(BTN.HP), { frames: 40 }]);
  assert.equal(sam.passiveDef.damageMul(sam), 1.04);
  hold(m, 60);
  play(m, 0, [...dp(), { frames: 60 }]);
  assert.equal(sam.passiveDef.damageMul(sam), 1.08);
  until(m, () => m.point(1).isNeutral, 120);
  m.point(0).x = m.point(1).x - 60;
  play(m, 1, [{ dir: 2, buttons: BTN.HK }, { dir: 2, frames: 2 }]);
  until(m, () => sam.state === "knockdown", 80);
  assert.equal(sam.passiveDef.damageMul(sam), 1, "stacks reset on knockdown");
});

test("2v2 red health is lost when hit again before it heals", () => {
  const m = makeMatch({ mode: "2v2", p1: [sam, dario], p2: [dario, sam] });
  place(m, -40, 40);
  tap(m, 1, BTN.HP);
  hold(m, 40);
  const s = m.sides[0].members[0];
  const red1 = s.red;
  assert.ok(red1 > 0);
  until(m, () => m.point(1).isNeutral && s.isNeutral, 120);
  place(m, -40, 40);
  tap(m, 1, BTN.LP);
  hold(m, 20);
  assert.ok(Math.abs(s.red - Math.round(24 * RULES.redRatio * 100) / 100) < 1, `red ${s.red}`);
});

test("command normal: forward+HP is Sam's Ship It overhead", () => {
  const m = makeMatch();
  place(m, -60, 60);
  play(m, 0, [{ dir: 6, buttons: BTN.HP }, { frames: 30 }], LOW_GUARD);
  const hit = events(m, "hit")[0];
  assert.equal(hit.moveId, "f_hp");
  assert.equal(hit.level, "overhead");
});

test("juggles add gravity per hit", () => {
  const m = makeMatch();
  const d = m.point(1);
  d.setState("juggle");
  d.y = -200;
  d.vy = 0;
  d.juggleHits = 0;
  hold(m, 1);
  const v0 = d.vy;
  d.y = -200;
  d.vy = 0;
  d.juggleHits = 5;
  hold(m, 1);
  assert.ok(d.vy > v0 * 1.25);
});
