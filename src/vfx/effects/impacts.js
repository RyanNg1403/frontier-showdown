import { TAU, burstParticles, stepParticles, lerp, easeOut, easeOutCubic, mulberry32 } from "../util.js";

const PAL = {
  light: ["#fffbe6", "#ffd84a", "#ff9a1f"],
  heavy: ["#ffffff", "#ffb02e", "#ff6a1a", "#c2410c"],
  counter: ["#ffffff", "#ff4fd8", "#40e8ff", "#8a2be2"],
  block: ["#e8f8ff", "#6ad2ff", "#2a7bff"],
  tech: ["#ffffff", "#fff2a8", "#9ad8ff"],
  guard: ["#fff6d0", "#ffc23a", "#e0502a", "#6ad2ff"],
  breaker: ["#ffffff", "#d6a8ff", "#9a4dff", "#4a1fb8"],
};

const frame = (fx) => Math.floor(fx.t * 60);
const fade = (fx, from = 0.5) => {
  const k = fx.t / fx.life;
  return k < from ? 1 : 1 - (k - from) / (1 - from);
};

function timing(fx, vfx, shake, frames) {
  const o = fx.opts;
  if (o.shake !== false) vfx.shake((o.shakeScale ?? 1) * shake, frames);
  if (o.hitstop) vfx.hitstop(o.hitstop);
}

function drawStreaks(p, parts, width, headColor, tailScale = 0.035) {
  for (const q of parts) {
    const a = 1 - q.age / q.life;
    p.line(q.x - q.vx * tailScale, q.y - q.vy * tailScale, q.x, q.y, q.color, width, a);
    p.dot(q.x, q.y, width + 1, headColor, a);
  }
}

function drawEmbers(p, parts) {
  for (const q of parts) {
    const a = 1 - q.age / q.life;
    p.dot(q.x, q.y, q.size, q.color, a > 0.5 ? 1 : a * 2);
  }
}

function drawShards(p, parts, blend = "add") {
  for (const q of parts) {
    const a = 1 - q.age / q.life;
    const ang = q.seed * TAU + q.age * 14 * (q.seed > 0.5 ? 1 : -1);
    const len = q.size * 2.2;
    p.line(q.x - Math.cos(ang) * len, q.y - Math.sin(ang) * len, q.x + Math.cos(ang) * len, q.y + Math.sin(ang) * len, q.color, 2, a, blend);
  }
}

function screenTint(ctx, vfx, color, alpha) {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = Math.round(alpha * 8) / 8;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, vfx.viewW, vfx.viewH);
}

export const impactEffects = {
  hit_light: {
    family: "hits",
    label: "Hit spark: light",
    life: 0.2,
    init(fx, vfx) {
      const s = fx.opts.scale ?? 1;
      fx.parts = burstParticles(fx.rand, 6, {
        x: fx.x, y: fx.y, angle: fx.dir > 0 ? 0 : Math.PI, spread: 2.2,
        speed: [280 * s, 520 * s], life: [0.08, 0.16], drag: 7, colors: [PAL.light[1], PAL.light[2]],
      });
      timing(fx, vfx, 2, 5);
    },
    update(fx, dt) { stepParticles(fx.parts, dt); },
    draw(fx, p) {
      const f = frame(fx);
      const s = fx.opts.scale ?? 1;
      if (f < 2) {
        p.disc(fx.x, fx.y, 6 * s, PAL.light[0]);
        p.stamp("impact.flash", fx.x, fx.y, { scale: 0.55 * s });
      }
      p.stamp("impact.star", fx.x, fx.y, {
        scale: s * lerp(0.7, 0.9, easeOut(Math.min(1, fx.t / 0.08))),
        rot: Math.floor(f / 3) % 2 ? Math.PI / 4 : 0,
        alpha: fade(fx, 0.45),
      });
      drawStreaks(p, fx.parts, 2, PAL.light[0]);
    },
  },

  hit_heavy: {
    family: "hits",
    label: "Hit spark: heavy",
    life: 0.32,
    init(fx, vfx) {
      const s = fx.opts.scale ?? 1;
      const ang = fx.dir > 0 ? 0 : Math.PI;
      fx.parts = burstParticles(fx.rand, 12, {
        x: fx.x, y: fx.y, angle: ang, spread: 2.6, speed: [420 * s, 820 * s],
        life: [0.1, 0.22], drag: 6, colors: [PAL.heavy[1], PAL.heavy[2]],
      });
      fx.embers = burstParticles(fx.rand, 10, {
        x: fx.x, y: fx.y, angle: ang - 0.4 * fx.dir, spread: 2.4, speed: [160, 420],
        life: [0.22, 0.38], gravity: 900, drag: 2, size: [2, 4], colors: PAL.heavy.slice(1),
      });
      timing(fx, vfx, 6, 10);
    },
    update(fx, dt) {
      stepParticles(fx.parts, dt);
      stepParticles(fx.embers, dt);
    },
    draw(fx, p) {
      const f = frame(fx);
      const s = fx.opts.scale ?? 1;
      const k = fx.t / fx.life;
      if (f < 3) {
        p.disc(fx.x, fx.y, 12 * s, PAL.heavy[0]);
        p.stamp("impact.flash", fx.x, fx.y, { scale: 0.75 * s });
      }
      p.ring(fx.x, fx.y, lerp(18, 96, easeOutCubic(k)) * s, PAL.heavy[1], 3, 1 - k);
      p.stamp("impact.burst", fx.x, fx.y, {
        scale: s * lerp(0.85, 1.15, easeOut(Math.min(1, fx.t / 0.1))),
        rot: Math.floor(f / 4) % 2 ? Math.PI / 8 : 0,
        alpha: fade(fx, 0.4),
        flipX: fx.dir < 0,
      });
      drawStreaks(p, fx.parts, 3, PAL.heavy[0]);
      drawEmbers(p, fx.embers);
    },
  },

  hit_counter: {
    family: "hits",
    label: "Hit spark: counter",
    life: 0.42,
    init(fx, vfx) {
      const s = fx.opts.scale ?? 1;
      const ang = fx.dir > 0 ? 0 : Math.PI;
      fx.parts = burstParticles(fx.rand, 10, {
        x: fx.x, y: fx.y, angle: ang, spread: 2.8, speed: [480 * s, 900 * s],
        life: [0.1, 0.22], drag: 6, colors: [PAL.counter[1], PAL.counter[2]],
      });
      fx.shards = burstParticles(fx.rand, 14, {
        x: fx.x, y: fx.y, angle: ang, spread: TAU, speed: [220, 620], life: [0.25, 0.42],
        gravity: 700, drag: 2, size: [3, 6], colors: [PAL.counter[1], PAL.counter[2], PAL.counter[0]],
      });
      timing(fx, vfx, 8, 12);
    },
    update(fx, dt) {
      stepParticles(fx.parts, dt);
      stepParticles(fx.shards, dt);
    },
    draw(fx, p) {
      const f = frame(fx);
      const s = fx.opts.scale ?? 1;
      const k = fx.t / fx.life;
      if (f < 3) {
        p.disc(fx.x, fx.y, 16 * s, PAL.counter[0]);
        p.stamp("impact.flash", fx.x, fx.y, { scale: 1.0 * s });
      }
      const r = lerp(22, 120, easeOutCubic(k)) * s;
      p.ring(fx.x + 3, fx.y, r, PAL.counter[1], 3, 1 - k);
      p.ring(fx.x - 3, fx.y, r * 0.94, PAL.counter[2], 2, 1 - k);
      p.stamp("impact.counter", fx.x, fx.y, {
        scale: s * lerp(0.95, 1.25, easeOut(Math.min(1, fx.t / 0.12))),
        rot: Math.floor(f / 3) % 2 ? Math.PI / 8 : 0,
        alpha: fade(fx, 0.45),
      });
      drawStreaks(p, fx.parts, 3, PAL.counter[0]);
      drawShards(p, fx.shards);
    },
    screen(fx, ctx, vfx, layer) {
      if (layer === "front" && frame(fx) < 4) screenTint(ctx, vfx, PAL.counter[3], 0.18);
    },
  },

  block: {
    family: "hits",
    label: "Block spark",
    life: 0.24,
    init(fx, vfx) {
      const s = fx.opts.scale ?? 1;
      // Sparks deflect back toward the attacker.
      fx.parts = burstParticles(fx.rand, 9, {
        x: fx.x, y: fx.y, angle: fx.dir > 0 ? Math.PI : 0, spread: 1.6,
        speed: [260 * s, 520 * s], life: [0.1, 0.2], drag: 6, gravity: 500,
        colors: [PAL.block[1], PAL.block[0]],
      });
      timing(fx, vfx, 1.5, 4);
    },
    update(fx, dt) { stepParticles(fx.parts, dt); },
    draw(fx, p) {
      const f = frame(fx);
      const s = fx.opts.scale ?? 1;
      const k = fx.t / fx.life;
      const edge = fx.x - fx.dir * 6;
      if (f < 2) {
        p.disc(edge, fx.y, 7 * s, PAL.block[0]);
        p.stamp("impact.flash", edge, fx.y, { scale: 0.45 * s });
      }
      p.stamp("impact.block", edge, fx.y, {
        scale: s * lerp(0.75, 1.0, easeOut(k)),
        scaleX: 0.5,
        alpha: fade(fx, 0.35),
      });
      p.line(edge, fx.y - 42 * s, edge, fx.y + 42 * s, PAL.block[0], 3, 1 - k);
      p.line(edge + fx.dir * 4, fx.y - 30 * s, edge + fx.dir * 4, fx.y + 30 * s, PAL.block[1], 2, 1 - k);
      drawStreaks(p, fx.parts, 2, PAL.block[0], 0.025);
    },
  },

  throw_tech: {
    family: "hits",
    label: "Throw tech",
    life: 0.4,
    init(fx, vfx) {
      fx.parts = [
        ...burstParticles(fx.rand, 8, { x: fx.x, y: fx.y, angle: 0, spread: 0.5, speed: [500, 900], life: [0.12, 0.24], drag: 5, colors: [PAL.tech[1], PAL.tech[2]] }),
        ...burstParticles(fx.rand, 8, { x: fx.x, y: fx.y, angle: Math.PI, spread: 0.5, speed: [500, 900], life: [0.12, 0.24], drag: 5, colors: [PAL.tech[1], PAL.tech[2]] }),
      ];
      timing(fx, vfx, 4, 8);
    },
    update(fx, dt) { stepParticles(fx.parts, dt); },
    draw(fx, p) {
      const k = fx.t / fx.life;
      const len = lerp(20, 90, easeOutCubic(Math.min(1, k * 2.2)));
      const a = 1 - k;
      p.stamp("impact.ring", fx.x, fx.y, { scale: lerp(0.5, 1.5, easeOutCubic(k)), alpha: a });
      p.line(fx.x - len, fx.y - len * 0.5, fx.x + len, fx.y + len * 0.5, PAL.tech[0], 3, a);
      p.line(fx.x - len, fx.y + len * 0.5, fx.x + len, fx.y - len * 0.5, PAL.tech[1], 3, a);
      if (frame(fx) < 3) p.stamp("impact.flash", fx.x, fx.y, { scale: 0.9 });
      drawStreaks(p, fx.parts, 2, PAL.tech[0]);
    },
    screen(fx, ctx, vfx, layer) {
      if (layer === "front" && frame(fx) < 2) screenTint(ctx, vfx, "#ffffff", 0.45);
    },
  },

  guard_break: {
    family: "hits",
    label: "Guard break",
    life: 0.65,
    init(fx, vfx) {
      const s = fx.opts.scale ?? 1;
      fx.shards = burstParticles(fx.rand, 18, {
        x: fx.x, y: fx.y, angle: fx.dir > 0 ? -0.3 : Math.PI + 0.3, spread: 3.2,
        speed: [240 * s, 680 * s], life: [0.35, 0.6], gravity: 1300, drag: 1.5, size: [3, 7],
        colors: [PAL.guard[3], "#bff0ff", PAL.guard[1]],
      });
      fx.embers = burstParticles(fx.rand, 12, {
        x: fx.x, y: fx.y, spread: TAU, speed: [120, 380], life: [0.3, 0.55], gravity: 500, size: [2, 3],
        colors: [PAL.guard[0], PAL.guard[1], PAL.guard[2]],
      });
      timing(fx, vfx, 10, 16);
    },
    update(fx, dt) {
      stepParticles(fx.shards, dt);
      stepParticles(fx.embers, dt);
    },
    draw(fx, p) {
      const f = frame(fx);
      const s = fx.opts.scale ?? 1;
      const k = fx.t / fx.life;
      if (f < 5) {
        // The guard holds for a beat, then shatters.
        p.stamp("impact.block", fx.x, fx.y, { scale: 0.9 * s, alpha: 1 });
        if (f >= 3) p.disc(fx.x, fx.y, 34 * s, PAL.guard[0]);
        return;
      }
      p.ring(fx.x, fx.y, lerp(30, 150, easeOutCubic(k)) * s, PAL.guard[1], 4, 1 - k);
      p.stamp("impact.guardbreak", fx.x, fx.y, {
        scale: s * lerp(1.0, 1.35, easeOut(k)),
        alpha: fade(fx, 0.35),
        rot: Math.floor(f / 4) % 2 ? Math.PI / 8 : 0,
      });
      drawShards(p, fx.shards);
      drawEmbers(p, fx.embers);
    },
    screen(fx, ctx, vfx, layer) {
      const f = frame(fx);
      if (layer === "front" && f >= 4 && f < 8) screenTint(ctx, vfx, f < 6 ? "#fff3c4" : PAL.guard[2], f < 6 ? 0.55 : 0.2);
    },
  },

  combo_breaker: {
    family: "hits",
    label: "Combo breaker",
    life: 0.8,
    init(fx, vfx) {
      fx.parts = burstParticles(fx.rand, 22, {
        x: fx.x, y: fx.y, spread: TAU, speed: [500, 1100], life: [0.15, 0.32], drag: 5,
        colors: [PAL.breaker[1], PAL.breaker[2], PAL.breaker[0]],
      });
      timing(fx, vfx, 12, 20);
    },
    update(fx, dt) { stepParticles(fx.parts, dt); },
    draw(fx, p) {
      const f = frame(fx);
      const s = fx.opts.scale ?? 1;
      for (let i = 0; i < 3; i += 1) {
        const k = (fx.t - i * 0.09) / (fx.life * 0.7);
        if (k <= 0 || k >= 1) continue;
        const r = lerp(30, 280, easeOutCubic(k)) * s;
        p.ring(fx.x, fx.y, r, i === 1 ? PAL.breaker[1] : PAL.breaker[2], 4 - i, 1 - k);
        p.ring(fx.x, fx.y, r * 0.96, PAL.breaker[0], 1, (1 - k) * 0.6);
      }
      if (f < 4) {
        p.disc(fx.x, fx.y, 26 * s, PAL.breaker[0]);
        p.stamp("impact.flash", fx.x, fx.y, { scale: 1.5 * s });
      }
      const a = 1 - fx.t / fx.life;
      if (f % 4 < 3) p.stamp("impact.lightning", fx.x, fx.y, { scale: 1.4 * s, alpha: a, rot: (Math.floor(f / 4) % 4) * (Math.PI / 8) });
      const br = mulberry32(Math.floor(f / 3) * 977 + fx.id);
      const bolts = 9;
      for (let i = 0; i < bolts; i += 1) {
        const ang = (i / bolts) * TAU + br() * 0.4;
        const len = (110 + br() * 140) * s * Math.min(1, fx.t * 8);
        p.bolt(fx.x, fx.y, fx.x + Math.cos(ang) * len, fx.y + Math.sin(ang) * len, i % 2 ? PAL.breaker[1] : PAL.breaker[0], br, 14, 2, a);
      }
      drawStreaks(p, fx.parts, 3, PAL.breaker[0]);
    },
    screen(fx, ctx, vfx, layer) {
      if (layer !== "front") return;
      const f = frame(fx);
      if (f < 3) screenTint(ctx, vfx, "#ffffff", 0.85);
      else screenTint(ctx, vfx, PAL.breaker[3], 0.3 * (1 - fx.t / fx.life));
    },
  },
};
