import { RULES } from "../combat/constants.js";
import { parseMotion, motionPriority } from "../combat/input.js";

const LIGHT = new Set(["lp", "lk", "c_lp", "c_lk"]);
const KICKS = new Set(["lk", "hk", "c_lk", "c_hk", "j_k"]);

const NORMAL_ANIMS = {
  lp: "light_punch",
  hp: "heavy_punch",
  lk: "light_kick",
  hk: "heavy_kick",
  c_lp: "crouch_light",
  c_lk: "crouch_light",
  c_hp: "crouch_heavy",
  c_hk: "crouch_heavy",
  j_p: "air_attack",
  j_k: "air_attack",
};

export const NORMAL_KEYS = Object.freeze(Object.keys(NORMAL_ANIMS));

const DEFAULT_PALETTE = {
  primary: "#5b7cfa",
  secondary: "#1d2333",
  accent: "#e9eefc",
  skin: "#e8c3a0",
  hair: "#3a2c24",
};

const DEFAULT_STATS = {
  health: 1000,
  walkSpeed: 150,
  backWalkSpeed: 125,
  runSpeed: 320,
  jump: 1,
  weight: 1,
};

const box = (b, fallback) => (b ? { x: b.x, y: b.y, w: b.w, h: b.h } : fallback);

function normalizeMove(id, raw, category, extra = {}) {
  const m = { ...raw, ...extra };
  const light = category === "normal" && LIGHT.has(id);
  const kind = category === "normal" ? (light ? "light" : "heavy") : category;
  const startup = Math.max(1, m.startup ?? 6);
  const active = Math.max(1, m.active ?? 3);
  const recovery = Math.max(0, m.recovery ?? 10);
  const damage = m.damage ?? 0;
  const defaultChip = category === "special" ? Math.round(damage * 0.15) : category === "super" ? Math.round(damage * 0.25) : 0;
  const move = {
    id,
    name: m.name || id,
    category,
    kind,
    anim: m.anim || NORMAL_ANIMS[id] || id,
    limb: m.limb || (KICKS.has(id) ? "leg" : "arm"),
    startup,
    active,
    recovery,
    total: startup + active + recovery - 1,
    damage,
    chip: m.chip ?? defaultChip,
    hitstun: m.hitstun ?? Math.round(12 + damage / 8),
    blockstun: m.blockstun ?? Math.round(8 + damage / 12),
    hitstop: m.hitstop ?? (light ? 8 : category === "super" ? 10 : 11),
    hitbox: box(m.hitbox, null),
    knockback: { x: m.knockback?.x ?? (light ? 160 : 260), y: m.knockback?.y ?? 0 },
    level: m.level || (id.startsWith("j_") ? "overhead" : "mid"),
    knockdown: Boolean(m.knockdown),
    meterGain: m.meterGain ?? Math.round(4 + damage / 6),
    cancelInto: Array.isArray(m.cancelInto) ? [...m.cancelInto] : [],
    hits: Math.max(1, m.hits ?? 1),
    hitInterval: Math.max(1, m.hitInterval ?? active),
    velocity: Array.isArray(m.velocity) ? m.velocity.map((v) => ({ ...v })) : [],
    invuln: m.invuln ? { from: m.invuln.from ?? 1, to: m.invuln.to ?? startup, type: m.invuln.type || "all" } : null,
    armor: m.armor ? { from: m.armor.from ?? 1, to: m.armor.to ?? startup, hits: m.armor.hits ?? 1 } : null,
    projectile: m.projectile ? normalizeProjectile(m.projectile, startup) : null,
    grab: m.grab ? { range: m.grab.range ?? 110, damage: m.grab.damage ?? 140, techable: Boolean(m.grab.techable), knockback: m.grab.knockback || { x: 260, y: 700 } } : null,
    lastHit: m.lastHit ? { ...m.lastHit } : null,
    juggle: m.juggle ?? 1,
    air: Boolean(m.air || id.startsWith("j_")),
    vfx: m.vfx || null,
    description: m.description || "",
    input: m.input || null,
    motion: m.input ? parseMotion(m.input) : null,
    priority: m.priority ?? 0,
    meterCost: category === "super" ? (m.meterCost ?? RULES.superCost) : 0,
    freeze: category === "super" ? (m.freeze ?? 40) : 0,
    landingRecovery: m.landingRecovery ?? (id.startsWith("j_") ? 3 : 8),
  };
  if (move.motion) move.rank = motionPriority(move.motion) + move.priority;
  return Object.freeze(move);
}

function normalizeProjectile(p, startup) {
  return Object.freeze({
    speed: p.speed ?? 480,
    hitbox: box(p.hitbox, { x: -26, y: -26, w: 52, h: 52 }),
    offset: { x: p.offset?.x ?? 70, y: p.offset?.y ?? -130 },
    lifetime: p.lifetime ?? 150,
    damage: p.damage ?? 60,
    chip: p.chip ?? Math.round((p.damage ?? 60) * 0.18),
    hitstun: p.hitstun ?? 20,
    blockstun: p.blockstun ?? 16,
    hitstop: p.hitstop ?? 9,
    knockback: { x: p.knockback?.x ?? 220, y: p.knockback?.y ?? 0 },
    hits: Math.max(1, p.hits ?? 1),
    hitInterval: Math.max(1, p.hitInterval ?? 5),
    knockdown: Boolean(p.knockdown),
    level: p.level || "mid",
    vfx: p.vfx || "projectile",
    spawnFrame: p.spawnFrame ?? startup,
    meterGain: p.meterGain ?? 10,
    durability: p.durability ?? 1,
  });
}

/** Normalize author-facing character data into the engine's runtime shape. */
export function defineCharacter(def) {
  if (!def || !def.id) throw new Error("Character data needs an id");
  const stats = { ...DEFAULT_STATS, ...(def.stats || {}) };
  const normals = {};
  for (const key of NORMAL_KEYS) {
    const raw = def.normals?.[key];
    if (raw) normals[key] = normalizeMove(key, raw, "normal");
  }
  const specials = (def.specials || []).map((sp, i) =>
    normalizeMove(sp.id || `special_${i + 1}`, sp, "special", { anim: sp.anim || `special_${i + 1}` }),
  );
  const superMove = def.super ? normalizeMove(def.super.id || "super", def.super, "super", { anim: def.super.anim || "super" }) : null;
  const throwMove = normalizeMove("throw", {
    name: "Throw",
    startup: 5,
    active: 2,
    recovery: 24,
    damage: RULES.throwDamage,
    anim: "throw",
    ...(def.throw || {}),
    grab: { range: RULES.throwRange, damage: def.throw?.damage ?? RULES.throwDamage, techable: true, knockback: def.throw?.knockback || { x: 300, y: 650 } },
  }, "throw");
  const finisher = def.finisher
    ? Object.freeze({
        id: def.finisher.id || "finisher",
        name: def.finisher.name || "Finisher",
        input: def.finisher.input || "F,B,F+HP",
        motion: parseMotion(def.finisher.input || "F,B,F+HP"),
        range: def.finisher.range ?? 220,
        anim: def.finisher.anim || "finisher",
        frames: def.finisher.frames ?? 150,
        description: def.finisher.description || "",
        vfx: def.finisher.vfx || "finisher",
      })
    : null;
  const moves = new Map();
  for (const m of Object.values(normals)) moves.set(m.id, m);
  for (const m of specials) moves.set(m.id, m);
  if (superMove) moves.set(superMove.id, superMove);
  moves.set("throw", throwMove);
  const assistId = def.assist && moves.has(def.assist) ? def.assist : specials[0]?.id || "hp";

  return Object.freeze({
    id: def.id,
    name: def.name || def.id,
    title: def.title || "",
    lab: def.lab || "",
    bio: def.bio || "",
    palette: Object.freeze({ ...DEFAULT_PALETTE, ...(def.palette || {}) }),
    stats: Object.freeze(stats),
    hurtboxes: def.hurtboxes || null,
    pushbox: def.pushbox || null,
    normals: Object.freeze(normals),
    specials: Object.freeze(specials),
    specialsByRank: Object.freeze([...specials].sort((a, b) => b.rank - a.rank)),
    super: superMove,
    throw: throwMove,
    finisher,
    assist: assistId,
    sharedSkills: Object.freeze(def.sharedSkills || ["throw", "throw_tech", "dash", "backdash", "run", "combo_breaker", "tag", "assist"]),
    moves,
  });
}

/** Light-weight public description for menus. */
export function describeCharacter(c, hasAtlas = false) {
  return {
    id: c.id,
    name: c.name,
    title: c.title,
    lab: c.lab,
    bio: c.bio,
    palette: c.palette,
    stats: c.stats,
    specials: c.specials.map((s) => ({ id: s.id, name: s.name, input: s.input, description: s.description })),
    super: c.super ? { id: c.super.id, name: c.super.name, input: c.super.input, description: c.super.description } : null,
    finisher: c.finisher ? { id: c.finisher.id, name: c.finisher.name, input: c.finisher.input, description: c.finisher.description } : null,
    hasAtlas,
  };
}
