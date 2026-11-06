import { fighterData, fireOnce } from "../core.js";
import { registerSystem } from "../../mechanics.js";

/**
 * Effects a move applies when it connects, read from `mech` on the move (strikes) or on
 * `projectile.mech` (projectiles). Statuses go through the registry's `ctx.addStatus`, so
 * they tick, clear between rounds and appear in the snapshot like the shared ones.
 * - `slowOnContact: { frames, speedMul }` the registry's `slow` status, on hit or block
 *   (Mistral Gust; walking stays allowed, dashing too).
 * - `bind: { frames }` holds the victim in place while in hitstun (AlphaFold).
 * - `pull: { distance }` drags the victim toward the attacker (Magnet Link LP, AlphaFold Scale Up).
 * - `reel: { stopAt }` zips the attacker to the victim, then ends the move early (Magnet Link HP).
 * - `reverseAir: true` blows an airborne victim away from the attacker (Mistral Gust Scale Up).
 * - `wallBounce: true` on a command grab: the thrown victim bounces off the wall once, using
 *   the registry's wall-bounce flag (Hand-Delivered DGX Scale Up).
 * - `swapSides: true` on a throw: the victim lands on the other side (Ilya's Seq2Seq).
 */
const PULL_STEP = 22;
const REEL_STEP = 30;

function mechOf(info) {
  return info.projectile ? info.projectile.def?.mech : info.move?.mech;
}

const contactModule = {

  beforeContact(ctx, a, d, props, at, info) {
    const slow = mechOf(info)?.slowOnContact;
    if (slow && !d.assistMode) ctx.addStatus(d, "slow", { frames: slow.frames ?? 90, speedMul: slow.speedMul ?? 0.7, noDash: Boolean(slow.noDash), wind: true });
    return false;
  },

  onHit(ctx, a, d, props, info) {
    const mech = mechOf(info);
    if (!mech || d.assistMode || d.ko) return;
    if (mech.bind) ctx.addStatus(d, "bind", { frames: mech.bind.frames ?? 30 });
    if (mech.pull) ctx.addStatus(d, "pull", { frames: 45, toward: a, remaining: mech.pull.distance ?? 200 });
    if (mech.reel && !info.projectile && a.state === "attack") ctx.addStatus(a, "reel", { frames: 40, target: d, stopAt: mech.reel.stopAt ?? 92, move: a.move });
    if (mech.reverseAir && (d.airborne || d.state === "juggle")) {
      const away = Math.sign(d.x - a.x) || a.facing;
      d.vx = away * Math.max(360, Math.abs(d.vx));
      d.vy = Math.max(d.vy, -200);
    }
  },

  update(ctx) {
    const match = ctx.match;
    for (const f of match.fighters) {
      const grab = f.state === "throwing" ? f.grab : null;
      if (grab?.move?.mech?.swapSides && grab.victim?.grab?.by === f) grab.victim.grab.back = true;
      if (grab?.move?.mech?.wallBounce && grab.victim?.state === "juggle" && fireOnce(f, "grab_wall_bounce")) {
        fighterData(grab.victim).flags.wallBounce = true;
      }
      const st = fighterData(f).status;
      if (st.bind && f.isStunned && f.hitstop === 0) f.vx = 0;
      if (st.pull && f.hitstop === 0) {
        const p = st.pull;
        const gap = Math.abs(p.toward.x - f.x) - 70;
        const step = Math.max(0, Math.min(PULL_STEP, p.remaining, gap));
        if (!f.isStunned || !p.toward.onField || step <= 0) {
          delete st.pull;
        } else {
          f.x += (Math.sign(p.toward.x - f.x) || -f.facing) * step;
          f.vx = 0;
          p.remaining -= step;
        }
      }
      if (st.reel && f.hitstop === 0) {
        const r = st.reel;
        const dx = r.target.x - f.x;
        if (f.state !== "attack" || f.move !== r.move) {
          delete st.reel;
        } else if (Math.abs(dx) <= r.stopAt) {
          f.vx = 0;
          f.moveFrame = Math.max(f.moveFrame, f.move.total - 3);
          delete st.reel;
        } else {
          f.x += Math.sign(dx) * Math.min(REEL_STEP, Math.abs(dx) - r.stopAt);
          f.vx = 0;
        }
      }
    }
  },
};

registerSystem("group-b-contact", contactModule, { order: 114 });
