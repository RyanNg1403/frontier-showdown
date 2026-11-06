/**
 * Guard crush (roster doc group A). A move with `guardCrush` punishes blocking:
 * - `runway: n` drains n Runway from the blocker once per move (on its final hit). If that
 *   empties the Runway, the guard breaks: the blocker staggers for GUARD_BREAK_STUN frames.
 * - `crack: { frames, blockstun }` cracks the blocker's guard; their next block within
 *   `frames` suffers `blockstun` extra frames.
 */

export const GUARD_BREAK_STUN = 40;
const CRACK = { frames: 120, blockstun: 6 };

function guardBreak(match, a, d, team, at) {
  team.runway = 0;
  team.runwaySpentFrame = match.frame;
  d.crack = null;
  d.setState("hitstun", { keepAnim: true });
  d.stun = GUARD_BREAK_STUN;
  d.stunAnim = "hit_high";
  d.setAnim("hit_high", true);
  d.vx *= 0.5;
  match.shakeFrames = Math.max(match.shakeFrames, 8);
  match.emit("guardBreak", { fighter: d.id, side: d.side, attacker: a.id });
  match.vfx("guard_break", at.x, at.y, { facing: a.facing, side: a.side });
}

/**
 * Run after a block has been applied (`d` is in blockstun). Returns true when the block
 * turned into a guard break.
 */
export function afterBlock(match, a, d, props, at) {
  const crack = d.crack;
  if (crack && crack.setFrame !== match.frame) {
    d.crack = null;
    if (match.frame <= crack.until) {
      d.stun += crack.blockstun;
      match.vfx("guard_crack", at.x, at.y, { facing: a.facing, side: a.side, shatter: true });
    }
  }
  const gc = props.move?.guardCrush;
  if (!gc || props.final === false) return false;
  const team = match.sides[d.side];
  if (gc.runway) {
    if (team.runway - gc.runway <= 0) {
      guardBreak(match, a, d, team, at);
      return true;
    }
    team.runway -= gc.runway;
    team.runwaySpentFrame = match.frame;
  }
  if (gc.crack) {
    const c = { ...CRACK, ...(gc.crack === true ? {} : gc.crack) };
    d.crack = { until: match.frame + c.frames, blockstun: c.blockstun, setFrame: match.frame };
  }
  match.vfx("guard_crack", at.x, at.y, { facing: a.facing, side: a.side });
  return false;
}
