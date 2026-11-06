import { BTN } from "../constants.js";
import { registerKits } from "./index.js";
import { echoOf } from "../mechanics/group-b/echo.js";
import { stonesOf } from "../mechanics/group-b/stones.js";
import { turretsOf } from "../mechanics/group-b/turret.js";

/**
 * CPU tactics for Demis, Jensen, Ilya and Arthur: the parts of their kits the generic CPU and
 * the `ai` hints in their character data can't express (stones and remote detonation, the
 * Self-Play echo, the AI Factory turret, orb detonation, the prescient counter, magnet reels
 * and the air dive). Each kit returns true when it queued an action. Character files import this
 * file, which registers the kits.
 * `k` is `{ match, side, self, team, opp, dist, seen, steps }` (`steps` = `motionSteps`).
 */
function ownProjectile(k, moveId = null) {
  return k.match.projectiles.find((p) => p.ownerUid === k.self.uid && !p.dead && (!moveId || p.moveId === moveId));
}

/** Could a command grab connect on this opponent right now? */
function grabbable(opp) {
  return !opp.airborne && !opp.isStunned && opp.state !== "blockstun" && !opp.isLying;
}

function cast(cpu, k, input, button, cooldown = 0) {
  cpu.push(k.steps(input, button));
  if (cooldown) cpu.cooldown = cooldown;
  return true;
}

const groupBKits = {
  demis(cpu, k) {
    const { match, self, opp, dist } = k;
    const p = cpu.p;
    const stones = stonesOf(match, self);
    if (stones.some((s) => s.age >= s.armDelay && Math.abs(opp.x - s.x) < 85) && cpu.chance(p.punish)) return cast(cpu, k, "D,N,B+P", BTN.LP);
    if (!echoOf(match, self) && dist > 200 && cpu.chance(p.zoning * 0.45)) return cast(cpu, k, "D,B+K", dist < 420 ? BTN.HK : BTN.LK, 6);
    if (stones.length < 2 && dist > 230 && cpu.chance(p.zoning * 0.55)) return cast(cpu, k, "QCB+P", dist < 330 ? BTN.LP : BTN.HP, 6);
    if (!ownProjectile(k) && dist > 260 && cpu.chance(p.zoning * 0.5)) return cast(cpu, k, "QCF+P", dist > 480 ? BTN.HP : BTN.LP, 8);
    return false;
  },

  jensen(cpu, k) {
    const { match, self, opp, dist } = k;
    const p = cpu.p;
    if (!turretsOf(match, self).length && dist > 250 && cpu.chance(p.zoning * 0.7)) return cast(cpu, k, "D,B+K", BTN.LK, 8);
    if (dist < 108 && grabbable(opp) && cpu.chance(0.12 + p.aggression * 0.25)) return cast(cpu, k, k.self.def.specials[1].input, dist < 82 ? BTN.LP : BTN.HP);
    if (!ownProjectile(k, "been_cooking") && dist > 300 && cpu.chance(p.zoning * 0.8)) return cast(cpu, k, "QCB+P", dist > 460 ? BTN.HP : BTN.LP, 10);
    return false;
  },

  ilya(cpu, k) {
    const { self, opp, dist, seen } = k;
    const p = cpu.p;
    const orb = ownProjectile(k, "peak_data");
    if (orb && Math.abs(orb.x - opp.x) < 110 && Math.abs(orb.y - (opp.y - 100)) < 150 && cpu.chance(p.punish)) return cast(cpu, k, "QCF+P", BTN.LP);
    if (seen.airborne && !seen.lying && seen.state !== "juggle" && dist > 110 && dist < 340 && cpu.chance(p.antiAir * 0.6)) return cast(cpu, k, "B,F+P", BTN.HP);
    if (seen.recovering && dist > 110 && dist < 360 && cpu.chance(p.punish * 0.7)) return cast(cpu, k, "B,F+P", BTN.LP);
    const rushing = (opp.state === "run" || opp.state === "dash_fwd") && dist < 320;
    if ((rushing || (seen.attacking && dist < 190)) && cpu.chance(p.punish * 0.4)) return cast(cpu, k, "D,B+K", BTN.LK);
    if (!orb && dist > 280 && cpu.chance(p.zoning * 0.9)) return cast(cpu, k, "QCF+P", BTN.LP, 8);
    if (orb && dist > 200 && dist < 420 && self.health > 0 && cpu.chance(p.aggression * 0.12)) return cast(cpu, k, "B,F+P", BTN.LP);
    return false;
  },

  arthur(cpu, k) {
    const { match, opp, dist } = k;
    const p = cpu.p;
    const slowed = Boolean(match.mech.status(opp, "slow"));
    if (dist > 380 && !ownProjectile(k) && cpu.chance(p.zoning * (slowed ? 0.25 : 0.7))) return cast(cpu, k, "QCB+K", opp.airborne ? BTN.HK : BTN.LK, 6);
    if (dist > 190 && dist < 340 && cpu.chance(0.12 + p.aggression * 0.2)) {
      const reel = cpu.chance(0.5);
      cast(cpu, k, "QCF+P", reel ? BTN.HP : BTN.LP);
      if (reel) cpu.push([{ dir: 5, frames: 26 }, { dir: 5, frames: 2, buttons: BTN.LP }, { dir: 5, frames: 6 }]);
      return true;
    }
    if (dist > 150 && dist < 300 && cpu.chance(p.aggression * 0.18)) {
      cpu.push([{ dir: 9, frames: 3 }, { dir: 5, frames: 13 }, { dir: 2, frames: 2, buttons: BTN.HK }, { dir: 5, frames: 1 }]);
      return true;
    }
    if (dist > 300 && cpu.chance(p.aggression * 0.6)) {
      cpu.push([{ dir: 6, frames: 2 }, { dir: 5, frames: 2 }, { dir: 6, frames: cpu.rng.int(14, 28) }, { dir: 6, frames: 2, buttons: dist < 420 ? BTN.HK : 0 }]);
      return true;
    }
    return false;
  },
};

registerKits(groupBKits);
