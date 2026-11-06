// Device helpers for phones and tablets: capability checks, fullscreen with landscape lock,
// crisp canvas sizing and safe-area insets.

const LOGICAL_W = 1280;
const LOGICAL_H = 720;
const SNAP = 0.12;

export const hasTouch = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || navigator.maxTouchPoints > 0);

export const isIOS = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone), (display-mode: fullscreen)").matches || navigator.standalone === true;

export const isFullscreen = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);

export function canFullscreen() {
  const el = document.documentElement;
  return Boolean(el.requestFullscreen || el.webkitRequestFullscreen) && document.fullscreenEnabled !== false;
}

/** Enter fullscreen and lock to landscape where the browser allows it. Must run inside a user gesture. */
export async function enterFullscreen() {
  const el = document.documentElement;
  try {
    if (!isFullscreen()) {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }
  } catch { /* denied or unsupported: keep playing windowed */ }
  try { await screen.orientation?.lock?.("landscape"); } catch { /* lock needs fullscreen on most browsers */ }
}

export async function exitFullscreen() {
  try { screen.orientation?.unlock?.(); } catch { /* ignore */ }
  try {
    if (document.exitFullscreen && document.fullscreenElement) await document.exitFullscreen();
    else if (document.webkitExitFullscreen && document.webkitFullscreenElement) document.webkitExitFullscreen();
  } catch { /* ignore */ }
}

let probe = null;
/** Safe-area insets in CSS px (notches, home indicator). */
export function safeInsets() {
  if (!probe) {
    probe = document.createElement("div");
    probe.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;"
      + "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
    document.body.append(probe);
  }
  const cs = getComputedStyle(probe);
  return { top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 };
}

/**
 * Size the 16:9 game box to the largest fit inside the safe area, snapping to a whole number of
 * device pixels per canvas pixel when that costs little, so pixel art stays even. When the canvas
 * is shown below 1:1 device pixels, smoothing beats dropped pixel columns.
 */
export function fitScreen(screenEl, canvas, { portrait = false } = {}) {
  const vv = window.visualViewport;
  const W = Math.round(vv?.width || window.innerWidth);
  const H = Math.round(vv?.height || window.innerHeight);
  const ins = safeInsets();
  const availW = Math.max(1, W - ins.left - ins.right);
  const availH = Math.max(1, (portrait ? Math.min(H * 0.5, availW * (LOGICAL_H / LOGICAL_W)) : H) - ins.top - ins.bottom);
  const dpr = window.devicePixelRatio || 1;
  let scale = Math.min(availW / LOGICAL_W, availH / LOGICAL_H);
  const device = scale * dpr;
  if (device >= 1 && device % 1 < SNAP) scale = Math.floor(device) / dpr;
  const w = Math.floor(LOGICAL_W * scale);
  const h = Math.floor(LOGICAL_H * scale);
  screenEl.style.width = `${w}px`;
  screenEl.style.height = `${h}px`;
  if (canvas) canvas.style.imageRendering = scale * dpr >= 1 ? "pixelated" : "auto";
  return { width: w, height: h, scale, devicePerPixel: scale * dpr, viewport: { width: W, height: H }, insets: ins };
}
