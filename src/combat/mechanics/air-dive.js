import { BTN } from "../constants.js";
import { isDown } from "../input.js";

/**
 * Air dives with a ground bounce (roster doc group A, Elon's "The Walrus").
 * - `normals.j_d_hp` is the jumping down+HP command normal.
 * - `landingRecoveryOnHit` replaces `landingRecovery` when the dive connected.
 * - `groundBounce: { vy, slam }` slams a launched victim into the floor (downward speed
 *   `slam`), and it bounces back up at `vy`. One ground bounce per combo (doc 2.5).
 */

export function airCommandNormal(def, bit, dir) {
  if (bit === BTN.HP && isDown(dir) && def.normals.j_d_hp) return def.normals.j_d_hp;
  return null;
}

export function landingRecovery(f) {
  const m = f.move;
  return f.connected && m.landingRecoveryOnHit != null ? m.landingRecoveryOnHit : m.landingRecovery;
}

/** After a hit put `d` into a juggle: set up the slam and bounce if the move has one. */
export function applyGroundBounce(d, props) {
  const gb = props.move?.groundBounce;
  if (!gb || d.state !== "juggle" || d.combo.bounced) return false;
  d.combo.bounced = true;
  d.combo.bounce = gb.vy ?? 760;
  d.vy = Math.max(d.vy, gb.slam ?? 900);
  d.y = Math.min(d.y, -2);
  return true;
}

/** Called when a juggled fighter lands. Returns true when it bounced instead of falling down. */
export function groundBounce(f, env, impact) {
  const vy = f.combo.bounce;
  if (!vy) return false;
  f.combo.bounce = 0;
  f.vy = -vy / Math.sqrt(f.def.stats.weight || 1);
  f.vx *= 0.6;
  f.y = -1;
  env.vfx("ground_bounce", f.x, 0, { facing: f.facing, side: f.side, impact });
  env.shake?.(5);
  return true;
}
