import { BTN } from "../constants.js";
import { registerKits } from "./index.js";

/**
 * CPU tactics for Mark and Elon, driven by the `ai` hints in their character files. Hint keys:
 *   antiAir, evade, punish, pressure, approach, jumpIn: move ids ("id" or "id:HP" for a button
 *     variant), or a normalized move object for moves a mechanic starts (Elon's Walrus);
 *   grabRate: how often to go for the command grab up close;
 *   superRange: max distance for the super (grab supers also need a grabbable opponent);
 *   projectileRange: [min, max] distance for the projectile special.
 * The kit returns true when it queued an action; otherwise the generic CPU decides.
 */

function entries(self, key) {
  const raw = self.def.raw?.ai?.[key];
  if (!raw) return [];
  return (Array.isArray(raw) ? raw : [raw]).map((entry) => {
    if (entry && typeof entry === "object") return entry.startup ? { move: entry, button: null } : null;
    const [id, btn] = String(entry).split(":");
    const move = self.def.moves.get(id);
    return move ? { move, button: btn ? BTN[btn] : null } : null;
  }).filter(Boolean);
}

/** Horizontal reach of a hinted move, including its forward travel. */
function reach(entry) {
  const name = Object.keys(BTN).find((k) => BTN[k] === entry.button);
  const m = entry.move.variants?.[name] || entry.move;
  if (m.grab) return m.grab.range;
  if (m.mechanicData?.range) return m.mechanicData.range;
  if (m.projectile) return 9999;
  const travel = m.velocity.reduce((t, v) => t + Math.max(0, v.vx ?? 0) * Math.max(0, Math.min(v.to, m.startup + m.active) - v.from + 1) / 60, 0);
  return (m.hitbox ? m.hitbox.x + m.hitbox.w : 0) + travel;
}

function inReach(self, key, dist) {
  return entries(self, key).filter((e) => reach(e) >= dist);
}

function use(cpu, k, entry) {
  const m = entry.move;
  if (m.category !== "normal") {
    cpu.push(k.steps(m.input, entry.button));
    return true;
  }
  const dir = m.id.startsWith("c_") || m.id.startsWith("j_d") ? 2 : m.id.startsWith("f_") ? 6 : m.id.startsWith("b_") ? 4 : 5;
  const btn = { lp: BTN.LP, hp: BTN.HP, lk: BTN.LK, hk: BTN.HK }[m.id.slice(-2)] ?? BTN.HP;
  if (m.air) cpu.push([{ dir: 9, frames: 4 }, { dir: 5, frames: 14 }, { dir, buttons: btn, frames: 2 }, { dir: 5, frames: 12 }]);
  else cpu.press(dir, btn);
  return true;
}

/** Could a grab connect on this opponent right now (grounded, not stunned or blocking)? */
export function grabbable(opp) {
  return !opp.airborne && !opp.isStunned && opp.state !== "blockstun" && !opp.isLying;
}

function hintKit(cpu, k) {
  const { match, side, self, team, opp, dist, seen } = k;
  const p = cpu.p;
  const hints = self.def.raw?.ai || {};
  const pick = (list) => use(cpu, k, cpu.rng.pick(list));

  const incoming = match.projectiles.find((pr) => pr.side !== side && Math.sign(self.x - pr.x) === Math.sign(pr.vx) && Math.abs(self.x - pr.x) < 360);
  const evade = incoming && entries(self, "evade")[0];
  if (evade && cpu.chance(p.punish * 0.6)) return use(cpu, k, evade);

  if (seen.airborne && !seen.lying && seen.state !== "juggle" && dist < 250 && seen.y < -40) {
    const aa = entries(self, "antiAir")[0];
    if (aa && cpu.chance(p.antiAir)) return use(cpu, k, aa);
  }

  if ((seen.attacking && dist < 230) || seen.lying) return false;

  if (seen.recovering && dist < 200 && cpu.chance(p.punish)) {
    const list = inReach(self, "punish", dist);
    if (list.length) return pick(list);
  }

  const sup = self.def.super;
  if (sup && self.canSuper({ team }, sup)) {
    const range = hints.superRange ?? (sup.projectile ? 600 : 220);
    if (dist < range && (!sup.grab || grabbable(opp)) && cpu.chance(p.superUse * 0.04)) {
      cpu.push(k.steps(sup.input));
      return true;
    }
    if (sup.grab && dist >= range && dist < 220 && cpu.chance(0.3)) {
      cpu.hold(6, 8);
      return true;
    }
  }

  const proj = self.def.specials.find((s) => s.projectile);
  const [lo, hi] = hints.projectileRange || [0, Infinity];
  if (proj && dist > 170 && cpu.chance(p.zoning * 0.6)) {
    if (dist >= lo && dist <= hi && !match.projectiles.some((pr) => pr.ownerUid === self.uid)) {
      cpu.push(k.steps(proj.input));
      cpu.cooldown = 10;
    } else {
      cpu.hold(dist < lo ? 4 : 6, 10);
    }
    return true;
  }

  if (dist < 170) {
    const grab = self.def.specials.find((s) => s.grab);
    if (grab && hints.grabRate && dist < grab.grab.range - 10 && grabbable(opp) && cpu.chance(hints.grabRate * 0.5)) {
      cpu.push(k.steps(grab.input));
      return true;
    }
    const pressure = inReach(self, "pressure", dist);
    if (pressure.length && cpu.chance(0.08 + p.aggression * 0.15)) return pick(pressure);
    return false;
  }

  const reachable = [...inReach(self, "pressure", dist), ...inReach(self, "approach", dist)];
  if (reachable.length && cpu.chance(p.aggression * (dist > 420 ? 0.25 : 0.15))) {
    cpu.cooldown = 6;
    return pick(reachable);
  }
  const dive = entries(self, "jumpIn")[0];
  if (dive && dist < 420 && cpu.chance((0.18 * p.aggression + 0.05) * 0.6)) return use(cpu, k, dive);
  return false;
}

registerKits({ mark: hintKit, elon: hintKit });
