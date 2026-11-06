/**
 * Lab-affiliation passives (roster doc section 2.9). A fighter gets the passive whose id
 * matches `lab:<id>` in its sharedSkills (falling back to `labId`). Hooks are optional;
 * numeric fields replace the shared default for that fighter.
 *
 * Hooks read by the engine:
 *   damageMul(f, ctx)            outgoing damage multiplier; ctx = { defender, team, props, antiAir }
 *   onSpecialHit(f, moveId)      a special of this fighter hit
 *   onHitLanded(f, ctx)          any hit of this fighter landed
 *   onBlockedSpecial(f, moveId)  this fighter blocked an opponent's special
 *   onKnockdown(f)               this fighter was knocked down
 *   chipTakenMul(f)              incoming chip multiplier
 *   alignmentWindow(f)           Alignment Block window in frames
 *   meterGainMul(f, team)        multiplier on Compute gained from attacking
 *   antiAir                      { damage, hitstun } bonus on hits vs airborne targets from the ground
 * Numeric fields: dashFramesCut, tagEntryCut, scalingOffset, runwayRegenMul, scaleUpCost,
 * breakerCost, assistCooldownMul, assistCooldownAdd, objectLifetimeMul, autoTechThrows.
 */
const PASSIVES = {
  openai: {
    name: "Iterative Deployment",
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
  "google-deepmind": {
    name: "Self-Play",
    onBlockedSpecial(f, moveId) {
      if (f.passive.selfPlayUsed) return;
      f.passive.blocked ??= {};
      f.passive.blocked[moveId] = (f.passive.blocked[moveId] || 0) + 1;
      if (f.passive.blocked[moveId] >= 2) f.passive.selfPlayArmed = true;
    },
    damageMul(f) {
      return f.passive.selfPlayArmed ? 1.15 : 1;
    },
    onHitLanded(f) {
      if (f.passive.selfPlayArmed) {
        f.passive.selfPlayArmed = false;
        f.passive.selfPlayUsed = true;
      }
    },
  },
  meta: {
    name: "Move Fast (with Stable Infra)",
    dashFramesCut: 2,
    tagEntryCut: 4,
  },
  xai: {
    name: "Colossus Spin-up",
    meterGainMul: (f) => (f.health / f.maxHealth < 0.5 ? 1.15 : 1),
  },
  nvidia: {
    name: "The More You Buy",
    damageMul: (f, ctx) => 1 + 0.03 * Math.min(3, Math.floor((ctx.team?.meter ?? 0) / 100)),
  },
  ssi: {
    name: "Straight Shot",
    scalingOffset: 1,
    assistCooldownAdd: 60,
  },
  mistral: {
    name: "Capital Efficient",
    runwayRegenMul: 1.25,
  },
  deepseek: {
    name: "Cheap Training",
    scaleUpCost: 75,
  },
  "microsoft-ai": {
    name: "Copilot",
    autoTechThrows: 1,
    assistCooldownMul: 0.8,
  },
  "ami-labs": {
    name: "World Model",
    antiAir: { damage: 1.1, hitstun: 2 },
  },
  uoft: {
    name: "Emeritus",
    breakerCost: 100,
  },
  "world-labs": {
    name: "Spatial Intelligence",
    objectLifetimeMul: 1.25,
  },
};

export const PASSIVE_IDS = Object.freeze(Object.keys(PASSIVES));

export function passiveFor(def) {
  const tag = (def.sharedSkills || []).find((s) => s.startsWith("lab:"));
  const id = tag ? tag.slice(4) : def.labId;
  return PASSIVES[id] ? { id, ...PASSIVES[id] } : null;
}

export function passiveName(def) {
  return passiveFor(def)?.name ?? null;
}
