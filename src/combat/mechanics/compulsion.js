import { registerSystem } from "../mechanics.js";
import { fighterData } from "./core.js";

/**
 * Compulsion pull (Chris's Golden Gate), the `obsessed` status.
 *
 * The bridge itself is a core `placed` trap (`mech: { place: { type: "trap", look: "golden_gate",
 * trigger: { damage, level, status: { obsessed: { frames, speed } } } } }`). When it springs the
 * victim gets `obsessed`; this system finds the bridge that sprang (still in `ctx.objects` on
 * that frame, since it runs after `placed`) and pulls the victim toward it at `speed` px/s while
 * the status lasts. Being pulled does not stop them blocking or acting.
 */
registerSystem("compulsion", {
  update(ctx) {
    const match = ctx.match;
    for (const f of match.allFighters) {
      const st = fighterData(f).status.obsessed;
      if (!st) continue;
      if (st.x === undefined) {
        let best = null;
        for (const o of ctx.objects) {
          if (o.look !== "golden_gate" || o.side === f.side) continue;
          if (!best || Math.abs(o.x - f.x) < Math.abs(best.x - f.x)) best = o;
        }
        if (!best) {
          delete fighterData(f).status.obsessed;
          continue;
        }
        st.x = best.x;
        match.emit("compulsion", { fighter: f.id, side: f.side, by: best.ownerId, x: best.x });
      }
      if (!f.onField || f.ko || f.isLying || f.state === "thrown" || f.state === "bench") continue;
      const dx = st.x - f.x;
      if (Math.abs(dx) > 6) f.x += Math.sign(dx) * Math.min(Math.abs(dx), (st.speed ?? 170) / 60);
    }
  },
}, { order: 130 });
