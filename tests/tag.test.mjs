import test from "node:test";
import assert from "node:assert/strict";
import { BTN, N, dario, events, hold, makeMatch, place, sam, tap, until } from "./helpers.mjs";
import { RULES } from "../src/combat/constants.js";

const tagMatch = (opts = {}) => makeMatch({ mode: "2v2", p1: [sam, dario], p2: [dario, sam], ...opts });

test("2v2 starts with one fighter per side on screen", () => {
  const m = tagMatch();
  assert.equal(m.fighters.length, 2);
  assert.equal(m.sides[0].members[1].onField, false);
  assert.equal(m.sides[0].members[1].state, "bench");
});

test("tag swaps the point fighter and starts a cooldown", () => {
  const m = tagMatch();
  tap(m, 0, BTN.TAG);
  const tag = events(m, "tag")[0];
  assert.deepEqual({ out: tag.out, in: tag.in, forced: tag.forced }, { out: "sam", in: "dario", forced: false });
  assert.equal(m.sides[0].active, 1);
  assert.equal(m.sides[0].tagCooldown > 0, true);
  until(m, () => m.point(0).isNeutral, 60);
  assert.equal(m.point(0).id, "dario");
  until(m, () => !m.sides[0].members[0].onField, 60);
  assert.equal(m.sides[0].members[0].state, "bench");
  tap(m, 0, BTN.TAG);
  assert.equal(events(m, "tag").length, 1, "cooldown blocks an immediate re-tag");
});

test("red health regenerates while benched", () => {
  const m = tagMatch();
  place(m, -40, 40);
  tap(m, 1, BTN.HP);
  const samF = m.sides[0].members[0];
  until(m, () => events(m, "hit").length > 0 && samF.isNeutral, 90);
  assert.ok(samF.red > 0, "part of the damage is recoverable");
  const healthAfterHit = samF.health;
  const red = samF.red;
  tap(m, 0, BTN.TAG);
  hold(m, 120);
  assert.equal(samF.onField, false);
  assert.ok(samF.health > healthAfterHit, "benched fighter recovers");
  assert.ok(samF.health <= healthAfterHit + red + 0.001, "but only the red part");
});

test("assist calls the partner in for one move, then sends them back", () => {
  const m = tagMatch();
  place(m, -300, 300);
  tap(m, 0, BTN.ASSIST);
  assert.equal(events(m, "assist").length, 1);
  const partner = m.sides[0].members[1];
  assert.ok(partner.onField && partner.assistMode);
  assert.equal(m.fighters.length, 3);
  until(m, () => events(m, "special").length > 0, 60);
  assert.equal(events(m, "special")[0].fighter, "dario");
  until(m, () => !partner.onField, 200);
  assert.equal(partner.assistMode, false);
  assert.equal(m.sides[0].active, 0, "point fighter unchanged");
  assert.ok(m.sides[0].assistCooldown > 0);
});

test("hitting an assist damages the partner but cannot KO them", () => {
  const m = tagMatch();
  place(m, -300, 300);
  const partner = m.sides[0].members[1];
  partner.health = 5;
  tap(m, 0, BTN.ASSIST);
  until(m, () => partner.state === "attack", 60);
  partner.x = m.point(1).x - 60;
  m.point(1).facing = -1;
  tap(m, 1, BTN.LP);
  hold(m, 6);
  assert.ok(partner.health >= 1);
  assert.equal(partner.ko, false);
});

test("when a point fighter is KO'd the partner tags in automatically", () => {
  const m = tagMatch();
  place(m, -40, 40);
  m.point(1).health = 10;
  tap(m, 0, BTN.LP);
  hold(m, 4);
  assert.equal(events(m, "ko").length, 1);
  assert.equal(m.phase, "fight", "the round continues");
  until(m, () => events(m, "tag").length > 0, 120);
  const tag = events(m, "tag")[0];
  assert.equal(tag.forced, true);
  assert.equal(tag.in, "sam");
  until(m, () => m.point(1).isNeutral, 60);
  hold(m, 10);
  m.point(1).health = 10;
  place(m, -40, 40);
  tap(m, 0, BTN.LP);
  hold(m, 4);
  assert.equal(m.phase, "ko", "second KO ends the round");
  until(m, () => m.phase === "roundEnd", 300);
  assert.equal(events(m, "roundEnd")[0].winner, 0);
});

test("time-up in 2v2 compares team health share", () => {
  const m = tagMatch({ timer: 1 });
  m.sides[1].members[1].health = 300;
  hold(m, 70);
  assert.equal(events(m, "roundEnd")[0].winner, 0);
});

test("tag cancel costs a bar when tagging out of a connected attack", () => {
  const m = tagMatch();
  place(m, -40, 40);
  m.sides[0].meter = 150;
  m.step([{ dir: 5, buttons: BTN.HP }, N]);
  until(m, () => m.point(0).connected, 20);
  hold(m, 9);
  m.step([{ dir: 5, buttons: BTN.TAG }, N]);
  assert.equal(events(m, "tag").length, 1);
  assert.ok(m.sides[0].meter <= 150 - RULES.tagCancelCost + 20);
});
