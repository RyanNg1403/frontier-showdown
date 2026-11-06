import test from "node:test";
import assert from "node:assert/strict";
import { BTN, N, events, hold, makeMatch, place, play, tap, until } from "./helpers.mjs";

test("round timer counts down at 60 frames per second and time-up goes to the healthier side", () => {
  const m = makeMatch({ timer: 3 });
  assert.equal(m.timer, 3);
  hold(m, 60);
  assert.equal(m.timer, 2);
  m.point(0).health = 400;
  hold(m, 125);
  assert.equal(events(m, "timeUp").length, 1);
  const end = events(m, "roundEnd")[0];
  assert.equal(end.winner, 1);
  assert.equal(end.reason, "time");
  assert.deepEqual(end.wins, [0, 1]);
});

test("best of three: the match ends after two round wins", () => {
  const m = makeMatch({ timer: 1 });
  for (let r = 0; r < 2; r += 1) {
    m.point(0).health = 100;
    until(m, () => m.phase === "roundEnd", 200);
    until(m, () => m.phase !== "roundEnd", 300);
  }
  assert.equal(m.phase, "matchEnd");
  assert.equal(m.winner, 1);
  assert.deepEqual(events(m, "roundStart").map((e) => e.round), [1, 2]);
  assert.equal(events(m, "matchEnd")[0].winner, 1);
});

test("a KO in a non-deciding round plays the KO, awards the round and starts the next", () => {
  const m = makeMatch();
  place(m, -40, 40);
  m.point(1).health = 10;
  tap(m, 0, BTN.LP);
  hold(m, 6);
  assert.equal(events(m, "ko").length, 1);
  assert.equal(m.phase, "ko");
  until(m, () => m.phase === "roundEnd", 300);
  assert.equal(events(m, "roundEnd")[0].reason, "ko");
  until(m, () => m.round === 2, 400);
  assert.equal(m.round, 2);
  assert.deepEqual(m.sides.map((s) => s.wins), [1, 0]);
  assert.equal(m.point(1).health, m.point(1).maxHealth, "health resets each round");
});

test("deciding round: finish prompt, dazed loser, then the winner's finisher", () => {
  const m = makeMatch();
  m.sides[0].wins = 1;
  place(m, -40, 40);
  m.point(1).health = 10;
  tap(m, 0, BTN.LP);
  hold(m, 6);
  assert.equal(m.phase, "finish");
  assert.equal(events(m, "finish")[0].side, 0);
  const loser = m.point(1);
  until(m, () => loser.state === "dazed", 120);
  assert.equal(loser.state, "dazed");
  place(m, -60, 60);
  hold(m, 2);
  play(m, 0, [{ dir: 6, frames: 3 }, { dir: 2, frames: 3 }, { dir: 6, frames: 2 }, { dir: 6, buttons: BTN.HP }, { frames: 2 }]);
  assert.equal(m.phase, "finisher");
  assert.ok(events(m, "announce").some((a) => a.text === "FINAL COMMIT!"));
  const fin = events(m, "finisher")[0];
  assert.equal(fin.id, "gentle_singularity");
  assert.equal(fin.victim, "dario");
  until(m, () => m.phase === "matchEnd", 600);
  assert.equal(events(m, "roundEnd")[0].reason, "finisher");
  assert.equal(m.winner, 0);
});

test("finish phase times out into a normal KO, and hitting the dazed loser also ends it", () => {
  const m = makeMatch();
  m.sides[0].wins = 1;
  place(m, -40, 40);
  m.point(1).health = 10;
  tap(m, 0, BTN.LP);
  until(m, () => m.phase === "roundEnd", 800);
  assert.equal(events(m, "roundEnd")[0].reason, "ko");

  const m2 = makeMatch();
  m2.sides[1].wins = 1;
  place(m2, -40, 40);
  m2.point(0).health = 10;
  tap(m2, 1, BTN.LP);
  until(m2, () => m2.point(0).state === "dazed", 120);
  place(m2, -40, 40);
  tap(m2, 1, BTN.HP);
  hold(m2, 14);
  assert.equal(m2.point(0).state, "ko");
  until(m2, () => m2.phase === "matchEnd", 600);
  assert.equal(m2.winner, 1);
});

test("a double KO is a draw that awards nobody", () => {
  const m = makeMatch();
  place(m, -40, 40);
  m.point(0).health = 5;
  m.point(1).health = 5;
  const lp = { dir: 5, buttons: BTN.LP };
  m.step([N, lp]);
  m.step([lp, N]);
  for (let i = 0; i < 5; i += 1) m.step([N, N]);
  assert.equal(events(m, "ko").length, 2);
  until(m, () => m.phase === "roundEnd", 300);
  const end = events(m, "roundEnd")[0];
  assert.equal(end.winner, null);
  assert.equal(end.reason, "draw");
  assert.deepEqual(m.sides.map((s) => s.wins), [0, 0]);
});

test("intro plays ROUND and FIGHT before control is given", () => {
  const m = makeMatch({ skipIntro: false });
  assert.equal(m.phase, "intro");
  assert.equal(m.point(0).state, "intro");
  hold(m, 30, { dir: 6, buttons: 0 });
  assert.equal(m.point(0).x, -230, "no movement during the intro");
  until(m, () => m.phase === "fight", 400);
  assert.equal(events(m, "fight").length, 1);
  assert.ok(events(m, "announce").some((a) => a.text === "FIGHT!"));
});

test("snapshot exposes the contract fields", () => {
  const m = makeMatch();
  const s = m.snapshot();
  for (const k of ["phase", "mode", "frame", "round", "roundsToWin", "timer", "timerFrames", "sides", "fighters", "winner"]) {
    assert.ok(k in s, k);
  }
  const side = s.sides[0];
  for (const k of ["side", "control", "wins", "meter", "meterMax", "bars", "breakerUsed", "tagCooldown", "assistCooldown", "combo", "active", "members"]) {
    assert.ok(k in side, k);
  }
  assert.deepEqual(Object.keys(side.members[0]).sort(), ["aslLevel", "health", "id", "ko", "maxHealth", "name", "onField", "red"]);
  for (const k of ["runway", "runwayMax", "lastCheckpoint", "lastStanding"]) assert.ok(k in side, k);
  assert.ok(Array.isArray(s.barriers));
  assert.equal(s.fighters.length, 2);
});
