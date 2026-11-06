import { lerp, easeOutCubic, TAU } from "../util.js";
import { labColors } from "./labs-data.js";

// A sprite reference: { image, sx, sy, sw, sh, anchorX, anchorY, scale?, flip?, x?, y? }.
// `x/y` (world, feet anchor) override the spawn position when present.
function resolveSprite(fx) {
  const src = fx.opts.sprite;
  return typeof src === "function" ? src() : src;
}

const tintCache = new WeakMap();

function tinted(spr, color) {
  let byImage = tintCache.get(spr.image);
  if (!byImage) {
    byImage = new Map();
    tintCache.set(spr.image, byImage);
  }
  const key = `${spr.sx},${spr.sy},${spr.sw},${spr.sh},${color}`;
  let c = byImage.get(key);
  if (!c) {
    c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(spr.sw, spr.sh) : Object.assign(document.createElement("canvas"), { width: spr.sw, height: spr.sh });
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.drawImage(spr.image, spr.sx, spr.sy, spr.sw, spr.sh, 0, 0, spr.sw, spr.sh);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = color;
    g.fillRect(0, 0, spr.sw, spr.sh);
    if (byImage.size > 256) byImage.clear();
    byImage.set(key, c);
  }
  return c;
}

function drawSilhouette(ctx, cam, spr, x, y, color, alpha, blend = "lighter") {
  if (!spr || !spr.image || alpha <= 0) return;
  const s = (spr.scale ?? 1) * cam.zoom;
  ctx.globalAlpha = Math.round(alpha * 4) / 4;
  ctx.globalCompositeOperation = blend;
  ctx.translate(Math.round((x - cam.x) * cam.zoom), Math.round((y - cam.y) * cam.zoom));
  ctx.scale(spr.flip ? -s : s, s);
  ctx.drawImage(tinted(spr, color), -(spr.anchorX ?? spr.sw / 2), -(spr.anchorY ?? spr.sh));
}

export const motionEffects = {
  afterimage: {
    family: "motion",
    label: "Afterimage",
    life: 0.32,
    layer: "back",
    init(fx) {
      const spr = resolveSprite(fx);
      fx.sprite = spr ? { ...spr } : null;
      if (spr && spr.x !== undefined) {
        fx.x = spr.x;
        fx.y = spr.y;
      }
      fx.color = fx.opts.color || labColors(fx.opts)[2];
    },
    direct(fx, ctx, cam) {
      const k = fx.t / fx.life;
      drawSilhouette(ctx, cam, fx.sprite, fx.x + (fx.opts.drift || 0) * k, fx.y, fx.color, (fx.opts.alpha ?? 0.75) * (1 - k));
    },
  },

  // Emits afterimages from a live sprite source at a fixed cadence.
  afterimage_trail: {
    family: "motion",
    label: "Afterimage trail",
    life: 0.6,
    init(fx) {
      fx.next = 0;
      fx.n = 0;
    },
    update(fx, dt, vfx) {
      if (fx.t < fx.next || fx.t > fx.life - 0.1) return;
      const cols = fx.opts.colors || labColors(fx.opts).slice(1, 3);
      vfx.spawn("afterimage", fx.x, fx.y, { sprite: resolveSprite(fx), color: cols[fx.n % cols.length], life: fx.opts.ghostLife ?? 0.26, alpha: 0.7 });
      fx.n += 1;
      fx.next += fx.opts.interval ?? 0.045;
    },
  },

  // Ribbon that follows a point: opts.follow() -> {x, y} | null.
  motion_trail: {
    family: "motion",
    label: "Motion trail",
    life: 0.7,
    init(fx) {
      fx.pts = [];
      fx.colors = labColors(fx.opts);
    },
    update(fx) {
      const at = fx.opts.follow ? fx.opts.follow(fx.t) : null;
      if (at) fx.pts.unshift({ x: at.x, y: at.y, t: fx.t });
      const keep = fx.opts.length ?? 0.14;
      while (fx.pts.length && fx.t - fx.pts[fx.pts.length - 1].t > keep) fx.pts.pop();
    },
    draw(fx, p) {
      const n = fx.pts.length;
      const w = fx.opts.width ?? 12;
      for (let i = 0; i < n - 1; i += 1) {
        const a = fx.pts[i];
        const b = fx.pts[i + 1];
        const k = i / Math.max(1, n - 1);
        const age = Math.max(0, 1 - (fx.t - a.t) / (fx.opts.length ?? 0.14));
        p.line(a.x, a.y, b.x, b.y, fx.colors[2], Math.max(2, w * (1 - k)), age, "normal");
        p.line(a.x, a.y, b.x, b.y, fx.colors[k < 0.25 ? 0 : 1], Math.max(1, w * 0.4 * (1 - k)), age);
      }
    },
  },

  // Crescent smear for kicks, sweeps and weapon arcs.
  slash_arc: {
    family: "motion",
    label: "Slash arc",
    life: 0.26,
    init(fx) {
      fx.colors = labColors(fx.opts);
    },
    draw(fx, p) {
      const k = fx.t / fx.life;
      const r = fx.opts.radius ?? 90;
      const a0 = fx.opts.from ?? -1.9;
      const a1 = fx.opts.to ?? 0.6;
      const sweep = easeOutCubic(Math.min(1, k * 2.4));
      const head = lerp(a0, a1, sweep);
      const tail = lerp(a0, head, Math.min(1, k * 1.6));
      const steps = 40;
      for (let i = 0; i < steps; i += 1) {
        const u = i / (steps - 1);
        const ang = lerp(tail, head, u);
        const thick = (fx.opts.thickness ?? 16) * Math.sin(u * Math.PI * 0.5 + 0.15) * (1 - k * 0.7);
        const cx = fx.x + Math.cos(ang) * r * fx.dir;
        const cy = fx.y + Math.sin(ang) * r;
        const ix = fx.x + Math.cos(ang) * (r - thick) * fx.dir;
        const iy = fx.y + Math.sin(ang) * (r - thick);
        p.line(ix, iy, cx, cy, u > 0.4 ? fx.colors[1] : fx.colors[2], 4, 1 - k, "normal");
        if (u > 0.85) p.line(ix, iy, cx, cy, fx.colors[0], 3, 1 - k);
      }
      p.dot(fx.x + Math.cos(head) * r * fx.dir, fx.y + Math.sin(head) * r, 6, fx.colors[0], 1 - k);
    },
  },

  speed_lines: {
    life: 0.5,
    init(fx) {
      fx.colors = labColors(fx.opts);
      fx.lines = Array.from({ length: fx.opts.count ?? 18 }, () => ({ ang: fx.rand() * TAU, r0: 80 + fx.rand() * 120, len: 120 + fx.rand() * 260, w: 2 + Math.floor(fx.rand() * 3) }));
    },
    draw(fx, p) {
      const k = fx.t / fx.life;
      const a = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      for (const l of fx.lines) {
        const r0 = l.r0 + ((fx.t * 900 + l.len) % 300);
        const c = Math.cos(l.ang);
        const s = Math.sin(l.ang);
        p.line(fx.x + c * r0, fx.y + s * r0, fx.x + c * (r0 + l.len), fx.y + s * (r0 + l.len), fx.colors[l.w > 3 ? 1 : 2], l.w, a * 0.8);
      }
    },
  },
};
