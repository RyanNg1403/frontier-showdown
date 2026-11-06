import { DT } from "../constants.js";

/**
 * Projectile behaviours, configured with `projectile.mech` in move data:
 *
 * - `split: { after, vys, speed?, damage?, hitbox?, levels?, look? }` splits into one child per
 *   entry of `vys` (vertical speed, px/s) after `after` frames of flight (Tokenizer).
 * - `stack: [{ dy, level?, damage? }]` spawns extra copies offset vertically (Convolution Scale Up).
 * - `echo: { delay, count? }` re-fires the projectile from the same spot `delay` frames later
 *   (The Coming Wave Scale Up, Latent Attention Scale Up).
 * - `grow: { distance, damage, scale }` ramps damage and hitbox from the base values up to
 *   `damage` and `scale`x over `distance` px travelled (The Coming Wave).
 * - `floor: y` keeps a projectile from sinking below `y` (ground-hugging tokens and waves).
 * - `loop: n` turns the projectile around and sends it climbing again `n` times when it dives
 *   to the floor (RC Air Strike Scale Up).
 * - `home: accel` steers toward the nearest enemy at `accel` px/s² (cherry Scale Up).
 * - `spawnAt: "opponent"` with `y` drops the projectile over the opponent instead of in front
 *   of the owner (supers that strike from above or below).
 * - `burst: scale` draws a decompression burst on contact (Latent Attention).
 * - `look` is a render hint for the engine's mechanics renderer.
 */
export const projectilesModule = {
  name: "projectiles",

  onSpawnProjectile(ctx, owner, move, projs) {
    const match = ctx.match;
    const extra = [];
    for (const p of projs) {
      const mech = p.def.mech;
      p.x0 = p.x;
      p.fromGround = !owner.airborne;
      p.baseDamageMul = p.damageMul;
      if (!mech) continue;
      if (mech.spawnAt === "opponent") {
        const opp = match.point(1 - owner.side);
        p.x = opp.x + (mech.dx ?? 0) * owner.facing;
        p.y = mech.y ?? -120;
        p.x0 = p.x;
      }
      if (mech.loop) p.loopsLeft = mech.loop;
      for (const s of mech.stack || []) {
        const def = Object.freeze({ ...p.def, damage: s.damage ?? p.def.damage, level: s.level || p.def.level, mech: { ...mech, stack: null, echo: null } });
        const copy = cloneProjectile(match, p, { def, y: p.y + s.dy });
        extra.push(copy);
      }
      if (mech.echo) {
        const count = mech.echo.count ?? 1;
        for (let i = 1; i <= count; i += 1) {
          const def = Object.freeze({ ...p.def, mech: { ...mech, echo: null } });
          const at = { x: p.x, y: p.y };
          ctx.schedule(mech.echo.delay * i, () => {
            if (match.phase !== "fight") return;
            const copy = cloneProjectile(match, p, { def, x: at.x, y: at.y });
            match.projectiles.push(copy);
            ctx.effect("echo", at.x, at.y, { side: p.side, life: 12 });
          });
        }
      }
    }
    for (const c of extra) match.projectiles.push(c);
  },

  /** Runs after the engine moves a projectile. Returns true when it handled (removed) it. */
  projectileTick(ctx, p) {
    const mech = p.def.mech;
    if (!mech) return false;
    const match = ctx.match;
    if (mech.split && p.age >= mech.split.after) {
      splitProjectile(ctx, p, mech.split);
      return true;
    }
    if (mech.grow) {
      const g = mech.grow;
      p.growBase ??= p.def;
      const t = Math.min(1, Math.abs(p.x - p.x0) / g.distance);
      p.damageMul = (p.baseDamageMul ?? 1) * (1 + ((g.damage ?? p.growBase.damage) / p.growBase.damage - 1) * t);
      const s = 1 + ((g.scale ?? 1) - 1) * t;
      const hb = p.growBase.hitbox;
      p.growT = t;
      const w = hb.w * s;
      const h = hb.h * s;
      p.def = Object.freeze({ ...p.growBase, hitbox: { x: hb.x - (w - hb.w) / 2, y: hb.y + hb.h - h, w, h }, scale: (p.growBase.scale ?? 1) * s });
    }
    if (mech.home) {
      const target = nearestEnemy(match, p);
      if (target) {
        const dx = target.x - p.x;
        const speed = Math.max(Math.abs(p.def.speed), 200);
        p.vx = Math.max(-speed, Math.min(speed, p.vx + Math.sign(dx) * mech.home * DT));
        if (Math.abs(dx) > 4) p.facing = Math.sign(p.vx) || p.facing;
      }
    }
    if (mech.loop !== undefined && p.loopsLeft > 0 && p.vy > 0 && p.y > -70) {
      p.loopsLeft -= 1;
      p.vy = -Math.abs(p.vy) * 0.95;
      p.vx = -p.vx;
      p.facing = -p.facing;
      p.lastHit.clear();
      ctx.effect("loop", p.x, p.y, { side: p.side, life: 18 });
    }
    if (mech.floor !== undefined && p.y > mech.floor) {
      p.y = mech.floor;
      p.vy = 0;
    }
    return false;
  },

  beforeContact(ctx, a, d, props, at, info) {
    const burst = info.projectile?.def?.mech?.burst;
    if (burst) ctx.effect("burst", at.x, at.y, { side: a.side, life: 20, scale: burst, palette: a.def.palette });
    return false;
  },
};

function cloneProjectile(match, p, over) {
  return {
    ...p,
    id: match.nextProjectileId++,
    age: over.age ?? 0,
    hits: 0,
    lastHit: new Map(),
    dead: false,
    hitstop: 0,
    growBase: null,
    ...over,
    x0: over.x ?? p.x,
  };
}

function splitProjectile(ctx, p, s) {
  const match = ctx.match;
  p.dead = true;
  ctx.effect("split", p.x, p.y, { side: p.side, life: 14, palette: p.palette });
  const speed = s.speed ?? Math.abs(p.vx);
  s.vys.forEach((vy, i) => {
    const def = Object.freeze({
      ...p.def,
      damage: s.damage ?? p.def.damage,
      chip: s.chip ?? p.def.chip,
      hitbox: s.hitbox || p.def.hitbox,
      level: s.levels?.[i] || p.def.level,
      lifetime: s.lifetime ?? Math.max(30, p.def.lifetime - p.age),
      scale: s.scale ?? p.def.scale,
      mech: { look: s.look || "token", floor: s.floor ?? -18, token: i },
    });
    match.projectiles.push(cloneProjectile(match, p, { def, vx: p.facing * speed, vy, x: p.x, y: p.y }));
  });
}

function nearestEnemy(match, p) {
  let best = null;
  for (const f of match.fighters) {
    if (f.side === p.side || f.ko) continue;
    if (!best || Math.abs(f.x - p.x) < Math.abs(best.x - p.x)) best = f;
  }
  return best;
}
