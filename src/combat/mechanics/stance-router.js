import { BTN } from "../constants.js";
import { registerMechanic, registerSystem } from "../mechanics.js";
import { normalizeMove } from "../../characters/schema.js";

/**
 * Four-way stance router (Noam's Mixture of Experts): a fighter mechanic plus the router move.
 *
 * Character: `mechanics: ["stance-router"]`. Router special: `mechanic: "stance-router"`,
 * `mechanicData: { open, lockDelay, step, top2, order: [...], experts: { striker: { hp: {...move}, hk: {...move} }, ... } }`.
 *
 * When the router opens (move frame `open`) the highlighted expert moves one step (`step`: +1
 * for the LK version, -1 for HK). Every further LK / HK press during the move cycles again, and
 * the choice locks in `lockDelay` frames after the last press, which ends the move early. While
 * an expert is active, starting its button's base normal (`hp` or `hk`) runs the expert's
 * normal instead (swapped in `onMoveStart`). Scale Up (`top2`) also activates the next expert in
 * the order for that many frames, filling any button the first one leaves on its base normal.
 * The choice lasts until changed, a tag-out or the end of the round.
 */
const normalized = new WeakMap();
function expertMove(raw) {
  let m = normalized.get(raw);
  if (!m) normalized.set(raw, (m = Object.freeze(normalizeMove(raw.id, raw, "normal", { anim: raw.anim }))));
  return m;
}

function routerOf(f) {
  return f.def.specials.find((s) => s.mechanic === "stance-router")?.mechanicData || null;
}

function stateOf(f) {
  return (f.mech.router ??= { stance: null, second: null, menu: null, top2Until: 0 });
}

export function stanceOf(f) {
  return f.mech?.router?.stance ?? null;
}

/** Expert normals currently replacing the base ones, keyed by base move id. */
export function stanceNormals(f) {
  const table = routerOf(f);
  const st = f.mech?.router;
  if (!table || !st) return {};
  const out = {};
  for (const name of [st.stance, st.second]) {
    for (const [key, raw] of Object.entries(table.experts[name] || {})) out[key] ??= expertMove(raw);
  }
  return out;
}

registerMechanic("stance-router", {
  init(f) {
    f.mech.router = { stance: null, second: null, menu: null, top2Until: 0 };
  },

  update(f, env) {
    const st = stateOf(f);
    if (st.menu && !(f.state === "attack" && f.move?.mechanic === "stance-router")) st.menu = null;
    if (st.second && env.frame >= st.top2Until) {
      st.second = null;
      env.emit("stance", { fighter: f.id, side: f.side, stance: st.stance, second: null });
    }
  },

  onMoveStart(f, move) {
    if (move.category !== "normal") return;
    const alt = stanceNormals(f)[move.id];
    if (!alt) return;
    f.move = alt;
    f.anim = { name: alt.anim, t: 0 };
  },

  onFrame(f, move, env) {
    const cfg = move.mechanicData;
    const order = cfg.order;
    const st = stateOf(f);
    if (f.moveFrame === cfg.open) {
      const cur = order.indexOf(st.stance);
      const step = cfg.step ?? 1;
      const from = cur < 0 ? (step > 0 ? -1 : 0) : cur;
      st.menu = { highlight: (from + step + order.length) % order.length, lockAt: f.moveFrame + (cfg.lockDelay ?? 8), top2: cfg.top2 ?? 0 };
    }
    if (!st.menu || f.moveFrame < cfg.open) return;
    const press = env.input?.findPress(BTN.LK | BTN.HK, 1);
    if (press) {
      env.input.consume();
      st.menu.highlight = (st.menu.highlight + (press.entry.pressed & BTN.LK ? 1 : -1) + order.length) % order.length;
      st.menu.lockAt = f.moveFrame + (cfg.lockDelay ?? 8);
    }
    const last = move.startup + move.active - 1;
    if (f.moveFrame < st.menu.lockAt && f.moveFrame < last) return;
    st.stance = order[st.menu.highlight];
    st.second = st.menu.top2 ? order[(st.menu.highlight + 1) % order.length] : null;
    st.top2Until = env.frame + st.menu.top2;
    st.menu = null;
    f.moveFrame = Math.max(f.moveFrame, last);
    env.emit("stance", { fighter: f.id, side: f.side, stance: st.stance, second: st.second });
    env.vfx("special_cast", f.x, f.y - 150, { characterId: f.id, moveId: `${move.id}_${st.stance}`, vfx: move.vfx, palette: f.def.palette });
  },
});

registerSystem("stance-router", {
  snapshot(ctx, out) {
    out.stances = ctx.match.allFighters
      .filter((f) => routerOf(f))
      .map((f) => {
        const st = f.mech?.router;
        return { fighter: f.id, side: f.side, stance: st?.stance ?? "router", second: st?.second ?? null, menu: st?.menu ? routerOf(f).order[st.menu.highlight] : null };
      });
  },
}, { order: 120 });
