import { registerMechanic, registerSystem } from "../mechanics.js";
import { fireOnce } from "./core.js";
import { bodyCenter, clamp } from "./targeting.js";

/**
 * Drifting stochastic projectile (Geoffrey's Boltzmann Machine).
 *
 * Move data: `mechanic: "drift-cloud"`, `mechanicData: { frame, max, settleAt, drift, wander,
 * homing, damage, offset, settleNow, projectile }`. On move frame `frame` a slow cloud is
 * released. Until `settleAt` frames of age it wanders on a seeded path that is deterministic per
 * frame (hash noise of the projectile id and its age, no shared RNG); then it "settles to low
 * energy" and homes onto the opponent's body at `homing` px/s. At most `max` per owner (a new one
 * retires the oldest). `settleNow` (Scale Up) releases it over the opponent, already settling.
 * The steering is a system (`projectileTick`), so clouds keep drifting after the move ends.
 */
const MIN_Y = -280;
const MAX_Y = -70;

/** Deterministic hash noise in [0, 1) from integer inputs. */
export function hash01(a, b = 0, c = 0) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (b | 0) ^ (h >>> 13), 0xc2b2ae35);
  h = Math.imul(h ^ (c | 0) ^ (h >>> 16), 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Smooth value noise in [-1, 1]: knots every `period` frames, cosine-interpolated. */
export function smoothNoise(seed, channel, t, period = 20) {
  const k = Math.floor(t / period);
  const u = (t - k * period) / period;
  const a = hash01(seed, channel, k) * 2 - 1;
  const b = hash01(seed, channel, k + 1) * 2 - 1;
  const w = (1 - Math.cos(u * Math.PI)) / 2;
  return a + (b - a) * w;
}

/** Velocity (px/s) a cloud wants this frame. */
export function cloudVelocity(p, opp) {
  const c = p.cloud;
  if (p.age >= c.settleAt && opp) {
    const target = bodyCenter(opp);
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = Math.min(c.homing, len * 60);
    return { vx: (dx / len) * speed, vy: (dy / len) * speed };
  }
  const vx = p.facing * c.drift + smoothNoise(c.seed, 1, p.age) * c.wander;
  let vy = smoothNoise(c.seed, 2, p.age, 26) * c.wander * 0.7;
  if (p.y < MIN_Y + 20) vy = Math.abs(vy) + 20;
  if (p.y > MAX_Y - 20) vy = -Math.abs(vy) - 20;
  return { vx, vy };
}

registerMechanic("drift-cloud", {
  onFrame(f, move, env) {
    const cfg = move.mechanicData;
    if (f.moveFrame < cfg.frame || !fireOnce(f, "drift-cloud")) return;
    const match = env.match;
    const mine = match.projectiles.filter((p) => p.cloud && p.ownerUid === f.uid && !p.dead);
    for (let i = 0; i <= mine.length - (cfg.max ?? 2); i += 1) {
      mine[i].dead = true;
      match.vfx("projectile_fizzle", mine[i].x, mine[i].y, { facing: mine[i].facing, side: f.side });
    }
    const opp = env.opponent;
    const off = cfg.offset || { x: 70, y: -150 };
    const at = { x: f.x + f.facing * off.x, y: f.y + off.y, vx: 0, vy: 0, facing: f.facing };
    if (cfg.settleNow && opp) {
      at.x = clamp(opp.x, match.bounds.left, match.bounds.right);
      at.y = MIN_Y;
    }
    const p = match.mech.ctx.spawnRaw(f, { ...(cfg.projectile || {}), damage: cfg.damage ?? 18, moveId: move.id, mech: { look: "cloud" } }, at);
    p.cloud = {
      seed: p.id * 7919 + f.side,
      settleAt: cfg.settleNow ? 0 : cfg.settleAt ?? 70,
      drift: cfg.drift ?? 90,
      wander: cfg.wander ?? 90,
      homing: cfg.homing ?? 330,
    };
  },
});

registerSystem("drift-cloud", {
  /** Steers after the engine moved the cloud; the new velocity applies next frame. */
  projectileTick(ctx, p) {
    if (!p.cloud) return false;
    const v = cloudVelocity(p, ctx.match.point(1 - p.side));
    p.vx = v.vx;
    p.vy = v.vy;
    if (Math.abs(v.vx) > 1) p.facing = Math.sign(v.vx);
    return false;
  },
}, { order: 110 });
