import { overlaps } from "../boxes.js";
import { contactProps } from "./core.js";

/** Point a strike, beam or homing object aims at: the middle of the standing or crouching body. */
export function bodyCenter(f) {
  return { x: f.x, y: f.y - (f.isLying ? 20 : f.crouching ? 62 : 108) };
}

/** First sample along a thick segment that overlaps any box, or null. */
export function segmentHit(x0, y0, x1, y1, thickness, boxes) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(len / 8));
  const half = thickness / 2;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const px = x0 + (x1 - x0) * t;
    const py = y0 + (y1 - y0) * t;
    const probe = { x: px - half, y: py - half, w: thickness, h: thickness };
    for (const b of boxes) if (overlaps(probe, b)) return { x: px, y: py, t };
  }
  return null;
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** On-screen fighters of the other side. */
export function enemiesOf(match, side) {
  return match.fighters.filter((f) => f.side !== side && f.state !== "bench");
}

/** Live Marble constructs (entities spawned by `constructs.js`). */
export function constructsOf(match, ownerUid = null) {
  return match.entities.filter((e) => e.kind === "construct" && !e.dead && (ownerUid === null || e.ownerUid === ownerUid));
}

/** `core.contactProps` for a move of any category (beams and supers keep their own scaling rules). */
export function propsFor(id, cfg, category = "special") {
  const props = contactProps(id, cfg);
  props.category = category;
  props.kind = category === "super" ? "super" : category === "normal" ? "heavy" : "special";
  props.special = category === "special";
  if (category === "super") props.meterGain = cfg.meterGain ?? 0;
  return props;
}

/**
 * Deal a hit from a mechanic (beam tick, echo, counter) through the engine's hit/block logic, as
 * a ranged source at `fromX`, so the owner takes no hitstop. `move` reaches the systems'
 * `beforeContact` as `info.move`.
 */
export function strikeFrom(match, owner, target, props, at, { fromX = owner.x, move = null } = {}) {
  const scaled = { ...props, damage: props.damage * (owner.damageMul ?? 1) };
  const dir = Math.sign(target.x - fromX) || owner.facing;
  match.applyContact(owner, target, scaled, at, { projectile: { x: fromX, vx: 0, owner, mechanic: true }, dir, move });
  owner.connected = true;
}

/** The move `f` is executing when it uses `mechanic`, else null. */
export function inMechanicMove(f, mechanic) {
  return f.state === "attack" && f.move?.mechanic === mechanic ? f.move : null;
}
