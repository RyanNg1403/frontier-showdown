import { STAGE_GEOMETRY, STAGE_LAYERS } from "./layers.generated.js";

const { worldW, groundY, floorTop, viewW } = STAGE_GEOMETRY;

// Ambient coordinates: `layer` effects use that layer's native pixel space
// (what you see in assets/stages/<id>/<layer>.png); `world` effects use
// logical world pixels (x in [0, worldW], y in [0, 720]).
const DEFINITIONS = [
  {
    id: "openai-glass-atrium",
    name: "OpenAI Glass Atrium",
    lab: "openai",
    location: "Mission District campus, after hours",
    fieldNotes:
      "The tour group left hours ago. Rain sheets down a two-storey curtain wall while gold pendants hum over oak islands. Pale stone and polished inlay throw back every light, so nobody can hide a whiff.",
    palette: {
      note: "Pale limestone and warm oak lit by brushed-gold pendants, cut with deep night teal from the glass. Keep fighters' rim light warm; shadows fall to teal-black.",
      key: "#e8c27a",
      shadow: "#0b1414",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.45, speed: 0.7 },
      { type: "glow", layer: "mid", amp: 0.5, speed: 1.1, flicker: 0.02 },
      { type: "rain", region: { y0: 0, y1: 470 }, count: 90, color: "#9fd3d0", alpha: 0.22, parallax: 0.15 },
      { type: "shafts", layer: "far", xs: [120, 330, 540], top: 40, color: "#f2cf88", alpha: 0.07 },
      { type: "motes", count: 26, region: { y0: 260, y1: 600 }, color: "#f6dca0", parallax: 0.6, drift: "float" },
    ],
  },
  {
    id: "openai-compute-studio",
    name: "OpenAI Compute Studio",
    lab: "openai",
    location: "Training cluster, service level B2",
    fieldNotes:
      "Heat exchangers glow behind steel grates and the coolant lines never stop ticking. A broken spine of cabinets splits the bay. Vents breathe on a schedule, so footsies happen in the steam.",
    palette: {
      note: "Charcoal and gunmetal steel under deep amber service light, with ember-orange heat and a thin teal rim from the coolant runs. Highlights stay hot; blacks stay warm-brown, never blue.",
      key: "#ff9a3c",
      shadow: "#0d0b0a",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.6, speed: 0.45 },
      { type: "glow", layer: "near", amp: 0.7, speed: 1.6, flicker: 0.04 },
      { type: "haze", y: 470, h: 90, color: "#c86a2a", alpha: 0.32, parallax: 0.3, speed: 6 },
      { type: "steam", world: true, emitters: [{ x: 260, y: 572 }, { x: 1010, y: 572 }, { x: 1660, y: 572 }], color: "#d9c7b4", alpha: 0.45, rise: 220, period: 3.6 },
      { type: "motes", count: 34, region: { y0: 180, y1: 560 }, color: "#ffb35c", parallax: 0.8, drift: "rise" },
    ],
  },
  {
    id: "anthropic-reading-room",
    name: "Anthropic Reading Room",
    lab: "anthropic",
    location: "Library wing, the hour before close",
    fieldNotes:
      "Double-height oak stacks and living walls frame arched windows going violet at dusk. A shallow channel runs under the floor. The lamps flicker whenever someone lands a heavy, and the librarians keep score.",
    palette: {
      note: "Honey oak and terracotta warmed by amber lamplight, with moss-green living walls and a violet-to-ember dusk sky in the windows. Shadows are deep umber; the only cool hue is the window sky.",
      key: "#f0a64a",
      shadow: "#0f0804",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.5, speed: 0.6, flicker: 0.015 },
      { type: "glow", layer: "mid", amp: 0.55, speed: 0.9, flicker: 0.02 },
      { type: "glow", layer: "near", amp: 0.5, speed: 0.8 },
      { type: "shafts", layer: "far", xs: [140, 330, 515], top: 50, color: "#e9a35a", alpha: 0.08 },
      { type: "motes", count: 48, region: { y0: 120, y1: 600 }, color: "#f3c98a", parallax: 0.55, drift: "float" },
    ],
  },
  {
    id: "anthropic-living-studio",
    name: "Anthropic Living Studio",
    lab: "anthropic",
    location: "Conservatory studio, twilight",
    fieldNotes:
      "A curved iron-and-glass greenhouse over a reflecting pool, thick with palms, ferns and climbing vines. String lights come on at dusk and fireflies drift between the trellises. Mind the planters on the backswing.",
    palette: {
      note: "Sage and deep forest green under a dusky lilac sky, with terracotta pots and warm cream string lights. Greens carry the midtones; lilac does the rim light; warm cream is reserved for lights.",
      key: "#f4e1b0",
      shadow: "#070b0a",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.55, speed: 0.9, flicker: 0.01 },
      { type: "glow", layer: "mid", amp: 0.4, speed: 0.7 },
      { type: "glow", layer: "near", amp: 0.6, speed: 1.2 },
      { type: "fireflies", count: 30, region: { y0: 200, y1: 590 }, color: "#f8e58c", parallax: 0.65 },
      { type: "motes", count: 16, region: { y0: 0, y1: 560 }, color: "#b9a7c9", parallax: 0.9, drift: "fall" },
    ],
  },
  {
    id: "paris-action-hall",
    name: "Paris AI Action Hall",
    lab: "summit",
    location: "Grand Palais-inspired summit nave, closing session",
    fieldNotes:
      "Under a barrel vault of glass and bronze ironwork, the closing plenary has turned into a title fight. Delegates press against the velvet rope and the press pool's flashes go off on every knockdown.",
    palette: {
      note: "Limestone cream and oxidized bronze under a navy night vault, with plum banners and carpet and pale-blue screen light. Gold is the accent; plum and navy share the shadows.",
      key: "#e9d9b0",
      shadow: "#070a14",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.35, speed: 0.5, flicker: 0.01 },
      { type: "glow", layer: "mid", amp: 0.5, speed: 0.8 },
      { type: "glow", layer: "near", amp: 0.7, speed: 1.4, flicker: 0.05 },
      { type: "crowd", layer: "near", slice: 10, rate: 2.2 },
      { type: "flashes", layer: "near", rate: 1.6, yMin: 224, yMax: 246 },
      { type: "motes", count: 22, region: { y0: 60, y1: 420 }, color: "#d8d0ff", parallax: 0.3, drift: "float" },
    ],
  },
  {
    id: "ai-impact-expo",
    name: "AI Impact Expo Pavilion",
    lab: "summit",
    location: "Bharat Mandapam-inspired expo court, evening",
    fieldNotes:
      "A conch-curved pavilion roof, saffron light and video walls running neural-net visuals over the expo floor. Marigold garlands line the barrier where the crowd is loudest. Wide flanks give both fighters room to work.",
    palette: {
      note: "Saffron and marigold light against deep indigo architecture, with teal accents from the LED walls and warm white in the hanging lights. Indigo owns the shadows; saffron owns the highlights.",
      key: "#ffb648",
      shadow: "#030713",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.55, speed: 0.8, flicker: 0.02 },
      { type: "glow", layer: "mid", amp: 0.6, speed: 1.0, flicker: 0.03 },
      { type: "glow", layer: "near", amp: 0.7, speed: 1.5, flicker: 0.05 },
      { type: "crowd", layer: "near", slice: 10, rate: 2.6 },
      { type: "flashes", layer: "near", rate: 1.2, yMin: 226, yMax: 248 },
      { type: "motes", count: 30, region: { y0: 40, y1: 500 }, color: "#ffcf7a", parallax: 0.35, drift: "float" },
    ],
  },
  {
    id: "gpu-datacenter",
    name: "GPU Datacenter",
    lab: "frontier",
    location: "Hyperscale hall, cold aisle 7",
    fieldNotes:
      "Endless rows of GPU racks hum in a teal fog, and every status LED is a heartbeat of someone's training run. Cold air rises through the perforated floor. Red beacons sweep when the hall hits thermal limits.",
    palette: {
      note: "Near-black rack steel in a cold teal haze, pricked by green and cyan status LEDs, with yellow cable ladders and rare red warning beacons. Keep the midtones blue-green; red is for alarms only.",
      key: "#5fe0d0",
      shadow: "#020409",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.8, speed: 1.8, flicker: 0.08, blink: true },
      { type: "glow", layer: "mid", amp: 0.8, speed: 2.2, flicker: 0.1, blink: true },
      { type: "glow", layer: "near", amp: 0.6, speed: 1.4, flicker: 0.05 },
      { type: "beacon", layer: "far", points: [[131, 30], [534, 87], [148, 140]], color: "#ff3b30", rate: 1.3 },
      { type: "haze", y: 430, h: 120, color: "#1f6f73", alpha: 0.35, parallax: 0.25, speed: 4 },
      { type: "steam", world: true, emitters: [{ x: 420, y: 560 }, { x: 1180, y: 560 }, { x: 1720, y: 560 }], color: "#9fe3e8", alpha: 0.26, rise: 170, period: 4.4 },
    ],
  },
  {
    id: "deepmind-lab",
    name: "DeepMind Night Lab",
    lab: "deepmind",
    location: "King's Cross research floor, 2 a.m.",
    fieldNotes:
      "Rain over the London skyline, a wall-sized Go board replaying a famous game, and a protein fold turning slowly in its glass case. The researchers went home. The evaluation, apparently, did not.",
    palette: {
      note: "Midnight navy and cool grey under electric-blue screen light, with violet accents on the hologram and a few warm-white windows across the river. Blue does the key light; violet is the rim.",
      key: "#7aa8ff",
      shadow: "#01030c",
    },
    ambient: [
      { type: "glow", layer: "far", amp: 0.55, speed: 0.9, flicker: 0.03 },
      { type: "glow", layer: "mid", amp: 0.6, speed: 1.1, flicker: 0.03 },
      { type: "glow", layer: "near", amp: 0.6, speed: 1.2, flicker: 0.04 },
      { type: "rain", region: { y0: 40, y1: 440 }, count: 80, color: "#8fa6d8", alpha: 0.2, parallax: 0.15, layerClip: { layer: "far", x0: 0, x1: 383 } },
      { type: "scan", layer: "far", rect: [447, 37, 208, 141], color: "#7fb2ff", period: 3.2 },
      { type: "scan", layer: "far", rect: [393, 168, 87, 107], color: "#b48cff", period: 2.1 },
      { type: "motes", count: 18, region: { y0: 200, y1: 560 }, color: "#8fb6ff", parallax: 0.7, drift: "float" },
    ],
  },
];

export const STAGES = DEFINITIONS.map((def) => {
  const layers = STAGE_LAYERS[def.id];
  return Object.freeze({
    ...def,
    palette: { ...def.palette, swatches: layers.swatches },
    bounds: { left: 0, right: worldW, wallMargin: 56 },
    camera: { minX: 0, maxX: worldW - viewW, startX: (worldW - viewW) / 2 },
    groundY,
    floorTop,
    spawn: { p1: worldW / 2 - 200, p2: worldW / 2 + 200 },
    layers: layers.layers,
    px: layers.px,
  });
});

export const STAGE_IDS = STAGES.map((stage) => stage.id);

export function getStageMeta(id) {
  const stage = STAGES.find((entry) => entry.id === id);
  if (!stage) throw new Error(`Unknown stage "${id}". Known stages: ${STAGE_IDS.join(", ")}`);
  return stage;
}

export { STAGE_GEOMETRY };
