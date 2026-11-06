import { PHYS, RULES } from "../combat/constants.js";
import { parseMotion, motionPriority } from "../combat/input.js";
import { passiveName } from "../combat/passives.js";

const LIGHT = new Set(["lp", "lk", "c_lp", "c_lk"]);
const KICKS = new Set(["lk", "hk", "c_lk", "c_hk", "j_k", "f_hk", "b_hk"]);

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
  f_hp: "heavy_punch",
  f_hk: "heavy_kick",
  b_hp: "heavy_punch",
  b_hk: "heavy_kick",
};

/** Standard normals every character has. Command normals (`f_hp`, `b_hk`, ...) are optional. */
export const NORMAL_KEYS = Object.freeze(["lp", "hp", "lk", "hk", "c_lp", "c_hp", "c_lk", "c_hk", "j_p", "j_k"]);
export const COMMAND_NORMAL_KEYS = Object.freeze(["f_hp", "f_hk", "b_hp", "b_hk"]);
const BUTTONS = ["LP", "HP", "LK", "HK"];

const DEFAULT_PALETTE = {
  primary: "#5b7cfa",
  secondary: "#1d2333",
  accent: "#e9eefc",
  skin: "#e8c3a0",
  hair: "#3a2c24",
  shoes: "#202020",
};

const DEFAULT_STATS = {
  health: 1000,
  walkSpeed: 150,
  backWalkSpeed: null,
  runSpeed: 320,
  jump: 1,
  weight: 1,
};

const box = (b, fallback) => (b ? { x: b.x, y: b.y, w: b.w, h: b.h } : fallback);

function defaultJuggle(id, m, category) {
  if (category === "super") return 0;
  if (category === "special" || category === "throw") return 2;
  if ((m.knockback?.y ?? 0) > 0 && category === "normal") return 3;
  return LIGHT.has(id) ? 1 : 2;
}

function normalizeMove(id, raw, category, extra = {}) {
  const m = { ...raw, ...extra };
  const light = category === "normal" && LIGHT.has(id);
  const kind = category === "normal" ? (light ? "light" : "heavy") : category;
  const startup = Math.max(1, m.startup ?? 6);
  const active = Math.max(1, m.active ?? 3);
  const recovery = Math.max(0, m.recovery ?? 10);
  const damage = m.damage ?? 0;
  const defaultChip = category === "special" ? Math.round(damage * 0.12) : category === "super" ? Math.round(damage * 0.2) : 0;
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
    meterGain: m.meterGain ?? Math.round(3 + damage / 20),
    cancelInto: Array.isArray(m.cancelInto) ? [...m.cancelInto] : [],
    hits: Math.max(1, m.hits ?? 1),
    hitInterval: Math.max(1, m.hitInterval ?? active),
    velocity: Array.isArray(m.velocity) ? m.velocity.map((v) => ({ ...v })) : [],
    invuln: m.invuln ? { from: m.invuln.from ?? 1, to: m.invuln.to ?? startup, type: m.invuln.type || "all" } : null,
    armor: m.armor ? { from: m.armor.from ?? 1, to: m.armor.to ?? startup, hits: m.armor.hits ?? 1 } : null,
    projectile: m.projectile ? normalizeProjectile(m.projectile, startup) : null,
    grab: m.grab ? { range: m.grab.range ?? 110, damage: m.grab.damage ?? 140, techable: Boolean(m.grab.techable), knockback: m.grab.knockback || { x: 260, y: 700 } } : null,
    teleport: m.teleport ? { vanish: m.teleport.vanish ?? 4, frame: m.teleport.frame ?? startup - 2, to: m.teleport.to || "front", distance: m.teleport.distance ?? 72 } : null,
    parry: m.parry ? normalizeParry(m.parry) : null,
    barrier: m.barrier ? normalizeBarrier(m.barrier, startup) : null,
    lastHit: m.lastHit ? { ...m.lastHit } : null,
    juggle: m.juggle ?? defaultJuggle(id, m, category),
    air: Boolean(m.air || id.startsWith("j_")),
    vfx: m.vfx || null,
    description: m.description || "",
    input: m.input || null,
    motion: m.input ? parseMotion(m.input) : null,
    priority: m.priority ?? 0,
    meterCost: category === "super" ? (m.meterCost ?? RULES.superCost) : 0,
    freeze: category === "super" ? (m.freeze ?? 30) : 0,
    landingRecovery: m.landingRecovery ?? (id.startsWith("j_") ? 3 : 8),
    variants: null,
    scaled: null,
    isScaled: Boolean(extra.isScaled),
    button: extra.button || null,
  };
  if (move.motion) move.rank = motionPriority(move.motion) + move.priority;
  return move;
}

function normalizeProjectile(p, startup) {
  const vys = Array.isArray(p.spread) ? p.spread : [p.vy ?? 0];
  return Object.freeze({
    speed: p.speed ?? 480,
    hitbox: box(p.hitbox, { x: -26, y: -26, w: 52, h: 52 }),
    offset: { x: p.offset?.x ?? 70, y: p.offset?.y ?? -130 },
    lifetime: p.lifetime ?? 150,
    damage: p.damage ?? 60,
    chip: p.chip ?? Math.round((p.damage ?? 60) * 0.12),
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
    meterGain: p.meterGain ?? 6,
    durability: p.durability ?? 1,
    spread: Object.freeze(vys),
    gravity: p.gravity ?? 0,
    scale: p.scale ?? 1,
  });
}

function normalizeParry(p) {
  return Object.freeze({
    from: p.from ?? 4,
    to: p.to ?? 21,
    levels: Object.freeze(p.levels || ["high", "mid", "overhead"]),
    lock: p.lock ?? 40,
    maxLevel: p.maxLevel ?? 3,
    levelBonus: p.levelBonus ?? 0.1,
    counter: normalizeMove("parry_counter", {
      name: p.counter?.name || "Counter",
      startup: 6,
      active: 4,
      recovery: 20,
      damage: 110,
      hitstun: 30,
      knockback: { x: 380, y: 520 },
      knockdown: true,
      hitbox: { x: 0, y: -190, w: 130, h: 190 },
      anim: p.counter?.anim || "heavy_punch",
      juggle: 0,
      ...(p.counter || {}),
    }, "special"),
  });
}

function normalizeBarrier(b, startup) {
  return Object.freeze({
    frame: b.frame ?? startup,
    offset: b.offset ?? 80,
    width: b.width ?? 36,
    height: b.height ?? 210,
    lifetime: b.lifetime ?? 240,
    strikes: b.strikes ?? 2,
    projectiles: b.projectiles ?? 1,
    pulse: b.pulse ? { damage: b.pulse.damage ?? 40, knockback: b.pulse.knockback ?? { x: 360, y: 0 } } : null,
    vfx: b.vfx || "barrier",
  });
}

function merge(base, over) {
  if (!over) return base;
  const out = { ...base, ...over };
  if (base.projectile && over.projectile) out.projectile = { ...base.projectile, ...over.projectile };
  if (base.barrier && over.barrier) out.barrier = { ...base.barrier, ...over.barrier };
  if (base.teleport && over.teleport) out.teleport = { ...base.teleport, ...over.teleport };
  return out;
}

/** A special or super with optional per-button variants and a Scale Up version of each. */
function buildSpecial(id, raw, category, anim) {
  const make = (r, extra = {}) => {
    const mv = normalizeMove(id, r, category, { anim, ...extra });
    const up = r.scaleUp === false ? null : merge(r, { damage: Math.round((r.damage ?? 0) * RULES.scaleUpDamage), ...(r.scaleUp || {}) });
    if (up && up.projectile && !(r.scaleUp && r.scaleUp.projectile && r.scaleUp.projectile.damage)) {
      up.projectile = { ...up.projectile, damage: Math.round((r.projectile.damage ?? 60) * RULES.scaleUpDamage) };
    }
    if (category === "special" && up) mv.scaled = Object.freeze(normalizeMove(id, up, category, { anim, isScaled: true, button: extra.button }));
    return mv;
  };
  const base = make(raw);
  if (raw.variants) {
    base.variants = {};
    for (const btn of BUTTONS) {
      if (raw.variants[btn]) base.variants[btn] = Object.freeze(make(merge(raw, raw.variants[btn]), { button: btn }));
    }
    Object.freeze(base.variants);
  }
  return Object.freeze(base);
}

function jumpHeight(stats) {
  const j = stats.jump ?? 1;
  return j > 5 ? j : PHYS.jumpHeight * j;
}

/** Normalize author-facing character data into the engine's runtime shape. */
export function defineCharacter(def) {
  if (!def || !def.id) throw new Error("Character data needs an id");
  const stats = { ...DEFAULT_STATS, ...(def.stats || {}) };
  stats.backWalkSpeed = stats.backWalkSpeed ?? Math.round(stats.walkSpeed * 0.8);
  stats.jumpHeight = jumpHeight(stats);
  const normals = {};
  for (const key of [...NORMAL_KEYS, ...COMMAND_NORMAL_KEYS]) {
    const raw = def.normals?.[key];
    if (raw) normals[key] = Object.freeze(normalizeMove(key, raw, "normal"));
  }
  const specials = (def.specials || []).map((sp, i) => buildSpecial(sp.id || `special_${i + 1}`, sp, "special", sp.anim || `special_${i + 1}`));
  const superMove = def.super ? buildSpecial(def.super.id || "super", def.super, "super", def.super.anim || "super") : null;
  const throwMove = Object.freeze(normalizeMove("throw", {
    name: "Throw",
    startup: 8,
    active: 3,
    recovery: 22,
    damage: RULES.throwDamage,
    anim: "throw",
    ...(def.throw || {}),
    grab: { range: RULES.throwRange, damage: def.throw?.damage ?? RULES.throwDamage, techable: true, knockback: def.throw?.knockback || { x: 300, y: 650 } },
  }, "throw"));
  const getupAttack = Object.freeze(normalizeMove("getup_attack", {
    name: "Getup Attack",
    startup: 9,
    active: 3,
    recovery: 30,
    damage: 60,
    hitstun: 22,
    blockstun: 10,
    hitbox: { x: 10, y: -150, w: 110, h: 120 },
    knockback: { x: 320, y: 0 },
    invuln: { from: 1, to: 9, type: "all" },
    anim: "heavy_kick",
    limb: "leg",
    ...(def.getupAttack || {}),
  }, "normal"));
  const finisher = def.finisher
    ? Object.freeze({
        id: def.finisher.id || "finisher",
        name: def.finisher.name || "Finisher",
        input: def.finisher.input || "F,B,F+HP",
        motion: parseMotion(def.finisher.input || "F,B,F+HP"),
        range: typeof def.finisher.range === "number" ? def.finisher.range : { close: 160, mid: 320, far: 1400 }[def.finisher.range] ?? 220,
        rangeName: typeof def.finisher.range === "string" ? def.finisher.range : null,
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
  moves.set("getup_attack", getupAttack);
  const assistA = def.assists?.a ?? def.assist;
  const assistB = def.assists?.b;
  const pickAssist = (id, fallback) => (id && moves.has(id) ? id : fallback);
  const assists = Object.freeze({
    a: pickAssist(assistA, specials[0]?.id || "hp"),
    b: pickAssist(assistB, specials[1]?.id || specials[0]?.id || "hp"),
  });
  const labId = def.labId || String(def.lab || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const sharedSkills = Object.freeze(def.sharedSkills || ["dash", "run", "throw", "throw_tech", "block", "alignment_block", "guardrail", "scale_up", "rollback", "breakthrough", "tag", "assist", "swap_guard", ...(labId ? [`lab:${labId}`] : [])]);

  const out = {
    id: def.id,
    name: def.name || def.id,
    shortName: def.shortName || String(def.name || def.id).split(" ")[0],
    title: def.title || "",
    lab: def.lab || "",
    labId,
    bio: def.bio || "",
    quotes: Object.freeze({ ...(def.quotes || {}) }),
    palette: Object.freeze({ ...DEFAULT_PALETTE, ...(def.palette || {}) }),
    stats: Object.freeze(stats),
    hurtboxes: def.hurtboxes || null,
    pushbox: def.pushbox || null,
    normals: Object.freeze(normals),
    specials: Object.freeze(specials),
    specialsByRank: Object.freeze([...specials].sort((a, b) => b.rank - a.rank)),
    super: superMove,
    throw: throwMove,
    getupAttack,
    finisher,
    assists,
    assist: assists.a,
    sharedSkills,
    moves,
  };
  out.passive = passiveName(out);
  return Object.freeze(out);
}

/** Light-weight public description for menus. */
export function describeCharacter(c, hasAtlas = false) {
  const info = (m) => (m ? { id: m.id, name: m.name, input: m.input, description: m.description } : null);
  return {
    id: c.id,
    name: c.name,
    shortName: c.shortName,
    title: c.title,
    lab: c.lab,
    labId: c.labId,
    bio: c.bio,
    quotes: c.quotes,
    palette: c.palette,
    stats: c.stats,
    passive: c.passive,
    specials: c.specials.map(info),
    super: info(c.super),
    finisher: c.finisher ? { id: c.finisher.id, name: c.finisher.name, input: c.finisher.input, description: c.finisher.description, range: c.finisher.rangeName || c.finisher.range } : null,
    throw: { name: c.throw.name },
    assists: { a: c.assists.a, b: c.assists.b },
    hasAtlas,
  };
}
