import test from "node:test";
import assert from "node:assert/strict";
import { BTN, N, events, hold, makeMatch, place, play, sam, until } from "./helpers.mjs";
import { arthur, demis, ilya, jensen, probe, special, stepsUntil } from "./group-b-helpers.mjs";
import { Match } from "../src/combat/match.js";
import { createCpu } from "../src/combat/ai.js";
import { loadCharacter } from "../src/characters/index.js";
import { stonesOf as trapsOf } from "../src/combat/mechanics/group-b/stones.js";
import { turretsOf } from "../src/combat/mechanics/group-b/turret.js";

/** Roster doc 3.5-3.8: special id, input, startup / active / recovery (active null = object lifetime), damage. */
const DOC = {
  demis: {
    stats: { health: 980, walkSpeed: 195, runSpeed: 450, jumpHeight: 205, weight: 0.95 },
    specials: [
      ["move_37", "QCB+P", 20, null, 18, 60],
      ["alphafold", "QCF+P", 18, null, 30, 50],
      ["self_play", "D,B+K", 14, null, 16, null],
    ],
    super: ["promptable_world_event", 9, 330],
    finisher: ["resigns", "F,B,F+LP", "mid"],
    assists: { a: "move_37", b: "alphafold" },
    passive: "Self-Play",
  },
  jensen: {
    stats: { health: 1150, walkSpeed: 165, runSpeed: 400, jumpHeight: 175, weight: 1.2 },
    specials: [
      ["been_cooking", "QCB+P", 22, null, 34, 75],
      ["dgx_delivery", "HCB,F+P", 8, 2, 48, 170],
      ["ai_factory", "D,B+K", 24, null, 20, 25],
    ],
    super: ["vera_rubin_keynote", 10, 340],
    finisher: ["signed_limited_edition", "B,F,B+HP", "close"],
    assists: { a: "been_cooking", b: "ai_factory" },
    passive: "The More You Buy",
  },
  ilya: {
    stats: { health: 950, walkSpeed: 185, runSpeed: 440, jumpHeight: 220, weight: 0.9 },
    specials: [
      ["peak_data", "QCF+P", 16, null, 28, 70],
      ["straight_shot", "B,F+P", 12, 3, 26, 80],
      ["ilya_saw", "D,B+K", 3, 20, 28, 90],
    ],
    super: ["feel_the_agi", 8, 340],
    finisher: ["slightly_conscious", "D,F,D,F+LP", "far"],
    assists: { a: "peak_data", b: "straight_shot" },
    passive: "Straight Shot",
  },
  arthur: {
    stats: { health: 930, walkSpeed: 250, runSpeed: 560, jumpHeight: 215, weight: 0.9 },
    specials: [
      ["mistral_gust", "QCB+K", 15, null, 24, 30],
      ["magnet_link", "QCF+P", 16, 6, 28, 40],
      ["le_chonk", "D+HK", 10, null, 22, 95],
    ],
    super: ["chinchilla_optimal", 6, 320],
    finisher: ["paris_marathon", "F,F,F+LK", "mid"],
    assists: { a: "mistral_gust", b: "magnet_link" },
    passive: "Capital Efficient",
  },
};

const DEFS = { demis, jensen, ilya, arthur };

/** Damage a special deals: strike, projectile, grab, trap stone, turret token or parry counter. */
function specialDamage(m) {
  return m.damage || m.projectile?.damage || m.grab?.damage || m.mech?.stones?.hit?.damage || m.mech?.turret?.token?.damage || m.parry?.counter.damage || null;
}

function superDamage(s) {
  const per = s.projectile ? s.projectile.damage * s.projectile.hits : s.damage * s.hits;
  return per;
}

for (const [id, doc] of Object.entries(DOC)) {
  test(`${id}: stats, kit, inputs and frame data match the roster doc`, async () => {
    const c = await loadCharacter(id);
    for (const [k, v] of Object.entries(doc.stats)) assert.equal(c.stats[k], v, `${id}.stats.${k}`);
    assert.deepEqual(c.specials.map((s) => s.id), doc.specials.map((s) => s[0]));
    doc.specials.forEach(([sid, input, startup, active, recovery, damage], i) => {
      const s = c.specials[i];
      assert.equal(s.input, input, `${sid} input`);
      assert.equal(s.startup, startup, `${sid} startup`);
      if (active !== null) assert.equal(s.active, active, `${sid} active`);
      if (s.airOnly) assert.equal(s.landingRecovery, recovery, `${sid} landing recovery`);
      else assert.equal(s.recovery, recovery, `${sid} recovery`);
      if (damage !== null) assert.equal(specialDamage(s), damage, `${sid} damage`);
    });
    const [superId, superStartup, superTotal] = doc.super;
    assert.equal(c.super.id, superId);
    assert.equal(c.super.startup, superStartup);
    assert.equal(c.super.input, "QCF,QCF+HP");
    assert.ok(Math.abs(superDamage(c.super) - superTotal) <= 20, `${superId} totals about ${superTotal}`);
    assert.ok(c.super.invuln, "super is invulnerable through startup");
    assert.deepEqual([c.finisher.id, c.finisher.input, c.finisher.rangeName], doc.finisher);
    assert.deepEqual({ ...c.assists }, doc.assists);
    assert.equal(c.passive, doc.passive);
    assert.ok(c.quotes.intro && c.quotes.victory.length === 2, "intro and two victory lines");
  });
}

test("Jensen's placeholder palette: silver-grey swept-back hair and a black leather jacket", () => {
  assert.equal(jensen.palette.hairStyle, "swept");
  assert.equal(jensen.palette.hair, "#b8bcc4");
  const lum = (hex) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
  assert.ok(lum(jensen.palette.primary) < 60, "black jacket");
  assert.ok(lum(jensen.palette.hair) > 500, "silver hair");
  assert.equal(demis.palette.hairStyle, "shaved");
  assert.ok(demis.palette.beard && demis.palette.glasses);
  assert.equal(ilya.palette.hairStyle, "receding");
  assert.equal(arthur.palette.primary, "#1c2541");
});

// ---------------------------------------------------------------- live frame data

/** Frames from the press (frame 1) until `pred` first holds. */
function framesTo(m, pred) {
  return 1 + stepsUntil(m, pred, 80);
}

test("live frame data: objects and projectiles appear on each special's startup frame", () => {
  const cases = [
    [demis, "QCB+P", BTN.LP, (m) => trapsOf(m, m.point(0)).length > 0, 20],
    [demis, "QCF+P", BTN.LP, (m) => m.projectiles.length > 0, 18],
    [demis, "D,B+K", BTN.LK, (m) => m.mech.objects.some((o) => o.type === "echo"), 14],
    [jensen, "QCB+P", BTN.HP, (m) => m.projectiles.length > 0, 22],
    [jensen, "D,B+K", BTN.LK, (m) => turretsOf(m, m.point(0)).length > 0, 24],
    [ilya, "QCF+P", BTN.LP, (m) => m.projectiles.length > 0, 16],
    [arthur, "QCB+K", BTN.LK, (m) => m.projectiles.length > 0, 15],
  ];
  for (const [def, input, button, pred, startup] of cases) {
    const m = makeMatch({ p1: [def], p2: [sam] });
    place(m, -500, 500);
    special(m, 0, input, button);
    assert.equal(framesTo(m, () => pred(m)), startup, `${def.id} ${input}`);
  }
});

test("live frame data: strikes and grabs connect on their startup frame", () => {
  const cases = [
    [ilya, "B,F+P", BTN.LP, "straight_shot", -200, 100, 12],
    [arthur, "QCF+P", BTN.LP, "magnet_link", -250, 50, 16],
    [jensen, "HCB,F+P", BTN.LP, "dgx_delivery", -40, 40, 8],
  ];
  for (const [def, input, button, moveId, x0, x1, startup] of cases) {
    const m = makeMatch({ p1: [def], p2: [sam] });
    place(m, x0, x1);
    special(m, 0, input, button);
    const name = moveId === "dgx_delivery" ? "throw" : "hit";
    assert.equal(framesTo(m, () => events(m, name).length > 0), startup, `${def.id} ${moveId}`);
  }
});

test("live frame data: What Did Ilya See? counters from frame 3 to frame 22", () => {
  for (const [frame, expect] of [[2, false], [3, true], [22, true], [23, false]]) {
    const m = makeMatch({ p1: [ilya], p2: [sam] });
    place(m, -60, 60);
    special(m, 0, "D,B+K", BTN.LK);
    hold(m, frame - 1);
    assert.equal(m.point(0).moveFrame, frame);
    m.applyContact(m.point(1), m.point(0), probe("probe", { damage: 10, kind: "light", category: "normal", level: "low" }), { x: 0, y: -60 }, { dir: -1 });
    assert.equal(events(m, "parry").length > 0, expect, `move frame ${frame}`);
  }
});

test("live frame data: Le Chonk Drop is active from frame 10 and lands into 22 frames of recovery", () => {
  const m = makeMatch({ p1: [arthur], p2: [sam] });
  place(m, -300, 300);
  const a = m.point(0);
  play(m, 0, [{ dir: 8, frames: 2 }, { frames: 12 }]);
  play(m, 0, [{ dir: 2, buttons: BTN.HK, frames: 1 }]);
  assert.equal(framesTo(m, () => a.activeHitIndex() >= 0), 10);
  until(m, () => a.state === "jump_land", 60);
  assert.equal(stepsUntil(m, () => a.state !== "jump_land", 40), 22);
});

// ---------------------------------------------------------------- 2v2 assists

test("2v2: every Group B fighter's assists A and B call the doc's moves", () => {
  for (const def of [demis, jensen, ilya, arthur]) {
    for (const which of ["a", "b"]) {
      const m = makeMatch({ mode: "2v2", p1: [sam, def], p2: [sam, sam] });
      place(m, -250, 250);
      play(m, 0, [{ dir: which === "b" ? 4 : 5, buttons: BTN.ASSIST }, { frames: 70 }]);
      const call = events(m, "assist")[0];
      assert.ok(call, `${def.id} assist ${which}`);
      assert.equal(call.moveId, def.assists[which]);
      assert.ok(events(m, "special").some((s) => s.assist && s.moveId === def.assists[which]), `${def.id} performs ${call.moveId}`);
    }
  }
});

test("2v2: an AI Factory placed by an assist keeps firing after the partner leaves", () => {
  const m = makeMatch({ mode: "2v2", p1: [sam, jensen], p2: [sam, sam] });
  place(m, -300, 300);
  play(m, 0, [{ dir: 4, buttons: BTN.ASSIST }, { frames: 100 }]);
  assert.equal(m.sides[0].assist, null, "partner benched");
  assert.equal(m.mech.objects.filter((o) => o.type === "turret").length, 1);
  assert.ok(m.projectiles.some((p) => String(p.ownerUid).startsWith("turret:")));
});

// ---------------------------------------------------------------- CPU uses the kits

function cpuMatch(def, opp = sam, frames = 3600, seed = 11) {
  const log = [];
  const m = new Match({
    mode: "1v1",
    skipIntro: true,
    seed,
    sides: [
      { team: [def], control: "cpu", cpu: createCpu("hard", seed) },
      { team: [opp], control: "cpu", cpu: createCpu("normal", seed + 5) },
    ],
    emit: (name, payload) => {
      if (name !== "tick" && name !== "vfx") log.push({ name, payload });
    },
  });
  m.start();
  const objects = new Set();
  for (let i = 0; i < frames && m.phase !== "matchEnd"; i += 1) {
    m.step([]);
    for (const o of m.mech.snapshot().objects) if (o.side === 0) objects.add(o.type);
  }
  const specials = new Set(log.filter((e) => e.name === "special" && e.payload.side === 0).map((e) => e.payload.moveId));
  return { m, log, specials, objects };
}

test("CPU: each Group B fighter plays its kit", () => {
  const demisRun = cpuMatch(demis);
  assert.ok(demisRun.specials.has("move_37") && demisRun.specials.has("self_play") && demisRun.specials.has("alphafold"), [...demisRun.specials].join());
  assert.ok(demisRun.objects.has("stone") && demisRun.objects.has("echo"));

  const jensenRun = cpuMatch(jensen);
  assert.ok(jensenRun.specials.has("ai_factory") && jensenRun.specials.has("been_cooking"), [...jensenRun.specials].join());
  assert.ok(jensenRun.objects.has("turret"));

  const ilyaRun = cpuMatch(ilya);
  assert.ok(ilyaRun.specials.has("peak_data") && ilyaRun.specials.has("straight_shot"), [...ilyaRun.specials].join());
  assert.ok(ilyaRun.specials.size >= 2);

  const arthurRun = cpuMatch(arthur);
  assert.ok(arthurRun.specials.has("mistral_gust") && arthurRun.specials.has("magnet_link"), [...arthurRun.specials].join());
});

test("CPU: Group B mirror and cross matches run to a result without errors", () => {
  const roster = [demis, jensen, ilya, arthur];
  for (let i = 0; i < roster.length; i += 1) {
    const { m } = cpuMatch(roster[i], roster[(i + 1) % roster.length], 99 * 60 * 3, 3 + i);
    assert.ok(m.round >= 1);
    assert.ok(m.sides.some((s) => s.wins > 0), `${roster[i].id} match produced a round winner`);
  }
});

test("finishers: each Group B finisher can be performed in the finish phase", () => {
  const ranges = { close: 120, mid: 260, far: 600 };
  for (const def of [demis, jensen, ilya, arthur]) {
    const m = makeMatch({ p1: [def], p2: [sam], roundsToWin: 1 });
    place(m, -ranges[def.finisher.rangeName] / 2, ranges[def.finisher.rangeName] / 2);
    m.point(1).health = 0;
    hold(m, 2);
    assert.equal(m.phase, "finish");
    m.point(1).setState("dazed");
    special(m, 0, def.finisher.input, def.finisher.motion.buttonMask);
    hold(m, 2);
    assert.equal(events(m, "finisher")[0]?.id, def.finisher.id, `${def.id} finisher`);
  }
});

test("Arthur's forward + HK flying kick works out of a run", () => {
  const m = makeMatch({ p1: [arthur], p2: [sam] });
  place(m, -500, 300);
  play(m, 0, [{ dir: 6, frames: 2 }, { dir: 5, frames: 2 }, { dir: 6, frames: 20 }]);
  assert.equal(m.point(0).state, "run");
  play(m, 0, [{ dir: 6, buttons: BTN.HK, frames: 1 }]);
  assert.equal(m.point(0).move.id, "f_hk");
  hold(m, 2);
  assert.ok(m.point(0).vx >= 400, "flies forward");
});
