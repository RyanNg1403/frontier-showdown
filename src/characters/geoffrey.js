import { defineCharacter } from "./schema.js";
import "../combat/mechanics/group-d.js";
import "../combat/ai-kits/group-d.js";

/**
 * Geoffrey Hinton, "Godfather of AI" (roster doc 3.13). Counter / old master: a slow walk with
 * the longest reach in the cast, a damage-return counter, an intangible Dropout and drifting
 * Boltzmann clouds. Patient and reactive; lethal when the opponent guesses.
 */
const BACKPROP = {
  from: 4, to: 21, levels: ["high", "mid", "overhead"], projectiles: true, base: 120, ratio: 1.2, lock: 24, recovery: 14,
  returnProjectile: {
    speed: 640, hitbox: { x: -24, y: -24, w: 48, h: 48 }, lifetime: 160,
    hitstun: 24, blockstun: 18, knockback: { x: 300, y: 520 }, knockdown: true, vfx: "projectile_uoft", meterGain: 8,
  },
};
const DROPOUT = { from: 6, to: 25, reposition: "behind", distance: 70 };
const CLOUD = {
  frame: 18, max: 2, settleAt: 70, drift: 90, wander: 90, homing: 330, damage: 18, offset: { x: 70, y: -150 },
  projectile: {
    hitbox: { x: -34, y: -30, w: 68, h: 60 }, lifetime: 180, chip: 2, hits: 3, hitInterval: 12,
    hitstun: 16, blockstun: 14, knockback: { x: 60 }, vfx: "projectile_uoft", meterGain: 4,
  },
};
const WAVE = {
  speed: 680, hitbox: { x: -60, y: -110, w: 120, h: 160 }, offset: { x: 80, y: -100 }, lifetime: 100,
  damage: 34, chip: 7, hitstun: 22, blockstun: 10, hits: 5, hitInterval: 4, knockback: { x: 90 },
  durability: 5, vfx: "projectile_uoft", meterGain: 0, scale: 1.6,
};

export default defineCharacter({
  id: "geoffrey",
  name: "Geoffrey Hinton",
  shortName: "Geoffrey",
  title: "Godfather of AI",
  lab: "University of Toronto",
  labId: "uoft",
  bio: "The counter master. Floats Boltzmann clouds at mid-range, holds Backpropagation against predictable pressure and Dropouts through everything else. Slow on his feet, long in the arm.",
  quotes: {
    intro: "I last sat down in 2005, and it was a mistake.",
    victory: [
      "If you want to know what life's like when you're not the apex intelligence, ask a chicken.",
      "I'm flabbergasted. I had no idea this would happen.",
    ],
    rival: {},
  },
  palette: {
    primary: "#1f2230",
    secondary: "#6b6e76",
    accent: "#c0c8d8",
    shirt: "#2f86c9",
    skin: "#f0cfb9",
    hair: "#e2e2e2",
    hairStyle: "receding",
    shoes: "#5b3b24",
  },
  stats: { health: 1000, walkSpeed: 170, runSpeed: 400, jump: 180, weight: 1.0, height: 212 },
  normals: {
    lp: {
      name: "Finger-Point Jab", startup: 7, active: 2, recovery: 12, damage: 24, hitstun: 16, blockstun: 13,
      hitbox: { x: 24, y: -172, w: 100, h: 22 }, knockback: { x: 150 }, level: "high", meterGain: 3,
      cancelInto: ["lp", "hp", "special", "super"],
    },
    hp: {
      name: "Chalk-Hand Swipe", startup: 13, active: 3, recovery: 21, damage: 66, hitstun: 22, blockstun: 17,
      hitbox: { x: 28, y: -178, w: 128, h: 34 }, knockback: { x: 300 }, level: "high", meterGain: 5,
      cancelInto: ["special", "super"],
    },
    lk: {
      name: "Long Straight Kick", startup: 9, active: 3, recovery: 16, damage: 30, hitstun: 16, blockstun: 13,
      hitbox: { x: 22, y: -106, w: 124, h: 24 }, knockback: { x: 200 }, level: "mid", meterGain: 4,
      cancelInto: ["hk", "special", "super"],
    },
    hk: {
      name: "Lecture-Hall Sweep", startup: 16, active: 4, recovery: 26, damage: 72, hitstun: 24, blockstun: 18,
      hitbox: { x: 20, y: -30, w: 196, h: 30 }, knockback: { x: 220, y: 320 }, level: "low", knockdown: true, meterGain: 6,
      description: "The longest normal in the game.",
    },
    c_lp: {
      name: "Pointer Tap", startup: 7, active: 2, recovery: 12, damage: 20, hitstun: 15, blockstun: 12,
      hitbox: { x: 18, y: -102, w: 96, h: 22 }, knockback: { x: 140 }, level: "mid", meterGain: 3,
      cancelInto: ["c_lp", "c_lk", "special", "super"],
    },
    c_lk: {
      name: "Shin Correction", startup: 8, active: 2, recovery: 15, damage: 22, hitstun: 15, blockstun: 12,
      hitbox: { x: 20, y: -28, w: 120, h: 24 }, knockback: { x: 160 }, level: "low", meterGain: 3,
      cancelInto: ["c_lp", "special", "super"],
    },
    c_hp: {
      name: "Gradient Ascent", startup: 10, active: 4, recovery: 29, damage: 100, hitstun: 30, blockstun: 18,
      hitbox: { x: 6, y: -236, w: 82, h: 154 }, knockback: { x: 100, y: 1150 }, level: "mid", meterGain: 6,
      hitstop: 13, cancelInto: ["special", "super"], description: "A rising palm; Geoffrey's anti-air.",
    },
    c_hk: {
      name: "Long Division Sweep", startup: 13, active: 3, recovery: 29, damage: 70, hitstun: 24, blockstun: 18,
      hitbox: { x: 18, y: -26, w: 164, h: 26 }, knockback: { x: 210, y: 320 }, level: "low", knockdown: true, meterGain: 5,
    },
    j_p: {
      name: "Chalk Drop", startup: 9, active: 6, recovery: 8, damage: 58, hitstun: 20, blockstun: 16,
      hitbox: { x: 10, y: -136, w: 98, h: 44 }, knockback: { x: 180 }, level: "overhead", meterGain: 4,
    },
    j_k: {
      name: "Professorial Boot", startup: 8, active: 7, recovery: 8, damage: 62, hitstun: 20, blockstun: 16,
      hitbox: { x: 8, y: -98, w: 120, h: 46 }, knockback: { x: 210 }, level: "overhead", meterGain: 4,
    },
    f_hp: {
      name: "Capsule", anim: "heavy_punch_forward", startup: 20, active: 3, recovery: 21, damage: 62, hitstun: 22, blockstun: 17,
      hitbox: { x: 24, y: -164, w: 112, h: 164 }, knockback: { x: 240 }, level: "overhead", meterGain: 5,
      cancelInto: ["special", "super"], description: "Overhead strike wrapped in glowing capsule outlines.",
    },
  },
  specials: [
    {
      id: "backpropagation", name: "Backpropagation", input: "D,N,B+P", priority: 1,
      description: "Counter. Struck during frames 4-21, the error flows back to the attacker for 120 or 1.2x the hit's damage, whichever is higher; projectiles are returned as a silver spark. LP catches highs, mids and jump-ins; HP catches mids and lows. Throws beat it.",
      startup: 4, active: 18, recovery: 28, damage: 0, meterGain: 0, vfx: "lab_aura",
      mechanic: "return-counter", mechanicData: BACKPROP,
      variants: {
        LP: { mechanicData: { ...BACKPROP, levels: ["high", "mid", "overhead"] } },
        HP: { mechanicData: { ...BACKPROP, levels: ["mid", "low"] } },
      },
      scaleUp: false,
    },
    {
      id: "dropout", name: "Dropout", input: "QCB+K",
      description: "Pixels of Geoffrey blink out and he is intangible on frames 6-25 (no hits, no throws, walks through bodies), then re-enters with a palm on frame 26. LK reappears in place, HK behind the opponent. Scale Up: the palm launches.",
      startup: 26, active: 4, recovery: 16, damage: 60, chip: 7, hitstun: 22, blockstun: 16,
      hitbox: { x: 12, y: -176, w: 98, h: 120 }, knockback: { x: 300 }, level: "mid", meterGain: 8, vfx: "lab_vortex",
      invuln: { from: 6, to: 25, type: "all" }, passThrough: { from: 6, to: 25 },
      mechanic: "intangible", mechanicData: DROPOUT,
      variants: {
        LK: { mechanicData: { ...DROPOUT, reposition: "place" } },
        HK: { mechanicData: DROPOUT },
      },
      scaleUp: { damage: 78, knockback: { x: 120, y: 1150 } },
    },
    {
      id: "boltzmann_machine", name: "Boltzmann Machine", input: "QCF+P",
      description: "Releases a cloud of thermal particles that wanders on a seeded, frame-deterministic path for about 1.2 s, then settles onto the opponent. Three hits of 18. Up to two clouds; a third retires the oldest. Scale Up: the cloud settles on the opponent at once.",
      startup: 18, active: 2, recovery: 26, damage: 0, meterGain: 7, vfx: "special_uoft",
      mechanic: "drift-cloud", mechanicData: CLOUD,
      scaleUp: { mechanicData: { ...CLOUD, settleNow: true, damage: 23 } },
    },
  ],
  super: {
    id: "forward_forward", name: "Forward-Forward", input: "QCF,QCF+HP", meterCost: 300, freeze: 30,
    description: "Breakthrough. \"No backward pass today.\" Two enormous forward palms, one positive (silver) and one negative (gold), each send a wave across the screen while a chalkboard of equations blows past.",
    startup: 10, active: 3, recovery: 52, damage: 0, meterGain: 0, invuln: { from: 1, to: 10, type: "all" }, vfx: "lab_beam",
    projectile: WAVE,
    mechanic: "timed-spawns",
    mechanicData: {
      spawns: [{ frame: 28, wave: "negative", projectile: { ...WAVE, hitstun: 24, knockback: { x: 300, y: 760 }, knockdown: true } }],
      chalkboard: true,
    },
  },
  throw: { name: "t-SNE", damage: 112 },
  finisher: {
    id: "distillation", name: "Distillation", input: "F,B,F+LP", range: "close",
    description: "Geoffrey uncorks a glass flask and the opponent is gently distilled into a pint-sized student version of themselves, sitting in the flask taking notes. Label: \"Dark knowledge transferred.\"",
    vfx: "finisher_distillation",
  },
  assists: { a: "boltzmann_machine", b: "dropout" },
  sharedSkills: ["dash", "run", "throw", "throw_tech", "block", "alignment_block", "guardrail", "scale_up", "rollback", "breakthrough", "tag", "assist", "swap_guard", "lab:uoft"],
  ai: {
    antiAir: "c_hp",
    evade: "dropout:HK",
    punish: ["dropout:LK", "c_hp"],
    cancel: ["boltzmann_machine:LP", "dropout:LK"],
    superRange: 600,
  },
});
