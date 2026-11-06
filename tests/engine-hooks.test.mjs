import test from "node:test";
import assert from "node:assert/strict";
import { BTN, N, events, hold, makeMatch, place, play, sam, tap, until } from "./helpers.mjs";
import { registerMechanic } from "../src/combat/mechanics.js";
import { defineCharacter, normalizeMove, normalizeProjectile } from "../src/characters/schema.js";
import { resolveAnim } from "../src/combat/anim.js";

registerMechanic("test-absorb", { beforeHurt: () => true });
registerMechanic("test-redirect", {
  beforeHurt(fighter, ctx) {
    ctx.props = Object.assign(ctx.props, { damage: 1 });
    return false;
  },
});
const absorber = defineCharacter({ ...sam.raw, id: "absorber", mechanics: ["test-absorb"] });
const redirector = defineCharacter({ ...sam.raw, id: "redirector", mechanics: ["test-redirect"] });

test("beforeHurt can absorb a hit entirely", () => {
  const m = makeMatch({ p2: [absorber] });
  place(m, -40, 40);
  tap(m, 0, BTN.LP);
  hold(m, 8);
  assert.equal(events(m, "hit").length, 0);
  assert.equal(events(m, "absorb").length, 1);
  assert.equal(m.point(1).health, m.point(1).maxHealth);
});

test("beforeHurt can rewrite the incoming hit and let it through", () => {
  const m = makeMatch({ p2: [redirector] });
  place(m, -40, 40);
  tap(m, 0, BTN.LP);
  hold(m, 8);
  assert.equal(events(m, "hit")[0].damage, 1);
});

test("entities can provide platforms fighters stand on and walk off", () => {
  const m = makeMatch();
  place(m, -300, 300);
  m.spawnEntity({ solid: { x: -360, y: -90, w: 160, h: 20 }, update: () => true });
  const f = m.point(0);
  f.y = -200;
  f.vy = 1;
  f.setState("jump");
  until(m, () => !f.airborne, 60);
  assert.equal(f.y, -90, "lands on the platform");
  assert.equal(f.floorY, -90);
  hold(m, 40, { dir: 6, buttons: 0 });
  until(m, () => f.y === 0, 80, { dir: 6, buttons: 0 });
  assert.equal(f.y, 0, "walked off and fell to the floor");
});

test("wall solids block movement", () => {
  const m = makeMatch();
  place(m, -300, 300);
  m.spawnEntity({ solid: { x: -150, y: -300, w: 20, h: 300, wall: true, platform: false }, update: () => true });
  hold(m, 120, { dir: 6, buttons: 0 });
  assert.ok(m.point(0).x <= -150 - m.point(0).push.w / 2 + 0.01);
});

test("intangible fighters pass through pushboxes", () => {
  const m = makeMatch();
  place(m, -20, 20);
  m.point(0).intangible = true;
  hold(m, 30, { dir: 6, buttons: 0 });
  assert.ok(m.point(0).x > m.point(1).x, "walked through the opponent");
});

test("airOnly specials only come out in the air; groundOnly only on the ground", () => {
  const chonk = defineCharacter({
    ...sam.raw,
    id: "chonk",
    specials: [...sam.raw.specials, { id: "drop", name: "Drop", input: "D+HK", airOnly: true, startup: 4, active: 6, recovery: 10, damage: 50, hitbox: { x: 0, y: -60, w: 80, h: 60 } }],
  });
  const m = makeMatch({ p1: [chonk] });
  place(m, -300, 300);
  play(m, 0, [{ dir: 2, buttons: BTN.HK }, { dir: 2, frames: 3 }]);
  assert.equal(m.point(0).move?.id, "c_hk", "on the ground D+HK is the sweep");
  const m2 = makeMatch({ p1: [chonk] });
  place(m2, -300, 300);
  play(m2, 0, [{ dir: 8, frames: 10 }, { dir: 2, buttons: BTN.HK }, { dir: 2 }]);
  assert.equal(m2.point(0).move?.id, "drop");
  assert.equal(normalizeMove("x", { groundOnly: true }).groundOnly, true);
});

test("schema exports normalizeMove and normalizeProjectile", () => {
  const mv = normalizeMove("expert_hp", { startup: 9, active: 3, recovery: 18, damage: 70 }, "normal");
  assert.equal(mv.id, "expert_hp");
  assert.equal(mv.total, 29);
  const p = normalizeProjectile({ speed: 300, damage: 40 });
  assert.equal(p.speed, 300);
  assert.equal(p.damage, 40);
});

test("variant animation names fall back to their base", () => {
  const atlas = { animations: { idle: {}, heavy_punch: {}, block: {} } };
  assert.equal(resolveAnim(atlas, "heavy_punch_grappler"), "heavy_punch");
  assert.equal(resolveAnim(atlas, "crouch_block"), "block", "named fallbacks still win");
  assert.equal(resolveAnim(atlas, "special_2_ex"), "idle");
});

test("move passThrough windows skip pushbox resolution", () => {
  const dash = defineCharacter({
    ...sam.raw,
    id: "dasher",
    specials: [{ id: "trace", name: "Trace", input: "QCF+K", startup: 2, active: 1, recovery: 20, velocity: [{ from: 1, to: 20, vx: 900 }], passThrough: { from: 1, to: 22 } }, ...sam.raw.specials.slice(1)],
  });
  const m = makeMatch({ p1: [dash] });
  place(m, -60, 60);
  play(m, 0, [{ dir: 2 }, { dir: 3 }, { dir: 6, buttons: BTN.LK }, { frames: 18 }]);
  assert.ok(m.point(0).x > m.point(1).x, "dashed through");
  hold(m, 1, N);
});
