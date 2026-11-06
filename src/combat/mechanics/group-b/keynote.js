import { registerSystem } from "../../mechanics.js";
import { RULES } from "../../constants.js";
import { currentMove, fighterData, fireOnce } from "../core.js";

/**
 * `mech.keynote: { perBar }` on a super: +`perBar` damage for each full Compute bar banked when
 * it starts (Jensen's Vera Rubin Keynote). The bank is read before the engine spends the meter.
 */
const keynoteModule = {
  preStep(ctx) {
    for (const s of ctx.match.sides) {
      for (const f of s.members) fighterData(f).flags.barsBanked = Math.floor(s.meter / RULES.meterBar);
    }
  },

  update(ctx) {
    for (const f of ctx.match.fighters) {
      const m = currentMove(f);
      if (m?.mech?.keynote && fireOnce(f, "keynote")) f.damageMul *= 1 + (m.mech.keynote.perBar ?? 0.1) * (fighterData(f).flags.barsBanked ?? 0);
    }
  },
};

registerSystem("group-b-keynote", keynoteModule, { order: 117 });
