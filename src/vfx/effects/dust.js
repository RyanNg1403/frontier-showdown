import { particle, stepParticles, easeOut, lerp } from "../util.js";

// Ground dust. `x, y` is the ground contact point and `dir` is the direction
// the fighter is moving; dust is kicked the opposite way. `opts.tint` takes
// { light, mid, dark } so stages can match their floor colour.
const DEFAULT_TINT = { light: "#f1e8d4", mid: "#c9bba0", dark: "#8a7d68", grit: "#5e5446" };

// Dust reads at fighter scale (~200 px tall), so the art is sized up here.
const SIZE = 1.7;

function dstamp(fx, p, name, x, y, o) {
  const k = SIZE * (fx.opts.scale ?? 1);
  return p.stamp(name, x, y, { ...o, scale: (o.scale ?? 1) * k });
}

const tintOf = (fx) => ({ ...DEFAULT_TINT, ...(fx.opts.tint || {}) });

function puff(fx, o) {
  return particle({
    x: fx.x + (o.dx || 0),
    y: fx.y + (o.dy || 0),
    vx: o.vx || 0,
    vy: o.vy || 0,
    drag: o.drag ?? 4,
    life: o.life ?? 0.4,
    r0: o.r0 ?? 4,
    r1: o.r1 ?? 9,
    age: -(o.delay || 0),
    kind: "puff",
  });
}

function grit(fx, rand, n, back, speed = 220) {
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const ang = -Math.PI / 2 + back * (0.4 + rand() * 0.9);
    const v = speed * (0.5 + rand() * 0.6);
    out.push(particle({ x: fx.x, y: fx.y - 2, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, gravity: 1100, life: 0.35 + rand() * 0.25, size: 2 + Math.floor(rand() * 2), kind: "grit", ground: fx.y }));
  }
  return out;
}

function stepDust(fx, dt) {
  for (let i = fx.parts.length - 1; i >= 0; i -= 1) {
    const q = fx.parts[i];
    if (q.age < 0) {
      q.age += dt;
      continue;
    }
    if (q.kind === "grit" && q.y > q.ground && q.vy > 0) {
      q.y = q.ground;
      q.vy *= -0.35;
      q.vx *= 0.6;
    }
  }
  const pending = fx.parts.filter((q) => q.age < 0);
  const active = fx.parts.filter((q) => q.age >= 0);
  stepParticles(active, dt);
  fx.parts = pending.concat(active);
}

function drawDust(fx, p) {
  const c = tintOf(fx);
  const s = (fx.opts.scale ?? 1) * SIZE;
  for (const q of fx.parts) {
    if (q.age < 0) continue;
    const k = q.age / q.life;
    if (q.kind === "grit") {
      p.dot(q.x, q.y, q.size, c.grit, k < 0.7 ? 1 : 0.5, "normal");
      continue;
    }
    const r = lerp(q.r0, q.r1, easeOut(Math.min(1, k * 1.6))) * s * (k > 0.75 ? 1 - (k - 0.75) * 2 : 1);
    p.puff(q.x, q.y - r * 0.6, r, c.light, c.mid, c.dark, k < 0.55 ? 0.95 : 0.95 * (1 - (k - 0.55) / 0.45));
  }
}

function stampFade(fx, until) {
  const k = fx.t / until;
  return k >= 1 ? 0 : k < 0.5 ? 1 : 1 - (k - 0.5) * 2;
}

export const dustEffects = {
  dust_step: {
    family: "dust",
    label: "Footstep",
    life: 0.42,
    init(fx) {
      const b = -fx.dir;
      const r = fx.rand;
      fx.parts = [
        puff(fx, { dx: b * 4, vx: b * (70 + r() * 40), vy: -30, r0: 3, r1: 7, life: 0.34 }),
        puff(fx, { dx: b * 10, vx: b * (110 + r() * 40), vy: -55, r0: 2, r1: 5, life: 0.3 }),
        puff(fx, { dx: b * 2, vx: b * 30, vy: -18, r0: 3, r1: 6, life: 0.4, delay: 0.03 }),
      ];
    },
    update: stepDust,
    draw(fx, p) {
      dstamp(fx, p, "dust.step", fx.x - fx.dir * 8, fx.y - 6, { blend: "normal", scale: 0.6, alpha: stampFade(fx, 0.14) });
      drawDust(fx, p);
    },
  },

  dust_run_start: {
    family: "dust",
    label: "Run start",
    life: 0.55,
    init(fx) {
      const b = -fx.dir;
      const r = fx.rand;
      fx.parts = [];
      for (let i = 0; i < 6; i += 1) {
        fx.parts.push(puff(fx, { dx: b * (6 + i * 5), vx: b * (140 + r() * 160), vy: -40 - r() * 70, r0: 4, r1: 9 + r() * 5, life: 0.35 + r() * 0.15, delay: i * 0.015 }));
      }
      fx.parts.push(...grit(fx, r, 5, b));
    },
    update: stepDust,
    draw(fx, p) {
      dstamp(fx, p, "dust.kick", fx.x - fx.dir * 22, fx.y - 10, { blend: "normal", flipX: fx.dir > 0, scaleX: 1.1, alpha: stampFade(fx, 0.18) });
      drawDust(fx, p);
    },
  },

  dust_skid: {
    family: "dust",
    label: "Skid",
    life: 0.6,
    init(fx) {
      const r = fx.rand;
      fx.parts = [];
      // Puffs trail behind the sliding feet, newest at the front.
      for (let i = 0; i < 7; i += 1) {
        fx.parts.push(puff(fx, { dx: -fx.dir * (56 - i * 8), vx: fx.dir * (20 + r() * 40), vy: -25 - r() * 35, r0: 3, r1: 8 + r() * 4, life: 0.35 + r() * 0.15, delay: i * 0.03 }));
      }
      fx.parts.push(...grit(fx, r, 4, fx.dir, 180));
    },
    update: stepDust,
    draw(fx, p) {
      dstamp(fx, p, "dust.skid", fx.x - fx.dir * 26, fx.y - 6, { blend: "normal", flipX: fx.dir < 0, scaleX: lerp(0.6, 1.05, easeOut(Math.min(1, fx.t / 0.2))), alpha: stampFade(fx, 0.32) });
      drawDust(fx, p);
    },
  },

  dust_dash: {
    family: "dust",
    label: "Dash",
    life: 0.45,
    init(fx) {
      const b = -fx.dir;
      const r = fx.rand;
      fx.parts = [];
      for (let i = 0; i < 5; i += 1) {
        fx.parts.push(puff(fx, { dx: b * (10 + i * 10), vx: b * (220 + r() * 160), vy: -20 - r() * 30, r0: 3, r1: 7 + r() * 4, life: 0.28 + r() * 0.12, delay: i * 0.01 }));
      }
      fx.lines = [0, 1, 2, 3].map((i) => ({ y: -10 - i * 14 - r() * 6, len: 40 + r() * 40, off: r() * 20 }));
    },
    update: stepDust,
    draw(fx, p) {
      const c = tintOf(fx);
      const b = -fx.dir;
      const k = fx.t / fx.life;
      dstamp(fx, p, "dust.skid", fx.x + b * 40, fx.y - 6, { blend: "normal", flipX: fx.dir > 0, scaleX: 1.2, alpha: stampFade(fx, 0.22) });
      for (const l of fx.lines) {
        const x0 = fx.x + b * (20 + l.off + k * 120);
        p.line(x0, fx.y + l.y, x0 + b * l.len * (1 - k), fx.y + l.y, c.light, 2, 1 - k, "normal");
      }
      drawDust(fx, p);
    },
  },

  dust_jump: {
    family: "dust",
    label: "Jump takeoff",
    life: 0.5,
    init(fx) {
      const r = fx.rand;
      fx.parts = [
        puff(fx, { dx: -10, vx: -150, vy: -20, r0: 4, r1: 9, life: 0.36 }),
        puff(fx, { dx: 10, vx: 150, vy: -20, r0: 4, r1: 9, life: 0.36 }),
        puff(fx, { dx: -4, vx: -60, vy: -90, r0: 3, r1: 7, life: 0.4, delay: 0.02 }),
        puff(fx, { dx: 4, vx: 60, vy: -90, r0: 3, r1: 7, life: 0.4, delay: 0.02 }),
      ];
      fx.parts.push(...grit(fx, r, 3, -1, 160), ...grit(fx, r, 3, 1, 160));
    },
    update: stepDust,
    draw(fx, p) {
      dstamp(fx, p, "dust.plume", fx.x, fx.y - 20 - fx.t * 30, { blend: "normal", scale: lerp(0.45, 0.65, easeOut(Math.min(1, fx.t / 0.2))), alpha: stampFade(fx, 0.26) });
      drawDust(fx, p);
    },
  },

  dust_land: {
    family: "dust",
    label: "Landing",
    life: 0.55,
    init(fx) {
      const r = fx.rand;
      fx.parts = [];
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i += 1) {
          fx.parts.push(puff(fx, { dx: side * (8 + i * 6), vx: side * (120 + i * 70 + r() * 40), vy: -15 - r() * 30, r0: 4, r1: 8 + r() * 4, life: 0.35 + r() * 0.15 }));
        }
      }
    },
    update: stepDust,
    draw(fx, p) {
      dstamp(fx, p, "dust.land", fx.x, fx.y - 8, { blend: "normal", scaleX: lerp(0.8, 1.25, easeOut(Math.min(1, fx.t / 0.2))), scaleY: 0.8, alpha: stampFade(fx, 0.24) });
      drawDust(fx, p);
    },
  },

  dust_knockdown: {
    family: "dust",
    label: "Knockdown",
    life: 0.95,
    init(fx, vfx) {
      const r = fx.rand;
      fx.parts = [];
      for (const side of [-1, 1]) {
        for (let i = 0; i < 6; i += 1) {
          fx.parts.push(puff(fx, { dx: side * (10 + i * 10), vx: side * (100 + i * 60 + r() * 60), vy: -30 - r() * 60, r0: 6, r1: 12 + r() * 6, life: 0.5 + r() * 0.3, drag: 3 }));
        }
      }
      fx.parts.push(...grit(fx, r, 6, -1, 300), ...grit(fx, r, 6, 1, 300));
      if (fx.opts.shake !== false) vfx.shake(5, 10);
    },
    update: stepDust,
    draw(fx, p) {
      dstamp(fx, p, "dust.knockdown", fx.x, fx.y - 30, { blend: "normal", scale: lerp(0.9, 1.25, easeOut(Math.min(1, fx.t / 0.35))), scaleY: 0.85, alpha: stampFade(fx, 0.5) });
      drawDust(fx, p);
    },
  },
};
