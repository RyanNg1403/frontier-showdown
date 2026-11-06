/**
 * Per-character CPU tactics. A kit file calls `registerKit(id, kit)` (or `registerKits({...})`)
 * at import time, and the character file imports it, so nobody edits a shared list.
 * `kit(cpu, k)` runs when the CPU is free to act and returns true when it queued an action;
 * `k` is `{ match, side, self, team, opp, dist, seen, steps }` (`steps` = `motionSteps`).
 */
const KITS = new Map();

export function registerKit(id, kit) {
  if (!id || typeof kit !== "function") throw new Error("registerKit(id, kit)");
  KITS.set(id, kit);
}

export function registerKits(map) {
  for (const [id, kit] of Object.entries(map)) registerKit(id, kit);
}

export function kitFor(id) {
  return KITS.get(id) || null;
}
