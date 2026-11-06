import { matchMotion } from "../../input.js";
import { registerSystem } from "../../mechanics.js";
import { contactProps } from "../core.js";
import { burst, controlInput, selfControlled } from "./util.js";

/**
 * Projectile extensions, configured with `projectile.mech` (drops from above reuse the
 * registry's `spawnAt: "opponent"`):
 * - `single: { detonate: {damage, radius, ...} }` one instance: repeating the special's motion
 *   while it is out detonates it in place (Ilya's Peak Data).
 * - `shatter: { count, damage }` breaks into arcing shards when it connects, is blocked,
 *   clashes or lands (Jensen's Scale Up GPU board).
 */
const SHARD = { speed: 0, hitbox: { x: -14, y: -14, w: 28, h: 28 }, lifetime: 90, chip: 3, hitstun: 16, blockstun: 12, hitstop: 6, knockback: { x: 160 }, gravity: 1500, meterGain: 2, vfx: "projectile_shard", scale: 0.4 };

function detonate(ctx, f, p, cfg) {
  const match = ctx.match;
  p.dead = true;
  const r = cfg.radius ?? 90;
  const props = contactProps(p.moveId, { damage: (cfg.damage ?? 40) * (p.damageMul ?? 1), hitstun: cfg.hitstun ?? 22, blockstun: cfg.blockstun ?? 14, knockback: cfg.knockback ?? { x: 200, y: 380 }, juggle: 2 });
  burst(match, f, f.side, { x: p.x - r, y: p.y - r, w: r * 2, h: r * 2 }, props, p.x);
  ctx.effect("orb_detonate", p.x, p.y, { side: p.side, life: 22, radius: r, palette: p.palette });
  match.emit("detonate", { fighter: f.id, side: f.side, moveId: p.moveId, x: p.x, y: p.y });
}

function shatter(ctx, p) {
  const cfg = p.def.mech.shatter;
  const n = cfg.count ?? 3;
  for (let i = 0; i < n; i += 1) {
    const s = ctx.spawnRaw(p.owner, { ...SHARD, damage: cfg.damage ?? 22, moveId: p.moveId }, { x: p.x - p.facing * 30, y: Math.min(p.y, -30), vx: p.facing * (140 + i * 150), vy: -520 - (i % 2) * 140, facing: p.facing });
    s.ownerUid = `${p.ownerUid}:shard`;
    s.damageMul = p.damageMul;
  }
  ctx.effect("split", p.x, p.y, { side: p.side, life: 14, palette: p.palette });
}

const orbsModule = {

  reset(ctx) {
    ctx.state.shatter = new Set();
  },

  onSpawnProjectile(ctx, owner, move, projs) {
    ctx.state.shatter ??= new Set();
    for (const p of projs) if (p.def.mech?.shatter) ctx.state.shatter.add(p);
  },

  preStep(ctx) {
    const match = ctx.match;
    if (match.phase !== "fight") return;
    for (const s of match.sides) {
      const f = s.members[s.active];
      const input = controlInput(match, f);
      if (!input || !(selfControlled(f) || f.state === "attack")) continue;
      const p = match.projectiles.find((q) => q.ownerUid === f.uid && !q.dead && q.def.mech?.single);
      const sp = p && f.def.specials.find((x) => x.id === p.moveId);
      if (!sp || matchMotion(input, sp.motion, f.facing) < 0) continue;
      input.consume();
      detonate(ctx, f, p, p.def.mech.single.detonate || {});
    }
  },

  update(ctx) {
    const match = ctx.match;
    for (const p of ctx.state.shatter || []) {
      if (!p.dead && match.projectiles.includes(p)) continue;
      ctx.state.shatter.delete(p);
      const inside = p.x > match.bounds.left - 20 && p.x < match.bounds.right + 20 && p.age <= p.def.lifetime;
      if (inside && match.phase === "fight") shatter(ctx, p);
    }
  },
};

registerSystem("group-b-orbs", orbsModule, { order: 113 });
