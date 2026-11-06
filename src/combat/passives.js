/**
 * Lab-affiliation passives (roster doc section 2.9). A fighter gets the passive whose id
 * matches `lab:<labId>` in its sharedSkills. Hooks are optional; missing ones are no-ops.
 */
const PASSIVES = {
  openai: {
    name: "Iterative Deployment",
    /** Each different special that hits in a round gives +4% damage, up to 3 stacks. */
    onSpecialHit(f, moveId) {
      f.passive.specials ??= new Set();
      f.passive.specials.add(moveId);
    },
    damageMul(f) {
      return 1 + 0.04 * Math.min(3, f.passive.specials?.size ?? 0);
    },
    onKnockdown(f) {
      f.passive.specials?.clear();
    },
  },
  anthropic: {
    name: "Responsible Scaling",
    chipTakenMul: () => 0.7,
    alignmentWindow: () => 4,
  },
  meta: {
    name: "Move Fast (with Stable Infra)",
    /** Forward dash 2 f shorter; in 2v2 the hand-off entry is 4 f faster. */
    dashFwdDelta: -2,
    handoffEntryDelta: -4,
  },
  xai: {
    name: "Colossus Spin-up",
    /** +15% Compute gain while below 50% health. */
    meterGainMul: (f) => (f.health / f.maxHealth < 0.5 ? 1.15 : 1),
  },
};

export function passiveFor(def) {
  const tag = (def.sharedSkills || []).find((s) => s.startsWith("lab:"));
  const id = tag ? tag.slice(4) : def.labId;
  return PASSIVES[id] ? { id, ...PASSIVES[id] } : null;
}

export function passiveName(def) {
  return passiveFor(def)?.name ?? null;
}
