/**
 * Plug-in point for character-specific mechanics (stances, traps, turrets, buffs...).
 *
 * A mechanic lives in `src/combat/mechanics/<name>.js`, calls `registerMechanic(name, hooks)`
 * at import time, and is imported by the character file that uses it. Characters opt in with
 * `mechanics: ["name"]` (fighter-level hooks) and/or `mechanic: "name"` on a move (move-level
 * hooks, with `mechanicData` for parameters). Every hook is optional.
 *
 * Fighter-level hooks (character `mechanics`):
 *   init(fighter)                         once per round, after reset
 *   update(fighter, env)                  every simulated frame, before the state handler
 *   onMoveStart(fighter, move, env)       any move the fighter starts
 *   onHit(ctx) / onHurt(ctx)              after a hit lands (ctx below), as attacker / defender
 *   damageMul(fighter, ctx)               multiplier on outgoing damage (ctx below)
 *   damageTakenMul(fighter, ctx)          multiplier on incoming damage
 * Move-level hooks (move `mechanic`):
 *   onStart(fighter, move, env)           the frame the move starts
 *   onFrame(fighter, move, env)           every frame of the move (after built-in velocity)
 *   onHit(ctx)                            when this move hits or is blocked
 * ctx = { match, attacker, defender, props, blocked, damage }.
 * `env.match` is the live Match: spawnProjectile, applyContact, emit, vfx, spawnEntity.
 * Entities (`match.spawnEntity({...})`) get update(match) -> false to remove, and optional
 * draw(ctx) in world space.
 */
const registry = new Map();

export function registerMechanic(name, hooks) {
  if (!name || typeof hooks !== "object") throw new Error("registerMechanic(name, hooks)");
  registry.set(name, Object.freeze({ name, ...hooks }));
}

export function getMechanic(name) {
  return registry.get(name) || null;
}

export function mechanicNames() {
  return [...registry.keys()];
}

/** Fighter-level mechanics for a character def. */
export function fighterMechanics(def) {
  const out = [];
  for (const name of def.mechanics || []) {
    const m = registry.get(name);
    if (m) out.push(m);
  }
  return out;
}

/** Move-level mechanic, or null. */
export function moveMechanic(move) {
  return move?.mechanic ? registry.get(move.mechanic) || null : null;
}
