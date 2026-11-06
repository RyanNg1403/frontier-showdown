import { registerSystem } from "../mechanics.js";
import { BTN } from "../constants.js";
import { boxesOverlap, contactProps, currentMove, fireOnce } from "./core.js";

/**
 * Companion object with a delayed strike (Mustafa's Copilot orb).
 *
 * Move data: `mech: { companion: { distance, height, travel, delay, strikes, strikeGap, box, hit, look } }`.
 * On the move's first active frame the owner's companion floats `distance` px ahead to
 * `height`, then strikes `delay` frames after launch with `hit` over `box` (`{ w, h }` around
 * the orb, reaching down toward the floor), `strikes` times `strikeGap` frames apart. Using
 * the move again while the companion is out makes it strike at once instead of sending a new one.
 *
 * Easter egg: pressing LP 12 times during a round's intro gives the companion its paperclip
 * skin for that round (`skin: "paperclip"` in the snapshot).
 */
export const companionModule = {
  name: "companion",

  reset(ctx) {
    ctx.state.introPresses = [0, 0];
    ctx.state.skins = [null, null];
  },

  preStep(ctx) {
    const match = ctx.match;
    if (match.phase !== "intro") return;
    for (const s of match.sides) {
      if (!(s.input.current.pressed & BTN.LP)) continue;
      ctx.state.introPresses[s.side] += 1;
      const point = match.point(s.side);
      if (ctx.state.introPresses[s.side] === 12 && point.def.specials.some((sp) => sp.mech?.companion)) {
        ctx.state.skins[s.side] = "paperclip";
        ctx.effect("paperclip", point.x, point.y - 210, { side: s.side, life: 150, text: "It looks like you're trying to block!" });
        match.emit("easterEgg", { side: s.side, fighter: point.id, id: "paperclip" });
      }
    }
  },

  update(ctx) {
    const match = ctx.match;
    for (const f of match.allFighters) {
      const m = currentMove(f);
      const spec = m?.mech?.companion;
      if (!spec || f.moveFrame < m.startup || !fireOnce(f, "companion")) continue;
      const out = ctx.objects.find((o) => !o.dead && o.type === "companion" && o.ownerUid === f.uid);
      if (out) {
        if (out.strikesLeft > 0 && out.timer > 0) out.timer = 0;
        continue;
      }
      const from = { x: f.x + f.facing * 40, y: f.y - 150 };
      const { left, right } = match.bounds;
      const toX = Math.max(left + 40, Math.min(right - 40, f.x + f.facing * (spec.distance ?? 200)));
      ctx.addObject({
        type: "companion",
        look: spec.look || "orb",
        owner: f,
        ownerUid: f.uid,
        ownerId: f.id,
        side: f.side,
        facing: f.facing,
        x: from.x,
        y: from.y,
        from,
        to: { x: toX, y: spec.height ?? -130 },
        travel: spec.travel ?? 18,
        timer: spec.delay ?? 40,
        strikesLeft: spec.strikes ?? 1,
        strikeGap: spec.strikeGap ?? 14,
        strikeFlash: 0,
        w: spec.box?.w ?? 120,
        h: spec.box?.h ?? 170,
        life: 600,
        maxLife: 600,
        spec,
      });
      match.emit("companion", { fighter: f.id, side: f.side, x: toX });
    }
    for (const o of ctx.objects) {
      if (o.dead || o.type !== "companion" || o.born === match.frame) continue;
      o.age += 1;
      if (o.strikeFlash > 0) o.strikeFlash -= 1;
      if (o.returning) {
        if (o.strikeFlash > 0) continue;
        const home = { x: o.owner.x - o.owner.facing * 30, y: o.owner.y - 170 };
        o.x += (home.x - o.x) * 0.25;
        o.y += (home.y - o.y) * 0.25;
        if (Math.abs(home.x - o.x) < 10 && Math.abs(home.y - o.y) < 10) o.dead = true;
        continue;
      }
      const t = Math.min(1, o.age / o.travel);
      const e = 1 - (1 - t) * (1 - t);
      o.x = o.from.x + (o.to.x - o.from.x) * e;
      o.y = o.from.y + (o.to.y - o.from.y) * e + (t >= 1 ? Math.sin(o.age / 7) * 4 : 0);
      if (match.phase !== "fight") continue;
      o.timer -= 1;
      if (o.timer > 0) continue;
      strike(ctx, o);
      o.strikesLeft -= 1;
      if (o.strikesLeft > 0) o.timer = o.strikeGap;
      else o.returning = true;
    }
  },

  snapshot(ctx, out) {
    out.skins = [...(ctx.state.skins || [null, null])];
  },
};

function strike(ctx, o) {
  const match = ctx.match;
  o.strikeFlash = 10;
  const top = o.y - 50;
  const box = { x: o.x - o.w / 2, y: top, w: o.w, h: Math.max(60, Math.min(o.h, -10 - top)) };
  o.lastBox = box;
  o.strikeFrom = { x: o.x, y: o.y };
  ctx.effect("companion_strike", o.x, o.y, { side: o.side, life: 16, look: o.look, box, palette: o.owner.def.palette });
  match.emit("companionStrike", { fighter: o.ownerId, side: o.side, x: o.x });
  const hit = o.spec.hit || {};
  for (const d of match.fighters) {
    if (d.side === o.side || d.invulnTo("projectile")) continue;
    const hurt = d.hurtboxes().find((b) => boxesOverlap(b, box));
    if (!hurt) continue;
    const dir = Math.sign(d.x - o.x) || o.facing;
    const props = contactProps("copilot_strike", { damage: hit.damage ?? 50, hitstun: hit.hitstun ?? 22, blockstun: hit.blockstun ?? 16, knockback: hit.knockback || { x: 200 }, level: hit.level || "mid", chip: hit.chip ?? 6 });
    props.damage *= o.owner.damageMul ?? 1;
    match.applyContact(o.owner, d, props, { x: d.x, y: Math.max(hurt.y + 10, o.y + 20) }, { projectile: { x: o.x, vx: 0 }, dir });
  }
}

registerSystem("companion", companionModule, { order: 60 });
