import { registerSystem } from "../mechanics.js";
import { hash01 } from "./drift-cloud.js";
import { isDroppedOut } from "./intangible.js";
import { activeBeam } from "./tracking-beam.js";
import { activePath } from "./path-strike.js";

/**
 * Procedural drawing for the Group D mechanics, as one overlay entity per match (entities are
 * cleared every round, so the `group-d-visuals` system respawns it in `preStep`). World space.
 * Back layer (before fighters): super backdrops, the Golden Gate, attribution paths. Front
 * layer (after fighters and projectiles): beams, Marks, router icons, dropout masks, ghost
 * heads, feature tiles, Backpropagation lines, the obsession pull and the custom projectile
 * looks (`cloud`, `spark`, `tiles`). Marble constructs and delayed strikes draw themselves.
 */
const TAU = Math.PI * 2;
const STANCE_ICON = { striker: "S", grappler: "G", zoner: "Z", guard: "D" };
const STANCE_COLOR = { striker: "#ff8a3d", grappler: "#5fd06b", zoner: "#57b8ff", guard: "#d9a6ff" };

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ------------------------------------------------------------------ back layer

function drawBridge(ctx, trap, t) {
  const orange = "#e8562a";
  const fade = Math.min(1, trap.life / 20, (trap.maxLife - trap.life + 1) / 10);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.strokeStyle = rgba(orange, 0.25 + 0.1 * Math.sin(t / 200));
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(trap.x, 0, trap.w / 2 + 16, 10, 0, 0, TAU);
  ctx.stroke();
  ctx.translate(trap.x, 0);
  ctx.shadowColor = orange;
  ctx.shadowBlur = 10;
  ctx.fillStyle = orange;
  ctx.fillRect(-34, -8, 68, 4);
  for (const tx of [-18, 18]) {
    ctx.fillRect(tx - 2, -36, 4, 36);
    ctx.fillRect(tx - 4, -30, 8, 2);
    ctx.fillRect(tx - 4, -22, 8, 2);
  }
  ctx.strokeStyle = orange;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-36, -8);
  ctx.quadraticCurveTo(-27, -20, -18, -36);
  ctx.quadraticCurveTo(0, -12, 18, -36);
  ctx.quadraticCurveTo(27, -20, 36, -8);
  ctx.stroke();
  ctx.restore();
}

function drawPath(ctx, f, p, t) {
  const orange = "#e8562a";
  const x0 = f.x;
  const y0 = f.y - 110;
  const x1 = p.tx;
  const y1 = Math.min(0, p.ty) - 100;
  ctx.save();
  ctx.strokeStyle = rgba(orange, 0.85);
  ctx.lineWidth = p.marked ? 3 : 2;
  ctx.setLineDash([10, 6]);
  ctx.lineDashOffset = -t / 20;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  const mx = (x0 + x1) / 2;
  ctx.bezierCurveTo(mx, y0 - 60, mx, y1 - 60, x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  for (let i = 0; i <= 4; i += 1) {
    const k = i / 4;
    const bx = (1 - k) ** 3 * x0 + 3 * (1 - k) ** 2 * k * mx + 3 * (1 - k) * k * k * mx + k ** 3 * x1;
    const by = (1 - k) ** 3 * y0 + 3 * (1 - k) ** 2 * k * (y0 - 60) + 3 * (1 - k) * k * k * (y1 - 60) + k ** 3 * y1;
    ctx.fillStyle = i === 4 ? "#ffffff" : orange;
    ctx.beginPath();
    ctx.arc(bx, by, i === 4 ? 6 : 4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawWorlds(ctx, f, cfg) {
  const scenes = cfg.scenes || ["stars", "city", "lab"];
  const idx = Math.min(scenes.length - 1, Math.max(0, Math.floor((f.moveFrame - f.move.startup) / (cfg.every || 12))));
  if (f.moveFrame < f.move.startup - 4) return;
  const scene = scenes[idx];
  const x = f.x - 900;
  const w = 1800;
  ctx.save();
  ctx.globalAlpha = 0.85;
  if (scene === "stars") {
    ctx.fillStyle = "#070a1c";
    ctx.fillRect(x, -760, w, 760);
    for (let i = 0; i < 140; i += 1) {
      ctx.fillStyle = i % 5 ? "#ffffff" : "#3ccf9e";
      ctx.fillRect(x + hash01(i, 1) * w, -760 + hash01(i, 2) * 740, 2, 2);
    }
  } else if (scene === "city") {
    ctx.fillStyle = "#1b2233";
    ctx.fillRect(x, -760, w, 760);
    for (let i = 0; i < 24; i += 1) {
      const bw = 50 + hash01(i, 3) * 70;
      const bh = 160 + hash01(i, 4) * 380;
      const bx = x + i * 78;
      ctx.fillStyle = "#2c3650";
      ctx.fillRect(bx, -bh, bw, bh);
      if (i % 3 === 0) {
        ctx.strokeStyle = "#3ccf9e";
        ctx.lineWidth = 2;
        ctx.strokeRect(bx - 4, -bh - 4, bw + 8, bh * 0.4);
        ctx.fillStyle = "#3ccf9e";
        ctx.font = "12px monospace";
        ctx.fillText(["building", "car", "person", "tree"][i % 4], bx, -bh - 8);
      }
    }
  } else {
    const g = ctx.createLinearGradient(0, -760, 0, 0);
    g.addColorStop(0, "#fff3d6");
    g.addColorStop(1, "#f6c98a");
    ctx.fillStyle = g;
    ctx.fillRect(x, -760, w, 760);
    ctx.fillStyle = "rgba(107,39,55,0.35)";
    for (let i = 0; i < 10; i += 1) ctx.fillRect(x + 80 + i * 180, -300, 120, 18);
  }
  ctx.restore();
}

function drawChalkboard(ctx, f) {
  const k = f.moveFrame / f.move.total;
  const x = f.x + f.facing * (900 - k * 1600);
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = "#1f3b2f";
  ctx.fillRect(x - 160, -420, 320, 180);
  ctx.strokeStyle = "#8a6a3b";
  ctx.lineWidth = 8;
  ctx.strokeRect(x - 160, -420, 320, 180);
  ctx.fillStyle = "rgba(240,240,240,0.85)";
  ctx.font = "18px serif";
  ["p(v) = Σ e^-E(v,h) / Z", "goodness = Σ y²", "θ ← θ + η ∇ (pos − neg)", "no backward pass"].forEach((line, i) => ctx.fillText(line, x - 140, -385 + i * 36));
  ctx.restore();
}

// ------------------------------------------------------------------ front layer

function drawBeam(ctx, b, t) {
  const cfg = b.cfg;
  const gold = b.super;
  const color = gold ? "#ffd75a" : "#ffe14d";
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const s of b.segments) {
    const w = (cfg.thickness ?? 14) * (gold ? 1 : 0.7);
    ctx.strokeStyle = rgba(color, 0.25);
    ctx.lineWidth = w * 2.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(s.x0, s.y0);
    ctx.lineTo(s.x1, s.y1);
    ctx.stroke();
    ctx.strokeStyle = rgba(color, 0.9);
    ctx.lineWidth = w * 0.6;
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(1.5, w * 0.18);
    ctx.stroke();
    if (gold) {
      for (let i = 1; i <= 6; i += 1) {
        const k = ((i / 7 + t / 900) % 1);
        const gx = s.x0 + (s.x1 - s.x0) * k;
        const gy = s.y0 + (s.y1 - s.y0) * k;
        ctx.fillStyle = rgba("#fff6c8", 0.7);
        ctx.fillRect(gx - 3, gy - w, 6, w * 2);
      }
    }
  }
  ctx.globalCompositeOperation = "source-over";
  if (b.heads.length > 1) {
    for (const s of b.segments) {
      ctx.fillStyle = rgba("#ffe14d", 0.45);
      ctx.beginPath();
      ctx.arc(s.x0, s.y0, 13, 0, TAU);
      ctx.fill();
    }
  }
  if (cfg.stamp && b.hits >= (cfg.hits ?? 1)) {
    const s = b.segments[0];
    ctx.fillStyle = "#ffe14d";
    ctx.strokeStyle = "#151515";
    ctx.lineWidth = 6;
    ctx.font = "900 120px Georgia, serif";
    ctx.textAlign = "center";
    ctx.strokeText(cfg.stamp, b.tx, b.ty + 40);
    ctx.fillText(cfg.stamp, b.tx, b.ty + 40);
  }
  ctx.restore();
}

function drawMark(ctx, f, t) {
  const boxes = f.hurtboxes();
  ctx.save();
  ctx.strokeStyle = "#e8562a";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 4]);
  ctx.lineDashOffset = -t / 30;
  for (const b of boxes.slice(0, 3)) ctx.strokeRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
  ctx.setLineDash([]);
  const top = Math.min(...boxes.map((b) => b.y));
  ctx.fillStyle = "rgba(232,86,42,0.9)";
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("feature identified", f.x, top - 12);
  ctx.restore();
}

function drawRouter(ctx, f, st, order, t) {
  const head = { x: f.x, y: f.y - 236 };
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 14px system-ui, sans-serif";
  if (st?.menu) {
    order.forEach((name, i) => {
      const a = (i / order.length) * TAU + t / 400;
      const x = f.x + Math.cos(a) * 70;
      const y = f.y - 120 + Math.sin(a) * 34;
      const on = i === st.menu.highlight;
      ctx.fillStyle = rgba(STANCE_COLOR[name], on ? 0.95 : 0.4);
      ctx.beginPath();
      ctx.arc(x, y, on ? 16 : 11, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#151515";
      ctx.fillText(STANCE_ICON[name], x, y + 1);
    });
  }
  const active = [st?.stance, st?.second].filter(Boolean);
  active.forEach((name, i) => {
    const x = head.x + (i - (active.length - 1) / 2) * 30;
    ctx.fillStyle = STANCE_COLOR[name];
    ctx.beginPath();
    ctx.arc(x, head.y, 11, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#151515";
    ctx.fillText(STANCE_ICON[name], x, head.y + 1);
  });
  ctx.restore();
}

function drawDropout(ctx, f, frame) {
  const h = 200 * ((f.def.stats.height || 200) / 200);
  ctx.save();
  for (let i = 0; i < 70; i += 1) {
    const x = f.x - 40 + hash01(f.uid, frame, i * 2) * 80;
    const y = f.y - h + hash01(f.uid, frame, i * 2 + 1) * h;
    ctx.fillStyle = i % 4 ? "rgba(12,12,22,0.75)" : "rgba(192,200,216,0.9)";
    ctx.fillRect(Math.round(x / 6) * 6, Math.round(y / 6) * 6, 6, 6);
  }
  ctx.restore();
}

function drawReturnLine(ctx, e) {
  const a = Math.max(0, 1 - e.age / e.life);
  const l = { x0: e.x, y0: e.y, x1: e.x1, y1: e.y1 };
  const mids = [0.25, 0.5, 0.75];
  const yOff = (k) => (k === 0.5 ? -30 : k > 0 && k < 1 ? 20 : 0);
  ctx.save();
  ctx.strokeStyle = `rgba(192,200,216,${a})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(l.x0, l.y0);
  for (const k of mids) ctx.lineTo(l.x0 + (l.x1 - l.x0) * k, l.y0 + (l.y1 - l.y0) * k + yOff(k));
  ctx.lineTo(l.x1, l.y1);
  ctx.stroke();
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  for (const k of [0, ...mids, 1]) {
    ctx.beginPath();
    ctx.arc(l.x0 + (l.x1 - l.x0) * k, l.y0 + (l.y1 - l.y0) * k + yOff(k), 4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawCloud(ctx, p, t) {
  ctx.save();
  const glow = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 40);
  glow.addColorStop(0, "rgba(233,238,252,0.55)");
  glow.addColorStop(1, "rgba(192,200,216,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 40, 0, TAU);
  ctx.fill();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 26; i += 1) {
    const a = hash01(p.id, i, 1) * TAU + t / (400 + i * 20);
    const r = 8 + hash01(p.id, i, 2) * 34;
    ctx.fillStyle = i % 3 ? "rgba(192,200,216,0.55)" : "rgba(255,200,90,0.6)";
    ctx.fillRect(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.8, 3, 3);
  }
  ctx.restore();
}

function drawTiles(ctx, p, cfg) {
  const rows = cfg.rows || 1;
  const cols = cfg.cols || 3;
  const b = p.def.hitbox;
  const tw = b.w / cols;
  const th = Math.max(14, b.h / rows);
  ctx.save();
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = p.x + b.x + c * tw;
      const y = p.y + b.y + r * th;
      ctx.fillStyle = `hsl(${Math.floor(hash01(p.id, r, c) * 360)},45%,55%)`;
      ctx.fillRect(x + 1, y + 1, tw - 2, th - 2);
      ctx.strokeStyle = "#f4f1ea";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 1, y + 1, tw - 2, th - 2);
    }
  }
  ctx.restore();
}

function drawGhostHeads(ctx, f) {
  const m = f.move;
  const k = f.moveFrame - m.startup;
  if (k < -4 || k > m.active) return;
  ctx.save();
  for (let i = 0; i < 3; i += 1) {
    const lag = i * m.hitInterval;
    const reach = Math.max(0, Math.min(1, (k - lag + 4) / 6));
    if (reach <= 0) continue;
    const x = f.x + f.facing * (30 + reach * 90);
    ctx.fillStyle = `rgba(255,225,77,${0.5 - i * 0.1})`;
    ctx.beginPath();
    ctx.arc(x, f.y - 170 + i * 12, 15, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(255,225,77,0.6)";
  ctx.beginPath();
  ctx.moveTo(f.x, f.y - 168);
  ctx.lineTo(f.x + f.facing * 130, f.y - 160);
  ctx.stroke();
  ctx.restore();
}

function drawFeatureTiles(ctx, target, cfg, f) {
  const labels = cfg.labels || [];
  const k = f.moveFrame - f.move.startup;
  if (k < 0 || k > f.move.active + 6) return;
  ctx.save();
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  labels.forEach((label, i) => {
    const flipped = k >= i * f.move.hitInterval;
    const x = target.x - 60 + (i % 4) * 40;
    const y = target.y - 200 + Math.floor(i / 4) * 34;
    ctx.fillStyle = flipped ? "rgba(232,86,42,0.85)" : "rgba(255,255,255,0.75)";
    ctx.fillRect(x - 18, y - 13, 36, 26);
    ctx.fillStyle = flipped ? "#fff" : "#1f2b4a";
    ctx.fillText(label.slice(0, 7), x, y + 3);
  });
  ctx.restore();
}

function drawSpark(ctx, p, t) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(p.x, p.y, 9, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#c0c8d8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 18 + Math.sin(t / 60) * 3, 0, TAU);
  ctx.stroke();
  ctx.restore();
}


function drawPull(ctx, f, x) {
  ctx.save();
  ctx.strokeStyle = "rgba(232,86,42,0.6)";
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.moveTo(f.x, f.y - 100);
  ctx.lineTo(x, -24);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#e8562a";
  ctx.font = "bold 12px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("obsessed with the bridge", f.x, f.y - 230);
  ctx.restore();
}

const routerOf = (f) => f.def.specials.find((s) => s.mechanic === "stance-router")?.mechanicData || null;
const moveData = (f) => (f.state === "attack" ? f.move?.mechanicData : null);
const PROJECTILE_LOOKS = { cloud: drawCloud, spark: drawSpark, tiles: (ctx, p) => drawTiles(ctx, p, p.def.mech) };

function drawBack(ctx, match) {
  const t = match.frame * (1000 / 60);
  for (const f of match.fighters) {
    const data = moveData(f);
    if (data?.worlds) drawWorlds(ctx, f, data.worlds);
    if (data?.chalkboard) drawChalkboard(ctx, f);
  }
  for (const o of match.mech.objects) if (!o.dead && o.look === "golden_gate") drawBridge(ctx, o, t);
  for (const f of match.fighters) {
    const p = activePath(f);
    if (p) drawPath(ctx, f, p, t);
  }
}

function drawFront(ctx, match) {
  const mech = match.mech;
  const t = match.frame * (1000 / 60);
  for (const p of match.projectiles) {
    const draw = !p.dead && PROJECTILE_LOOKS[p.def?.mech?.look];
    if (draw) draw(ctx, p, t);
  }
  for (const f of match.fighters) {
    const b = activeBeam(f);
    if (b) drawBeam(ctx, b, t);
  }
  for (const e of mech.effects) if (e.type === "backprop_lines") drawReturnLine(ctx, e);
  for (const f of match.fighters) {
    if (f.state === "bench" || f.hidden || !f.onField) continue;
    const pull = mech.status(f, "obsessed");
    if (pull?.x !== undefined) drawPull(ctx, f, pull.x);
    if (mech.status(f, "mark")) drawMark(ctx, f, t);
    const router = routerOf(f);
    if (router) drawRouter(ctx, f, f.mech?.router, router.order, t);
    if (isDroppedOut(f)) drawDropout(ctx, f, match.frame);
    const data = moveData(f);
    if (data?.ghosts) drawGhostHeads(ctx, f);
    if (data?.tiles && !f.move.projectile) {
      const target = match.point(1 - f.side);
      if (target) drawFeatureTiles(ctx, target, data.tiles, f);
    }
  }
}

registerSystem("group-d-visuals", {
  preStep(ctx) {
    const match = ctx.match;
    if (match.entities.some((e) => e.kind === "group-d-visuals")) return;
    match.spawnEntity({
      kind: "group-d-visuals",
      update: () => true,
      drawBack(c) {
        drawBack(c, match);
      },
      drawFront(c) {
        drawFront(c, match);
      },
    });
  },
}, { order: 190 });
