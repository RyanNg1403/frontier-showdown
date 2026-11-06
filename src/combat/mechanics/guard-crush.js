import { registerMechanic } from "../mechanics.js";

/**
 * Guard crush (roster doc group A), fighter-level mechanic "guard-crush". A move whose
 * `mechanicData.guardCrush` is set punishes blocking:
 * - `runway: n` drains n Runway from the blocker once per use of the move. If that empties the
 *   Runway, the guard breaks: the blocker staggers for GUARD_BREAK_STUN frames.
 * - `crack: { frames, blockstun }` cracks the blocker's guard; their next block within
 *   `frames`, from any attack, suffers `blockstun` extra frames.
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

/** Watches the cracked blocker and lengthens their next fresh blockstun. */
function crack(match, a, d, c) {
  const previous = d.mech.crack;
  if (previous) {
    previous.update(match);
    previous.cancel();
  }
  const until = match.frame + c.frames;
  let prevState = d.state;
  let prevStun = d.stun;
  let dead = false;
  const watcher = {
    side: a.side,
    cancel() {
      dead = true;
    },
    update(m) {
      if (dead || m.frame > until || d.ko) return false;
      const fresh = d.state === "blockstun" && (prevState !== "blockstun" || d.stun > prevStun);
      prevState = d.state;
      prevStun = d.stun;
      if (!fresh) return true;
      d.stun += c.blockstun;
      m.vfx("block", d.x, d.y - 120, { facing: -d.facing, side: a.side, chip: 0, crack: true });
      return false;
    },
  };
  d.mech.crack = watcher;
  match.spawnEntity(watcher);
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
    if (gc.crack) crack(match, a, d, { ...CRACK, ...(gc.crack === true ? {} : gc.crack) });
    match.vfx("guard_break", d.x, d.y - 120, { facing: a.facing, side: a.side, scale: 0.6 });
  },
});
