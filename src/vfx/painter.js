// Pixel painter: effects draw in world coordinates, the painter snaps them to
// a low-resolution buffer (one art pixel = `pixelScale` screen pixels) so every
// effect shares the same chunky pixel grid regardless of camera zoom.

const TAU = Math.PI * 2;

export function quantizeAlpha(a) {
  if (a <= 0.04) return 0;
  if (a >= 0.96) return 1;
  return Math.round(a * 6) / 6;
}

export function createPainter(atlas) {
  const p = {
    ctx: null,
    add: null,
    norm: null,
    scale: 2,
    ox: 0,
    oy: 0,
    zoom: 1,
    atlas,
    target: "add",
    // Buffer-pixel bounds touched since begin(), per buffer, so the caller can clear and
    // composite only that region instead of the whole screen.
    dirty: { add: null, norm: null },
  };
  let cur = "add";

  p.begin = (addCtx, normCtx, camera, pixelScale) => {
    p.add = addCtx;
    p.norm = normCtx;
    p.scale = pixelScale;
    p.zoom = camera.zoom;
    p.ox = camera.x;
    p.oy = camera.y;
    p.dirty = { add: null, norm: null };
  };

  const select = (blend) => {
    cur = blend === "normal" ? "norm" : "add";
    p.ctx = p[cur];
    return p.ctx;
  };

  /** Grow the current buffer's dirty box by a buffer-pixel rect (Infinity marks it all). */
  p.mark = (x, y, w, h) => {
    const d = p.dirty[cur];
    const x1 = x + w;
    const y1 = y + h;
    if (!d) p.dirty[cur] = { x0: x, y0: y, x1, y1 };
    else {
      if (x < d.x0) d.x0 = x;
      if (y < d.y0) d.y0 = y;
      if (x1 > d.x1) d.x1 = x1;
      if (y1 > d.y1) d.y1 = y1;
    }
  };

  /** Direct buffer access for custom drawing; marks the whole buffer dirty. */
  p.use = (blend) => {
    const c = select(blend);
    p.mark(-Infinity, -Infinity, Infinity, Infinity);
    return c;
  };

  p.bx = (wx) => ((wx - p.ox) * p.zoom) / p.scale;
  p.by = (wy) => ((wy - p.oy) * p.zoom) / p.scale;
  p.bs = (len) => (len * p.zoom) / p.scale;

  p.alpha = (a) => {
    p.ctx.globalAlpha = quantizeAlpha(a);
    return p.ctx.globalAlpha > 0;
  };

  p.rect = (wx, wy, w, h, color, a = 1, blend = "add") => {
    const c = select(blend);
    if (!p.alpha(a)) return;
    c.fillStyle = color;
    const x = Math.round(p.bx(wx));
    const y = Math.round(p.by(wy));
    const rw = Math.max(1, Math.round(p.bs(w)));
    const rh = Math.max(1, Math.round(p.bs(h)));
    c.fillRect(x, y, rw, rh);
    p.mark(Math.min(x, x + rw), Math.min(y, y + rh), Math.abs(rw), Math.abs(rh));
  };

  p.dot = (wx, wy, size, color, a = 1, blend = "add") => {
    const c = select(blend);
    if (!p.alpha(a)) return;
    c.fillStyle = color;
    const s = Math.max(1, Math.round(p.bs(size)));
    const x = Math.round(p.bx(wx) - s / 2);
    const y = Math.round(p.by(wy) - s / 2);
    c.fillRect(x, y, s, s);
    p.mark(x, y, s, s);
  };

  p.line = (x0, y0, x1, y1, color, width = 2, a = 1, blend = "add") => {
    const c = select(blend);
    if (!p.alpha(a)) return;
    c.fillStyle = color;
    let ax = Math.round(p.bx(x0));
    let ay = Math.round(p.by(y0));
    const bx = Math.round(p.bx(x1));
    const by = Math.round(p.by(y1));
    const s = Math.max(1, Math.round(p.bs(width)));
    const half = Math.floor(s / 2);
    p.mark(Math.min(ax, bx) - half, Math.min(ay, by) - half, Math.abs(bx - ax) + s, Math.abs(by - ay) + s);
    const dx = Math.abs(bx - ax);
    const dy = -Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1;
    const sy = ay < by ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 2048; guard += 1) {
      c.fillRect(ax - half, ay - half, s, s);
      if (ax === bx && ay === by) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; ax += sx; }
      if (e2 <= dx) { err += dx; ay += sy; }
    }
  };

  p.ring = (wx, wy, r, color, thickness = 2, a = 1, blend = "add", squash = 1) => {
    const c = select(blend);
    if (!p.alpha(a)) return;
    c.fillStyle = color;
    const cx = p.bx(wx);
    const cy = p.by(wy);
    const br = p.bs(r);
    const t = Math.max(1, Math.round(p.bs(thickness)));
    const ry = Math.abs(br * squash);
    p.mark(Math.floor(cx - br) - t, Math.floor(cy - ry) - t, Math.ceil(br * 2) + t * 2 + 1, Math.ceil(ry * 2) + t * 2 + 1);
    const steps = Math.max(12, Math.ceil(br * 6.3));
    let lx = null;
    let ly = null;
    for (let i = 0; i < steps; i += 1) {
      const ang = (i / steps) * TAU;
      const x = Math.round(cx + Math.cos(ang) * br);
      const y = Math.round(cy + Math.sin(ang) * br * squash);
      if (x === lx && y === ly) continue;
      c.fillRect(x - (t >> 1), y - (t >> 1), t, t);
      lx = x;
      ly = y;
    }
  };

  p.disc = (wx, wy, r, color, a = 1, blend = "add", squash = 1) => {
    const c = select(blend);
    if (!p.alpha(a)) return;
    c.fillStyle = color;
    const cx = Math.round(p.bx(wx));
    const cy = Math.round(p.by(wy));
    const br = Math.max(0.5, p.bs(r));
    const ry = Math.max(0.5, br * squash);
    p.mark(cx - Math.ceil(br) - 1, cy - Math.ceil(ry) - 1, Math.ceil(br) * 2 + 3, Math.ceil(ry) * 2 + 3);
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y += 1) {
      const k = 1 - (y * y) / (ry * ry);
      if (k < 0) continue;
      const half = Math.round(Math.sqrt(k) * br);
      c.fillRect(cx - half, cy + y, half * 2 + 1, 1);
    }
  };

  // Two-tone pixel puff used by dust: lit top-left, shaded bottom-right.
  p.puff = (wx, wy, r, light, mid, dark, a = 1) => {
    p.disc(wx + r * 0.18, wy + r * 0.2, r, dark, a, "normal");
    p.disc(wx, wy, r * 0.92, mid, a, "normal");
    p.disc(wx - r * 0.28, wy - r * 0.3, r * 0.5, light, a, "normal");
  };

  p.has = (name) => Boolean(p.atlas && p.atlas.image && p.atlas.frames[name]);

  // Draws a named atlas sprite centered at (wx, wy). `scale` is in art pixels
  // per atlas pixel, so 1 means native size on the shared pixel grid.
  p.stamp = (name, wx, wy, o = {}) => {
    const f = p.atlas && p.atlas.frames[name];
    if (!f || !p.atlas.image) return false;
    const blend = o.blend || f.blend || "add";
    const c = select(blend === "add" ? "add" : "normal");
    if (!p.alpha(o.alpha ?? 1)) return true;
    const sx = (o.scale ?? 1) * (o.scaleX ?? 1) * p.zoom;
    const sy = (o.scale ?? 1) * (o.scaleY ?? 1) * p.zoom;
    const w = Math.max(1, Math.round(f.w * sx));
    const h = Math.max(1, Math.round(f.h * sy));
    const cx = Math.round(p.bx(wx));
    const cy = Math.round(p.by(wy));
    const reach = o.rot ? Math.ceil(Math.hypot(w, h) / 2) + 1 : 0;
    if (reach) p.mark(cx - reach, cy - reach, reach * 2, reach * 2);
    else p.mark(cx - (Math.abs(w) >> 1) - 1, cy - (Math.abs(h) >> 1) - 1, Math.abs(w) + 2, Math.abs(h) + 2);
    if (o.rot || o.flipX) {
      c.save();
      c.translate(cx, cy);
      if (o.rot) c.rotate(Math.round(o.rot / (Math.PI / 8)) * (Math.PI / 8));
      if (o.flipX) c.scale(-1, 1);
      c.drawImage(p.atlas.image, f.x, f.y, f.w, f.h, -(w >> 1), -(h >> 1), w, h);
      c.restore();
    } else {
      c.drawImage(p.atlas.image, f.x, f.y, f.w, f.h, cx - (w >> 1), cy - (h >> 1), w, h);
    }
    return true;
  };

  // Jagged lightning bolt between two points; `rand` keeps it deterministic.
  p.bolt = (x0, y0, x1, y1, color, rand, jag = 10, width = 2, a = 1) => {
    const segs = 6;
    let px = x0;
    let py = y0;
    const nx = -(y1 - y0);
    const ny = x1 - x0;
    const nl = Math.hypot(nx, ny) || 1;
    for (let i = 1; i <= segs; i += 1) {
      const t = i / segs;
      const off = i === segs ? 0 : (rand() - 0.5) * 2 * jag;
      const qx = x0 + (x1 - x0) * t + (nx / nl) * off;
      const qy = y0 + (y1 - y0) * t + (ny / nl) * off;
      p.line(px, py, qx, qy, color, width, a);
      px = qx;
      py = qy;
    }
  };

  return p;
}
