import { defineCharacter } from "./schema.js";
import "../combat/mechanics/group-b/index.js";
import "../combat/ai-kits/group-b.js";

/**
 * Ilya Sutskever, "The Visionary" (roster doc 3.7). Mystic zoner / teleporter: one powerful
 * orb at a time that he can detonate, a straight-line teleport strike and a prescient counter.
 */
export default defineCharacter({
  id: "ilya",
  name: "Ilya Sutskever",
  shortName: "Ilya",
  title: "The Visionary",
  lab: "Safe Superintelligence",
  labId: "ssi",
  archetype: "mystic zoner",
  difficulty: 3,
  bio: "Low health; wins by being somewhere else. Controls space with Peak Data, Straight Shots through the opponent when they jump or commit, and waits in What Did Ilya See? when they rush.",
  quotes: {
    intro: "We have the compute, we have the team, and we know what to do.",
    victory: ["I lead a very simple life. I go to work; then I go home.", "back to the age of research again, just with big computers."],
    rival: {},
  },
  palette: {
    primary: "#4a4d55",
    secondary: "#2b2d33",
    accent: "#e3d9ff",
    shirt: "#f4f4f1",
    skin: "#f0d3bf",
    hair: "#3a2a20",
    hairStyle: "receding",
    shoes: "#1b1b1d",
  },
  stats: { health: 950, walkSpeed: 185, runSpeed: 440, jump: 220, weight: 0.9, height: 200 },
  normals: {
    lp: {
      name: "Piano Flick", startup: 6, active: 2, recovery: 11, damage: 22, hitstun: 16, blockstun: 13,
      hitbox: { x: 22, y: -166, w: 82, h: 22 }, knockback: { x: 150 }, level: "high", meterGain: 3,
      cancelInto: ["lp", "hp", "special", "super"], vfx: "piano_note",
    },
    hp: {
      name: "Lavender Ripple", startup: 12, active: 3, recovery: 20, damage: 62, hitstun: 22, blockstun: 17,
      hitbox: { x: 24, y: -172, w: 108, h: 36 }, knockback: { x: 290 }, level: "high", meterGain: 5,
      cancelInto: ["special", "super"],
    },
    lk: {
      name: "Front Kick", startup: 9, active: 3, recovery: 15, damage: 28, hitstun: 16, blockstun: 13,
      hitbox: { x: 20, y: -100, w: 98, h: 26 }, knockback: { x: 190 }, level: "mid", meterGain: 4,
      cancelInto: ["hk", "special", "super"],
    },
    hk: {
      name: "Crescent", startup: 15, active: 4, recovery: 24, damage: 74, hitstun: 24, blockstun: 18,
      hitbox: { x: 30, y: -162, w: 140, h: 42 }, knockback: { x: 360 }, level: "mid", meterGain: 6,
      cancelInto: ["special", "super"],
    },
    c_lp: {
      name: "Low Chord", startup: 7, active: 2, recovery: 12, damage: 20, hitstun: 15, blockstun: 12,
      hitbox: { x: 18, y: -100, w: 84, h: 22 }, knockback: { x: 140 }, level: "mid", meterGain: 3,
      cancelInto: ["c_lp", "c_lk", "special", "super"],
    },
    c_lk: {
      name: "Grace Note", startup: 8, active: 2, recovery: 14, damage: 22, hitstun: 15, blockstun: 12,
      hitbox: { x: 20, y: -28, w: 108, h: 24 }, knockback: { x: 150 }, level: "low", meterGain: 3,
      cancelInto: ["c_lp", "special", "super"],
    },
    c_hp: {
      name: "Rising Orb", startup: 10, active: 4, recovery: 28, damage: 100, hitstun: 30, blockstun: 18,
      hitbox: { x: 4, y: -232, w: 82, h: 152 }, knockback: { x: 100, y: 1170 }, level: "mid", meterGain: 6,
      hitstop: 13, cancelInto: ["special", "super"],
    },
    c_hk: {
      name: "Long Sweep", startup: 13, active: 3, recovery: 28, damage: 66, hitstun: 24, blockstun: 18,
      hitbox: { x: 18, y: -26, w: 148, h: 26 }, knockback: { x: 200, y: 320 }, level: "low", knockdown: true,
      meterGain: 5,
    },
    j_p: {
      name: "Hover Palm", startup: 8, active: 6, recovery: 8, damage: 56, hitstun: 20, blockstun: 16,
      hitbox: { x: 10, y: -138, w: 88, h: 46 }, knockback: { x: 180 }, level: "overhead", meterGain: 4,
      velocity: [{ from: 1, to: 10, vy: 0 }], description: "Floats for 10 frames.",
    },
    j_k: {
      name: "Falling Kick", startup: 7, active: 7, recovery: 8, damage: 58, hitstun: 20, blockstun: 16,
      hitbox: { x: 8, y: -94, w: 104, h: 46 }, knockback: { x: 200 }, level: "overhead", meterGain: 4,
    },
  },
  specials: [
    {
      id: "peak_data", name: "Peak Data", input: "QCF+P",
      description: "Launches one large glowing orb (\"there's only one internet\"). Only one can exist: repeat the motion while it is out to detonate it in place. Scale Up: Pre-training Ends, which erases any opponent projectile it touches.",
      startup: 16, active: 2, recovery: 28, damage: 0, meterGain: 7, vfx: "lavender_orb",
      projectile: {
        speed: 380, hitbox: { x: -40, y: -40, w: 80, h: 80 }, offset: { x: 84, y: -140 }, lifetime: 200,
        damage: 70, chip: 8, hitstun: 22, blockstun: 16, knockback: { x: 240 }, vfx: "projectile_ssi", meterGain: 8, scale: 1.5,
        mech: { single: { detonate: { damage: 40, radius: 90 } } },
      },
      scaleUp: { projectile: { durability: 99 } },
    },
    {
      id: "straight_shot", name: "Straight Shot", input: "B,F+P",
      description: "Vanishes and reappears in a straight line with a palm strike: LP stops in front, HP passes behind for a cross-up. Invulnerable while travelling (frames 6-11). Scale Up: works in the air too.",
      startup: 12, active: 3, recovery: 26, damage: 80, chip: 10, hitstun: 22, blockstun: 18,
      hitbox: { x: 8, y: -176, w: 92, h: 136 }, knockback: { x: 300 }, level: "mid", meterGain: 8,
      teleport: { vanish: 6, frame: 11, to: "front", distance: 80 }, vfx: "straight_shot",
      mech: { airScaleUp: true },
      variants: { LP: { teleport: { to: "front" } }, HP: { teleport: { to: "behind" } } },
    },
    {
      id: "ilya_saw", name: "What Did Ilya See?", input: "D,B+K",
      description: "Closes his eyes as an aurora flickers. Struck high, mid or low, he teleports behind the attacker and strikes. Throws beat it. While it is up, the opponent's next special is shown over their head.",
      startup: 3, active: 20, recovery: 28, damage: 0, meterGain: 0, vfx: "aurora", limb: "arm",
      parry: {
        from: 3, to: 22, levels: ["high", "mid", "low", "overhead"], lock: 40, levelBonus: 0,
        counter: {
          name: "Foresight Palm", damage: 90, startup: 10, active: 4, recovery: 22, hitstun: 30,
          hitbox: { x: 0, y: -190, w: 120, h: 190 }, knockback: { x: 360, y: 520 }, knockdown: true,
          teleport: { vanish: 2, frame: 7, to: "behind", distance: 70 },
        },
      },
      mech: { vision: { frames: 110 } },
      scaleUp: false,
    },
  ],
  super: {
    id: "feel_the_agi", name: "Feel the AGI", input: "QCF,QCF+HP", meterCost: 300, freeze: 30,
    description: "Breakthrough. \"Feel the AGI!\" echoes as two giant GPU silhouettes flank Ilya and a lavender data storm lifts the opponent through orbiting reading-list pages.",
    startup: 8, active: 24, recovery: 52, damage: 57, chip: 11, hitstun: 22, blockstun: 10, hits: 6, hitInterval: 4,
    hitbox: { x: 10, y: -260, w: 200, h: 260 }, knockback: { x: 90 }, level: "mid", meterGain: 0,
    invuln: { from: 1, to: 8, type: "all" }, velocity: [{ from: 4, to: 14, vx: 260 }],
    lastHit: { knockback: { x: 300, y: 1100 }, knockdown: true }, hitstop: 8, vfx: "data_storm",
  },
  throw: { name: "Seq2Seq", damage: 105, mech: { swapSides: true } },
  finisher: {
    id: "slightly_conscious", name: "Slightly Conscious", input: "D,F,D,F+LP", range: "far",
    description: "The opponent dissolves into a small glowing network of lavender nodes that blinks, looks around and asks \"…am I slightly conscious?\" Ilya nods thoughtfully.",
    vfx: "finisher_slightly_conscious",
  },
  assists: { a: "peak_data", b: "straight_shot" },
  ai: {
    antiAir: "c_hp",
    punish: ["straight_shot:LP", "c_hp"],
    evade: "straight_shot:HP",
    cancel: ["straight_shot:LP"],
    projectileRange: [280, 900],
    superRange: 240,
    zoning: 0.75,
  },
  sharedSkills: ["dash", "run", "throw", "throw_tech", "block", "alignment_block", "guardrail", "scale_up", "rollback", "breakthrough", "tag", "assist", "swap_guard", "lab:ssi"],
});
