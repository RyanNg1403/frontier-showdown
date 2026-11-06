import { defineCharacter } from "./schema.js";
import { bodyFor } from "../combat/mechanics/body-scale.js";
import "../combat/mechanics/rotation.js";
import "../combat/mechanics/grabs.js";
import "../combat/mechanics/advancing.js";
import "../combat/mechanics/guard-crush.js";
import "../combat/ai-kits/group-a.js";

/**
 * Mark Zuckerberg, "Send Me Location" (roster doc 3.3). Grappler: a 360 command grab, a
 * low-profile hydrofoil slide that goes under fireballs, and a guard-crushing rush.
 */
export default defineCharacter({
  id: "mark",
  name: "Mark Zuckerberg",
  shortName: "Mark",
  title: "Send Me Location",
  lab: "Meta",
  labId: "meta",
  archetype: "grappler",
  difficulty: 2,
  bio: "Brazilian jiu-jitsu competitor and Meta CEO. Conditions opponents to block Move Fast and Break Things, then takes them down with Send Me Location, and slides under fireballs on an electric hydrofoil.",
  quotes: {
    intro: "Send me location.",
    victory: ["Senator, we run ads."],
    timeOver: "You practice these things like a hundred times, and then you never know what's gonna happen.",
    rival: { elon: "Send me location." },
  },
  palette: {
    primary: "#141418",
    secondary: "#1d1d24",
    accent: "#1877f2",
    shirt: "#f0c2a8",
    skin: "#f0c2a8",
    hair: "#9a7550",
    shoes: "#e8b59a",
  },
  stats: { health: 1080, walkSpeed: 200, runSpeed: 460, jump: 200, weight: 1.1, height: 192 },
  ...bodyFor(192),
  mechanics: ["rotation-360", "grab-hold", "guard-crush"],
  normals: {
    lp: {
      name: "MMA Jab", startup: 6, active: 2, recovery: 11, damage: 28, hitstun: 16, blockstun: 13,
      hitbox: { x: 22, y: -160, w: 82, h: 24 }, knockback: { x: 150 }, level: "high", meterGain: 3,
      cancelInto: ["lp", "hp", "special", "super"],
    },
    hp: {
      name: "Overhand Right", startup: 12, active: 3, recovery: 21, damage: 70, hitstun: 22, blockstun: 17,
      hitbox: { x: 24, y: -168, w: 100, h: 34 }, knockback: { x: 280 }, level: "high", meterGain: 5,
      velocity: [{ from: 4, to: 12, vx: 90 }], cancelInto: ["special", "super"],
    },
    lk: {
      name: "Teep", startup: 9, active: 3, recovery: 16, damage: 35, hitstun: 16, blockstun: 13,
      hitbox: { x: 20, y: -112, w: 104, h: 28 }, knockback: { x: 300 }, level: "mid", meterGain: 4,
      cancelInto: ["hk", "special", "super"],
    },
    hk: {
      name: "Muay Thai Leg Kick", startup: 13, active: 3, recovery: 22, damage: 76, hitstun: 22, blockstun: 17,
      hitbox: { x: 22, y: -58, w: 112, h: 32 }, knockback: { x: 220 }, level: "low", meterGain: 6,
      cancelInto: ["special", "super"],
    },
    c_lp: {
      name: "Clinch Jab", startup: 7, active: 2, recovery: 12, damage: 24, hitstun: 15, blockstun: 12,
      hitbox: { x: 18, y: -98, w: 80, h: 22 }, knockback: { x: 140 }, level: "mid", meterGain: 3,
      cancelInto: ["c_lp", "c_lk", "special", "super"],
    },
    c_lk: {
      name: "Ankle Pick", startup: 8, active: 2, recovery: 15, damage: 25, hitstun: 15, blockstun: 12,
      hitbox: { x: 20, y: -26, w: 100, h: 24 }, knockback: { x: 150 }, level: "low", meterGain: 3,
      cancelInto: ["c_lp", "special", "super"],
    },
    c_hp: {
      name: "Double-Underhook Lift", startup: 10, active: 4, recovery: 28, damage: 120, hitstun: 30, blockstun: 18,
      hitbox: { x: 6, y: -210, w: 80, h: 140 }, knockback: { x: 100, y: 1150 }, level: "mid", meterGain: 6,
      hitstop: 13, cancelInto: ["special", "super"],
    },
    c_hk: {
      name: "Single-Leg Sweep", startup: 13, active: 3, recovery: 28, damage: 80, hitstun: 24, blockstun: 18,
      hitbox: { x: 18, y: -26, w: 136, h: 26 }, knockback: { x: 200, y: 320 }, level: "low", knockdown: true,
      meterGain: 5,
    },
    j_p: {
      name: "Flying Knee", startup: 8, active: 6, recovery: 8, damage: 60, hitstun: 20, blockstun: 16,
      hitbox: { x: 8, y: -122, w: 82, h: 48 }, knockback: { x: 190 }, level: "overhead", meterGain: 4, limb: "leg",
    },
    j_k: {
      name: "Jumping Teep", startup: 7, active: 7, recovery: 8, damage: 58, hitstun: 20, blockstun: 16,
      hitbox: { x: 8, y: -90, w: 104, h: 46 }, knockback: { x: 220 }, level: "overhead", meterGain: 4,
    },
  },
  specials: [
    {
      id: "send_me_location", name: "Send Me Location", input: "360+P", priority: 2,
      description: "Drops a blue map pin on the opponent (\"Location received\"), steps in and hits a double-leg takedown. Unblockable command grab; 360 or HCB,F + P. LP 160, HP 170 with more range but 2 frames slower. Scale Up: armored startup and +40 damage.",
      startup: 6, active: 2, recovery: 46, damage: 0, meterGain: 12, vfx: "special_meta",
      velocity: [{ from: 1, to: 5, vx: 120 }], mechanicData: { hold: 24 },
      grab: { range: 82, damage: 160, knockback: { x: 120, y: 520 } },
      variants: {
        LP: {
          grab: { range: 82, damage: 160, knockback: { x: 120, y: 520 } },
          scaleUp: { armor: { from: 1, to: 6, hits: 1 }, grab: { range: 82, damage: 200, knockback: { x: 120, y: 520 } } },
        },
        HP: {
          startup: 8,
          grab: { range: 90, damage: 170, knockback: { x: 120, y: 520 } },
          scaleUp: { armor: { from: 1, to: 8, hits: 1 }, grab: { range: 90, damage: 210, knockback: { x: 120, y: 520 } } },
        },
      },
      scaleUp: { armor: { from: 1, to: 6, hits: 1 }, grab: { range: 82, damage: 200, knockback: { x: 120, y: 520 } } },
    },
    {
      id: "hydrofoil_rush", name: "Hydrofoil Rush", input: "B,F+K",
      description: "Hops onto an electric hydrofoil and glides across a spray of blue water, ending in a low slide tackle. Projectile-invulnerable and low-profile from frame 8. LK travels 220 px, HK 360 px. Scale Up: ends with a wave splash that launches.",
      startup: 14, active: 20, recovery: 24, damage: 80, chip: 10, hitstun: 24, blockstun: 16,
      hitbox: { x: 8, y: -52, w: 104, h: 52 }, knockback: { x: 200, y: 300 }, knockdown: true, level: "low", meterGain: 8,
      velocity: [{ from: 4, to: 33, vx: 440 }], invuln: { from: 8, to: 33, type: "projectile" },
      mechanic: "low-profile-slide", mechanicData: { lowProfile: { from: 8, to: 33 }, stopOnContact: true },
      vfx: "lab_ground_wave", limb: "leg",
      variants: {
        LK: { velocity: [{ from: 4, to: 33, vx: 440 }] },
        HK: { velocity: [{ from: 4, to: 33, vx: 720 }] },
      },
      scaleUp: { knockback: { x: 140, y: 1100 }, knockdown: false },
    },
    {
      id: "move_fast", name: "Move Fast and Break Things", input: "QCF+P",
      description: "A four-punch flurry finishing with a shoulder. On block the shoulder drains 40 Runway (\"breaks things\"); an empty Runway means a guard break. Scale Up: Stable Infra, with 1-hit armor and +2 on block.",
      startup: 13, active: 10, recovery: 22, damage: 22, chip: 3, hitstun: 18, blockstun: 18, hits: 4, hitInterval: 3,
      hitbox: { x: 18, y: -170, w: 92, h: 110 }, knockback: { x: 50 }, level: "mid", meterGain: 3, hitstop: 6,
      velocity: [{ from: 3, to: 22, vx: 170 }], lastHit: { knockback: { x: 330 } },
      mechanicData: { guardCrush: { runway: 40 } }, vfx: "special_meta",
      scaleUp: { name: "Stable Infra", damage: 22, blockstun: 24, armor: { from: 1, to: 13, hits: 1 } },
    },
  ],
  super: {
    id: "metaverse_submission", name: "Metaverse Submission", input: "QCF,QCF+HP", meterCost: 300, freeze: 30,
    description: "Breakthrough. A close-range unblockable grab: the stage dissolves into a low-poly VR dojo, Mark chains takedown, mount and armbar position, the opponent taps, and the scoreboard flashes \"GOLD (NO-GI)\". Whiffs beyond 100 px.",
    startup: 7, active: 3, recovery: 60, damage: 0, meterGain: 0, invuln: { from: 1, to: 7, type: "all" }, vfx: "special_meta",
    velocity: [{ from: 1, to: 6, vx: 160 }], mechanicData: { hold: 70 },
    grab: { range: 100, damage: 360, knockback: { x: 150, y: 560 } },
  },
  throw: { name: "Back Take", damage: 120 },
  finisher: {
    id: "fourth_of_july", name: "Fourth of July", input: "D,D,B+LP", range: "close",
    description: "Mark hands the dazed opponent a hydrofoil board and dabs a stripe of white sunscreen on their face. A cartoon wave carries them off-screen while \"Country Roads\" plays on a tinny speaker.",
    vfx: "finisher_fourth_of_july",
  },
  assists: { a: "move_fast", b: "hydrofoil_rush" },
  ai: {
    grabRate: 0.4,
    antiAir: "c_hp",
    pressure: ["move_fast", "c_lk", "c_hk"],
    punish: ["c_hp", "move_fast", "send_me_location:HP", "c_hk"],
    evade: "hydrofoil_rush:HK",
    approach: ["hydrofoil_rush:LK", "hydrofoil_rush:HK"],
    superRange: 95,
    aggression: 1.4,
  },
  sharedSkills: ["dash", "run", "throw", "throw_tech", "block", "alignment_block", "guardrail", "scale_up", "rollback", "breakthrough", "tag", "assist", "swap_guard", "lab:meta"],
});
