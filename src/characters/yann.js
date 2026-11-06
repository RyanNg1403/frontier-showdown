import { defineCharacter } from "./schema.js";

/**
 * Yann LeCun, "The Contrarian" (roster doc 3.10). Zoner and anti-air specialist: a
 * ground-sliding convolution kernel, an RC plane for air control and a cake trap, with the
 * World Model passive punishing jumps.
 */

const cake = (homing) => ({
  place: {
    type: "trap", look: "cake", offset: 150, w: 84, h: 60, lifetime: 300, max: 1, vfx: "lab_burst",
    trigger: {
      damage: 20, hitstun: 18,
      status: { slow: { frames: 40, speedMul: 0.4, noDash: true, look: "icing" } },
      pop: { damage: 20, vx: 50, vy: -620, gravity: 1500, look: "cherry", home: homing ? 2600 : 0 },
    },
  },
});

export default defineCharacter({
  id: "yann",
  name: "Yann LeCun",
  shortName: "Yann",
  title: "The Contrarian",
  lab: "AMI Labs",
  labId: "ami-labs",
  bio: "Keeps the opponent grounded and at mid range: Convolution on the floor, the RC plane overhead and a cake for anyone who walks in. Jumping at him is, in his words, doomed.",
  quotes: {
    intro: "A house cat has way more common sense and understanding of the world than any LLM.",
    victory: ["The platform that will win will be the open one.", "You can manipulate language and not be smart."],
    rival: {
      sam: "You can manipulate language and not be smart.",
      dario: "You can manipulate language and not be smart.",
      andrej: "You can manipulate language and not be smart.",
    },
  },
  palette: {
    primary: "#1d2a44",
    secondary: "#24262c",
    accent: "#e0457b",
    shirt: "#c9ccd1",
    skin: "#efc2a6",
    hair: "#9a9a9a",
    shoes: "#5b3a24",
    glasses: "#0d0d0d",
    glassesStyle: "thick",
  },
  stats: { health: 1000, walkSpeed: 185, runSpeed: 430, jump: 190, weight: 1.05 },
  normals: {
    lp: {
      name: "EWI Poke", startup: 7, active: 2, recovery: 12, damage: 24, hitstun: 16, blockstun: 13,
      hitbox: { x: 22, y: -160, w: 104, h: 22 }, knockback: { x: 160 }, level: "high", meterGain: 3,
      cancelInto: ["lp", "hp", "special", "super"],
    },
    hp: {
      name: "Jazz Swing", startup: 13, active: 4, recovery: 21, damage: 66, hitstun: 22, blockstun: 17,
      hitbox: { x: 24, y: -184, w: 122, h: 50 }, knockback: { x: 300 }, level: "high", meterGain: 5,
      cancelInto: ["special", "super"],
    },
    lk: {
      name: "Short Kick", startup: 9, active: 3, recovery: 15, damage: 30, hitstun: 16, blockstun: 13,
      hitbox: { x: 20, y: -96, w: 96, h: 26 }, knockback: { x: 190 }, level: "mid", meterGain: 4,
      cancelInto: ["hk", "special", "super"],
    },
    hk: {
      name: "Long Sweeping Kick", startup: 15, active: 4, recovery: 23, damage: 76, hitstun: 24, blockstun: 18,
      hitbox: { x: 30, y: -128, w: 140, h: 40 }, knockback: { x: 380 }, level: "mid", meterGain: 6,
      cancelInto: ["special", "super"],
    },
    c_lp: {
      name: "Low Reed", startup: 7, active: 2, recovery: 12, damage: 20, hitstun: 15, blockstun: 12,
      hitbox: { x: 18, y: -100, w: 92, h: 22 }, knockback: { x: 140 }, level: "mid", meterGain: 3,
      cancelInto: ["c_lp", "c_lk", "special", "super"],
    },
    c_lk: {
      name: "Toe Tap", startup: 8, active: 2, recovery: 15, damage: 22, hitstun: 15, blockstun: 12,
      hitbox: { x: 20, y: -28, w: 110, h: 24 }, knockback: { x: 150 }, level: "low", meterGain: 3,
      cancelInto: ["c_lp", "special", "super"],
    },
    c_hp: {
      name: "Max Pool", startup: 9, active: 4, recovery: 28, damage: 100, hitstun: 30, blockstun: 18,
      hitbox: { x: 0, y: -250, w: 84, h: 170 }, knockback: { x: 100, y: 1160 }, level: "mid", meterGain: 6,
      hitstop: 13, invuln: { from: 1, to: 6, type: "projectile" }, cancelInto: ["special", "super"], vfx: "lab_burst",
    },
    c_hk: {
      name: "Gradient Sweep", startup: 13, active: 3, recovery: 29, damage: 72, hitstun: 24, blockstun: 18,
      hitbox: { x: 18, y: -26, w: 150, h: 26 }, knockback: { x: 210, y: 320 }, level: "low", knockdown: true,
      meterGain: 5,
    },
    j_p: {
      name: "Downward EWI", startup: 8, active: 6, recovery: 8, damage: 60, hitstun: 20, blockstun: 16,
      hitbox: { x: 6, y: -110, w: 96, h: 60 }, knockback: { x: 180 }, level: "overhead", meterGain: 4,
    },
    j_k: {
      name: "Brown-Shoe Stomp", startup: 8, active: 7, recovery: 8, damage: 60, hitstun: 20, blockstun: 16,
      hitbox: { x: 8, y: -94, w: 104, h: 48 }, knockback: { x: 200 }, level: "overhead", meterGain: 4,
    },
    b_hp: {
      name: "Optimal Brain Damage", startup: 18, active: 5, recovery: 20, damage: 40, hitstun: 18, blockstun: 14,
      hitbox: { x: 20, y: -170, w: 120, h: 110 }, knockback: { x: 220 }, level: "mid", meterGain: 4,
      mech: { prune: true },
      description: "A slow pruning swipe that removes one enemy projectile, trap or barrier it touches.",
    },
  },
  specials: [
    {
      id: "convolution", name: "Convolution", input: "QCF+P",
      description: "A glowing 3x3 kernel slides along the floor and convolves over the opponent: 4 low hits. LP slow, HP fast. Scale Up: a second kernel stacked at mid height.",
      startup: 16, active: 2, recovery: 28, damage: 0, meterGain: 7, vfx: "special_ami-labs",
      projectile: {
        speed: 240, hitbox: { x: -34, y: -26, w: 68, h: 52 }, offset: { x: 84, y: -26 }, lifetime: 220,
        damage: 15, chip: 2, hitstun: 14, blockstun: 11, hits: 4, hitInterval: 6, knockback: { x: 120 },
        level: "low", vfx: "projectile_ami-labs", meterGain: 3,
        mech: { look: "kernel" },
      },
      variants: { LP: { projectile: { speed: 240 } }, HP: { projectile: { speed: 420 } } },
      scaleUp: { projectile: { damage: 18, mech: { look: "kernel", stack: [{ dy: -96, level: "mid" }] } } },
    },
    {
      id: "rc_air_strike", name: "RC Air Strike", input: "QCB+P",
      description: "Launches a foam RC plane that climbs and then dives. LP dives near (anti-air), HP dives far onto the opponent's head (overhead). Scale Up: the plane loops back once.",
      startup: 18, active: 2, recovery: 26, damage: 0, meterGain: 7, vfx: "special_ami-labs",
      projectile: {
        speed: 230, spread: [-760], gravity: 1300, hitbox: { x: -30, y: -16, w: 60, h: 32 }, offset: { x: 60, y: -150 }, lifetime: 200,
        damage: 55, chip: 7, hitstun: 20, blockstun: 16, knockback: { x: 180 }, level: "overhead",
        vfx: "projectile_ami-labs", meterGain: 8,
        mech: { look: "plane" },
      },
      variants: { LP: { projectile: { speed: 230 } }, HP: { projectile: { speed: 440, spread: [-700] } } },
      scaleUp: { projectile: { mech: { look: "plane", loop: 1 } } },
    },
    {
      id: "cake_analogy", name: "The Cake", input: "D,N,B+K",
      description: "Sets a three-layer cake on the floor (max 1, 5 s). An opponent who steps in is stuck in icing (slowed for 40 f, no dash) and the cherry pops off at them. Scale Up: the cherry homes.",
      startup: 20, active: 1, recovery: 18, damage: 0, meterGain: 4, vfx: "lab_burst",
      mech: cake(false),
      scaleUp: { mech: cake(true) },
    },
  ],
  super: {
    id: "jepa", name: "JEPA", input: "QCF,QCF+HP", meterCost: 300, freeze: 30,
    description: "Breakthrough. A translucent embedding cube freezes the opponent; ghost outlines of predicted poses are struck one by one to a fast jazz solo.",
    startup: 9, active: 3, recovery: 48, damage: 0, meterGain: 0, invuln: { from: 1, to: 11, type: "all" }, vfx: "lab_beam",
    projectile: {
      speed: 560, hitbox: { x: -76, y: -96, w: 152, h: 176 }, offset: { x: 96, y: -100 }, lifetime: 100,
      damage: 55, chip: 11, hitstun: 24, blockstun: 12, hits: 6, hitInterval: 5, knockback: { x: 110 },
      knockdown: true, vfx: "projectile_ami-labs", durability: 6, meterGain: 0, scale: 1.9,
      mech: { look: "jepa" },
    },
  },
  throw: { name: "Check Reader", damage: 110 },
  finisher: {
    id: "smarter_than_a_house_cat", name: "Smarter Than a House Cat", input: "D,B,F+LK", range: "far",
    description: "A puff of rose smoke turns the opponent into a fluffy house cat, which calmly knocks Yann's coffee cup off a table. Yann shrugs: \"Common sense.\"",
    vfx: "finisher_house_cat",
  },
  assists: { a: "convolution", b: "rc_air_strike" },
  sharedSkills: ["dash", "run", "throw", "throw_tech", "block", "alignment_block", "guardrail", "scale_up", "rollback", "breakthrough", "tag", "assist", "swap_guard", "lab:ami-labs"],
});
