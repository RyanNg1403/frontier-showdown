import { defineCharacter } from "./schema.js";
import { bodyFor } from "../combat/mechanics/body-scale.js";
import { registerAirDive } from "../combat/mechanics/air-dive.js";
import "../combat/mechanics/grabs.js";
import "../combat/mechanics/guard-crush.js";
import "../combat/mechanics/finisher-inputs.js";
import "../combat/ai-kits/group-a.js";

/**
 * "The Walrus" is jumping down+HP, a command normal the schema has no key for, so it is
 * normalized on its own and started by the "elon-walrus" air-dive mechanic.
 */
const WALRUS = Object.freeze({
  ...defineCharacter({
    id: "elon",
    normals: {
      j_p: {
        name: "The Walrus", startup: 9, active: 30, recovery: 4, damage: 70, hitstun: 22, blockstun: 18,
        hitbox: { x: -34, y: -96, w: 124, h: 80 }, knockback: { x: 160 }, level: "overhead", knockdown: true,
        velocity: [{ from: 6, to: 38, vx: 200, vy: 1150 }], landingRecovery: 14, meterGain: 5, hitstop: 12,
        mechanic: "ground-bounce", mechanicData: { groundBounce: { bounce: 760, slam: 900 }, landingRecoveryOnHit: 4 },
        description: "Belly-flop dive (jumping down+HP). Overhead; a hit slams the opponent into the floor for a ground bounce.",
      },
    },
  }).normals.j_p,
  id: "j_d_hp",
});
registerAirDive("elon-walrus", WALRUS);

/**
 * Elon Musk, "The Technoking" (roster doc 3.4). Rushdown / wildcard and the tallest fighter:
 * a short-range flame stream, an anti-air command grab, an arcing guard-crush lob, and a
 * belly-flop air dive that ground-bounces.
 */
export default defineCharacter({
  id: "elon",
  name: "Elon Musk",
  shortName: "Elon",
  title: "The Technoking",
  lab: "SpaceX / xAI",
  labId: "xai",
  archetype: "rushdown",
  difficulty: 2,
  bio: "Technoking of Tesla and head of SpaceX, which owns xAI. Runs in, pressures with Not-a-Flamethrower, catches jump-outs with Mechazilla, and belly-flops in with The Walrus.",
  quotes: {
    intro: "I have this great move that I call 'The Walrus,' where I just lie on top of my opponent and do nothing.",
    victory: ["To the moon!"],
    guardBroken: "Room for improvement.",
    rival: { mark: "I have this great move that I call 'The Walrus,' where I just lie on top of my opponent and do nothing." },
  },
  palette: {
    primary: "#16161a",
    secondary: "#283044",
    accent: "#ff3b30",
    skin: "#efc8ac",
    hair: "#6a4a33",
    shoes: "#121212",
  },
  stats: { health: 1000, walkSpeed: 225, runSpeed: 520, jump: 225, weight: 1.1, height: 214 },
  ...bodyFor(214, 1.08),
  mechanics: ["guard-crush", "elon-walrus", "finisher-no-jump"],
  normals: {
    lp: {
      name: "Quick Jab", startup: 7, active: 2, recovery: 12, damage: 24, hitstun: 16, blockstun: 13,
      hitbox: { x: 24, y: -178, w: 88, h: 24 }, knockback: { x: 150 }, level: "high", meterGain: 3,
      cancelInto: ["lp", "hp", "special", "super"],
    },
    hp: {
      name: "Exhaust Haymaker", startup: 13, active: 3, recovery: 21, damage: 68, hitstun: 22, blockstun: 17,
      hitbox: { x: 26, y: -184, w: 112, h: 34 }, knockback: { x: 300 }, level: "high", meterGain: 5,
      cancelInto: ["special", "super"], vfx: "lab_burst",
    },
    lk: {
      name: "Boot Poke", startup: 9, active: 3, recovery: 16, damage: 32, hitstun: 16, blockstun: 13,
      hitbox: { x: 22, y: -106, w: 110, h: 26 }, knockback: { x: 200 }, level: "mid", meterGain: 4,
      cancelInto: ["hk", "special", "super"],
    },
    hk: {
      name: "Booster Stomp", startup: 15, active: 4, recovery: 23, damage: 76, hitstun: 24, blockstun: 18,
      hitbox: { x: 26, y: -204, w: 112, h: 124 }, knockback: { x: 360 }, level: "mid", meterGain: 6,
      cancelInto: ["special", "super"],
    },
    c_lp: {
      name: "Low Jab", startup: 7, active: 2, recovery: 12, damage: 20, hitstun: 15, blockstun: 12,
      hitbox: { x: 18, y: -104, w: 86, h: 22 }, knockback: { x: 140 }, level: "mid", meterGain: 3,
      cancelInto: ["c_lp", "c_lk", "special", "super"],
    },
    c_lk: {
      name: "Shin Tap", startup: 8, active: 2, recovery: 15, damage: 22, hitstun: 15, blockstun: 12,
      hitbox: { x: 20, y: -28, w: 112, h: 24 }, knockback: { x: 160 }, level: "low", meterGain: 3,
      cancelInto: ["c_lp", "special", "super"],
    },
    c_hp: {
      name: "Rocket Uppercut", startup: 10, active: 4, recovery: 28, damage: 105, hitstun: 30, blockstun: 18,
      hitbox: { x: 6, y: -236, w: 82, h: 156 }, knockback: { x: 110, y: 1200 }, level: "mid", meterGain: 6,
      hitstop: 13, cancelInto: ["special", "super"], vfx: "lab_burst",
    },
    c_hk: {
      name: "Tunnel Sweep", startup: 14, active: 3, recovery: 28, damage: 72, hitstun: 24, blockstun: 18,
      hitbox: { x: 18, y: -26, w: 150, h: 26 }, knockback: { x: 210, y: 320 }, level: "low", knockdown: true,
      meterGain: 5,
    },
    j_p: {
      name: "Falling Haymaker", startup: 8, active: 6, recovery: 8, damage: 60, hitstun: 20, blockstun: 16,
      hitbox: { x: 10, y: -142, w: 90, h: 46 }, knockback: { x: 190 }, level: "overhead", meterGain: 4,
    },
    j_k: {
      name: "Booster Boot", startup: 7, active: 7, recovery: 8, damage: 62, hitstun: 20, blockstun: 16,
      hitbox: { x: 8, y: -98, w: 112, h: 48 }, knockback: { x: 210 }, level: "overhead", meterGain: 4,
    },
    f_hk: {
      name: "Cybertruck Charge", anim: "heavy_punch", limb: "arm", startup: 16, active: 4, recovery: 22, damage: 70,
      hitstun: 22, blockstun: 18, hitbox: { x: 16, y: -176, w: 92, h: 120 }, knockback: { x: 380 }, level: "mid",
      velocity: [{ from: 5, to: 19, vx: 380 }], meterGain: 5, cancelInto: ["special", "super"],
    },
  },
  specials: [
    {
      id: "not_a_flamethrower", name: "Not-a-Flamethrower", input: "QCF+P",
      description: "Sweeps a cartoon flame stream in front of him, six quick hits. LP reaches 120 px; HP reaches 200 px with more recovery. Scale Up: 1-hit armor and +3 hits.",
      startup: 12, active: 18, recovery: 22, damage: 12, chip: 2, hitstun: 16, blockstun: 19, hits: 6, hitInterval: 3,
      hitbox: { x: 34, y: -170, w: 120, h: 70 }, knockback: { x: 40 }, level: "mid", meterGain: 2, hitstop: 4,
      lastHit: { knockback: { x: 260 } }, vfx: "lab_burst",
      variants: {
        LP: { hitbox: { x: 34, y: -170, w: 120, h: 70 }, recovery: 22 },
        HP: { hitbox: { x: 34, y: -170, w: 200, h: 70 }, recovery: 28 },
      },
      scaleUp: { damage: 12, hits: 9, hitInterval: 2, armor: { from: 1, to: 12, hits: 1 } },
    },
    {
      id: "mechazilla_catch", name: "Mechazilla Catch", input: "DP+P", priority: 1,
      description: "Giant mechanical chopstick arms rise behind him and clamp an airborne opponent, lift them up the launch tower and drop them. Grounded opponents are not grabbed (punishable whiff). Scale Up: also grabs grounded opponents within 80 px.",
      startup: 7, active: 6, recovery: 34, damage: 0, meterGain: 12, vfx: "lab_pillar",
      mechanic: "anti-air-grab",
      mechanicData: { air: "only", range: 160, reach: 320, damage: 140, hold: 34, lift: 170, liftFrames: 14, knockback: { x: 160, y: 150 } },
      scaleUp: { mechanicData: { air: "also", range: 160, groundRange: 80, reach: 320, damage: 182, hold: 34, lift: 170, liftFrames: 14, knockback: { x: 160, y: 150 } } },
    },
    {
      id: "armor_glass", name: "Armor Glass", input: "B,F+P",
      description: "Lobs a steel ball in an arc. On block the opponent's guard cracks: their next block within 2 s suffers +6 blockstun. Scale Up: two balls, the second on a lower arc.",
      startup: 18, active: 2, recovery: 28, damage: 0, meterGain: 6, vfx: "special_xai",
      mechanicData: { guardCrush: { crack: { frames: 120, blockstun: 6 } } },
      projectile: {
        speed: 430, vy: -620, gravity: 1500, hitbox: { x: -20, y: -20, w: 40, h: 40 }, offset: { x: 60, y: -170 },
        lifetime: 120, damage: 60, chip: 7, hitstun: 22, blockstun: 18, knockback: { x: 240 }, vfx: "projectile_xai", meterGain: 8,
      },
      scaleUp: { projectile: { spread: [-620, -300], damage: 60 } },
    },
  ],
  super: {
    id: "colossus_launch", name: "Colossus Launch", input: "QCF,QCF+HP", meterCost: 300, freeze: 30,
    description: "Breakthrough. A wall of server racks slams up (\"built in 122 days\"), Elon uppercuts the opponent onto a Starship that arcs into orbit and lands back on the tower, where they are set down dizzy.",
    startup: 7, active: 28, recovery: 46, damage: 50, chip: 10, hitstun: 24, blockstun: 10, hits: 7, hitInterval: 4,
    hitbox: { x: 0, y: -260, w: 124, h: 260 }, knockback: { x: 40, y: 480 }, level: "mid", meterGain: 0,
    invuln: { from: 1, to: 7, type: "all" }, velocity: [{ from: 7, to: 28, vx: 60, vy: -460 }],
    lastHit: { knockback: { x: 320, y: 1000 }, knockdown: true }, hitstop: 8, landingRecovery: 16, vfx: "special_xai",
  },
  throw: { name: "Cage Match", damage: 110, knockback: { x: 340, y: 720 } },
  finisher: {
    id: "to_the_moon", name: "To the Moon", input: "D,U,U+HK", range: "far",
    description: "A Shiba-faced cartoon rocket lands. The opponent is buckled in (seatbelt, helmet) and launched; cut to the Moon, where they plant a tiny flag and wave at the camera.",
    vfx: "finisher_to_the_moon",
  },
  assists: { a: "not_a_flamethrower", b: "mechazilla_catch" },
  ai: {
    antiAir: "mechazilla_catch",
    pressure: ["not_a_flamethrower:LP"],
    punish: ["c_hp"],
    jumpIn: WALRUS,
    superRange: 200,
    projectileRange: [330, 520],
  },
  sharedSkills: ["dash", "run", "throw", "throw_tech", "block", "alignment_block", "guardrail", "scale_up", "rollback", "breakthrough", "tag", "assist", "swap_guard", "lab:xai"],
});
