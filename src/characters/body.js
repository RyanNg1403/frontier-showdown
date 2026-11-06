import { DEFAULT_HURTBOXES, DEFAULT_PUSHBOX } from "../combat/boxes.js";

/**
 * Hurtboxes and pushbox for a fighter whose standing height (roster doc 0.1) differs from the
 * 200 px baseline. Heights scale with `height / 200`; widths scale with `width`.
 */
export function bodyFor(height, width = 1) {
  const k = height / 200;
  const scale = (b) => ({ x: Math.round(b.x * width), y: Math.round(b.y * k), w: Math.round(b.w * width), h: Math.round(b.h * k) });
  const hurtboxes = {};
  for (const [pose, boxes] of Object.entries(DEFAULT_HURTBOXES)) {
    hurtboxes[pose] = pose === "down" ? boxes.map((b) => ({ ...b })) : boxes.map(scale);
  }
  const pushbox = {};
  for (const [pose, p] of Object.entries(DEFAULT_PUSHBOX)) pushbox[pose] = { w: Math.round(p.w * width), h: Math.round(p.h * k) };
  return { hurtboxes, pushbox };
}
