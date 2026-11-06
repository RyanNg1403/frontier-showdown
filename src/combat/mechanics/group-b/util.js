import { anyOverlap, intersectionCenter, overlaps, toWorld } from "../../boxes.js";

/** The member of `side` with this id (assists and benched partners included). */
export function findFighter(match, side, id) {
  return match.sides[side]?.members.find((m) => m.id === id) || null;
}

/** On-field fighters of the other side that can still be hit. */
export function enemiesOf(match, side) {
  return match.fighters.filter((f) => f.side !== side && !f.ko && f.state !== "bench");
}

/** The side's input buffer when `f` is the controllable point fighter in a phase that allows acting. */
export function controlInput(match, f) {
  const s = match.sides[f.side];
  if (s.members[s.active] !== f || f.assistMode || !match.canAct(f.side)) return null;
  return s.input;
}

const NOT_FREE = new Set(["thrown", "throwing", "blockstun", "dazed", "finisher", "finished", "breaker", "tech"]);

/** Can `f` act on its own (not stunned, thrown, lying, KO'd or scripted)? */
export function selfControlled(f) {
  return f.canFight && !f.isStunned && !f.isLying && !NOT_FREE.has(f.state);
}

export function towardSign(from, to, fallback = 1) {
  return Math.sign(to - from) || fallback;
}

export function clampX(match, x, margin = 30) {
  return Math.max(match.bounds.left + margin, Math.min(match.bounds.right - margin, x));
}

/** Mechanic objects of one type owned by `owner`. */
export function objectsOf(match, type, owner = null) {
  return match.mech.objects.filter((o) => !o.dead && o.type === type && (!owner || o.owner === owner));
}

/**
 * A hit from a world object (stone, echo, turret burst) rather than the owner's body.
 * The owner gets credit and meter but no hitstop; guard direction comes from the object.
 */
export function objectHit(match, owner, d, props, x, at) {
  const dir = Math.sign(d.x - x) || owner.facing;
  match.applyContact(owner, d, props, at || { x: (x + d.x) / 2, y: d.y - 90 }, { projectile: { x, vx: 0 }, dir });
}

/** Hit every enemy whose hurtboxes overlap `box` (world space). Returns the fighters hit. */
export function burst(match, owner, side, box, props, x, kind = "projectile") {
  const hit = [];
  for (const d of enemiesOf(match, side)) {
    if (d.invulnTo(kind)) continue;
    const pair = anyOverlap([box], d.hurtboxes());
    if (!pair) continue;
    objectHit(match, owner, d, { ...props, knockback: { ...props.knockback } }, x, intersectionCenter(pair[0], pair[1]));
    hit.push(d);
  }
  return hit;
}

/**
 * Let enemy strikes and projectiles damage a destructible object `{uid, side}` whose world
 * hurtboxes are `boxes`. Calls `onHit(damage, x, y, by)` for each contact.
 */
export function strikeObject(match, obj, boxes, onHit) {
  const targets = Array.isArray(boxes) ? boxes : [boxes];
  for (const a of match.fighters) {
    if (a.side === obj.side || a.hitstop > 0) continue;
    const idx = a.activeHitIndex();
    if (idx < 0) continue;
    const log = a.hitLog.get(obj.uid);
    if (log !== undefined && log >= idx) continue;
    const pair = anyOverlap(a.hitboxes(), targets);
    if (!pair) continue;
    a.hitLog.set(obj.uid, idx);
    a.connected = true;
    a.hitstop = Math.max(a.hitstop, 6);
    const c = intersectionCenter(pair[0], pair[1]);
    onHit(Math.round(a.move.damage * (a.damageMul ?? 1)), c.x, c.y, a);
  }
  for (const p of match.projectiles) {
    if (p.dead || p.side === obj.side) continue;
    const pb = toWorld(p.def.hitbox, p.x, p.y, p.facing);
    const box = targets.find((b) => overlaps(pb, b));
    if (!box) continue;
    p.durability -= 1;
    if (p.durability <= 0) p.dead = true;
    const c = intersectionCenter(pb, box);
    match.vfx("projectile_hit", c.x, c.y, { facing: p.facing, side: p.side, vfx: p.vfx });
    onHit(Math.round(p.def.damage * (p.damageMul ?? 1)), c.x, c.y, p.owner);
  }
}
