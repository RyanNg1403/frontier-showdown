export const TAU = Math.PI * 2;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeIn = (t) => t * t;

// Holds each value for `hold` frames at 60 Hz so motion reads as stepped
// pixel-art animation rather than smooth tweening.
export const stepped = (t, fps = 30) => Math.floor(t * fps) / fps;

export function particle(o) {
  return { x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0.4, size: 2, drag: 0, gravity: 0, ...o };
}

export function stepParticles(parts, dt) {
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const q = parts[i];
    q.age += dt;
    if (q.age >= q.life) {
      parts.splice(i, 1);
      continue;
    }
    const d = q.drag ? Math.max(0, 1 - q.drag * dt) : 1;
    q.vx *= d;
    q.vy = q.vy * d + q.gravity * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
  }
}

/** Shared quality knobs; `particles` scales burst sizes on low-end devices (see vfx.setQuality). */
export const vfxQuality = { particles: 1 };

export function burstParticles(rand, count, o) {
  const out = [];
  const spread = o.spread ?? TAU;
  const n = vfxQuality.particles < 1 ? Math.max(1, Math.round(count * vfxQuality.particles)) : count;
  for (let i = 0; i < n; i += 1) {
    const ang = (o.angle ?? 0) + (rand() - 0.5) * spread;
    const speed = o.speed[0] + rand() * (o.speed[1] - o.speed[0]);
    out.push(particle({
      x: o.x + (rand() - 0.5) * (o.jitter ?? 0),
      y: o.y + (rand() - 0.5) * (o.jitter ?? 0),
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      life: o.life[0] + rand() * (o.life[1] - o.life[0]),
      size: o.size ? o.size[0] + rand() * (o.size[1] - o.size[0]) : 2,
      drag: o.drag ?? 0,
      gravity: o.gravity ?? 0,
      color: o.colors ? o.colors[Math.floor(rand() * o.colors.length)] : undefined,
      seed: rand(),
    }));
  }
  return out;
}

// Normalizes facing values ("left"/"right", -1/1, booleans) to -1 or 1.
export function facingSign(v) {
  if (v === "left" || v === -1 || v === false) return -1;
  if (typeof v === "number") return v < 0 ? -1 : 1;
  return 1;
}
