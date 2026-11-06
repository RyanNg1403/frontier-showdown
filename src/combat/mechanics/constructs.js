import { overlaps, toWorld } from "../boxes.js";
import { registerMechanic } from "../mechanics.js";
import { fireOnce } from "./core.js";
import { clamp, constructsOf } from "./targeting.js";
import { hash01 } from "./drift-cloud.js";

/**
 * Generated constructs (Fei-Fei's Marble World): engine `solid` entities fighters stand on or
 * collide with.
 *
 * Move data: `mechanic: "marble-world"`, `mechanicData: { frame, kind: "platform"|"wall"|"both",
 * lifetime, platform: {...}, wall: {...} }`.
 * - platform: a one-way floating slab `width` wide with its top at `top`. The engine lands
 *   fighters on it and drops them when they walk off.
 * - wall: a waist-high solid block (`width` x `height`, `hp`) the engine pushes bodies out of;
 *   anyone can stand on top. A translucent splat field rises to `field` px: enemy projectiles and
 *   strikes reaching the block or the field are absorbed and chip its HP, so a waist-high wall
 *   still blanks fireballs.
 * One placement per owner (`both` places a platform and a wall). Lifetime follows the owner's
 * `objectLifetimeMul` passive (World Labs: Spatial Intelligence).
 */
const PLATFORM = { offset: 150, width: 170, top: -150, thickness: 14 };
const WALL = { offset: 120, width: 44, height: 100, field: 210, hp: 150 };
const JADE = "#3ccf9e";
const TAU = Math.PI * 2;

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function construct(match, f, kind, spec, life) {
  const wall = kind === "wall";
  const { left, right } = match.bounds;
  const x = clamp(f.x + f.facing * spec.offset, left + spec.width / 2, right - spec.width / 2);
  const top = wall ? -spec.height : spec.top;
  const thickness = spec.thickness ?? 14;
  return match.spawnEntity({
    kind: "construct", type: kind, wall, owner: f, ownerUid: f.uid, ownerId: f.id, side: f.side, layer: "back",
    x, w: spec.width, top, thickness, field: wall ? spec.field : 0,
    hp: wall ? spec.hp : null, maxHp: wall ? spec.hp : null, life, maxLife: life, hitBy: new Set(),
    solid: wall
      ? { x: x - spec.width / 2, y: top, w: spec.width, h: -top, platform: true, wall: true }
      : { x: x - spec.width / 2, y: top, w: spec.width, h: thickness, platform: true },
    fieldBox() {
      return { x: this.x - this.w / 2, y: -this.field, w: this.w, h: this.field };
    },
    update(m) {
      this.life -= 1;
      if (this.wall) absorb(m, this);
      const [a, b] = [m.point(0), m.point(1)];
      if (a && b && Math.abs(a.floorY - b.floorY) > 40) {
        a.throwInvuln = Math.max(a.throwInvuln, 1);
        b.throwInvuln = Math.max(b.throwInvuln, 1);
      }
      if (this.life > 0 && (this.hp === null || this.hp > 0)) return true;
      m.vfx("barrier_break", this.x, this.top / 2, { facing: 1, side: this.side });
      m.emit("constructEnd", { side: this.side, kind: this.type, x: this.x, broken: this.hp !== null && this.hp <= 0 });
      return false;
    },
    draw(ctx, camera, layer) {
      drawConstruct(ctx, this, match.frame);
    },
  });
}

/** Enemy projectiles and strikes that reach the wall's block or field are absorbed. */
function absorb(match, c) {
  const field = c.fieldBox();
  for (const p of match.projectiles) {
    if (p.dead || p.side === c.side || !overlaps(toWorld(p.def.hitbox, p.x, p.y, p.facing), field)) continue;
    p.dead = true;
    c.hp -= p.def.damage * (p.damageMul ?? 1) * Math.max(1, p.def.hits - p.hits);
    match.vfx("projectile_hit", p.x, p.y, { facing: p.facing, side: p.side, vfx: p.vfx });
  }
  for (const f of match.fighters) {
    if (f.side === c.side) continue;
    const idx = f.activeHitIndex();
    if (idx < 0) continue;
    const key = `${f.uid}:${f.move.id}:${f.moveFrame - idx}:${idx}`;
    if (c.hitBy.has(key) || !f.hitboxes().some((hb) => overlaps(hb, field))) continue;
    c.hitBy.add(key);
    c.hp -= f.move.damage;
    match.vfx("block", c.x, c.top / 2, { facing: f.facing, side: c.side, chip: 0 });
  }
}

function drawConstruct(ctx, c, frame) {
  const fade = Math.min(1, c.life / 30, (c.maxLife - c.life + 1) / 10);
  const left = c.x - c.w / 2;
  const h = c.wall ? -c.top : c.thickness;
  ctx.globalAlpha = fade;
  if (c.wall) {
    const g = ctx.createLinearGradient(0, -c.field, 0, c.top);
    g.addColorStop(0, rgba(JADE, 0));
    g.addColorStop(1, rgba(JADE, 0.22));
    ctx.fillStyle = g;
    ctx.fillRect(left, -c.field, c.w, c.field + c.top);
  }
  ctx.fillStyle = rgba("#16392f", 0.92);
  ctx.fillRect(left, c.top, c.w, h);
  for (let i = 0; i < Math.round(c.w * h / 120); i += 1) {
    ctx.fillStyle = rgba(i % 3 ? JADE : "#e9fff6", 0.35 + 0.25 * Math.sin(frame / 18 + i));
    ctx.beginPath();
    ctx.arc(left + hash01(c.id, i, 1) * c.w, c.top + hash01(c.id, i, 2) * h, 2 + hash01(c.id, i, 3) * 4, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = rgba(JADE, 0.95);
  ctx.lineWidth = 2;
  ctx.strokeRect(left, c.top, c.w, h);
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (let x = left + 12; x < left + c.w; x += 16) {
    ctx.moveTo(x, c.top);
    ctx.lineTo(x - 6, c.top + h);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  if (c.maxHp) {
    ctx.fillStyle = "rgba(10,10,20,0.8)";
    ctx.fillRect(c.x - 24, c.top - 12, 48, 5);
    ctx.fillStyle = JADE;
    ctx.fillRect(c.x - 24, c.top - 12, 48 * Math.max(0, c.hp / c.maxHp), 5);
  }
  ctx.globalAlpha = 1;
}

registerMechanic("marble-world", {
  onFrame(f, move, env) {
    const cfg = move.mechanicData;
    if (f.moveFrame < (cfg.frame ?? move.startup) || !fireOnce(f, "marble-world")) return;
    const match = env.match;
    for (const c of constructsOf(match, f.uid)) c.dead = true;
    const life = Math.round((cfg.lifetime ?? 300) * (f.passiveDef?.objectLifetimeMul ?? 1));
    for (const kind of cfg.kind === "both" ? ["platform", "wall"] : [cfg.kind || "platform"]) {
      const spec = kind === "wall" ? { ...WALL, ...(cfg.wall || {}) } : { ...PLATFORM, ...(cfg.platform || {}) };
      const c = construct(match, f, kind, spec, life);
      match.emit("construct", { fighter: f.id, side: f.side, kind, x: c.x, top: c.top, life });
      match.vfx("barrier", c.x, c.top / 2, { facing: f.facing, side: f.side, height: -c.top, vfx: "lab_pillar" });
    }
  },
});
