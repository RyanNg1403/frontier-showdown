import { registerMechanic } from "../mechanics.js";
import { fireOnce } from "./core.js";

/**
 * Extra projectiles released later in a move (Geoffrey's second Forward-Forward wave). The
 * engine's own `projectile` field spawns the first; each entry here spawns another on move
 * frame `frame`, with the move's category (a super's waves keep super scaling).
 *
 * Move data: `mechanic: "timed-spawns"`, `mechanicData: { spawns: [{ frame, wave, projectile }] }`.
 */
registerMechanic("timed-spawns", {
  onFrame(f, move, env) {
    (move.mechanicData?.spawns || []).forEach((s, i) => {
      if (f.moveFrame < s.frame || !fireOnce(f, `spawn_${i}`)) return;
      const raw = s.projectile;
      const off = raw.offset || { x: 70, y: -130 };
      const p = env.match.mech.ctx.spawnRaw(f, { ...raw, moveId: move.id }, { x: f.x + f.facing * off.x, y: f.y + off.y, vx: f.facing * (raw.speed ?? 480), facing: f.facing });
      p.category = move.category;
      p.wave = s.wave ?? null;
    });
  },
});
