import { drawFighter } from "./render.js";

/**
 * Procedural drawing for the mechanics layer (`match.mech`): placed traps and zones,
 * companions, stance auras, shadow copies, short-lived effects and the custom projectile
 * looks named by `projectile.mech.look`. World space; the caller applies the camera.
 */

const TAU = Math.PI * 2;

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function fadeOf(o) {
  return Math.min(1, o.life / 24, (o.age + 1) / 10);
}

function hexPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = Math.PI / 6 + (i * TAU) / 6;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  }
  ctx.closePath();
}

function drawContainment(ctx, o, t) {
  const amber = o.owner.def.palette.accent;
  const fade = fadeOf(o);
  const x0 = o.x - o.w / 2;
  ctx.save();
  ctx.globalAlpha = fade;
  const g = ctx.createLinearGradient(0, -o.h, 0, 0);
  g.addColorStop(0, rgba(amber, 0));
  g.addColorStop(1, rgba(amber, 0.22));
  ctx.fillStyle = g;
  ctx.fillRect(x0, -o.h, o.w, o.h);
  ctx.beginPath();
  ctx.rect(x0, -o.h, o.w, o.h);
  ctx.clip();
  ctx.strokeStyle = rgba(amber, 0.35);
  ctx.lineWidth = 1.5;
  const r = 18;
  const drift = (t / 90) % (r * 1.5);
  for (let row = 0; row * r * 1.5 < o.h + r * 2; row += 1) {
    for (let col = -1; col * r * 1.75 < o.w + r * 2; col += 1) {
      const hx = x0 + col * r * 1.75 + (row % 2 ? r * 0.87 : 0);
      const hy = -row * r * 1.5 + drift;
      hexPath(ctx, hx, hy, r * 0.92);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.strokeStyle = amber;
  ctx.lineWidth = 3;
  ctx.shadowColor = amber;
  ctx.shadowBlur = 12;
  for (const ex of [x0, x0 + o.w]) {
    ctx.beginPath();
    ctx.moveTo(ex, 0);
    ctx.lineTo(ex, -o.h);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(o.x, 0, o.w / 2, 10, 0, 0, TAU);
  ctx.stroke();
  if (o.spec.blockProjectiles) {
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(x0 + 3, -o.h, o.w - 6, o.h);
  }
  ctx.restore();
}

function drawCake(ctx, o, t) {
  const fade = fadeOf(o);
  const bob = Math.sin(t / 300) * 1.5;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(o.x, 0);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 2, 46, 8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#d9d4cc";
  ctx.fillRect(-44, -6, 88, 6);
  const layers = [
    { w: 76, h: 20, c: "#a9744f" },
    { w: 60, h: 16, c: "#f1e6d6" },
    { w: 44, h: 13, c: "#f4c4d4" },
  ];
  let y = -6;
  for (const l of layers) {
    y -= l.h;
    ctx.fillStyle = l.c;
    ctx.fillRect(-l.w / 2, y, l.w, l.h);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(-l.w / 2, y, l.w, 3);
  }
  ctx.fillStyle = "#e0245e";
  ctx.beginPath();
  ctx.arc(0, y - 6 + bob, 6, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#3d6b2f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(1, y - 11 + bob);
  ctx.quadraticCurveTo(5, y - 20 + bob, 9, y - 19 + bob);
  ctx.stroke();
  ctx.restore();
}

function drawOrb(ctx, x, y, accent, t, { skin = null, flash = 0, scale = 1 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (skin === "paperclip") {
    ctx.strokeStyle = "#c8ccd4";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-4, 16);
    ctx.lineTo(-4, -12);
    ctx.arc(2, -12, 6, Math.PI, 0);
    ctx.lineTo(8, 12);
    ctx.arc(2, 12, 6, 0, Math.PI);
    ctx.lineTo(-4, -6);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    for (const ex of [-1, 6]) {
      ctx.beginPath();
      ctx.arc(ex, -2, 3, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = "#111";
    for (const ex of [-1, 6]) ctx.fillRect(ex - 1, -3, 2, 2);
  } else {
    const r = 13 + Math.sin(t / 160) * 1.2;
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2.2);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.3, accent);
    g.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.2, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(accent, 0.8);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.5, r * 0.55, t / 400, 0, TAU);
    ctx.stroke();
  }
  if (flash > 0) {
    ctx.globalAlpha = flash / 10;
    ctx.fillStyle = "#fff6d8";
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawCompanion(ctx, match, o, t) {
  const skin = match.mech.ctx.state.skins?.[o.side];
  const accent = o.owner.def.palette.accent;
  if (o.strikeFlash > 0 && o.lastBox) {
    const b = o.lastBox;
    const s = o.strikeFrom || o;
    ctx.save();
    ctx.globalAlpha = o.strikeFlash / 10;
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, "#fff6d8");
    g.addColorStop(1, rgba(accent, 0.1));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(s.x - 10, s.y);
    ctx.lineTo(s.x + 10, s.y);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x, b.y + b.h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  drawOrb(ctx, o.x, o.y, accent, t + o.id * 100, { skin, flash: o.strikeFlash });
}

function hasCompanion(f) {
  return f.def.specials.some((s) => s.mech?.companion);
}

function drawStanceAura(ctx, f, st, t) {
  const accent = f.def.palette.accent;
  ctx.save();
  ctx.globalAlpha = Math.min(1, st.frames / 30) * 0.9;
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(f.x, f.y - 100, 10, f.x, f.y - 100, 120);
  g.addColorStop(0, rgba(accent, 0.18));
  g.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = g;
  ctx.fillRect(f.x - 120, f.y - 220, 240, 230);
  ctx.globalCompositeOperation = "source-over";
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "center";
  const glyphs = ["</>", "{ }", "=>", "vibes", "∇", "#"];
  for (let i = 0; i < 5; i += 1) {
    const a = t / 700 + (i * TAU) / 5;
    ctx.fillStyle = i % 2 ? accent : "#57ff9a";
    ctx.fillText(glyphs[i % glyphs.length], f.x + Math.cos(a) * 58, f.y - 110 + Math.sin(a) * 70);
  }
  ctx.fillStyle = accent;
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.fillText(`VIBE CODING ${Math.ceil(st.frames / 60)}s`, f.x, f.y - 232);
  ctx.restore();
}

function drawIcing(ctx, f, st) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, st.frames / 12);
  ctx.fillStyle = "#f7e7ef";
  ctx.beginPath();
  for (let i = 0; i <= 8; i += 1) {
    const x = f.x - 44 + i * 11;
    const y = -4 - (i % 2 ? 10 : 4);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.lineTo(f.x + 44, 2);
  ctx.lineTo(f.x - 44, 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f4a7c1";
  for (let i = 0; i < 4; i += 1) ctx.fillRect(f.x - 30 + i * 18, -10, 4, 4);
  ctx.restore();
}

function drawShadowCopies(ctx, f) {
  const m = f.move;
  if (f.state !== "attack" || !m?.mech?.hitLevels) return;
  const span = m.startup + m.active;
  if (f.moveFrame > span + 4) return;
  const n = m.mech.hitLevels.length;
  const k = Math.min(1, f.moveFrame / 6);
  for (let i = 0; i < n; i += 1) {
    const off = (i - (n - 1) / 2) * 34 * k;
    const lift = m.mech.hitLevels[i] === "overhead" ? -26 * k : 0;
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.translate(off * f.facing, lift);
    ctx.filter = "hue-rotate(10deg) saturate(1.6)";
    drawFighter(ctx, f);
    ctx.restore();
  }
}

/** Placed objects ("back") or companions, auras and effects ("front"). */
export function drawMechanics(ctx, match, t, layer) {
  const mech = match.mech;
  if (!mech) return;
  if (layer === "back") {
    for (const o of mech.objects) {
      if (o.look === "containment") drawContainment(ctx, o, t);
      else if (o.look === "cake") drawCake(ctx, o, t);
    }
    for (const f of match.fighters) {
      const slow = mech.status(f, "slow");
      if (slow && f.onField) drawIcing(ctx, f, slow);
      drawShadowCopies(ctx, f);
    }
    return;
  }
  for (const f of match.fighters) {
    if (!f.onField || f.state === "bench") continue;
    const st = mech.status(f, "stance");
    if (st) drawStanceAura(ctx, f, st, t);
    if (hasCompanion(f) && !mech.objects.some((o) => o.type === "companion" && o.ownerUid === f.uid) && !f.hidden) {
      const skin = mech.ctx.state.skins?.[f.side];
      drawOrb(ctx, f.x - f.facing * 34, f.y - 176 + Math.sin(t / 260 + f.uid) * 5, f.def.palette.accent, t, { skin, scale: 0.65 });
    }
  }
  for (const o of mech.objects) if (o.type === "companion") drawCompanion(ctx, match, o, t);
  for (const e of mech.effects) drawEffect(ctx, match, e);
}

function sideAccent(match, side, fallback = "#ffffff") {
  return match.point(side)?.def.palette.accent || fallback;
}

function drawEffect(ctx, match, e) {
  const k = e.age / e.life;
  const accent = e.palette?.accent || sideAccent(match, e.side ?? 0);
  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - k);
  ctx.textAlign = "center";
  switch (e.type) {
    case "aha": {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 20 + k * 70, 0, TAU);
      ctx.stroke();
      ctx.font = "900 30px system-ui, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = accent;
      ctx.lineWidth = 6;
      ctx.strokeText("AHA!", e.x, e.y - 40 - k * 20);
      ctx.fillText("AHA!", e.x, e.y - 40 - k * 20);
      break;
    }
    case "burst": {
      const r = 14 + k * 36 * (e.scale || 1);
      const g = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.4, rgba(accent, 0.8));
      g.addColorStop(1, rgba(accent, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, TAU);
      ctx.fill();
      break;
    }
    case "split":
    case "echo":
    case "loop":
    case "placed_fade":
    case "reinforce":
    case "wall_bounce": {
      ctx.strokeStyle = accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 8 + k * 30, 0, TAU);
      ctx.stroke();
      break;
    }
    case "trap_spring":
    case "zone_zap":
    case "zone_block": {
      ctx.strokeStyle = e.type === "trap_spring" ? "#f4a7c1" : accent;
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i += 1) {
        const a = (i * TAU) / 6 + k;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8);
        ctx.lineTo(e.x + Math.cos(a) * (18 + k * 30), e.y + Math.sin(a) * (18 + k * 30));
        ctx.stroke();
      }
      break;
    }
    case "prune": {
      ctx.font = "bold 28px system-ui, sans-serif";
      ctx.fillStyle = accent;
      ctx.fillText("✂", e.x, e.y - k * 20);
      ctx.font = "bold 12px monospace";
      ctx.fillText("pruned", e.x, e.y + 18 - k * 20);
      break;
    }
    case "paperclip":
    case "auto_tech":
    case "status_stance":
    case "status_break": {
      const text = e.text || (e.type === "status_stance" ? "vibing" : e.type === "status_break" ? "vibes broken" : "");
      if (!text) break;
      ctx.globalAlpha = Math.min(1, (1 - k) * 3);
      ctx.font = "bold 14px system-ui, sans-serif";
      const w = ctx.measureText(text).width + 18;
      ctx.fillStyle = "rgba(255,255,240,0.95)";
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(e.x - w / 2, e.y - 30, w, 26);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#222";
      ctx.fillText(text, e.x, e.y - 12);
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

// ------------------------------------------------------------------ projectiles

function drawTokenWord(ctx, p, accent) {
  ctx.fillStyle = rgba(accent, 0.9);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-36, -15, 72, 30, 8);
  else ctx.rect(-36, -15, 72, 30);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("vibes", 0, 1);
}

function drawToken(ctx, p, accent) {
  const parts = ["vi", "##b", "es", "_t", "ok", "##en"];
  ctx.rotate(Math.atan2(p.vy, Math.abs(p.vx)) * 0.6 * (p.vx < 0 ? -1 : 1));
  ctx.fillStyle = "#1b1020";
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.fillRect(-15, -11, 30, 22);
  ctx.strokeRect(-15, -11, 30, 22);
  ctx.fillStyle = "#57ff9a";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(parts[(p.def.mech.token ?? p.id) % parts.length], 0, 1);
}

function drawKernel(ctx, p, accent, t) {
  const s = 16;
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      const v = 0.35 + 0.65 * Math.abs(Math.sin(t / 120 + r * 1.7 + c * 2.3 + p.id));
      ctx.fillStyle = rgba(accent, v);
      ctx.fillRect(-24 + c * s, -24 + r * s, s - 2, s - 2);
    }
  }
  ctx.strokeStyle = "#fff4f8";
  ctx.lineWidth = 2;
  ctx.strokeRect(-25, -25, 50, 50);
}

function drawPlane(ctx, p) {
  ctx.rotate(Math.atan2(p.vy, Math.abs(p.vx)));
  ctx.fillStyle = "#f4f1ea";
  ctx.strokeStyle = "#5a6070";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.lineTo(-24, -5);
  ctx.lineTo(-24, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e0457b";
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-8, -22);
  ctx.lineTo(-14, -22);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-14, 22);
  ctx.lineTo(-8, 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-26, -10, 6, 20);
}

function drawWave(ctx, p, accent, t) {
  const s = p.def.scale || 1;
  ctx.scale(s, s);
  const g = ctx.createLinearGradient(0, -40, 0, 20);
  g.addColorStop(0, "#d9f2ff");
  g.addColorStop(0.45, "#2a6f97");
  g.addColorStop(1, rgba(accent, 0.6));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-40, 24);
  ctx.quadraticCurveTo(-30, -10, 4, -26 + Math.sin(t / 90) * 3);
  ctx.quadraticCurveTo(30, -34, 34, -12);
  ctx.quadraticCurveTo(20, -18, 14, -6);
  ctx.quadraticCurveTo(26, 8, 36, 24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  for (let i = 0; i < 4; i += 1) ctx.fillRect(-20 + i * 12, -14 - i * 4, 4, 3);
}

function drawPellet(ctx, p, accent) {
  ctx.fillStyle = rgba(accent, 0.35);
  ctx.fillRect(-28, -2, 22, 4);
  ctx.fillStyle = "#e8edff";
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawCherry(ctx) {
  ctx.fillStyle = "#e0245e";
  ctx.beginPath();
  ctx.arc(0, 2, 9, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(-4, -3, 3, 3);
  ctx.strokeStyle = "#3d6b2f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.quadraticCurveTo(4, -16, 10, -15);
  ctx.stroke();
}

function drawTransformer(ctx, accent, t) {
  ctx.fillStyle = rgba(accent, 0.25);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.fillRect(-88, -78, 176, 156);
  ctx.strokeRect(-88, -78, 176, 156);
  const rows = ["Attention", "Add & Norm", "MLP", "Add & Norm"];
  ctx.font = "bold 15px monospace";
  ctx.textAlign = "center";
  rows.forEach((r, i) => {
    ctx.fillStyle = i % 2 ? "#57ff9a" : "#ffffff";
    ctx.fillRect(-70, -64 + i * 36, 140, 26);
    ctx.fillStyle = "#1b1020";
    ctx.fillText(r, 0, -46 + i * 36);
  });
  ctx.fillStyle = rgba("#ffffff", 0.5 + 0.5 * Math.sin(t / 60));
  ctx.fillRect(-88, -82, 176, 4);
}

function drawJepa(ctx, p, accent, t) {
  const s = 74;
  const d = 22;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.fillStyle = rgba(accent, 0.12);
  ctx.fillRect(-s, -s, s * 2, s * 2);
  ctx.strokeRect(-s, -s, s * 2, s * 2);
  ctx.strokeRect(-s + d, -s - d, s * 2, s * 2);
  for (const [x, y] of [[-s, -s], [s, -s], [-s, s], [s, s]]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + d, y - d);
    ctx.stroke();
  }
  ctx.globalAlpha *= 0.4;
  for (let i = 0; i < 3; i += 1) {
    const ox = Math.sin(t / 100 + i * 2) * 20;
    ctx.beginPath();
    ctx.arc(ox, -30 + i * 12, 10, 0, TAU);
    ctx.moveTo(ox, -20 + i * 12);
    ctx.lineTo(ox, 30 + i * 6);
    ctx.stroke();
  }
}

function drawWhale(ctx, p, accent) {
  const rise = Math.min(1, p.age / 12);
  ctx.translate(0, 60 * (1 - rise));
  ctx.fillStyle = "rgba(20,40,120,0.45)";
  ctx.fillRect(-120, 4, 240, 14);
  const g = ctx.createLinearGradient(0, -230, 0, 0);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.3, accent);
  g.addColorStop(1, "#1a2a7a");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-60, 10);
  ctx.quadraticCurveTo(-80, -140, -10, -220);
  ctx.quadraticCurveTo(50, -160, 60, 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#0b1240";
  ctx.beginPath();
  ctx.arc(-14, -170, 6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px monospace";
  ctx.textAlign = "center";
  ctx.fillText("$5.6M", 0, -100);
}

/** Draws projectiles that carry a `mech.look`. Returns true when it drew `p`. */
export function drawMechProjectile(ctx, camera, p, t) {
  const look = p.def?.mech?.look;
  if (!look) return false;
  const accent = p.palette?.accent || "#ffffff";
  ctx.save();
  camera.apply(ctx);
  ctx.translate(p.x, p.y);
  if (look === "wave" || look === "pellet") ctx.scale(p.facing < 0 ? -1 : 1, 1);
  switch (look) {
    case "token_word":
      drawTokenWord(ctx, p, accent);
      break;
    case "token":
      drawToken(ctx, p, accent);
      break;
    case "kernel":
      drawKernel(ctx, p, accent, t);
      break;
    case "plane":
      if (p.vx < 0) ctx.scale(-1, 1);
      drawPlane(ctx, p);
      break;
    case "wave":
      drawWave(ctx, p, accent, t);
      break;
    case "pellet":
      drawPellet(ctx, p, accent);
      break;
    case "cherry":
      drawCherry(ctx);
      break;
    case "transformer":
      drawTransformer(ctx, accent, t);
      break;
    case "jepa":
      drawJepa(ctx, p, accent, t);
      break;
    case "whale":
      drawWhale(ctx, p, accent);
      break;
    default:
      ctx.restore();
      return false;
  }
  ctx.restore();
  return true;
}
