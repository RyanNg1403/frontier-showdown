import { defineCharacter } from "./schema.js";
import "../combat/mechanics/group-d.js";
import "../combat/ai-kits/group-d.js";

/**
 * Fei-Fei Li, "Godmother of AI" (roster doc 3.16). Setup zoner / world-builder: an image-grid
 * projectile, generated Marble platforms and walls that both fighters stand on or collide with,
 * and a spatial teleport. She shapes the stage itself.
 */
const ROW = {
  speed: 440, hitbox: { x: -48, y: -22, w: 96, h: 44 }, offset: { x: 84, y: -130 }, lifetime: 200,
  damage: 55, chip: 7, hitstun: 20, blockstun: 16, knockback: { x: 220 }, vfx: "projectile_world-labs", meterGain: 8,
  mech: { look: "tiles", rows: 1, cols: 3 },
};
const GRID = { ...ROW, speed: 380, damage: 25, chip: 3, hitbox: { x: -30, y: -12, w: 60, h: 24 }, spread: [-210, -105, 0], scale: 0.8, offset: { x: 80, y: -120 } };
const CLASSES = {
  projectile: {
    ...ROW, speed: 200, damage: 15, chip: 2, hits: 5, hitInterval: 8, hitbox: { x: -60, y: -130, w: 120, h: 150 }, lifetime: 300,
    durability: 5, spread: [0], offset: { x: 90, y: -40 }, scale: 1.4, mech: { look: "tiles", rows: 5, cols: 5 },
  },
};
const MARBLE = { frame: 20, kind: "wall", lifetime: 300 };
const STEP = { vanish: 3, frame: 9, to: "platform", distance: 150 };
const STEP_STRIKE = {
  startup: 12, active: 4, damage: 60, chip: 7, hitstun: 22, blockstun: 16, meterGain: 8,
  hitbox: { x: 8, y: -164, w: 100, h: 124 }, knockback: { x: 280 }, level: "mid",
};

export default defineCharacter({
  id: "feifei",
  name: "Fei-Fei Li",
  shortName: "Fei-Fei",
  title: "Godmother of AI",
  lab: "World Labs",
  labId: "world-labs",
  bio: "The world-builder. Generates a Marble wall to blank zoners, fires ImageNet over it, stands on her own platforms and repositions with Spatial Step when rushed.",
  quotes: {
    intro: "First, we teach them to see. Then, they help us to see better.",
    victory: [
      "AI is 'promising' nothing. It is people who are promising.",
      "Wordsmiths in the dark; eloquent but inexperienced, knowledgeable but ungrounded.",
    ],
    rival: { andrej: "First, we teach them to see." },
  },
  palette: {
    primary: "#6b2737",
    secondary: "#3d5a80",
    accent: "#3ccf9e",
    shirt: "#f4f1ea",
    skin: "#f1d3b8",
    hair: "#1e1612",
    hairStyle: "shoulder",
    shoes: "#f2f2f2",
  },
  stats: { health: 960, walkSpeed: 190, runSpeed: 440, jump: 200, weight: 0.9, height: 185 },
  normals: {
    lp: {
      name: "Photo Tile Palm", startup: 6, active: 2, recovery: 11, damage: 22, hitstun: 16, blockstun: 13,
      hitbox: { x: 20, y: -156, w: 84, h: 24 }, knockback: { x: 150 }, level: "high", meterGain: 3,
      cancelInto: ["lp", "hp", "special", "super"],
    },
    hp: {
      name: "Tile Row Sweep", startup: 12, active: 3, recovery: 21, damage: 62, hitstun: 22, blockstun: 17,
      hitbox: { x: 24, y: -162, w: 120, h: 34 }, knockback: { x: 290 }, level: "high", meterGain: 5,
      cancelInto: ["special", "super"],
    },
    lk: {
      name: "Short Kick", startup: 8, active: 2, recovery: 14, damage: 26, hitstun: 16, blockstun: 13,
      hitbox: { x: 18, y: -94, w: 88, h: 26 }, knockback: { x: 180 }, level: "mid", meterGain: 4,
      cancelInto: ["hk", "special", "super"],
    },
    hk: {
      name: "Wireframe Spin Kick", startup: 14, active: 4, recovery: 23, damage: 72, hitstun: 24, blockstun: 18,
      hitbox: { x: 26, y: -150, w: 112, h: 44 }, knockback: { x: 350 }, level: "mid", meterGain: 6,
      cancelInto: ["special", "super"],
    },
    c_lp: {
      name: "Bounding Box Jab", startup: 7, active: 2, recovery: 12, damage: 18, hitstun: 15, blockstun: 12,
      hitbox: { x: 18, y: -96, w: 80, h: 22 }, knockback: { x: 140 }, level: "mid", meterGain: 3,
      cancelInto: ["c_lp", "c_lk", "special", "super"],
    },
    c_lk: {
      name: "Floor Plane Poke", startup: 8, active: 2, recovery: 15, damage: 20, hitstun: 15, blockstun: 12,
      hitbox: { x: 18, y: -26, w: 104, h: 24 }, knockback: { x: 150 }, level: "low", meterGain: 3,
      cancelInto: ["c_lp", "special", "super"],
    },
    c_hp: {
      name: "Splat Pillar", startup: 10, active: 4, recovery: 28, damage: 98, hitstun: 30, blockstun: 18,
      hitbox: { x: 10, y: -240, w: 76, h: 160 }, knockback: { x: 100, y: 1150 }, level: "mid", meterGain: 6,
      hitstop: 13, cancelInto: ["special", "super"], description: "A rising Gaussian-splat pillar; her anti-air.",
    },
    c_hk: {
      name: "Grid Sweep", startup: 13, active: 3, recovery: 29, damage: 66, hitstun: 24, blockstun: 18,
      hitbox: { x: 16, y: -26, w: 136, h: 26 }, knockback: { x: 200, y: 320 }, level: "low", knockdown: true, meterGain: 5,
    },
    j_p: {
      name: "Tile Slam", startup: 8, active: 6, recovery: 8, damage: 60, hitstun: 20, blockstun: 16,
      hitbox: { x: 0, y: -110, w: 96, h: 70 }, knockback: { x: 160 }, level: "overhead", meterGain: 4,
      description: "A downward tile slam.",
    },
    j_k: {
      name: "Wireframe Kick", startup: 7, active: 7, recovery: 8, damage: 56, hitstun: 20, blockstun: 16,
      hitbox: { x: 8, y: -90, w: 100, h: 46 }, knockback: { x: 200 }, level: "overhead", meterGain: 4,
    },
  },
  specials: [
    {
      id: "imagenet", name: "ImageNet", input: "QCF+P",
      description: "LP fires a three-tile row straight ahead (55). HP fires a 3x3 grid whose rows spread upward (3x25), good against jumps. Scale Up: \"22,000 classes\", a slow 5x5 grid wall (5x15).",
      startup: 17, active: 2, recovery: 30, damage: 0, meterGain: 7, vfx: "special_world-labs",
      projectile: ROW,
      variants: {
        LP: { projectile: ROW },
        HP: { projectile: GRID },
      },
      scaleUp: CLASSES,
    },
    {
      id: "marble_world", name: "Marble World", input: "D,N,B+P", priority: 1,
      description: "Generates a jade Gaussian-splat construct for 5 s (6.25 s with Spatial Intelligence). LP: a floating platform at jump height that either fighter can stand on. HP: a waist-high wall that blocks projectiles and ground movement (150 HP); anyone can stand on top. One at a time. Scale Up: both at once.",
      startup: 20, active: 2, recovery: 18, damage: 0, meterGain: 4, vfx: "special_world-labs",
      mechanic: "marble-world", mechanicData: MARBLE,
      variants: {
        LP: { mechanicData: { ...MARBLE, kind: "platform" } },
        HP: { mechanicData: MARBLE },
      },
      scaleUp: { mechanicData: { ...MARBLE, kind: "both" } },
    },
    {
      id: "spatial_step", name: "Spatial Step", input: "QCB+K",
      description: "Folds into a wireframe and reappears on frame 9: LK on top of her own platform (a hop back without one), HK behind the opponent. Scale Up: she reappears with a strike (60).",
      startup: 10, active: 1, recovery: 18, damage: 0, meterGain: 2, vfx: "special_world-labs",
      mechanic: "spatial-step", mechanicData: STEP,
      variants: {
        LK: { mechanicData: STEP },
        HK: { mechanicData: { ...STEP, to: "behind" }, scaleUp: { ...STEP_STRIKE, mechanicData: { ...STEP, to: "behind" } } },
      },
      scaleUp: STEP_STRIKE,
    },
  ],
  super: {
    id: "the_worlds_i_see", name: "The Worlds I See", input: "QCF,QCF+HP", meterCost: 300, freeze: 30,
    description: "Breakthrough. Fei-Fei opens her hands and the stage folds through generated worlds: a star field, a city street labelled with bounding boxes, a sunlit lab. The opponent is struck once in each world before landing back on the stage.",
    startup: 9, active: 30, recovery: 50, damage: 110, chip: 22, hitstun: 26, blockstun: 12, hits: 3, hitInterval: 12,
    hitbox: { x: 0, y: -220, w: 200, h: 220 }, knockback: { x: 40 }, level: "mid", meterGain: 0,
    invuln: { from: 1, to: 9, type: "all" }, velocity: [{ from: 3, to: 8, vx: 420 }],
    lastHit: { knockback: { x: 400, y: 800 }, knockdown: true }, hitstop: 12, vfx: "lab_beam",
    mechanicData: { worlds: { scenes: ["stars", "city", "lab"], every: 12 } },
  },
  throw: { name: "Label It", damage: 105 },
  finisher: {
    id: "labeled", name: "Labeled", input: "B,F,B+LK", range: "far",
    description: "The opponent shrinks into a photo tile in a giant ImageNet grid, captioned \"class 22,001: defeated challenger\". Hundreds of tiny annotator cursors click \"correct\" and a cheerful chime plays.",
    vfx: "finisher_labeled",
  },
  assists: { a: "imagenet", b: "marble_world" },
  sharedSkills: ["dash", "run", "throw", "throw_tech", "block", "alignment_block", "guardrail", "scale_up", "rollback", "breakthrough", "tag", "assist", "swap_guard", "lab:world-labs"],
  ai: {
    antiAir: "c_hp",
    evade: "spatial_step:HK",
    punish: ["c_hp"],
    cancel: ["imagenet:LP"],
    projectileRange: [240, 1000],
  },
});
