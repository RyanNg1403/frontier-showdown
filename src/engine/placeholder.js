/**
 * Procedural mannequin drawn when a fighter has no atlas. Poses are derived from the
 * fighter's state and move frame, and the walk/run cycle phase comes from distance
 * travelled (the same `anim.t` the atlas path uses), so feet stay planted.
 */

const TAU = Math.PI * 2;
const THIGH = 46;
const SHIN = 46;
const UPPER = 34;
const FORE = 32;
const HIP_Y = -94;
const NECK = 64;

const STANCE = {
  lean: 0.05, drop: 0,
  fThigh: 0.32, fShin: -0.12, bThigh: -0.3, bShin: 0.1,
  fUpper: 0.5, fFore: 2.4, bUpper: 0.3, bFore: 2.5,
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

function ease(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
}

/** Extension 0..1..0 over a move's startup, active and recovery. */
function extension(move, f) {
  if (!move) return 0;
  if (f < move.startup) return ease(f / move.startup);
  if (f < move.startup + move.active) return 1;
  return 1 - ease((f - move.startup - move.active) / Math.max(1, move.recovery));
}

function mix(a, b, t) {
  const out = {};
  for (const k of Object.keys(a)) out[k] = a[k] + ((b[k] ?? a[k]) - a[k]) * t;
  return out;
}

function attackPose(f) {
  const m = f.move;
  const e = extension(m, f.moveFrame);
  const id = m.id;
  const crouch = id.startsWith("c_");
  const base = crouch ? { ...STANCE, drop: 38, fThigh: 1.25, fShin: -1.35, bThigh: 0.4, bShin: -1.5, lean: 0.25 } : { ...STANCE };
  const target = { ...base };
  const hb = m.hitbox || (m.projectile ? { x: 60, y: -140, w: 40, h: 20 } : { x: 40, y: -140, w: 40, h: 20 });
  const hy = hb.y + hb.h / 2;
  if (m.grab || m.category === "throw") {
    Object.assign(target, { fUpper: 1.55, fFore: 1.6, bUpper: 1.45, bFore: 1.7, lean: 0.2 });
  } else if (m.projectile) {
    Object.assign(target, { fUpper: 1.6, fFore: 1.55, bUpper: 1.5, bFore: 1.6, lean: 0.15, fThigh: 0.45, bThigh: -0.45 });
  } else if (m.knockback.y > 0 && !crouch && m.limb === "leg") {
    Object.assign(target, { fThigh: 2.4, fShin: 0.2, bThigh: -0.2, bShin: 0.3, lean: -0.5, fUpper: -0.4, bUpper: -0.6 });
  } else if (m.knockback.y > 0) {
    Object.assign(target, { fUpper: 2.9, fFore: 3.05, lean: -0.15, drop: crouch ? 10 : 0, fThigh: 0.2, fShin: 0 });
  } else if (m.limb === "leg") {
    const reach = Math.atan2(hb.x + hb.w * 0.6, hy - HIP_Y);
    const ang = Math.max(0.3, Math.min(2.6, reach));
    Object.assign(target, crouch
      ? { fThigh: Math.PI / 2 - 0.05, fShin: 0.05, drop: 52, lean: 0.5, bThigh: 1.2, bShin: -1.6 }
      : { fThigh: ang, fShin: -0.05, bThigh: -0.15, bShin: 0.1, lean: -0.25, fUpper: 0.3, bUpper: -0.3 });
  } else {
    const shoulderY = HIP_Y + (crouch ? 38 : 0) - NECK + 8;
    const ang = Math.atan2(hb.x + hb.w * 0.8, hy - shoulderY);
    Object.assign(target, { fUpper: ang, fFore: ang, bUpper: 0.8, bFore: 2.5, lean: crouch ? 0.3 : 0.18 });
  }
  if (m.velocity.length && !m.knockback.y && m.limb !== "leg") target.lean = 0.42;
  if (f.airborne && m.air) Object.assign(target, { drop: 0, bThigh: 1.0, bShin: -1.5 });
  return mix(base, target, e);
}

function poseFor(f) {
  const t = f.anim.t;
  const sf = f.stateFrame;
  switch (f.state) {
    case "walk_fwd":
    case "walk_back":
    case "run": {
      const run = f.state === "run";
      const cycleFrames = 8;
      const phase = (t / cycleFrames) * TAU * (f.state === "walk_back" ? -1 : 1);
      const swing = run ? 0.75 : 0.42;
      const s = Math.sin(phase);
      const c = Math.cos(phase);
      return {
        ...STANCE,
        lean: run ? 0.32 : 0.08,
        drop: Math.abs(c) * (run ? 6 : 3),
        fThigh: s * swing + (run ? 0.2 : 0),
        fShin: -Math.max(0, -c) * (run ? 1.4 : 0.7),
        bThigh: -s * swing + (run ? 0.2 : 0),
        bShin: -Math.max(0, c) * (run ? 1.4 : 0.7),
        fUpper: run ? -s * 0.9 + 0.2 : 0.5,
        fFore: run ? 1.6 : 2.4,
        bUpper: run ? s * 0.9 + 0.2 : 0.3,
        bFore: run ? 1.6 : 2.5,
      };
    }
    case "dash_fwd":
      return { ...STANCE, lean: 0.4, fThigh: 0.9, fShin: -0.4, bThigh: -0.7, bShin: -0.6 };
    case "dash_back":
      return { ...STANCE, lean: -0.25, fThigh: 0.5, fShin: 0.1, bThigh: -0.2, bShin: -0.8 };
    case "crouch":
    case "jump_start":
    case "jump_land":
      return { ...STANCE, drop: f.state === "crouch" ? 40 : 22, fThigh: 1.25, fShin: -1.35, bThigh: 0.35, bShin: -1.45, lean: 0.2 };
    case "block":
    case "tech":
    case "breaker":
      return { ...STANCE, fUpper: 1.25, fFore: 2.95, bUpper: 1.05, bFore: 2.9, lean: -0.08 };
    case "crouch_block":
      return { ...STANCE, drop: 40, fThigh: 1.25, fShin: -1.35, bThigh: 0.35, bShin: -1.45, lean: 0.25, fUpper: 1.25, fFore: 2.95, bUpper: 1.05, bFore: 2.9 };
    case "blockstun": {
      const low = f.stunAnim === "crouch_block";
      return { ...STANCE, drop: low ? 40 : 0, fThigh: low ? 1.25 : 0.35, fShin: low ? -1.35 : -0.1, bThigh: low ? 0.35 : -0.35, bShin: low ? -1.45 : 0.1, lean: -0.15, fUpper: 1.25, fFore: 2.95, bUpper: 1.05, bFore: 2.9 };
    }
    case "jump":
    case "tag_in":
    case "assist_in":
    case "tag_out":
    case "assist_out": {
      const rising = f.vy < 0;
      return { ...STANCE, fThigh: rising ? 1.1 : 0.7, fShin: rising ? -1.7 : -0.9, bThigh: rising ? 0.6 : 0.1, bShin: -1.4, fUpper: 1.4, fFore: 2.0, bUpper: 0.9, bFore: 2.1 };
    }
    case "attack":
      return attackPose(f);
    case "throwing":
      return { ...STANCE, fUpper: 1.6, fFore: 1.4, bUpper: 1.4, bFore: 1.5, lean: 0.3 - Math.min(1, sf / 20) * 0.6 };
    case "hitstun":
    case "thrown": {
      const k = f.stunAnim === "hit_low" ? 0.25 : 0;
      return { ...STANCE, drop: k * 60, lean: -0.45, fUpper: -0.6, fFore: -0.2, bUpper: 0.9, bFore: 1.4, fThigh: 0.3 + k * 2, fShin: -k * 2, bThigh: -0.2, bShin: 0.1 };
    }
    case "dazed":
    case "finished":
      return { ...STANCE, lean: Math.sin(sf / 9) * 0.25, fUpper: 0.15, fFore: 0.3, bUpper: -0.1, bFore: 0.2, fThigh: 0.15, fShin: 0, bThigh: -0.15, bShin: 0.05 };
    case "victory":
    case "finisher":
      return { ...STANCE, lean: -0.05, fUpper: Math.PI - 0.2 + Math.sin(sf / 8) * 0.1, fFore: Math.PI - 0.1, bUpper: 0.2, bFore: 0.6, fThigh: 0.18, fShin: 0, bThigh: -0.18, bShin: 0 };
    case "intro":
      return { ...STANCE, lean: 0, fUpper: 0.7, fFore: 2.6, bUpper: 0.7, bFore: 2.6, fThigh: 0.12, fShin: 0, bThigh: -0.12, bShin: 0 };
    default:
      return { ...STANCE, drop: Math.sin((t / 10) * TAU) * 1.5 };
  }
}

/** Rotation (radians, negative = falling backwards) for lying / tumbling states. */
function bodyRotation(f) {
  switch (f.state) {
    case "juggle":
      return -Math.min(Math.PI / 2, 0.35 + f.stateFrame * 0.07);
    case "ko":
      return f.airborne ? -Math.min(Math.PI / 2, 0.3 + f.stateFrame * 0.06) : -Math.PI / 2;
    case "knockdown":
      return -Math.PI / 2;
    case "getup":
      return -Math.PI / 2 * (1 - ease(f.stateFrame / 22));
    default:
      return 0;
  }
}

function limb(ctx, x, y, a1, l1, a2, l2, color, width) {
  const kx = x + Math.sin(a1) * l1;
  const ky = y + Math.cos(a1) * l1;
  const ex = kx + Math.sin(a2) * l2;
  const ey = ky + Math.cos(a2) * l2;
  ctx.strokeStyle = "rgba(10,10,18,0.85)";
  ctx.lineWidth = width + 5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(kx, ky);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(kx, ky);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  return { x: ex, y: ey };
}

function shoe(ctx, foot, color) {
  ctx.fillStyle = "rgba(10,10,18,0.85)";
  ctx.beginPath();
  ctx.ellipse(foot.x + 6, foot.y - 1, 13, 7, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(foot.x + 6, foot.y - 1, 10.5, 5, 0, 0, TAU);
  ctx.fill();
}

export function drawPlaceholder(ctx, f) {
  const pal = f.def.palette;
  const pose = poseFor(f);
  const rot = bodyRotation(f);
  ctx.save();
  ctx.translate(f.x, f.y);
  const k = (f.def.stats.height || 200) / 200;
  ctx.scale(f.facing * k, k);
  if (rot) {
    ctx.translate(0, -16 * Math.min(1, Math.abs(rot) / (Math.PI / 2)));
    ctx.rotate(rot);
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const hipY = HIP_Y + pose.drop;
  const lean = pose.lean;
  const neckX = Math.sin(lean) * NECK;
  const neckY = hipY - Math.cos(lean) * NECK;
  const shoulder = { x: neckX * 0.92, y: neckY + 8 };

  const bFoot = limb(ctx, -4, hipY, pose.bThigh, THIGH, pose.bThigh + pose.bShin, SHIN, shade(pal.secondary, -18), 13);
  shoe(ctx, bFoot, shade(pal.shoes || "#202020", -25));
  limb(ctx, shoulder.x - 3, shoulder.y, pose.bUpper, UPPER, pose.bFore, FORE, shade(pal.primary, -35), 11);

  ctx.fillStyle = "rgba(10,10,18,0.85)";
  ctx.beginPath();
  ctx.moveTo(-19, hipY + 4);
  ctx.lineTo(19, hipY + 4);
  ctx.lineTo(neckX + 22, neckY + 2);
  ctx.lineTo(neckX - 22, neckY + 2);
  ctx.closePath();
  ctx.fill();
  const torso = ctx.createLinearGradient(0, neckY, 0, hipY);
  torso.addColorStop(0, shade(pal.primary, 20));
  torso.addColorStop(1, shade(pal.primary, -25));
  ctx.fillStyle = torso;
  ctx.beginPath();
  ctx.moveTo(-16, hipY + 1);
  ctx.lineTo(16, hipY + 1);
  ctx.lineTo(neckX + 19, neckY + 4);
  ctx.lineTo(neckX - 19, neckY + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = pal.secondary;
  ctx.fillRect(-17, hipY - 6, 34, 10);
  if (pal.shirt) {
    ctx.fillStyle = pal.shirt;
    ctx.beginPath();
    ctx.moveTo(neckX - 7, neckY + 4);
    ctx.lineTo(neckX + 9, neckY + 4);
    ctx.lineTo(neckX * 0.6 + 2, neckY + 34);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.arc(neckX * 0.55 + 6, neckY + 22, 3.5, 0, TAU);
    ctx.fill();
  }

  const fFoot = limb(ctx, 4, hipY, pose.fThigh, THIGH, pose.fThigh + pose.fShin, SHIN, pal.secondary, 14);
  shoe(ctx, fFoot, pal.shoes || "#202020");

  const headX = neckX + Math.sin(lean) * 18;
  const headY = neckY - Math.cos(lean) * 18;
  ctx.fillStyle = "rgba(10,10,18,0.85)";
  ctx.beginPath();
  ctx.arc(headX, headY, 18, 0, TAU);
  ctx.fill();
  ctx.fillStyle = pal.skin;
  ctx.beginPath();
  ctx.arc(headX, headY, 15.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = pal.hair;
  ctx.beginPath();
  ctx.arc(headX - 2, headY - 3, 15.5, Math.PI * 0.95, Math.PI * 2.05);
  ctx.fill();
  if (pal.glasses) {
    ctx.strokeStyle = pal.glasses;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(headX + 3, headY - 4, 10, 7);
    ctx.beginPath();
    ctx.moveTo(headX + 3, headY - 1);
    ctx.lineTo(headX - 8, headY - 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = "rgba(10,10,18,0.9)";
    ctx.fillRect(headX + 7, headY - 2, 3, 4);
  }

  limb(ctx, shoulder.x + 3, shoulder.y, pose.fUpper, UPPER, pose.fFore, FORE, pal.primary, 12);
  ctx.restore();
}
