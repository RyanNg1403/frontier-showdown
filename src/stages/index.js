// Stage module: metadata, loading and parallax rendering for the fighting stages.
//
//   const stage = await loadStage("gpu-datacenter");  // becomes the active stage
//   drawStage(ctx, { x: camX, time }, "back");        // far, mid, floor, near + ambient
//   ...draw fighters...
//   drawStage(ctx, { x: camX, time }, "front");       // foreground silhouettes
//
// Coordinates are logical 1280x720 px. World x runs 0..stage.bounds.right (1920);
// camera.x is the world x of the view's left edge, clamped to stage.camera.minX..maxX.
// Fighters' feet sit on stage.groundY (640). Draw with an untransformed context.
export { STAGES, STAGE_IDS, STAGE_GEOMETRY, getStageMeta } from "./stages.js";
export { loadStage, drawStage, clampCameraX, getActiveStage, setActiveStage } from "./renderer.js";
