import { STAGES, STAGE_GEOMETRY, loadStage, drawStage, clampCameraX } from "./index.js";

const params = new URLSearchParams(location.search);
const capture = params.has("capture");
const frozenTime = params.has("t") ? Number(params.get("t")) : null;
const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
const LAYERS = ["far", "mid", "floor", "near", "fg"];

const ui = {
  list: document.getElementById("stage-list"),
  name: document.getElementById("stage-name"),
  loc: document.getElementById("stage-loc"),
  notes: document.getElementById("stage-notes"),
  real: document.getElementById("stage-real"),
  sources: document.getElementById("stage-sources"),
  swatches: document.getElementById("swatches"),
  paletteNote: document.getElementById("palette-note"),
  autoPan: document.getElementById("auto-pan"),
  camX: document.getElementById("cam-x"),
  camXVal: document.getElementById("cam-x-val"),
  toggles: document.getElementById("layer-toggles"),
  guides: document.getElementById("show-guides"),
};

const state = {
  stage: null,
  meta: null,
  camX: params.has("x") ? Number(params.get("x")) : null,
  layers: new Set(params.get("layers")?.split(",") ?? [...LAYERS, "ambient"]),
  guides: params.has("guides") ? params.get("guides") !== "0" : !capture,
  autoPan: !capture && params.get("pan") !== "0",
  started: performance.now(),
};

if (capture) document.body.classList.add("capture");

function renderList() {
  ui.list.replaceChildren(...STAGES.map((stage, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `${i + 1}. ${stage.name}`;
    b.setAttribute("aria-pressed", String(stage.id === state.meta?.id));
    b.addEventListener("click", () => selectStage(stage.id));
    return b;
  }));
  ui.toggles.replaceChildren(...[...LAYERS, "ambient"].map((name) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = state.layers.has(name);
    input.addEventListener("change", () => {
      if (input.checked) state.layers.add(name);
      else state.layers.delete(name);
    });
    label.append(input, ` ${name}`);
    return label;
  }));
}

function renderInfo(meta) {
  document.title = `${meta.name} · Stage preview`;
  document.documentElement.style.setProperty("--accent", meta.palette.key);
  ui.name.textContent = meta.name;
  ui.loc.textContent = meta.location;
  ui.notes.textContent = meta.fieldNotes;
  const rw = meta.realWorld;
  ui.real.textContent = `${rw.event} · ${rw.venue}, ${rw.city} · ${rw.dateLabel} · labs: ${meta.labs.join(", ")}`;
  ui.sources.replaceChildren(...meta.sources.map((src) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = src.url;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = src.label;
    li.append(a);
    return li;
  }));
  ui.paletteNote.textContent = meta.palette.note;
  ui.swatches.replaceChildren(...meta.palette.swatches.map((hex) => {
    const s = document.createElement("span");
    s.style.background = hex;
    s.title = hex;
    return s;
  }));
  ui.camX.max = String(meta.camera.maxX);
}

async function selectStage(id) {
  const meta = STAGES.find((s) => s.id === id) ?? STAGES[0];
  state.meta = meta;
  renderList();
  renderInfo(meta);
  const url = new URL(location.href);
  url.searchParams.set("stage", meta.id);
  history.replaceState(null, "", url);
  state.stage = await loadStage(meta.id);
  if (state.camX === null) state.camX = meta.camera.startX;
}

function drawDummy(x, facing, color) {
  const g = STAGE_GEOMETRY.groundY;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(x - 44, g - 4, 88, 8);
  ctx.fillStyle = color;
  ctx.fillRect(x - 16, g - 200, 32, 34);          // head
  ctx.fillRect(x - 30, g - 162, 60, 76);          // torso
  ctx.fillRect(x - 26, g - 86, 22, 86);           // legs
  ctx.fillRect(x + 4, g - 86, 22, 86);
  ctx.fillRect(x + facing * 30 - (facing < 0 ? 46 : 0), g - 156, 46, 16); // guard arm
}

function drawGuides(meta, camX) {
  const { groundY, floorTop } = STAGE_GEOMETRY;
  ctx.save();
  ctx.globalAlpha = 0.85;
  drawDummy(meta.spawn.p1 - camX, 1, "rgba(232,194,122,0.55)");
  drawDummy(meta.spawn.p2 - camX, -1, "rgba(122,168,255,0.55)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ff4d6d";
  for (let x = 0; x < 1280; x += 16) ctx.fillRect(x, groundY, 8, 2);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (let x = 0; x < 1280; x += 16) ctx.fillRect(x, floorTop, 4, 2);
  ctx.font = "12px ui-monospace, monospace";
  ctx.fillStyle = "#ff4d6d";
  ctx.fillText(`groundY ${groundY}`, 8, groundY - 6);
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(`floorTop ${floorTop}`, 8, floorTop - 6);
  ctx.fillText(`camera.x ${Math.round(camX)}`, 1180, 18);
  ctx.restore();
}

let frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!state.stage) return;
  const meta = state.meta;
  const t = frozenTime ?? (now - state.started) / 1000;
  if (state.autoPan && ui.autoPan.checked) {
    const span = meta.camera.maxX - meta.camera.minX;
    state.camX = meta.camera.minX + span * (0.5 - 0.5 * Math.cos(t * 0.25));
  }
  state.camX = clampCameraX(state.camX, state.stage);
  ui.camX.value = String(Math.round(state.camX));
  ui.camXVal.textContent = String(Math.round(state.camX));
  const camera = { x: state.camX, y: 0, time: t };
  const layers = LAYERS.filter((l) => state.layers.has(l));
  const options = { layers, ambient: state.layers.has("ambient") };
  ctx.clearRect(0, 0, 1280, 720);
  drawStage(ctx, camera, "back", options);
  if (state.guides) drawGuides(meta, state.camX);
  drawStage(ctx, camera, "front", options);
  frames += 1;
  if (frames === 3) window.__stageFrameReady = true;
}

ui.autoPan.checked = state.autoPan;
ui.autoPan.addEventListener("change", () => { state.autoPan = ui.autoPan.checked; });
ui.camX.addEventListener("input", () => {
  state.autoPan = false;
  ui.autoPan.checked = false;
  state.camX = Number(ui.camX.value);
});
ui.guides.checked = state.guides;
ui.guides.addEventListener("change", () => { state.guides = ui.guides.checked; });
addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    state.autoPan = false;
    ui.autoPan.checked = false;
    state.camX += e.key === "ArrowLeft" ? -24 : 24;
  }
  const n = Number(e.key);
  if (n >= 1 && n <= Math.min(9, STAGES.length)) selectStage(STAGES[n - 1].id);
  if (e.key === "[" || e.key === "]") {
    const i = STAGES.findIndex((s) => s.id === state.meta.id);
    selectStage(STAGES[(i + (e.key === "]" ? 1 : -1) + STAGES.length) % STAGES.length].id);
  }
});

await selectStage(params.get("stage") ?? STAGES[0].id);
requestAnimationFrame(frame);
