import { Fighter } from "../../fighter.js";
import { registerSystem } from "../../mechanics.js";
import { anyOverlap, intersectionCenter } from "../../boxes.js";
import { currentMove, fireOnce } from "../core.js";
import { drawObjectEntity } from "./draw.js";
import { clampX, enemiesOf, objectHit, objectsOf, strikeObject, towardSign } from "./util.js";

/**
 * Puppet / delayed echo (Demis's Self-Play). A translucent copy of the owner repeats each of
 * the owner's normals `delay` frames later from its own position, at `damageScale` damage.
 * It has its own HP; destroying it stuns the owner.
 *
 * Move data: `mech: { echo: { duration, delay, hp, damageScale, placement: "behind_opponent"|"beside",
 * distance, stun, palette } }`.
 */
const ECHO_PALETTE = { primary: "#4b3fb8", secondary: "#2c2470", accent: "#c9c1ff", skin: "#a99cff", hair: "#3a2f90", beard: "#5a4fc8", shoes: "#2c2470", shirt: null };

function makeBody(owner, spec) {
  const palette = Object.freeze({ ...owner.def.palette, ...ECHO_PALETTE, ...(spec.palette || {}), glasses: owner.def.palette.glasses ? "#ded8ff" : undefined });
  const def = Object.create(owner.def, { palette: { value: palette, enumerable: true } });
  const body = new Fighter(def, { side: owner.side, atlas: owner.atlas });
  body.echo = true;
  return body;
}

function echoProps(move, scale) {
  return {
    id: move.id,
    kind: move.kind,
    category: "normal",
    damage: move.damage * scale,
    chip: 0,
    hitstun: move.hitstun,
    blockstun: move.blockstun,
    hitstop: move.hitstop,
    knockback: { ...move.knockback },
    level: move.level,
    knockdown: move.knockdown,
    meterGain: Math.round(move.meterGain * 0.5),
    juggle: move.juggle,
    special: false,
  };
}

export function echoOf(match, owner) {
  return objectsOf(match, "echo", owner)[0] || null;
}

function destroy(ctx, e, broken) {
  const match = ctx.match;
  e.dead = true;
  ctx.effect(broken ? "echo_break" : "placed_fade", e.x, -100, { side: e.side, life: 20, look: "echo" });
  if (!broken) return;
  match.vfx("barrier_break", e.x, -100, { facing: e.body.facing, side: e.side });
  const o = e.owner;
  match.emit("echoBroken", { fighter: o.id, side: o.side });
  if (o.onField && !o.ko && o.canFight && !o.assistMode) {
    o.pendingMove = null;
    o.setState("hitstun", { keepAnim: true });
    o.stun = e.spec.stun ?? 30;
    o.stunAnim = "hit_high";
    o.setAnim("hit_high", true);
    o.vx = 0;
  }
}

function spawn(ctx, f, m, spec) {
  const match = ctx.match;
  for (const old of objectsOf(match, "echo", f)) old.dead = true;
  const opp = match.point(1 - f.side);
  const toward = opp ? towardSign(f.x, opp.x, f.facing) : f.facing;
  const raw = spec.placement === "behind_opponent" && opp ? opp.x + toward * (spec.distance ?? 80) : f.x - f.facing * 70;
  const x = clampX(match, raw);
  const body = makeBody(f, spec);
  body.reset(x, opp ? towardSign(x, opp.x, f.facing) : f.facing);
  const e = ctx.addObject({
    type: "echo",
    look: "echo",
    owner: f,
    ownerUid: f.uid,
    ownerId: f.id,
    side: f.side,
    facing: body.facing,
    x,
    y: -100,
    w: 70,
    h: 200,
    life: spec.duration ?? 360,
    maxLife: spec.duration ?? 360,
    hp: spec.hp ?? 100,
    maxHp: spec.hp ?? 100,
    body,
    spec,
    queue: [],
  });
  e.uid = `echo:${e.id}`;
  drawObjectEntity(match, e);
  match.emit("echo", { fighter: f.id, side: f.side, x, moveId: m.id });
}

const echoModule = {

  update(ctx) {
    const match = ctx.match;
    for (const f of match.fighters) {
      const m = currentMove(f);
      if (!m) continue;
      if (m.mech?.echo && f.moveFrame >= m.startup && fireOnce(f, "echo")) spawn(ctx, f, m, m.mech.echo);
      if (m.category === "normal" && fireOnce(f, "echo_record")) {
        const e = echoOf(match, f);
        if (e) e.queue.push({ at: match.frame + (e.spec.delay ?? 20), move: m, frame: f.moveFrame, y: f.y });
      }
    }
    if (match.phase !== "fight") return;
    for (const e of ctx.objects) {
      if (e.dead || e.type !== "echo") continue;
      const o = e.owner;
      if (e.born !== match.frame && --e.life <= 0) {
        destroy(ctx, e, false);
        continue;
      }
      if (!o.onField || o.ko || o.state === "tag_out") {
        destroy(ctx, e, false);
        continue;
      }
      const b = e.body;
      b.stateFrame += 1;
      if (b.state === "attack") {
        b.moveFrame += 1;
        if (b.moveFrame > b.move.total) {
          b.y = 0;
          b.setState("idle");
        }
      }
      if (b.state !== "attack" && e.queue.length && e.queue[0].at <= match.frame) {
        const item = e.queue.shift();
        const opp = match.point(1 - e.side);
        b.setState("attack", { keepAnim: true });
        b.move = item.move;
        b.moveFrame = item.frame;
        b.hitLog = new Map();
        b.anim = { name: item.move.anim, t: 0 };
        b.y = item.y;
        if (opp) b.facing = towardSign(b.x, opp.x, b.facing);
      }
      b.lastDx = 0;
      b.advanceAnim();
      e.facing = b.facing;
      e.y = b.y - 100;
      const idx = b.activeHitIndex();
      if (idx >= 0) {
        const boxes = b.hitboxes();
        for (const d of enemiesOf(match, e.side)) {
          if (d.invulnTo("strike")) continue;
          const log = b.hitLog.get(d.uid);
          if (log !== undefined && log >= idx) continue;
          const pair = anyOverlap(boxes, d.hurtboxes());
          if (!pair) continue;
          b.hitLog.set(d.uid, idx);
          objectHit(match, o, d, echoProps(b.move, e.spec.damageScale ?? 0.7), b.x, intersectionCenter(pair[0], pair[1]));
        }
      }
      strikeObject(match, e, b.hurtboxes(), (damage, x, y, by) => {
        e.hp -= damage;
        match.vfx("hit_light", x, y, { facing: by ? towardSign(by.x, b.x) : 1, side: by?.side ?? 1 - e.side, damage });
        if (e.hp <= 0 && !e.dead) destroy(ctx, e, true);
      });
    }
  },

  snapshot(ctx, out) {
    out.echoes = ctx.objects.filter((o) => o.type === "echo" && !o.dead).map((e) => ({ id: e.id, side: e.side, owner: e.ownerId, x: Math.round(e.x), hp: e.hp, maxHp: e.maxHp, moveId: e.body.state === "attack" ? e.body.move.id : null }));
  },
};

registerSystem("group-b-echo", echoModule, { order: 111 });
