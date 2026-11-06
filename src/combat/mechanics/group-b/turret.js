import { currentMove, fireOnce } from "../core.js";
import { registerSystem } from "../../mechanics.js";
import { drawObjectEntity } from "./draw.js";
import { clampX, objectsOf, strikeObject, towardSign } from "./util.js";

/**
 * A stationary turret with HP (Jensen's AI Factory). It fires a token projectile toward the
 * opponent every `interval` frames and can be destroyed by enemy strikes and projectiles.
 *
 * Move data: `mech: { turret: { offset, lifetime, hp, interval, firstShot, shots, max, token } }`,
 * where `token` is projectile data (speed, damage, hitbox, ...). Tokens are owned by the turret,
 * so they don't count as the owner's projectile on screen.
 */
export const TURRET_HEIGHT = 168;

const TOKEN = { speed: 330, damage: 25, chip: 3, hitstun: 16, blockstun: 12, hitstop: 7, knockback: { x: 140 }, lifetime: 240, hitbox: { x: -15, y: -15, w: 30, h: 30 }, meterGain: 3, vfx: "projectile_token", scale: 0.55 };

export function turretsOf(match, owner) {
  return objectsOf(match, "turret", owner);
}

export function turretBox(t) {
  return { x: t.x - 30, y: -TURRET_HEIGHT, w: 60, h: TURRET_HEIGHT };
}

function fire(ctx, t) {
  const match = ctx.match;
  const enemy = match.point(1 - t.side);
  const dir = enemy ? towardSign(t.x, enemy.x, t.facing) : t.facing;
  t.facing = dir;
  const raw = { ...TOKEN, ...(t.spec.token || {}), moveId: t.moveId };
  for (const y of t.shots >= 2 ? [-150, -64] : [-112]) {
    const p = ctx.spawnRaw(t.owner, raw, { x: t.x + dir * 30, y, vx: dir * raw.speed, facing: dir });
    p.ownerUid = t.uid;
    p.damageMul = t.damageMul;
  }
  match.vfx("special_cast", t.x + dir * 30, -112, { facing: dir, side: t.side, vfx: "turret_fire", palette: t.owner.def.palette });
}

const turretModule = {

  update(ctx) {
    const match = ctx.match;
    for (const f of match.fighters) {
      const m = currentMove(f);
      const spec = m?.mech?.turret;
      if (!spec || f.moveFrame < m.startup || !fireOnce(f, "turret")) continue;
      const mine = turretsOf(match, f);
      while (mine.length >= (spec.max ?? 1)) mine.shift().dead = true;
      const t = ctx.addObject({
        type: "turret",
        look: "server_rack",
        owner: f,
        ownerUid: f.uid,
        ownerId: f.id,
        side: f.side,
        facing: f.facing,
        moveId: m.id,
        x: clampX(match, f.x + f.facing * (spec.offset ?? 80), 40),
        y: 0,
        w: 60,
        h: TURRET_HEIGHT,
        hp: spec.hp ?? 150,
        maxHp: spec.hp ?? 150,
        life: spec.lifetime ?? 300,
        maxLife: spec.lifetime ?? 300,
        interval: spec.interval ?? 60,
        timer: spec.firstShot ?? 30,
        shots: spec.shots ?? 1,
        damageMul: f.damageMul ?? 1,
        spec,
      });
      t.uid = `turret:${t.id}`;
      drawObjectEntity(match, t);
      match.emit("placed", { fighter: f.id, side: f.side, kind: "turret", x: t.x });
    }
    if (match.phase !== "fight") return;
    for (const t of ctx.objects) {
      if (t.dead || t.type !== "turret" || t.born === match.frame) continue;
      if (t.owner.ko || --t.life <= 0) {
        t.dead = true;
        ctx.effect("placed_fade", t.x, -60, { side: t.side, life: 16, look: t.look });
        continue;
      }
      strikeObject(match, t, turretBox(t), (damage, x, y, by) => {
        t.hp -= damage;
        match.vfx("hit_light", x, y, { facing: by ? towardSign(by.x, t.x) : 1, side: by?.side ?? 1 - t.side, damage });
        if (t.hp <= 0 && !t.dead) {
          t.dead = true;
          match.emit("turretDestroyed", { fighter: t.ownerId, side: t.side, by: by?.id ?? null });
          match.vfx("barrier_break", t.x, -64, { facing: t.facing, side: t.side });
        }
      });
      if (t.dead) continue;
      if (--t.timer <= 0) {
        t.timer = t.interval;
        fire(ctx, t);
      }
    }
  },

  snapshot(ctx, out) {
    out.turrets = ctx.objects.filter((o) => o.type === "turret" && !o.dead).map((t) => ({ id: t.id, side: t.side, owner: t.ownerId, x: Math.round(t.x), hp: t.hp, maxHp: t.maxHp, shots: t.shots }));
  },
};

registerSystem("group-b-turret", turretModule, { order: 112 });
