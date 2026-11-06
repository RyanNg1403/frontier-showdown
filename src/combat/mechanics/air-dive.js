import { DT, PHYS } from "../constants.js";
import { registerMechanic, registerSystem } from "../mechanics.js";

/**
 * Air dives with a ground bounce (roster doc group A, Elon's "The Walrus", an `airOnly` special).
 *
 * The "ground-bounce" move hook slams a launched victim into the floor at `slam` px/s; the
 * "ground-bounce" system bounces them back up at `bounce` px/s just before they land. One
 * ground bounce per combo (doc 2.5). The fighter-level "air-dive" mechanic swaps the dive's
 * landing recovery for `mechanicData.landingRecoveryOnHit` after it connected.
 */

registerMechanic("air-dive", {
  update(f) {
    if (f.state !== "jump_land" || f.mech.diveLanding == null) return;
    f.landingRecovery = f.mech.diveLanding;
    f.mech.diveLanding = null;
  },
});

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
    f.mech.diveLanding = null;
  },
  onHit({ match, attacker, defender, props, blocked }) {
    const data = attacker.state === "attack" && attacker.move?.id === props.id ? attacker.move.mechanicData : null;
    if (blocked || !data) return;
    attacker.mech.diveLanding = data.landingRecoveryOnHit ?? null;
    if (data.groundBounce) applyGroundBounce(match.mech.ctx, defender, data.groundBounce);
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
