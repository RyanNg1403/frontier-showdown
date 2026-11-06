import { BTN } from "../constants.js";
import { registerKits } from "./index.js";

/**
 * CPU tactics for Andrej, Yann, Liang and Mustafa. Each kit runs when the CPU is free to act
 * and returns true when it queued an action; otherwise the generic CPU logic decides.
 * `k` is `{ match, side, self, team, opp, dist, seen, steps }` (`steps` = `motionSteps`).
 */

const BUTTON = { LP: BTN.LP, HP: BTN.HP, LK: BTN.LK, HK: BTN.HK };

function cast(cpu, k, id, button = null, cooldown = 8) {
  const sp = k.self.def.specials.find((s) => s.id === id);
  if (!sp) return false;
  cpu.push(k.steps(sp.input, button ? BUTTON[button] : null));
  cpu.cooldown = cooldown;
  return true;
}

function ownProjectile(k) {
  return k.match.projectiles.some((p) => p.ownerUid === k.self.uid && p.category !== "super");
}

function incomingProjectile(k, range) {
  const { match, self, side } = k;
  return match.projectiles.find((p) => p.side !== side && !p.dead && Math.sign(self.x - p.x) === Math.sign(p.vx) && Math.abs(self.x - p.x) < range);
}

function ownObject(k, type) {
  return k.match.mech.objects.find((o) => !o.dead && o.ownerUid === k.self.uid && o.type === type);
}

function healthLead(k) {
  return k.self.health / k.self.maxHealth - k.opp.health / k.opp.maxHealth;
}

/** Press a chain of `[relativeDir, button]` normals with short gaps. */
function chain(cpu, links, gap = 6) {
  for (const [dir, button] of links) cpu.push([{ dir, buttons: button, frames: 2 }, { dir: 5, frames: gap }]);
}

export const groupCKits = {
  andrej(cpu, k) {
    const { match, self, dist, opp } = k;
    const p = cpu.p;
    if (match.mech.status(self, "stance")) {
      if (opp.isLying) {
        cpu.hold(5, 6);
        return true;
      }
      if (dist > 170) {
        cpu.hold(6, cpu.rng.int(6, 12));
        return true;
      }
      const routes = [
        [[6, BTN.LP], [5, BTN.LP], [5, BTN.HP], [5, BTN.HK]],
        [[5, BTN.LK], [5, BTN.HP], [2, BTN.HP]],
        [[5, BTN.LP], [5, BTN.LK], [5, BTN.HK]],
        [[2, BTN.LK], [2, BTN.LP], [5, BTN.HP], [5, BTN.HK]],
      ];
      chain(cpu, cpu.rng.pick(routes), 5);
      if (cpu.chance(p.combo)) cast(cpu, k, cpu.chance(0.5) ? "tokenizer" : "rubiks_rotation", null, 4);
      return true;
    }
    if (dist > 240 && healthLead(k) > 0.02 && cpu.chance(p.zoning * 0.35)) {
      const scale = k.team.meter >= 200 && cpu.chance(p.superUse * 0.5);
      cast(cpu, k, "vibe_coding");
      if (scale) cpu.push([{ dir: 5, frames: 1 }, { dir: 5, buttons: BTN.BLOCK, frames: 1 }]);
      return true;
    }
    if (dist > 300 && cpu.chance(p.zoning * 0.06)) return cast(cpu, k, "vibe_coding");
    if (dist > 220 && !ownProjectile(k) && cpu.chance(p.zoning * 0.5)) return cast(cpu, k, "tokenizer", dist > 420 ? "HP" : "LP", 10);
    if (dist < 130 && cpu.chance(0.1 + p.aggression * 0.1)) {
      chain(cpu, [[6, BTN.LP], [5, BTN.LP], [5, BTN.HP]], 9);
      return true;
    }
    return false;
  },

  yann(cpu, k) {
    const { self, dist, seen } = k;
    const p = cpu.p;
    if (seen.airborne && !seen.lying && dist > 170 && dist < 430 && !ownProjectile(k) && cpu.chance(p.antiAir * 0.6)) {
      return cast(cpu, k, "rc_air_strike", "LP", 6);
    }
    const inc = incomingProjectile(k, 260);
    if (inc && Math.abs(self.x - inc.x) > 150 && cpu.chance(p.block * 0.4)) {
      cpu.press(4, BTN.HP);
      cpu.cooldown = 10;
      return true;
    }
    if (!ownObject(k, "trap") && dist > 240 && cpu.chance(p.zoning * 0.3)) return cast(cpu, k, "cake_analogy", null, 8);
    if (ownProjectile(k)) return false;
    if (dist > 380 && cpu.chance(p.zoning * 0.22)) return cast(cpu, k, "rc_air_strike", "HP", 10);
    if (dist > 210 && cpu.chance(p.zoning * 0.55)) return cast(cpu, k, "convolution", dist > 450 ? "HP" : "LP", 10);
    return false;
  },

  liang(cpu, k) {
    const { self, team, dist, seen } = k;
    const p = cpu.p;
    const inc = incomingProjectile(k, 400);
    if (inc) {
      const frames = (Math.abs(self.x - inc.x) - 60) / Math.max(60, Math.abs(inc.vx)) * 60;
      if (frames > 3 && frames < 11 && cpu.chance(p.block * 0.8)) return cast(cpu, k, "aha_moment", null, 4);
    }
    if (seen.attacking && dist < 210 && seen.level !== "unblockable" && cpu.chance(p.punish * 0.4)) {
      const scale = team.meter >= 75 && cpu.chance(p.superUse * 0.5);
      cast(cpu, k, "aha_moment", null, 4);
      if (scale) cpu.push([{ dir: 5, buttons: BTN.BLOCK, frames: 1 }]);
      return true;
    }
    if (self.def.super && team.meter >= self.def.super.meterCost && cpu.chance(p.superUse * 0.05)) {
      cpu.push(k.steps(self.def.super.input));
      return true;
    }
    if (dist > 130 && dist < 310 && cpu.chance(p.aggression * 0.12)) return cast(cpu, k, "group_relative", dist > 220 ? "HK" : "LK", 8);
    if (dist > 300 && !ownProjectile(k) && cpu.chance(p.zoning * 0.55)) return cast(cpu, k, "latent_attention", cpu.chance(0.5) ? "HP" : "LP", 10);
    return false;
  },

  mustafa(cpu, k) {
    const { opp, dist } = k;
    const p = cpu.p;
    const orb = ownObject(k, "companion");
    if (orb && !orb.returning && orb.timer > 6 && Math.abs(opp.x - orb.x) < 70 && cpu.chance(0.5 + p.punish * 0.4)) {
      return cast(cpu, k, "copilot", null, 4);
    }
    if (!ownObject(k, "zone") && dist > 170 && dist < 520 && cpu.chance(p.zoning * 0.35)) {
      return cast(cpu, k, "containment_field", dist > 320 ? "HP" : "LP", 8);
    }
    if (!orb && dist > 150 && dist < 480 && cpu.chance(p.zoning * 0.3)) return cast(cpu, k, "copilot", dist > 300 ? "HP" : "LP", 6);
    if (dist > 260 && !ownProjectile(k) && cpu.chance(p.zoning * 0.5)) return cast(cpu, k, "coming_wave", null, 10);
    return false;
  },
};

registerKits(groupCKits);
