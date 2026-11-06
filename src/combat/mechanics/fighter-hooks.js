import { registerSystem, moveMechanic } from "../mechanics.js";

/**
 * Bridges the match-level `beforeContact` system hook to per-fighter mechanics:
 * `beforeHurt(defender, ctx)` on the defender's current move mechanic and on each
 * fighter-level mechanic. Return true to absorb the contact; edit `ctx.props` to rewrite it.
 */
registerSystem("fighter-hooks", {
  beforeContact(mech, a, d, props, at, info) {
    const hurt = { match: mech.match, attacker: a, defender: d, props, projectile: info.projectile ?? null, level: info.level ?? props.level, at, dir: info.dir };
    const move = d.state === "attack" ? d.move : null;
    if (moveMechanic(move)?.beforeHurt?.(d, hurt)) return true;
    return d.mechanicHooks.some((h) => h.beforeHurt?.(d, hurt));
  },
}, { order: 80 });
