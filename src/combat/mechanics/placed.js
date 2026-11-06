import { DT } from "../constants.js";
import { contactProps, currentMove, fireOnce } from "./core.js";

const STUN_STATES = new Set(["hitstun", "juggle", "blockstun", "thrown", "knockdown", "getup", "ko"]);

/**
 * Objects placed on the floor by a move: `mech: { place: {...} }`, created on the move's first
 * active frame `offset` px in front of the user. At most `max` (default 1) per owner and type.
 *
 * - `type: "trap"` (The Cake): the first grounded enemy whose feet touch it springs it, taking
 *   `trigger` as a hit (`{ damage, hitstun, level }`), receiving `trigger.status` (for example
 *   `{ slow: { frames, speedMul, noDash } }`) and, with `trigger.pop`, a small projectile that
 *   pops off the trap (`home` makes it steer toward the victim).
 * - `type: "zone"` (Containment Field): enemies inside get `mods` (for example
 *   `{ speedMul: 0.6, noDash: true }`). Walking or jumping out while free to act costs `exit`
 *   (`{ damage }`). With `blockProjectiles`, enemy projectiles crossing its edges are destroyed.
 */
export const placedModule = {
  name: "placed",

  update(ctx) {
    const match = ctx.match;
    for (const f of match.allFighters) {
      const m = currentMove(f);
      const spec = m?.mech?.place;
      if (spec && f.moveFrame >= (spec.frame ?? m.startup) && fireOnce(f, "place")) place(ctx, f, spec);
    }
    const live = match.phase === "fight";
    for (const o of ctx.objects) {
      if (o.dead || (o.type !== "trap" && o.type !== "zone") || o.born === match.frame) continue;
      o.life -= 1;
      o.age += 1;
      if (o.life <= 0) {
        o.dead = true;
        ctx.effect("placed_fade", o.x, -20, { side: o.side, life: 16, look: o.look });
        continue;
      }
      if (!live) continue;
      if (o.type === "trap") updateTrap(ctx, o);
      else updateZone(ctx, o);
    }
  },

  modsFor(ctx, f) {
    const out = [];
    for (const o of ctx.objects) {
      if (o.dead || o.type !== "zone" || o.side === f.side || !o.spec.mods) continue;
      if (insideZone(o, f)) out.push(o.spec.mods);
    }
    return out;
  },
};

function place(ctx, owner, spec) {
  const match = ctx.match;
  const max = spec.max ?? 1;
  const mine = ctx.objects.filter((o) => !o.dead && o.ownerUid === owner.uid && o.type === spec.type);
  while (mine.length >= max) {
    const old = mine.shift();
    old.dead = true;
    ctx.effect("placed_fade", old.x, -20, { side: old.side, life: 16, look: old.look });
  }
  const { left, right } = match.bounds;
  const half = (spec.w ?? 80) / 2;
  const x = Math.max(left + half, Math.min(right - half, owner.x + owner.facing * (spec.offset ?? 120)));
  const o = ctx.addObject({
    type: spec.type,
    look: spec.look || spec.type,
    owner,
    ownerUid: owner.uid,
    ownerId: owner.id,
    side: owner.side,
    facing: owner.facing,
    x,
    y: 0,
    w: spec.w ?? 80,
    h: spec.h ?? 60,
    life: spec.lifetime ?? 300,
    maxLife: spec.lifetime ?? 300,
    spec,
    inside: new Map(),
    zapCooldown: new Map(),
  });
  match.emit("placed", { fighter: owner.id, side: owner.side, kind: o.look, x: o.x });
  match.vfx("special_cast", o.x, -30, { facing: owner.facing, side: owner.side, vfx: spec.vfx || "lab_burst", palette: owner.def.palette });
  return o;
}

function insideZone(o, f) {
  return f.onField && Math.abs(f.x - o.x) <= o.w / 2 && f.y > -o.h;
}

function enemiesOf(match, o) {
  return match.fighters.filter((f) => f.side !== o.side && !f.assistMode && !f.ko && f.canFight);
}

function updateTrap(ctx, o) {
  const match = ctx.match;
  for (const d of enemiesOf(match, o)) {
    if (d.airborne || d.isLying || d.invulnTo("strike")) continue;
    if (Math.abs(d.x - o.x) > o.w / 2 + d.push.w * 0.25) continue;
    spring(ctx, o, d);
    return;
  }
}

function spring(ctx, o, d) {
  const match = ctx.match;
  const t = o.spec.trigger || {};
  o.dead = true;
  const dir = Math.sign(d.x - o.x) || o.facing;
  if (t.damage) {
    const props = contactProps(`${o.look}_trap`, { damage: t.damage, hitstun: t.hitstun ?? 16, level: t.level || "unblockable", knockback: { x: 0 }, chip: 0 });
    match.applyContact(o.owner, d, props, { x: d.x, y: -30 }, { projectile: { x: o.x, vx: 0 }, dir });
  }
  for (const [name, params] of Object.entries(t.status || {})) ctx.addStatus(d, name, params);
  ctx.effect("trap_spring", o.x, -30, { side: o.side, life: 30, look: o.look, palette: o.owner.def.palette });
  match.emit("trap", { fighter: o.ownerId, side: o.side, victim: d.id, kind: o.look });
  if (t.pop) {
    const pop = t.pop;
    ctx.spawnRaw(o.owner, {
      speed: Math.abs(pop.vx ?? 60),
      hitbox: pop.hitbox || { x: -12, y: -12, w: 24, h: 24 },
      lifetime: pop.lifetime ?? 70,
      damage: pop.damage ?? 20,
      chip: pop.chip ?? 2,
      hitstun: pop.hitstun ?? 16,
      blockstun: pop.blockstun ?? 12,
      knockback: pop.knockback || { x: 120 },
      gravity: pop.gravity ?? 1500,
      level: pop.level || "mid",
      vfx: pop.vfx || "projectile",
      meterGain: 3,
      mech: { look: pop.look || "cherry", home: pop.home || undefined },
      moveId: `${o.look}_pop`,
    }, { x: d.x - dir * 12, y: -70, vx: dir * (pop.vx ?? 60), vy: pop.vy ?? -560, facing: dir });
  }
}

function updateZone(ctx, o) {
  const match = ctx.match;
  const ex = o.spec.exit;
  for (const d of match.fighters) {
    if (d.side === o.side || d.ko) continue;
    const inside = insideZone(o, d);
    const was = o.inside.get(d.uid) || false;
    o.inside.set(d.uid, inside);
    const cd = o.zapCooldown.get(d.uid) || 0;
    if (cd > 0) o.zapCooldown.set(d.uid, cd - 1);
    if (!ex || !was || inside || d.assistMode || STUN_STATES.has(d.state) || cd > 0 || d.invulnTo("strike")) continue;
    o.zapCooldown.set(d.uid, 45);
    const dir = Math.sign(d.x - o.x) || o.facing;
    const props = contactProps(`${o.look}_exit`, { damage: ex.damage ?? 30, hitstun: ex.hitstun ?? 12, level: "unblockable", knockback: { x: 60 }, chip: 0 });
    match.applyContact(o.owner, d, props, { x: d.x, y: d.y - 90 }, { projectile: { x: o.x, vx: 0 }, dir });
    ctx.effect("zone_zap", d.x, d.y - 90, { side: o.side, life: 20, look: o.look, palette: o.owner.def.palette });
  }
  if (o.spec.blockProjectiles) {
    const l = o.x - o.w / 2;
    const r = o.x + o.w / 2;
    for (const p of match.projectiles) {
      if (p.dead || p.side === o.side || p.y < -o.h) continue;
      const prev = p.x - p.vx * DT;
      const crossed = (prev < l) !== (p.x < l) || (prev > r) !== (p.x > r);
      if (!crossed) continue;
      p.dead = true;
      ctx.effect("zone_block", p.x, p.y, { side: o.side, life: 18, look: o.look, palette: o.owner.def.palette });
      match.vfx("projectile_fizzle", p.x, p.y, { facing: p.facing, side: p.side, vfx: p.vfx });
    }
  }
}