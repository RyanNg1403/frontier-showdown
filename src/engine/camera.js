export const VIEW_W = 1280;
export const VIEW_H = 720;
const GROUND_SCREEN_Y = 640;
const HEAD_TOP = 50;
const MARGIN = 250;

/** Camera that keeps both point fighters framed. Pure math, no DOM. */
export class Camera {
  constructor({ minZoom = 0.9, maxZoom = 1.3 } = {}) {
    this.viewW = VIEW_W;
    this.viewH = VIEW_H;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;
    this.x = 0;
    this.zoom = maxZoom;
    this.y = -(GROUND_SCREEN_Y - VIEW_H / 2) / this.zoom;
    this.shakeX = 0;
    this.shakeY = 0;
    this.bounds = { left: -900, right: 900 };
  }

  target(fighters, bounds) {
    const live = fighters.filter(Boolean);
    if (!live.length) return { x: 0, y: this.y, zoom: this.zoom };
    let minX = Infinity;
    let maxX = -Infinity;
    let top = 0;
    for (const f of live) {
      minX = Math.min(minX, f.x);
      maxX = Math.max(maxX, f.x);
      top = Math.min(top, f.y - 200);
    }
    const width = maxX - minX + MARGIN * 2;
    const zoom = Math.max(this.minZoom, Math.min(this.maxZoom, VIEW_W / width));
    const halfW = VIEW_W / 2 / zoom;
    let x = (minX + maxX) / 2;
    const span = bounds.right - bounds.left;
    if (span <= halfW * 2) x = (bounds.left + bounds.right) / 2;
    else x = Math.max(bounds.left + halfW, Math.min(bounds.right - halfW, x));
    const rest = -(GROUND_SCREEN_Y - VIEW_H / 2) / zoom;
    const y = Math.min(rest, top + (VIEW_H / 2 - HEAD_TOP) / zoom);
    return { x, y, zoom };
  }

  snap(fighters, bounds = this.bounds) {
    this.bounds = bounds;
    const t = this.target(fighters, bounds);
    this.x = t.x;
    this.y = t.y;
    this.zoom = t.zoom;
  }

  update(fighters, bounds = this.bounds, shake = 0, rand = Math.random) {
    this.bounds = bounds;
    const t = this.target(fighters, bounds);
    this.zoom += (t.zoom - this.zoom) * 0.08;
    this.x += (t.x - this.x) * 0.18;
    this.y += (t.y - this.y) * 0.12;
    const halfW = VIEW_W / 2 / this.zoom;
    if (bounds.right - bounds.left > halfW * 2) {
      this.x = Math.max(bounds.left + halfW, Math.min(bounds.right - halfW, this.x));
    }
    const amp = Math.min(10, shake);
    this.shakeX = shake > 0 ? (rand() * 2 - 1) * amp : 0;
    this.shakeY = shake > 0 ? (rand() * 2 - 1) * amp * 0.6 : 0;
  }

  /** Aliases for modules that expect explicit centre coordinates. */
  get centerX() {
    return this.x - this.shakeX / this.zoom;
  }

  get centerY() {
    return this.y - this.shakeY / this.zoom;
  }

  get left() {
    return this.x - VIEW_W / 2 / this.zoom;
  }

  get right() {
    return this.x + VIEW_W / 2 / this.zoom;
  }

  get top() {
    return this.y - VIEW_H / 2 / this.zoom;
  }

  get bottom() {
    return this.y + VIEW_H / 2 / this.zoom;
  }

  apply(ctx, parallax = 1) {
    ctx.translate(VIEW_W / 2 + this.shakeX * parallax, VIEW_H / 2 + this.shakeY * parallax);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x * parallax, -this.y);
  }

  worldToScreen(x, y, parallax = 1) {
    return {
      x: VIEW_W / 2 + this.shakeX * parallax + (x - this.x * parallax) * this.zoom,
      y: VIEW_H / 2 + this.shakeY * parallax + (y - this.y) * this.zoom,
    };
  }

  toJSON() {
    return { x: this.x, y: this.y, zoom: this.zoom };
  }
}
