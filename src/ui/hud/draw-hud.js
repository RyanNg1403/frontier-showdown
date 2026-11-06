// Canvas fallback HUD drawn straight into the 1280x720 game canvas. It uses the same state shape as
// the DOM HUD (see hud.js) but skips portraits, the announcer and animations.
const GOLD = "#f2c14e";
const RED = "#a3141c";
const P_COLORS = ["#35c4ff", "#ff4057"];

export function drawHud(ctx, state) {
  if (!state?.sides?.length) return;
  ctx.save();
  ctx.font = "600 18px 'Barlow Semi Condensed', sans-serif";
  ctx.textBaseline = "middle";
  state.sides.slice(0, 2).forEach((side, i) => drawSide(ctx, side, i, state));
  drawTimer(ctx, state);
  ctx.restore();
}

function drawSide(ctx, side, i, state) {
  const flip = i === 1;
  const barW = 470;
  const x = flip ? 1280 - 40 - barW : 40;
  const f = side.fighters?.[side.active ?? 0];
  if (!f) return;
  const max = f.maxHealth || 1;
  const v = Math.max(0, f.health / max);
  const r = Math.max(v, (f.recoverable ?? f.health) / max);

  ctx.fillStyle = "rgba(6,7,11,0.85)";
  ctx.fillRect(x - 3, 37, barW + 6, 30);
  fillBar(ctx, x, 40, barW, 24, r, RED, flip);
  const grad = ctx.createLinearGradient(0, 40, 0, 64);
  grad.addColorStop(0, v <= 0.25 ? "#ff8a3d" : "#ffe680");
  grad.addColorStop(1, v <= 0.25 ? "#d9381e" : "#e9a23b");
  fillBar(ctx, x, 40, barW, 24, v, grad, flip);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 2, 38, barW + 4, 28);

  ctx.fillStyle = "#f3ede2";
  ctx.textAlign = flip ? "right" : "left";
  ctx.fillText(String(f.name || "").toUpperCase(), flip ? x + barW : x, 82);

  const rtw = state.roundsToWin || 2;
  for (let k = 0; k < rtw; k++) {
    const px = flip ? x + 14 + k * 22 : x + barW - 14 - k * 22;
    ctx.beginPath();
    ctx.arc(px, 82, 7, 0, Math.PI * 2);
    ctx.fillStyle = k < side.roundWins ? GOLD : "rgba(255,255,255,0.15)";
    ctx.fill();
  }

  if (state.mode === "2v2") {
    const p = side.fighters.find((_, idx) => idx !== (side.active ?? 0));
    if (p) {
      const pv = Math.max(0, p.health / (p.maxHealth || 1));
      const pr = Math.max(pv, (p.recoverable ?? p.health) / (p.maxHealth || 1));
      const px = flip ? x + barW - 200 : x;
      ctx.fillStyle = "rgba(6,7,11,0.85)";
      ctx.fillRect(px, 96, 200, 10);
      fillBar(ctx, px, 96, 200, 10, pr, RED, flip);
      fillBar(ctx, px, 96, 200, 10, pv, "#e9c86a", flip);
    }
  }

  const max2 = side.meterMax || 300;
  const segs = side.meterSegments || Math.round(max2 / 100);
  const segW = 110;
  const mx = flip ? 1280 - 40 - segs * (segW + 6) : 40;
  for (let k = 0; k < segs; k++) {
    const idx = flip ? segs - 1 - k : k;
    const t = Math.min(1, Math.max(0, ((side.meter || 0) - (idx * max2) / segs) / (max2 / segs)));
    const sx = mx + k * (segW + 6);
    ctx.fillStyle = "rgba(6,7,11,0.85)";
    ctx.fillRect(sx, 676, segW, 14);
    fillBar(ctx, sx, 676, segW, 14, t, t >= 1 ? "#7df9ff" : "#2a8fd6", flip);
  }

  if ((side.combo?.hits || 0) >= 2) {
    ctx.textAlign = flip ? "right" : "left";
    ctx.font = "700 56px Teko, Impact, sans-serif";
    ctx.fillStyle = GOLD;
    ctx.fillText(`${side.combo.hits} HITS`, flip ? 1240 : 40, 200);
    ctx.font = "600 20px 'Barlow Semi Condensed', sans-serif";
    ctx.fillStyle = "#f3ede2";
    ctx.fillText(`${Math.round(side.combo.damage)} DMG`, flip ? 1240 : 40, 236);
  }
  ctx.font = "600 14px 'Barlow Semi Condensed', sans-serif";
  ctx.fillStyle = P_COLORS[i];
  ctx.textAlign = flip ? "right" : "left";
  ctx.fillText(side.label || (side.control === "cpu" ? "CPU" : `P${i + 1}`), flip ? 1240 : 40, 22);
}

function fillBar(ctx, x, y, w, h, t, style, fromRight) {
  const fw = Math.max(0, Math.min(1, t)) * w;
  ctx.fillStyle = style;
  ctx.fillRect(fromRight ? x + w - fw : x, y, fw, h);
}

function drawTimer(ctx, state) {
  ctx.beginPath();
  ctx.arc(640, 56, 38, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(6,7,11,0.9)";
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.stroke();
  const t = state.timer;
  ctx.font = "700 48px Teko, Impact, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = Number.isFinite(t) && t <= 10 ? "#ff5a4a" : "#f3ede2";
  ctx.fillText(t == null || !Number.isFinite(t) ? "∞" : String(Math.ceil(Math.max(0, t))), 640, 60);
}
