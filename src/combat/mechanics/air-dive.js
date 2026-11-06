import { BTN, DT, PHYS, RULES } from "../constants.js";
import { isDown } from "../input.js";
import { registerMechanic, registerSystem } from "../mechanics.js";

/**
 * Air dives with a ground bounce (roster doc group A, Elon's "The Walrus").
 *
 * `registerAirDive(name, move)` registers a fighter-level mechanic that starts `move` when the
 * fighter presses down+HP during a jump (a jumping command normal). The dive's
 * `mechanicData.landingRecoveryOnHit` replaces its landing recovery after it connected.
 *
 * The "ground-bounce" move hook slams a launched victim into the floor at `slam` px/s; the
 * "ground-bounce" system bounces them back up at `bounce` px/s just before they land. One
 * ground bounce per combo (doc 2.5).
 */

export function registerAirDive(name, move) {
  registerMechanic(name, {
    update(f, env) {
      const b = env.input;
      if (f.state === "jump_land" && f.mech.diveHit) {
        f.mech.diveHit = false;
        f.landingRecovery = move.mechanicData?.landingRecoveryOnHit ?? f.landingRecovery;
      }
      if (f.state !== "jump" || f.airAttackUsed || !env.canAct || !b) return;
      if (!b.findPress(BTN.HP, RULES.bufferFrames) || !isDown(b.dir(f.facing))) return;
      f.startMove(move, env);
      f.moveFrame = 0;
    },
  });
}

function bounces(ctx) {
  return (ctx.state.groundBounces ??= new Map());
}

/** Queue a bounce for a juggled victim. `ctx` is the systems runtime (`match.mech.ctx`). */
export function applyGroundBounce(ctx, d, data) {
  if (d.state !== "juggle" || d.combo.bounced) return false;
  d.combo.bounced = true;
  d.vy = Math.max(d.vy, data.slam ?? 900);
  d.y = Math.min(d.y, -2);
  bounces(ctx).set(d, data.bounce ?? 760);
  return true;
}

registerMechanic("ground-bounce", {
  onStart(f) {
    f.mech.diveHit = false;
  },
  onHit({ match, attacker, defender, props, blocked }) {
    if (blocked) return;
    attacker.mech.diveHit = true;
    const data = attacker.state === "attack" && attacker.move?.id === props.id ? attacker.move.mechanicData : null;
    if (data?.groundBounce) applyGroundBounce(match.mech.ctx, defender, data.groundBounce);
  },
});

registerSystem("ground-bounce", {
  reset(ctx) {
    bounces(ctx).clear();
  },
  /** Before fighters move: a victim that would land this frame bounces instead. */
  preStep(ctx) {
    for (const [d, bounce] of bounces(ctx)) {
      if (d.state !== "juggle") {
        bounces(ctx).delete(d);
        continue;
      }
      const w = d.def.stats.weight || 1;
      if (d.hitstop > 0 || d.vy <= 0 || d.y + (d.vy + PHYS.gravity * w * DT) * DT < -1) continue;
      bounces(ctx).delete(d);
      d.vy = -bounce / Math.sqrt(w);
      d.vx *= 0.6;
      d.y = -1;
      ctx.match.vfx("knockdown_impact", d.x, 0, { facing: d.facing, side: d.side, bounce: true });
      ctx.match.shakeFrames = Math.max(ctx.match.shakeFrames, 5);
    }
  },
}, { order: 110 });
