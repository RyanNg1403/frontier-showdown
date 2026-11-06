import { addMeter } from "../rules.js";
import { currentMove, mechMove } from "./core.js";

/**
 * Meter parry (Liang's Aha Moment).
 *
 * Move data: `mech: { parry: { from, to, meter, advantage, projectiles, levels?, followUp? } }`.
 * A strike (any level unless `levels` narrows it) or, with `projectiles`, a projectile that
 * touches the fighter between move frames `from` and `to` is absorbed: the parrier gains
 * `meter` Compute and returns to neutral at once, and a striking attacker is locked for
 * `advantage` frames. `followUp` (the Scale Up version) is an inline move started right away.
 * Unlike the engine's counter stance, nothing happens on a whiff and throws still beat it.
 */
export const meterParryModule = {
  name: "meter-parry",

  beforeContact(ctx, a, d, props, at, info) {
    const m = currentMove(d);
    const p = m?.mech?.parry;
    if (!p || d.moveFrame < p.from || d.moveFrame > p.to) return false;
    if (props.level === "unblockable") return false;
    if (info.projectile && !p.projectiles) return false;
    if (p.levels && !p.levels.includes(props.level)) return false;
    const match = ctx.match;
    const ds = match.sides[d.side];
    addMeter(ds, p.meter ?? 25);
    if (info.projectile) {
      info.projectile.dead = true;
    } else if (a.canFight) {
      a.parriedFrame = match.frame;
      a.pendingMove = null;
      a.setState("hitstun", { keepAnim: true });
      a.stun = p.advantage ?? 12;
      a.stunAnim = "hit_high";
      a.setAnim("hit_high", true);
      a.vx = 0;
      a.combo = { hits: 0, damage: 0 };
      a.hitstop = 10;
    }
    d.faceToward(info.projectile ? { x: info.projectile.x } : a);
    d.hitstop = 10;
    d.vx = 0;
    if (p.followUp) {
      d.startMove(mechMove(`${m.id}_followup`, p.followUp), { ...match.envFor(d), input: null });
    } else {
      d.setState("idle");
    }
    match.emit("parry", { fighter: d.id, side: d.side, attacker: a.id, level: 0, moveId: m.id, meter: p.meter ?? 25, projectile: Boolean(info.projectile) });
    match.vfx("parry", at.x, at.y, { facing: d.facing, side: d.side, level: 0, palette: d.def.palette });
    ctx.effect("aha", at.x, at.y - 30, { side: d.side, fighter: d.id, life: 36, palette: d.def.palette });
    return true;
  },
};
