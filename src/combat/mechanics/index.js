import { normalizeProjectile } from "../../characters/schema.js";
import { systems } from "../mechanics.js";
import { fighterData } from "./core.js";
import { combineMods, NO_MODS } from "./mods.js";
import "./strikes.js";
import "./status.js";
import "./projectiles.js";
import "./placed.js";
import "./companion.js";
import "./meter-parry.js";

/**
 * Runtime for match-level systems registered with `registerSystem` (see `../mechanics.js`).
 * The match calls these hooks; behaviour is driven by `mech` fields in character data, so
 * fighters without them are unaffected. Core systems (orders 10-70): strikes, status,
 * projectiles, placed, companion, meter-parry; fighter mechanics default to order 100.
 */
export function createMechanics(match) {
  const ctx = {
    match,
    state: {},
    objects: [],
    effects: [],
    timers: [],
    nextId: 1,
    addObject(o) {
      const obj = { id: ctx.nextId++, age: 0, born: match.frame, dead: false, ...o };
      ctx.objects.push(obj);
      return obj;
    },
    addStatus(f, name, params) {
      fighterData(f).status[name] = { ...params, frames: params.frames ?? 60, maxFrames: params.frames ?? 60 };
    },
    status(f, name) {
      return fighterData(f).status[name] || null;
    },
    effect(type, x, y, opts = {}) {
      ctx.effects.push({ id: ctx.nextId++, type, x, y, age: 0, life: opts.life ?? 20, ...opts });
    },
    schedule(frames, fn) {
      ctx.timers.push({ at: match.frame + frames, fn });
    },
    spawnRaw(owner, raw, at) {
      const def = normalizeProjectile(raw, 1);
      const p = {
        id: match.nextProjectileId++,
        ownerUid: owner.uid,
        ownerId: owner.id,
        owner,
        side: owner.side,
        category: "special",
        moveId: raw.moveId || "mech_projectile",
        def,
        x: at.x,
        y: at.y,
        vx: at.vx ?? 0,
        vy: at.vy ?? 0,
        facing: at.facing ?? owner.facing,
        age: 0,
        hits: 0,
        durability: def.durability,
        damageMul: owner.damageMul ?? 1,
        lastHit: new Map(),
        vfx: def.vfx,
        palette: owner.def.palette,
        dead: false,
        x0: at.x,
        fromGround: true,
      };
      match.projectiles.push(p);
      return p;
    },
  };

  const run = (hook, ...args) => {
    for (const m of systems()) m[hook]?.(ctx, ...args);
  };

  const api = {
    ctx,
    get objects() {
      return ctx.objects;
    },
    get effects() {
      return ctx.effects;
    },

    /** Round start: clear placed objects, statuses and per-round flags. */
    reset() {
      ctx.objects = [];
      ctx.timers = [];
      ctx.effects = [];
      for (const f of match.allFighters) {
        const d = fighterData(f);
        d.status = {};
        d.flags = {};
        f.mods = NO_MODS;
      }
      run("reset");
    },

    /** Before fighters update: tick statuses and recompute every fighter's `mods`. */
    preStep() {
      run("preStep");
      for (const f of match.allFighters) {
        const list = [];
        for (const m of systems()) if (m.modsFor) list.push(...m.modsFor(ctx, f));
        f.mods = combineMods(list);
      }
    },

    /** After hits resolve: timers, placed objects, companions, follow-ups. */
    update() {
      if (match.phase === "finish" || match.phase === "finisher") {
        ctx.objects = [];
        ctx.timers = [];
      }
      const due = ctx.timers.filter((t) => t.at <= match.frame);
      if (due.length) {
        ctx.timers = ctx.timers.filter((t) => t.at > match.frame);
        for (const t of due) t.fn();
      }
      run("update");
      ctx.objects = ctx.objects.filter((o) => !o.dead);
      for (const e of ctx.effects) e.age += 1;
      ctx.effects = ctx.effects.filter((e) => e.age <= e.life);
    },

    onSpawnProjectile(owner, move, projs) {
      run("onSpawnProjectile", owner, move, projs);
    },

    /** Returns true when the projectile was consumed (for example it split). */
    projectileTick(p) {
      for (const m of systems()) if (m.projectileTick?.(ctx, p)) return true;
      return false;
    },

    /** Returns true when a mechanic consumed the contact (a meter parry). May adjust `props`. */
    beforeContact(a, d, props, at, info) {
      for (const m of systems()) if (m.beforeContact?.(ctx, a, d, props, at, info)) return true;
      return false;
    },

    onHit(a, d, props, info) {
      run("onHit", a, d, props, info);
    },

    status(f, name) {
      return ctx.status(f, name);
    },

    snapshot() {
      const out = {
        objects: ctx.objects.map((o) => ({ id: o.id, type: o.type, look: o.look, side: o.side, owner: o.ownerId, x: Math.round(o.x), y: Math.round(o.y), w: o.w, h: o.h, life: o.life, maxLife: o.maxLife })),
      };
      run("snapshot", out);
      return out;
    },
  };
  return api;
}

export { NO_MODS };
