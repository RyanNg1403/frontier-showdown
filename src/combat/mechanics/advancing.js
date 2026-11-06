import { registerMechanic } from "../mechanics.js";

/**
 * Advancing low-profile strikes (roster doc group A, Mark's Hydrofoil Rush), move-level
 * mechanic "low-profile-slide". `mechanicData`:
 * - `lowProfile: { from, to, boxes? }` swaps the hurtboxes for a low slide body on those move
 *   frames, so highs pass over (pair it with `invuln` type "projectile" for fireballs).
 * - `stopOnContact: true` ends the active frames on the first hit or block, so a long glide
 *   does not carry its remaining active frames into the on-block disadvantage.
 */

export const LOW_PROFILE_BOXES = Object.freeze([{ x: -46, y: -62, w: 92, h: 62 }]);

export function lowProfileActive(f, move = f.move) {
  const lp = move?.mechanicData?.lowProfile;
  return Boolean(lp && f.moveFrame >= lp.from && f.moveFrame <= lp.to);
}

registerMechanic("low-profile-slide", {
  hurtboxes(f, move) {
    return lowProfileActive(f, move) ? move.mechanicData.lowProfile.boxes || LOW_PROFILE_BOXES : null;
  },
  onFrame(f, move) {
    if (!move.mechanicData?.stopOnContact || !f.connected) return;
    const end = move.startup + move.active;
    if (f.moveFrame < end) {
      f.moveFrame = end;
      f.vx *= 0.25;
    }
  },
});
