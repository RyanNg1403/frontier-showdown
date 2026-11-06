import { defineCharacter } from "./schema.js";
import "../combat/mechanics/group-b/index.js";
import "../combat/ai-kits/group-b.js";

const STONES = Object.freeze({
  offset: 120, lifetime: 300, max: 2, armDelay: 12, radius: 34, burstRadius: 70, detonate: "D,N,B+P",
  hit: { damage: 60, chip: 6, hitstun: 20, blockstun: 14, knockback: { x: 120, y: 560 }, level: "mid" },
});
const ECHO = Object.freeze({ duration: 360, delay: 20, hp: 100, damageScale: 0.7, placement: "beside", distance: 80, stun: 30 });

/**
 * Demis Hassabis, "The Grandmaster" (roster doc 3.5). Setup / trap: Go-stone mines with
 * remote detonation, an AlphaFold bind, and a Self-Play echo that repeats his normals.
 */
export default defineCharacter({
  id: "demis",
  name: "Demis Hassabis",
  shortName: "Demis",
  title: "The Grandmaster",
  lab: "Google DeepMind",
  labId: "google-deepmind",
  archetype: "setup / trap",
  difficulty: 3,
  bio: "Weak until set up, oppressive after. Knocks down, lays two Move 37 stones, then pressures with the Self-Play echo so every guess the opponent makes lands in a trap.",
  quotes: {
    intro: "I've been working towards AGI my whole life and now… I feel it is close at hand.",
    victory: ["Solve intelligence, then use it to solve everything else.", "We should be in a world of what I sometimes call radical abundance."],
    rival: { mustafa: "A nod and a handshake. Co-founders first." },
  },
  palette: {
    primary: "#161616",
    secondary: "#1d1d20",
    accent: "#8b7cff",
    skin: "#d8af88",
    hair: "#3d3532",
    hairStyle: "shaved",
    beard: "#77716b",
    glasses: "#1f4fd1",
    shoes: "#0f0f10",
  },
  stats: { health: 980, walkSpeed: 195, runSpeed: 450, jump: 205, weight: 0.95, height: 192 },
  normals: {
    lp: {
      name: "Finger Jab", startup: 6, active: 2, recovery: 11, damage: 22, hitstun: 16, blockstun: 13,
      hitbox: { x: 22, y: -160, w: 82, h: 22 }, knockback: { x: 150 }, level: "high", meterGain: 3,
      cancelInto: ["lp", "hp", "special", "super"],
    },
    hp: {
      name: "Grid Palm", startup: 12, active: 3, recovery: 21, damage: 64, hitstun: 22, blockstun: 17,
      hitbox: { x: 24, y: -166, w: 104, h: 34 }, knockback: { x: 290 }, level: "high", meterGain: 5, vfx: "grid_square",
      cancelInto: ["special", "super"],
    },
    lk: {
      name: "Sneaker Tap", startup: 9, active: 3, recovery: 15, damage: 28, hitstun: 16, blockstun: 13,
      hitbox: { x: 20, y: -96, w: 94, h: 24 }, knockback: { x: 180 }, level: "mid", meterGain: 4,
      cancelInto: ["hk", "special", "super"],
    },
    hk: {
      name: "Opening Theory", startup: 14, active: 4, recovery: 22, damage: 72, hitstun: 24, blockstun: 18,
      hitbox: { x: 28, y: -150, w: 116, h: 38 }, knockback: { x: 350 }, level: "mid", meterGain: 6,
      cancelInto: ["special", "super"],
    },
    f_hk: {
      name: "Knight's Move", startup: 20, active: 3, recovery: 20, damage: 62, hitstun: 22, blockstun: 17,
      hitbox: { x: 16, y: -146, w: 98, h: 146 }, knockback: { x: 240 }, level: "overhead", meterGain: 5,
      velocity: [{ from: 4, to: 18, vx: 170 }], cancelInto: ["special", "super"],
      description: "An L-shaped hop kick. Overhead.",
    },
    c_lp: {
      name: "Stone Tap", startup: 7, active: 2, recovery: 12, damage: 20, hitstun: 15, blockstun: 12,
      hitbox: { x: 18, y: -100, w: 82, h: 22 }, knockback: { x: 140 }, level: "mid", meterGain: 3,
      cancelInto: ["c_lp", "c_lk", "special", "super"],
    },
    c_lk: {
      name: "Low Ko", startup: 8, active: 2, recovery: 14, damage: 22, hitstun: 15, blockstun: 12,
      hitbox: { x: 20, y: -28, w: 104, h: 24 }, knockback: { x: 150 }, level: "low", meterGain: 3,
      cancelInto: ["c_lp", "special", "super"],
    },
    c_hp: {
      name: "Stone Flick", startup: 10, active: 3, recovery: 29, damage: 98, hitstun: 30, blockstun: 18,
      hitbox: { x: 6, y: -224, w: 78, h: 144 }, knockback: { x: 100, y: 1150 }, level: "mid", meterGain: 6,
      hitstop: 13, cancelInto: ["special", "super"],
    },
    c_hk: {
      name: "Endgame Sweep", startup: 13, active: 3, recovery: 28, damage: 68, hitstun: 24, blockstun: 18,
      hitbox: { x: 18, y: -26, w: 136, h: 26 }, knockback: { x: 200, y: 320 }, level: "low", knockdown: true,
      meterGain: 5,
    },
    j_p: {
      name: "Stone Drop", startup: 8, active: 6, recovery: 8, damage: 54, hitstun: 20, blockstun: 16,
      hitbox: { x: 10, y: -134, w: 84, h: 42 }, knockback: { x: 180 }, level: "overhead", meterGain: 4,
    },
    j_k: {
      name: "Diagonal Kick", startup: 7, active: 7, recovery: 8, damage: 58, hitstun: 20, blockstun: 16,
      hitbox: { x: 8, y: -94, w: 102, h: 46 }, knockback: { x: 200 }, level: "overhead", meterGain: 4,
    },
  },
  specials: [
    {
      id: "move_37", name: "Move 37", input: "QCB+P",
      description: "Flicks a Go stone onto the floor (LP near, HP far). It bursts when the opponent steps on it, or on D,N,B+P (remote detonation). Max 2 stones. Scale Up: \"1 in 10,000\", an invisible stone.",
      startup: 20, active: 2, recovery: 18, damage: 0, meterGain: 4, vfx: "go_stone",
      mech: { stones: STONES },
      variants: { LP: { mech: { stones: STONES } }, HP: { mech: { stones: { ...STONES, offset: 260 } } } },
      scaleUp: { mech: { stones: { ...STONES, invisible: true } } },
    },
    {
      id: "alphafold", name: "AlphaFold", input: "QCF+P",
      description: "A ribbon of amino-acid beads folds into a coil on contact and binds the opponent for 30 frames. HP travels farther and more slowly. Scale Up: the coil pulls them 120 px toward Demis.",
      startup: 18, active: 2, recovery: 30, damage: 0, meterGain: 7, vfx: "protein_ribbon",
      projectile: {
        speed: 420, hitbox: { x: -34, y: -24, w: 68, h: 48 }, offset: { x: 76, y: -136 }, lifetime: 70,
        damage: 50, chip: 6, hitstun: 30, blockstun: 16, knockback: { x: 40 }, vfx: "projectile_deepmind", meterGain: 8,
        mech: { bind: { frames: 30 } },
      },
      variants: { LP: { projectile: { speed: 420, lifetime: 70 } }, HP: { projectile: { speed: 300, lifetime: 150 } } },
      scaleUp: { projectile: { mech: { bind: { frames: 30 }, pull: { distance: 120 } } } },
    },
    {
      id: "self_play", name: "Self-Play", input: "D,B+K",
      description: "Summons a translucent indigo copy that repeats each of Demis's normals 20 frames later from its own position, at 70% damage. LK puts it beside Demis, HK one character-width behind the opponent. 100 HP; if destroyed, Demis is stunned for 30 frames.",
      startup: 14, active: 2, recovery: 16, damage: 0, meterGain: 4, vfx: "self_play",
      mech: { echo: ECHO },
      variants: { LK: { mech: { echo: ECHO } }, HK: { mech: { echo: { ...ECHO, placement: "behind_opponent" } } } },
      scaleUp: false,
    },
  ],
  super: {
    id: "promptable_world_event", name: "Promptable World Event", input: "QCF,QCF+HP", meterCost: 300, freeze: 30,
    description: "Breakthrough. Demis speaks a prompt and the stage regenerates into a Genie-style world: chess pieces rain, a Go board tilts and an Atari brick wall slams in.",
    startup: 9, active: 30, recovery: 52, damage: 66, chip: 13, hitstun: 24, blockstun: 10, hits: 5, hitInterval: 6,
    hitbox: { x: 20, y: -280, w: 380, h: 280 }, knockback: { x: 140 }, level: "mid", meterGain: 0,
    invuln: { from: 1, to: 9, type: "all" }, lastHit: { knockback: { x: 380, y: 900 }, knockdown: true }, hitstop: 9,
    vfx: "world_event",
  },
  throw: { name: "Pentamind", damage: 110 },
  finisher: {
    id: "resigns", name: "Resigns", input: "F,B,F+LP", range: "mid",
    description: "The floor becomes a giant Go board. White stones surround the opponent, now a tiny figurine, who is captured and placed gently in a wooden stone bowl. \"Opponent resigns.\"",
    vfx: "finisher_resigns",
  },
  assists: { a: "move_37", b: "alphafold" },
  ai: {
    antiAir: "c_hp",
    punish: ["c_hp", "hk"],
    pressure: ["f_hk", "c_lk"],
    cancel: ["alphafold:LP"],
    projectileRange: [260, 900],
    superRange: 380,
  },
  sharedSkills: ["dash", "run", "throw", "throw_tech", "block", "alignment_block", "guardrail", "scale_up", "rollback", "breakthrough", "tag", "assist", "swap_guard", "lab:google-deepmind"],
});
