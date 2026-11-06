import test from "node:test";
import assert from "node:assert/strict";
import { adaptVfx } from "../src/engine/vfx-adapter.js";

function fakeVfx(types) {
  const spawns = [];
  const module = { effectTypes: () => types };
  const instance = {
    spawn: (type, x, y, opts) => {
      spawns.push({ type, x, y, opts });
      return { type };
    },
    update() {},
    draw() {},
  };
  return { vfx: adaptVfx(module, instance), spawns };
}

const TYPES = ["super_freeze", "lab_charge", "lab_beam", "special_openai", "signature_openai", "signature_xai"];
const caster = { characterId: "sam", labId: "openai", facing: 1, side: 0 };

function castSuper(vfx, vfxHint, who = caster) {
  vfx.spawn("super_flash", 100, 480, { characterId: who.characterId, labId: who.labId, facing: who.facing, side: who.side });
  vfx.spawn("special_cast", 150, 480, { ...who, moveId: "super", vfx: vfxHint });
}

test("a super listing special_<lab> casts the signature showpiece at the caster's feet", () => {
  const { vfx, spawns } = fakeVfx(TYPES);
  castSuper(vfx, "special_openai");
  assert.deepEqual(spawns.map((s) => s.type), ["super_freeze", "signature_openai"]);
  assert.equal(spawns[1].x, 100);
  assert.equal(spawns[1].y, 600);
  assert.equal(spawns[1].opts.lab, "openai");
});

test("a super listing nothing uses the caster's lab signature", () => {
  const { vfx, spawns } = fakeVfx(TYPES);
  castSuper(vfx, undefined, { characterId: "elon", labId: "spacex-xai", facing: -1, side: 1 });
  assert.equal(spawns[1].type, "signature_xai");
  assert.equal(spawns[1].opts.dir, -1);
});

test("a super naming an effect the module lacks also gets the signature", () => {
  const { vfx, spawns } = fakeVfx(TYPES);
  castSuper(vfx, "world_event", { characterId: "elon", labId: "xai", facing: 1, side: 0 });
  assert.equal(spawns[1].type, "signature_xai");
});

test("a super with an explicit template keeps it", () => {
  const { vfx, spawns } = fakeVfx(TYPES);
  castSuper(vfx, "lab_beam");
  assert.equal(spawns[1].type, "lab_beam");
});

test("specials and reversals keep the small hand flash", () => {
  const { vfx, spawns } = fakeVfx(TYPES);
  vfx.spawn("special_cast", 150, 480, { ...caster, moveId: "prompt_burst", vfx: "special_openai" });
  vfx.spawn("special_cast", 150, 480, { ...caster, moveId: "event_horizon", vfx: "special_openai" });
  assert.deepEqual(spawns.map((s) => s.type), ["special_openai", "special_openai"]);
});

test("a lab without a signature falls back to the normal cast", () => {
  const { vfx, spawns } = fakeVfx(TYPES);
  castSuper(vfx, "special_uoft", { characterId: "geoffrey", labId: "uoft", facing: 1, side: 0 });
  assert.equal(spawns[1].type, "lab_charge");
});

test("the super link only covers the cast spawned right after super_flash", () => {
  const { vfx, spawns } = fakeVfx(TYPES);
  vfx.spawn("super_flash", 100, 480, { ...caster });
  vfx.spawn("lab_charge", 0, 0, {});
  vfx.spawn("special_cast", 150, 480, { ...caster, vfx: "special_openai" });
  assert.equal(spawns[2].type, "special_openai");
});

test("a real super cast reaches the adapter as super_flash then special_cast", async () => {
  const { makeMatch, events } = await import("./helpers.mjs");
  const m = makeMatch();
  const sam = m.fighters[0];
  const env = m.envFor(sam);
  env.team.meter = 9999;
  sam.startMove(sam.def.super, env);
  const { vfx, spawns } = fakeVfx(TYPES);
  for (const e of events(m, "vfx")) vfx.spawn(e.type, e.x, e.y, e.opts);
  assert.ok(spawns.some((s) => s.type === "signature_openai"), spawns.map((s) => s.type).join(","));
  assert.ok(!spawns.some((s) => s.type === "special_openai"));
});
