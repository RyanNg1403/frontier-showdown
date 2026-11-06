/**
 * Optional sibling modules. Each loads with a dynamic import; a missing or broken module
 * resolves to null and the engine uses its own stub.
 */
async function tryImport(url, label) {
  try {
    return await import(url);
  } catch (error) {
    console.info(`[engine] ${label} module not loaded (${error.message}); using built-in stub.`);
    return null;
  }
}

/** `manifest.json` (static build or `npm start`), or null when absent. */
export { loadManifest } from "../platform/assets.js";

export async function loadModules(manifest = null) {
  const present = (name) => !manifest?.modules || manifest.modules[name] !== false;
  const load = (name, url) => (present(name) ? tryImport(url, name) : Promise.resolve(null));
  const [stage, vfx, ui, audio] = await Promise.all([
    load("stage", "../stages/index.js"),
    load("vfx", "../vfx/index.js"),
    load("ui", "../ui/index.js"),
    load("audio", "../audio/index.js"),
  ]);
  return {
    stage: stage && typeof stage.drawStage === "function" ? stage : null,
    vfx: vfx && typeof vfx.createVfx === "function" ? vfx : null,
    ui: ui && (typeof ui.mountUI === "function" || typeof ui.drawHud === "function") ? ui : null,
    audio: audio && typeof audio.createAudio === "function" ? audio : null,
  };
}
