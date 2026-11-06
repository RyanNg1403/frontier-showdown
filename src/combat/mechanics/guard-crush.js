import { registerMechanic, registerSystem } from "../mechanics.js";

/**
 * Guard crush (roster doc group A). A move whose `mechanicData.guardCrush` is set punishes
 * blocking:
 * - `runway: n` drains n Runway from the blocker once per use of the move. If that empties the
 *   Runway, the guard breaks: the blocker staggers for GUARD_BREAK_STUN frames.
 * - `crack: { frames, blockstun }` cracks the blocker's guard; their next block within
 *   `frames`, from any attack, suffers `blockstun` extra frames.
 * Fighter hooks (characters list `mechanics: ["guard-crush"]`) see the blocks; the
 * "guard-crush" system tracks cracked guards match-wide.
 */

export const GUARD_BREAK_STUN = 40;
const CRACK = { frames: 120, blockstun: 6 };

function guardBreak(match, a, d, team) {
  team.runway = 0;
  team.runwaySpentFrame = match.frame;
  d.setState("hitstun", { keepAnim: true });
  d.stun = GUARD_BREAK_STUN;
  d.stunAnim = "hit_high";
  d.setAnim("hit_high", true);
  d.vx *= 0.5;
  match.shakeFrames = Math.max(match.shakeFrames, 8);
  match.emit("guardBreak", { fighter: d.id, side: d.side, attacker: a.id });
  match.vfx("guard_break", d.x, d.y - 120, { facing: a.facing, side: a.side });
}

function cracks(ctx) {
  return (ctx.state.guardCracks ??= new Map());
}

/** Apply a crack's extra blockstun if `d` entered a fresh block since it was last seen. */
function checkCrack(ctx, d, c) {
  const match = ctx.match;
  if (match.frame > c.until || d.ko) return true;
  const fresh = d.state === "blockstun" && (c.prevState !== "blockstun" || d.stun > c.prevStun);
  c.prevState = d.state;
  c.prevStun = d.stun;
  if (!fresh) return false;
  d.stun += c.blockstun;
  match.vfx("block", d.x, d.y - 120, { facing: -d.facing, side: c.side, chip: 0, crack: true });
  return true;
}

registerMechanic("guard-crush", {
  onMoveStart(f) {
    f.mech.crushUses = (f.mech.crushUses ?? 0) + 1;
  },
  onHit({ match, attacker: a, defender: d, props, blocked }) {
    const gc = blocked ? a.def.moves.get(props.id)?.mechanicData?.guardCrush : null;
    if (!gc) return;
    if (gc.runway && a.mech.crushedOn !== a.mech.crushUses) {
      a.mech.crushedOn = a.mech.crushUses;
      const team = match.sides[d.side];
      if (team.runway - gc.runway <= 0) {
        guardBreak(match, a, d, team);
        return;
      }
      team.runway -= gc.runway;
      team.runwaySpentFrame = match.frame;
    }
    if (gc.crack) {
      const ctx = match.mech.ctx;
      const prev = cracks(ctx).get(d);
      if (prev) checkCrack(ctx, d, prev);
      const c = { ...CRACK, ...(gc.crack === true ? {} : gc.crack) };
      cracks(ctx).set(d, { until: match.frame + c.frames, blockstun: c.blockstun, side: a.side, prevState: d.state, prevStun: d.stun });
    }
    match.vfx("guard_break", d.x, d.y - 120, { facing: a.facing, side: a.side, scale: 0.6 });
  },
});

registerSystem("guard-crush", {
  reset(ctx) {
    cracks(ctx).clear();
  },
  update(ctx) {
    for (const [d, c] of cracks(ctx)) if (checkCrack(ctx, d, c)) cracks(ctx).delete(d);
  },
  snapshot(ctx, out) {
    out.guardCracks = [...cracks(ctx).keys()].map((d) => d.side);
  },
}, { order: 110 });
