import { registerSystem } from "../mechanics.js";
import { currentMove, fighterData, fireOnce } from "./core.js";

/**
 * Timed statuses on fighters.
 *
 * Move data: `mech: { status: { <name>: { frames, ...params } } }` applies the status to the
 * user on the move's first active frame.
 *
 * - `stance` (Vibe Coding): `{ frames, damage, noBlock, chainNormals, whiffCancel, breakOnHit }`.
 *   While it lasts the fighter cannot hold-block (Alignment Block still works), chains any
 *   normal into any other on contact, cancels normals into specials on whiff and deals
 *   `damage` times more. Being hit ends it when `breakOnHit` is set.
 * - `slow` (icing, applied by traps): `{ frames, speedMul, noDash }`.
 */
export const statusModule = {
  name: "status",

  update(ctx) {
    for (const f of ctx.match.allFighters) {
      const m = currentMove(f);
      const spec = m?.mech?.status;
      if (!spec || f.moveFrame < m.startup || !fireOnce(f, "status")) continue;
      for (const [name, params] of Object.entries(spec)) {
        ctx.addStatus(f, name, params);
        ctx.effect(`status_${name}`, f.x, f.y - 120, { side: f.side, fighter: f.id, life: 30 });
      }
    }
  },

  preStep(ctx) {
    for (const f of ctx.match.allFighters) {
      const st = fighterData(f).status;
      for (const [name, s] of Object.entries(st)) {
        if (f.hitstop > 0 && name === "slow") continue;
        s.frames -= 1;
        if (s.frames <= 0) delete st[name];
      }
    }
  },

  modsFor(ctx, f) {
    const st = fighterData(f).status;
    const out = [];
    if (st.stance) {
      out.push({
        noBlock: st.stance.noBlock !== false,
        chainNormals: st.stance.chainNormals !== false,
        whiffCancel: st.stance.whiffCancel !== false,
      });
    }
    if (st.slow) out.push({ speedMul: st.slow.speedMul ?? 0.5, noDash: st.slow.noDash !== false });
    return out;
  },

  beforeContact(ctx, a, d, props) {
    const stance = fighterData(a).status.stance;
    if (stance?.damage && stance.damage !== 1) props.damage *= stance.damage;
    return false;
  },

  onHit(ctx, a, d) {
    const st = fighterData(d).status;
    if (st.stance?.breakOnHit !== false && st.stance) {
      delete st.stance;
      ctx.effect("status_break", d.x, d.y - 140, { side: d.side, fighter: d.id, life: 24 });
    }
  },

  snapshot(ctx, out) {
    out.statuses = ctx.match.fighters
      .map((f) => {
        const st = fighterData(f).status;
        const entry = { fighter: f.id, side: f.side };
        for (const [name, s] of Object.entries(st)) entry[name] = s.frames;
        return entry;
      })
      .filter((e) => Object.keys(e).length > 2);
  },
};

registerSystem("status", statusModule, { order: 20 });
