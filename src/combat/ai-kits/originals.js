import { BTN } from "../constants.js";
import { registerKits } from "./index.js";

/**
 * CPU tactics for Sam and Dario, the parts the generic CPU leaves out: Sam fireballs at range
 * and teleports behind recovering zoners; Dario walls off fireballs, zones with geniuses and
 * counters close attacks, and mixes low pokes and sweeps up close. Each kit returns true when it
 * queued an action.
 */
function ownProjectile(k) {
  return k.match.projectiles.some((p) => p.ownerUid === k.self.uid && !p.dead);
}

function oppProjectile(k) {
  return k.match.projectiles.some((p) => p.side !== k.side && !p.dead);
}

function cast(cpu, k, input, button, cooldown = 0) {
  cpu.push(k.steps(input, button));
  if (cooldown) cpu.cooldown = cooldown;
  return true;
}

registerKits({
  sam(cpu, k) {
    const { seen, dist } = k;
    const p = cpu.p;
    if (seen.recovering && dist > 200 && dist < 460 && cpu.chance(p.punish * 0.8)) return cast(cpu, k, "QCB+K", BTN.HK);
    if (!ownProjectile(k) && dist > 320 && cpu.chance(p.zoning * 0.9)) return cast(cpu, k, "QCF+P", dist > 480 ? BTN.HP : BTN.LP, 8);
    if (dist > 180 && dist < 320 && cpu.chance(p.aggression * 0.12)) return cast(cpu, k, "QCB+K", BTN.LK);
    return false;
  },
  dario(cpu, k) {
    const { match, self, seen, dist } = k;
    const p = cpu.p;
    const walled = match.barriers.some((w) => w.ownerUid === self.uid);
    if (!walled && oppProjectile(k) && dist > 220 && cpu.chance(p.zoning * 1.2)) return cast(cpu, k, "D,N,B+P", BTN.LP, 6);
    if (seen.attacking && seen.level !== "low" && dist < 160 && cpu.chance(p.punish * 0.5)) return cast(cpu, k, "QCB+P", BTN.LP);
    if (!ownProjectile(k) && dist > 300 && cpu.chance(p.zoning * 0.8)) return cast(cpu, k, "QCF+P", dist > 460 ? BTN.HP : BTN.LP, 8);
    if (!walled && dist > 420 && cpu.chance(p.zoning * 0.4)) return cast(cpu, k, "D,N,B+P", BTN.HP, 6);
    if (!seen.attacking && dist < 170 && cpu.chance(p.aggression * 0.5)) {
      cpu.press(2, cpu.chance(0.5) ? BTN.HK : BTN.LK);
      return true;
    }
    return false;
  },
});
