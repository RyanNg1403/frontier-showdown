import { matchMotion, parseMotion } from "../../input.js";
import { registerSystem } from "../../mechanics.js";
import { contactProps, currentMove, fireOnce } from "../core.js";
import { drawObjectEntity } from "./draw.js";
import { burst, clampX, controlInput, enemiesOf, objectsOf, selfControlled } from "./util.js";

/**
 * Placed floor mines with remote detonation (Demis's Move 37).
 *
 * Move data: `mech: { stones: { offset, lifetime, max, armDelay, assistArmDelay, radius,
 * burstRadius, hit: {damage, chip, hitstun, blockstun, knockback, level}, invisible, detonate } }`.
 * On the move's startup frame a stone lands `offset` px ahead (an assist drops it under the
 * opponent). Armed stones burst when a grounded enemy stands on them; the owner's `detonate`
 * motion bursts all of them. Placing past `max` removes the oldest.
 */
function explode(ctx, s) {
  const match = ctx.match;
  s.dead = true;
  const r = s.spec.burstRadius ?? 70;
  const props = contactProps(s.moveId, { ...s.spec.hit, damage: (s.spec.hit?.damage ?? 60) * s.damageMul, juggle: 2, meterGain: 6 });
  burst(match, s.owner, s.side, { x: s.x - r, y: -170, w: r * 2, h: 170 }, props, s.x);
  ctx.effect("stone_burst", s.x, -20, { side: s.side, life: 24, palette: s.owner.def.palette });
  match.vfx("hit_special", s.x, -40, { facing: s.owner.facing, side: s.side, palette: s.owner.def.palette });
}

export function stonesOf(match, owner) {
  return objectsOf(match, "stone", owner);
}

const stonesModule = {

  preStep(ctx) {
    const match = ctx.match;
    if (match.phase !== "fight") return;
    for (const s of match.sides) {
      const f = s.members[s.active];
      const input = controlInput(match, f);
      if (!input || !(selfControlled(f) || f.state === "attack")) continue;
      const sp = f.def.specials.find((x) => x.mech?.stones);
      const mine = sp ? stonesOf(match, f) : [];
      if (!mine.length) continue;
      const detonate = parseMotion(sp.mech.stones.detonate || "D,N,B+P");
      if (matchMotion(input, detonate, f.facing) < 0 || matchMotion(input, sp.motion, f.facing) >= 0) continue;
      input.consume();
      for (const st of mine) explode(ctx, st);
      match.emit("trapDetonate", { fighter: f.id, side: f.side, moveId: sp.id, count: mine.length });
    }
  },

  update(ctx) {
    const match = ctx.match;
    for (const f of match.fighters) {
      const m = currentMove(f);
      const spec = m?.mech?.stones;
      if (!spec || f.moveFrame < m.startup || !fireOnce(f, "stones")) continue;
      const opp = match.point(1 - f.side);
      const x = clampX(match, f.assistMode && opp ? opp.x : f.x + f.facing * (spec.offset ?? 120));
      const mine = stonesOf(match, f);
      while (mine.length >= (spec.max ?? 2)) mine.shift().dead = true;
      const stone = ctx.addObject({
        type: "stone",
        look: spec.invisible ? "stone_hidden" : "stone",
        owner: f,
        ownerUid: f.uid,
        ownerId: f.id,
        side: f.side,
        facing: f.facing,
        moveId: m.id,
        x,
        y: 0,
        w: 28,
        h: 16,
        life: spec.lifetime ?? 300,
        maxLife: spec.lifetime ?? 300,
        armDelay: f.assistMode ? (spec.assistArmDelay ?? 24) : (spec.armDelay ?? 12),
        invisible: Boolean(spec.invisible),
        damageMul: f.damageMul ?? 1,
        spec,
      });
      drawObjectEntity(match, stone);
      match.emit("placed", { fighter: f.id, side: f.side, kind: "stone", x });
    }
    const live = match.phase === "fight";
    for (const s of ctx.objects) {
      if (s.dead || s.type !== "stone" || s.born === match.frame || !live) continue;
      s.age += 1;
      s.life -= 1;
      if (s.life <= 0) {
        s.dead = true;
        ctx.effect("placed_fade", s.x, -20, { side: s.side, life: 16, look: s.look });
        continue;
      }
      if (s.age < s.armDelay) continue;
      const r = s.spec.radius ?? 34;
      if (enemiesOf(match, s.side).some((d) => d.y > -12 && !d.invulnTo("projectile") && Math.abs(d.x - s.x) <= r)) explode(ctx, s);
    }
  },
};

registerSystem("group-b-stones", stonesModule, { order: 110 });
