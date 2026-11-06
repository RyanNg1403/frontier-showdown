import { registerMechanic } from "../mechanics.js";
import { fighterData, fireOnce } from "./core.js";
import { scheduleStrike } from "./delayed-strike.js";
import { clamp, propsFor } from "./targeting.js";

/**
 * Path-tracking strike (Chris's Circuit Trace): a move mechanic plus a fighter mechanic for the
 * Marked bonus (`mechanics: ["path-strike"]`).
 *
 * Move data: `mechanic: "path-strike"`, `passThrough: { from: dashFrom, to: dashTo }`,
 * `mechanicData: { dashFrom, dashTo, range, markedRange, markedBonus, stopShort, rabbit: { delay } }`.
 * From frame 1 an attribution-graph line is drawn to the opponent; between `dashFrom` and
 * `dashTo` the fighter travels along it, so the move's own hitbox lands on `startup`. Against an
 * unmarked target the path is fixed where they stood and capped at `range` px; against a Marked
 * target (the `mark` status) it keeps tracking them, jumps and cross-ups included, up to
 * `markedRange`, and the hit deals `markedBonus` more. With `rabbit` (Scale Up) the fighter
 * stays put and a rabbit strikes the target `delay` frames after `dashFrom`. The live path is
 * `fighter.mech.path` while `activePath(fighter)`.
 */
const marked = (f) => Boolean(f && fighterData(f).status.mark);

function aim(path, f, opp, cfg, first) {
  if (!opp) return;
  if (path.marked) {
    const max = cfg.markedRange ?? 320;
    path.tx = f.x + clamp(opp.x - f.x, -max, max);
    path.ty = opp.y;
  } else if (first) {
    const max = cfg.range ?? 200;
    path.tx = f.x + clamp(opp.x - f.x, -max, max);
    path.ty = 0;
  }
}

export function activePath(f) {
  const p = f.mech?.path;
  if (!p || f.state !== "attack" || f.move?.mechanic !== "path-strike" || p.token !== f.hitLog) return null;
  return f.moveFrame <= f.move.startup + f.move.active ? p : null;
}

registerMechanic("path-strike", {
  /** Fighter hook: the Marked bonus on the move's own hit. */
  damageMul(f, ctx) {
    const m = f.state === "attack" && f.move?.mechanic === "path-strike" ? f.move : null;
    if (!m || ctx.props.id !== m.id || ctx.props.rabbit || !marked(ctx.defender)) return 1;
    return 1 + (m.mechanicData.markedBonus ?? 0) / Math.max(1, m.damage);
  },

  onFrame(f, move, env) {
    const cfg = move.mechanicData;
    const match = env.match;
    const opp = env.opponent;
    if (!f.mech.path || f.mech.path.token !== f.hitLog) {
      f.mech.path = { token: f.hitLog, marked: marked(opp), tx: f.x, ty: f.y, sx: undefined };
      aim(f.mech.path, f, opp, cfg, true);
    }
    const path = f.mech.path;
    const fr = f.moveFrame;
    if (fr <= cfg.dashTo && path.marked) aim(path, f, opp, cfg, false);
    if (cfg.rabbit) {
      if (fr >= cfg.dashFrom && fireOnce(f, "rabbit")) {
        const props = propsFor(move.id, { damage: move.damage + (path.marked ? cfg.markedBonus ?? 0 : 0), chip: move.chip, hitstun: move.hitstun, blockstun: move.blockstun, knockback: move.knockback, level: move.level, juggle: 2 }, move.category);
        props.rabbit = true;
        scheduleStrike(match, {
          kind: "rabbit", owner: f, side: f.side, move, delay: cfg.rabbit.delay ?? 30, x0: f.x, y0: f.y - 60,
          follow: path.marked ? opp?.uid : null,
          box: { x: path.tx - 40, y: Math.min(path.ty, 0) - 150, w: 80, h: 150 },
          props,
        });
      }
      return;
    }
    if (fr < cfg.dashFrom || fr > cfg.dashTo) return;
    if (path.sx === undefined) {
      path.sx = f.x;
      path.sy = f.y;
      path.k0 = fr;
    }
    const t = (fr - path.k0 + 1) / (cfg.dashTo - path.k0 + 1);
    const dir = Math.sign(path.tx - path.sx) || f.facing;
    const gx = path.tx - dir * (cfg.stopShort ?? 52);
    const { left, right } = match.bounds;
    const hw = f.push.w / 2;
    f.x = clamp(path.sx + (gx - path.sx) * t, left + hw, right - hw);
    f.y = path.sy + (Math.min(0, path.ty) - path.sy) * t;
    f.vx = 0;
    f.vy = 0;
    f.facing = dir;
  },
});
