import { registerMechanic, registerSystem } from "../mechanics.js";
import { bodyCenter, constructsOf, enemiesOf, propsFor, segmentHit, strikeFrom } from "./targeting.js";

/**
 * Tracking beam (Noam's Attention Is All You Need, and his super), a move mechanic.
 *
 * Move data: `mechanic: "tracking-beam"`, `mechanicData: { lockFrame, duration, hits, interval,
 * damage, chip, hitstun, blockstun, knockback, trackSpeed, thickness, range, origin: {x, y},
 * heads: [dy...], lastHit, stamp }`. On `lockFrame` the aim locks onto the opponent's body; for
 * `duration` frames it chases them at up to `trackSpeed` px per frame, and every `interval`
 * frames the beam can hit (up to `hits` times). `heads` adds beams from ghost heads offset
 * vertically (Scale Up "Multi-Head") sharing one hit counter. Enemy barriers and Marble wall
 * fields cut it short. The live beam is `fighter.mech.beam` while `activeBeam(fighter)`.
 */
function originOf(f, cfg, dy = 0) {
  const o = cfg.origin || { x: 30, y: -168 };
  return { x: f.x + f.facing * o.x, y: f.y + o.y + dy };
}

function blockers(match, side) {
  const out = [];
  for (const w of match.barriers) if (w.side !== side && !w.dead) out.push(match.barrierBox(w));
  for (const c of constructsOf(match)) if (c.side !== side && c.wall) out.push(c.fieldBox());
  return out;
}

/** The fighter's beam while its move is in the beam window, else null. */
export function activeBeam(f) {
  const b = f.mech?.beam;
  if (!b || f.state !== "attack" || f.move?.mechanic !== "tracking-beam" || b.token !== f.hitLog) return null;
  return f.moveFrame >= b.start && f.moveFrame <= b.end ? b : null;
}

registerMechanic("tracking-beam", {
  onFrame(f, move, env) {
    const cfg = move.mechanicData;
    const match = env.match;
    const end = cfg.lockFrame + (cfg.duration ?? 24) - 1;
    if (f.moveFrame < cfg.lockFrame || f.moveFrame > end) return;
    const opp = env.opponent;
    let beam = f.mech.beam;
    if (!beam || beam.token !== f.hitLog) {
      const aim = opp ? bodyCenter(opp) : { x: f.x + f.facing * 400, y: f.y - 120 };
      beam = f.mech.beam = { token: f.hitLog, start: cfg.lockFrame, end, tx: aim.x, ty: aim.y, hits: 0, last: -99, heads: cfg.heads || [0], segments: [], super: move.category === "super", cfg };
    } else if (opp) {
      const aim = bodyCenter(opp);
      const dx = aim.x - beam.tx;
      const dy = aim.y - beam.ty;
      const len = Math.hypot(dx, dy);
      const step = cfg.trackSpeed ?? 9;
      beam.tx = len > step ? beam.tx + (dx / len) * step : aim.x;
      beam.ty = len > step ? beam.ty + (dy / len) * step : aim.y;
    }
    const range = cfg.range ?? 900;
    const walls = blockers(match, f.side);
    beam.segments = beam.heads.map((dy) => {
      const o = originOf(f, cfg, dy);
      const len = Math.hypot(beam.tx - o.x, beam.ty - o.y) || 1;
      let ex = o.x + ((beam.tx - o.x) / len) * range;
      let ey = o.y + ((beam.ty - o.y) / len) * range;
      if (ey > 0) {
        const t = -o.y / (ey - o.y);
        ex = o.x + (ex - o.x) * t;
        ey = 0;
      }
      const cut = segmentHit(o.x, o.y, ex, ey, 6, walls);
      return cut ? { x0: o.x, y0: o.y, x1: cut.x, y1: cut.y } : { x0: o.x, y0: o.y, x1: ex, y1: ey };
    });
    const live = match.phase === "fight" || (match.phase === "finish" && match.finishSide === f.side);
    const maxHits = cfg.hits ?? 5;
    if (!live || beam.hits >= maxHits || f.moveFrame - beam.last < (cfg.interval ?? 5)) return;
    for (const d of enemiesOf(match, f.side)) {
      if (d.invulnTo("projectile")) continue;
      const boxes = d.hurtboxes();
      let at = null;
      for (const s of beam.segments) if ((at = segmentHit(s.x0, s.y0, s.x1, s.y1, cfg.thickness ?? 14, boxes))) break;
      if (!at) continue;
      beam.hits += 1;
      beam.last = f.moveFrame;
      const final = beam.hits >= maxHits && cfg.lastHit;
      const props = propsFor(move.id, {
        damage: cfg.damage ?? 14, chip: cfg.chip, hitstun: cfg.hitstun ?? 14, blockstun: cfg.blockstun ?? 10,
        knockback: final ? cfg.lastHit.knockback : cfg.knockback || { x: 60 }, knockdown: final ? cfg.lastHit.knockdown : false,
        level: cfg.level || "mid", juggle: beam.hits === 1 ? 2 : 0, hitstop: cfg.hitstop ?? 5, meterGain: move.category === "super" ? 0 : 2,
      }, move.category);
      strikeFrom(match, f, d, props, at, { fromX: beam.segments[0].x0, move });
      break;
    }
  },
});

registerSystem("tracking-beam", {
  snapshot(ctx, out) {
    out.beams = ctx.match.fighters.map((f) => [f, activeBeam(f)]).filter(([, b]) => b)
      .map(([f, b]) => ({ side: f.side, owner: f.id, moveId: f.move.id, hits: b.hits, segments: b.segments.map((s) => ({ ...s })) }));
  },
}, { order: 120 });
