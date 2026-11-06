import { defineCharacter } from "./schema.js";

/**
 * Sam: an affectionate parody of a relentless product shipper.
 * Balanced shoto: fireball, invincible uppercut, advancing rush, fast normals.
 */
export default defineCharacter({
  id: "sam",
  name: "Sam",
  title: "The Shipper",
  lab: "OpenAI",
  bio: "Ships first, iterates in public. Fights like a launch week: fast pokes, a fireball made of release notes, and an uppercut timed to the keynote.",
  palette: {
    primary: "#10a37f",
    secondary: "#23262e",
    accent: "#e6fff6",
    skin: "#f0c8a4",
    hair: "#6a4e3b",
  },
  stats: { health: 1000, walkSpeed: 150, backWalkSpeed: 125, runSpeed: 330, jump: 1, weight: 1 },
  normals: {
    lp: {
      name: "Quick Demo", startup: 4, active: 3, recovery: 7, damage: 30, hitstun: 14, blockstun: 10,
      hitbox: { x: 22, y: -166, w: 82, h: 24 }, knockback: { x: 170 }, level: "high", meterGain: 6,
      cancelInto: ["lp", "hp", "lk", "special", "super"],
    },
    hp: {
      name: "Keynote Cross", startup: 8, active: 4, recovery: 16, damage: 70, hitstun: 20, blockstun: 15,
      hitbox: { x: 26, y: -170, w: 102, h: 32 }, knockback: { x: 290 }, level: "high", meterGain: 12,
      velocity: [{ from: 3, to: 9, vx: 120 }], cancelInto: ["special", "super"],
    },
    lk: {
      name: "Shin Release", startup: 6, active: 3, recovery: 10, damage: 40, hitstun: 15, blockstun: 11,
      hitbox: { x: 20, y: -96, w: 92, h: 26 }, knockback: { x: 200 }, level: "mid", meterGain: 7,
      cancelInto: ["hp", "special", "super"],
    },
    hk: {
      name: "Roadmap Roundhouse", startup: 11, active: 4, recovery: 20, damage: 85, hitstun: 22, blockstun: 16,
      hitbox: { x: 30, y: -156, w: 112, h: 38 }, knockback: { x: 380 }, level: "mid", meterGain: 14,
      cancelInto: ["special", "super"],
    },
    c_lp: {
      name: "Low Jab", startup: 4, active: 2, recovery: 7, damage: 25, hitstun: 13, blockstun: 9,
      hitbox: { x: 18, y: -98, w: 80, h: 22 }, knockback: { x: 150 }, level: "mid", meterGain: 5,
      cancelInto: ["c_lp", "c_lk", "special", "super"],
    },
    c_lk: {
      name: "Ankle Ping", startup: 5, active: 3, recovery: 9, damage: 28, hitstun: 13, blockstun: 9,
      hitbox: { x: 20, y: -28, w: 102, h: 24 }, knockback: { x: 160 }, level: "low", meterGain: 5,
      cancelInto: ["c_lp", "special", "super"],
    },
    c_hp: {
      name: "Funding Round Uppercut", startup: 9, active: 4, recovery: 24, damage: 95, hitstun: 30, blockstun: 14,
      hitbox: { x: 8, y: -214, w: 74, h: 132 }, knockback: { x: 110, y: 1180 }, level: "mid", meterGain: 16,
      hitstop: 13, cancelInto: ["special", "super"],
    },
    c_hk: {
      name: "Market Sweep", startup: 10, active: 4, recovery: 24, damage: 70, hitstun: 24, blockstun: 14,
      hitbox: { x: 18, y: -26, w: 134, h: 26 }, knockback: { x: 200, y: 320 }, level: "low", knockdown: true,
      meterGain: 12,
    },
    j_p: {
      name: "Leap of Faith", startup: 7, active: 6, recovery: 8, damage: 60, hitstun: 20, blockstun: 14,
      hitbox: { x: 10, y: -136, w: 82, h: 42 }, knockback: { x: 180 }, level: "overhead", meterGain: 10,
    },
    j_k: {
      name: "Hype Kick", startup: 6, active: 8, recovery: 8, damage: 65, hitstun: 20, blockstun: 14,
      hitbox: { x: 10, y: -96, w: 104, h: 44 }, knockback: { x: 200 }, level: "overhead", meterGain: 10,
    },
  },
  specials: [
    {
      id: "model_drop", name: "Model Drop", input: "QCF+P",
      description: "Throws a glowing release-notes orb straight across the stage.",
      startup: 13, active: 2, recovery: 26, damage: 0, meterGain: 14, vfx: "model_drop",
      projectile: {
        speed: 520, hitbox: { x: -28, y: -28, w: 56, h: 56 }, offset: { x: 78, y: -140 }, lifetime: 160,
        damage: 70, chip: 12, hitstun: 20, blockstun: 18, knockback: { x: 240 }, vfx: "model_drop", meterGain: 12,
      },
    },
    {
      id: "launch_day", name: "Launch Day", input: "DP+P", priority: 1,
      description: "Invincible rising uppercut. The anti-air answer to every jump-in.",
      startup: 4, active: 10, recovery: 28, damage: 110, chip: 18, hitstun: 30, blockstun: 16,
      hitbox: { x: 10, y: -238, w: 72, h: 160 }, knockback: { x: 140, y: 1250 }, level: "mid", meterGain: 18,
      invuln: { from: 1, to: 8, type: "strike" }, velocity: [{ from: 3, to: 10, vx: 150, vy: -720 }],
      hitstop: 12, juggle: 2, landingRecovery: 12, vfx: "launch_day",
    },
    {
      id: "scaling_rush", name: "Scaling Law Rush", input: "QCB+K",
      description: "Two-hit advancing shoulder rush that knocks down. Unsafe if blocked up close.",
      startup: 12, active: 14, recovery: 22, damage: 45, chip: 8, hitstun: 18, blockstun: 12, hits: 2, hitInterval: 7,
      hitbox: { x: 16, y: -160, w: 86, h: 118 }, knockback: { x: 260 }, level: "mid", meterGain: 18,
      velocity: [{ from: 8, to: 25, vx: 620 }], lastHit: { knockback: { x: 300, y: 520 }, knockdown: true },
      vfx: "scaling_rush",
    },
  ],
  super: {
    id: "agi_keynote", name: "AGI Keynote", input: "QCF,QCF+P", meterCost: 200, freeze: 42,
    description: "Super. A blinding six-hit keynote rush that ends in a launch.",
    startup: 8, active: 30, recovery: 34, damage: 55, chip: 10, hitstun: 22, blockstun: 10, hits: 6, hitInterval: 5,
    hitbox: { x: 8, y: -196, w: 122, h: 190 }, knockback: { x: 140 }, level: "mid", meterGain: 0,
    invuln: { from: 1, to: 14, type: "all" }, velocity: [{ from: 5, to: 22, vx: 720 }],
    lastHit: { knockback: { x: 420, y: 900 }, knockdown: true }, hitstop: 8, juggle: 0, vfx: "agi_keynote",
  },
  throw: { name: "Acqui-hire", damage: 120 },
  finisher: {
    id: "ship_it", name: "Ship It", input: "F,B,F+HP", range: 240,
    description: "A giant SHIPPED banner unfurls and confetti cannons bury the opponent in launch-day merch.",
    vfx: "finisher_ship_it",
  },
  assist: "model_drop",
});
