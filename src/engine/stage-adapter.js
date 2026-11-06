import { VIEW_H, VIEW_W } from "./camera.js";
import { assetUrl } from "../platform/assets.js";

const DEFAULT_BOUNDS = { left: -900, right: 900 };

/**
 * Normalizes a stage module's `loadStage` result into engine world space.
 *
 * Two conventions are accepted:
 * - Contract v2: `{ id, name, bounds: {left, right}, music }` already in engine space
 *   (x centred on 0, floor at y = 0). The camera is passed through untouched.
 * - Screen-space stages: the def (or `def.meta`) has a numeric `groundY` and bounds that
 *   start at 0, and `drawStage` wants `{x: left edge, y, zoom (about (640, groundY)), time}`.
 *   The engine centres the stage on x = 0 and translates the camera for each draw.
 */
export function adaptStageDef(id, raw) {
  const meta = raw?.meta ?? raw ?? {};
  const name = meta.name ?? raw?.name ?? id;
  const music = meta.music ?? raw?.music;
  const b = meta.bounds ?? raw?.bounds;
  if (typeof meta.groundY === "number" && b && Number.isFinite(b.left) && Number.isFinite(b.right)) {
    const offsetX = (b.left + b.right) / 2;
    const wall = b.wallMargin ?? 0;
    return {
      id: raw?.id ?? meta.id ?? id,
      name,
      music,
      raw,
      screenSpace: true,
      offsetX,
      groundY: meta.groundY,
      bounds: { left: b.left + wall - offsetX, right: b.right - wall - offsetX },
    };
  }
  return {
    id: raw?.id ?? id,
    name,
    music,
    raw,
    screenSpace: false,
    bounds: { left: b?.left ?? DEFAULT_BOUNDS.left, right: b?.right ?? DEFAULT_BOUNDS.right },
  };
}

/** Camera object handed to `drawStage` for a given stage def. */
export function stageCamera(def, camera) {
  if (!def?.screenSpace) return camera;
  const z = camera.zoom;
  return {
    x: camera.x + def.offsetX - VIEW_W / 2 - camera.shakeX / z,
    y: (def.groundY - VIEW_H / 2) / z + camera.y - camera.shakeY / z,
    zoom: z,
    time: performance.now() / 1000,
  };
}

/** Stage list for menus: `listStages()` when exported, else a `STAGES` array. */
export function listModuleStages(module) {
  if (!module) return null;
  if (typeof module.listStages === "function") {
    const list = module.listStages();
    if (Array.isArray(list) && list.length) return list;
  }
  if (Array.isArray(module.STAGES) && module.STAGES.length) {
    const asUrl = (src) => (src && !/^(\/|https?:|data:)/.test(src) ? assetUrl(src) : src);
    return module.STAGES.map((s) => ({
      id: s.id,
      name: s.name,
      lab: s.lab ?? s.labs?.[0],
      labs: s.labs ?? (s.lab ? [s.lab] : []),
      location: s.location,
      fieldNotes: s.fieldNotes,
      thumbnail: asUrl(s.thumbnail ?? s.preview ?? s.layers?.far?.src ?? s.layers?.mid?.src),
    }));
  }
  return null;
}
