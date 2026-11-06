import { defineCharacter } from "./schema.js";
import "../combat/mechanics/group-b/index.js";
import "../combat/ai-kits/group-b.js";

const DGX = Object.freeze({ range: 85, damage: 170, techable: false, knockback: { x: 360, y: 720 } });
const DGX_UP = Object.freeze({ damage: 210, knockback: { x: 760, y: 560 } });
const TURRET = Object.freeze({ offset: 80, lifetime: 300, hp: 150, interval: 60, firstShot: 30, shots: 1, token: { damage: 25, speed: 330 } });

/**
 * Jensen Huang, "The Leather Jacket" (roster doc 3.6). Big-body juggernaut: the most health
 * and weight, a heavy GPU-board projectile, an AI Factory turret and a command grab.
 */
export default defineCharacter({
  id: "jensen",
  name: "Jensen Huang",
  shortName: "Jensen",
  title: "The Leather Jacket",
  lab: "NVIDIA",
  labId: "nvidia",
  archetype: "juggernaut",
  difficulty: 2,
  bio: "Sets an AI Factory turret, lobs This Has Been Cooking, and command-grabs anyone who walks in. Hits harder the more Compute he banks.",
  quotes: {
    intro: "No one can carry more coffee cups than I can.",
    victory: ["The more you buy, the more you save.", "CEO math. It's not accurate, but it is correct."],
    lowHealth: "I think best when I'm under adversity. My heart rate actually goes down.",
    rival: {},
  },
  palette: {
    primary: "#101013",
    secondary: "#18181c",
    accent: "#76b900",
    shirt: "#222227",
    skin: "#d9a777",
    hair: "#b8bcc4",
    hairStyle: "swept",
    zip: "#c8ccd4",
    shoes: "#0b0b0c",
  },
  stats: { health: 1150, walkSpeed: 165, runSpeed: 400, jump: 175, weight: 1.2, height: 198 },
  pushbox: { stand: { w: 72, h: 184 }, crouch: { w: 76, h: 122 }, air: { w: 60, h: 144 } },
  normals: {
    lp: {
      name: "Keynote Clicker", startup: 7, active: 2, recovery: 12, damage: 26, hitstun: 16, blockstun: 13,
      hitbox: { x: 24, y: -164, w: 84, h: 24 }, knockback: { x: 160 }, level: "high", meterGain: 3,
      cancelInto: ["lp", "hp", "special", "super"],
    },
    hp: {
      name: "Superchip Slam", startup: 14, active: 4, recovery: 24, damage: 70, hitstun: 23, blockstun: 18,
      hitbox: { x: 20, y: -194, w: 126, h: 64 }, knockback: { x: 320 }, level: "high", meterGain: 5, hitstop: 13,
      cancelInto: ["special", "super"],
    },
    lk: {
      name: "Short Stomp", startup: 9, active: 3, recovery: 16, damage: 32, hitstun: 16, blockstun: 13,
      hitbox: { x: 18, y: -40, w: 92, h: 40 }, knockback: { x: 170 }, level: "low", meterGain: 4,
      cancelInto: ["hk", "special", "super"],
    },
    hk: {
      name: "Jacket Spin", startup: 15, active: 4, recovery: 24, damage: 78, hitstun: 24, blockstun: 18,
      hitbox: { x: 22, y: -176, w: 126, h: 46 }, knockback: { x: 380 }, level: "mid", meterGain: 6, limb: "arm",
      cancelInto: ["special", "super"],
    },
    f_hp: {
      name: "Denny's Booth", anim: "dennys_booth", startup: 22, active: 3, recovery: 22, damage: 68, hitstun: 24, blockstun: 17,
      hitbox: { x: 18, y: -170, w: 112, h: 170 }, knockback: { x: 260 }, level: "overhead", meterGain: 5, hitstop: 13,
      cancelInto: ["special", "super"], description: "An overhead diner-tray smash.",
    },
    c_lp: {
      name: "Marker Poke", startup: 8, active: 2, recovery: 13, damage: 22, hitstun: 15, blockstun: 12,
      hitbox: { x: 18, y: -102, w: 84, h: 22 }, knockback: { x: 140 }, level: "mid", meterGain: 3,
      cancelInto: ["c_lp", "c_lk", "special", "super"],
    },
    c_lk: {
      name: "Hand-Truck Kick", startup: 9, active: 2, recovery: 16, damage: 24, hitstun: 15, blockstun: 12,
      hitbox: { x: 20, y: -28, w: 104, h: 26 }, knockback: { x: 160 }, level: "low", meterGain: 3,
      cancelInto: ["c_lp", "special", "super"],
    },
    c_hp: {
      name: "Tray Lift", startup: 11, active: 4, recovery: 30, damage: 108, hitstun: 30, blockstun: 18,
      hitbox: { x: 4, y: -226, w: 92, h: 150 }, knockback: { x: 90, y: 1080 }, level: "mid", meterGain: 6,
      hitstop: 14, cancelInto: ["special", "super"],
    },
    c_hk: {
      name: "Server Sweep", startup: 14, active: 3, recovery: 30, damage: 76, hitstun: 24, blockstun: 18,
      hitbox: { x: 18, y: -28, w: 140, h: 28 }, knockback: { x: 220, y: 320 }, level: "low", knockdown: true,
      meterGain: 5,
    },
    j_p: {
      name: "Chip Drop", startup: 9, active: 6, recovery: 8, damage: 64, hitstun: 20, blockstun: 16,
      hitbox: { x: 6, y: -140, w: 92, h: 52 }, knockback: { x: 190 }, level: "overhead", meterGain: 4,
    },
    j_k: {
      name: "Boot Drop", startup: 8, active: 7, recovery: 8, damage: 66, hitstun: 20, blockstun: 16,
      hitbox: { x: 4, y: -96, w: 104, h: 52 }, knockback: { x: 210 }, level: "overhead", meterGain: 4,
    },
  },
  specials: [
    {
      id: "been_cooking", name: "This Has Been Cooking", input: "QCB+P",
      description: "Pulls a glowing GPU board out of a kitchen oven and hurls it: LP lobs it in an arc, HP throws it straight and fast. Breaks lighter projectiles. Scale Up: the board splits into 3 on impact.",
      startup: 22, active: 2, recovery: 34, damage: 0, meterGain: 7, vfx: "oven_open",
      projectile: {
        speed: 640, hitbox: { x: -36, y: -24, w: 72, h: 48 }, offset: { x: 88, y: -132 }, lifetime: 160,
        damage: 75, chip: 9, hitstun: 22, blockstun: 18, knockback: { x: 260 }, durability: 2, vfx: "projectile_nvidia", meterGain: 8,
      },
      variants: {
        LP: { projectile: { speed: 330, spread: [-760], gravity: 1500 } },
        HP: { projectile: { speed: 640 } },
      },
      scaleUp: { projectile: { mech: { shatter: { count: 3, damage: 22 } } } },
    },
    {
      id: "dgx_delivery", name: "Hand-Delivered DGX", input: "HCB,F+P",
      description: "Half-circle back, forward (a 360 once that motion lands). Boxes the opponent in a giant DGX, signs the lid (\"I present you…\") and kicks it over. Unblockable. HP reaches 110 px with more recovery. Scale Up: +40 damage and a wall bounce.",
      startup: 8, active: 2, recovery: 48, damage: 170, meterGain: 12, vfx: "dgx_box",
      grab: DGX,
      variants: {
        LP: { grab: DGX },
        HP: { grab: { ...DGX, range: 110 }, recovery: 56, scaleUp: { grab: { ...DGX, range: 110, ...DGX_UP }, mech: { wallBounce: true } } },
      },
      scaleUp: { grab: { ...DGX, ...DGX_UP }, mech: { wallBounce: true } },
    },
    {
      id: "ai_factory", name: "AI Factory", input: "D,B+K",
      description: "Deploys a humming server rack that fires a green token-cube every second. Max 1; 150 HP, so it can be destroyed. Scale Up: two tokens per cycle.",
      startup: 24, active: 2, recovery: 20, damage: 0, meterGain: 4, vfx: "server_rack",
      mech: { turret: TURRET },
      scaleUp: { mech: { turret: { ...TURRET, shots: 2 } } },
    },
  ],
  super: {
    id: "vera_rubin_keynote", name: "Vera Rubin Keynote", input: "QCF,QCF+HP", meterCost: 300, freeze: 30,
    description: "Breakthrough. Spotlights: a rack drops from the rafters onto the opponent while a crowd counter climbs to 3.6 EXAFLOPS. +10% damage per Compute bar banked when it starts.",
    startup: 10, active: 3, recovery: 60, damage: 0, meterGain: 0, invuln: { from: 1, to: 12, type: "all" }, vfx: "keynote_spotlight",
    projectile: {
      speed: 0, hitbox: { x: -80, y: -90, w: 160, h: 180 }, offset: { x: 0, y: -380 }, lifetime: 110,
      damage: 68, chip: 14, hitstun: 26, blockstun: 12, hits: 5, hitInterval: 6, knockback: { x: 80 }, knockdown: true,
      gravity: 900, durability: 9, vfx: "projectile_rack", meterGain: 0, scale: 2,
      mech: { spawnAt: "opponent", y: -380 },
    },
    mech: { keynote: { perBar: 0.1 } },
  },
  throw: { name: "Who Makes the Best?", damage: 120 },
  finisher: {
    id: "signed_limited_edition", name: "Signed Limited Edition", input: "B,F,B+HP", range: "close",
    description: "Jensen shrink-wraps the opponent into a collectible action-figure box (\"Limited Edition, 1 of 1\"), autographs it and shelves it among the GPU boxes. The figure inside waves.",
    vfx: "finisher_signed_limited_edition",
  },
  assists: { a: "been_cooking", b: "ai_factory" },
  ai: {
    antiAir: "c_hp",
    punish: ["c_hp", "hk"],
    pressure: ["f_hp", "lk"],
    cancel: ["been_cooking:HP"],
    grabRate: 0.3,
    projectileRange: [300, 900],
    superRange: 700,
  },
  sharedSkills: ["dash", "run", "throw", "throw_tech", "block", "alignment_block", "guardrail", "scale_up", "rollback", "breakthrough", "tag", "assist", "swap_guard", "lab:nvidia"],
});
