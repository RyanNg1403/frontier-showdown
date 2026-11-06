import { toWorld } from "../boxes.js";
import { boxesOverlap, currentMove, fighterData, fireOnce, mechMove } from "./core.js";

/**
 * Strike extensions, configured with `mech` on a move:
 *
 * - `hitLevels: [...]` gives each hit of a multi-hit move its own guard level, and
 *   `hitboxes: [...]` its own box (Group Relative Strike's high, mid and low shadows).
 * - `followUp: { ...move }` starts an inline follow-up move right after the active frames
 *   when any hit of the move landed clean (the "reinforced" fourth strike).
 * - `wallBounce: true` makes the final hit bounce the victim off the wall once (Rubik's
 *   Rotation Scale Up).
 * - `prune: true` removes the first enemy projectile, placed object or barrier the move's
 *   hitbox touches (Optimal Brain Damage).
 */
export const strikesModule = {
  name: "strikes",

  beforeContact(ctx, a, d, props, at, info) {
    const levels = info.move?.mech?.hitLevels;
    if (levels && !info.projectile) props.level = levels[Math.min(info.idx ?? 0, levels.length - 1)];
    return false;
  },

  onHit(ctx, a, d, props, info) {
    const mech = info.move?.mech;
    if (!mech || info.projectile) return;
    if (mech.followUp && a.move === info.move) fighterData(a).flags.reinforced = a.hitLog;
    if (mech.wallBounce && info.idx === info.move.hits - 1) fighterData(d).flags.wallBounce = true;
  },

  update(ctx) {
    const match = ctx.match;
    for (const f of match.allFighters) {
      const m = currentMove(f);
      const mech = m?.mech;
      if (mech?.followUp && f.moveFrame >= m.startup + m.active && f.hitstop === 0) {
        const data = fighterData(f);
        if (data.flags.reinforced === f.hitLog && fireOnce(f, "followUp")) {
          data.flags.reinforced = null;
          f.startMove(mechMove(`${m.id}_followup`, mech.followUp), { ...match.envFor(f), input: null });
          ctx.effect("reinforce", f.x + f.facing * 60, f.y - 120, { side: f.side, life: 20, palette: f.def.palette });
          continue;
        }
      }
      if (mech?.prune && f.activeHitIndex() >= 0) prune(ctx, f);
      const flags = fighterData(f).flags;
      if (flags.wallBounce) {
        if (f.state !== "juggle") {
          flags.wallBounce = false;
        } else if (match.atWall(f) && f.hitstop === 0) {
          const wallDir = f.x < (match.bounds.left + match.bounds.right) / 2 ? -1 : 1;
          if (Math.sign(f.vx) === wallDir || Math.abs(f.vx) < 1) {
            flags.wallBounce = false;
            f.vx = -wallDir * Math.max(180, Math.abs(f.vx) * 0.6);
            f.vy = Math.min(f.vy, -640);
            match.shakeFrames = Math.max(match.shakeFrames, 6);
            match.emit("wallBounce", { fighter: f.id, side: f.side });
            match.vfx("knockdown_impact", f.x + wallDir * 30, f.y - 80, { facing: -wallDir, side: f.side });
            ctx.effect("wall_bounce", f.x + wallDir * 30, f.y - 80, { side: f.side, life: 18 });
          }
        }
      }
    }
  },
};

function prune(ctx, f) {
  const match = ctx.match;
  const boxes = f.hitboxes();
  if (!boxes.length) return;
  const touches = (b) => boxes.some((h) => boxesOverlap(h, b));
  const proj = match.projectiles.find((p) => !p.dead && p.side !== f.side && touches(toWorld(p.def.hitbox, p.x, p.y, p.facing)));
  const obj = proj ? null : ctx.objects.find((o) => !o.dead && o.side !== f.side && touches(objectBox(o)));
  const wall = proj || obj ? null : match.barriers.find((w) => !w.dead && w.side !== f.side && touches(match.barrierBox(w)));
  if (!(proj || obj || wall) || !fireOnce(f, "prune")) return;
  let x;
  let y;
  if (proj) {
    proj.dead = true;
    x = proj.x;
    y = proj.y;
  } else if (obj) {
    obj.dead = true;
    x = obj.x;
    y = obj.type === "companion" ? obj.y : -30;
  } else {
    match.breakBarrier(wall);
    x = wall.x;
    y = -wall.h / 2;
  }
  match.emit("prune", { fighter: f.id, side: f.side, x, y });
  ctx.effect("prune", x, y, { side: f.side, life: 22, palette: f.def.palette });
}

function objectBox(o) {
  if (o.type === "companion") return { x: o.x - 24, y: o.y - 24, w: 48, h: 48 };
  return { x: o.x - o.w / 2, y: -Math.min(o.h, 70), w: o.w, h: Math.min(o.h, 70) };
}
