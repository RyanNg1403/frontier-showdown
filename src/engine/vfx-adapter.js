/**
 * Bridges the engine's spawn vocabulary (contract v2) to whatever a VFX module registers.
 * If the module exports `effectTypes()`, unknown engine types fall back to the closest
 * effect it does have. Every spawn also gets `dir` (= facing) and `lab` options, and
 * engine projectiles are mirrored as manually driven `projectile_<lab>` effects when the
 * module has no `drawProjectile` of its own.
 */
const ALIASES = {
  hit_special: ["lab_impact", "hit_heavy"],
  hit_super: ["hit_heavy"],
  counter: ["hit_counter"],
  tech: ["throw_tech"],
  breaker: ["combo_breaker"],
  throw: ["hit_heavy"],
  dust_run: ["dust_run_start", "dust_dash"],
  dust_jump: ["dust_land"],
  knockdown_impact: ["dust_knockdown", "dust_land"],
  super_flash: ["super_freeze"],
  projectile_hit: ["lab_impact", "hit_heavy"],
  projectile_fizzle: ["lab_burst"],
  clash: ["lab_burst", "hit_heavy"],
  tag_flash: ["tag_in"],
  assist_flash: ["tag_in"],
  finisher: ["lab_burst", "ko"],
  armor: ["block"],
  parry: ["hit_counter", "block"],
  barrier: ["lab_pillar", "lab_burst"],
  barrier_break: ["lab_burst"],
  alignment_block: ["block"],
  guardrail: ["guard_break", "block"],
  guard_crack: ["block"],
  ground_bounce: ["dust_knockdown", "dust_land"],
};

const SCALE = { hit_super: 1.5, hit_special: 1.15, finisher: 1.6, clash: 0.9 };

export function adaptVfx(module, instance) {
  const types = typeof module?.effectTypes === "function" ? new Set(module.effectTypes()) : null;
  const has = (t) => (types ? types.has(t) : true);
  const tracked = new Map();
  const native = typeof instance.drawProjectile === "function";

  function resolve(type, opts) {
    if (!types || types.has(type)) return type;
    if (type === "special_cast") {
      const hint = typeof opts.vfx === "string" ? opts.vfx : null;
      if (hint && has(hint)) return hint;
      return has("lab_charge") ? "lab_charge" : null;
    }
    if (type.startsWith("finisher_")) return resolve("finisher", opts);
    for (const alt of ALIASES[type] || []) if (has(alt)) return alt;
    return null;
  }

  function spawn(type, x, y, opts = {}) {
    const t = resolve(type, opts);
    if (!t) return null;
    const o = { ...opts, dir: opts.dir ?? opts.facing ?? 1 };
    if (!o.lab && opts.labId) o.lab = opts.labId;
    if (SCALE[type] && o.scale === undefined && t !== type) o.scale = SCALE[type];
    if (type === "super_flash" && t === "super_freeze") return instance.spawn(t, x, y + 20, o);
    return instance.spawn(t, x, y, o);
  }

  function projectileType(lab) {
    if (lab && has(`projectile_${lab}`)) return `projectile_${lab}`;
    return has("projectile") ? "projectile" : null;
  }

  return {
    module: instance,
    spawn,
    update(dt) {
      instance.update(dt);
    },
    draw(ctx, camera, layer = "front") {
      instance.draw(ctx, camera, layer);
    },
    syncProjectiles(list) {
      if (native) return;
      const live = new Set();
      for (const p of list) {
        live.add(p.id);
        let h = tracked.get(p.id);
        if (!h) {
          const type = projectileType(p.labId);
          if (!type) continue;
          h = instance.spawn(type, p.x, p.y, { dir: p.facing, lab: p.labId, manual: true, life: 30, scale: p.scale ?? 1 });
          if (!h) continue;
          tracked.set(p.id, h);
        }
        h.x = p.x;
        h.y = p.y;
      }
      for (const [id, h] of tracked) {
        if (live.has(id)) continue;
        tracked.delete(id);
        if (typeof h.impact === "function") h.impact();
        else h.kill?.();
      }
    },
    clearProjectiles() {
      for (const h of tracked.values()) h.kill?.();
      tracked.clear();
    },
    drawProjectile(ctx, camera, p) {
      if (native) return instance.drawProjectile(ctx, camera, p);
      return tracked.has(p.id);
    },
  };
}
