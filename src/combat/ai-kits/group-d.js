import { BTN } from "../constants.js";
import { stanceOf } from "../mechanics/stance-router.js";
import { constructsOf } from "../mechanics/targeting.js";
import { registerKits } from "./index.js";

/**
 * CPU tactics for Geoffrey, Noam, Chris and Fei-Fei, registered with `registerKits`; the Group D
 * character files import this file. Each kit runs when the CPU is free to act and returns true
 * when it queued an action; otherwise the generic CPU logic decides. `k` is `{ match, side, self, team, opp, dist, seen, steps }`.
 */

const BUTTON = { LP: BTN.LP, HP: BTN.HP, LK: BTN.LK, HK: BTN.HK };

function cast(cpu, k, id, button = null, cooldown = 0) {
  const sp = k.self.def.specials.find((s) => s.id === id);
  if (!sp) return false;
  cpu.push(k.steps(sp.input, button ? BUTTON[button] : null));
  cpu.cooldown = cooldown;
  return true;
}

function incomingProjectile(k, range) {
  const { match, self, side } = k;
  return match.projectiles.find((p) => p.side !== side && !p.dead && Math.sign(self.x - p.x) === Math.sign(p.vx) && Math.abs(self.x - p.x) < range);
}

const ownProjectile = (k) => k.match.projectiles.some((p) => p.ownerUid === k.self.uid && !p.dead && p.category !== "super");
const ownTraps = (k) => k.match.mech.objects.filter((o) => !o.dead && o.ownerUid === k.self.uid && o.type === "trap");
const rushing = (opp) => opp.state === "run" || opp.state === "dash_fwd";

/** Noam: read the opponent's habit and pick the expert that beats it (doc 3.14 game plan). */
const ORDER = ["striker", "grappler", "zoner", "guard"];
function wantedExpert(cpu, k) {
  const h = (k.self.mech.cpuHabits ??= { attacks: 0, blocks: 0, zoning: 0 });
  const { opp, match, self } = k;
  if (opp.isAttacking && Math.abs(opp.x - self.x) < 220) h.attacks += 1;
  if (opp.state === "block" || opp.state === "crouch_block" || opp.state === "blockstun") h.blocks += 1;
  if (match.projectiles.some((p) => p.side === opp.side)) h.zoning += 1;
  if (h.blocks > h.attacks * 1.5 && h.blocks > 20) return "grappler";
  if (h.zoning > 40 && h.zoning > h.attacks) return "striker";
  if (h.attacks > 30) return cpu.chance(0.5) ? "zoner" : "guard";
  return "striker";
}

function routeTo(cpu, k, target) {
  const cur = ORDER.indexOf(stanceOf(k.self));
  const first = (cur + 1) % ORDER.length;
  const extra = (ORDER.indexOf(target) - first + ORDER.length) % ORDER.length;
  cast(cpu, k, "mixture_of_experts", "LK");
  cpu.hold(5, 6);
  for (let i = 0; i < extra; i += 1) cpu.push([{ dir: 5, buttons: BTN.LK, frames: 1 }, { dir: 5, frames: 2 }]);
  cpu.hold(5, 10);
  return true;
}

export const groupDKits = {
  /** Counter predictable pressure, float clouds at range, Dropout through rushes. */
  geoffrey(cpu, k) {
    const { match, self, opp, dist, seen } = k;
    const p = cpu.p;
    if (incomingProjectile(k, 230) && cpu.chance(p.punish * 0.45)) return cast(cpu, k, "backpropagation", "LP");
    if (seen.attacking && dist < 210 && cpu.chance(p.punish * 0.4)) return cast(cpu, k, "backpropagation", seen.level === "low" ? "HP" : "LP");
    if (rushing(opp) && dist < 320 && cpu.chance(p.punish * 0.35)) return cast(cpu, k, "dropout", "HK");
    const clouds = match.projectiles.filter((pr) => pr.cloud && pr.ownerUid === self.uid && !pr.dead).length;
    if (dist > 280 && clouds < 2 && cpu.chance(p.zoning * 0.9)) return cast(cpu, k, "boltzmann_machine", "LP", 14);
    if (dist > 150 && dist < 250 && cpu.chance(0.12)) {
      cpu.press(5, cpu.chance(0.5) ? BTN.HK : BTN.LK);
      cpu.cooldown = 8;
      return true;
    }
    if (!seen.attacking && dist < 150 && cpu.chance(p.aggression * 0.3)) {
      cpu.press(2, cpu.chance(0.5) ? BTN.HK : BTN.LK);
      return true;
    }
    return false;
  },

  /** Route into the right expert, then play it: grab turtles, dart rushdown, parry pressure. */
  noam(cpu, k) {
    const { self, opp, dist, seen } = k;
    const p = cpu.p;
    const stance = stanceOf(self);
    const want = wantedExpert(cpu, k);
    if (want !== stance && dist > 200 && cpu.chance(stance ? p.combo * 0.2 : 0.5)) return routeTo(cpu, k, want);
    if (stance === "guard" && seen.attacking && seen.level !== "low" && dist < 200 && cpu.chance(p.punish * 0.5)) {
      cpu.press(5, BTN.HP);
      return true;
    }
    if (stance === "grappler" && dist < 95 && cpu.chance(0.25 + p.aggression * 0.3)) {
      cpu.press(5, BTN.HP);
      return true;
    }
    if (stance === "zoner" && dist > 200 && dist < 460 && cpu.chance(p.zoning)) {
      cpu.press(5, BTN.HK);
      cpu.cooldown = 10;
      return true;
    }
    if (dist > 260 && cpu.chance(p.zoning * 1.2)) return cast(cpu, k, "attention", opp.airborne || cpu.chance(0.3) ? "HP" : "LP", 12);
    if (dist > 150 && dist < 300 && cpu.chance(0.12 + p.aggression * 0.15)) return cast(cpu, k, "one_write_head", "LP");
    return false;
  },

  /** Mark first, place the bridge where they want to go, then trace through the marked target. */
  chris(cpu, k) {
    const { match, opp, dist } = k;
    const p = cpu.p;
    const marked = Boolean(match.mech.status(opp, "mark"));
    if (marked && dist < 1000 && cpu.chance(0.18 + p.aggression * 0.3)) return cast(cpu, k, "circuit_trace", dist < 220 ? "LK" : "HK");
    if (!marked && !ownProjectile(k) && dist > 220 && cpu.chance(p.zoning * 1.2)) return cast(cpu, k, "feature_visualization", "LP", 10);
    if (!ownTraps(k).length && dist > 160 && dist < 460 && cpu.chance(p.zoning * 0.7)) return cast(cpu, k, "golden_gate", dist > 280 ? "HP" : "LP", 8);
    return false;
  },

  /** Wall off zoners, shoot ImageNet over the wall, Spatial Step away when rushed. */
  feifei(cpu, k) {
    const { self, opp, dist } = k;
    const p = cpu.p;
    const built = constructsOf(k.match, self.uid);
    const wall = built.some((c) => c.type === "wall");
    const platform = built.some((c) => c.type === "platform");
    if ((rushing(opp) || opp.isAttacking) && dist < 200 && cpu.chance(p.punish * 0.4)) return cast(cpu, k, "spatial_step", platform ? "LK" : "HK");
    if (!built.length && dist > 260 && cpu.chance(p.zoning * 0.8)) return cast(cpu, k, "marble_world", cpu.chance(0.75) ? "HP" : "LP", 10);
    if (!ownProjectile(k) && dist > 240 && cpu.chance(p.zoning * (wall ? 1.6 : 1))) return cast(cpu, k, "imagenet", opp.airborne || cpu.chance(0.3) ? "HP" : "LP", 10);
    if (platform && self.floorY === 0 && dist < 260 && cpu.chance(0.08)) return cast(cpu, k, "spatial_step", "LK");
    return false;
  },
};
groupDKits.geoffrey.handlesProjectiles = true;

registerKits(groupDKits);
