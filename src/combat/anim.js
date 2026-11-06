import { ANIM_FALLBACKS } from "./constants.js";

/** Pick the first animation name the atlas actually has, following the fallback chain. */
export function resolveAnim(atlas, name) {
  if (!atlas?.animations) return name;
  if (atlas.animations[name]) return name;
  for (const alt of ANIM_FALLBACKS[name] || []) {
    if (atlas.animations[alt]) return alt;
    for (const alt2 of ANIM_FALLBACKS[alt] || []) if (atlas.animations[alt2]) return alt2;
  }
  return atlas.animations.idle ? "idle" : Object.keys(atlas.animations)[0];
}

/** Map a move frame onto an attack animation frame, honouring a `hit` event when present. */
export function attackFrameIndex(animDef, move, moveFrame) {
  const n = animDef?.frames?.length || 1;
  if (n <= 1 || !move) return 0;
  const f = Math.max(0, moveFrame - 1);
  const hitEvent = (animDef.events || []).find((e) => e.type === "hit" || e.type === "active");
  const startupFrames = Math.max(1, move.startup - 1);
  const rest = Math.max(1, move.total - startupFrames);
  if (hitEvent && hitEvent.frame > 0 && hitEvent.frame < n) {
    const k = hitEvent.frame;
    if (f < startupFrames) return Math.min(k - 1, Math.floor((f / startupFrames) * k));
    return Math.min(n - 1, k + Math.floor(((f - startupFrames) / rest) * (n - k)));
  }
  return Math.min(n - 1, Math.floor((f / Math.max(1, move.total)) * n));
}

const ONE_SHOT = new Set([
  "jump_start", "jump_land", "knockdown", "getup", "ko", "hit_high", "hit_low", "throw", "tag_in",
  "tag_out", "dash_back", "dash_fwd", "intro", "finisher", "thrown",
]);

export function isLooping(name, animDef) {
  if (typeof animDef?.loop === "boolean") return animDef.loop;
  return !ONE_SHOT.has(name);
}

/** Frame index for a time/distance-driven animation. `t` is in animation frames. */
export function cycleFrameIndex(animDef, t, name = "") {
  const n = animDef?.frames?.length || 1;
  const i = Math.floor(t);
  if (!isLooping(name, animDef)) return Math.max(0, Math.min(n - 1, i));
  return ((i % n) + n) % n;
}

export const LOCOMOTION = new Set(["walk_fwd", "walk_back", "run"]);
