import { defineCharacter } from "./schema.js";

/**
 * Dario Amodei, "The Responsible Scaler" (roster doc 3.2). Defensive fortress and zoner:
 * a barrier wall, a stream of tiny geniuses, and a counter stance that punishes impatience.
 */
export default defineCharacter({
  id: "dario",
  name: "Dario Amodei",
  shortName: "Dario",
  title: "The Responsible Scaler",
  lab: "Anthropic",
  labId: "anthropic",
  archetype: "defensive",
  difficulty: 2,
  bio: "Builds barriers, counters impatience and wins long rounds on chip resistance. Puts a Constitutional Barrier between himself and the opponent, zones with Country of Geniuses, and punishes rushes with ASL Safeguard.",
  quotes: {
    intro: "Intelligence may be very powerful, but it isn't magic fairy dust.",
    victory: ["We don't have to do any code reds.", "We can't stop the bus, but we can steer it."],
    rival: { sam: "We don't have to do any code reds." },
  },
  palette: {
    primary: "#1f2a4d",
    secondary: "#3a3a3a",
    accent: "#f29a68",
    shirt: "#f4f4f4",
    skin: "#e7c19c",
    hair: "#3b2618",
    shoes: "#6b3f22",
    glasses: "#111111",
  },
  stats: { health: 1050, walkSpeed: 180, runSpeed: 430, jump: 195, weight: 1.05 },
  normals: {
    lp: {
      name: "Palm Check", startup: 7, active: 2, recovery: 12, damage: 24, hitstun: 16, blockstun: 13,
      hitbox: { x: 22, y: -168, w: 86, h: 26 }, knockback: { x: 150 }, level: "high", meterGain: 3,
      cancelInto: ["lp", "hp", "special", "super"],
    },
    hp: {
      name: "Scaling Law", startup: 12, active: 3, recovery: 21, damage: 66, hitstun: 22, blockstun: 17,
      hitbox: { x: 26, y: -172, w: 104, h: 32 }, knockback: { x: 300 }, level: "high", meterGain: 5,
      cancelInto: ["special", "super"],
    },
    lk: {
      name: "Step Kick", startup: 9, active: 3, recovery: 13, damage: 32, hitstun: 16, blockstun: 13,
      hitbox: { x: 22, y: -100, w: 94, h: 26 }, knockback: { x: 200 }, level: "mid", meterGain: 4,
      cancelInto: ["hk", "special", "super"],
    },
    hk: {
      name: "Measured Roundhouse", startup: 15, active: 4, recovery: 23, damage: 76, hitstun: 24, blockstun: 18,
      hitbox: { x: 30, y: -152, w: 114, h: 40 }, knockback: { x: 380 }, level: "mid", meterGain: 6,
      cancelInto: ["special", "super"],
    },
    c_lp: {
      name: "Finger Jab", startup: 7, active: 2, recovery: 12, damage: 20, hitstun: 15, blockstun: 12,
      hitbox: { x: 18, y: -100, w: 86, h: 22 }, knockback: { x: 140 }, level: "mid", meterGain: 3,
      cancelInto: ["c_lp", "c_lk", "special", "super"],
    },
    c_lk: {
      name: "Red-Team Poke", startup: 8, active: 2, recovery: 13, damage: 22, hitstun: 15, blockstun: 12,
      hitbox: { x: 20, y: -28, w: 102, h: 24 }, knockback: { x: 160 }, level: "low", meterGain: 3,
      cancelInto: ["c_lp", "special", "super"],
    },
    c_hp: {
      name: "Hex Palm", startup: 11, active: 3, recovery: 31, damage: 92, hitstun: 30, blockstun: 18,
      hitbox: { x: 6, y: -220, w: 72, h: 136 }, knockback: { x: 100, y: 1160 }, level: "mid", meterGain: 6,
      hitstop: 13, cancelInto: ["special", "super"], vfx: "lab_burst",
    },
    c_hk: {
      name: "Slow Takeoff Sweep", startup: 13, active: 3, recovery: 29, damage: 72, hitstun: 24, blockstun: 18,
      hitbox: { x: 18, y: -26, w: 136, h: 26 }, knockback: { x: 210, y: 320 }, level: "low", knockdown: true,
      meterGain: 5,
    },
    j_p: {
      name: "Two-Handed Palm", startup: 8, active: 6, recovery: 8, damage: 62, hitstun: 20, blockstun: 16,
      hitbox: { x: 10, y: -132, w: 88, h: 46 }, knockback: { x: 180 }, level: "overhead", meterGain: 4,
    },
    j_k: {
      name: "Guardrail Kick", startup: 8, active: 7, recovery: 8, damage: 64, hitstun: 20, blockstun: 16,
      hitbox: { x: 8, y: -98, w: 110, h: 46 }, knockback: { x: 210 }, level: "overhead", meterGain: 4,
    },
  },
  specials: [
    {
      id: "constitutional_barrier", name: "Constitutional Barrier", input: "D,N,B+P",
      description: "Raises a wall of glowing constitution text that absorbs one projectile or two strikes. LP near, HP farther out. Scale Up: the wall pulses on creation.",
      startup: 18, active: 2, recovery: 20, damage: 0, meterGain: 4, vfx: "lab_pillar",
      barrier: { offset: 82, lifetime: 240, strikes: 2, projectiles: 1 },
      variants: { LP: { barrier: { offset: 82 } }, HP: { barrier: { offset: 150 } } },
      scaleUp: { barrier: { pulse: { damage: 40 } } },
    },
    {
      id: "country_of_geniuses", name: "Country of Geniuses", input: "QCF+P",
      description: "A tiny datacenter rack releases terracotta sparkle geniuses. LP is one large genius, HP is three small arcing ones. Scale Up: five geniuses.",
      startup: 17, active: 2, recovery: 30, damage: 0, meterGain: 7, vfx: "special_anthropic",
      projectile: {
        speed: 420, hitbox: { x: -32, y: -32, w: 64, h: 64 }, offset: { x: 80, y: -130 }, lifetime: 200,
        damage: 50, chip: 6, hitstun: 20, blockstun: 16, knockback: { x: 230 }, vfx: "projectile_anthropic", meterGain: 8,
      },
      variants: {
        LP: { projectile: { speed: 360, damage: 50 } },
        HP: { projectile: { speed: 380, damage: 20, hitbox: { x: -16, y: -16, w: 32, h: 32 }, spread: [-520, -380, -240], gravity: 900, scale: 0.6, offset: { x: 70, y: -150 } } },
      },
      scaleUp: { projectile: { damage: 18, hitbox: { x: -16, y: -16, w: 32, h: 32 }, spread: [-600, -470, -340, -210, -80], gravity: 900, speed: 400, scale: 0.6 } },
    },
    {
      id: "asl_safeguard", name: "ASL Safeguard", input: "QCB+P",
      description: "Counter stance. Struck by a high or mid, Dario locks the attacker in an amber hex, then palm-strikes. Each success raises the round's ASL level for +10% counter damage. Lows and throws beat it.",
      startup: 4, active: 18, recovery: 26, damage: 0, meterGain: 0, vfx: "lab_aura", limb: "arm",
      parry: { from: 4, to: 21, levels: ["high", "mid"], lock: 40, counter: { name: "Safeguard Palm", anim: "safeguard_palm", damage: 110, startup: 8 } },
      scaleUp: false,
    },
  ],
  super: {
    id: "compressed_century", name: "Compressed Century", input: "QCF,QCF+HP", meterCost: 300, freeze: 30,
    description: "Breakthrough. A rush of terracotta geniuses carries the opponent through a fast-forward montage of 21st-century breakthroughs.",
    startup: 8, active: 3, recovery: 46, damage: 0, meterGain: 0, invuln: { from: 1, to: 10, type: "all" }, vfx: "lab_beam",
    projectile: {
      speed: 760, hitbox: { x: -70, y: -90, w: 140, h: 150 }, offset: { x: 90, y: -110 }, lifetime: 90,
      damage: 55, chip: 11, hitstun: 24, blockstun: 12, hits: 6, hitInterval: 4, knockback: { x: 140 },
      knockdown: true, vfx: "projectile_anthropic", durability: 6, meterGain: 0, scale: 1.8,
    },
  },
  throw: { name: "Race to the Top", damage: 115 },
  finisher: {
    id: "not_to_claude", name: "Not to Claude", input: "B,F,D+HK", range: "mid",
    description: "A stadium jumbotron cuts to an ad break: \"Ads are coming to AI. But not to Claude.\" The opponent is in the stands with a foam finger and a soda, cheerfully watching.",
    vfx: "finisher_not_to_claude",
  },
  assists: { a: "country_of_geniuses", b: "constitutional_barrier" },
  sharedSkills: ["dash", "run", "throw", "throw_tech", "block", "alignment_block", "guardrail", "scale_up", "rollback", "breakthrough", "tag", "assist", "swap_guard", "lab:anthropic"],
});
