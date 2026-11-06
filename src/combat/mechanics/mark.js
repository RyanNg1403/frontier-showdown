import { registerMechanic, registerSystem } from "../mechanics.js";
import { fighterData } from "./core.js";

/**
 * "Mark: feature identified" debuff (Chris's Feature Visualization), kept as a status.
 *
 * Data: `projectile.mech.mark: { frames, mul }` on the projectile (or `mechanicData.mark` on a
 * strike). The `mark` system multiplies damage taken by a Marked fighter by `mul` and tags the
 * contact with its source config; the attacker's fighter mechanic (`mechanics: ["mark"]`)
 * applies the status in `onHit`, which runs only when a hit or block actually landed, so an
 * absorbed or countered source does not mark. Re-applying refreshes the timer.
 */
export function isMarked(mech, f) {
  return Boolean(mech.status(f, "mark"));
}

registerSystem("mark", {
  beforeContact(ctx, a, d, props, at, info) {
    const active = ctx.status(d, "mark");
    if (active) props.damage *= active.mul ?? 1.12;
    const cfg = info.projectile ? info.projectile.def?.mech?.mark : info.move?.mechanicData?.mark;
    if (cfg && d.side !== a.side) props.markCfg = cfg;
    return false;
  },
}, { order: 150 });

registerMechanic("mark", {
  onHit({ match, attacker, defender, props }) {
    const cfg = props.markCfg;
    if (!cfg) return;
    const fresh = !fighterData(defender).status.mark;
    match.mech.ctx.addStatus(defender, "mark", { frames: cfg.frames ?? 240, mul: cfg.mul ?? 1.12, by: attacker.side });
    match.emit("mark", { fighter: defender.id, side: defender.side, by: attacker.id, frames: cfg.frames ?? 240, fresh });
  },
});
