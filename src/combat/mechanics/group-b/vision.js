import { currentMove, fireOnce } from "../core.js";
import { syncOverlay } from "./draw.js";
import { registerSystem } from "../../mechanics.js";

/**
 * Prescient vision (Ilya's What Did Ilya See?). Starting a move with `mech.vision: { frames }`
 * shows the opponent's predicted next special over their head: the last special they used,
 * else their first. If they do start a special while the vision is up, it names that one.
 */
const visionModule = {

  reset(ctx) {
    ctx.state.lastSpecial = new Map();
    ctx.state.visions = new Map();
  },

  update(ctx) {
    const match = ctx.match;
    const { lastSpecial, visions } = ctx.state;
    for (const f of match.fighters) {
      const m = currentMove(f);
      if (!m || (m.category !== "special" && m.category !== "super") || !fireOnce(f, "vision_seen")) continue;
      const seen = visions.get(f.uid);
      if (seen) {
        seen.text = m.name;
        seen.confirmed = true;
        seen.frames = Math.max(seen.frames, 45);
      }
      if (m.category === "special" && m.id !== "parry_counter") lastSpecial.set(f.uid, m.name);
      const cfg = m.mech?.vision;
      const target = cfg ? match.point(1 - f.side) : null;
      if (!target) continue;
      const text = lastSpecial.get(target.uid) || target.def.specials[0]?.name || "?";
      visions.set(target.uid, { target, by: f, text, frames: cfg.frames ?? 110, confirmed: false });
    }
    for (const [uid, v] of visions) {
      if (--v.frames <= 0 || !v.target.onField) visions.delete(uid);
    }
    if (match.phase === "fight") syncOverlay(ctx);
  },

  snapshot(ctx, out) {
    out.visions = [...(ctx.state.visions?.values() || [])].map((v) => ({ fighter: v.target.id, side: v.target.side, by: v.by.id, text: v.text, frames: v.frames, confirmed: v.confirmed }));
  },
};

registerSystem("group-b-vision", visionModule, { order: 116 });
