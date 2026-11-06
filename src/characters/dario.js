import { defineCharacter } from "./schema.js";

/**
 * Dario: an affectionate parody of a careful, safety-minded researcher.
 * Charge character: slow wide projectile, invincible flash kick, command grab, long pokes.
 */
export default defineCharacter({
  id: "dario",
  name: "Dario",
  title: "The Constitutionalist",
  lab: "Anthropic",
  bio: "Thinks three moves ahead and writes them down first. Patient zoning, a flash kick with a written scaling policy, and a probe that reads your intentions.",
  palette: {
    primary: "#d97757",
    secondary: "#2b2622",
    accent: "#f0eee6",
    skin: "#e7c19c",
    hair: "#33281f",
  },
  stats: { health: 1050, walkSpeed: 135, backWalkSpeed: 115, runSpeed: 300, jump: 0.95, weight: 1.1 },
  normals: {
    lp: {
      name: "Careful Jab", startup: 5, active: 3, recovery: 8, damage: 32, hitstun: 14, blockstun: 10,
      hitbox: { x: 22, y: -168, w: 86, h: 24 }, knockback: { x: 170 }, level: "high", meterGain: 6,
      cancelInto: ["lp", "lk", "hp", "special", "super"],
    },
    hp: {
      name: "Constitutional Cross", startup: 9, active: 4, recovery: 17, damage: 75, hitstun: 21, blockstun: 15,
      hitbox: { x: 26, y: -172, w: 112, h: 32 }, knockback: { x: 300 }, level: "high", meterGain: 12,
      cancelInto: ["special", "super"],
    },
    lk: {
      name: "Measured Kick", startup: 6, active: 3, recovery: 11, damage: 42, hitstun: 15, blockstun: 11,
      hitbox: { x: 22, y: -100, w: 100, h: 26 }, knockback: { x: 210 }, level: "mid", meterGain: 7,
      cancelInto: ["hp", "special", "super"],
    },
    hk: {
      name: "Long-Horizon Kick", startup: 12, active: 4, recovery: 21, damage: 90, hitstun: 22, blockstun: 16,
      hitbox: { x: 30, y: -150, w: 126, h: 40 }, knockback: { x: 400 }, level: "mid", meterGain: 14,
      cancelInto: ["special", "super"],
    },
    c_lp: {
      name: "Footnote Jab", startup: 5, active: 2, recovery: 8, damage: 26, hitstun: 13, blockstun: 9,
      hitbox: { x: 18, y: -100, w: 84, h: 22 }, knockback: { x: 150 }, level: "mid", meterGain: 5,
      cancelInto: ["c_lp", "c_lk", "special", "super"],
    },
    c_lk: {
      name: "Red-Team Poke", startup: 6, active: 3, recovery: 10, damage: 30, hitstun: 13, blockstun: 9,
      hitbox: { x: 20, y: -28, w: 110, h: 24 }, knockback: { x: 170 }, level: "low", meterGain: 5,
      cancelInto: ["c_lp", "special", "super"],
    },
    c_hp: {
      name: "Peer-Reviewed Uppercut", startup: 10, active: 4, recovery: 25, damage: 100, hitstun: 30, blockstun: 14,
      hitbox: { x: 6, y: -216, w: 78, h: 134 }, knockback: { x: 110, y: 1160 }, level: "mid", meterGain: 16,
      hitstop: 13, cancelInto: ["special", "super"],
    },
    c_hk: {
      name: "Slow Takeoff Sweep", startup: 11, active: 4, recovery: 26, damage: 75, hitstun: 24, blockstun: 14,
      hitbox: { x: 18, y: -26, w: 142, h: 26 }, knockback: { x: 210, y: 320 }, level: "low", knockdown: true,
      meterGain: 12,
    },
    j_p: {
      name: "Thoughtful Descent", startup: 7, active: 6, recovery: 8, damage: 62, hitstun: 20, blockstun: 14,
      hitbox: { x: 10, y: -138, w: 86, h: 42 }, knockback: { x: 180 }, level: "overhead", meterGain: 10,
    },
    j_k: {
      name: "Guardrail Kick", startup: 7, active: 8, recovery: 8, damage: 68, hitstun: 20, blockstun: 14,
      hitbox: { x: 8, y: -98, w: 110, h: 46 }, knockback: { x: 210 }, level: "overhead", meterGain: 10,
    },
  },
  specials: [
    {
      id: "constitution_scroll", name: "Constitution Scroll", input: "[4]6+P",
      description: "Charge back, then forward. A slow, tall scroll of principles that controls space.",
      startup: 11, active: 2, recovery: 22, damage: 0, meterGain: 14, vfx: "constitution_scroll",
      projectile: {
        speed: 380, hitbox: { x: -34, y: -48, w: 68, h: 96 }, offset: { x: 80, y: -128 }, lifetime: 190,
        damage: 75, chip: 13, hitstun: 22, blockstun: 19, knockback: { x: 250 }, vfx: "constitution_scroll",
        meterGain: 12,
      },
    },
    {
      id: "responsible_scaling", name: "Responsible Scaling Kick", input: "[2]8+K",
      description: "Charge down, then up. An invincible flash kick that climbs at a carefully reviewed rate.",
      startup: 4, active: 9, recovery: 30, damage: 115, chip: 18, hitstun: 30, blockstun: 16,
      hitbox: { x: 0, y: -226, w: 92, h: 166 }, knockback: { x: 120, y: 1200 }, level: "mid", meterGain: 18,
      invuln: { from: 1, to: 9, type: "strike" }, velocity: [{ from: 2, to: 9, vx: 70, vy: -700 }],
      hitstop: 12, juggle: 2, landingRecovery: 12, limb: "leg", vfx: "responsible_scaling",
    },
    {
      id: "interpretability_probe", name: "Interpretability Probe", input: "QCB+P",
      description: "Command grab. Reads the opponent's weights, then rearranges them. Cannot be teched.",
      startup: 7, active: 3, recovery: 34, damage: 0, meterGain: 16, vfx: "interpretability_probe",
      grab: { range: 124, damage: 150, techable: false, knockback: { x: 240, y: 760 } },
    },
  ],
  super: {
    id: "loving_grace", name: "Machines of Loving Grace", input: "QCF,QCF+K", meterCost: 200, freeze: 42,
    description: "Super. A full-screen five-hit beam of gentle, overwhelming optimism.",
    startup: 10, active: 3, recovery: 40, damage: 0, meterGain: 0, invuln: { from: 1, to: 14, type: "all" },
    limb: "arm", vfx: "loving_grace",
    projectile: {
      speed: 900, hitbox: { x: -60, y: -80, w: 120, h: 130 }, offset: { x: 90, y: -120 }, lifetime: 90,
      damage: 62, chip: 12, hitstun: 24, blockstun: 12, hits: 5, hitInterval: 4, knockback: { x: 160, y: 0 },
      knockdown: true, vfx: "loving_grace", durability: 5, meterGain: 0,
    },
  },
  throw: { name: "Policy Review", damage: 125 },
  finisher: {
    id: "deep_reading", name: "Deep Reading", input: "D,D,B+HK", range: 260,
    description: "Dario hands over a 15,000-word essay. The opponent sits down to read it and is still reading when the lights go out.",
    vfx: "finisher_deep_reading",
  },
  assist: "constitution_scroll",
});
