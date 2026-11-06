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

export async function loadModules() {
  const [stage, vfx, ui, audio] = await Promise.all([
    tryImport("../stages/index.js", "stage"),
    tryImport("../vfx/index.js", "vfx"),
    tryImport("../ui/index.js", "ui"),
    tryImport("../audio/index.js", "audio"),
  ]);
  return {
    stage: stage && typeof stage.drawStage === "function" ? stage : null,
    vfx: vfx && typeof vfx.createVfx === "function" ? vfx : null,
    ui: ui && (typeof ui.mountUI === "function" || typeof ui.drawHud === "function") ? ui : null,
    audio: audio && typeof audio.createAudio === "function" ? audio : null,
  };
}
