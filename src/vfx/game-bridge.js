// Subscribes the VFX system to `game.events`. Payloads are read defensively
// so the engine can add fields without breaking effects.
//
//   hit     { x, y, attacker, defender, strength: "light"|"heavy", counter, throwTech, guardBreak, comboBreaker, dir }
//   block   { x, y, attacker, defender, guardBreak }
//   ko      { x, y, fighter | defender }
//   tag     { incoming, outgoing, side }
//   special { fighter, special: { id, vfx?: string | { type, opts } } }
//   super   { fighter, portrait?, side? }
//   animFrame { fighter, anim, frame, animData }   (optional, drives footfall dust)
//   animState { fighter, prev, next, animData }    (optional, state-change dust)
//
// Fighters are read as { x, y (feet), facing, lab, portrait? }.
import { createFrameEventRouter } from "./frame-events.js";

function listen(emitter, name, fn) {
  if (!emitter) return () => {};
  if (typeof emitter.on === "function") {
    emitter.on(name, fn);
    return () => (emitter.off ? emitter.off(name, fn) : emitter.removeListener && emitter.removeListener(name, fn));
  }
  if (typeof emitter.addEventListener === "function") {
    const h = (e) => fn(e && e.detail !== undefined ? e.detail : e);
    emitter.addEventListener(name, h);
    return () => emitter.removeEventListener(name, h);
  }
  return () => {};
}

const sign = (v) => (v < 0 ? -1 : 1);

function contactPoint(e) {
  if (e.x !== undefined && e.y !== undefined) return { x: e.x, y: e.y };
  if (e.point) return e.point;
  const d = e.defender || e.fighter;
  if (d) return { x: d.x - sign(d.facing) * 30, y: d.y - (e.height ?? 140) };
  return { x: 640, y: 460 };
}

function direction(e) {
  if (e.dir !== undefined) return sign(e.dir);
  if (e.attacker && e.attacker.facing !== undefined) return sign(e.attacker.facing);
  if (e.defender && e.defender.facing !== undefined) return -sign(e.defender.facing);
  return 1;
}

function hitType(e) {
  if (e.comboBreaker) return "combo_breaker";
  if (e.guardBreak) return "guard_break";
  if (e.throwTech || e.tech) return "throw_tech";
  if (e.counter || e.counterHit) return "hit_counter";
  const s = e.strength || e.level || (e.move && e.move.strength);
  if (s === "heavy" || s === "super" || e.heavy) return "hit_heavy";
  if (!s && e.damage !== undefined && e.damage >= 70) return "hit_heavy";
  return "hit_light";
}

export function bindVfxToGame(vfx, game, options = {}) {
  const ev = game && game.events;
  const router = options.router || createFrameEventRouter(vfx);
  const hitstop = options.hitstop || null;
  const off = [];
  const on = (name, fn) => off.push(listen(ev, name, (e = {}) => fn(e || {})));

  on("hit", (e) => {
    const type = hitType(e);
    const at = contactPoint(e);
    vfx.spawn(type, at.x, at.y, { dir: direction(e), scale: e.vfxScale });
    if (hitstop && hitstop[type]) vfx.hitstop(hitstop[type]);
    if (e.knockdown && e.defender) router.spawnDust(e.defender, "knockdown", {}, { opts: { delay: 0.25 } });
  });

  on("block", (e) => {
    const at = contactPoint(e);
    vfx.spawn(e.guardBreak ? "guard_break" : "block", at.x, at.y, { dir: direction(e) });
  });

  on("ko", (e) => {
    const at = contactPoint({ ...e, defender: e.defender || e.fighter });
    vfx.spawn("ko", at.x, at.y, { dir: direction(e) });
  });

  on("tag", (e) => {
    const side = e.side || (e.incoming && e.incoming.x < 640 ? "left" : "right");
    if (e.outgoing) vfx.spawn("tag_out", e.outgoing.x, e.outgoing.y, { lab: e.outgoing.lab, side });
    if (e.incoming) vfx.spawn("tag_in", e.incoming.x, e.incoming.y, { lab: e.incoming.lab, side, dir: sign(e.incoming.facing) });
  });

  on("special", (e) => {
    const f = e.fighter || {};
    const spec = (e.special && e.special.vfx) || e.vfx;
    const dir = sign(f.facing);
    if (typeof spec === "string") vfx.spawn(spec, f.x, f.y, { lab: f.lab, dir });
    else if (spec && spec.type) vfx.spawn(spec.type, (f.x ?? 0) + (spec.dx || 0) * dir, (f.y ?? 0) + (spec.dy || 0), { lab: f.lab, dir, ...(spec.opts || {}) });
    else vfx.spawn("lab_charge", (f.x ?? 0) + dir * 50, (f.y ?? 0) - 120, { lab: f.lab, dir });
  });

  on("super", (e) => {
    const f = e.fighter || {};
    vfx.spawn("super_freeze", (f.x ?? 640) + sign(f.facing) * 30, (f.y ?? 600) - 140, {
      lab: f.lab,
      portrait: e.portrait || f.portrait,
      drawPortrait: e.drawPortrait,
      side: e.side,
    });
  });

  on("animFrame", (e) => e.fighter && router.onFrame(e.fighter, e.anim, e.frame, e.animData));
  on("animState", (e) => e.fighter && router.onState(e.fighter, e.prev, e.next, e.animData));

  return () => off.forEach((fn) => fn());
}
