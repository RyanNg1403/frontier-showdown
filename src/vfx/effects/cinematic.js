import { lerp, easeOut, easeOutCubic, easeIn, burstParticles, stepParticles } from "../util.js";
import { labColors } from "./labs-data.js";

const frame = (fx) => Math.floor(fx.t * 60);

function tint(ctx, vfx, color, alpha, op = "source-over") {
  if (alpha <= 0.01) return;
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = Math.min(1, Math.round(alpha * 10) / 10);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, vfx.viewW, vfx.viewH);
  ctx.globalCompositeOperation = "source-over";
}

// Pixel-stepped horizontal band (avoids anti-aliased canvas paths).
function slantBand(ctx, x, y, w, h, slant, color, step = 4) {
  ctx.fillStyle = color;
  for (let row = 0; row < h; row += step) {
    const off = Math.round(((h - row) / h) * slant / step) * step;
    ctx.fillRect(Math.round(x + off), Math.round(y + row), Math.round(w), step);
  }
}

function drawPortrait(ctx, portrait, x, y, w, h, flip) {
  if (!portrait) return false;
  const img = portrait.image || portrait;
  if (!img || !(img.width || img.naturalWidth)) return false;
  const sx = portrait.sx ?? 0;
  const sy = portrait.sy ?? 0;
  const sw = portrait.sw ?? (img.naturalWidth || img.width);
  const sh = portrait.sh ?? (img.naturalHeight || img.height);
  const scale = Math.max(w / sw, h / sh);
  const dw = Math.round(sw * scale);
  const dh = Math.round(sh * scale);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x + w / 2), Math.round(y + h / 2));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
  return true;
}

function placeholderBust(ctx, x, y, w, h, c) {
  const cx = Math.round(x + w / 2);
  ctx.fillStyle = c[3];
  ctx.fillRect(cx - 44, y + h - 52, 88, 52);
  ctx.fillRect(cx - 26, y + 22, 52, 56);
  ctx.fillStyle = c[1];
  ctx.fillRect(cx - 26, y + 22, 52, 4);
  ctx.fillRect(cx - 44, y + h - 52, 88, 4);
}

export const cinematicEffects = {
  screen_flash: {
    life: 0.1,
    realtime: true,
    init(fx) { fx.life = (fx.opts.frames ?? 4) / 60; },
    screen(fx, ctx, vfx, layer) {
      if (layer !== "front") return;
      tint(ctx, vfx, fx.opts.color || "#fff", (fx.opts.alpha ?? 0.8) * (1 - fx.t / fx.life));
    },
  },

  // Super freeze: darkens the stage (back layer), flashes the caster and runs
  // a slanted portrait banner. opts: { lab | colors, side, portrait, drawPortrait(ctx, rect), freeze }.
  // While it runs `vfx.isFrozen()` is true so the engine holds fighters.
  super_freeze: {
    family: "cinematic",
    label: "Super freeze + portrait",
    life: 1.05,
    realtime: true,
    ignoreFreeze: true,
    freezes: true,
    init(fx, vfx) {
      fx.freezeFor = fx.opts.freeze ?? 0.8;
      fx.life = fx.freezeFor + 0.25;
      fx.colors = labColors(fx.opts);
      fx.side = fx.opts.side || (fx.x < vfx.viewW / 2 ? "left" : "right");
      fx.parts = burstParticles(fx.rand, 16, { x: fx.x, y: fx.y, speed: [60, 220], life: [0.3, 0.7], drag: 2, size: [2, 4], colors: fx.colors.slice(0, 3) });
      vfx.spawn("speed_lines", fx.x, fx.y, { colors: fx.colors, life: fx.freezeFor, layer: "back", count: 22 });
      vfx.shake(3, 8);
    },
    update(fx, dt) { stepParticles(fx.parts, dt); },
    draw(fx, p) {
      const c = fx.colors;
      const k = Math.min(1, fx.t / 0.3);
      if (frame(fx) < 4) p.stamp("impact.flash", fx.x, fx.y, { scale: 1.6 });
      p.ring(fx.x, fx.y, lerp(10, 140, easeOutCubic(k)), c[1], 3, 1 - k);
      p.ring(fx.x, fx.y, lerp(6, 90, easeOutCubic(k)), c[0], 2, 1 - k);
      if (fx.t < fx.freezeFor) {
        const tw = Math.floor(fx.t * 20) % 2;
        p.line(fx.x - 26, fx.y, fx.x + 26, fx.y, c[0], tw ? 3 : 2, 0.9);
        p.line(fx.x, fx.y - 26, fx.x, fx.y + 26, c[0], tw ? 2 : 3, 0.9);
      }
      for (const q of fx.parts) p.dot(q.x, q.y, q.size, q.color, 1 - q.age / q.life);
    },
    screen(fx, ctx, vfx, layer) {
      const f = frame(fx);
      const fadeOut = fx.t > fx.freezeFor ? 1 - (fx.t - fx.freezeFor) / (fx.life - fx.freezeFor) : 1;
      if (layer === "back") {
        tint(ctx, vfx, "#06030c", Math.min(1, f / 6) * 0.74 * fadeOut);
        if (f < 3) tint(ctx, vfx, fx.colors[1], 0.35);
        return;
      }
      // Banner slides in over 7 frames, holds, slides out.
      const inK = easeOutCubic(Math.min(1, fx.t / 0.12));
      const outK = fx.t > fx.freezeFor - 0.1 ? easeIn(Math.min(1, (fx.t - fx.freezeFor + 0.1) / 0.18)) : 0;
      const fromLeft = fx.side === "left";
      const bw = 900;
      const bh = 216;
      const by = 112;
      const slide = (1 - inK + outK) * (bw + 120);
      const bx = fromLeft ? -40 - slide : vfx.viewW - bw + 40 + slide;
      const c = fx.colors;
      slantBand(ctx, bx - 12, by - 8, bw + 24, bh + 16, 80, "#ffffff");
      slantBand(ctx, bx, by, bw, bh, 80, c[3]);
      for (let i = 0; i < 7; i += 1) {
        const yy = by + 14 + i * 30;
        const run = ((fx.t * 1400 + i * 173) % (bw + 200)) - 100;
        ctx.fillStyle = i % 2 ? c[2] : c[1];
        ctx.globalAlpha = 0.5;
        ctx.fillRect(Math.round(fromLeft ? bx + run : bx + bw - run), yy, 120 + i * 14, 4);
      }
      ctx.globalAlpha = 1;
      const slot = { x: bx + (fromLeft ? bw - 400 : 100), y: by, w: 300, h: bh };
      ctx.save();
      ctx.beginPath();
      ctx.rect(slot.x, slot.y, slot.w, slot.h);
      ctx.clip();
      const custom = fx.opts.drawPortrait && fx.opts.drawPortrait(ctx, slot, fx);
      if (!custom && !drawPortrait(ctx, fx.opts.portrait, slot.x, slot.y, slot.w, slot.h, !fromLeft)) placeholderBust(ctx, slot.x, slot.y, slot.w, slot.h, c);
      if (f % 6 < 2) tint(ctx, vfx, "#ffffff", 0.25, "lighter");
      ctx.restore();
      ctx.fillStyle = c[1];
      ctx.fillRect(Math.round(bx), by + bh - 6, bw, 6);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.round(bx), by, bw, 4);
    },
  },

  // KO: white pop, negative flash, letterbox and slow motion.
  ko: {
    family: "cinematic",
    label: "KO flash + slow-mo",
    life: 2.1,
    realtime: true,
    ignoreFreeze: true,
    init(fx, vfx) {
      vfx.slowmo(fx.opts.slow ?? 0.25, fx.opts.slowFor ?? 1.6);
      vfx.shake(12, 22);
      fx.colors = fx.opts.colors || ["#ffffff", "#ffe9a8", "#ffb02e", "#3a1400"];
      fx.parts = burstParticles(fx.rand, 26, { x: fx.x, y: fx.y, speed: [600, 1400], life: [0.2, 0.5], drag: 4, colors: fx.colors.slice(0, 3) });
      vfx.spawn("hit_heavy", fx.x, fx.y, { dir: fx.dir, scale: 1.6, shake: false });
    },
    update(fx, dt) { stepParticles(fx.parts, dt); },
    draw(fx, p) {
      const k = Math.min(1, fx.t / 0.6);
      p.ring(fx.x, fx.y, lerp(20, 520, easeOutCubic(k)), fx.colors[0], 4, 1 - k);
      p.ring(fx.x, fx.y, lerp(10, 360, easeOutCubic(k)), fx.colors[2], 3, 1 - k);
      for (const q of fx.parts) {
        const a = 1 - q.age / q.life;
        p.line(q.x - q.vx * 0.04, q.y - q.vy * 0.04, q.x, q.y, q.color, 3, a);
      }
    },
    screen(fx, ctx, vfx, layer) {
      if (layer !== "front") return;
      const f = frame(fx);
      if (f < 3) tint(ctx, vfx, "#ffffff", 1);
      else if (f < 9) tint(ctx, vfx, "#ffffff", 1, "difference");
      else if (f < 14) tint(ctx, vfx, "#ffffff", 0.5 * (1 - (f - 9) / 5));
      const bars = fx.t < 1.7 ? easeOut(Math.min(1, fx.t / 0.25)) : 1 - (fx.t - 1.7) / 0.4;
      const bh = Math.round((72 * Math.max(0, bars)) / 4) * 4;
      if (bh > 0) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, vfx.viewW, bh);
        ctx.fillRect(0, vfx.viewH - bh, vfx.viewW, bh);
      }
      if (f >= 9 && fx.t < 1.6) {
        const g = ctx.createRadialGradient(vfx.viewW / 2, vfx.viewH / 2, vfx.viewH * 0.35, vfx.viewW / 2, vfx.viewH / 2, vfx.viewH * 0.9);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(10,4,20,0.55)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, vfx.viewW, vfx.viewH);
      }
    },
  },

  // Tag-in: light pillar at the entry point, swap streaks from the screen edge.
  // x is the partner's feet. opts: { lab | colors, side: "left"|"right" (entry edge) }.
  tag_in: {
    family: "cinematic",
    label: "Tag-in swap",
    life: 0.85,
    init(fx, vfx) {
      fx.colors = labColors(fx.opts);
      fx.side = fx.opts.side || (fx.dir > 0 ? "left" : "right");
      fx.parts = burstParticles(fx.rand, 18, { x: fx.x, y: fx.y - 10, angle: -Math.PI / 2, spread: 1.2, speed: [120, 420], life: [0.3, 0.7], drag: 2, size: [2, 4], colors: fx.colors.slice(0, 3), jitter: 50 });
      fx.streaks = Array.from({ length: 7 }, (_, i) => ({ y: fx.y - 30 - i * 26 - fx.rand() * 10, d: fx.rand() * 0.08, w: 2 + (i % 3) }));
      vfx.spawn("dust_land", fx.x, fx.y, { delay: 0.18, shake: false });
      vfx.shake(3, 6);
    },
    update(fx, dt) { stepParticles(fx.parts, dt); },
    draw(fx, p, vfx) {
      const c = fx.colors;
      const k = fx.t / fx.life;
      const edge = fx.side === "left" ? -60 : vfx.viewW + 60;
      for (const s of fx.streaks) {
        const u = Math.min(1, Math.max(0, (fx.t - s.d) / 0.18));
        const head = lerp(edge, fx.x, easeOutCubic(u));
        const tail = lerp(edge, head, Math.min(1, u * 0.6 + Math.max(0, fx.t - 0.2) * 3));
        p.line(tail, s.y, head, s.y, s.w > 3 ? c[0] : c[1], s.w, 1 - k);
      }
      const pk = Math.min(1, fx.t / 0.12);
      const pw = lerp(130, 16, easeOutCubic(Math.min(1, fx.t / 0.6)));
      const top = fx.y - lerp(0, 520, easeOutCubic(pk));
      if (fx.t < 0.65) {
        p.rect(fx.x - pw / 2, top, pw, fx.y - top, c[2], 0.8 * (1 - k));
        p.rect(fx.x - pw / 5, top, Math.max(6, pw / 2.5), fx.y - top, c[0], 1 - k);
        p.rect(fx.x - pw, top, pw * 2, fx.y - top, c[3], 0.35 * (1 - k));
      }
      p.ring(fx.x, fx.y, lerp(20, 140, easeOutCubic(k)), c[1], 3, 1 - k, "add", 0.25);
      p.ring(fx.x, fx.y, lerp(10, 90, easeOutCubic(k)), c[0], 2, 1 - k, "add", 0.25);
      for (const q of fx.parts) p.dot(q.x, q.y, q.size, q.color, 1 - q.age / q.life);
    },
  },

  // Outgoing partner: pillar collapses upward and streaks leave toward the edge.
  tag_out: {
    family: "cinematic",
    label: "Tag-out exit",
    life: 0.55,
    init(fx) {
      fx.colors = labColors(fx.opts);
      fx.side = fx.opts.side || (fx.dir > 0 ? "right" : "left");
    },
    draw(fx, p, vfx) {
      const c = fx.colors;
      const k = fx.t / fx.life;
      const edge = fx.side === "left" ? -60 : vfx.viewW + 60;
      for (let i = 0; i < 6; i += 1) {
        const y = fx.y - 30 - i * 28;
        const head = lerp(fx.x, edge, easeIn(Math.min(1, k * 1.6 + i * 0.03)));
        p.line(lerp(fx.x, head, 0.4), y, head, y, i % 2 ? c[1] : c[0], 3, 1 - k);
      }
      const bottom = fx.y - lerp(0, 420, easeIn(k));
      p.rect(fx.x - 16, bottom - 300, 32, 300 * (1 - k), c[1], 1 - k);
      p.rect(fx.x - 5, bottom - 300, 10, 300 * (1 - k), c[0], 1 - k);
    },
  },
};

