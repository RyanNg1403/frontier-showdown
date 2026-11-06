import { registerMechanic } from "../mechanics.js";
import { clamp, constructsOf } from "./targeting.js";

/**
 * Spatial teleport (Fei-Fei's Spatial Step), a move mechanic.
 *
 * Move data: `mechanic: "spatial-step"`, `mechanicData: { vanish, frame, to: "platform"|"behind", distance, behindDistance }`.
 * Folds into a wireframe on `vanish` (hidden, so invulnerable) and reappears on `frame`:
 * `platform` lands on top of the owner's own Marble construct (a hop of `distance` back without
 * one), `behind` lands just behind the opponent. Scale Up adds the move's own re-entry strike.
 */
registerMechanic("spatial-step", {
  onFrame(f, move, env) {
    const cfg = move.mechanicData;
    const match = env.match;
    if (f.moveFrame === (cfg.vanish ?? 3)) {
      f.hidden = true;
      match.vfx("tag_flash", f.x, f.y - 100, { facing: f.facing, side: f.side, characterId: f.id });
    }
    if (f.moveFrame !== (cfg.frame ?? 9)) return;
    const opp = env.opponent;
    const { left, right } = match.bounds;
    const hw = f.push.w / 2;
    const own = constructsOf(match, f.uid);
    const perch = own.find((c) => c.type === "platform") || own[0];
    let x = f.x - f.facing * (cfg.distance ?? 140);
    let y = f.floorY;
    if (cfg.to === "behind" && opp) {
      x = opp.x + (Math.sign(opp.x - f.x) || f.facing) * (cfg.behindDistance ?? 80);
      y = opp.floorY;
    } else if (cfg.to === "platform" && perch) {
      x = perch.x;
      y = perch.top;
    }
    f.x = clamp(x, left + hw, right - hw);
    f.y = y;
    f.floorY = y;
    f.vx = 0;
    f.vy = 0;
    f.hidden = false;
    if (opp) f.facing = Math.sign(opp.x - f.x) || f.facing;
    match.vfx("tag_flash", f.x, f.y - 100, { facing: f.facing, side: f.side, characterId: f.id });
  },
});
