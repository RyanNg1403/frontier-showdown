import { defineCharacter } from "./schema.js";

/**
 * Liang Wenfeng, "The Quiet Whale" (roster doc 3.11). Glass cannon with the cheapest meter in
 * the game: a parry that pays out Compute, a compressed projectile, a three-shadow mix-up
 * rush and a 2-bar super (Cheap Training passive also makes his Scale Up cost 75).
 */

const SHADOW_BOXES = {
  high: { x: 24, y: -192, w: 104, h: 34 },
  mid: { x: 24, y: -146, w: 110, h: 44 },
  low: { x: 24, y: -40, w: 116, h: 34 },
  overhead: { x: 16, y: -214, w: 100, h: 120 },
};
const shadows = (levels) => ({
  hitLevels: levels,
  hitboxes: levels.map((l) => SHADOW_BOXES[l]),
  followUp: {
    name: "Reinforced Strike", anim: "heavy_kick", limb: "leg", startup: 4, active: 3, recovery: 20, damage: 50,
    hitstun: 26, blockstun: 16, hitbox: { x: 0, y: -170, w: 132, h: 150 }, knockback: { x: 320, y: 480 },
    knockdown: true, level: "mid", meterGain: 4, juggle: 1, velocity: [{ from: 1, to: 6, vx: 360 }],
  },
});
const pellet = (mech = {}) => ({ look: "pellet", burst: 2.4, ...mech });

export default defineCharacter({
  id: "liang",
  name: "Liang Wenfeng",
  shortName: "Liang",
  title: "The Quiet Whale",
  lab: "DeepSeek",
  labId: "deepseek",
  archetype: "glass cannon",
  difficulty: 3,
  bio: "Very still, then suddenly precise. Banks Compute with Aha Moment parries and cheap Scale Ups, then cashes out with 2-bar Whale Breach supers more often than anyone else. The lowest health and weight on the roster.",
  quotes: {
    intro: "Innovation isn't entirely business-driven; it also requires curiosity and a desire to create.",
    victory: ["The real gap lies between originality and imitation.", "…moats created by closed source are temporary."],
  },
  palette: {
    primary: "#6b6e75",
    secondary: "#2a2b30",
    accent: "#4d6bfe",
    shirt: "#f4f4f4",
    skin: "#efd2b5",
    hair: "#141414",
    shoes: "#111111",
    glasses: "#2a2a2a",
    hairStyle: "bangs",
  },
  stats: { health: 900, walkSpeed: 205, runSpeed: 470, jump: 205, weight: 0.85 },
  normals: {
    lp: {
      name: "6-Frame Jab", startup: 6, active: 2, recovery: 10, damage: 22, hitstun: 16, blockstun: 13,
      hitbox: { x: 22, y: -166, w: 84, h: 24 }, knockback: { x: 150 }, level: "high", meterGain: 3,
      cancelInto: ["lp", "hp", "special", "super"],
    },
    hp: {
      name: "Cobalt Straight", startup: 11, active: 3, recovery: 19, damage: 60, hitstun: 22, blockstun: 17,
      hitbox: { x: 24, y: -170, w: 106, h: 30 }, knockback: { x: 280 }, level: "high", meterGain: 5,
      cancelInto: ["special", "super"],
    },
    lk: {
      name: "Snap Kick", startup: 8, active: 3, recovery: 14, damage: 28, hitstun: 16, blockstun: 13,
      hitbox: { x: 20, y: -100, w: 96, h: 26 }, knockback: { x: 180 }, level: "mid", meterGain: 4,
      cancelInto: ["hk", "special", "super"],
    },
    hk: {
      name: "Turning Kick", startup: 13, active: 4, recovery: 21, damage: 70, hitstun: 24, blockstun: 18,
      hitbox: { x: 28, y: -156, w: 118, h: 40 }, knockback: { x: 350 }, level: "mid", meterGain: 6,
      cancelInto: ["special", "super"],
    },
    c_lp: {
      name: "Quiet Tap", startup: 7, active: 2, recovery: 11, damage: 18, hitstun: 15, blockstun: 12,
      hitbox: { x: 18, y: -100, w: 82, h: 22 }, knockback: { x: 140 }, level: "mid", meterGain: 3,
      cancelInto: ["c_lp", "c_lk", "special", "super"],
    },
    c_lk: {
      name: "Low Ripple", startup: 8, active: 2, recovery: 13, damage: 20, hitstun: 15, blockstun: 12,
      hitbox: { x: 20, y: -28, w: 104, h: 24 }, knockback: { x: 150 }, level: "low", meterGain: 3,
      cancelInto: ["c_lp", "special", "super"],
    },
    c_hp: {
      name: "Whale Tail", startup: 10, active: 3, recovery: 28, damage: 95, hitstun: 30, blockstun: 18,
      hitbox: { x: 6, y: -222, w: 80, h: 140 }, knockback: { x: 110, y: 1180 }, level: "mid", meterGain: 6,
      hitstop: 13, cancelInto: ["special", "super"],
    },
    c_hk: {
      name: "Price Cut Sweep", startup: 12, active: 3, recovery: 27, damage: 66, hitstun: 24, blockstun: 18,
      hitbox: { x: 18, y: -26, w: 136, h: 26 }, knockback: { x: 200, y: 320 }, level: "low", knockdown: true,
      meterGain: 5,
    },
    j_p: {
      name: "Falling Palm", startup: 8, active: 6, recovery: 8, damage: 55, hitstun: 20, blockstun: 16,
      hitbox: { x: 10, y: -134, w: 84, h: 42 }, knockback: { x: 180 }, level: "overhead", meterGain: 4,
    },
    j_k: {
      name: "Cobalt Dropkick", startup: 7, active: 7, recovery: 8, damage: 56, hitstun: 20, blockstun: 16,
      hitbox: { x: 8, y: -92, w: 104, h: 48 }, knockback: { x: 200 }, level: "overhead", meterGain: 4,
    },
  },
  specials: [
    {
      id: "aha_moment", name: "Aha Moment", input: "D,N,B+P",
      description: "\"Wait, wait. Wait.\" Parries any strike or projectile on frames 3-14: +25 Compute and +12 f advantage. Throws beat it. Scale Up: an automatic 90-damage follow-up on success.",
      startup: 3, active: 12, recovery: 24, damage: 0, meterGain: 0, vfx: "lab_aura",
      mech: { parry: { from: 3, to: 14, meter: 25, advantage: 12, projectiles: true } },
      scaleUp: {
        mech: {
          parry: {
            from: 3, to: 14, meter: 25, advantage: 12, projectiles: true,
            followUp: {
              name: "Aha! Follow-up", anim: "heavy_punch", startup: 4, active: 4, recovery: 18, damage: 90,
              hitstun: 28, blockstun: 16, hitbox: { x: 0, y: -190, w: 140, h: 170 }, knockback: { x: 380, y: 520 },
              knockdown: true, level: "mid", meterGain: 0, juggle: 1, velocity: [{ from: 1, to: 5, vx: 420 }],
            },
          },
        },
      },
    },
    {
      id: "latent_attention", name: "Latent Attention", input: "QCF+P",
      description: "A tiny, fast, hard-to-see cobalt pellet that decompresses into a large burst on contact. HP is slower but pierces one projectile. Scale Up: two pellets.",
      startup: 13, active: 2, recovery: 26, damage: 0, meterGain: 7, vfx: "special_deepseek",
      projectile: {
        speed: 720, hitbox: { x: -11, y: -8, w: 22, h: 16 }, offset: { x: 70, y: -128 }, lifetime: 120,
        damage: 65, chip: 8, hitstun: 20, blockstun: 15, knockback: { x: 220 }, vfx: "projectile_deepseek",
        meterGain: 8, scale: 0.35, mech: pellet(),
      },
      variants: {
        LP: { projectile: { speed: 720, durability: 1 } },
        HP: { projectile: { speed: 520, durability: 2 } },
      },
      scaleUp: { projectile: { mech: pellet({ echo: { delay: 8 } }) } },
    },
    {
      id: "group_relative", name: "Group Relative Strike", input: "B,F+K",
      description: "Three shadow copies strike high, mid and low in turn; guard each one right. If any lands, a reinforced fourth strike follows (50). LK short, HK long. Scale Up: a fourth, overhead shadow.",
      startup: 14, active: 9, recovery: 26, damage: 30, chip: 4, hitstun: 18, blockstun: 14, hits: 3, hitInterval: 3,
      hitbox: SHADOW_BOXES.mid, knockback: { x: 60 }, level: "mid", meterGain: 8, limb: "leg",
      velocity: [{ from: 2, to: 15, vx: 260 }], hitstop: 7, vfx: "special_deepseek", cancelInto: ["super"],
      mech: shadows(["high", "mid", "low"]),
      variants: {
        LK: { velocity: [{ from: 2, to: 15, vx: 260 }] },
        HK: { velocity: [{ from: 2, to: 15, vx: 470 }] },
      },
      scaleUp: { damage: 30, hits: 4, active: 12, mech: shadows(["high", "mid", "low", "overhead"]) },
    },
  ],
  super: {
    id: "whale_breach", name: "The Whale Breach", input: "QCF,QCF+HP", meterCost: 200, freeze: 30,
    description: "Breakthrough for 2 bars (Liang only). The floor floods ink-blue and a colossal cobalt whale breaches beneath the opponent, lifting them past a plunging stock ticker: \"$5.6M\".",
    startup: 8, active: 2, recovery: 48, damage: 0, meterGain: 0, invuln: { from: 1, to: 12, type: "all" }, vfx: "lab_beam",
    projectile: {
      speed: 0, hitbox: { x: -80, y: -230, w: 160, h: 240 }, offset: { x: 0, y: -10 }, lifetime: 34,
      damage: 70, chip: 14, hitstun: 26, blockstun: 12, hits: 4, hitInterval: 6, knockback: { x: 60, y: 760 },
      knockdown: true, vfx: "projectile_deepseek", durability: 6, meterGain: 0, scale: 2,
      mech: { spawnAt: "opponent", y: -10, look: "whale" },
    },
  },
  throw: { name: "Price War", damage: 105 },
  finisher: {
    id: "mit_license", name: "MIT License", input: "F,D,B+LK", range: "mid",
    description: "The opponent is compressed into a glowing file icon labelled \"weights\" and uploaded to a public shelf. Dozens of tiny downloaded copies pop out and wave at the camera.",
    vfx: "finisher_mit_license",
  },
  assists: { a: "latent_attention", b: "group_relative" },
  sharedSkills: ["dash", "run", "throw", "throw_tech", "block", "alignment_block", "guardrail", "scale_up", "rollback", "breakthrough", "tag", "assist", "swap_guard", "lab:deepseek"],
});
