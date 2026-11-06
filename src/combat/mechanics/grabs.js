import { registerMechanic, registerSystem } from "../mechanics.js";

/**
 * Grab extensions (roster doc group A).
 *
 * "anti-air-grab" (move-level, Elon's Mechazilla Catch). `mechanicData`:
 *   { air: "only" | "also", range, groundRange, reach, damage, hold, lift, liftFrames, knockback }
 *   During the active frames it grabs an airborne opponent within `range` and `reach` px of
 *   the floor ("also": grounded ones within `groundRange` too), carries them up to `lift` px,
 *   holds them `hold` frames and drops them. Untechable; assists deal 70%. The move hook
 *   seizes the victim; the "anti-air-grab" system carries them match-wide.
 * "grab-hold" (fighter-level): a built-in `grab` move with `mechanicData.hold` keeps the
 *   victim held that many frames before the release (for cinematic grabs and supers).
 */

const NO_AIR_GRAB = new Set(["juggle", "thrown", "tech", "ko", "finished", "finisher", "breaker", "tag_in", "tag_out", "assist_in", "assist_out", "bench"]);

function airGrabbable(d) {
  if (!d.onField || d.ko || d.hidden || d.invulnFrames > 0 || NO_AIR_GRAB.has(d.state)) return false;
  const inv = d.state === "attack" ? d.move?.invuln : null;
  return !(inv && d.moveFrame >= inv.from && d.moveFrame <= inv.to && (inv.type === "all" || inv.type === "throw"));
}

/** Can grabber `a` take defender `d` with anti-air grab data `g` this frame? */
export function canGrab(a, d, g) {
  if (!d || a.airborne) return false;
  const dx = Math.abs(a.x - d.x);
  if (d.airborne) return g.air !== "ground" && airGrabbable(d) && dx <= g.range && -d.y <= (g.reach ?? 260);
  if (g.air !== "also" || d.invulnTo("throw")) return false;
  return dx <= (g.groundRange ?? g.range);
}

/** Height of a carried victim: eases from where it was grabbed up to `lift`. */
export function carryHeight(fromY, lift, liftFrames, frame) {
  const t = Math.min(1, frame / liftFrames);
  return fromY + (-lift - fromY) * t;
}

function seize(f, d, move, env) {
  const g = move.mechanicData;
  const match = env.match;
  const fromY = d.y;
  f.mech.grabbed = true;
  d.setState("thrown");
  d.combo = { hits: 0, damage: 0 };
  d.grab = {
    by: f,
    move,
    techable: false,
    release: g.hold ?? 30,
    damage: Math.round((g.damage ?? 140) * (f.damageMul ?? 1)),
    knockback: g.knockback || { x: 160, y: 150 },
    back: false,
  };
  match.emit("throw", { attacker: f.id, defender: d.id, side: f.side, moveId: move.id });
  match.vfx("throw", (f.x + d.x) / 2, d.y - 110, { facing: f.facing, side: f.side, tech: false });
  carries(match.mech.ctx).push({ by: f, victim: d, fromY, lift: g.lift ?? 30, liftFrames: g.liftFrames ?? 6 });
}

function carries(ctx) {
  return (ctx.state.grabCarries ??= []);
}

registerMechanic("anti-air-grab", {
  onStart(f) {
    f.mech.grabbed = false;
  },
  onFrame(f, move, env) {
    if (f.mech.grabbed || f.moveFrame < move.startup || f.moveFrame >= move.startup + move.active) return;
    const d = env.opponent;
    if (d && d.state !== "thrown" && canGrab(f, d, move.mechanicData)) seize(f, d, move, env);
  },
});

/** After fighters move: carried victims follow the lift; on release they drop from the top. */
registerSystem("anti-air-grab", {
  reset(ctx) {
    carries(ctx).length = 0;
  },
  update(ctx) {
    ctx.state.grabCarries = carries(ctx).filter((c) => {
      const d = c.victim;
      if (d.state === "thrown" && d.grab?.by === c.by) {
        d.y = carryHeight(c.fromY, c.lift, c.liftFrames, d.stateFrame);
        return true;
      }
      if (d.state === "juggle") d.y = Math.min(d.y, -c.lift);
      return false;
    });
  },
}, { order: 110 });

registerMechanic("grab-hold", {
  update(f) {
    const g = f.state === "throwing" ? f.grab : null;
    const hold = g?.move?.mechanicData?.hold;
    const victim = g?.victim;
    if (!hold || victim?.grab?.by !== f) return;
    if (victim.grab.release < hold) victim.grab.release = hold;
    g.length = Math.max(g.length, hold + 8);
  },
});
