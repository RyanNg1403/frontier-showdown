import { defineCharacter } from "./schema.js";

/**
 * Sam Altman, "The Iterative Deployer" (roster doc 3.1). All-rounder shoto: a fireball,
 * an invincible uppercut and a gap-closing portal that can cross up.
 */
export default defineCharacter({
  id: "sam",
  name: "Sam Altman",
  shortName: "Sam",
  title: "The Iterative Deployer",
  lab: "OpenAI",
  labId: "openai",
  bio: "The learn-the-game character. Plays neutral with Prompt Burst, anti-airs with Event Horizon and closes distance through a Stargate when the fireball gets respected.",
  quotes: {
    intro: "we are past the event horizon; the takeoff has started.",
    victory: ["first and last time i ever wear one of these", "superintelligence in a few thousand days. this was a few seconds."],
    rival: { dario: "First, the good part of the Anthropic ads: they are funny, and I laughed." },
  },
  palette: {
    primary: "#2b2d33",
    secondary: "#3a3d45",
    accent: "#79e4cf",
    skin: "#efc6a2",
    hair: "#6b4a2f",
    shoes: "#f2f2f2",
  },
  stats: { health: 1000, walkSpeed: 210, runSpeed: 470, jump: 210, weight: 1.0 },
  normals: {
    lp: {
      name: "Lowercase Jab", startup: 6, active: 2, recovery: 11, damage: 24, hitstun: 16, blockstun: 13,
      hitbox: { x: 22, y: -166, w: 84, h: 24 }, knockback: { x: 150 }, level: "high", meterGain: 3,
      cancelInto: ["lp", "hp", "special", "super"],
    },
    hp: {
      name: "Launch Day", startup: 12, active: 3, recovery: 20, damage: 65, hitstun: 22, blockstun: 17,
      hitbox: { x: 26, y: -172, w: 104, h: 32 }, knockback: { x: 280 }, level: "high", meterGain: 5,
      velocity: [{ from: 4, to: 12, vx: 110 }], cancelInto: ["special", "super"],
    },
    lk: {
      name: "Sneaker Poke", startup: 9, active: 3, recovery: 13, damage: 30, hitstun: 16, blockstun: 13,
      hitbox: { x: 20, y: -98, w: 96, h: 26 }, knockback: { x: 190 }, level: "mid", meterGain: 4,
      cancelInto: ["hk", "special", "super"],
    },
    hk: {
      name: "Chat-Bubble Roundhouse", startup: 14, active: 4, recovery: 22, damage: 75, hitstun: 24, blockstun: 18,
      hitbox: { x: 30, y: -158, w: 114, h: 40 }, knockback: { x: 360 }, level: "mid", meterGain: 6,
      cancelInto: ["special", "super"],
    },
    c_lp: {
      name: "Low Knuckle Tap", startup: 7, active: 2, recovery: 12, damage: 20, hitstun: 15, blockstun: 12,
      hitbox: { x: 18, y: -100, w: 82, h: 22 }, knockback: { x: 140 }, level: "mid", meterGain: 3,
      cancelInto: ["c_lp", "c_lk", "special", "super"],
    },
    c_lk: {
      name: "Ankle Ping", startup: 8, active: 2, recovery: 13, damage: 22, hitstun: 15, blockstun: 12,
      hitbox: { x: 20, y: -28, w: 104, h: 24 }, knockback: { x: 150 }, level: "low", meterGain: 3,
      cancelInto: ["c_lp", "special", "super"],
    },
    c_hp: {
      name: "Takeoff", startup: 10, active: 3, recovery: 32, damage: 100, hitstun: 30, blockstun: 18,
      hitbox: { x: 8, y: -216, w: 76, h: 134 }, knockback: { x: 110, y: 1180 }, level: "mid", meterGain: 6,
      hitstop: 13, cancelInto: ["special", "super"],
    },
    c_hk: {
      name: "Market Sweep", startup: 13, active: 3, recovery: 28, damage: 70, hitstun: 24, blockstun: 18,
      hitbox: { x: 18, y: -26, w: 138, h: 26 }, knockback: { x: 200, y: 320 }, level: "low", knockdown: true,
      meterGain: 5,
    },
    j_p: {
      name: "Leap of Faith", startup: 8, active: 6, recovery: 8, damage: 55, hitstun: 20, blockstun: 16,
      hitbox: { x: 10, y: -136, w: 84, h: 42 }, knockback: { x: 180 }, level: "overhead", meterGain: 4,
    },
    j_k: {
      name: "Sneaker Stomp", startup: 7, active: 7, recovery: 8, damage: 60, hitstun: 20, blockstun: 16,
      hitbox: { x: 8, y: -92, w: 104, h: 48 }, knockback: { x: 200 }, level: "overhead", meterGain: 4,
    },
    f_hp: {
      name: "Ship It", startup: 20, active: 3, recovery: 20, damage: 60, hitstun: 22, blockstun: 17,
      hitbox: { x: 20, y: -150, w: 100, h: 150 }, knockback: { x: 240 }, level: "overhead", meterGain: 5,
      cancelInto: ["special", "super"],
    },
  },
  specials: [
    {
      id: "prompt_burst", name: "Prompt Burst", input: "QCF+P",
      description: "Fires a teal chat-bubble fireball. LP is slow, HP is fast. Scale Up: Sora Reel, a two-hit film strip that knocks down.",
      startup: 15, active: 2, recovery: 30, damage: 0, meterGain: 7, vfx: "special_openai",
      projectile: {
        speed: 360, hitbox: { x: -28, y: -28, w: 56, h: 56 }, offset: { x: 78, y: -140 }, lifetime: 220,
        damage: 55, chip: 7, hitstun: 20, blockstun: 16, knockback: { x: 230 }, vfx: "projectile_openai", meterGain: 8,
      },
      variants: { LP: { projectile: { speed: 360 } }, HP: { projectile: { speed: 600 } } },
      scaleUp: { projectile: { damage: 40, hits: 2, hitInterval: 6, knockdown: true, scale: 1.3 } },
    },
    {
      id: "event_horizon", name: "Event Horizon", input: "DP+P", priority: 1,
      description: "Rising uppercut wrapped in a teal singularity ring, invincible on frames 1-5. Scale Up: two hits.",
      startup: 5, active: 8, recovery: 36, damage: 100, chip: 10, hitstun: 30, blockstun: 16,
      hitbox: { x: 10, y: -236, w: 74, h: 158 }, knockback: { x: 140, y: 1250 }, level: "mid", meterGain: 8,
      invuln: { from: 1, to: 5, type: "all" }, velocity: [{ from: 3, to: 10, vx: 150, vy: -720 }],
      hitstop: 12, landingRecovery: 12, vfx: "special_openai", cancelInto: ["super"],
      scaleUp: { damage: 65, hits: 2, hitInterval: 4 },
    },
    {
      id: "stargate_rush", name: "Stargate Rush", input: "QCB+K",
      description: "Steps through a gate and reappears with a knee. LK lands in front, HK lands behind for a cross-up.",
      startup: 16, active: 4, recovery: 26, damage: 75, chip: 8, hitstun: 22, blockstun: 23,
      hitbox: { x: 10, y: -150, w: 84, h: 100 }, knockback: { x: 300, y: 0 }, level: "mid", meterGain: 8,
      teleport: { vanish: 5, frame: 12, to: "front", distance: 78 }, vfx: "lab_vortex",
      variants: { LK: { teleport: { to: "front" } }, HK: { teleport: { to: "behind" } } },
    },
  ],
  super: {
    id: "few_thousand_days", name: "A Few Thousand Days", input: "QCF,QCF+HP", meterCost: 300, freeze: 30,
    description: "Breakthrough. A day-counter spins to 3,000 as Sam dashes through an exponential curve of light.",
    startup: 8, active: 34, recovery: 50, damage: 42, chip: 9, hitstun: 22, blockstun: 10, hits: 8, hitInterval: 4,
    hitbox: { x: 8, y: -196, w: 124, h: 190 }, knockback: { x: 120 }, level: "mid", meterGain: 0,
    invuln: { from: 1, to: 8, type: "all" }, velocity: [{ from: 5, to: 24, vx: 720 }],
    lastHit: { knockback: { x: 420, y: 900 }, knockdown: true }, hitstop: 8, vfx: "special_openai",
  },
  throw: { name: "Code Red", damage: 110 },
  finisher: {
    id: "gentle_singularity", name: "Gentle Singularity", input: "F,D,F+HP", range: "close",
    description: "The opponent is lifted gently into a slowly rotating teal singularity and pops out as a 16x16 chatbot avatar typing \"how can i help?\"",
    vfx: "finisher_gentle_singularity",
  },
  assists: { a: "prompt_burst", b: "event_horizon" },
  sharedSkills: ["dash", "run", "throw", "throw_tech", "block", "alignment_block", "guardrail", "scale_up", "rollback", "breakthrough", "tag", "assist", "swap_guard", "lab:openai"],
});
