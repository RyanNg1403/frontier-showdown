import { BTN, DT, RULES } from "../constants.js";
import { isDown } from "../input.js";
import { registerMechanic } from "../mechanics.js";

/**
 * Air dives with a ground bounce (roster doc group A, Elon's "The Walrus").
 *
 * `registerAirDive(name, move)` registers a fighter-level mechanic that starts `move` when the
 * fighter presses down+HP during a jump (a jumping command normal). The dive's
 * `mechanicData.landingRecoveryOnHit` replaces its landing recovery after it connected.
 *
 * "ground-bounce" (move-level) slams a launched victim into the floor at `slam` px/s; it bounces
 * back up at `bounce` px/s. One ground bounce per combo (doc 2.5).
 */

export function registerAirDive(name, move) {
  registerMechanic(name, {
    update(f, env) {
      const b = env.input;
      if (f.state === "jump_land" && f.mech.diveHit) {
        f.mech.diveHit = false;
        f.landingRecovery = move.mechanicData?.landingRecoveryOnHit ?? f.landingRecovery;
      }
      if (f.state !== "jump" || f.airAttackUsed || !env.canAct || !b) return;
      if (!b.findPress(BTN.HP, RULES.bufferFrames) || !isDown(b.dir(f.facing))) return;
      f.startMove(move, env);
      f.moveFrame = 0;
    },
  });
}

export function applyGroundBounce(match, d, data) {
  if (d.state !== "juggle" || d.combo.bounced) return false;
  d.combo.bounced = true;
  d.vy = Math.max(d.vy, data.slam ?? 900);
  d.y = Math.min(d.y, -2);
  const bounce = data.bounce ?? 760;
  match.spawnEntity({
    side: 1 - d.side,
    update(m) {
      if (d.state !== "juggle") return false;
      if (d.vy <= 0 || d.y + d.vy * DT < -1) return true;
      d.vy = -bounce / Math.sqrt(d.def.stats.weight || 1);
      d.vx *= 0.6;
      d.y = -1;
      m.vfx("knockdown_impact", d.x, 0, { facing: d.facing, side: d.side, bounce: true });
      m.shakeFrames = Math.max(m.shakeFrames, 5);
      return false;
    },
  });
  return true;
}

registerMechanic("ground-bounce", {
  onStart(f) {
    f.mech.diveHit = false;
  },
  onHit({ match, attacker, defender, props, blocked }) {
    if (blocked) return;
    attacker.mech.diveHit = true;
    const data = attacker.state === "attack" && attacker.move?.id === props.id ? attacker.move.mechanicData : null;
    if (data?.groundBounce) applyGroundBounce(match, defender, data.groundBounce);
  },
});
