import { registerMechanic } from "../mechanics.js";
import { clamp } from "./targeting.js";

/**
 * Intangible re-entry (Geoffrey's Dropout), a move mechanic.
 *
 * The move itself carries the engine fields `invuln: { from, to, type: "all" }` (no hits, no
 * throws) and `passThrough: { from, to }` (walks through bodies). This mechanic adds the
 * re-materialization: on move frame `to` the fighter reappears in place, behind the opponent or
 * a step back, facing them, ready for the move's own re-entry strike. The renderer draws a
 * pixel-dropout mask while `isDroppedOut(fighter)`.
 *
 * Move data: `mechanic: "intangible"`, `mechanicData: { from, to, reposition: "place"|"behind"|"back", distance }`.
 */
export function isDroppedOut(f) {
  const cfg = f.state === "attack" && f.move?.mechanic === "intangible" ? f.move.mechanicData : null;
  return Boolean(cfg && f.moveFrame >= cfg.from && f.moveFrame <= cfg.to);
}

registerMechanic("intangible", {
  onFrame(f, move, env) {
    const cfg = move.mechanicData;
    const match = env.match;
    if (f.moveFrame === cfg.from) match.vfx("tag_flash", f.x, f.y - 110, { facing: f.facing, side: f.side, characterId: f.id });
    if (f.moveFrame !== cfg.to) return;
    const opp = env.opponent;
    const { left, right } = match.bounds;
    const hw = f.push.w / 2;
    if (cfg.reposition === "behind" && opp) {
      const toward = Math.sign(opp.x - f.x) || f.facing;
      f.x = clamp(opp.x + toward * (cfg.distance ?? 70), left + hw, right - hw);
    } else if (cfg.reposition === "back") {
      f.x = clamp(f.x - f.facing * (cfg.distance ?? 140), left + hw, right - hw);
    }
    if (opp) f.facing = Math.sign(opp.x - f.x) || f.facing;
    match.vfx("tag_flash", f.x, f.y - 110, { facing: f.facing, side: f.side, characterId: f.id });
  },
});
