import test from "node:test";
import assert from "node:assert/strict";
import { BTN, N, back, downBack, events, fwd, hold, makeMatch, place, play, tap, until } from "./helpers.mjs";
import { RULES } from "../src/combat/constants.js";

test("a standing light punch hits an idle opponent for its listed damage", () => {
  const m = makeMatch();
  place(m, -40, 40);
  tap(m, 0, BTN.LP);
  hold(m, 4);
  const hits = events(m, "hit");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].damage, 30);
  assert.equal(hits[0].moveId, "lp");
  assert.equal(m.point(1).health, 1050 - 30);
  assert.equal(m.point(1).state, "hitstun");
});

test("startup counts the press frame: LP (startup 4) connects on its 4th frame", () => {
  const m = makeMatch();
  place(m, -40, 40);
  m.step([{ dir: 5, buttons: BTN.LP }, N]);
  hold(m, 2);
  assert.equal(events(m, "hit").length, 0);
  hold(m, 1);
  assert.equal(events(m, "hit").length, 1);
});

test("high attacks whiff over a crouching opponent", () => {
  const m = makeMatch();
  place(m, -40, 40);
  hold(m, 2, N, { dir: 2, buttons: 0 });
  play(m, 0, [{ buttons: BTN.LP }, { frames: 14 }], { dir: 2, buttons: 0 });
  assert.equal(events(m, "hit").length, 0);
  assert.equal(m.point(1).health, 1050);
});

test("holding back blocks mids, normals do no chip, specials do", () => {
  const m = makeMatch();
  place(m, -60, 60);
  const guard = { dir: back(-1), buttons: 0 };
  play(m, 0, [{ buttons: BTN.HK }, { frames: 20 }], guard);
  assert.equal(events(m, "block").length, 1);
  assert.equal(events(m, "hit").length, 0);
  assert.equal(m.point(1).health, 1050);

  const m2 = makeMatch();
  place(m2, -60, 60);
  play(m2, 0, [{ dir: 2 }, { dir: 1 }, { dir: 4, buttons: BTN.LK }, { frames: 40 }], guard);
  const blocks = events(m2, "block");
  assert.ok(blocks.length >= 1, "scaling rush is blocked");
  assert.ok(m2.point(1).health < 1050, "special chip lands");
});

test("lows beat standing guard and lose to crouching guard", () => {
  const m = makeMatch();
  place(m, -60, 60);
  play(m, 0, [{ dir: 2, buttons: BTN.LK }, { dir: 2, frames: 14 }], { dir: back(-1), buttons: 0 });
  assert.equal(events(m, "hit").length, 1, "low hits a standing blocker");
  assert.equal(events(m, "hit")[0].level, "low");

  const m2 = makeMatch();
  place(m2, -60, 60);
  play(m2, 0, [{ dir: 2, buttons: BTN.LK }, { dir: 2, frames: 14 }], { dir: downBack(-1), buttons: 0 });
  assert.equal(events(m2, "block").length, 1, "crouch guard blocks the low");
});

test("jumping attacks are overheads and beat crouching guard", () => {
  const m = makeMatch();
  place(m, -240, 60);
  const crouchGuard = { dir: downBack(-1), buttons: 0 };
  play(m, 0, [{ dir: 9, frames: 5 }], crouchGuard);
  const sam = m.point(0);
  until(m, () => sam.vy > 0 && sam.y > -150, 80, N, crouchGuard);
  play(m, 0, [{ buttons: BTN.HK }, { frames: 30 }], crouchGuard);
  const hit = events(m, "hit")[0];
  assert.ok(hit, "jump-in connects");
  assert.equal(hit.level, "overhead");
  assert.equal(events(m, "block").length, 0);
});

test("chains and special cancels scale damage after the second hit", () => {
  const m = makeMatch();
  place(m, -40, 40);
  const plan = [
    [5, BTN.LP],
    [5, BTN.LP],
    [5, BTN.HP],
  ];
  let sent = 0;
  for (let f = 0; f < 200 && sent <= plan.length; f += 1) {
    const hits = events(m, "hit").length;
    if (sent < plan.length && hits === sent) {
      const [dir, buttons] = plan[sent];
      m.step([{ dir, buttons }, N]);
      m.step([N, N]);
      sent += 1;
      until(m, () => events(m, "hit").length >= sent, 30);
      continue;
    }
    if (sent === plan.length) {
      play(m, 0, [{ dir: 2 }, { dir: 3 }, { dir: 6, buttons: BTN.LP }, { frames: 40 }]);
      sent += 1;
    }
  }
  const hits = events(m, "hit");
  assert.deepEqual(hits.map((h) => h.combo), [1, 2, 3, 4]);
  assert.deepEqual(hits.map((h) => h.damage), [30, 30, 63, 56]);
  assert.equal(hits[3].moveId, "model_drop");
});

test("throws connect after the tech window and deal throw damage", () => {
  const m = makeMatch();
  place(m, -40, 40);
  tap(m, 0, BTN.LP | BTN.LK);
  hold(m, 30);
  assert.equal(events(m, "throw").length, 1);
  const hit = events(m, "hit").find((h) => h.kind === "throw");
  assert.ok(hit);
  assert.equal(hit.damage, 120);
  assert.equal(m.point(1).health, 1050 - 120);
});

test("throw tech: pressing throw while grabbed escapes without damage", () => {
  const m = makeMatch();
  place(m, -40, 40);
  m.step([{ dir: 5, buttons: BTN.LP | BTN.LK }, N]);
  hold(m, 5);
  assert.equal(m.point(1).state, "thrown");
  m.step([N, { dir: 5, buttons: BTN.LP | BTN.LK }]);
  hold(m, 20);
  assert.equal(events(m, "tech").length, 1);
  assert.equal(m.point(1).health, 1050);
});

test("command grabs cannot be teched", () => {
  const m = makeMatch();
  place(m, -40, 40);
  play(m, 1, [{ dir: 2 }, { dir: 3 }, { dir: 6, buttons: BTN.LP }]);
  until(m, () => m.point(0).state === "thrown", 20);
  assert.equal(m.point(0).state, "thrown");
  for (let i = 0; i < 20; i += 1) m.step([{ dir: 5, buttons: i % 2 ? BTN.LP | BTN.LK : 0 }, N]);
  hold(m, 20);
  assert.equal(events(m, "tech").length, 0);
  const hit = events(m, "hit").find((h) => h.moveId === "interpretability_probe");
  assert.ok(hit);
  assert.equal(hit.damage, 150);
});

test("launchers juggle, then the defender is knocked down and invulnerable until getup ends", () => {
  const m = makeMatch();
  place(m, -40, 40);
  play(m, 0, [{ dir: 2, buttons: BTN.HP }]);
  until(m, () => events(m, "hit").length > 0, 20, { dir: 2, buttons: 0 });
  const d = m.point(1);
  assert.equal(events(m, "hit")[0].moveId, "c_hp");
  assert.equal(d.state, "juggle");
  until(m, () => d.state === "knockdown", 120);
  assert.equal(d.state, "knockdown");
  assert.ok(d.invulnTo("strike"));
  until(m, () => d.state === "getup", 120);
  assert.ok(d.invulnTo("strike"));
  until(m, () => d.isNeutral, 60);
  assert.equal(d.invulnTo("strike"), false);
  assert.ok(d.throwInvuln > 0, "brief throw protection after waking up");
});

test("juggle limit makes the defender untouchable until they land", () => {
  const m = makeMatch();
  place(m, -40, 40);
  play(m, 0, [{ dir: 2, buttons: BTN.HP }, { dir: 2, frames: 2 }]);
  const d = m.point(1);
  d.juggleCount = RULES.maxJuggle;
  play(m, 0, [{ dir: 6 }, { dir: 2 }, { dir: 3, buttons: BTN.LP }, { frames: 4 }]);
  until(m, () => events(m, "hit").length >= 2, 30);
  assert.equal(events(m, "hit")[1].moveId, "launch_day");
  assert.ok(d.juggleLocked);
  assert.ok(d.invulnTo("strike"));
  until(m, () => d.state === "knockdown", 120);
  assert.equal(d.juggleLocked, false);
});

test("combo breaker costs a bar, works once per round and knocks the attacker away", () => {
  const m = makeMatch();
  place(m, -40, 40);
  m.sides[1].meter = 300;
  m.step([{ dir: 5, buttons: BTN.LP }, N]);
  until(m, () => events(m, "hit").length >= 1, 20);
  m.step([{ dir: 5, buttons: BTN.LP }, N]);
  until(m, () => events(m, "hit").length >= 2, 30);
  const breakIn = { dir: fwd(-1), buttons: BTN.BLOCK };
  const before = m.sides[1].meter;
  for (let i = 0; i < 20 && !events(m, "breaker").length; i += 1) m.step([N, i % 2 ? breakIn : N]);
  assert.equal(events(m, "breaker").length, 1);
  assert.equal(m.sides[1].meter, before - RULES.breakerCost);
  assert.ok(m.sides[1].breakerUsed);
  assert.equal(m.point(0).state === "hitstun" || m.point(0).state === "juggle", true);
  assert.ok(m.point(1).invulnFrames > 0 || m.point(1).state === "breaker");
});

test("supers spend meter, freeze the screen and land multiple scaled hits", () => {
  const m = makeMatch();
  place(m, -60, 60);
  m.sides[0].meter = 300;
  play(m, 0, [{ dir: 2 }, { dir: 3 }, { dir: 6 }, { dir: 2 }, { dir: 3 }, { dir: 6, buttons: BTN.LP }]);
  assert.equal(events(m, "super").length, 1);
  assert.equal(m.sides[0].meter, 100);
  assert.ok(m.freezeFrames > 0);
  hold(m, 140);
  const hits = events(m, "hit").filter((h) => h.moveId === "agi_keynote");
  assert.ok(hits.length >= 5, `expected multi-hit super, got ${hits.length}`);
  assert.equal(hits[0].damage, 55);
  assert.ok(hits[hits.length - 1].damage < 55, "later hits are scaled");
});

test("opposing projectiles cancel each other", () => {
  const m = makeMatch();
  place(m, -400, 400);
  const qcfRight = [{ dir: 2 }, { dir: 3 }, { dir: 6, buttons: BTN.LP }];
  const holdBack = { dir: 6, buttons: 0 };
  hold(m, 50, N, holdBack);
  for (let i = 0; i < qcfRight.length; i += 1) {
    m.step([qcfRight[i], i === qcfRight.length - 1 ? { dir: 4, buttons: BTN.LP } : holdBack]);
  }
  hold(m, 90);
  assert.equal(events(m, "special").length, 2);
  assert.ok(m.log.some((e) => e.name === "vfx" && e.payload.type === "clash"));
  assert.equal(events(m, "hit").length, 0);
});

test("an invincible uppercut beats a meaty attack", () => {
  const m = makeMatch();
  place(m, -50, 50);
  for (let t = 0; t < 40; t += 1) {
    const p2 = t === 0 ? { dir: 5, buttons: BTN.HK } : N;
    let p1 = N;
    if (t === 5) p1 = { dir: 6, buttons: 0 };
    if (t === 6) p1 = { dir: 2, buttons: 0 };
    if (t === 7) p1 = { dir: 3, buttons: 0 };
    if (t === 8) p1 = { dir: 3, buttons: BTN.LP };
    m.step([p1, p2]);
  }
  const hits = events(m, "hit");
  assert.ok(hits.length >= 1);
  assert.ok(hits.every((h) => h.attacker === "sam"), "Dario's kick passes through the invincible uppercut");
  assert.equal(hits[0].moveId, "launch_day");
});

test("pushboxes keep fighters apart and corners push the attacker", () => {
  const m = makeMatch();
  place(m, -200, 200);
  hold(m, 240, { dir: 6, buttons: 0 }, N);
  const a = m.point(0);
  const b = m.point(1);
  assert.ok(b.x - a.x >= 63.9, `distance ${b.x - a.x}`);

  const m2 = makeMatch();
  place(m2, 700, 868);
  hold(m2, 120, { dir: 6, buttons: 0 }, N);
  assert.ok(m2.point(1).x <= 900 - 32 + 0.01, "cornered fighter stays inside the stage");
  assert.ok(m2.point(1).x - m2.point(0).x >= 63.9);
});

test("hitstop freezes both fighters on contact", () => {
  const m = makeMatch();
  place(m, -40, 40);
  m.step([{ dir: 5, buttons: BTN.HP }, N]);
  until(m, () => events(m, "hit").length > 0, 20);
  const a = m.point(0);
  const d = m.point(1);
  assert.ok(a.hitstop > 0 && d.hitstop > 0);
  const frame = a.moveFrame;
  const dx = d.x;
  m.step([N, N]);
  assert.equal(a.moveFrame, frame);
  assert.equal(d.x, dx);
});

test("specials input during recovery come out on the first actionable frame", () => {
  const m = makeMatch();
  place(m, -400, 400);
  const sam = m.point(0);
  m.step([{ dir: 5, buttons: BTN.HK }, N]);
  const total = sam.move.total;
  hold(m, total - 5);
  assert.equal(sam.state, "attack");
  play(m, 0, [{ dir: 2 }, { dir: 3 }, { dir: 6, buttons: BTN.LP }]);
  hold(m, 4);
  const sp = events(m, "special");
  assert.equal(sp.length, 1, "buffered special fired");
  assert.equal(sp[0].moveId, "model_drop");
});

test("charge specials need the full charge", () => {
  const m = makeMatch({ p1: [makeMatch().point(1).def], p2: [makeMatch().point(0).def] });
  place(m, -300, 300);
  play(m, 0, [{ dir: 4, frames: 20 }, { dir: 6, buttons: BTN.LP }, { frames: 20 }]);
  assert.equal(events(m, "special").length, 0);
  play(m, 0, [{ dir: 4, frames: RULES.chargeFrames + 4 }, { dir: 6, buttons: BTN.LP }, { frames: 4 }]);
  assert.equal(events(m, "special").length, 1);
  assert.equal(events(m, "special")[0].moveId, "constitution_scroll");
});

test("meter builds from landing and taking hits", () => {
  const m = makeMatch();
  place(m, -40, 40);
  tap(m, 0, BTN.HP);
  hold(m, 30);
  assert.ok(m.sides[0].meter > 0);
  assert.ok(m.sides[1].meter > 0);
  assert.ok(m.sides[0].meter <= RULES.meterMax);
});

test("double-tap forward dashes into a run, back double-tap backdashes", () => {
  const m = makeMatch();
  place(m, -300, 300);
  const sam = m.point(0);
  play(m, 0, [{ dir: 6 }, { dir: 5, frames: 2 }, { dir: 6 }]);
  assert.equal(sam.state, "dash_fwd");
  hold(m, 20, { dir: 6, buttons: 0 });
  assert.equal(sam.state, "run");
  const x0 = sam.x;
  hold(m, 30, { dir: 6, buttons: 0 });
  assert.ok(Math.abs(sam.x - x0 - sam.def.stats.runSpeed * 0.5) < 1);

  const m2 = makeMatch();
  place(m2, -300, 300);
  play(m2, 0, [{ dir: 4 }, { dir: 5, frames: 2 }, { dir: 4 }]);
  assert.equal(m2.point(0).state, "dash_back");
});
