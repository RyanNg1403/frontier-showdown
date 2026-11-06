import { drawPlaceholder } from "./placeholder.js";
import { toWorld } from "../combat/boxes.js";
import { VIEW_H, VIEW_W } from "./camera.js";

export function drawFighter(ctx, f) {
  if (!f.onField || f.state === "bench") return;
  const shake = f.shake > 0 ? ((f.shake % 2) * 2 - 1) * 3 : 0;
  const atlas = f.atlas;
  const frame = atlas ? f.atlasFrame : null;
  ctx.save();
  if (f.assistMode) ctx.globalAlpha = 0.92;
  if (f.state === "tag_out" || f.state === "assist_out") ctx.globalAlpha = Math.max(0.2, 1 - f.stateFrame / 24);
  if (f.invulnFrames > 0 && f.invulnFrames % 4 < 2) ctx.globalAlpha *= 0.6;
  if (frame && atlas.image) {
    const anchor = frame.anchor || atlas.anchor;
    ctx.translate(Math.round(f.x + shake), Math.round(f.y));
    ctx.scale(f.facing, 1);
    ctx.drawImage(atlas.image, frame.x, frame.y, frame.w, frame.h, -anchor.x, -anchor.y, frame.w, frame.h);
  } else {
    if (shake) ctx.translate(shake, 0);
    drawPlaceholder(ctx, f);
  }
  ctx.restore();
}

export function drawShadow(ctx, f) {
  if (!f.onField || f.state === "bench") return;
  const h = Math.min(1, -f.y / 260);
  const w = (f.isLying ? 110 : 62) * (1 - h * 0.5);
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${0.32 * (1 - h * 0.6)})`;
  ctx.beginPath();
  ctx.ellipse(f.x + (f.isLying ? -f.facing * 60 : 0), 2, w, 10 * (1 - h * 0.4), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawProjectileFallback(ctx, p, time) {
  const pal = p.palette;
  const r = Math.max(p.def.hitbox.w, p.def.hitbox.h) / 2;
  ctx.save();
  ctx.translate(p.x, p.y);
  const pulse = 1 + Math.sin(time / 50 + p.id) * 0.08;
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.5 * pulse);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.35, pal.accent);
  g.addColorStop(0.7, pal.primary);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.5 * pulse, r * 1.25 * pulse, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.35;
  for (let i = 1; i <= 4; i += 1) {
    ctx.beginPath();
    ctx.arc(-p.facing * i * r * 0.55, Math.sin((time + i * 70) / 60) * 4, r * (0.8 - i * 0.15), 0, Math.PI * 2);
    ctx.fillStyle = pal.primary;
    ctx.fill();
  }
  ctx.restore();
}

export function drawDebug(ctx, match) {
  ctx.save();
  ctx.lineWidth = 1.5;
  for (const f of match.fighters) {
    if (f.state === "bench") continue;
    const pb = f.push;
    ctx.strokeStyle = "rgba(255,255,0,0.8)";
    ctx.strokeRect(f.x - pb.w / 2, f.y - pb.h, pb.w, pb.h);
    ctx.fillStyle = f.invulnTo("strike") ? "rgba(120,120,255,0.25)" : "rgba(60,220,90,0.25)";
    ctx.strokeStyle = "rgba(60,220,90,0.9)";
    for (const b of f.hurtboxes()) {
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
    ctx.fillStyle = "rgba(255,40,60,0.35)";
    ctx.strokeStyle = "rgba(255,40,60,1)";
    for (const b of f.hitboxes()) {
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
    if (f.state === "attack" && f.move?.grab) {
      ctx.strokeStyle = "rgba(255,160,0,0.9)";
      ctx.strokeRect(f.x, f.y - 120, f.facing * f.move.grab.range, 4);
    }
    ctx.fillStyle = "#fff";
    ctx.font = "12px monospace";
    ctx.fillText(`${f.state}${f.move ? ":" + f.move.id + " " + f.moveFrame : ""}`, f.x - 40, f.y - 210);
  }
  ctx.strokeStyle = "rgba(255,40,60,1)";
  for (const p of match.projectiles) {
    const b = toWorld(p.def.hitbox, p.x, p.y, p.facing);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  ctx.restore();
}

/** Built-in stage used when `src/stages/index.js` is absent. */
export function drawFallbackStage(ctx, camera, layer, bounds) {
  if (layer === "front") return;
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, "#141226");
  sky.addColorStop(0.55, "#2a2346");
  sky.addColorStop(1, "#3b2d4f");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.save();
  camera.apply(ctx, 0.35);
  for (let i = -8; i <= 8; i += 1) {
    ctx.fillStyle = i % 2 ? "rgba(140,200,255,0.06)" : "rgba(255,255,255,0.05)";
    ctx.fillRect(i * 220 - 40, -620, 80, 620);
  }
  ctx.restore();

  ctx.save();
  camera.apply(ctx, 0.7);
  for (let i = -10; i <= 10; i += 1) {
    const x = i * 180;
    ctx.fillStyle = "rgba(20,16,36,0.85)";
    ctx.fillRect(x - 26, -420, 52, 420);
    ctx.fillStyle = "rgba(120,220,200,0.18)";
    ctx.fillRect(x - 26, -420, 52, 6);
  }
  ctx.restore();

  ctx.save();
  camera.apply(ctx, 1);
  const left = bounds.left - 400;
  const width = bounds.right - bounds.left + 800;
  const floor = ctx.createLinearGradient(0, 0, 0, 260);
  floor.addColorStop(0, "#4a3f63");
  floor.addColorStop(1, "#1d1830");
  ctx.fillStyle = floor;
  ctx.fillRect(left, 0, width, 400);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  for (let x = Math.floor(left / 120) * 120; x < left + width; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x * 1.35, 300);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(left, 0, width, 2);
  ctx.fillStyle = "rgba(255,90,90,0.35)";
  ctx.fillRect(bounds.left - 6, -700, 6, 700);
  ctx.fillRect(bounds.right, -700, 6, 700);
  ctx.restore();
}

/** Minimal particle system used when `src/vfx/index.js` is absent. */
export function createFallbackVfx() {
  const parts = [];
  const flashes = [];
  return {
    spawn(type, x, y, opts = {}) {
      const color = opts.palette?.accent || "#fff";
      const n = { hit_light: 8, hit_heavy: 14, hit_special: 16, hit_super: 22, block: 8, clash: 14, tech: 10, breaker: 20, projectile_hit: 10, ko: 26 }[type];
      if (n) {
        const blockish = type === "block" || type === "tech";
        for (let i = 0; i < n; i += 1) {
          const a = Math.random() * Math.PI * 2;
          const s = 120 + Math.random() * (type === "hit_super" || type === "ko" ? 520 : 320);
          parts.push({ x, y, vx: Math.cos(a) * s + (opts.facing || 0) * 120, vy: Math.sin(a) * s, life: 0.25 + Math.random() * 0.2, age: 0, color: blockish ? "#9fd8ff" : i % 3 ? "#ffe9a8" : color, size: blockish ? 3 : 4 });
        }
        flashes.push({ x, y, r: type === "hit_light" ? 26 : 44, age: 0, life: 0.12, color: blockish ? "rgba(140,200,255," : "rgba(255,240,200," });
      } else if (type.startsWith("dust")) {
        for (let i = 0; i < 6; i += 1) parts.push({ x: x + (Math.random() - 0.5) * 30, y: y - 4, vx: (Math.random() - 0.5) * 120 - (opts.facing || 0) * 60, vy: -40 - Math.random() * 60, life: 0.4, age: 0, color: "rgba(220,210,240,0.6)", size: 5 });
      } else if (type === "knockdown_impact") {
        for (let i = 0; i < 12; i += 1) parts.push({ x: x + (Math.random() - 0.5) * 120, y: y - 4, vx: (Math.random() - 0.5) * 260, vy: -80 - Math.random() * 120, life: 0.5, age: 0, color: "rgba(220,210,240,0.7)", size: 6 });
      } else if (type === "super_flash" || type === "finisher" || type === "tag_flash" || type === "assist_flash") {
        flashes.push({ x, y, r: type === "super_flash" ? 160 : 90, age: 0, life: 0.5, color: "rgba(255,255,255," });
      }
    },
    update(dt) {
      for (const p of parts) {
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 900 * dt;
      }
      for (const f of flashes) f.age += dt;
      for (let i = parts.length - 1; i >= 0; i -= 1) if (parts[i].age > parts[i].life) parts.splice(i, 1);
      for (let i = flashes.length - 1; i >= 0; i -= 1) if (flashes[i].age > flashes[i].life) flashes.splice(i, 1);
    },
    draw(ctx, camera, layer = "front") {
      if (layer !== "front") return;
      ctx.save();
      camera.apply(ctx);
      ctx.globalCompositeOperation = "lighter";
      for (const f of flashes) {
        const t = f.age / f.life;
        ctx.fillStyle = `${f.color}${(1 - t) * 0.8})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r * (0.6 + t), 0, Math.PI * 2);
        ctx.fill();
      }
      for (const p of parts) {
        ctx.globalAlpha = 1 - p.age / p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.restore();
    },
  };
}

function bar(ctx, x, y, w, h, frac, redFrac, color, flip) {
  ctx.fillStyle = "rgba(10,8,20,0.85)";
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = "#3a1020";
  ctx.fillRect(x, y, w, h);
  const rw = w * Math.min(1, frac + redFrac);
  const hw = w * frac;
  ctx.fillStyle = "#c2304a";
  ctx.fillRect(flip ? x + w - rw : x, y, rw, h);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, "#fff1a8");
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.fillRect(flip ? x + w - hw : x, y, hw, h);
}

/** Built-in HUD used when the UI module does not export `drawHud`. */
export function drawFallbackHud(ctx, state) {
  if (!state || state.phase === "menu" || state.phase === "loading") return;
  ctx.save();
  ctx.textBaseline = "middle";
  const W = 520;
  state.sides.forEach((s, i) => {
    const flip = i === 1;
    const x = flip ? VIEW_W - 40 - W : 40;
    const m = s.members[s.active];
    bar(ctx, x, 34, W, 26, m.health / m.maxHealth, m.red / m.maxHealth, "#f2b632", flip);
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = flip ? "right" : "left";
    ctx.fillText(m.name.toUpperCase(), flip ? x + W : x, 78);
    if (s.members.length > 1) {
      const p = s.members[1 - s.active];
      const px = flip ? x + W - 160 : x;
      bar(ctx, px, 96, 160, 8, p.health / p.maxHealth, p.red / p.maxHealth, "#9ad", flip);
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = "#cbd";
      ctx.fillText(`${p.name}${s.tagCooldown ? "" : "  [TAG]"}${s.assistCooldown ? "" : " [ASSIST]"}`, flip ? px + 160 : px, 116);
    }
    for (let r = 0; r < state.roundsToWin; r += 1) {
      ctx.beginPath();
      ctx.arc(flip ? x + 14 + r * 26 : x + W - 14 - r * 26, 78, 8, 0, Math.PI * 2);
      ctx.fillStyle = r < s.wins ? "#ffd34d" : "rgba(255,255,255,0.15)";
      ctx.fill();
    }
    const mx = flip ? VIEW_W - 40 - 300 : 40;
    ctx.fillStyle = "rgba(10,8,20,0.85)";
    ctx.fillRect(mx - 3, VIEW_H - 46, 306, 20);
    for (let b = 0; b < 3; b += 1) {
      const frac = Math.max(0, Math.min(1, (s.meter - b * 100) / 100));
      const bx = flip ? mx + 300 - (b + 1) * 100 : mx + b * 100;
      ctx.fillStyle = "rgba(60,120,255,0.18)";
      ctx.fillRect(bx + 2, VIEW_H - 43, 96, 14);
      ctx.fillStyle = frac >= 1 ? "#5ad1ff" : "#2c6bd6";
      ctx.fillRect(flip ? bx + 2 + 96 * (1 - frac) : bx + 2, VIEW_H - 43, 96 * frac, 14);
    }
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillStyle = "#bfe8ff";
    ctx.fillText(`${s.bars}`, flip ? mx - 12 : mx + 314, VIEW_H - 36);
    if (s.combo.hits >= 2) {
      ctx.font = "bold 44px system-ui, sans-serif";
      ctx.fillStyle = "#ffd34d";
      ctx.textAlign = flip ? "right" : "left";
      ctx.fillText(`${s.combo.hits} HITS`, flip ? VIEW_W - 50 : 50, 220);
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText(`${s.combo.damage} DMG`, flip ? VIEW_W - 50 : 50, 256);
    }
  });
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(10,8,20,0.85)";
  ctx.fillRect(VIEW_W / 2 - 42, 22, 84, 56);
  ctx.font = "bold 40px system-ui, sans-serif";
  ctx.fillStyle = state.timer <= 10 ? "#ff6b6b" : "#fff";
  ctx.fillText(String(state.timer), VIEW_W / 2, 51);
  if (state.announce) {
    ctx.font = "900 84px system-ui, sans-serif";
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(10,8,20,0.9)";
    ctx.strokeText(state.announce.text, VIEW_W / 2, VIEW_H / 2 - 40);
    const g = ctx.createLinearGradient(0, VIEW_H / 2 - 80, 0, VIEW_H / 2);
    g.addColorStop(0, "#fff6c8");
    g.addColorStop(1, "#ffb02e");
    ctx.fillStyle = g;
    ctx.fillText(state.announce.text, VIEW_W / 2, VIEW_H / 2 - 40);
    if (state.announce.sub) {
      ctx.font = "bold 24px system-ui, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText(state.announce.sub, VIEW_W / 2, VIEW_H / 2 + 20);
    }
  }
  if (state.paused) {
    ctx.fillStyle = "rgba(8,6,16,0.6)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.font = "900 64px system-ui, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText("PAUSED", VIEW_W / 2, VIEW_H / 2);
  }
  ctx.restore();
}
