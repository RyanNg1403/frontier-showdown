import { defineCharacter } from "./schema.js";
import "../combat/mechanics/group-d.js";
import "../combat/ai-kits/group-d.js";

/**
 * Chris Olah, "The Interpreter" (roster doc 3.15). Trap / debuff: he reads the opponent. Feature
 * Visualization marks them (+12% damage taken), the Golden Gate compels them toward it, and
 * Circuit Trace follows a drawn path straight through a Marked target.
 */
const MARK = { frames: 240, mul: 1.12 };
/** The bridge is a placed trap; `w` sets the 100 px obsession range (the trap's reach is w/2 plus a quarter body width). */
const GATE = {
  type: "trap", look: "golden_gate", offset: 120, w: 168, h: 40, lifetime: 300, vfx: "special_anthropic",
  trigger: { damage: 30, hitstun: 12, level: "mid", status: { obsessed: { frames: 40, speed: 170 } } },
};
const TRACE = { dashFrom: 8, dashTo: 14, range: 180, markedRange: 320, markedBonus: 20, stopShort: 52 };
const RABBIT = { hitbox: null, mechanicData: { ...TRACE, rabbit: { delay: 30 } } };

export default defineCharacter({
  id: "chris",
  name: "Chris Olah",
  shortName: "Chris",
  title: "The Interpreter",
  lab: "Anthropic",
  labId: "anthropic",
  bio: "Reads the opponent before he hits them. Marks with Feature Visualization, places the Golden Gate where the opponent wants to go, then Circuit Traces straight through the marked target.",
  quotes: {
    intro: "What in the wide world is going on inside these systems??",
    victory: [
      "We don't program, we don't make them, we grow them.",
      "We need informed critics who will tell the labs when we are failing.",
    ],
    rival: {},
  },
  palette: {
    primary: "#1f2b4a",
    secondary: "#1c2641",
    accent: "#e8562a",
    shirt: "#eef1f5",
    skin: "#f0cdb1",
    hair: "#5a4232",
    shoes: "#5b3a22",
    glasses: "#9aa1ab",
    glassesStyle: "square",
  },
  mechanics: ["mark", "path-strike"],
  stats: { health: 950, walkSpeed: 195, runSpeed: 450, jump: 205, weight: 0.9, height: 200 },
  normals: {
    lp: {
      name: "Lens Tap", startup: 6, active: 2, recovery: 11, damage: 22, hitstun: 16, blockstun: 13,
      hitbox: { x: 22, y: -166, w: 82, h: 24 }, knockback: { x: 150 }, level: "high", meterGain: 3,
      cancelInto: ["lp", "hp", "special", "super"],
    },
    hp: {
      name: "Feature Swirl Palm", startup: 12, active: 3, recovery: 20, damage: 62, hitstun: 22, blockstun: 17,
      hitbox: { x: 26, y: -172, w: 104, h: 34 }, knockback: { x: 280 }, level: "high", meterGain: 5,
      cancelInto: ["special", "super"],
    },
    lk: {
      name: "Neat Step Kick", startup: 9, active: 3, recovery: 15, damage: 30, hitstun: 16, blockstun: 13,
      hitbox: { x: 20, y: -98, w: 98, h: 26 }, knockback: { x: 190 }, level: "mid", meterGain: 4,
      cancelInto: ["hk", "special", "super"],
    },
    hk: {
      name: "Activation Atlas Spin", startup: 14, active: 4, recovery: 22, damage: 74, hitstun: 24, blockstun: 18,
      hitbox: { x: 28, y: -160, w: 116, h: 44 }, knockback: { x: 350 }, level: "mid", meterGain: 6,
      cancelInto: ["special", "super"],
    },
    c_lp: {
      name: "Neuron Probe", startup: 7, active: 2, recovery: 12, damage: 18, hitstun: 15, blockstun: 12,
      hitbox: { x: 18, y: -100, w: 82, h: 22 }, knockback: { x: 140 }, level: "mid", meterGain: 3,
      cancelInto: ["c_lp", "c_lk", "special", "super"],
    },
    c_lk: {
      name: "Low Attribution", startup: 8, active: 2, recovery: 14, damage: 22, hitstun: 15, blockstun: 12,
      hitbox: { x: 20, y: -28, w: 106, h: 24 }, knockback: { x: 150 }, level: "low", meterGain: 3,
      cancelInto: ["c_lp", "special", "super"],
    },
    c_hp: {
      name: "Superposition", startup: 10, active: 4, recovery: 28, damage: 52, hits: 2, hitInterval: 2, hitstun: 26, blockstun: 18,
      hitbox: { x: 8, y: -222, w: 80, h: 140 }, knockback: { x: 80 }, level: "mid", meterGain: 6, hitstop: 10,
      lastHit: { knockback: { x: 100, y: 1150 } }, cancelInto: ["special", "super"],
      description: "A rising strike with two overlapping ghost arms; hits twice and launches.",
    },
    c_hk: {
      name: "Circuit Sweep", startup: 13, active: 3, recovery: 28, damage: 68, hitstun: 24, blockstun: 18,
      hitbox: { x: 18, y: -26, w: 138, h: 26 }, knockback: { x: 200, y: 320 }, level: "low", knockdown: true, meterGain: 5,
    },
    j_p: {
      name: "Lens Drop", startup: 8, active: 6, recovery: 8, damage: 54, hitstun: 20, blockstun: 16,
      hitbox: { x: 10, y: -136, w: 84, h: 42 }, knockback: { x: 180 }, level: "overhead", meterGain: 4,
    },
    j_k: {
      name: "Diagram Kick", startup: 7, active: 7, recovery: 8, damage: 58, hitstun: 20, blockstun: 16,
      hitbox: { x: 8, y: -92, w: 104, h: 48 }, knockback: { x: 200 }, level: "overhead", meterGain: 4,
    },
  },
  specials: [
    {
      id: "feature_visualization", name: "Feature Visualization", input: "QCF+P",
      description: "A swirling psychedelic orb. On hit or block it applies Mark: feature identified, so the opponent takes +12% damage for 240 frames with their hurtbox outlined. Scale Up: the Mark lasts 360 frames.",
      startup: 16, active: 2, recovery: 28, damage: 0, meterGain: 7, vfx: "special_anthropic",
      projectile: {
        speed: 420, hitbox: { x: -28, y: -28, w: 56, h: 56 }, offset: { x: 78, y: -140 }, lifetime: 200,
        damage: 40, chip: 5, hitstun: 20, blockstun: 16, knockback: { x: 200 }, vfx: "projectile_anthropic", meterGain: 8,
        mech: { mark: MARK },
      },
      scaleUp: { projectile: { mech: { mark: { ...MARK, frames: 360 } } } },
    },
    {
      id: "golden_gate", name: "Golden Gate", input: "D,N,B+P", priority: 1,
      description: "Places a tiny glowing Golden Gate Bridge on the floor (LP near, HP far; one at a time, 5 s). An opponent who comes within 100 px becomes obsessed: a light hit, then they are pulled toward the bridge for 40 frames (they can still block). Scale Up: double the obsession range.",
      startup: 20, active: 2, recovery: 18, damage: 0, meterGain: 4, vfx: "special_anthropic",
      mech: { place: GATE },
      variants: {
        LP: { mech: { place: GATE }, scaleUp: { mech: { place: { ...GATE, w: 368 } } } },
        HP: { mech: { place: { ...GATE, offset: 300 } }, scaleUp: { mech: { place: { ...GATE, offset: 300, w: 368 } } } },
      },
      scaleUp: { mech: { place: { ...GATE, w: 368 } } },
    },
    {
      id: "circuit_trace", name: "Circuit Trace", input: "B,F+K",
      description: "Draws an attribution-graph line to the opponent and dashes along it into a strike (70, +20 against a Marked target). Against a Marked opponent the path keeps tracking them through jumps and cross-ups. LK is short; HK is full-screen against a Marked target. Scale Up: Rabbit, a rabbit hops ahead and the strike lands on the target 30 frames later.",
      startup: 15, active: 4, recovery: 24, damage: 70, chip: 8, hitstun: 22, blockstun: 18,
      hitbox: { x: 10, y: -172, w: 96, h: 132 }, knockback: { x: 280 }, level: "mid", meterGain: 8, vfx: "special_anthropic",
      mechanic: "path-strike", mechanicData: TRACE, passThrough: { from: TRACE.dashFrom, to: TRACE.dashTo },
      variants: {
        LK: { mechanicData: TRACE, scaleUp: RABBIT },
        HK: {
          mechanicData: { ...TRACE, range: 300, markedRange: 1800 },
          scaleUp: { hitbox: null, mechanicData: { ...TRACE, range: 300, markedRange: 1800, rabbit: { delay: 30 } } },
        },
      },
      scaleUp: RABBIT,
    },
  ],
  super: {
    id: "scaling_monosemanticity", name: "Scaling Monosemanticity", input: "QCF,QCF+HP", meterCost: 300, freeze: 30,
    description: "Breakthrough. Chris raises the lens and the opponent explodes into a mosaic of labelled feature tiles (\"bridge\", \"rhyme\", \"sarcasm\", \"Golden Gate\"...). Each tile flips as a hit, then they snap back together.",
    startup: 9, active: 30, recovery: 50, damage: 33, chip: 7, hitstun: 22, blockstun: 10, hits: 10, hitInterval: 3,
    hitbox: { x: 0, y: -214, w: 200, h: 214 }, knockback: { x: 60 }, level: "mid", meterGain: 0,
    invuln: { from: 1, to: 9, type: "all" }, velocity: [{ from: 3, to: 9, vx: 520 }],
    lastHit: { knockback: { x: 380, y: 820 }, knockdown: true }, hitstop: 7, vfx: "lab_beam",
    mechanicData: { tiles: { labels: ["bridge", "rhyme", "sarcasm", "Golden Gate", "curve", "base64", "DNA", "code", "irony", "rabbit"] } },
  },
  throw: { name: "Understanding LSTMs", damage: 108 },
  finisher: {
    id: "toy_model", name: "Toy Model", input: "F,D,F+LK", range: "mid",
    description: "The opponent becomes a small 3D-printed figurine, a geometric toy model with features packed into a pentagon. Chris places it on his desk beside his other sculptures and gives it a thoughtful nod.",
    vfx: "finisher_toy_model",
  },
  assists: { a: "feature_visualization", b: "golden_gate" },
  sharedSkills: ["dash", "run", "throw", "throw_tech", "block", "alignment_block", "guardrail", "scale_up", "rollback", "breakthrough", "tag", "assist", "swap_guard", "lab:anthropic"],
  ai: {
    antiAir: "c_hp",
    approach: ["circuit_trace:LK"],
    punish: ["circuit_trace:LK", "c_hp"],
    cancel: ["circuit_trace:LK", "feature_visualization:LP"],
    projectileRange: [220, 1000],
  },
});
