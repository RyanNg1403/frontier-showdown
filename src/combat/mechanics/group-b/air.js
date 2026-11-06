import { RULES } from "../../constants.js";
import { registerSystem } from "../../mechanics.js";
import { matchMotion } from "../../input.js";
import { contactProps } from "../core.js";
import { burst, controlInput } from "./util.js";

/**
 * Air extensions. Air-only specials themselves are plain move data (`airOnly: true`, read by
 * the fighter's move picker).
 * - `shockwave: { damage, radius, level }` on an air move: a ground wave when it lands
 *   (Arthur's Scale Up Le Chonk Drop).
 * - `airScaleUp: true` on a ground special: in the air its motion performs the Scale Up
 *   version for one bar, and its teleport lands level with the opponent (Ilya's Straight Shot).
 */
function shockwave(ctx, f, move) {
  const match = ctx.match;
  const cfg = move.mech.shockwave;
  const r = cfg.radius ?? 170;
  const props = contactProps(`${move.id}_shockwave`, { damage: (cfg.damage ?? 40) * (f.damageMul ?? 1), level: cfg.level || "low", hitstun: 18, blockstun: 12, knockback: { x: 220, y: 300 }, juggle: 1 });
  burst(match, f, f.side, { x: f.x - r, y: -60, w: r * 2, h: 60 }, props, f.x, "strike");
  ctx.effect("shockwave", f.x, 0, { side: f.side, life: 20, radius: r, palette: f.def.palette });
  match.shakeFrames = Math.max(match.shakeFrames, 10);
}

const airModule = {

  reset(ctx) {
    ctx.state.prevAttack = new Map();
    ctx.state.airShots = new Map();
  },

  preStep(ctx) {
    const match = ctx.match;
    if (match.phase !== "fight") return;
    for (const s of match.sides) {
      const f = s.members[s.active];
      if (f.state !== "jump" || s.meter < RULES.scaleUpCost) continue;
      const input = controlInput(match, f);
      if (!input) continue;
      for (const sp of f.def.specialsByRank) {
        if (!sp.mech?.airScaleUp) continue;
        const age = matchMotion(input, sp.motion, f.facing);
        const scaled = age >= 0 ? f.variantFor(sp, input, age).scaled : null;
        if (!scaled) continue;
        s.meter -= RULES.scaleUpCost;
        f.startMove(scaled, match.envFor(f));
        f.airAttackUsed = true;
        ctx.state.airShots.set(f.uid, scaled);
        match.emit("scaleUp", { fighter: f.id, side: f.side, moveId: scaled.id, air: true });
        match.vfx("scale_up", f.x, f.y - 110, { characterId: f.id, palette: f.def.palette, side: f.side });
        break;
      }
    }
  },

  update(ctx) {
    const match = ctx.match;
    for (const f of match.fighters) {
      const shot = ctx.state.airShots.get(f.uid);
      if (shot && (f.move !== shot || f.state !== "attack")) ctx.state.airShots.delete(f.uid);
      else if (shot && shot.teleport && f.moveFrame >= shot.teleport.frame) {
        ctx.state.airShots.delete(f.uid);
        const opp = match.point(1 - f.side);
        if (opp && f.airborne) {
          f.y = Math.min(0, opp.y);
          f.vy = 0;
        }
      }
      const prev = ctx.state.prevAttack.get(f.uid);
      if (prev?.mech?.shockwave && f.state === "jump_land" && match.phase === "fight") shockwave(ctx, f, prev);
      ctx.state.prevAttack.set(f.uid, f.state === "attack" ? f.move : null);
    }
  },
};

registerSystem("group-b-air", airModule, { order: 115 });
