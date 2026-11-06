/**
 * Lab passives for DeepSeek, Microsoft AI and AMI Labs (roster doc 2.9), merged into
 * `src/combat/passives.js`. Hooks beyond the engine's (`damageMul`, `chipTakenMul`,
 * `alignmentWindow`, `onSpecialHit`, `onKnockdown`) are read by the mechanics layer:
 * `scaleUpCost`, `autoTechThrows`, `assistCooldownMul` and `modifyContact`.
 * This module must not import the mechanics layer (it loads during character definition).
 */
export const LAB_PASSIVES = {
  deepseek: {
    name: "Cheap Training",
    /** Scale Up costs 75 Compute instead of 100. Liang's 2-bar super lives in his data. */
    scaleUpCost: () => 75,
  },
  "microsoft-ai": {
    name: "Copilot",
    /** Automatically techs the first techable throw each round. */
    autoTechThrows: 1,
    /** 2v2: the assist cooldown after this fighter's assist is 20% shorter. */
    assistCooldownMul: 0.8,
  },
  "ami-labs": {
    name: "World Model",
    /**
     * Anti-air: a hit from the ground (a grounded strike, or a projectile thrown from the
     * ground) on an opponent who is in the air on their own (jumping, not juggled) deals
     * +10% damage and +2 hitstun.
     */
    modifyContact(a, d, props, info) {
      const fromGround = info.projectile ? info.projectile.fromGround !== false : !a.airborne;
      if (!fromGround || !d.airborne || d.state === "juggle") return;
      props.damage *= 1.1;
      props.hitstun += 2;
      props.antiAir = true;
    },
  },
};
