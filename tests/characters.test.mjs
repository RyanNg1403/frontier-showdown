import test from "node:test";
import assert from "node:assert/strict";
import { characterIds, loadCharacter } from "../src/characters/index.js";
import { NORMAL_KEYS, defineCharacter, describeCharacter } from "../src/characters/schema.js";
import { ANIM_FALLBACKS, REQUIRED_ANIMS } from "../src/combat/constants.js";

const KNOWN_ANIMS = new Set([...REQUIRED_ANIMS, ...Object.keys(ANIM_FALLBACKS)]);

for (const id of characterIds) {
  test(`${id}: data is complete and consistent`, async () => {
    const c = await loadCharacter(id);
    assert.equal(c.id, id);
    for (const k of ["name", "title", "lab", "bio"]) assert.ok(c[k], `${id}.${k}`);
    for (const k of ["primary", "secondary", "accent", "skin", "hair"]) assert.match(c.palette[k], /^#[0-9a-f]{6}$/i);
    assert.ok(c.stats.health >= 800 && c.stats.health <= 1200);
    for (const key of NORMAL_KEYS) {
      const m = c.normals[key];
      assert.ok(m, `${id} missing normal ${key}`);
      assert.ok(m.hitbox, `${id}.${key} hitbox`);
      assert.ok(m.damage > 0 && m.damage < 130, `${id}.${key} damage`);
      assert.ok(KNOWN_ANIMS.has(m.anim), `${id}.${key} anim ${m.anim}`);
      for (const target of m.cancelInto) {
        assert.ok(target === "special" || target === "super" || c.moves.has(target), `${id}.${key} cancels into unknown ${target}`);
      }
    }
    assert.equal(c.specials.length, 3, "three specials");
    c.specials.forEach((s, i) => {
      assert.equal(s.anim, `special_${i + 1}`);
      assert.ok(s.motion && s.motion.buttonMask, `${id}.${s.id} input`);
      assert.ok(s.hitbox || s.projectile || s.grab, `${id}.${s.id} does something`);
      assert.ok(s.description);
    });
    assert.ok(c.super && c.super.meterCost === 200 && c.super.motion);
    assert.ok(c.finisher && c.finisher.motion && c.finisher.description);
    assert.ok(c.moves.has(c.assist));
    assert.ok(c.throw.grab.techable);
    for (const m of c.moves.values()) {
      assert.ok(m.startup >= 1 && m.active >= 1 && m.recovery >= 0, `${id}.${m.id} frame data`);
      assert.equal(m.total, m.startup + m.active + m.recovery - 1);
    }
    const d = describeCharacter(c, false);
    assert.equal(d.specials.length, 3);
    assert.equal(d.hasAtlas, false);
  });
}

test("Sam and Dario play differently: motion vs charge", async () => {
  const s = await loadCharacter("sam");
  const d = await loadCharacter("dario");
  assert.ok(s.specials.every((m) => !m.motion.charge));
  assert.ok(d.specials.filter((m) => m.motion.charge).length >= 2);
  assert.ok(d.specials.some((m) => m.grab && !m.grab.techable), "Dario has a command grab");
  assert.ok(s.specials.some((m) => m.invuln), "Sam has an invincible reversal");
});

test("defineCharacter fills defaults for sparse data", () => {
  const c = defineCharacter({ id: "test", normals: { lp: { damage: 20, hitbox: { x: 0, y: -100, w: 50, h: 20 } } } });
  assert.equal(c.stats.health, 1000);
  assert.equal(c.normals.lp.kind, "light");
  assert.equal(c.normals.lp.anim, "light_punch");
  assert.equal(c.throw.anim, "throw");
  assert.equal(c.assist, "hp");
  assert.throws(() => defineCharacter({}));
});
