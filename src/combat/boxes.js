/** Box helpers. Local boxes are relative to the feet anchor, face-right, y negative = up. */

export function toWorld(box, x, y, facing) {
  const wx = facing >= 0 ? x + box.x : x - box.x - box.w;
  return { x: wx, y: y + box.y, w: box.w, h: box.h };
}

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function intersectionCenter(a, b) {
  const x1 = Math.max(a.x, b.x);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.max(a.y, b.y);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

export function anyOverlap(listA, listB) {
  for (const a of listA) {
    for (const b of listB) {
      if (overlaps(a, b)) return [a, b];
    }
  }
  return null;
}

export const DEFAULT_HURTBOXES = Object.freeze({
  stand: [
    { x: -22, y: -196, w: 44, h: 40 },
    { x: -34, y: -158, w: 68, h: 82 },
    { x: -32, y: -78, w: 64, h: 78 },
  ],
  crouch: [
    { x: -24, y: -128, w: 48, h: 38 },
    { x: -38, y: -92, w: 76, h: 92 },
  ],
  air: [
    { x: -22, y: -186, w: 44, h: 40 },
    { x: -34, y: -148, w: 68, h: 96 },
  ],
  down: [{ x: -90, y: -40, w: 180, h: 40 }],
});

export const DEFAULT_PUSHBOX = Object.freeze({
  stand: { w: 64, h: 180 },
  crouch: { w: 68, h: 120 },
  air: { w: 54, h: 140 },
});

/**
 * Resolve horizontal pushbox overlap between two bodies {x, y, push:{w,h}}.
 * Bodies at a wall do not move; the other one takes the full push.
 */
export function resolvePush(a, b, left, right) {
  const aw = a.push.w / 2;
  const bw = b.push.w / 2;
  const aTop = a.y - a.push.h;
  const bTop = b.y - b.push.h;
  if (a.y <= bTop || b.y <= aTop) return false;
  const overlap = aw + bw - Math.abs(a.x - b.x);
  if (overlap <= 0) return false;
  let dir = Math.sign(a.x - b.x);
  if (dir === 0) dir = a.facing >= 0 ? -1 : 1;
  let aShare = overlap / 2;
  let bShare = overlap / 2;
  const aAtWall = (dir < 0 && a.x - aw <= left + 0.01) || (dir > 0 && a.x + aw >= right - 0.01);
  const bAtWall = (dir > 0 && b.x - bw <= left + 0.01) || (dir < 0 && b.x + bw >= right - 0.01);
  if (aAtWall && !bAtWall) {
    aShare = 0;
    bShare = overlap;
  } else if (bAtWall && !aAtWall) {
    aShare = overlap;
    bShare = 0;
  }
  a.x += dir * aShare;
  b.x -= dir * bShare;
  a.x = Math.max(left + aw, Math.min(right - aw, a.x));
  b.x = Math.max(left + bw, Math.min(right - bw, b.x));
  if (Math.abs(a.x - b.x) < aw + bw - 0.5) {
    if (a.x - aw <= left + 0.5 || a.x + aw >= right - 0.5) b.x = a.x - dir * (aw + bw);
    else a.x = b.x + dir * (aw + bw);
  }
  return true;
}
