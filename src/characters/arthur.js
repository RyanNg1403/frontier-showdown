import { defineCharacter } from "./schema.js";
import "../combat/mechanics/group-b/index.js";
import "../combat/ai-kits/group-b.js";

/**
 * Arthur Mensch, "Le Mistral" (roster doc 3.8). Speed rushdown: the fastest walk and run,
 * a gust that pushes and slows, a magnet that pulls, and a surprisingly heavy air dive.
 */
export default defineCharacter({
  id: "arthur",
  name: "Arthur Mensch",
  shortName: "Arthur",
  title: "Le Mistral",
  lab: "Mistral AI",
  labId: "mistral",
  archetype: "speed rushdown",
  difficulty: 2,
  bio: "Gusts zoners back and slows them, magnet-pulls them in, then overwhelms with fast normals and run cancels. Le Chonk Drop is the heavy surprise from a light frame.",
  quotes: {
    intro: "The narrative that Europe cannot compete is something that is not true.",
    victory: ["We want to be the most capital-efficient company in the world of AI.", "Sub-3:30."],
    rival: {},
  },
  palette: {
    primary: "#1c2541",
    secondary: "#19213b",
    accent: "#9be7ff",
    shirt: "#f5f5f5",
    tie: "#25427e",
    skin: "#efcdb3",
    hair: "#2b1d16",
    hairStyle: "flop",
    shoes: "#131313",
  },
  stats: { health: 930, walkSpeed: 250, runSpeed: 560, jump: 215, weight: 0.9, height: 212 },
  normals: {
    lp: {
      name: "Whip Jab", startup: 6, active: 2, recovery: 10, damage: 20, hitstun: 15, blockstun: 12,
      hitbox: { x: 22, y: -172, w: 86, h: 22 }, knockback: { x: 140 }, level: "high", meterGain: 3,
      cancelInto: ["lp", "hp", "special", "super"],
    },
    hp: {
      name: "Gust Backfist", startup: 11, active: 3, recovery: 19, damage: 58, hitstun: 21, blockstun: 16,
      hitbox: { x: 24, y: -176, w: 110, h: 34 }, knockback: { x: 300 }, level: "high", meterGain: 5,
      cancelInto: ["special", "super"],
    },
    lk: {
      name: "Shin Flick", startup: 8, active: 2, recovery: 14, damage: 26, hitstun: 15, blockstun: 12,
      hitbox: { x: 20, y: -100, w: 102, h: 24 }, knockback: { x: 180 }, level: "mid", meterGain: 4,
      cancelInto: ["hk", "special", "super"],
    },
    hk: {
      name: "Pedal Kick", startup: 13, active: 6, recovery: 20, damage: 36, hitstun: 22, blockstun: 17,
      hitbox: { x: 26, y: -150, w: 120, h: 44 }, knockback: { x: 300 }, level: "mid", meterGain: 6,
      hits: 2, hitInterval: 3, cancelInto: ["special", "super"], description: "A cyclist double kick.",
    },
    f_hk: {
      name: "Breakaway Kick", startup: 14, active: 5, recovery: 20, damage: 62, hitstun: 22, blockstun: 17,
      hitbox: { x: 20, y: -150, w: 118, h: 70 }, knockback: { x: 320 }, level: "mid", meterGain: 5,
      velocity: [{ from: 2, to: 16, vx: 420 }], cancelInto: ["special", "super"],
      description: "A flying kick; from a run (forward + HK) it carries his momentum.",
    },
    c_lp: {
      name: "Low Jab", startup: 6, active: 2, recovery: 11, damage: 18, hitstun: 15, blockstun: 12,
      hitbox: { x: 18, y: -100, w: 84, h: 22 }, knockback: { x: 130 }, level: "mid", meterGain: 3,
      cancelInto: ["c_lp", "c_lk", "special", "super"],
    },
    c_lk: {
      name: "Slide Poke", startup: 7, active: 2, recovery: 14, damage: 22, hitstun: 15, blockstun: 12,
      hitbox: { x: 22, y: -26, w: 118, h: 24 }, knockback: { x: 150 }, level: "low", meterGain: 3,
      velocity: [{ from: 1, to: 7, vx: 280 }], cancelInto: ["c_lp", "special", "super"],
    },
    c_hp: {
      name: "Wind Uppercut", startup: 9, active: 3, recovery: 30, damage: 96, hitstun: 30, blockstun: 18,
      hitbox: { x: 6, y: -236, w: 76, h: 156 }, knockback: { x: 100, y: 1190 }, level: "mid", meterGain: 6,
      hitstop: 13, cancelInto: ["special", "super"],
    },
    c_hk: {
      name: "Peloton Sweep", startup: 12, active: 3, recovery: 27, damage: 64, hitstun: 24, blockstun: 18,
      hitbox: { x: 18, y: -26, w: 144, h: 26 }, knockback: { x: 210, y: 320 }, level: "low", knockdown: true,
      meterGain: 5,
    },
    j_p: {
      name: "Diving Palm", startup: 7, active: 6, recovery: 8, damage: 50, hitstun: 20, blockstun: 16,
      hitbox: { x: 10, y: -140, w: 86, h: 42 }, knockback: { x: 180 }, level: "overhead", meterGain: 4,
    },
    j_k: {
      name: "Cross-up Knee", startup: 6, active: 7, recovery: 8, damage: 52, hitstun: 20, blockstun: 16,
      hitbox: { x: -34, y: -112, w: 112, h: 52 }, knockback: { x: 190 }, level: "overhead", meterGain: 4,
    },
  },
  specials: [
    {
      id: "mistral_gust", name: "Mistral Gust", input: "QCB+K",
      description: "A cold cyan gust pushes the opponent back about 150 px and slows their walk by 30% for 90 frames. HK is taller and slower. Scale Up: a full-screen gust that also blows airborne opponents back.",
      startup: 15, active: 2, recovery: 24, damage: 0, meterGain: 6, vfx: "mistral_wind",
      projectile: {
        speed: 780, hitbox: { x: -40, y: -70, w: 80, h: 140 }, offset: { x: 70, y: -80 }, lifetime: 40,
        damage: 30, chip: 4, hitstun: 18, blockstun: 16, knockback: { x: 1000 }, vfx: "projectile_mistral", meterGain: 6,
        mech: { slowOnContact: { frames: 90, speedMul: 0.7 } },
      },
      variants: {
        LK: { projectile: { speed: 780, lifetime: 40 } },
        HK: { projectile: { speed: 520, lifetime: 64, hitbox: { x: -50, y: -105, w: 100, h: 210 }, offset: { x: 70, y: -105 } } },
      },
      scaleUp: {
        projectile: { speed: 560, lifetime: 150, hitbox: { x: -60, y: -170, w: 120, h: 340 }, offset: { x: 70, y: -170 }, scale: 2 },
        mech: { slowOnContact: { frames: 90, speedMul: 0.7 }, reverseAir: true },
      },
    },
    {
      id: "magnet_link", name: "Magnet Link", input: "QCF+P",
      description: "Hurls a horseshoe magnet on a glowing link. LP pulls the opponent 200 px toward Arthur; HP pulls Arthur to the opponent for a free LP follow-up. Scale Up: a \"mic drop\" magnet falls from above (overhead).",
      startup: 16, active: 6, recovery: 28, damage: 40, chip: 5, hitstun: 34, blockstun: 14,
      hitbox: { x: 50, y: -164, w: 300, h: 44 }, knockback: { x: 60 }, level: "mid", meterGain: 7, vfx: "magnet_link",
      mech: { pull: { distance: 200 } },
      variants: {
        LP: { mech: { pull: { distance: 200 } } },
        HP: { mech: { pull: false, reel: { stopAt: 92 } } },
      },
      scaleUp: {
        hitbox: null,
        projectile: {
          speed: 0, hitbox: { x: -40, y: -40, w: 80, h: 80 }, offset: { x: 0, y: -320 }, lifetime: 70,
          damage: 52, chip: 6, hitstun: 34, blockstun: 16, knockback: { x: 60 }, level: "overhead", gravity: 1400, vfx: "projectile_magnet",
          mech: { spawnAt: "opponent", y: -320, pull: { distance: 200 } },
        },
      },
    },
    {
      id: "le_chonk", name: "Le Chonk Drop", input: "D+HK", air: true, airOnly: true,
      description: "In the air: Arthur's silhouette balloons (\"1T parameters\") and he slams down with a ground bounce. Overhead, 1 hit of armor. Scale Up: a low shockwave on landing.",
      startup: 10, active: 40, recovery: 22, damage: 95, chip: 11, hitstun: 26, blockstun: 18,
      hitbox: { x: -20, y: -100, w: 100, h: 104 }, knockback: { x: 150 }, knockdown: true, groundBounce: { vy: 760, slam: 900 }, level: "overhead", meterGain: 8,
      velocity: [{ from: 1, to: 9, vx: 0, vy: -60 }, { from: 10, to: 60, vx: 140, vy: 1250 }],
      armor: { from: 1, to: 50, hits: 1 }, landingRecovery: 22, hitstop: 12, vfx: "le_chonk",
      scaleUp: { mech: { shockwave: { damage: 40, radius: 170, level: "low" } } },
    },
  ],
  super: {
    id: "chinchilla_optimal", name: "Chinchilla Optimal", input: "QCF,QCF+HP", meterCost: 300, freeze: 30,
    description: "Breakthrough. Exactly 20 lightning-fast wind strikes (\"20 tokens / parameter\"), then one perfectly balanced finishing kick. A small cartoon chinchilla tumbles past.",
    startup: 6, active: 42, recovery: 50, damage: 15, chip: 3, hitstun: 18, blockstun: 8, hits: 21, hitInterval: 2,
    hitbox: { x: 6, y: -200, w: 130, h: 200 }, knockback: { x: 60 }, level: "mid", meterGain: 0,
    invuln: { from: 1, to: 6, type: "all" }, velocity: [{ from: 4, to: 30, vx: 520 }],
    lastHit: { knockback: { x: 460, y: 900 }, knockdown: true }, hitstop: 4, vfx: "chinchilla",
  },
  throw: { name: "Breakaway", damage: 105 },
  finisher: {
    id: "paris_marathon", name: "Paris Marathon", input: "F,F,F+LK", range: "mid",
    description: "Arthur sprints circles around the opponent in a wind vortex. When it clears they stand wrapped in a foil blanket with a medal; the clock reads 3:29:59.",
    vfx: "finisher_paris_marathon",
  },
  assists: { a: "mistral_gust", b: "magnet_link" },
  ai: {
    antiAir: "c_hp",
    punish: ["c_hp", "hk", "f_hk"],
    approach: ["f_hk", "magnet_link:HP"],
    pressure: ["c_lk", "hk"],
    cancel: ["magnet_link:LP"],
    projectileRange: [380, 900],
    superRange: 220,
  },
  sharedSkills: ["dash", "run", "throw", "throw_tech", "block", "alignment_block", "guardrail", "scale_up", "rollback", "breakthrough", "tag", "assist", "swap_guard", "lab:mistral"],
});
