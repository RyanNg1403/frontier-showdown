/**
 * Advancing strikes (roster doc group A, Mark's Hydrofoil Rush).
 * - `lowProfile: { from, to, boxes? }` swaps the hurtboxes for a low slide body on those move
 *   frames, so highs and most projectiles pass over.
 * - `stopOnContact: true` ends the active frames on the first hit or block, so a long glide
 *   does not carry its remaining active frames into the on-block disadvantage.
 */

export const LOW_PROFILE_BOXES = Object.freeze([{ x: -46, y: -62, w: 92, h: 62 }]);

export function moveHurtboxes(f) {
  const lp = f.state === "attack" ? f.move?.lowProfile : null;
  if (!lp || f.moveFrame < lp.from || f.moveFrame > lp.to) return null;
  return lp.boxes || LOW_PROFILE_BOXES;
}

export function stopOnContact(f) {
  const m = f.move;
  if (!m?.stopOnContact || !f.connected) return;
  const end = m.startup + m.active;
  if (f.moveFrame < end) {
    f.moveFrame = end;
    f.vx *= 0.25;
  }
}
