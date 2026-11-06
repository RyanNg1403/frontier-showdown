import { defineCharacter } from "./schema.js";
import "../combat/mechanics/group-d.js";
import "../combat/ai-kits/group-d.js";

/**
 * Noam Shazeer, "The T in GPT" (roster doc 3.14). Stance-switch combo: Mixture of Experts routes
 * him into one of four experts, each swapping his HP / HK; a tracking attention beam and a
 * three-ghost rush round out the kit. The highest skill ceiling in the cast.
 */
/** Expert-stance normals, swapped in for `hp` / `hk` by Mixture of Experts. */
const EXPERTS = {
  striker: {
    hp: {
      id: "hp_striker", name: "Expert Cross", anim: "heavy_punch_striker", startup: 9, active: 3, recovery: 17, damage: 60, hitstun: 22, blockstun: 17,
      hitbox: { x: 26, y: -172, w: 108, h: 32 }, knockback: { x: 280 }, level: "high", meterGain: 5, cancelInto: ["special", "super"],
    },
    hk: {
      id: "hk_striker", name: "Expert Roundhouse", anim: "heavy_kick_striker", limb: "leg", startup: 11, active: 3, recovery: 18, damage: 70, hitstun: 24, blockstun: 18,
      hitbox: { x: 30, y: -158, w: 118, h: 40 }, knockback: { x: 350 }, level: "mid", meterGain: 6, cancelInto: ["special", "super"],
    },
  },
  grappler: {
    hp: {
      id: "hp_grappler", name: "Gated Grab", anim: "heavy_punch_grappler", startup: 7, active: 3, recovery: 30, damage: 0, meterGain: 0,
      grab: { range: 95, damage: 96, techable: false, knockback: { x: 300, y: 620 } },
    },
  },
  zoner: {
    hk: {
      id: "hk_zoner", name: "Attention Dart", anim: "heavy_kick_zoner", limb: "leg", startup: 13, active: 2, recovery: 22, damage: 0, meterGain: 4,
      projectile: {
        speed: 760, hitbox: { x: -22, y: -10, w: 44, h: 20 }, offset: { x: 70, y: -120 }, lifetime: 34,
        damage: 40, chip: 0, hitstun: 18, blockstun: 14, knockback: { x: 180 }, vfx: "projectile_openai", meterGain: 4, scale: 0.55,
      },
    },
  },
  guard: {
    hp: {
      id: "hp_guard", name: "Guard Palm", anim: "heavy_punch_guard", startup: 3, active: 14, recovery: 22, damage: 0, meterGain: 0,
      parry: { from: 3, to: 16, levels: ["high", "mid", "overhead"], lock: 32, maxLevel: 0, levelBonus: 0, counter: { name: "KV-Cache Palm", damage: 85, startup: 6 } },
    },
  },
};
const ROUTER = { open: 8, lockDelay: 8, step: 1, top2: 0, order: ["striker", "grappler", "zoner", "guard"], experts: EXPERTS };
const BEAM = {
  lockFrame: 17, duration: 24, hits: 5, interval: 5, damage: 14, chip: 2, hitstun: 14, blockstun: 10,
  knockback: { x: 60 }, trackSpeed: 9, thickness: 14, range: 900, origin: { x: 30, y: -168 },
};
const MULTI_HEAD = { heads: [-56, 0, 56], hits: 7, interval: 3, damage: 12 };

export default defineCharacter({
  id: "noam",
  name: "Noam Shazeer",
  shortName: "Noam",
  title: "The T in GPT",
  lab: "OpenAI",
  labId: "openai",
  bio: "The stance-switch virtuoso. Routes into the expert that beats the opponent's habit (Zoner against rushdown, Grappler against turtles), confirms with One Write-Head and cashes out in Divine Benevolence.",
  quotes: {
    intro: "Talking to a language model is like 100 times cheaper than reading a paperback.",
    victory: [
      "We attribute their success, as all else, to divine benevolence.",
      "Did you hear the one about the newspaper? No, it's tear-able!",
    ],
    rival: {},
  },
  palette: {
    primary: "#151515",
    secondary: "#2b3954",
    accent: "#ffe14d",
    skin: "#efc8a9",
    hair: "#6e655b",
    cap: "#dcdcd8",
    beard: "#7b756d",
    shoes: "#24272d",
  },
  mechanics: ["stance-router"],
  stats: { health: 990, walkSpeed: 200, runSpeed: 460, jump: 205, weight: 1.0, height: 200 },
  normals: {
    lp: {
      name: "Token Jab", startup: 6, active: 2, recovery: 11, damage: 24, hitstun: 16, blockstun: 13,
      hitbox: { x: 22, y: -166, w: 84, h: 24 }, knockback: { x: 150 }, level: "high", meterGain: 3,
      cancelInto: ["lp", "hp", "special", "super"],
    },
    hp: {
      name: "Feed-Forward", startup: 12, active: 3, recovery: 20, damage: 64, hitstun: 22, blockstun: 17,
      hitbox: { x: 26, y: -172, w: 104, h: 32 }, knockback: { x: 280 }, level: "high", meterGain: 5,
      cancelInto: ["special", "super"],
    },
    lk: {
      name: "Skip Connection", startup: 9, active: 3, recovery: 15, damage: 30, hitstun: 16, blockstun: 13,
      hitbox: { x: 20, y: -98, w: 98, h: 26 }, knockback: { x: 190 }, level: "mid", meterGain: 4,
      cancelInto: ["hk", "special", "super"],
    },
    hk: {
      name: "Layer-Norm Roundhouse", startup: 14, active: 4, recovery: 22, damage: 74, hitstun: 24, blockstun: 18,
      hitbox: { x: 30, y: -158, w: 114, h: 40 }, knockback: { x: 350 }, level: "mid", meterGain: 6,
      cancelInto: ["special", "super"],
    },
    c_lp: {
      name: "Low Logit", startup: 7, active: 2, recovery: 12, damage: 20, hitstun: 15, blockstun: 12,
      hitbox: { x: 18, y: -100, w: 82, h: 22 }, knockback: { x: 140 }, level: "mid", meterGain: 3,
      cancelInto: ["c_lp", "c_lk", "special", "super"],
    },
    c_lk: {
      name: "Positional Poke", startup: 8, active: 2, recovery: 14, damage: 22, hitstun: 15, blockstun: 12,
      hitbox: { x: 20, y: -28, w: 106, h: 24 }, knockback: { x: 150 }, level: "low", meterGain: 3,
      cancelInto: ["c_lp", "special", "super"],
    },
    c_hp: {
      name: "Residual", startup: 10, active: 3, recovery: 30, damage: 90, hitstun: 30, blockstun: 18,
      hitbox: { x: 8, y: -218, w: 78, h: 136 }, knockback: { x: 110, y: 1150 }, level: "mid", meterGain: 6,
      hitstop: 13, cancelInto: ["special", "super"],
      description: "Uppercut that leaves a residual copy of itself, which hits again 10 frames later.",
      mechanic: "echo", mechanicData: { delay: 10, damage: 32, hitstun: 22, knockback: { x: 80, y: 820 }, juggle: 1, box: { x: 4, y: -400, w: 86, h: 320 } },
    },
    c_hk: {
      name: "Sparse Sweep", startup: 13, active: 3, recovery: 28, damage: 70, hitstun: 24, blockstun: 18,
      hitbox: { x: 18, y: -26, w: 140, h: 26 }, knockback: { x: 200, y: 320 }, level: "low", knockdown: true, meterGain: 5,
    },
    j_p: {
      name: "Head Drop", startup: 8, active: 6, recovery: 8, damage: 56, hitstun: 20, blockstun: 16,
      hitbox: { x: 10, y: -136, w: 86, h: 42 }, knockback: { x: 180 }, level: "overhead", meterGain: 4,
    },
    j_k: {
      name: "Decoder Kick", startup: 7, active: 7, recovery: 8, damage: 60, hitstun: 20, blockstun: 16,
      hitbox: { x: 8, y: -92, w: 106, h: 48 }, knockback: { x: 200 }, level: "overhead", meterGain: 4,
    },
  },
  specials: [
    {
      id: "attention", name: "Attention Is All You Need", input: "QCF+P",
      description: "A thin yellow beam locks onto the opponent at frame 17 and sweeps to follow them for 24 frames, hitting up to five times. HP tracks longer with more recovery. Scale Up: Multi-Head, three beams from three ghost heads.",
      startup: 17, active: 24, recovery: 28, damage: 0, meterGain: 8, vfx: "special_openai",
      mechanic: "tracking-beam", mechanicData: BEAM,
      variants: {
        LP: {},
        HP: {
          active: 32, recovery: 34, mechanicData: { ...BEAM, duration: 32, interval: 6 },
          scaleUp: { mechanicData: { ...BEAM, ...MULTI_HEAD, duration: 32 } },
        },
      },
      scaleUp: { mechanicData: { ...BEAM, ...MULTI_HEAD } },
    },
    {
      id: "mixture_of_experts", name: "Mixture of Experts", input: "D,N,B+K", priority: 1,
      description: "Opens the router: four expert icons orbit Noam. LK cycles forward, HK cycles back, and the choice locks in 8 frames after the last press. Striker: fast heavies. Grappler: HP is a short command grab. Zoner: HK fires an attention dart. Guard: HP is a parry palm. Scale Up: top-2 routing, two experts active for 4 s.",
      startup: 8, active: 40, recovery: 8, damage: 0, meterGain: 0, vfx: "special_openai",
      mechanic: "stance-router", mechanicData: ROUTER,
      variants: {
        LK: { mechanicData: ROUTER, scaleUp: { mechanicData: { ...ROUTER, top2: 240 } } },
        HK: { mechanicData: { ...ROUTER, step: -1 }, scaleUp: { mechanicData: { ...ROUTER, step: -1, top2: 240 } } },
      },
      scaleUp: { mechanicData: { ...ROUTER, top2: 240 } },
    },
    {
      id: "one_write_head", name: "One Write-Head", input: "B,F+P",
      description: "Three ghost heads lunge in sequence along one glowing key/value line: three quick hits of 30. Scale Up: the last ghost launches.",
      startup: 14, active: 12, recovery: 26, damage: 30, chip: 4, hitstun: 18, blockstun: 22, hits: 3, hitInterval: 4,
      hitbox: { x: 18, y: -180, w: 104, h: 70 }, knockback: { x: 130 }, level: "mid", meterGain: 8,
      velocity: [{ from: 8, to: 22, vx: 360 }], lastHit: { knockback: { x: 300 } }, vfx: "special_openai",
      mechanicData: { ghosts: { count: 3 } },
      scaleUp: { damage: 39, lastHit: { knockback: { x: 140, y: 1150 } } },
    },
  ],
  super: {
    id: "divine_benevolence", name: "Divine Benevolence", input: "QCF,QCF+HP", meterCost: 300, freeze: 30,
    description: "Breakthrough. Golden light; Noam shrugs at the camera (\"We offer no explanation...\") and fires a gated beam that should not work this well. Every gate flash lands a hit, and it ends with a yellow \"T\" stamped over the opponent.",
    startup: 8, active: 44, recovery: 46, damage: 0, meterGain: 0, invuln: { from: 1, to: 8, type: "all" }, vfx: "lab_beam",
    mechanic: "tracking-beam",
    mechanicData: {
      lockFrame: 8, duration: 44, hits: 10, interval: 4, damage: 34, chip: 7, hitstun: 24, blockstun: 8, hitstop: 6,
      knockback: { x: 40 }, trackSpeed: 16, thickness: 34, range: 1100, origin: { x: 40, y: -150 },
      lastHit: { knockdown: true, knockback: { x: 300, y: 720 } }, stamp: "T",
    },
  },
  throw: { name: "Did You Mean", damage: 108 },
  finisher: {
    id: "did_you_mean", name: "Did You Mean...?", input: "D,F,D+HP", range: "mid",
    description: "The opponent's name plate gets a red squiggly underline. \"Did you mean: [opponent] (tiny)?\" Noam clicks yes, and the opponent shrinks into a dropdown suggestion tucked into the search bar.",
    vfx: "finisher_did_you_mean",
  },
  assists: { a: "attention", b: "one_write_head" },
  sharedSkills: ["dash", "run", "throw", "throw_tech", "block", "alignment_block", "guardrail", "scale_up", "rollback", "breakthrough", "tag", "assist", "swap_guard", "lab:openai"],
  ai: {
    antiAir: "c_hp",
    approach: ["one_write_head:LP"],
    punish: ["one_write_head:LP", "c_hp"],
    cancel: ["one_write_head:LP", "attention:LP"],
    superRange: 900,
    aggression: 1.5,
    zoning: 1.2,
  },
});
