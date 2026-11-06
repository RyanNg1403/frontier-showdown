import { RULES } from "./constants.js";

/** Damage multiplier for the nth hit (1-based) of a combo. */
export function comboScale(hitIndex, { isSuper = false } = {}) {
  if (hitIndex < RULES.scalingStartHit) return 1;
  const scaled = 1 - RULES.scalingStep * (hitIndex - RULES.scalingStartHit + 1);
  return Math.max(isSuper ? RULES.superScalingMin : RULES.scalingMin, scaled);
}

export function scaledDamage(base, hitIndex, { isSuper = false, counter = false } = {}) {
  const counterMul = counter && hitIndex === 1 ? RULES.counterBonus : 1;
  return Math.max(1, Math.round(base * comboScale(hitIndex, { isSuper }) * counterMul));
}

/** Which guards stop an attack level. */
export function guardBlocks(level, crouching) {
  if (level === "unblockable") return false;
  if (level === "low") return crouching;
  if (level === "overhead") return !crouching;
  return true;
}

/** Gains go through the point fighter's lab passive (`meterGainMul`). */
export function addMeter(side, amount) {
  const point = side.members?.[side.active];
  if (amount > 0 && point?.passiveDef?.meterGainMul) amount *= point.passiveDef.meterGainMul(point);
  side.meter = Math.max(0, Math.min(RULES.meterMax, side.meter + amount));
  return side.meter;
}

export function meterOnHit(move, damage) {
  return {
    attacker: move.meterGain ?? Math.round(damage * 0.25),
    defender: Math.round(damage * RULES.defenderMeterRatio),
  };
}

/** Apply damage with red (recoverable) health tracking. Returns damage dealt. */
export function applyDamage(fighter, amount, { redRatio = 0, floor = 0, replaceRed = false } = {}) {
  const before = fighter.health;
  fighter.health = Math.max(floor, fighter.health - amount);
  const dealt = before - fighter.health;
  if (replaceRed) fighter.red = 0;
  if (redRatio > 0) {
    fighter.red = Math.min(fighter.maxHealth - fighter.health, fighter.red + dealt * redRatio);
  } else {
    fighter.red = Math.min(fighter.red, fighter.maxHealth - fighter.health);
  }
  return dealt;
}

export function regenRed(fighter, dt) {
  if (fighter.red <= 0 || fighter.health <= 0) return 0;
  const amount = Math.min(fighter.red, RULES.redRegenPerSecond * dt);
  fighter.red -= amount;
  fighter.health = Math.min(fighter.maxHealth, fighter.health + amount);
  return amount;
}

/** Time-out winner by health share. Returns side index or null for a draw. */
export function timeUpWinner(shares) {
  if (Math.abs(shares[0] - shares[1]) < 1e-6) return null;
  return shares[0] > shares[1] ? 0 : 1;
}
