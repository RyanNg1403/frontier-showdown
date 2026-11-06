import { defineCharacter } from "./schema.js";

/**
 * Andrej Karpathy, "The Vibe Coder" (roster doc 3.9). Technical all-rounder: a splitting
 * Tokenizer for mid range, a no-block Vibe Coding stance that chains anything into anything,
 * and Rubik's Rotation as the honest reversal.
 */

const token = { damage: 20, chip: 3, hitbox: { x: -14, y: -14, w: 28, h: 28 }, speed: 440, scale: 0.55, look: "token" };
const split = (after, vys = [-260, 0, 260], levels = ["mid", "mid", "low"]) => ({ look: "token_word", split: { ...token, after, vys, levels } });
const vibe = (frames, damage) => ({ status: { stance: { frames, damage, noBlock: true, chainNormals: true, whiffCancel: true, breakOnHit: true, look: "vibe" } } });

export default defineCharacter({
  id: "andrej",
  name: "Andrej Karpathy",
  shortName: "Andrej",
  title: "The Vibe Coder",
  lab: "Anthropic",
  labId: "anthropic",
  archetype: "technical all-rounder",
  difficulty: 2,
  bio: "Builds his own routes from scratch. Controls mid range with Tokenizer, gives in to the vibes with a life lead, and keeps Rubik's Rotation as the honest reversal.",
  quotes: {
    intro: "The hottest new programming language is English.",
    victory: [
      "I just see stuff, say stuff, run stuff, and copy paste stuff, and it mostly works.",
      "Everything else is just efficiency.",
    ],
  },
  palette: {
    primary: "#d89aa0",
    secondary: "#2b3446",
    accent: "#ff5fd2",
    skin: "#f1cfb4",
    hair: "#2a1f1a",
    shoes: "#8a8d93",
  },
  stats: { health: 980, walkSpeed: 215, runSpeed: 480, jump: 210, weight: 0.95 },
  normals: {
    lp: {
      name: "Marker Jab", startup: 7, active: 2, recovery: 11, damage: 24, hitstun: 16, blockstun: 13,
      hitbox: { x: 22, y: -166, w: 88, h: 24 }, knockback: { x: 150 }, level: "mid", meterGain: 3,
      cancelInto: ["lp", "hp", "special", "super"],
    },
    hp: {
      name: "Whiteboard Swipe", startup: 12, active: 4, recovery: 20, damage: 64, hitstun: 22, blockstun: 17,
      hitbox: { x: 24, y: -178, w: 112, h: 46 }, knockback: { x: 290 }, level: "mid", meterGain: 5,
      cancelInto: ["special", "super"],
    },
    lk: {
      name: "Sneaker Flick", startup: 9, active: 3, recovery: 15, damage: 30, hitstun: 16, blockstun: 13,
      hitbox: { x: 20, y: -100, w: 100, h: 26 }, knockback: { x: 190 }, level: "mid", meterGain: 4,
      cancelInto: ["hk", "special", "super"],
    },
    hk: {
      name: "Token Scatter", startup: 14, active: 4, recovery: 22, damage: 74, hitstun: 24, blockstun: 18,
      hitbox: { x: 28, y: -160, w: 122, h: 42 }, knockback: { x: 360 }, level: "mid", meterGain: 6,
      cancelInto: ["special", "super"],
    },
    c_lp: {
      name: "Pointer Tap", startup: 7, active: 2, recovery: 12, damage: 20, hitstun: 15, blockstun: 12,
      hitbox: { x: 18, y: -102, w: 84, h: 22 }, knockback: { x: 140 }, level: "mid", meterGain: 3,
      cancelInto: ["c_lp", "c_lk", "special", "super"],
    },
    c_lk: {
      name: "Shin Ping", startup: 8, active: 2, recovery: 14, damage: 22, hitstun: 15, blockstun: 12,
      hitbox: { x: 20, y: -28, w: 108, h: 24 }, knockback: { x: 150 }, level: "low", meterGain: 3,
      cancelInto: ["c_lp", "special", "super"],
    },
    c_hp: {
      name: "Backprop", startup: 10, active: 3, recovery: 28, damage: 100, hitstun: 30, blockstun: 18,
      hitbox: { x: 6, y: -220, w: 78, h: 138 }, knockback: { x: 110, y: 1170 }, level: "mid", meterGain: 6,
      hitstop: 13, cancelInto: ["special", "super"],
    },
    c_hk: {
      name: "Gradient Descent", startup: 13, active: 3, recovery: 28, damage: 70, hitstun: 24, blockstun: 18,
      hitbox: { x: 18, y: -26, w: 142, h: 26 }, knockback: { x: 200, y: 320 }, level: "low", knockdown: true,
      meterGain: 5,
    },
    j_p: {
      name: "Cube Smash", startup: 8, active: 6, recovery: 8, damage: 62, hitstun: 20, blockstun: 16,
      hitbox: { x: 8, y: -138, w: 86, h: 46 }, knockback: { x: 180 }, level: "overhead", meterGain: 4,
    },
    j_k: {
      name: "Diagonal Flick", startup: 7, active: 7, recovery: 8, damage: 58, hitstun: 20, blockstun: 16,
      hitbox: { x: 8, y: -94, w: 104, h: 48 }, knockback: { x: 200 }, level: "overhead", meterGain: 4,
    },
    f_lp: {
      name: "micrograd", anim: "light_punch", startup: 10, active: 2, recovery: 14, damage: 28, hitstun: 17, blockstun: 13,
      hitbox: { x: 16, y: -40, w: 104, h: 36 }, knockback: { x: 120 }, level: "low", meterGain: 4, hitstop: 8,
      cancelInto: ["lp"],
      description: "Target combo starter: F+LP, LP, HP (low, mid, mid).",
    },
  },
  specials: [
    {
      id: "tokenizer", name: "Tokenizer", input: "QCF+P",
      description: "Throws a magenta word that splits into three sub-word token chips (up, straight, low). LP splits early, HP splits late. Scale Up: five tokens, one aimed low.",
      startup: 16, active: 2, recovery: 30, damage: 0, meterGain: 7, vfx: "special_anthropic",
      projectile: {
        speed: 400, hitbox: { x: -34, y: -16, w: 68, h: 32 }, offset: { x: 76, y: -142 }, lifetime: 200,
        damage: 60, chip: 7, hitstun: 20, blockstun: 16, knockback: { x: 200 }, vfx: "projectile_anthropic", meterGain: 8,
        mech: split(22),
      },
      variants: {
        LP: { projectile: { mech: split(12) } },
        HP: { projectile: { mech: split(32) } },
      },
      scaleUp: { projectile: { damage: 60, mech: split(18, [-330, -160, 0, 160, 330], ["mid", "mid", "mid", "mid", "low"]) } },
    },
    {
      id: "vibe_coding", name: "Vibe Coding", input: "D,N,B+P",
      description: "\"Fully give in to the vibes.\" For 4 s any normal chains into any other and specials cancel on whiff, but he cannot block (Alignment Block still works). Ends early when hit. Scale Up: 6 s and +8% damage.",
      startup: 12, active: 1, recovery: 14, damage: 0, meterGain: 0, vfx: "lab_aura",
      mech: vibe(240, 1),
      scaleUp: { mech: vibe(360, 1.08) },
    },
    {
      id: "rubiks_rotation", name: "Rubik's Rotation", input: "DP+K", priority: 1,
      description: "Spins upward inside a rotating magenta cube; each face turn is a hit (3 hits). Invulnerable on frames 1-6. Scale Up: 5 hits ending in a wall bounce.",
      startup: 6, active: 10, recovery: 34, damage: 32, chip: 4, hitstun: 26, blockstun: 20, hits: 3, hitInterval: 3,
      hitbox: { x: 4, y: -232, w: 88, h: 170 }, knockback: { x: 80, y: 820 }, level: "mid", meterGain: 8, limb: "leg",
      invuln: { from: 1, to: 6, type: "all" }, velocity: [{ from: 3, to: 13, vx: 120, vy: -640 }],
      lastHit: { knockback: { x: 260, y: 1150 }, knockdown: true },
      hitstop: 9, landingRecovery: 12, vfx: "special_anthropic", cancelInto: ["super"],
      scaleUp: {
        damage: 26, hits: 5, hitInterval: 2,
        lastHit: { knockback: { x: 760, y: 760 }, knockdown: true },
        mech: { wallBounce: true },
      },
    },
  ],
  super: {
    id: "microgpt", name: "microgpt", input: "QCF,QCF+HP", meterCost: 300, freeze: 30,
    description: "Breakthrough. Writes a GPT in 200 lines on a giant whiteboard; the letters assemble into a glowing transformer block that slams down on the opponent (stand to block).",
    startup: 8, active: 2, recovery: 50, damage: 0, meterGain: 0, invuln: { from: 1, to: 12, type: "all" }, vfx: "lab_beam",
    projectile: {
      speed: 0, spread: [1150], hitbox: { x: -90, y: -80, w: 180, h: 160 }, offset: { x: 0, y: -520 }, lifetime: 70,
      damage: 55, chip: 11, hitstun: 22, blockstun: 12, hits: 6, hitInterval: 4, knockback: { x: 90 },
      knockdown: true, level: "overhead", vfx: "projectile_anthropic", durability: 6, meterGain: 0, scale: 2,
      mech: { spawnAt: "opponent", y: -520, floor: -82, look: "transformer" },
    },
  },
  throw: { name: "Let's Build It", damage: 110 },
  finisher: {
    id: "software_2_0", name: "Software 2.0", input: "B,D,F+HP", range: "mid",
    description: "The opponent freezes into a grid of colourful floating weights. Andrej compiles them with a tap of the marker, and they reappear as a cheerful 8-bit sprite of themselves on a tiny monitor.",
    vfx: "finisher_software_2_0",
  },
  assists: { a: "tokenizer", b: "rubiks_rotation" },
  sharedSkills: ["dash", "run", "throw", "throw_tech", "block", "alignment_block", "guardrail", "scale_up", "rollback", "breakthrough", "tag", "assist", "swap_guard", "lab:anthropic"],
});
