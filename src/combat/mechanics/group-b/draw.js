import { drawFighter } from "../../../engine/render.js";
import { fighterData } from "../core.js";

/**
 * Placeholder drawing for the Group B objects through the engine's entity drawing: each
 * stone, AI Factory rack and Self-Play echo gets a back-layer entity that lives as long as the
 * object, and a front-layer overlay draws the vision label and wind / bind marks.
 * Animation time comes from the match frame, so nothing here reads a clock.
 */
const DRAWERS = { stone: drawStone, turret: drawTurret, echo: drawEcho };

/** Spawn the back-layer entity that draws a mechanic object until it is gone. */
export function drawObjectEntity(match, obj) {
  const draw = DRAWERS[obj.type];
  if (!draw) return null;
  return match.spawnEntity({
    side: obj.side,
    layer: "back",
    update: (m) => !obj.dead && m.mech.objects.includes(obj),
    draw(ctx) {
      draw(ctx, obj, match.frame * 16.67);
    },
  });
}

function overlayNeeded(ctx) {
  if (ctx.state.visions?.size) return true;
  return ctx.match.fighters.some((f) => {
    const st = fighterData(f).status;
    return st.bind || st.slow?.wind;
  });
}

/** Keep a front-layer overlay entity alive while there is a vision label or a status mark to draw. */
export function syncOverlay(ctx) {
  const match = ctx.match;
  if (!overlayNeeded(ctx)) return;
  if (ctx.state.groupBOverlay && match.entities.includes(ctx.state.groupBOverlay)) return;
  ctx.state.groupBOverlay = match.spawnEntity({
    side: -1,
    layer: "front",
    update: () => overlayNeeded(ctx),
    draw(c) {
      const t = match.frame * 16.67;
      for (const f of match.fighters) drawStatusMarks(c, f, t);
      for (const v of ctx.state.visions?.values() || []) drawVision(c, v);
    },
  });
}

function hpBar(ctx, x, y, w, frac, color) {
  ctx.fillStyle = "rgba(10,8,20,0.8)";
  ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y, w * Math.max(0, frac), 4);
}

function drawStone(ctx, s, t) {
  const white = s.id % 2 === 0;
  const pulse = s.age >= s.armDelay ? 0.5 + 0.5 * Math.sin(t / 120 + s.id) : 0.2;
  if (s.invisible) ctx.globalAlpha = 0.16;
  ctx.strokeStyle = `rgba(139,124,255,${0.35 + pulse * 0.5})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(s.x, -2, 26 + pulse * 6, 7 + pulse * 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (s.invisible) return;
  const g = ctx.createRadialGradient(s.x - 4, -14, 1, s.x, -9, 13);
  g.addColorStop(0, white ? "#ffffff" : "#5a5a5a");
  g.addColorStop(1, white ? "#d9d4c8" : "#121212");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(s.x, -9, 13, 8, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTurret(ctx, tr, t) {
  const x = tr.x - 28;
  ctx.globalAlpha = Math.min(1, tr.life / 30);
  ctx.fillStyle = "#121417";
  ctx.fillRect(x - 3, -tr.h, 62, tr.h);
  ctx.fillStyle = "#1e2226";
  ctx.fillRect(x, -tr.h + 4, 56, tr.h - 6);
  for (let row = 0; row < 9; row += 1) {
    const y = -tr.h + 12 + row * 17;
    ctx.fillStyle = "#2b3036";
    ctx.fillRect(x + 4, y, 48, 11);
    for (let i = 0; i < 4; i += 1) {
      ctx.fillStyle = Math.sin(t / 90 + row * 1.7 + i * 2.3 + tr.id) > -0.2 ? "#76b900" : "#26400a";
      ctx.fillRect(x + 8 + i * 6, y + 4, 3, 3);
    }
  }
  ctx.fillStyle = "#76b900";
  ctx.fillRect(tr.x + tr.facing * 24 - 3, -116, 6, 8);
  hpBar(ctx, tr.x, -tr.h - 14, 56, tr.hp / tr.maxHp, "#76b900");
}

function drawEcho(ctx, e, t) {
  const b = e.body;
  ctx.save();
  ctx.globalAlpha = 0.5 + 0.08 * Math.sin(t / 140);
  ctx.fillStyle = "rgba(139,124,255,0.25)";
  ctx.beginPath();
  ctx.ellipse(b.x, 0, 46, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  drawFighter(ctx, b);
  ctx.restore();
  hpBar(ctx, b.x, -226, 50, e.hp / e.maxHp, "#8b7cff");
}

function drawStatusMarks(ctx, f, t) {
  if (!f.onField || f.hidden) return;
  const st = fighterData(f).status;
  if (st.slow?.wind) {
    ctx.strokeStyle = "rgba(155,231,255,0.75)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      const y = f.y - 20 - i * 26;
      const off = ((t / 6 + i * 40) % 80) - 40;
      ctx.beginPath();
      ctx.moveTo(f.x + off - 22, y);
      ctx.quadraticCurveTo(f.x + off, y - 8, f.x + off + 22, y);
      ctx.stroke();
    }
  }
  if (st.bind) {
    ctx.strokeStyle = "rgba(139,124,255,0.9)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.ellipse(f.x, f.y - 60 - i * 26, 38, 9, Math.sin(t / 200 + i) * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawVision(ctx, v) {
  const f = v.target;
  if (!f.onField) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, v.frames / 15);
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(20,8,40,0.9)";
  const text = `${v.confirmed ? "SEEN" : "VISION"}: ${v.text}`;
  ctx.strokeText(text, f.x, f.y - 236);
  ctx.fillStyle = "#e3d9ff";
  ctx.fillText(text, f.x, f.y - 236);
  ctx.restore();
}
