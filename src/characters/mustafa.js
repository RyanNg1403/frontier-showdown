import { defineCharacter } from "./schema.js";

/**
 * Mustafa Suleyman, "The Containment Specialist" (roster doc 3.12). Trap and space control:
 * a Containment Field that stops dashing and running, a ground wave that grows as it travels,
 * and the Copilot orb that strikes on a delay.
 */

const field = (offset, blockProjectiles = false) => ({
  place: {
    type: "zone", look: "containment", offset, w: 230, h: 230, lifetime: 240, max: 1, vfx: "lab_pillar",
    mods: { speedMul: 0.6, noDash: true }, exit: { damage: 30 }, blockProjectiles,
  },
});
const copilot = (distance, strikes = 1) => ({
  companion: {
    look: "orb", distance, height: -130, travel: 18, delay: 40, strikes, strikeGap: 14, box: { w: 120, h: 170 },
    hit: { damage: 50, hitstun: 22, blockstun: 16, knockback: { x: 200 }, level: "mid", chip: 6 },
  },
});

export default defineCharacter({
  id: "mustafa",
  name: "Mustafa Suleyman",
  shortName: "Mustafa",
  title: "The Containment Specialist",
  lab: "Microsoft AI",
  labId: "microsoft-ai",
  bio: "Calm, measured, never flustered. Locks the opponent in a Containment Field, covers the exits with The Coming Wave and lets the Copilot orb fill the gaps.",
  quotes: {
    intro: "We must build AI for people; not to be a person.",
    victory: [
      "Containment is not, on the face of it, possible. And yet for all our sakes, containment must be possible.",
      "I invite people to be also healthily afraid and sceptical.",
    ],
  },
  palette: {
    primary: "#151517",
    secondary: "#262c3a",
    accent: "#f5a623",
    skin: "#d9ae88",
    hair: "#2a1f18",
    shoes: "#1b1b1d",
    glasses: "#c9a64a",
    glassesStyle: "round",
    beard: "#2a1f18",
  },
  stats: { health: 1020, walkSpeed: 190, runSpeed: 440, jump: 195, weight: 1.0 },
  normals: {
    lp: {
      name: "Precise Jab", startup: 7, active: 2, recovery: 12, damage: 24, hitstun: 16, blockstun: 13,
      hitbox: { x: 22, y: -166, w: 86, h: 24 }, knockback: { x: 150 }, level: "high", meterGain: 3,
      cancelInto: ["lp", "hp", "special", "super"],
    },
    hp: {
      name: "Hex Palm Push", startup: 12, active: 3, recovery: 20, damage: 66, hitstun: 22, blockstun: 17,
      hitbox: { x: 24, y: -172, w: 110, h: 40 }, knockback: { x: 320 }, level: "high", meterGain: 5,
      cancelInto: ["special", "super"], vfx: "lab_burst",
    },
    lk: {
      name: "Short Low Kick", startup: 8, active: 3, recovery: 15, damage: 26, hitstun: 16, blockstun: 13,
      hitbox: { x: 20, y: -34, w: 100, h: 30 }, knockback: { x: 170 }, level: "low", meterGain: 4,
      cancelInto: ["hk", "special", "super"],
    },
    hk: {
      name: "Crescent Kick", startup: 14, active: 4, recovery: 22, damage: 74, hitstun: 24, blockstun: 18,
      hitbox: { x: 28, y: -168, w: 124, h: 50 }, knockback: { x: 360 }, level: "mid", meterGain: 6,
      cancelInto: ["special", "super"],
    },
    c_lp: {
      name: "Measured Tap", startup: 7, active: 2, recovery: 12, damage: 20, hitstun: 15, blockstun: 12,
      hitbox: { x: 18, y: -100, w: 84, h: 22 }, knockback: { x: 140 }, level: "mid", meterGain: 3,
      cancelInto: ["c_lp", "c_lk", "special", "super"],
    },
    c_lk: {
      name: "Ankle Check", startup: 8, active: 2, recovery: 14, damage: 22, hitstun: 15, blockstun: 12,
      hitbox: { x: 20, y: -28, w: 108, h: 24 }, knockback: { x: 150 }, level: "low", meterGain: 3,
      cancelInto: ["c_lp", "special", "super"],
    },
    c_hp: {
      name: "Rising Hex", startup: 10, active: 4, recovery: 28, damage: 100, hitstun: 30, blockstun: 18,
      hitbox: { x: 4, y: -236, w: 86, h: 156 }, knockback: { x: 100, y: 1160 }, level: "mid", meterGain: 6,
      hitstop: 13, cancelInto: ["special", "super"], vfx: "lab_burst",
    },
    c_hk: {
      name: "Wave Sweep", startup: 13, active: 3, recovery: 28, damage: 70, hitstun: 24, blockstun: 18,
      hitbox: { x: 18, y: -26, w: 144, h: 26 }, knockback: { x: 210, y: 320 }, level: "low", knockdown: true,
      meterGain: 5,
    },
    j_p: {
      name: "Downward Palm", startup: 8, active: 6, recovery: 8, damage: 60, hitstun: 20, blockstun: 16,
      hitbox: { x: 8, y: -116, w: 90, h: 56 }, knockback: { x: 180 }, level: "overhead", meterGain: 4,
    },
    j_k: {
      name: "Presenter Kick", startup: 8, active: 7, recovery: 8, damage: 60, hitstun: 20, blockstun: 16,
      hitbox: { x: 8, y: -96, w: 106, h: 48 }, knockback: { x: 200 }, level: "overhead", meterGain: 4,
    },
  },
  specials: [
    {
      id: "containment_field", name: "Containment Field", input: "D,N,B+P",
      description: "Projects a hexagonal amber field on the floor (LP near, HP far; max 1, 4 s). Inside it the opponent cannot dash or run and walks 40% slower; leaving it zaps for 30. Scale Up: the field's edges also stop projectiles.",
      startup: 18, active: 1, recovery: 20, damage: 0, meterGain: 4, vfx: "lab_pillar",
      mech: field(170),
      variants: { LP: { mech: field(170) }, HP: { mech: field(330) } },
      scaleUp: { mech: field(250, true) },
    },
    {
      id: "coming_wave", name: "The Coming Wave", input: "QCF+K",
      description: "A rolling wave that grows as it travels: 45 damage up close, 80 at full screen. Must be blocked low. Scale Up: a second wave follows 30 f later.",
      startup: 18, active: 2, recovery: 28, damage: 0, meterGain: 7, vfx: "special_microsoft-ai", limb: "leg",
      projectile: {
        speed: 330, hitbox: { x: -30, y: -26, w: 60, h: 48 }, offset: { x: 76, y: -24 }, lifetime: 220,
        damage: 45, chip: 6, hitstun: 20, blockstun: 16, knockback: { x: 240 }, level: "low",
        vfx: "projectile_microsoft-ai", meterGain: 8,
        mech: { look: "wave", grow: { distance: 900, damage: 80, scale: 1.9 } },
      },
      scaleUp: { projectile: { damage: 45, mech: { look: "wave", grow: { distance: 900, damage: 80, scale: 1.9 }, echo: { delay: 30 } } } },
    },
    {
      id: "copilot", name: "Copilot", input: "QCB+P",
      description: "Sends the amber orb to float to a spot (LP near, HP far); it strikes 40 f later, or at once when Copilot is used again. Scale Up: the orb strikes twice. Press LP 12 times during a round intro for a paperclip.",
      startup: 10, active: 1, recovery: 18, damage: 0, meterGain: 5, vfx: "lab_aura",
      mech: copilot(200),
      variants: { LP: { mech: copilot(180) }, HP: { mech: copilot(370) } },
      scaleUp: { mech: copilot(260, 2) },
    },
  ],
  super: {
    id: "modern_turing_test", name: "Modern Turing Test", input: "QCF,QCF+HP", meterCost: 300, freeze: 30,
    description: "Breakthrough. Mustafa hands over a \"$100,000\" briefcase and a swarm of amber agent-orbs zips around the opponent doing tasks while a ticker counts up to \"$1,000,000\".",
    startup: 8, active: 32, recovery: 50, damage: 42, chip: 8, hitstun: 22, blockstun: 10, hits: 8, hitInterval: 4,
    hitbox: { x: 6, y: -200, w: 150, h: 196 }, knockback: { x: 100 }, level: "mid", meterGain: 0,
    invuln: { from: 1, to: 8, type: "all" }, velocity: [{ from: 4, to: 16, vx: 560 }],
    lastHit: { knockback: { x: 420, y: 820 }, knockdown: true }, hitstop: 6, vfx: "lab_beam",
  },
  throw: { name: "Modern Turing Test", damage: 110 },
  finisher: {
    id: "contained", name: "Contained", input: "B,B,F+HP", range: "mid",
    description: "Amber hexagons fold around the opponent into a neat terrarium labelled \"CONTAINED\". Inside, the opponent sits comfortably with a cup of tea and waves; Mustafa sets it on a shelf.",
    vfx: "finisher_contained",
  },
  assists: { a: "coming_wave", b: "containment_field" },
  sharedSkills: ["dash", "run", "throw", "throw_tech", "block", "alignment_block", "guardrail", "scale_up", "rollback", "breakthrough", "tag", "assist", "swap_guard", "lab:microsoft-ai"],
});
