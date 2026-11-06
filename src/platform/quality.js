/**
 * Automatic quality tier. The canvas keeps its 1280x720 logical space; the tier caps the backing
 * store at the display's CSS size times min(devicePixelRatio, dprCap), so a phone never renders
 * more pixels than it can show, and scales VFX particle bursts and stage ambience.
 *
 * The starting tier comes from device hints (memory, cores, coarse pointer, Save-Data); during a
 * match, sustained slow frames step the tier down. `?quality=high|medium|low` or
 * `localStorage["frontier-showdown.quality"] = '"low"'` forces a tier.
 */
import { local } from "./storage.js";

// atlasBudgetMB: decoded fighter-atlas bytes a match may hold at full resolution; above it the
// match loads half-resolution frames (a quarter of the memory).
export const TIERS = {
  high: { id: "high", dprCap: 2, particles: 1, ambient: 1, atlasBudgetMB: 200 },
  medium: { id: "medium", dprCap: 1.5, particles: 0.6, ambient: 0.6, atlasBudgetMB: 140 },
  low: { id: "low", dprCap: 1, particles: 0.35, ambient: 0.35, atlasBudgetMB: 64 },
};
const ORDER = ["high", "medium", "low"];
const SLOW_FRAME_MS = 22;
const SAMPLE = 90;

export function guessTier(nav = globalThis.navigator, win = globalThis) {
  const mem = nav?.deviceMemory ?? 8;
  const cores = nav?.hardwareConcurrency ?? 8;
  const coarse = Boolean(win?.matchMedia?.("(pointer: coarse)")?.matches);
  const saveData = Boolean(nav?.connection?.saveData);
  if (saveData || mem <= 2 || cores <= 2) return "low";
  if (mem <= 4 || cores <= 4 || coarse) return "medium";
  return "high";
}

export function createQuality({ forced = null } = {}) {
  const fromUrl = new URLSearchParams(globalThis.location?.search || "").get("quality");
  const pinned = [forced, fromUrl, local.get("quality", null)].find((t) => TIERS[t]) || null;
  let tier = pinned || guessTier();
  const listeners = new Set();
  const samples = new Float32Array(SAMPLE);
  let count = 0;
  let index = 0;
  let cooldown = 0;
  let downgrades = 0;

  function set(next) {
    if (!TIERS[next] || next === tier) return;
    tier = next;
    count = 0;
    listeners.forEach((fn) => fn(TIERS[tier]));
  }

  return {
    get tier() {
      return TIERS[tier];
    },
    get pinned() {
      return pinned;
    },
    get downgrades() {
      return downgrades;
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set,
    /** Backing-store scale for a canvas shown `cssWidth` CSS px wide. */
    scaleFor(cssWidth, logicalWidth = 1280, dpr = globalThis.devicePixelRatio || 1) {
      const px = cssWidth * Math.min(dpr, TIERS[tier].dprCap);
      return Math.max(0.5, Math.min(1, px / logicalWidth));
    },
    /** Feed one frame interval (ms) while a match is running. */
    sample(ms) {
      if (pinned || !(ms > 0) || ms > 250) return;
      samples[index] = ms;
      index = (index + 1) % SAMPLE;
      count = Math.min(SAMPLE, count + 1);
      if (cooldown > 0) {
        cooldown -= 1;
        return;
      }
      if (count < SAMPLE) return;
      let sum = 0;
      for (let i = 0; i < SAMPLE; i += 1) sum += samples[i];
      if (sum / SAMPLE > SLOW_FRAME_MS && tier !== "low") {
        downgrades += 1;
        set(ORDER[ORDER.indexOf(tier) + 1]);
        cooldown = SAMPLE * 3;
      }
    },
  };
}
