import { anyOverlap, intersectionCenter, toWorld } from "../boxes.js";
import { registerMechanic } from "../mechanics.js";
import { fireOnce } from "./core.js";
import { bodyCenter, enemiesOf, propsFor, strikeFrom } from "./targeting.js";

/**
 * Delayed strikes: an entity whose hitbox lands some frames after it is created, independent of
 * the fighter who made it.
 * - Noam's "Residual" uppercut: `mechanic: "echo"`, `mechanicData: { delay, damage, hitstun,
 *   knockback, juggle, box }` repeats the move's hitbox (or `box`) `delay` frames after the move
 *   becomes active.
 * - Chris's Scale Up Circuit Trace schedules a `rabbit` that follows a Marked target and strikes
 *   `delay` frames later (see `path-strike.js`).
 */
export function scheduleStrike(match, spec) {
  return match.spawnEntity({
    kind: spec.kind,
    side: spec.side,
    fireAt: match.frame + spec.delay,
    born: match.frame,
    fired: false,
    flash: 0,
    ...spec,
    update(m) {
      if (this.fired) return --this.flash > 0;
      if (this.follow && m.frame < this.fireAt - 6) {
        const t = m.allFighters.find((x) => x.uid === this.follow);
        if (t) {
          const c = bodyCenter(t);
          this.box = { x: c.x - this.box.w / 2, y: Math.min(c.y + 60, 0) - this.box.h, w: this.box.w, h: this.box.h };
        }
      }
      if (m.frame < this.fireAt) return true;
      this.fired = true;
      this.flash = 10;
      if (m.phase !== "fight") return true;
      const cx = this.box.x + this.box.w / 2;
      for (const d of enemiesOf(m, this.side)) {
        if (d.invulnTo("strike")) continue;
        const pair = anyOverlap([this.box], d.hurtboxes());
        if (!pair) continue;
        strikeFrom(m, this.owner, d, this.props, intersectionCenter(pair[0], pair[1]), { fromX: cx - (Math.sign(d.x - cx) || 1) * 4, move: this.move });
        break;
      }
      return true;
    },
    draw(ctx) {
      ctx.save();
      if (this.kind === "rabbit") {
        const k = Math.min(1, (match.frame - this.born) / Math.max(1, this.fireAt - this.born));
        const tx = this.box.x + this.box.w / 2;
        const x = this.x0 + (tx - this.x0) * k;
        const y = this.y0 - Math.abs(Math.sin(k * Math.PI * 4)) * 40 + (this.box.y + this.box.h - 20 - this.y0) * k;
        ctx.fillStyle = this.fired ? "#ffffff" : "#e8562a";
        ctx.beginPath();
        ctx.ellipse(x, y, 10, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(x - 5, y - 20, 3, 12);
        ctx.fillRect(x + 2, y - 20, 3, 12);
      } else {
        ctx.fillStyle = this.fired ? "rgba(255,255,255,0.5)" : "rgba(255,225,77,0.25)";
        ctx.fillRect(this.box.x, this.box.y, this.box.w, this.box.h);
      }
      ctx.restore();
    },
  });
}

registerMechanic("echo", {
  onFrame(f, move, env) {
    const cfg = move.mechanicData;
    if (!move.hitbox || f.moveFrame < move.startup || !fireOnce(f, "echo")) return;
    const { box, delay = 10, ...hit } = cfg;
    scheduleStrike(env.match, {
      kind: "echo", owner: f, side: f.side, move, delay,
      box: toWorld(box || move.hitbox, f.x, f.y, f.facing),
      props: propsFor(`${move.id}_echo`, { hitstun: 20, blockstun: 14, level: move.level, juggle: 1, ...hit }, move.category),
    });
  },
});
