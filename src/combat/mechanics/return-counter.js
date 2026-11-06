import { registerMechanic } from "../mechanics.js";
import { bodyCenter, propsFor, strikeFrom } from "./targeting.js";

/**
 * Damage-return counter (Geoffrey's Backpropagation), an incoming-hit (`beforeHurt`) move mechanic.
 *
 * Move data: `mechanic: "return-counter"`, `mechanicData: { from, to, levels, projectiles, base,
 * ratio, lock, recovery, returnProjectile }`. During move frames `from..to`, a strike of a listed
 * level is absorbed and its "error" flows back to the attacker as an unblockable hit of
 * max(`base`, `ratio` x the incoming damage). With `projectiles`, a projectile (or a mechanic's
 * ranged hit) is returned as a silver spark of the same strength. Throws never reach this hook.
 */
registerMechanic("return-counter", {
  beforeHurt(d, hurt) {
    const m = d.move;
    const cfg = m?.mechanicData;
    const { match, attacker: a, props, projectile, level, at } = hurt;
    if (!cfg || d.moveFrame < cfg.from || d.moveFrame > cfg.to || a === d) return false;
    if (props.level === "unblockable") return false;
    if (projectile ? !cfg.projectiles : !cfg.levels.includes(level)) return false;

    const amount = Math.max(cfg.base ?? 120, Math.round(props.damage * (cfg.ratio ?? 1.2)));
    if (projectile) {
      if (!projectile.mechanic) projectile.dead = true;
      const src = projectile.owner || a;
      d.facing = Math.sign(src.x - d.x) || d.facing;
      const raw = cfg.returnProjectile || {};
      const p = match.mech.ctx.spawnRaw(d, { ...raw, damage: amount, chip: Math.round(amount * 0.12), moveId: m.id, mech: { look: "spark" } }, {
        x: d.x + d.facing * 60, y: d.y - 150, vx: d.facing * (raw.speed ?? 640), facing: d.facing,
      });
      p.category = m.category;
    } else {
      a.parriedFrame = match.frame;
      a.pendingMove = null;
      a.combo = { hits: 0, damage: 0 };
      a.setState("hitstun", { keepAnim: true });
      a.stun = cfg.lock ?? 24;
      a.stunAnim = "hit_high";
      a.setAnim("hit_high", true);
      a.vx = 0;
      d.faceToward(a);
      const back = propsFor(m.id, { damage: amount, level: "unblockable", hitstun: 30, hitstop: 14, knockdown: true, knockback: { x: 320, y: 620 }, juggle: 0, meterGain: 10, chip: 0 }, m.category);
      strikeFrom(match, d, a, back, bodyCenter(a), { fromX: d.x, move: m });
      d.hitstop = Math.max(d.hitstop, a.hitstop);
    }
    d.connected = true;
    d.moveFrame = Math.max(d.moveFrame, m.total - (cfg.recovery ?? 14));
    match.mech.ctx.effect("backprop_lines", d.x + d.facing * 30, d.y - 160, { x1: a.x, y1: a.y - 110, side: d.side, life: 26 });
    match.emit("returnCounter", { fighter: d.id, side: d.side, attacker: a.id, damage: amount, projectile: Boolean(projectile) });
    match.vfx("parry", at.x, at.y, { facing: d.facing, side: d.side, level: 1 });
    return true;
  },
});
