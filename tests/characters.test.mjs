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
      assert.ok(s.hitbox || s.projectile || s.grab || s.barrier || s.parry, `${id}.${s.id} does something`);
      assert.ok(s.description);
    });
    assert.ok(c.super && c.super.meterCost === 300 && c.super.motion);
    assert.equal(c.super.motion.buttonMask, 2, "Breakthrough is QCF,QCF+HP");
    assert.ok(c.finisher && c.finisher.motion && c.finisher.description);
    assert.ok(c.moves.has(c.assists.a) && c.moves.has(c.assists.b));
    assert.ok(c.passive, "lab passive");
    assert.ok(c.sharedSkills.includes(`lab:${c.labId}`));
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

test("Sam and Dario follow the roster doc kits", async () => {
  const s = await loadCharacter("sam");
  const d = await loadCharacter("dario");
  assert.deepEqual(s.specials.map((m) => m.id), ["prompt_burst", "event_horizon", "stargate_rush"]);
  assert.deepEqual(d.specials.map((m) => m.id), ["constitutional_barrier", "country_of_geniuses", "asl_safeguard"]);
  assert.equal(s.super.id, "few_thousand_days");
  assert.equal(d.super.id, "compressed_century");
  assert.equal(s.finisher.id, "gentle_singularity");
  assert.equal(d.finisher.id, "not_to_claude");
  assert.deepEqual({ ...s.assists }, { a: "prompt_burst", b: "event_horizon" });
  assert.deepEqual({ ...d.assists }, { a: "country_of_geniuses", b: "constitutional_barrier" });
  assert.equal(s.stats.walkSpeed, 210);
  assert.equal(d.stats.jumpHeight, 195, "jump is an apex height in px");
  assert.ok(s.specials[1].invuln, "Sam has an invincible reversal");
  assert.equal(s.specials[2].variants.HK.teleport.to, "behind", "HK Stargate crosses up");
  assert.ok(d.specials[0].barrier && d.specials[2].parry, "Dario has a barrier and a counter stance");
  assert.equal(d.specials[1].variants.HP.projectile.spread.length, 3, "HP geniuses split into three");
  assert.equal(s.passive, "Iterative Deployment");
  assert.equal(d.passive, "Responsible Scaling");
});

test("defineCharacter fills defaults for sparse data", () => {
  const c = defineCharacter({ id: "test", normals: { lp: { damage: 20, hitbox: { x: 0, y: -100, w: 50, h: 20 } } } });
  assert.equal(c.stats.health, 1000);
  assert.equal(c.normals.lp.kind, "light");
  assert.equal(c.normals.lp.anim, "light_punch");
  assert.equal(c.throw.anim, "throw");
  assert.equal(c.assists.a, "hp");
  assert.throws(() => defineCharacter({}));
});
