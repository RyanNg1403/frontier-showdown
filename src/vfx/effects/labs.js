// Lab-themed projectile and special-move templates. Every template takes
// `opts.lab` (see LABS) or explicit `opts.colors`, so character specials can
// reuse them: vfx.spawn("lab_beam", x, y, { lab: "xai", dir: 1, length: 640 }).
import { TAU, lerp, easeOut, easeOutCubic, burstParticles, stepParticles, particle } from "../util.js";
import { LABS, LAB_IDS, labOf } from "./labs-data.js";

export { LABS, LAB_IDS };

const frame = (fx) => Math.floor(fx.t * 60);

function setup(fx) {
  const lab = labOf(fx.opts.lab);
  fx.lab = lab;
  fx.colors = fx.opts.colors || lab.colors;
  fx.motif = fx.opts.motif || lab.motif;
  fx.orb = fx.opts.orb || lab.orb;
}

// Procedural lab motifs drawn on the shared pixel grid.
export function drawMotif(p, motif, x, y, r, t, c, a = 1, dir = 1) {
  switch (motif) {
    case "knot": {
      for (let i = 0; i < 6; i += 1) {
        const ang = t * 3 + (i / 6) * TAU;
        p.ring(x + Math.cos(ang) * r * 0.5, y + Math.sin(ang) * r * 0.5, r * 0.42, i % 2 ? c[1] : c[2], 2, a);
      }
      p.dot(x, y, r * 0.3, c[0], a);
      break;
    }
    case "asterisk": {
      for (let i = 0; i < 8; i += 1) {
        const ang = t * 1.5 + (i / 8) * TAU;
        const len = r * (i % 2 ? 0.7 : 1);
        p.line(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len, i % 2 ? c[1] : c[2], Math.max(2, r * 0.14), a);
      }
      p.disc(x, y, r * 0.22, c[0], a);
      break;
    }
    case "twinkle": {
      const pulse = 1 + Math.sin(t * 20) * 0.15;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let k = 0; k < 4; k += 1) {
          const u = k / 4;
          p.line(x + dx * r * u * pulse, y + dy * r * u * pulse, x + dx * r * (u + 0.25) * pulse, y + dy * r * (u + 0.25) * pulse, k < 2 ? c[0] : c[1], Math.max(1, r * 0.2 * (1 - u)), a);
        }
      }
      p.ring(x, y, r * 0.95, c[2], 2, a * 0.8, "add", 0.45);
      break;
    }
    case "slash": {
      const L = r * 1.1;
      p.line(x - L, y - L, x + L, y + L, c[0], Math.max(2, r * 0.16), a);
      p.line(x - L, y + L, x + L, y - L, c[1], Math.max(2, r * 0.12), a);
      p.ring(x, y, r, c[2], 2, a * 0.7);
      break;
    }
    case "infinity": {
      const n = 28;
      for (let i = 0; i < n; i += 1) {
        const u = (i / n) * TAU + t * 4;
        const px = x + Math.sin(u) * r;
        const py = y + Math.sin(u * 2) * r * 0.35;
        p.dot(px, py, Math.max(2, r * 0.16), i < n * 0.3 ? c[0] : c[2], a);
      }
      break;
    }
    case "circuit": {
      for (let i = 0; i < 6; i += 1) {
        const ang = (i / 6) * TAU + 0.3;
        const ex = x + Math.cos(ang) * r * 0.6;
        const ey = y + Math.sin(ang) * r * 0.6;
        const fx2 = ex + (Math.abs(Math.cos(ang)) > 0.5 ? Math.sign(Math.cos(ang)) * r * 0.45 : 0);
        const fy2 = ey + (Math.abs(Math.cos(ang)) <= 0.5 ? Math.sign(Math.sin(ang)) * r * 0.45 : 0);
        p.line(x, y, ex, ey, c[2], 2, a);
        p.line(ex, ey, fx2, fy2, c[2], 2, a);
        const blink = Math.floor(t * 12 + i) % 3 === 0;
        p.rect(fx2 - 3, fy2 - 3, 6, 6, blink ? c[0] : c[1], a);
      }
      p.ring(x, y, r * 0.35, c[1], 3, a);
      p.dot(x, y, r * 0.2, c[0], a);
      break;
    }
    case "gust": {
      for (let i = 0; i < 3; i += 1) {
        const yy = y + (i - 1) * r * 0.5;
        const len = r * (1.4 - i * 0.2);
        let px = x - len * dir;
        let py = yy;
        for (let k = 1; k <= 8; k += 1) {
          const qx = x - len * dir + (len * 2 * dir * k) / 8;
          const qy = yy + Math.sin(k * 0.9 + t * 14 + i) * r * 0.12;
          p.line(px, py, qx, qy, i === 1 ? c[1] : c[2], Math.max(2, r * 0.22), a);
          px = qx;
          py = qy;
        }
        p.dot(px, py, r * 0.22, c[0], a);
      }
      break;
    }
    case "whirl":
    default: {
      const n = 36;
      for (let i = 0; i < n; i += 1) {
        const u = i / n;
        const ang = u * TAU * 2 + t * 6;
        const rr = r * (0.15 + u * 0.85);
        p.dot(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.8, Math.max(2, r * 0.13 * (1 - u * 0.5)), u < 0.3 ? c[0] : u < 0.7 ? c[1] : c[2], a);
      }
      break;
    }
  }
}

function drawParts(p, parts) {
  for (const q of parts) {
    const a = 1 - q.age / q.life;
    p.dot(q.x, q.y, q.size, q.color, a > 0.5 ? 1 : a * 2);
  }
}

// --- Generic templates -------------------------------------------------------

const templates = {
  // Self-moving projectile. Call `handle.impact()` on contact; the engine may
  // also drive `handle.x/y` itself with opts.manual = true.
  projectile: {
    life: 1.6,
    init(fx, vfx) {
      setup(fx);
      fx.vx = fx.opts.vx ?? fx.dir * (fx.opts.speed ?? 620);
      fx.vy = fx.opts.vy ?? 0;
      fx.emit = 0;
      fx.impact = (x = fx.x, y = fx.y) => {
        if (!fx.alive) return null;
        fx.alive = false;
        return vfx.spawn("lab_impact", x, y, { lab: fx.opts.lab, colors: fx.opts.colors, dir: fx.dir, scale: fx.opts.scale });
      };
      fx.ox = fx.x;
      fx.oy = fx.y;
    },
    update(fx, dt) {
      if (!fx.opts.manual) {
        fx.x += fx.vx * dt;
        fx.y += fx.vy * dt;
      }
      fx.emit -= dt;
      while (fx.emit <= 0) {
        fx.emit += 0.016;
        fx.parts.push(particle({
          x: fx.x - fx.dir * 14 + (fx.rand() - 0.5) * 8,
          y: fx.y + (fx.rand() - 0.5) * 22,
          vx: -fx.dir * (40 + fx.rand() * 80),
          vy: (fx.rand() - 0.5) * 60,
          life: 0.18 + fx.rand() * 0.2,
          size: 2 + Math.floor(fx.rand() * 4),
          color: fx.colors[1 + Math.floor(fx.rand() * 2)],
        }));
      }
      stepParticles(fx.parts, dt);
    },
    end(fx, vfx) {
      if (fx.t >= fx.life && fx.opts.impactOnExpire) vfx.spawn("lab_impact", fx.x, fx.y, { lab: fx.opts.lab, colors: fx.opts.colors, scale: 0.6 });
    },
    draw(fx, p) {
      const s = fx.opts.scale ?? 1;
      const c = fx.colors;
      drawParts(p, fx.parts);
      if (fx.t < 0.1) {
        const k = fx.t / 0.1;
        p.stamp("impact.flash", fx.ox, fx.oy, { scale: 0.9 * (1 - k) + 0.3 });
        p.ring(fx.ox, fx.oy, lerp(10, 50, k), c[1], 3, 1 - k);
      }
      for (let i = 1; i <= 3; i += 1) {
        p.disc(fx.x - fx.dir * i * 14 * s, fx.y, (16 - i * 4) * s, c[2], 0.7 - i * 0.15);
      }
      const pulse = 1 + (frame(fx) % 6 < 3 ? 0.06 : -0.04);
      if (!p.stamp(fx.orb, fx.x, fx.y, { scale: 0.85 * s * pulse, rot: fx.motif === "slash" || fx.motif === "gust" ? 0 : fx.t * 6, flipX: fx.dir < 0 })) {
        p.disc(fx.x, fx.y, 18 * s, c[2]);
      }
      drawMotif(p, fx.motif, fx.x, fx.y, 18 * s, fx.t, c, 0.7, fx.dir);
      p.disc(fx.x, fx.y, 6 * s, c[0]);
    },
  },

  lab_impact: {
    life: 0.42,
    init(fx, vfx) {
      setup(fx);
      const s = fx.opts.scale ?? 1;
      fx.parts = burstParticles(fx.rand, 18, { x: fx.x, y: fx.y, speed: [200 * s, 640 * s], life: [0.15, 0.4], drag: 4, size: [2, 5], colors: fx.colors.slice(0, 3) });
      if (fx.opts.shake !== false) vfx.shake(4 * s, 8);
    },
    update(fx, dt) { stepParticles(fx.parts, dt); },
    draw(fx, p) {
      const s = fx.opts.scale ?? 1;
      const k = fx.t / fx.life;
      const c = fx.colors;
      if (frame(fx) < 3) p.stamp("impact.flash", fx.x, fx.y, { scale: 0.9 * s });
      p.ring(fx.x, fx.y, lerp(16, 110, easeOutCubic(k)) * s, c[1], 3, 1 - k);
      p.stamp(fx.orb, fx.x, fx.y, { scale: lerp(0.9, 1.7, easeOut(k)) * s, alpha: 1 - k, rot: k * 2 });
      drawMotif(p, fx.motif, fx.x, fx.y, lerp(20, 70, easeOut(k)) * s, fx.t, c, 1 - k, fx.dir);
      drawParts(p, fx.parts);
    },
  },

  lab_burst: {
    family: "lab-templates",
    label: "Template: burst",
    life: 0.7,
    init(fx, vfx) {
      setup(fx);
      const s = fx.opts.scale ?? 1;
      fx.parts = burstParticles(fx.rand, 34, { x: fx.x, y: fx.y, speed: [300 * s, 900 * s], life: [0.2, 0.55], drag: 3, size: [2, 6], colors: fx.colors.slice(0, 3) });
      vfx.shake(7 * s, 12);
    },
    update(fx, dt) { stepParticles(fx.parts, dt); },
    draw(fx, p) {
      const s = fx.opts.scale ?? 1;
      const k = fx.t / fx.life;
      const c = fx.colors;
      if (frame(fx) < 4) {
        p.disc(fx.x, fx.y, 30 * s, c[0]);
        p.stamp("impact.flash", fx.x, fx.y, { scale: 1.6 * s });
      }
      p.ring(fx.x, fx.y, lerp(30, 220, easeOutCubic(k)) * s, c[1], 4, 1 - k);
      p.ring(fx.x, fx.y, lerp(20, 160, easeOutCubic(k)) * s, c[2], 3, 1 - k);
      p.stamp(fx.orb, fx.x, fx.y, { scale: lerp(1.4, 2.6, easeOut(k)) * s, alpha: 1 - k, rot: k * 3 });
      drawMotif(p, fx.motif, fx.x, fx.y, lerp(40, 140, easeOut(k)) * s, fx.t, c, 1 - k, fx.dir);
      drawParts(p, fx.parts);
    },
    screen(fx, ctx, vfx, layer) {
      if (layer !== "front" || frame(fx) >= 3) return;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = fx.colors[1];
      ctx.fillRect(0, 0, vfx.viewW, vfx.viewH);
    },
  },

  // Ground eruption; y is the floor.
  lab_pillar: {
    family: "lab-templates",
    label: "Template: pillar",
    life: 0.85,
    init(fx, vfx) {
      setup(fx);
      fx.parts = [];
      vfx.shake(6, 14);
    },
    update(fx, dt) {
      const h = fx.opts.height ?? 460;
      if (fx.t < fx.life * 0.6) {
        for (let i = 0; i < 3; i += 1) {
          fx.parts.push(particle({ x: fx.x + (fx.rand() - 0.5) * 80, y: fx.y - fx.rand() * 30, vx: (fx.rand() - 0.5) * 60, vy: -(400 + fx.rand() * 700), life: 0.3 + fx.rand() * 0.3, size: 2 + Math.floor(fx.rand() * 4), color: fx.colors[Math.floor(fx.rand() * 3)], drag: 1 }));
        }
      }
      fx.h = h;
      stepParticles(fx.parts, dt);
    },
    draw(fx, p) {
      const c = fx.colors;
      const k = fx.t / fx.life;
      const rise = easeOutCubic(Math.min(1, fx.t / 0.12));
      const h = (fx.h ?? 460) * rise;
      const w = (fx.opts.width ?? 90) * (k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4);
      if (w > 1) {
        p.rect(fx.x - w * 0.75, fx.y - h, w * 1.5, h, c[3], 0.5);
        p.rect(fx.x - w / 2, fx.y - h, w, h, c[2], 0.85);
        p.rect(fx.x - w / 5, fx.y - h, w / 2.5, h, c[0], 1);
        for (let i = 0; i < 4; i += 1) {
          const yy = fx.y - ((fx.t * 900 + i * 120) % Math.max(1, h));
          drawMotif(p, fx.motif, fx.x, yy, w * 0.45, fx.t + i, c, 0.9);
        }
      }
      p.ring(fx.x, fx.y, lerp(30, 180, easeOutCubic(k)), c[1], 3, 1 - k, "add", 0.25);
      if (frame(fx) < 4) p.stamp("impact.flash", fx.x, fx.y - 20, { scale: 1.2 });
      drawParts(p, fx.parts);
    },
  },

  // Horizontal beam from (x, y) toward `dir`, `opts.length` px long.
  lab_beam: {
    family: "lab-templates",
    label: "Template: beam",
    life: 0.75,
    init(fx, vfx) {
      setup(fx);
      fx.len = fx.opts.length ?? 720;
      vfx.shake(4, 30);
    },
    update(fx, dt) {
      if (fx.t < fx.life * 0.75) {
        for (let i = 0; i < 2; i += 1) {
          const d = fx.rand() * fx.len;
          fx.parts.push(particle({ x: fx.x + fx.dir * d, y: fx.y + (fx.rand() - 0.5) * 50, vx: fx.dir * (200 + fx.rand() * 300), vy: (fx.rand() - 0.5) * 160, life: 0.2 + fx.rand() * 0.2, size: 2 + Math.floor(fx.rand() * 3), color: fx.colors[Math.floor(fx.rand() * 3)], drag: 2 }));
        }
      }
      stepParticles(fx.parts, dt);
    },
    draw(fx, p) {
      const c = fx.colors;
      const k = fx.t / fx.life;
      const grow = easeOutCubic(Math.min(1, fx.t / 0.1));
      const len = fx.len * grow;
      const flick = frame(fx) % 4 < 2 ? 1 : 0.82;
      const th = (fx.opts.thickness ?? 56) * flick * (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
      const x0 = fx.dir > 0 ? fx.x : fx.x - len;
      if (th > 1) {
        p.rect(x0, fx.y - th * 0.7, len, th * 1.4, c[3], 0.55);
        p.rect(x0, fx.y - th / 2, len, th, c[2], 0.9);
        p.rect(x0, fx.y - th / 4, len, th / 2, c[1], 1);
        p.rect(x0, fx.y - th / 10, len, Math.max(4, th / 5), c[0], 1);
        for (let i = 0; i < 5; i += 1) {
          const d = (fx.t * 1600 + i * (fx.len / 5)) % Math.max(1, len);
          drawMotif(p, fx.motif, fx.x + fx.dir * d, fx.y, th * 0.5, fx.t + i, c, 0.85, fx.dir);
        }
        p.stamp(fx.orb, fx.x, fx.y, { scale: 1.2 * flick, rot: fx.t * 8 });
        p.stamp("impact.flash", fx.x + fx.dir * len, fx.y, { scale: 0.9 * flick });
      }
      drawParts(p, fx.parts);
    },
  },

  // Two crossing slashes, the second a beat after the first.
  lab_slash_x: {
    family: "lab-templates",
    label: "Template: X slash",
    life: 0.5,
    init(fx, vfx) {
      setup(fx);
      fx.parts = burstParticles(fx.rand, 20, { x: fx.x, y: fx.y, speed: [300, 800], life: [0.15, 0.35], drag: 4, colors: fx.colors.slice(0, 3) });
      vfx.shake(6, 10);
    },
    update(fx, dt) { stepParticles(fx.parts, dt); },
    draw(fx, p) {
      const c = fx.colors;
      const L = (fx.opts.size ?? 120);
      for (let i = 0; i < 2; i += 1) {
        const t0 = i * 0.07;
        const u = (fx.t - t0) / 0.1;
        if (u <= 0) continue;
        const a = 1 - Math.max(0, (fx.t - t0 - 0.1) / (fx.life - t0 - 0.1));
        const sx = i ? -1 : 1;
        const g = easeOutCubic(Math.min(1, u));
        const ax = fx.x - L * sx;
        const ay = fx.y - L;
        const bx = lerp(ax, fx.x + L * sx, g);
        const by = lerp(ay, fx.y + L, g);
        p.line(ax, ay, bx, by, c[2], 14, a);
        p.line(ax, ay, bx, by, c[1], 8, a);
        p.line(ax, ay, bx, by, c[0], 4, a);
      }
      if (frame(fx) >= 4 && frame(fx) < 8) p.stamp("impact.flash", fx.x, fx.y, { scale: 1.4 });
      drawMotif(p, fx.motif, fx.x, fx.y, 40, fx.t, c, Math.max(0, 1 - fx.t / fx.life));
      drawParts(p, fx.parts);
    },
  },

  // Power-up aura around a fighter. opts.follow() -> {x, y} (feet) or static.
  lab_aura: {
    family: "lab-templates",
    label: "Template: aura",
    life: 1.2,
    layer: "back",
    init(fx) {
      setup(fx);
      fx.emit = 0;
    },
    update(fx, dt) {
      const at = fx.opts.follow ? fx.opts.follow() : null;
      if (at) {
        fx.x = at.x;
        fx.y = at.y;
      }
      fx.emit -= dt;
      const h = fx.opts.height ?? 200;
      while (fx.emit <= 0 && fx.t < fx.life - 0.2) {
        fx.emit += 0.006;
        const side = fx.rand() < 0.5 ? -1 : 1;
        const yy = fx.y - fx.rand() * h;
        const w = (fx.opts.width ?? 90) * Math.sin(((fx.y - yy) / h) * Math.PI * 0.9 + 0.2);
        fx.parts.push(particle({ x: fx.x + side * w * (0.7 + fx.rand() * 0.4), y: yy, vx: -side * 20, vy: -(160 + fx.rand() * 260), life: 0.2 + fx.rand() * 0.25, size: 4 + Math.floor(fx.rand() * 6), color: fx.colors[1 + Math.floor(fx.rand() * 3)], drag: 1 }));
      }
      stepParticles(fx.parts, dt);
    },
    draw(fx, p) {
      const c = fx.colors;
      const h = fx.opts.height ?? 200;
      const w = fx.opts.width ?? 90;
      const a = fx.t < fx.life - 0.25 ? 1 : (fx.life - fx.t) / 0.25;
      const throb = frame(fx) % 6 < 3 ? 1 : 0.92;
      p.disc(fx.x, fx.y - h * 0.5, w * 1.15 * throb, c[3], 0.55 * a, "add", (h * 0.62) / (w * 1.15));
      p.disc(fx.x, fx.y - h * 0.5, w * 0.95 * throb, c[2], 0.45 * a, "add", (h * 0.55) / (w * 0.95));
      for (const q of fx.parts) {
        const k = q.age / q.life;
        p.rect(q.x - q.size / 2, q.y - q.size * 1.5, q.size, q.size * 3 * (1 - k), q.color, a * (1 - k * 0.6));
      }
      p.ring(fx.x, fx.y, w * (1 + Math.sin(fx.t * 12) * 0.08), c[1], 3, 0.8 * a, "add", 0.22);
      const orbit = fx.t * 5;
      drawMotif(p, fx.motif, fx.x + Math.cos(orbit) * 70, fx.y - h * 0.55 + Math.sin(orbit) * 22, 16, fx.t, c, a, 1);
    },
  },

  // Travels along the floor: circuit traces or wind gusts depending on motif.
  lab_ground_wave: {
    family: "lab-templates",
    label: "Template: ground wave",
    life: 1.0,
    init(fx, vfx) {
      setup(fx);
      fx.speed = fx.opts.speed ?? 760;
      fx.nodes = [];
      vfx.shake(3, 8);
    },
    update(fx, dt) {
      const head = fx.x + fx.dir * fx.speed * fx.t;
      if (fx.t < fx.life * 0.7 && fx.rand() < 0.7) {
        fx.parts.push(particle({ x: head, y: fx.y - fx.rand() * 20, vx: fx.dir * 80, vy: -(100 + fx.rand() * 300), life: 0.25 + fx.rand() * 0.2, size: 2 + Math.floor(fx.rand() * 4), color: fx.colors[Math.floor(fx.rand() * 3)], gravity: 400 }));
      }
      if (fx.nodes.length === 0 || Math.abs(head - fx.nodes[fx.nodes.length - 1].x) > 36) fx.nodes.push({ x: head, h: 10 + fx.rand() * 60, t: fx.t });
      stepParticles(fx.parts, dt);
    },
    draw(fx, p) {
      const c = fx.colors;
      const head = fx.x + fx.dir * fx.speed * Math.min(fx.t, fx.life * 0.75);
      const fade = fx.t < fx.life * 0.7 ? 1 : 1 - (fx.t - fx.life * 0.7) / (fx.life * 0.3);
      if (fx.motif === "circuit") {
        p.line(fx.x, fx.y - 4, head, fx.y - 4, c[2], 4, fade);
        for (const n of fx.nodes) {
          const age = fx.t - n.t;
          const up = Math.min(1, age / 0.08);
          p.line(n.x, fx.y - 4, n.x, fx.y - 4 - n.h * up, c[2], 3, fade);
          p.line(n.x, fx.y - 4 - n.h * up, n.x + fx.dir * 18 * up, fx.y - 4 - n.h * up, c[1], 3, fade);
          p.rect(n.x + fx.dir * 18 * up - 4, fx.y - 8 - n.h * up, 8, 8, Math.floor((fx.t + n.h) * 10) % 2 ? c[0] : c[1], fade);
        }
      } else {
        for (const n of fx.nodes) {
          const age = fx.t - n.t;
          const a = Math.max(0, 1 - age / 0.4) * fade;
          drawMotif(p, fx.motif === "gust" ? "gust" : fx.motif, n.x, fx.y - 30 - n.h * 0.4, 26 + n.h * 0.3, fx.t + n.h, c, a, fx.dir);
        }
      }
      p.stamp(fx.orb, head, fx.y - 34, { scale: 0.9 * fade, flipX: fx.dir < 0 });
      for (const q of fx.parts) p.dot(q.x, q.y, q.size, q.color, 1 - q.age / q.life);
    },
  },

  // Whirlpool that drags particles inward, then pops.
  lab_vortex: {
    family: "lab-templates",
    label: "Template: vortex",
    life: 1.1,
    init(fx) {
      setup(fx);
      fx.popped = false;
    },
    update(fx, dt, vfx) {
      if (fx.t < fx.life * 0.7) {
        for (let i = 0; i < 2; i += 1) {
          const ang = fx.rand() * TAU;
          const r = 140 + fx.rand() * 80;
          fx.parts.push(particle({ x: fx.x + Math.cos(ang) * r, y: fx.y + Math.sin(ang) * r * 0.7, ang, r, life: 0.5, size: 2 + Math.floor(fx.rand() * 3), color: fx.colors[Math.floor(fx.rand() * 3)] }));
        }
      } else if (!fx.popped) {
        fx.popped = true;
        vfx.spawn("lab_impact", fx.x, fx.y, { lab: fx.opts.lab, colors: fx.opts.colors, scale: 1.4 });
      }
      for (let i = fx.parts.length - 1; i >= 0; i -= 1) {
        const q = fx.parts[i];
        q.age += dt;
        if (q.age >= q.life) { fx.parts.splice(i, 1); continue; }
        q.ang += dt * 7;
        q.r *= 1 - dt * 3.2;
        q.x = fx.x + Math.cos(q.ang) * q.r;
        q.y = fx.y + Math.sin(q.ang) * q.r * 0.7;
      }
    },
    draw(fx, p) {
      const c = fx.colors;
      const k = Math.min(1, fx.t / (fx.life * 0.7));
      if (k < 1) {
        drawMotif(p, "whirl", fx.x, fx.y, lerp(40, 110, Math.sin(k * Math.PI)), fx.t, c, 1);
        p.stamp(fx.orb, fx.x, fx.y, { scale: lerp(0.6, 1.3, k), rot: fx.t * 10 });
      }
      for (const q of fx.parts) p.dot(q.x, q.y, q.size, q.color, 1);
    },
  },

  // Startup: particles converge into a growing orb.
  lab_charge: {
    family: "lab-templates",
    label: "Template: charge",
    life: 0.5,
    init(fx) {
      setup(fx);
      fx.parts = Array.from({ length: 22 }, () => {
        const ang = fx.rand() * TAU;
        const r = 70 + fx.rand() * 70;
        return { ang, r, size: 2 + Math.floor(fx.rand() * 3), color: fx.colors[Math.floor(fx.rand() * 3)], d: fx.rand() * 0.15 };
      });
    },
    draw(fx, p) {
      const c = fx.colors;
      const k = fx.t / fx.life;
      for (const q of fx.parts) {
        const u = Math.min(1, Math.max(0, (fx.t - q.d) / (fx.life * 0.8)));
        const r = q.r * (1 - easeOut(u));
        const x = fx.x + Math.cos(q.ang + u * 2) * r;
        const y = fx.y + Math.sin(q.ang + u * 2) * r;
        p.line(x, y, x + Math.cos(q.ang) * 10 * (1 - u), y + Math.sin(q.ang) * 10 * (1 - u), q.color, q.size, 1 - u * 0.3);
      }
      p.stamp(fx.orb, fx.x, fx.y, { scale: lerp(0.2, 0.9, k), rot: fx.t * 12 });
      p.disc(fx.x, fx.y, lerp(3, 10, k), c[0]);
    },
  },
};

// --- Per-lab catalog entries -------------------------------------------------

const SIGNATURES = {
  openai: { name: "Blossom Burst", run: (v, x, y, o) => { v.spawn("lab_charge", x, y, o); v.spawn("lab_burst", x + o.dir * 60, y, { ...o, delay: 0.4 }); } },
  anthropic: { name: "Constitution Pillar", run: (v, x, y, o) => { v.spawn("lab_charge", x, y - 110, o); v.spawn("lab_pillar", x + o.dir * 180, y, { ...o, delay: 0.35 }); } },
  deepmind: { name: "Twin Star Beam", run: (v, x, y, o) => { v.spawn("lab_charge", x, y - 120, o); v.spawn("lab_beam", x + o.dir * 30, y - 120, { ...o, delay: 0.35 }); } },
  xai: { name: "Cross Grok", run: (v, x, y, o) => { v.spawn("slash_arc", x + o.dir * 40, y - 120, { ...o, radius: 120 }); v.spawn("lab_slash_x", x + o.dir * 170, y - 120, { ...o, delay: 0.12 }); } },
  meta: { name: "Infinite Loop", run: (v, x, y, o) => { v.spawn("lab_aura", x, y, { ...o, life: 0.9 }); v.spawn("lab_burst", x, y - 110, { ...o, delay: 0.7, scale: 0.8 }); } },
  nvidia: { name: "Tensor Grid", run: (v, x, y, o) => { v.spawn("lab_ground_wave", x + o.dir * 40, y, o); v.spawn("lab_pillar", x + o.dir * 330, y, { ...o, delay: 0.42, width: 70 }); } },
  mistral: { name: "Gale Front", run: (v, x, y, o) => { v.spawn("lab_charge", x, y - 110, { ...o, life: 0.3 }); v.spawn("lab_ground_wave", x + o.dir * 40, y, { ...o, delay: 0.2, speed: 900 }); } },
  deepseek: { name: "Deep Current", run: (v, x, y, o) => { v.spawn("lab_charge", x, y - 110, { ...o, life: 0.3 }); v.spawn("lab_vortex", x + o.dir * 220, y - 110, { ...o, delay: 0.25 }); } },
};

export const LAB_SIGNATURES = Object.fromEntries(Object.entries(SIGNATURES).map(([id, s]) => [id, s.name]));

const perLab = {};
for (const id of LAB_IDS) {
  perLab[`projectile_${id}`] = {
    ...templates.projectile,
    family: "labs",
    label: `${LABS[id].name} projectile`,
    init(fx, vfx) {
      fx.opts = { lab: id, ...fx.opts };
      templates.projectile.init(fx, vfx);
    },
  };
  // Signature special: x/y are the caster's feet; composes the templates.
  perLab[`special_${id}`] = {
    family: "labs",
    label: `${LABS[id].name}: ${SIGNATURES[id].name}`,
    life: 0.01,
    init(fx, vfx) {
      SIGNATURES[id].run(vfx, fx.x, fx.y, { ...fx.opts, lab: id, dir: fx.dir });
    },
  };
}

export const labEffects = { ...templates, ...perLab };
