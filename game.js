const WORLD = { width: 2560, height: 1600, cell: 40 };
const DISTRICT = { width: 1280, height: 800 };
const LEGACY_EXPANSION = DISTRICT.width / 960;
const POWER_BLAST_SPEED = 640;
const POWER_BLAST_WINDUP = 0.32;
const SOUL_SALVO_SPEED = 540;
const SOUL_SALVO_WINDUP = 0.36;
const RIFT_REND_RANGE = 184;
const RIFT_REND_HALF_ANGLE = 0.84;
const RIFT_REND_WINDUP = 0.42;
const RIFT_REND_COOLDOWN = 5.2;
const RIFT_RUSH_SPEED = 690;
const RIFT_RUSH_WINDUP = 0.42;
const RIFT_RUSH_COOLDOWN = 8.6;
const RIFT_RUSH_MAX_TRAVEL = 430;
const PLAYER_SHOT_SPEED = 780;
const PLAYER_SHOT_INTERVAL = 0.38;
const CHARACTER_SPRITE_WIDTH = 100;
const CHARACTER_SPRITE_HEIGHT = 110;
const SURVIVAL_SECONDS = 75;
const TACTIC_DECISION_INTERVAL = 820;
const TACTIC_DECISION_MIN_GAP = 650;
const PLAN_COMMITMENT = 3.8;
const MIRROR_CLONE_DURATION = 3.2;
const PHASE_DASH_COOLDOWN = 3.1;
const PHASE_AFTERIMAGE_DURATION = 0.46;
const GHOST_SAFE_GAP = 360;
const GHOST_PATH_CLEARANCE = 180;
const DIFFICULTY_SETTINGS = {
  calm: { speed: 0.86, cooldown: 0.9, label: "Calm" },
  standard: { speed: 1, cooldown: 1, label: "Standard" },
  nightmare: { speed: 1.14, cooldown: 1.18, label: "Nightmare" },
};
function readPreference(key, fallback) {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writePreference(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Keep the live setting for this session when storage is unavailable.
  }
}

const storedDifficulty = readPreference("jevil.difficulty", "standard");
let selectedDifficulty = Object.hasOwn(DIFFICULTY_SETTINGS, storedDifficulty) ? storedDifficulty : "standard";
const storedMusicVolume = Number(readPreference("jevil.musicVolume", "55"));
const musicThemes = {
  office: { root: 110, tempo: 108, notes: [0, 3, 7, 10, 7, 3, 5, 10, 12, 10, 7, 3, 5, 7, 3, 0] },
  cinder: { root: 82.41, tempo: 116, notes: [0, 3, 5, 10, 7, 5, 3, 12, 10, 7, 5, 3, 7, 10, 5, 0] },
  archive: { root: 98, tempo: 100, notes: [0, 5, 7, 12, 10, 7, 5, 3, 7, 10, 12, 7, 5, 3, 5, 0] },
  garden: { root: 123.47, tempo: 104, notes: [0, 3, 7, 12, 10, 7, 5, 3, 7, 10, 12, 15, 12, 10, 7, 3] },
  vault: { root: 92.5, tempo: 112, notes: [0, 7, 10, 12, 7, 3, 10, 15, 12, 10, 7, 3, 5, 10, 7, 0] },
  rift: { root: 87.31, tempo: 120, notes: [0, 3, 10, 7, 5, 12, 10, 3, 7, 15, 12, 10, 5, 7, 3, 0] },
};
const music = {
  context: null, output: null, timer: 0, nextTime: 0, step: 0, theme: "office", intensity: 0,
  enabled: readPreference("jevil.musicEnabled", "true") !== "false",
  volume: Number.isFinite(storedMusicVolume) ? clamp(storedMusicVolume, 0, 100) / 100 : 0.55,
};
const baseLevels = [
  {
    id: "crossing",
    name: "OpenAI Glass Atrium",
    biome: "office",
    topology: "Open hall with paired pillars, a broad central desk, and two lower benches.",
    chokepoints: [{ x: 640, y: 332, name: "desk approach" }, { x: 640, y: 491, name: "lower passage" }],
    playerStart: { x: 73, y: 83 },
    jevStart: { x: 510, y: 370 },
    blocks: [
      { x: 235, y: 126, w: 74, h: 125, kind: "pillar" },
      { x: 650, y: 126, w: 74, h: 125, kind: "pillar" },
      { x: 357, y: 267, w: 246, h: 78, kind: "desk" },
      { x: 198, y: 411, w: 143, h: 48, kind: "bench" },
      { x: 671, y: 411, w: 143, h: 48, kind: "bench" },
    ],
  },
  {
    id: "cinder",
    name: "OpenAI Compute Studio",
    biome: "cinder",
    topology: "A broken central spine creates a narrow crossing, while furnace islands split the outer lanes.",
    chokepoints: [{ x: 480, y: 300, name: "broken spine" }, { x: 590, y: 285, name: "furnace cut-through" }],
    playerStart: { x: 72, y: 520 },
    jevStart: { x: 850, y: 78 },
    blocks: [
      { x: 192, y: 92, w: 146, h: 72, kind: "vent" },
      { x: 192, y: 348, w: 146, h: 72, kind: "vent" },
      { x: 405, y: 88, w: 82, h: 178, kind: "obelisk" },
      { x: 473, y: 334, w: 82, h: 178, kind: "obelisk" },
      { x: 620, y: 118, w: 153, h: 78, kind: "furnace" },
      { x: 620, y: 404, w: 153, h: 78, kind: "furnace" },
      { x: 313, y: 238, w: 70, h: 110, kind: "pillar" },
      { x: 725, y: 245, w: 70, h: 110, kind: "pillar" },
    ],
  },
  {
    id: "drowned",
    name: "Anthropic Reading Room",
    biome: "archive",
    topology: "Offset rows of flooded shelves form a weaving maze with several tight turns and long sightlines.",
    chokepoints: [{ x: 480, y: 180, name: "upper shelf gap" }, { x: 480, y: 300, name: "central aisle" }],
    playerStart: { x: 884, y: 520 },
    jevStart: { x: 82, y: 78 },
    blocks: [
      { x: 150, y: 104, w: 184, h: 42, kind: "shelf" },
      { x: 402, y: 104, w: 238, h: 42, kind: "shelf" },
      { x: 710, y: 104, w: 150, h: 42, kind: "shelf" },
      { x: 250, y: 214, w: 174, h: 42, kind: "shelf" },
      { x: 523, y: 214, w: 188, h: 42, kind: "shelf" },
      { x: 132, y: 324, w: 184, h: 42, kind: "shelf" },
      { x: 397, y: 324, w: 226, h: 42, kind: "shelf" },
      { x: 708, y: 324, w: 156, h: 42, kind: "shelf" },
      { x: 238, y: 434, w: 184, h: 42, kind: "shelf" },
      { x: 515, y: 434, w: 220, h: 42, kind: "shelf" },
    ],
  },
];
function scaleLegacyLevel(level) {
  const scalePoint = (point) => ({ x: Math.round(point.x * LEGACY_EXPANSION), y: Math.round(point.y * LEGACY_EXPANSION) });
  return {
    ...level,
    playerStart: scalePoint(level.playerStart),
    jevStart: scalePoint(level.jevStart),
    blocks: level.blocks.map((block) => ({
      ...block,
      x: Math.round(block.x * LEGACY_EXPANSION),
      y: Math.round(block.y * LEGACY_EXPANSION),
      w: Math.round(block.w * LEGACY_EXPANSION),
      h: Math.round(block.h * LEGACY_EXPANSION),
    })),
    chokepoints: level.chokepoints.map((point) => ({ ...scalePoint(point), name: point.name })),
    hazards: level.id === "cinder"
      ? [
          { x: 448, y: 264, w: 100, h: 74, kind: "steam", period: 8.2, activeFor: 2, warningFor: 1.4, phase: 3.2 },
          { x: 812, y: 520, w: 104, h: 76, kind: "steam", period: 8.2, activeFor: 2, warningFor: 1.4, phase: 7.1 },
          { x: 342, y: 638, w: 102, h: 72, kind: "steam", period: 8.2, activeFor: 2, warningFor: 1.4, phase: 5.4 },
        ]
      : level.id === "drowned"
        ? [
            { x: 54, y: 220, w: 180, h: 76, kind: "current", flowX: 1, flowY: 0, period: 0 },
            { x: 494, y: 424, w: 210, h: 76, kind: "current", flowX: 0.72, flowY: -0.7, period: 0 },
            { x: 888, y: 612, w: 190, h: 72, kind: "current", flowX: -1, flowY: 0, period: 0 },
        ]
        : [],
  };
}
const authoredLevels = [
  ...baseLevels.map(scaleLegacyLevel),
  {
    id: "glassgarden",
    name: "Anthropic Living Studio",
    biome: "garden",
    topology: "Three hedge loops wrap a broad reflecting pool, with offset trellises, flowerbeds, and cross-cut passages between long outer lanes.",
    chokepoints: [{ x: 640, y: 226, name: "pool crossing" }, { x: 640, y: 537, name: "south garden opening" }],
    playerStart: { x: 76, y: 728 },
    jevStart: { x: 1180, y: 706 },
    blocks: [
      { x: 165, y: 136, w: 304, h: 48, kind: "hedge" },
      { x: 790, y: 136, w: 318, h: 48, kind: "hedge" },
      { x: 165, y: 184, w: 48, h: 166, kind: "hedge" },
      { x: 1060, y: 184, w: 48, h: 166, kind: "hedge" },
      { x: 515, y: 263, w: 250, h: 250, kind: "reflecting_pool", shape: "ellipse" },
      { x: 142, y: 482, w: 352, h: 46, kind: "trellis" },
      { x: 786, y: 482, w: 352, h: 46, kind: "trellis" },
      { x: 480, y: 575, w: 48, h: 135, kind: "hedge" },
      { x: 752, y: 575, w: 48, h: 135, kind: "hedge" },
      { x: 319, y: 338, w: 90, h: 56, kind: "flowerbed" },
      { x: 872, y: 338, w: 90, h: 56, kind: "flowerbed" },
      { x: 590, y: 90, w: 46, h: 90, kind: "glass_pillar" },
      { x: 590, y: 625, w: 46, h: 90, kind: "glass_pillar" },
    ],
    hazards: [
      { x: 278, y: 587, w: 102, h: 108, kind: "spores", period: 8.6, activeFor: 2.3, warningFor: 1.4, phase: 3.4 },
      { x: 906, y: 218, w: 104, h: 110, kind: "spores", period: 8.6, activeFor: 2.3, warningFor: 1.4, phase: 6.8 },
      { x: 557, y: 567, w: 110, h: 78, kind: "spores", period: 8.6, activeFor: 2.3, warningFor: 1.4, phase: 5.3 },
    ],
  },
  {
    id: "meridian",
    name: "Anthropic Quiet Commons",
    biome: "vault",
    topology: "A circular heart and broken radial walls split the vault into five chambers; rotated ribs create diagonal cut-throughs and looping bypass routes.",
    chokepoints: [{ x: 378, y: 400, name: "western breach" }, { x: 905, y: 400, name: "eastern breach" }],
    playerStart: { x: 74, y: 400 },
    jevStart: { x: 1180, y: 722 },
    blocks: [
      { x: 525, y: 296, w: 230, h: 230, kind: "vault_core", shape: "circle" },
      { x: 193, y: 145, w: 296, h: 44, kind: "vault_rib", angle: 0.19 },
      { x: 785, y: 155, w: 292, h: 44, kind: "vault_rib", angle: -0.18 },
      { x: 170, y: 548, w: 280, h: 44, kind: "vault_rib", angle: -0.2 },
      { x: 814, y: 554, w: 290, h: 44, kind: "vault_rib", angle: 0.21 },
      { x: 424, y: 116, w: 42, h: 164, kind: "reliquary" },
      { x: 817, y: 232, w: 42, h: 160, kind: "reliquary" },
      { x: 420, y: 555, w: 42, h: 150, kind: "reliquary" },
      { x: 824, y: 554, w: 42, h: 156, kind: "reliquary" },
      { x: 132, y: 304, w: 205, h: 42, kind: "vault_wall" },
      { x: 132, y: 453, w: 205, h: 42, kind: "vault_wall" },
      { x: 964, y: 302, w: 170, h: 42, kind: "vault_wall" },
      { x: 964, y: 454, w: 170, h: 42, kind: "vault_wall" },
      { x: 632, y: 104, w: 40, h: 82, kind: "crystal", shape: "circle" },
      { x: 630, y: 616, w: 44, h: 84, kind: "crystal", shape: "circle" },
    ],
    hazards: [
      { x: 478, y: 193, w: 84, h: 66, kind: "arc_sparks", period: 9.2, activeFor: 2, warningFor: 1.5, phase: 4.1 },
      { x: 717, y: 540, w: 88, h: 70, kind: "arc_sparks", period: 9.2, activeFor: 2, warningFor: 1.5, phase: 7.3 },
    ],
  },
  {
    id: "fractured",
    name: "Frontier Collaboration Hall",
    biome: "rift",
    topology: "Offset island walls form three winding bridges across a volatile center, with broad upper and lower flanks that reconnect behind the player.",
    chokepoints: [{ x: 640, y: 239, name: "upper bridge" }, { x: 514, y: 427, name: "western bridge" }, { x: 780, y: 431, name: "eastern bridge" }],
    playerStart: { x: 1190, y: 718 },
    jevStart: { x: 107, y: 717 },
    blocks: [
      { x: 269, y: 118, w: 360, h: 48, kind: "rift_wall", angle: -0.11 },
      { x: 701, y: 159, w: 342, h: 48, kind: "rift_wall", angle: 0.13 },
      { x: 195, y: 337, w: 288, h: 46, kind: "rift_wall", angle: 0.1 },
      { x: 551, y: 319, w: 308, h: 46, kind: "rift_wall", angle: -0.08 },
      { x: 886, y: 360, w: 246, h: 46, kind: "rift_wall", angle: 0.12 },
      { x: 302, y: 571, w: 334, h: 48, kind: "rift_wall", angle: 0.1 },
      { x: 757, y: 593, w: 342, h: 48, kind: "rift_wall", angle: -0.12 },
      { x: 543, y: 472, w: 56, h: 56, kind: "rift_pillar", shape: "circle" },
      { x: 684, y: 279, w: 56, h: 56, kind: "rift_pillar", shape: "circle" },
      { x: 110, y: 220, w: 112, h: 72, kind: "rift_crystal", angle: -0.24 },
      { x: 1053, y: 472, w: 112, h: 72, kind: "rift_crystal", angle: 0.2 },
      { x: 457, y: 708, w: 175, h: 40, kind: "rift_wall", angle: -0.04 },
      { x: 724, y: 75, w: 166, h: 40, kind: "rift_wall", angle: 0.04 },
    ],
    hazards: [
      { x: 565, y: 375, w: 148, h: 124, kind: "rift_surge", period: 8.8, activeFor: 2.1, warningFor: 1.5, phase: 3.7 },
      { x: 871, y: 432, w: 122, h: 112, kind: "rift_surge", period: 8.8, activeFor: 2.1, warningFor: 1.5, phase: 6.3 },
    ],
  },
];
const districtPatterns = [
  [
    [95, 112, 288, 46], [415, 112, 54, 214], [555, 112, 250, 46], [870, 112, 294, 46],
    [985, 158, 48, 218], [170, 286, 224, 44], [492, 306, 296, 52], [822, 319, 48, 190],
    [144, 492, 52, 205], [278, 508, 236, 46], [570, 512, 52, 190], [713, 530, 270, 48],
    [1035, 510, 48, 175], [885, 700, 258, 42], [208, 704, 218, 40],
  ],
  [
    [504, 228, 272, 272, 0, "ellipse"], [156, 112, 256, 42], [866, 112, 276, 42],
    [156, 154, 44, 205], [1098, 154, 44, 204], [250, 386, 210, 44], [823, 386, 218, 44],
    [250, 430, 44, 180], [997, 430, 44, 180], [370, 633, 190, 42], [723, 633, 190, 42],
    [545, 60, 48, 135], [686, 60, 48, 135], [545, 605, 48, 145], [686, 605, 48, 145],
  ],
  [
    [120, 110, 390, 44, 0, "", 0.08], [510, 154, 48, 208], [580, 318, 300, 44, 1, "", -0.09],
    [878, 138, 48, 198], [926, 138, 224, 44, 2], [200, 285, 280, 44, 1, "", -0.07],
    [478, 330, 48, 210], [526, 498, 350, 44, 0, "", 0.08], [870, 454, 248, 44, 2],
    [1114, 414, 44, 220], [130, 570, 310, 44, 0, "", 0.06], [338, 614, 44, 130],
    [520, 646, 280, 40, 1, "", -0.08], [820, 652, 240, 40, 0], [1065, 670, 90, 42, 2],
  ],
];
const districtKindSets = {
  office: ["desk", "pillar", "bench"],
  cinder: ["furnace", "obelisk", "vent"],
  archive: ["shelf"],
  garden: ["hedge", "trellis", "flowerbed", "reflecting_pool"],
  vault: ["vault_wall", "vault_rib", "reliquary", "crystal"],
  rift: ["rift_wall", "rift_pillar", "rift_crystal"],
};
const districtNames = {
  crossing: ["The Arrival Hall", "Ledger Gallery", "Gloam Arcade", "Rift Registry"],
  cinder: ["Coal Gate", "The Slag Canal", "Kilnworks", "The Cooling Vents"],
  drowned: ["West Stacks", "The Scriptorium", "Sunken Reading Room", "The Flooded Annex"],
  glassgarden: ["Moon Gate", "The Conservatory", "Moth Orchid Walk", "The Mirror Pond"],
  meridian: ["Outer Reliquary", "The Prismatic Nave", "Broken Meridian", "The Vault Heart"],
  fractured: ["First Span", "The Shard Bridges", "Null Chasm", "The Rift Shelf"],
};
const districtHazards = {
  crossing: [
    { x: 1490, y: 150, w: 158, h: 132, kind: "rift_surge", phase: 2.2 },
    { x: 330, y: 1110, w: 170, h: 130, kind: "rift_surge", phase: 5.1 },
    { x: 1830, y: 1190, w: 172, h: 132, kind: "rift_surge", phase: 7.2 },
  ],
  cinder: [
    { x: 1520, y: 225, w: 176, h: 118, kind: "steam", phase: 1.5 },
    { x: 320, y: 1060, w: 176, h: 120, kind: "steam", phase: 5.4 },
    { x: 1830, y: 1120, w: 180, h: 124, kind: "steam", phase: 7.4 },
    { x: 890, y: 520, w: 184, h: 104, kind: "lava", phase: 1.2 },
    { x: 1420, y: 940, w: 210, h: 112, kind: "lava", phase: 4.4 },
    { x: 2000, y: 700, w: 174, h: 106, kind: "lava", phase: 7.1 },
  ],
  drowned: [
    { x: 1370, y: 250, w: 260, h: 112, kind: "current", flowX: 1, flowY: 0 },
    { x: 330, y: 1050, w: 250, h: 118, kind: "current", flowX: 0.7, flowY: -0.7 },
    { x: 1780, y: 1120, w: 270, h: 115, kind: "current", flowX: -1, flowY: 0 },
    { x: 550, y: 500, w: 230, h: 132, kind: "quicksand", phase: 1.5 },
    { x: 1420, y: 1130, w: 250, h: 140, kind: "quicksand", phase: 5.2 },
    { x: 1910, y: 560, w: 222, h: 134, kind: "quicksand", phase: 7.8 },
  ],
  glassgarden: [
    { x: 1510, y: 210, w: 140, h: 145, kind: "swarm", phase: 2.5, moveX: 92, moveY: 54, movePeriod: 7.8 },
    { x: 300, y: 1060, w: 148, h: 142, kind: "swarm", phase: 5.7, moveX: 72, moveY: 64, movePeriod: 9.2 },
    { x: 1860, y: 1110, w: 142, h: 140, kind: "swarm", phase: 7.6, moveX: 86, moveY: 56, movePeriod: 8.4 },
  ],
  meridian: [
    { x: 1500, y: 220, w: 128, h: 110, kind: "arc_sparks", phase: 1.8 },
    { x: 300, y: 1080, w: 132, h: 116, kind: "arc_sparks", phase: 5.1 },
    { x: 1840, y: 1100, w: 136, h: 112, kind: "arc_sparks", phase: 7.1 },
  ],
  fractured: [
    { x: 1530, y: 180, w: 152, h: 138, kind: "rift_surge", phase: 2.8 },
    { x: 310, y: 1120, w: 154, h: 138, kind: "rift_surge", phase: 5.9 },
    { x: 1860, y: 1150, w: 156, h: 140, kind: "rift_surge", phase: 7.7 },
  ],
};
const districtOrder = {
  crossing: [0, 1, 2], cinder: [1, 2, 0], drowned: [2, 0, 1],
  glassgarden: [1, 0, 2], meridian: [2, 1, 0], fractured: [0, 2, 1],
};
function expandLevel(level) {
  const kindSet = districtKindSets[level.biome];
  const addedDistrictBlocks = districtOrder[level.id].flatMap((patternIndex, districtIndex) =>
    districtPatterns[patternIndex].slice(0, Math.max(12, level.blocks.length)).map((spec, blockIndex) => {
      const quadrant = [
        { x: DISTRICT.width, y: 0 },
        { x: 0, y: DISTRICT.height },
        { x: DISTRICT.width, y: DISTRICT.height },
      ][districtIndex];
      const block = {
        x: quadrant.x + spec[0], y: quadrant.y + spec[1], w: spec[2], h: spec[3],
        kind: kindSet[spec[4] ?? (blockIndex % kindSet.length)],
      };
      if (spec[5]) block.shape = spec[5];
      if (spec[6]) block.angle = spec[6];
      return block;
    })
  );
  const dividerKind = kindSet[0];
  const districtDividers = [
    { x: 1260, y: 0, w: 40, h: 278, kind: dividerKind },
    { x: 1260, y: 390, w: 40, h: 300, kind: dividerKind },
    { x: 1260, y: 850, w: 40, h: 270, kind: dividerKind },
    { x: 1260, y: 1230, w: 40, h: 370, kind: dividerKind },
    { x: 0, y: 780, w: 482, h: 40, kind: dividerKind },
    { x: 610, y: 780, w: 590, h: 40, kind: dividerKind },
    { x: 1360, y: 780, w: 470, h: 40, kind: dividerKind },
    { x: 1960, y: 780, w: 600, h: 40, kind: dividerKind },
  ];
  const hazards = (level.hazards || []).map((hazard) => ({ ...hazard }));
  for (const hazard of districtHazards[level.id]) {
    const timing = ["steam", "spores", "arc_sparks", "rift_surge", "lava", "quicksand", "swarm"].includes(hazard.kind)
      ? { period: hazard.kind === "lava" ? 10 : 9, activeFor: hazard.kind === "lava" ? 1.8 : 2.4, warningFor: 1.5 }
      : { period: 0 };
    hazards.push({ ...timing, ...hazard });
  }
  return {
    ...level,
    districts: districtNames[level.id],
    blocks: [...level.blocks, ...addedDistrictBlocks, ...districtDividers],
    hazards,
    chokepoints: [
      ...level.chokepoints,
      { x: 1260, y: 336, name: "north district gate" },
      { x: 1260, y: 1180, name: "south district gate" },
      { x: 546, y: 800, name: "west district gate" },
      { x: 1895, y: 800, name: "east district gate" },
      { x: 1280, y: 800, name: "central crossing" },
    ],
  };
}
const levels = authoredLevels.map(expandLevel);
let selectedLevelIndex = 0;
let selectedLevel = levels[selectedLevelIndex];
let blocks = selectedLevel.blocks;
function biomeAccent(biome) {
  return {
    office: "#f5b16c",
    cinder: "#ff7544",
    archive: "#4ecfc0",
    garden: "#9edb8e",
    vault: "#c5a6ff",
    rift: "#ff8fca",
  }[biome] || "#ffc977";
}
const modeLabels = {
  pursue: "HUNT",
  intercept: "LEADING",
  flank: "FLANK",
  ambush: "CUTTING OFF",
  rift_rend: "RIFT REND",
  power_blast: "BLAST",
  rift_mine: "RIFT MINE",
  rift_rush: "RIFT RUSH",
  shadow_dodge: "RIFT SLIDE",
  soul_salvo: "SOUL SALVO",
  summon_wraiths: "WRAITH SWARM",
  meteor_storm: "METEOR STORM",
  rift_aegis: "RIFT AEGIS",
};
const planLabels = {
  steady_pressure: "PRESSING",
  cut_escape: "CUTTING OFF",
  flush_cover: "FLUSHING COVER",
  punish_recovery: "PUNISHING",
  relentless_assault: "RELENTLESS ASSAULT",
  hold_range: "HOLDING RANGE",
  control_chokepoint: "TAKING GROUND",
  guard_anchors: "GUARDING ANCHOR",
};
const planStepDescriptions = {
  approach: "move to a reachable angle, crossing, or threatened objective",
  set_up: "shape the ghost's route or prepare a safe attack lane",
  capitalize: "use a ready skill to exploit the setup",
  assess: "read the outcome and the ghost's response before repeating",
};
const commitmentTactics = new Set(["rift_rend", "power_blast", "rift_mine", "soul_salvo", "shadow_dodge", "summon_wraiths", "meteor_storm", "rift_aegis"]);
const planBreakEvents = new Set([
  "phase_dash", "soul_burst", "burst_hit", "burst_missed", "shot_hit", "anchor_hit", "anchor_broken",
  "mirror_echo", "rift_hook", "lantern_parry", "blast_hit", "blast_dodged", "blast_blocked",
  "salvo_hit", "salvo_dodged", "salvo_blocked", "blast_cover_blocked", "blast_guard_blocked", "blast_decoy_blocked",
  "salvo_cover_blocked", "salvo_guard_blocked", "salvo_decoy_blocked", "rift_rend_hit", "rift_rend_missed",
  "rift_rend_evaded", "rift_rend_interrupted",
  "mine_hit", "mine_evaded", "rift_aegis_activated", "rift_aegis_blocked",
]);
const actionOutcomeEvents = {
  rift_rend_fired: ["rift_rend", "in_swing"],
  rift_rend_hit: ["rift_rend", "hit"],
  rift_rend_missed: ["rift_rend", "missed"],
  rift_rend_interrupted: ["rift_rend", "interrupted"],
  rift_rend_evaded: ["rift_rend", "evaded"],
  power_blast_fired: ["power_blast", "in_flight"],
  blast_hit: ["power_blast", "hit"],
  blast_missed: ["power_blast", "missed"],
  blast_dodged: ["power_blast", "dodged"],
  blast_blocked: ["power_blast", "blocked"],
  blast_cover_blocked: ["power_blast", "blocked_by_cover"],
  blast_guard_blocked: ["power_blast", "parried"],
  blast_decoy_blocked: ["power_blast", "diverted_by_decoy"],
  blast_canceled: ["power_blast", "interrupted"],
  soul_salvo_windup: ["soul_salvo", "started"],
  soul_salvo_fired: ["soul_salvo", "in_flight"],
  salvo_hit: ["soul_salvo", "hit"],
  salvo_missed: ["soul_salvo", "missed"],
  salvo_dodged: ["soul_salvo", "dodged"],
  salvo_blocked: ["soul_salvo", "blocked"],
  salvo_cover_blocked: ["soul_salvo", "blocked_by_cover"],
  salvo_guard_blocked: ["soul_salvo", "parried"],
  salvo_decoy_blocked: ["soul_salvo", "diverted_by_decoy"],
  soul_salvo_canceled: ["soul_salvo", "interrupted"],
  mine_placed: ["rift_mine", "deployed"],
  mine_triggered: ["rift_mine", "triggered"],
  mine_hit: ["rift_mine", "hit"],
  mine_evaded: ["rift_mine", "evaded"],
  rift_rush_windup: ["rift_rush", "started"],
  rift_rush_used: ["rift_rush", "charged"],
  rift_rush_canceled: ["rift_rush", "interrupted"],
  rift_aegis_activated: ["rift_aegis", "activated"],
  rift_aegis_blocked: ["rift_aegis", "blocked_a_hit"],
  rift_aegis_expired: ["rift_aegis", "faded"],
  shadow_dodge_windup: ["shadow_dodge", "started"],
  shadow_dodge_used: ["shadow_dodge", "avoided_shot"],
  shadow_dodge_canceled: ["shadow_dodge", "interrupted"],
  meteor_storm_started: ["meteor_storm", "started"],
  meteor_hit: ["meteor_storm", "hit"],
  meteor_evaded: ["meteor_storm", "missed"],
  wraiths_summoned: ["summon_wraiths", "deployed"],
  wraith_hit: ["summon_wraiths", "hit"],
  wraith_shot: ["summon_wraiths", "missed"],
  wraith_burst: ["summon_wraiths", "evaded"],
  wraith_dash: ["summon_wraiths", "evaded"],
};
const playerReadLabels = {
  dash_dodger: true,
  cover_kiter: true,
  loop_runner: true,
  burst_brawler: true,
  close_brawler: true,
  unpredictable: true,
};
const skinCatalog = Object.freeze({
  sam: Object.freeze({
    id: "sam",
    name: "Sam Altman",
    company: "OpenAI",
    victoryHeadline: "OpenAI won, GPT is AGI",
    skillIconSheet: "frontier-skill-icons-openai-pixel.png",
    sprite: "frontier-sam-pixel-v3.png",
    // Normalized run atlas built by tools/build_run_atlas.py (one scale + pivot for every frame).
    runAtlas: "frontier-sam-run-atlas.png",
    // World pixels travelled per full run cycle; frames advance with distance so feet do not skate.
    runStrideDistance: Object.freeze({ side: 150, vertical: 132 }),
    companion: "codex",
    mirrorLeftProfile: true,
    accent: "#79e4cf",
    light: [115, 226, 205],
    spriteVisualScale: 1.12,
    spriteRows: 4,
    spriteFrameBounds: [
      [[87, 44, 143, 266], [83, 44, 158, 266], [84, 44, 154, 266], [81, 45, 146, 265]],
      [[78, 44, 162, 266], [55, 43, 203, 267], [63, 39, 195, 271], [79, 42, 161, 268]],
      [[84, 35, 152, 273], [66, 36, 191, 272], [72, 36, 194, 272], [80, 34, 155, 274]],
      [[87, 16, 150, 263], [60, 18, 174, 260], [84, 16, 164, 263], [78, 18, 157, 261]],
    ],
    futureGameplay: Object.freeze({ statModifiers: null, skillOverrides: null }),
  }),
  dario: Object.freeze({
    id: "dario",
    name: "Dario Amodei",
    company: "Anthropic",
    victoryHeadline: "Anthropic won, Claude is AGI",
    skillIconSheet: "frontier-skill-icons-anthropic-pixel.png",
    sprite: "frontier-dario-pixel-v5.png",
    runAtlas: "frontier-dario-run-atlas.png",
    runStrideDistance: Object.freeze({ side: 150, vertical: 132 }),
    companion: "claude",
    accent: "#f29a68",
    light: [242, 143, 91],
    spriteVisualScale: 1.12,
    spriteRows: 4,
    normalizeSpriteFrames: true,
    mirrorLeftProfile: true,
    futureGameplay: Object.freeze({ statModifiers: null, skillOverrides: null }),
  }),
});
const companionSpriteCatalog = Object.freeze({
  codex: Object.freeze({ columns: 4, rows: 3, horizontalFrameColumn: 0 }),
  claude: Object.freeze({ columns: 4, rows: 3, horizontalFrameColumn: 0 }),
});
const storedRunnerSkin = readPreference("frontier.runnerSkin", "sam");
const storedChaserSkin = readPreference("frontier.chaserSkin", "dario");
let selectedRunnerSkin = Object.hasOwn(skinCatalog, storedRunnerSkin) ? storedRunnerSkin : "sam";
let selectedChaserSkin = Object.hasOwn(skinCatalog, storedChaserSkin) ? storedChaserSkin : "dario";
if (selectedRunnerSkin === selectedChaserSkin) {
  selectedChaserSkin = selectedRunnerSkin === "sam" ? "dario" : "sam";
  writePreference("frontier.chaserSkin", selectedChaserSkin);
}
const artwork = { floors: {}, skins: {}, runs: {}, runSides: {}, runFrames: {}, spriteBounds: {}, companions: {}, skillIcons: {}, props: {}, barriers: {}, barrierBounds: {}, brandMarks: {}, anchorBrandSheets: {} };
for (const [biome, file] of Object.entries({
  office: "frontier-floor-openai-atrium.png",
  cinder: "frontier-floor-openai-compute.png",
  archive: "frontier-floor-anthropic-library.png",
  garden: "frontier-floor-anthropic-living.png",
  vault: "frontier-floor-anthropic-quiet.png",
  rift: "frontier-floor-frontier-common.png",
})) {
  artwork.floors[biome] = new Image();
  artwork.floors[biome].addEventListener("load", renderLevelThumbnails, { once: true });
  artwork.floors[biome].src = "/assets/" + file;
}
for (const skin of Object.values(skinCatalog)) {
  const sprite = new Image();
  sprite.addEventListener("load", () => {
    if (skin.normalizeSpriteFrames) artwork.spriteBounds[skin.id] = prepareSpriteFrameBounds(sprite);
  }, { once: true });
  sprite.src = "/assets/" + skin.sprite;
  artwork.skins[skin.id] = sprite;
  const runAtlas = new Image();
  runAtlas.addEventListener("load", () => {
    artwork.runFrames[skin.id] = prepareRunAtlasFrames(runAtlas);
  }, { once: true });
  runAtlas.src = "/assets/" + skin.runAtlas;
  artwork.runs[skin.id] = runAtlas;
  const skillIcons = new Image();
  skillIcons.src = "/assets/" + skin.skillIconSheet;
  artwork.skillIcons[skin.id] = skillIcons;
}
for (const [companion, file] of Object.entries({
  codex: "frontier-codex-pixel-v3.png",
  claude: "frontier-claude-pixel-v7.png",
})) {
  artwork.companions[companion] = new Image();
  artwork.companions[companion].src = "/assets/" + file;
}
for (const [lab, file] of Object.entries({
  openai: "frontier-props-openai-pixel-v2.png",
  anthropic: "frontier-props-anthropic-pixel-v2.png",
  shared: "frontier-props-shared.png",
})) {
  artwork.props[lab] = new Image();
  artwork.props[lab].src = "/assets/" + file;
}
for (const [lab, file] of Object.entries({
  openai: "frontier-barriers-openai-pixel-v2.png",
  anthropic: "frontier-barriers-anthropic-pixel-v2.png",
})) {
  artwork.barriers[lab] = new Image();
  artwork.barriers[lab].addEventListener("load", () => {
    artwork.barrierBounds[lab] = prepareAtlasFrameBounds(artwork.barriers[lab], 4, 2);
  }, { once: true });
  artwork.barriers[lab].src = "/assets/" + file;
}
for (const [brand, file] of Object.entries({
  openai: "brand-openai-blossom.svg",
  anthropic: "brand-anthropic-wordmark.svg",
  anthropicMark: "brand-anthropic-mark.svg",
})) {
  artwork.brandMarks[brand] = new Image();
  artwork.brandMarks[brand].addEventListener("load", () => {
    renderLevelThumbnails();
    buildAnchorBrandSpriteSheets();
  }, { once: true });
  artwork.brandMarks[brand].src = "/assets/" + file;
}
const skillIconCells = {
  phase_dash: [0, 0], rift_hook: [1, 0], mirror_echo: [2, 0], lantern_guard: [3, 0],
  soul_burst: [0, 1], rift_rend: [1, 1], power_blast: [2, 1], soul_salvo: [3, 1],
  meteor_storm: [0, 2], rift_mine: [1, 2], summon_wraiths: [2, 2], rift_rush: [3, 2],
  shadow_dodge: [0, 3], rift_aegis: [1, 3],
};
const skillManual = {
  ghost: [
    { id: "phase_dash", name: "Phase Dash", key: "Space", description: "Burst through danger; leave a decoy afterimage." },
    { id: "mirror_echo", name: "Mirror Echo", key: "Q", description: "Create three decoys to draw attacks away." },
    { id: "lantern_guard", name: "Lantern Guard", key: "Shift / C / right click", description: "Timed parry reflects attacks and staggers Jev. Use against Rift Rend when escape skills are recharging." },
    { id: "rift_hook", name: "Rift Hook", key: "E", description: "Grapple across a clear route to a safe landing." },
    { id: "soul_burst", name: "Soul Burst", key: "F / X", description: "Short-range shockwave that interrupts Jev and cracks anchors." },
  ],
  jev: [
    { id: "rift_rend", name: "Rift Rend", description: "A wide close-range slash. Dodge its warning arc or parry it with Lantern Guard." },
    { id: "power_blast", name: "Power Blast", description: "Charged, aimed projectile with a clear wind-up." },
    { id: "soul_salvo", name: "Soul Salvo", description: "Three-shot spread against a moving target." },
    { id: "meteor_storm", name: "Meteor Storm", description: "Marked impacts pressure the ghost out of cover." },
    { id: "rift_mine", name: "Rift Mine", description: "Delayed trap placed to close a route." },
    { id: "summon_wraiths", name: "Summon Wraiths", description: "Send tracking wraithlings to flush the ghost." },
    { id: "rift_rush", name: "Rift Rush", description: "Wind up, then charge through a clear lane." },
    { id: "shadow_dodge", name: "Shadow Dodge", description: "Sidestep an incoming burst or shot." },
    { id: "rift_aegis", name: "Rift Aegis", description: "After the anchors fall, block two hits during a brief shield window." },
  ],
};

const playerModeLabels = {
  advance_anchor: "MOVE TO ANCHOR",
  fire_anchors: "BREAK ANCHOR",
  attack_jev: "KITE & STRIKE",
  kite_and_shoot: "KITE & SHOOT",
  evade_warning: "EVADE ATTACK",
  rift_hook: "RIFT HOOK",
  mirror_echo: "MIRROR CLONES",
  phase_dash: "PHASE DASH",
  lantern_guard: "LANTERN GUARD",
  soul_burst: "SOUL BURST",
};
let selectedMode = "human";

const ui = {
  landing: document.querySelector("#landing-screen"),
  arena: document.querySelector("#arena-screen"),
  start: document.querySelector("#start-button"),
  landingDescription: document.querySelector("#landing-description"),
  runnerSkinChoices: [...document.querySelectorAll('input[name="runner-skin"]')],
  runnerSkinCard: document.querySelector("#runner-skin-card"),
  runnerCompany: document.querySelector("#runner-company"),
  chaserSkinChoices: [...document.querySelectorAll('input[name="chaser-skin"]')],
  chaserSkinCard: document.querySelector("#chaser-skin-card"),
  chaserCompany: document.querySelector("#chaser-company"),
  skinSwap: document.querySelector("#skin-swap-button"),
  levelPicker: document.querySelector("#level-picker"),
  levelPrev: document.querySelector("#level-prev"),
  levelNext: document.querySelector("#level-next"),
  levelNumber: document.querySelector("#level-number"),
  levelName: document.querySelector("#level-name"),
  arenaName: document.querySelector("#arena-name"),
  restart: document.querySelector("#restart-button"),
  footer: document.querySelector(".site-footer"),
  canvas: document.querySelector("#game-canvas"),
  context: document.querySelector("#game-canvas").getContext("2d"),
  arenaHud: document.querySelector(".arena-hud"),
  objectiveCallout: document.querySelector("#objective-callout"),
  touchControls: document.querySelector("#touch-controls"),
  health: document.querySelector("#health-pips"),
  jevHealth: document.querySelector("#jev-health-pips"),
  timer: document.querySelector("#timer"),
  intent: document.querySelector("#jev-intent"),
  musicToggle: document.querySelector("#music-toggle"),
  settingsToggle: document.querySelector("#settings-toggle"),
  settingsOverlay: document.querySelector("#settings-overlay"),
  settingsPanel: document.querySelector("#settings-panel"),
  settingsClose: document.querySelector("#settings-close"),
  settingsResume: document.querySelector("#settings-resume"),
  settingsMusic: document.querySelector("#settings-music"),
  settingsVolume: document.querySelector("#settings-volume"),
  settingsVolumeValue: document.querySelector("#settings-volume-value"),
  settingsDifficulty: document.querySelector("#settings-difficulty"),
  modeLabel: document.querySelector("#jev-mode-label"),
  callout: document.querySelector("#game-callout"),
  result: document.querySelector("#result-overlay"),
  resultKicker: document.querySelector("#result-kicker"),
  resultTitle: document.querySelector("#result-title"),
  resultCopy: document.querySelector("#result-copy"),
  connection: document.querySelector("#connection-status"),
  connectionLabel: document.querySelector("#connection-label"),
  stickZone: document.querySelector("#stick-zone"),
  stickKnob: document.querySelector("#stick-knob"),
  dashTouch: document.querySelector("#dash-touch"),
  pulseTouch: document.querySelector("#pulse-touch"),
  echoTouch: document.querySelector("#echo-touch"),
  hookTouch: document.querySelector("#hook-touch"),
  guardTouch: document.querySelector("#guard-touch"),
  modeHuman: document.querySelector("#mode-human"),
  modeAuto: document.querySelector("#mode-auto"),
  decisionToggle: document.querySelector("#decision-toggle"),
  decisionPanels: document.querySelector("#decision-panels"),
  jevDecisionCard: document.querySelector("#jev-decision-card"),
  playerDecisionCard: document.querySelector("#player-decision-card"),
  jevDecisionAction: document.querySelector("#jev-decision-action"),
  jevDecisionOptions: document.querySelector("#jev-decision-options"),
  jevDecisionExpand: document.querySelector("#jev-decision-expand"),
  playerDecisionAction: document.querySelector("#player-decision-action"),
  playerDecisionOptions: document.querySelector("#player-decision-options"),
  playerDecisionExpand: document.querySelector("#player-decision-expand"),
  objectiveLabel: document.querySelector("#objective-label"),
  anchorProgress: document.querySelector("#anchor-progress"),
  timerCaption: document.querySelector("#timer-caption"),
  mapOverview: document.querySelector("#map-overview"),
  mapContext: document.querySelector("#map-overview").getContext("2d"),
  nextLevel: document.querySelector("#next-level-button"),
  home: document.querySelector("#home-button"),
};

function skinForRole(role) {
  const selected = game?.skinLoadout?.[role]
    ?? (role === "runner" ? selectedRunnerSkin : selectedChaserSkin);
  return Object.hasOwn(skinCatalog, selected) ? skinCatalog[selected] : skinCatalog.sam;
}

function spriteForRole(role) {
  return artwork.skins[skinForRole(role).id];
}

function createAnimationCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function measureAlphaBounds(canvas, minimumAlpha = 1) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (pixels[(y * canvas.width + x) * 4 + 3] < minimumAlpha) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function prepareAtlasFrameBounds(sheet, columns, rows) {
  const frameWidth = sheet.naturalWidth / columns;
  const frameHeight = sheet.naturalHeight / rows;
  return Array.from({ length: rows * columns }, (_, frame) => {
    const cell = createAnimationCanvas(Math.ceil(frameWidth), Math.ceil(frameHeight));
    const column = frame % columns;
    const row = Math.floor(frame / columns);
    cell.getContext("2d").drawImage(
      sheet,
      column * frameWidth, row * frameHeight, frameWidth, frameHeight,
      0, 0, frameWidth, frameHeight,
    );
    return measureAlphaBounds(cell);
  });
}

function prepareSpriteFrameBounds(sheet) {
  const columns = 4;
  const rows = 4;
  const frameWidth = sheet.naturalWidth / columns;
  const frameHeight = sheet.naturalHeight / rows;
  let union = { minX: frameWidth, minY: frameHeight, maxX: -1, maxY: -1 };
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const cell = createAnimationCanvas(Math.ceil(frameWidth), Math.ceil(frameHeight));
      cell.getContext("2d").drawImage(
        sheet,
        column * frameWidth, row * frameHeight, frameWidth, frameHeight,
        0, 0, frameWidth, frameHeight,
      );
      const content = measureAlphaBounds(cell);
      if (!content) continue;
      union = {
        minX: Math.min(union.minX, content.x),
        minY: Math.min(union.minY, content.y),
        maxX: Math.max(union.maxX, content.x + content.width - 1),
        maxY: Math.max(union.maxY, content.y + content.height - 1),
      };
    }
  }
  if (union.maxX < union.minX || union.maxY < union.minY) return null;
  const sharedBounds = {
    x: union.minX,
    y: union.minY,
    width: union.maxX - union.minX + 1,
    height: union.maxY - union.minY + 1,
  };
  return Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => sharedBounds)
  );
}

function prepareProfileRunFrames(sheet, skin, sideSheet = null) {
  if (skin.normalizeSpriteFrames) {
    const animation = prepareNormalizedProfileRunFrames(sheet, skin);
    if (sideSheet?.complete && sideSheet.naturalWidth) {
      const sideFrames = prepareProfileSideRunFrames(sideSheet, animation.bounds, skin);
      if (sideFrames) {
        animation.frames.right = sideFrames.right;
        animation.frames.left = sideFrames.left;
      }
    }
    return animation;
  }
  const columns = skin.runAtlasColumns || 4;
  const rows = skin.runAtlasRows || 2;
  const frameWidth = sheet.naturalWidth / columns;
  const frameHeight = sheet.naturalHeight / rows;
  const frameCount = skin.runFrameCount || 4;
  let union = { minX: frameWidth, minY: frameHeight, maxX: -1, maxY: -1 };
  const frameCells = {};
  const directions = Object.keys(skin.runFrameRows || { right: 0, left: 2 });
  for (const direction of directions) {
    frameCells[direction] = Array.from({ length: frameCount }, (_, index) => {
      const column = index % columns;
      const row = skin.runFrameRows[direction] + Math.floor(index / columns);
      const sourceX = column * frameWidth;
      const sourceY = row * frameHeight;
      const scan = createAnimationCanvas(Math.ceil(frameWidth), Math.ceil(frameHeight));
      const scanContext = scan.getContext("2d", { willReadFrequently: true });
      scanContext.drawImage(sheet, sourceX, sourceY, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
      removeDetachedRedSpecks(scan);
      const pixels = scanContext.getImageData(0, 0, scan.width, scan.height).data;
      let minX = scan.width;
      let minY = scan.height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < scan.height; y += 1) {
        for (let x = 0; x < scan.width; x += 1) {
          if (pixels[(y * scan.width + x) * 4 + 3] < 24) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      union = {
        minX: Math.min(union.minX, minX),
        minY: Math.min(union.minY, minY),
        maxX: Math.max(union.maxX, maxX),
        maxY: Math.max(union.maxY, maxY),
      };
      return scan;
    });
  }
  const padding = 4;
  union.minX = Math.max(0, union.minX - padding);
  union.minY = Math.max(0, union.minY - padding);
  union.maxX = Math.min(frameWidth - 1, union.maxX + padding);
  union.maxY = Math.min(frameHeight - 1, union.maxY + padding);
  const cropWidth = Math.ceil(union.maxX - union.minX + 1);
  const cropHeight = Math.ceil(union.maxY - union.minY + 1);
  const frames = Object.fromEntries(directions.map((direction) => [
    direction,
    frameCells[direction].map((cell) => {
      const frame = createAnimationCanvas(cropWidth, cropHeight);
      frame.getContext("2d").drawImage(
        cell, union.minX, union.minY, cropWidth, cropHeight,
        0, 0, frame.width, frame.height,
      );
      return frame;
    }),
  ]));
  return { frames, bounds: union };
}

function prepareNormalizedProfileRunFrames(sheet, skin) {
  const columns = skin.runAtlasColumns || 4;
  const rows = skin.runAtlasRows || 2;
  const frameWidth = sheet.naturalWidth / columns;
  const frameHeight = sheet.naturalHeight / rows;
  const frameCount = skin.runFrameCount || 4;
  let union = { minX: frameWidth, minY: frameHeight, maxX: -1, maxY: -1 };
  const frameCells = {};
  const directions = Object.keys(skin.runFrameRows || { right: 0, left: 2 });
  for (const direction of directions) {
    frameCells[direction] = Array.from({ length: frameCount }, (_, index) => {
      const column = index % columns;
      const row = skin.runFrameRows[direction] + Math.floor(index / columns);
      const sourceX = column * frameWidth;
      const sourceY = row * frameHeight;
      const cell = createAnimationCanvas(Math.ceil(frameWidth), Math.ceil(frameHeight));
      cell.getContext("2d").drawImage(sheet, sourceX, sourceY, frameWidth, frameHeight, 0, 0, frameWidth, frameHeight);
      removeDetachedRedSpecks(cell);
      const content = measureAlphaBounds(cell);
      if (content) {
        union = {
          minX: Math.min(union.minX, content.x),
          minY: Math.min(union.minY, content.y),
          maxX: Math.max(union.maxX, content.x + content.width - 1),
          maxY: Math.max(union.maxY, content.y + content.height - 1),
        };
      }
      return cell;
    });
  }
  if (union.maxX < union.minX || union.maxY < union.minY) return null;
  const padding = 2;
  const cropX = Math.max(0, union.minX - padding);
  const cropY = Math.max(0, union.minY - padding);
  const cropWidth = Math.ceil(Math.min(frameWidth - cropX, union.maxX - cropX + padding + 1));
  const cropHeight = Math.ceil(Math.min(frameHeight - cropY, union.maxY - cropY + padding + 1));
  const frames = Object.fromEntries(directions.map((direction) => [
    direction,
    frameCells[direction].map((cell) => {
      const frame = createAnimationCanvas(cropWidth, cropHeight);
      frame.getContext("2d").drawImage(cell, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      return frame;
    }),
  ]));
  return { frames, bounds: { x: cropX, y: cropY, width: cropWidth, height: cropHeight }, normalized: true };
}

function prepareProfileSideRunFrames(sheet, targetBounds, skin) {
  const columns = skin.runSideAtlasColumns || 4;
  const rows = skin.runSideAtlasRows || 2;
  const frameWidth = sheet.naturalWidth / columns;
  const frameHeight = sheet.naturalHeight / rows;
  const frameCount = Math.min(skin.runSideFrameCount || columns * rows, columns * rows);
  const sourceFrames = Array.from({ length: frameCount }, (_, index) => {
    const frame = createAnimationCanvas(Math.ceil(frameWidth), Math.ceil(frameHeight));
    const column = index % columns;
    const row = Math.floor(index / columns);
    frame.getContext("2d").drawImage(
      sheet,
      column * frameWidth, row * frameHeight, frameWidth, frameHeight,
      0, 0, frame.width, frame.height,
    );
    removeDetachedRedSpecks(frame);
    return frame;
  });
  const outputWidth = targetBounds?.width || Math.ceil(frameWidth);
  const outputHeight = targetBounds?.height || Math.ceil(frameHeight);
  const contentHeight = Math.max(1, outputHeight - 16);
  const right = sourceFrames.map((source) => {
    const content = measureAlphaBounds(source, 24);
    if (!content) return createAnimationCanvas(outputWidth, outputHeight);
    const padding = 2;
    const cropX = Math.max(0, content.x - padding);
    const cropY = Math.max(0, content.y - padding);
    const cropWidth = Math.min(source.width - cropX, content.width + padding * 2);
    const cropHeight = Math.min(source.height - cropY, content.height + padding * 2);
    const sourceDrawHeight = Math.max(1, contentHeight - padding * 2);
    const scale = Math.min(sourceDrawHeight / cropHeight, (outputWidth - 12) / cropWidth);
    const drawWidth = cropWidth * scale;
    const drawHeight = cropHeight * scale;
    const frame = createAnimationCanvas(outputWidth, outputHeight);
    frame.getContext("2d").drawImage(
      source,
      cropX, cropY, cropWidth, cropHeight,
      (outputWidth - drawWidth) / 2, outputHeight - 4 - drawHeight, drawWidth, drawHeight,
    );
    return frame;
  });
  const left = right.map((source) => {
    const frame = createAnimationCanvas(outputWidth, outputHeight);
    const context = frame.getContext("2d");
    context.translate(outputWidth, 0);
    context.scale(-1, 1);
    context.drawImage(source, 0, 0);
    return frame;
  });
  return { right, left, bounds: targetBounds || { x: 0, y: 0, width: outputWidth, height: outputHeight } };
}

function removeDetachedRedSpecks(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = image.data;
  const total = canvas.width * canvas.height;
  const seen = new Uint8Array(total);
  const queue = new Int32Array(total);
  const isRedPixel = (pixelIndex) => {
    const offset = pixelIndex * 4;
    const red = pixels[offset];
    return pixels[offset + 3] >= 48 && red >= 72 && red > pixels[offset + 1] * 1.28 && red > pixels[offset + 2] * 1.12;
  };
  let changed = false;
  for (let start = 0; start < total; start += 1) {
    if (seen[start] || !isRedPixel(start)) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    seen[start] = 1;
    while (head < tail) {
      const pixelIndex = queue[head++];
      const x = pixelIndex % canvas.width;
      const y = Math.floor(pixelIndex / canvas.width);
      for (let nextY = Math.max(0, y - 1); nextY <= Math.min(canvas.height - 1, y + 1); nextY += 1) {
        for (let nextX = Math.max(0, x - 1); nextX <= Math.min(canvas.width - 1, x + 1); nextX += 1) {
          const next = nextY * canvas.width + nextX;
          if (seen[next] || !isRedPixel(next)) continue;
          seen[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (tail > 36) continue;
    for (let index = 0; index < tail; index += 1) pixels[queue[index] * 4 + 3] = 0;
    changed = true;
  }
  if (changed) context.putImageData(image, 0, 0);
}

function drawProfileRunFrame(ctx, skinId, direction, frameIndex, x, y, width, height) {
  const animation = artwork.runFrames[skinId];
  const skin = skinCatalog[skinId];
  if (!animation || !skin) return false;
  const frames = animation.frames[direction];
  if (!frames) return false;
  const frame = frames[frameIndex % frames.length];
  const scale = Math.min(width / frame.width, height / frame.height)
    * (skin.spriteVisualScale ?? 1)
    * (animation.normalized ? skin.frameSizeScale ?? 1 : 1);
  const scaledWidth = frame.width * scale;
  const scaledHeight = frame.height * scale;
  const phase = frameIndex / frames.length * Math.PI * 2;
  const bounce = (1 - Math.cos(phase * 2)) * 1.5;
  const lean = Math.sin(phase) * 0.03;
  const nativeSideRun = skin.nativeSideRunMotion && (direction === "left" || direction === "right");
  ctx.save();
  ctx.translate(x + (nativeSideRun ? 0 : Math.cos(phase) * 1.2), y + height / 2 - (nativeSideRun ? 0 : bounce));
  if (!nativeSideRun) ctx.rotate(lean);
  ctx.drawImage(frame, -scaledWidth / 2, -scaledHeight, scaledWidth, scaledHeight);
  ctx.restore();
  return true;
}

function profileRunPose(entity, skinId, direction) {
  const skin = skinCatalog[skinId];
  const isSideways = direction === "left" || direction === "right";
  const frameCount = artwork.runFrames[skinId]?.frames[direction]?.length || 8;
  if (isSideways && skin?.sideRunStrideDistance) {
    const speed = Math.hypot(Number(entity.vx) || 0, Number(entity.vy) || 0);
    const cycleDuration = clamp(skin.sideRunStrideDistance / Math.max(speed, 1), 0.46, 1.12);
    return Math.floor((entity.spriteAnimationTime || 0) / (cycleDuration / frameCount)) % frameCount;
  }
  const frameDuration = 0.075;
  return Math.floor((entity.spriteAnimationTime || 0) / frameDuration) % frameCount;
}

function syncSkinSelector(role) {
  const skin = role === "runner" ? skinCatalog[selectedRunnerSkin] : skinCatalog[selectedChaserSkin];
  const controls = role === "runner" ? ui.runnerSkinChoices : ui.chaserSkinChoices;
  const card = role === "runner" ? ui.runnerSkinCard : ui.chaserSkinCard;
  const company = role === "runner" ? ui.runnerCompany : ui.chaserCompany;
  for (const control of controls) control.checked = control.value === skin.id;
  card.dataset.skin = skin.id;
  company.textContent = skin.company;
}

function skinForLoadoutRole(role) {
  return skinCatalog[role === "ghost" ? selectedRunnerSkin : selectedChaserSkin];
}

function brandedSkillName(skill, skin) {
  const openAiNames = {
    phase_dash: "Codex Slipstream",
    rift_hook: "Codex Tether",
    mirror_echo: "Codex Fork",
    lantern_guard: "Safety Kernel",
    soul_burst: "Codex Overload",
    rift_rend: "Vector Sweep",
    power_blast: "Vector Lance",
    soul_salvo: "Parallel Salvo",
    meteor_storm: "Compute Rain",
    rift_mine: "Latent Trap",
    summon_wraiths: "Codex Agents",
    rift_rush: "Inference Rush",
    shadow_dodge: "Low-Latency Step",
    rift_aegis: "Safety Shield",
  };
  const anthropicNames = {
    phase_dash: "Claude Slipstream",
    rift_hook: "Constitution Thread",
    mirror_echo: "Claude Echo Bloom",
    lantern_guard: "Constitution Guard",
    soul_burst: "Claude Ember Bloom",
    rift_rend: "Redline Rend",
    power_blast: "Claude Ember Lance",
    soul_salvo: "Claude Scatterflare",
    meteor_storm: "Redline Meteor",
    rift_mine: "Tripwire Warden",
    summon_wraiths: "Claude Wardens",
    rift_rush: "Redline Charge",
    shadow_dodge: "Constitution Sidestep",
    rift_aegis: "Constitution Aegis",
  };
  const names = skin?.company === "Anthropic" ? anthropicNames : openAiNames;
  return names[skill.id] || skill.name;
}

function setSelectedSkin(role, skinId) {
  if (!Object.hasOwn(skinCatalog, skinId)) return;
  const previousRunnerSkin = selectedRunnerSkin;
  const previousChaserSkin = selectedChaserSkin;
  if (role === "runner") {
    selectedRunnerSkin = skinId;
    if (selectedChaserSkin === skinId) selectedChaserSkin = previousRunnerSkin;
  } else {
    selectedChaserSkin = skinId;
    if (selectedRunnerSkin === skinId) selectedRunnerSkin = previousChaserSkin;
  }
  writePreference("frontier.runnerSkin", selectedRunnerSkin);
  writePreference("frontier.chaserSkin", selectedChaserSkin);
  syncSkinSelector("runner");
  syncSkinSelector("chaser");
  renderSkillCatalog();
}

function swapSkinRoles() {
  [selectedRunnerSkin, selectedChaserSkin] = [selectedChaserSkin, selectedRunnerSkin];
  writePreference("frontier.runnerSkin", selectedRunnerSkin);
  writePreference("frontier.chaserSkin", selectedChaserSkin);
  syncSkinSelector("runner");
  syncSkinSelector("chaser");
  renderSkillCatalog();
}

function ensureMusic() {
  if (music.context) return true;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return false;
  music.context = new AudioContext();
  music.output = music.context.createGain();
  music.output.gain.value = 0;
  music.output.connect(music.context.destination);
  return true;
}

function scheduleMusicTone(frequency, at, duration, volume, waveform = "triangle") {
  const context = music.context;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(frequency, at);
  envelope.gain.setValueAtTime(0.0001, at);
  envelope.gain.exponentialRampToValueAtTime(volume, at + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(envelope);
  envelope.connect(music.output);
  oscillator.start(at);
  oscillator.stop(at + duration + 0.025);
}

function scheduleMusicStep(at, step) {
  const theme = musicThemes[music.theme] || musicThemes.office;
  const heat = music.intensity;
  const note = theme.notes[step % theme.notes.length];
  const pitch = theme.root * 2 ** (note / 12);
  if (step % 2 === 0) scheduleMusicTone(pitch * 2, at, 0.18, 0.018 + heat * 0.009, "triangle");
  if (step % 4 === 0) {
    scheduleMusicTone(theme.root * (heat > 0.48 ? 0.75 : 0.5), at, 0.31, 0.045, "sine");
    const context = music.context;
    const kick = context.createOscillator();
    const envelope = context.createGain();
    kick.type = "sine";
    kick.frequency.setValueAtTime(118, at);
    kick.frequency.exponentialRampToValueAtTime(42, at + 0.16);
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(0.047, at + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.19);
    kick.connect(envelope);
    envelope.connect(music.output);
    kick.start(at);
    kick.stop(at + 0.21);
  }
  if (step % 8 === 0) {
    scheduleMusicTone(theme.root, at, 1.55, 0.012 + heat * 0.008, "sine");
    scheduleMusicTone(theme.root * 1.5, at + 0.015, 1.35, 0.007 + heat * 0.005, "sine");
  }
  if (step % 4 === 2) scheduleMusicTone(theme.root * (heat > 0.42 ? 30 : 24), at, 0.035, 0.003 + heat * 0.003, "sine");
  if (heat > 0.34 && step % 2 === 1) scheduleMusicTone(pitch, at, 0.09, heat * 0.012, "sawtooth");
}

function tickMusic() {
  if (!music.enabled || music.context?.state !== "running") return;
  const theme = musicThemes[music.theme] || musicThemes.office;
  const stepDuration = 60 / (theme.tempo + music.intensity * 18) / 2;
  while (music.nextTime < music.context.currentTime + 0.22) {
    scheduleMusicStep(music.nextTime, music.step);
    music.nextTime += stepDuration;
    music.step = (music.step + 1) % 16;
  }
}

function startMusic(biome) {
  music.theme = musicThemes[biome] ? biome : "office";
  music.intensity = 0;
  if (!music.enabled || !ensureMusic()) return;
  void music.context.resume();
  const now = music.context.currentTime;
  music.output.gain.cancelScheduledValues(now);
  music.output.gain.setTargetAtTime(0.13 * music.volume, now, 0.25);
  if (!music.timer) {
    music.nextTime = now + 0.06;
    music.timer = window.setInterval(tickMusic, 45);
  }
}

function stopMusic() {
  if (music.timer) window.clearInterval(music.timer);
  music.timer = 0;
  if (!music.context || !music.output) return;
  const now = music.context.currentTime;
  music.output.gain.cancelScheduledValues(now);
  music.output.gain.setTargetAtTime(0, now, 0.18);
}

function renderMusicButton() {
  ui.musicToggle.setAttribute("aria-pressed", String(music.enabled));
  ui.musicToggle.setAttribute("aria-label", music.enabled ? "Mute music" : "Play music");
  ui.musicToggle.dataset.muted = String(!music.enabled);
}

function toggleMusic() {
  music.enabled = !music.enabled;
  writePreference("jevil.musicEnabled", String(music.enabled));
  renderMusicButton();
  ui.settingsMusic.checked = music.enabled;
  if (music.enabled && game?.running) startMusic(game.level.biome);
  else stopMusic();
}

function setMusicVolume(value) {
  music.volume = clamp(Number(value) / 100, 0, 1);
  writePreference("jevil.musicVolume", String(Math.round(music.volume * 100)));
  ui.settingsVolume.value = String(Math.round(music.volume * 100));
  ui.settingsVolumeValue.value = Math.round(music.volume * 100) + "%";
  if (music.context && music.output && music.enabled && game?.running) {
    music.output.gain.setTargetAtTime(0.13 * music.volume, music.context.currentTime, 0.08);
  }
}

function setDifficulty(value) {
  selectedDifficulty = Object.hasOwn(DIFFICULTY_SETTINGS, value) ? value : "standard";
  if (game) game.difficulty = selectedDifficulty;
  ui.settingsDifficulty.value = selectedDifficulty;
  writePreference("jevil.difficulty", selectedDifficulty);
}

function openSettings() {
  if (!game?.running || game.paused) return;
  game.paused = true;
  game.pauseVersion += 1;
  urgentJevDecisionQueued = false;
  window.clearTimeout(urgentJevDecisionTimer);
  urgentJevDecisionTimer = 0;
  keys.clear();
  setStick(0, 0);
  game.player.fireHeld = false;
  ui.settingsOverlay.hidden = false;
  ui.settingsMusic.checked = music.enabled;
  ui.settingsVolume.value = String(Math.round(music.volume * 100));
  ui.settingsVolumeValue.value = Math.round(music.volume * 100) + "%";
  ui.settingsDifficulty.value = selectedDifficulty;
  ui.settingsToggle.setAttribute("aria-label", "Resume game");
  ui.settingsPanel.focus({ preventScroll: true });
}

function resumeGame() {
  if (!game?.running || !game.paused) return;
  game.paused = false;
  ui.settingsOverlay.hidden = true;
  ui.settingsToggle.setAttribute("aria-label", "Pause and open settings");
  lastFrame = performance.now();
  nextJevDecisionAt = lastFrame;
  ui.canvas.focus({ preventScroll: true });
  if (!jevRequestInFlight) void requestJevDecision();
  else urgentJevDecisionQueued = true;
}

function toggleSettings() {
  if (game?.paused) resumeGame();
  else openSettings();
}

let game = null;
const cameraState = { x: 0, y: 0, updatedAt: 0, ready: false };
let keys = new Set();
let stick = { x: 0, y: 0, pointer: null, originX: 0, originY: 0 };
let animationFrame = 0;
let lastFrame = 0;
let lastHudUpdate = 0;
let calloutTimeout = 0;
let jevRequestInFlight = false;
let nextJevDecisionAt = 0;
let lastJevDecisionStartedAt = 0;
let urgentJevDecisionQueued = false;
let urgentJevDecisionTimer = 0;
let particles = [];
let screenShake = 0;
let decisionsVisible = true;
const decisionExpanded = { jev: false, ghost: false };
const lastDecision = { jev: null, ghost: null };
let lastMapDrawAt = 0;
let decisionPanelCorner = "";
let lastDecisionPanelPlacementAt = -1;
let decisionPanelX = -1;
let decisionPanelY = -1;
const collisionGridCache = new WeakMap();
const pathEdgeClearCache = new WeakMap();

function makeAnchors() {
  const seeds = [
    { x: 1900, y: 400 },
    { x: 590, y: 1215 },
    { x: 1990, y: 1200 },
  ];
  const anchors = [];
  for (const [index, seed] of seeds.entries()) {
    let best = null;
    for (let radius = 0; radius <= 420 && !best; radius += 40) {
      const samples = radius === 0 ? 1 : 24;
      for (let sample = 0; sample < samples; sample += 1) {
        const angle = sample * Math.PI * 2 / samples + index * 0.31;
        const candidate = {
          x: clamp(seed.x + Math.cos(angle) * radius, 70, WORLD.width - 70),
          y: clamp(seed.y + Math.sin(angle) * radius, 70, WORLD.height - 70),
        };
        if (blocked(candidate.x, candidate.y, 40)) continue;
        if (anchors.some((anchor) => distance(anchor, candidate) < 360)) continue;
        best = candidate;
        break;
      }
    }
    const point = best || seed;
    anchors.push({ ...point, health: 2, maxHealth: 2, id: index });
  }
  return anchors;
}

function makeGame() {
  return {
    level: selectedLevel,
    mode: selectedMode,
    skinLoadout: { runner: selectedRunnerSkin, chaser: selectedChaserSkin },
    running: true,
    paused: false,
    pauseVersion: 0,
    difficulty: selectedDifficulty,
    elapsed: 0,
    remaining: SURVIVAL_SECONDS,
    enraged: false,
    anchors: makeAnchors(),
    player: {
      x: selectedLevel.playerStart.x, y: selectedLevel.playerStart.y, vx: 0, vy: 0, radius: 14,
      speed: selectedMode === "auto" ? 254 : 244,
      facing: 1, health: selectedMode === "auto" ? 5 : 4, shotsFired: 0, hitsLanded: 0, fireCooldown: 0,
      aim: null, fireHeld: false, dashTimer: 0, dashCooldown: 0, dashVx: 0, dashVy: 0,
      pulseCooldown: 0, pulseTimer: 0, hurtTimer: 0, invulnerable: 0, snaredTimer: 0,
      echoCooldown: 0, hookCooldown: 0, guardCooldown: 0, guardTimer: 0, guardAdaptUntil: 0,
      afterimageTimer: 0, lastKnown: { x: selectedLevel.playerStart.x, y: selectedLevel.playerStart.y },
      echo: null, clones: [], hookTarget: null, aiInput: { x: 0, y: 0 }, aiTactic: "advance_anchor", aiHistory: [],
      aiObjectiveAnchorId: null, aiObjectivePosition: null, evadeTarget: null, evadeTargetUntil: 0,
      aiPath: [], aiNextPathAt: 0, aiArrivalTarget: null, aiActionUntil: 0, aiDecision: null, aiTarget: null,
      stuckTimer: 0, recoveryTarget: null, recoveryUntil: 0, recoveryAttempts: 0,
    },
    jev: {
      x: selectedLevel.jevStart.x, y: selectedLevel.jevStart.y, vx: 0, vy: 0, radius: 17, health: 6, mode: "pursue",
      stunned: 0, recoverTimer: 0, nextPathAt: 0, path: [], facing: -1,
      rendCooldown: 0, rendPhase: "", rendTimer: 0, rendAngle: 0,
      blastCooldown: 0, blastPhase: "", blastTimer: 0, blastTarget: null,
      salvoCooldown: 0, salvoPhase: "", salvoTimer: 0, salvoTarget: null,
      mineCooldown: 0, riftRushCooldown: 0, riftRushPhase: "", riftRushTimer: 0, riftRushTarget: null,
      riftRushVx: 0, riftRushVy: 0, riftRushRemaining: 0,
      shadowDodgeCooldown: 0, shadowDodgePhase: "", shadowDodgeTimer: 0, shadowDodgeTarget: null,
      summonCooldown: 0, meteorCooldown: 0,
      riftAegisCooldown: 0, riftAegisTimer: 0, riftAegisCharges: 0,
      contactStrike: null,
      stuckTimer: 0, recoveryTarget: null, recoveryUntil: 0, recoveryAttempts: 0,
      parryRecoveryUntil: 0,
      flankSide: 1,
      plan: "steady_pressure", planUntil: 0, planStartedAt: 0, planConfidence: 0,
      planStep: "approach", planStepStartedAt: 0, pendingPlan: null, actionHistory: [],
      playerRead: "unpredictable", playerReadAt: -3, planHistory: [],
    },
    hazards: selectedLevel.hazards.map((hazard) => ({ ...hazard, hitCycle: { player: -1, jev: -1 } })),
    projectiles: [],
    minions: [],
    meteors: [],
    meteorImpacts: [],
    history: [],
    actionTimeline: [],
    skillCallouts: [],
    rendSlash: null,
    playerTrail: [],
    routeProfile: { pathEfficiency: 1, turns: 0, reversals: 0, revisitedCells: 0, hotspot: null },
    nextTrailSampleAt: 0,
    activeMine: null,
    modeConfidence: 0,
    lastModeChange: 0,
  };
}

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const rect = ui.canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (ui.canvas.width !== width || ui.canvas.height !== height) {
    ui.canvas.width = width;
    ui.canvas.height = height;
  }
  ui.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const mapRatio = Math.min(window.devicePixelRatio || 1, 2);
  const mapWidth = Math.round(ui.mapOverview.clientWidth * mapRatio);
  const mapHeight = Math.round(ui.mapOverview.clientHeight * mapRatio);
  if (mapWidth > 0 && mapHeight > 0 && (ui.mapOverview.width !== mapWidth || ui.mapOverview.height !== mapHeight)) {
    ui.mapOverview.width = mapWidth;
    ui.mapOverview.height = mapHeight;
  }
}

function setConnection(ready) {
  ui.connection.dataset.ready = String(ready);
  ui.connectionLabel.textContent = ready ? "Jev connected" : "Jev running locally";
}

function renderLevelSelection() {
  selectedLevel = levels[selectedLevelIndex];
  blocks = selectedLevel.blocks;
  ui.levelNumber.textContent = String(selectedLevelIndex + 1).padStart(2, "0") + " / " + String(levels.length).padStart(2, "0");
  ui.levelName.textContent = selectedLevel.name;
  ui.landingDescription.textContent = "Break three rift anchors, then defeat your rival.";
  ui.start.firstElementChild.textContent = "Enter the arena";
  ui.levelPicker.dataset.biome = selectedLevel.biome;
  ui.levelPicker.setAttribute("aria-label", "Choose an arena. " + selectedLevel.topology);
  ui.levelPrev.disabled = selectedLevelIndex === 0;
  ui.levelNext.disabled = selectedLevelIndex === levels.length - 1;
  renderLevelThumbnails();
}

function renderLevelThumbnails() {
  const grid = document.querySelector("#level-thumbnails");
  if (!grid) return;
  if (!grid.childElementCount) {
    for (const [index, level] of levels.entries()) {
      const button = document.createElement("button");
      button.className = "level-thumbnail";
      button.type = "button";
      button.setAttribute("aria-label", "Select " + level.name);
      button.title = level.name;
      button.addEventListener("click", () => {
        selectedLevelIndex = index;
        renderLevelSelection();
      });
      const canvas = document.createElement("canvas");
      canvas.width = 216;
      canvas.height = 135;
      canvas.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = level.name;
      button.append(canvas, label);
      grid.append(button);
    }
  }
  [...grid.children].forEach((button, index) => {
    button.classList.toggle("is-selected", index === selectedLevelIndex);
    button.setAttribute("aria-pressed", String(index === selectedLevelIndex));
    drawLevelThumbnail(button.querySelector("canvas"), levels[index]);
  });
}

function drawLevelThumbnail(canvas, level) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const scaleX = canvas.width / WORLD.width;
  const scaleY = canvas.height / WORLD.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111719";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const floor = artwork.floors[level.biome];
  if (floor?.complete && floor.naturalWidth > 0) {
    for (let y = 0; y < canvas.height; y += floor.naturalHeight * scaleY) {
      for (let x = 0; x < canvas.width; x += floor.naturalWidth * scaleX) {
        ctx.drawImage(floor, x, y, floor.naturalWidth * scaleX, floor.naturalHeight * scaleY);
      }
    }
  }
  ctx.save();
  ctx.scale(scaleX, scaleY);
  ctx.fillStyle = "rgba(10, 16, 15, .12)";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  drawCompanyFloorBranding(ctx, level.biome, 0.74, level);
  for (const block of level.blocks) {
    ctx.save();
    ctx.translate(block.x + block.w / 2, block.y + block.h / 2);
    ctx.rotate(block.angle || 0);
    drawPixelOfficeObstacle(ctx, { ...block, x: -block.w / 2, y: -block.h / 2 }, level.biome);
    ctx.restore();
  }
  const hazardColors = {
    lava: "#ff784f", steam: "#ffad73", quicksand: "#d6b472", current: "#61d9d4",
    swarm: "#bbeb9b", spores: "#aee581", arc_sparks: "#ffd27a", rift_surge: "#d887ff",
  };
  for (const hazard of level.hazards) {
    const bounds = hazardBounds(hazard);
    ctx.fillStyle = hazardColors[hazard.kind] || "#d887ff";
    ctx.globalAlpha = 0.78;
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  }
  ctx.globalAlpha = 1;
  for (const point of level.chokepoints) {
    ctx.fillStyle = "#f0d08c";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function renderSkillCatalog() {
  const root = document.querySelector("#skill-catalog");
  if (!root) return;
  if (root.childElementCount) {
    syncSkillCatalogIcons(root);
    for (const name of root.querySelectorAll("[data-skill-name]")) {
      const skin = skinForLoadoutRole(name.dataset.skillOwner);
      const skill = skillManual[name.dataset.skillOwner]?.find((item) => item.id === name.dataset.skillId);
      if (skill) name.textContent = brandedSkillName(skill, skin);
    }
    return;
  }
  for (const [owner, title] of [["ghost", "Runner"], ["jev", "Chaser"]]) {
    const group = document.createElement("section");
    group.className = "skill-group " + owner + "-skill-group";
    const heading = document.createElement("h3");
    heading.textContent = title;
    const list = document.createElement("ul");
    list.className = "skill-list";
    for (const skill of skillManual[owner]) {
      const item = document.createElement("li");
      item.className = "skill-card";
      const cell = skillIconCells[skill.id];
      const icon = document.createElement("span");
      icon.className = "skill-icon";
      icon.dataset.owner = owner;
      icon.setAttribute("aria-hidden", "true");
      if (cell) {
        icon.style.setProperty("--icon-x", (cell[0] * 100 / 3) + "%");
        icon.style.setProperty("--icon-y", (cell[1] * 100 / 3) + "%");
      }
      const copy = document.createElement("span");
      copy.className = "skill-copy";
      const name = document.createElement("strong");
      name.dataset.skillName = "true";
      name.dataset.skillId = skill.id;
      name.dataset.skillOwner = owner;
      name.textContent = brandedSkillName(skill, skinForLoadoutRole(owner));
      const description = document.createElement("span");
      description.textContent = skill.description;
      copy.append(name, description);
      const key = document.createElement("kbd");
      key.className = "skill-key";
      key.textContent = skill.key || "Jev AI";
      item.append(icon, copy, key);
      list.append(item);
    }
    group.append(heading, list);
    root.append(group);
  }
  syncSkillCatalogIcons(root);
}

function syncSkillCatalogIcons(root = document.querySelector("#skill-catalog")) {
  if (!root) return;
  for (const icon of root.querySelectorAll(".skill-icon[data-owner]")) {
    const role = icon.dataset.owner === "ghost" ? "runner" : "chaser";
    const skin = skinForRole(role);
    icon.style.backgroundImage = `url("/assets/${skin.skillIconSheet}")`;
    icon.style.setProperty("--skill-accent", skin.accent);
  }
}

function setSelectedMode(mode) {
  selectedMode = mode === "auto" ? "auto" : "human";
  ui.modeHuman.classList.toggle("is-selected", selectedMode === "human");
  ui.modeAuto.classList.toggle("is-selected", selectedMode === "auto");
  ui.modeHuman.setAttribute("aria-pressed", String(selectedMode === "human"));
  ui.modeAuto.setAttribute("aria-pressed", String(selectedMode === "auto"));
}

function changeSelectedLevel(step) {
  selectedLevelIndex = clamp(selectedLevelIndex + step, 0, levels.length - 1);
  renderLevelSelection();
}

async function checkConnection() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const data = await response.json();
    setConnection(Boolean(data.ready));
  } catch {
    setConnection(false);
  }
}

function startGame() {
  cancelAnimationFrame(animationFrame);
  window.clearTimeout(calloutTimeout);
  window.clearTimeout(urgentJevDecisionTimer);
  urgentJevDecisionQueued = false;
  game = makeGame();
  cameraState.ready = false;
  cameraState.updatedAt = performance.now();
  ui.settingsOverlay.hidden = true;
  ui.settingsToggle.setAttribute("aria-label", "Pause and open settings");
  ui.settingsMusic.checked = music.enabled;
  ui.settingsVolume.value = String(Math.round(music.volume * 100));
  ui.settingsVolumeValue.value = Math.round(music.volume * 100) + "%";
  ui.settingsDifficulty.value = selectedDifficulty;
  decisionPanelCorner = "";
  lastDecisionPanelPlacementAt = -1;
  decisionPanelX = -1;
  decisionPanelY = -1;
  startMusic(game.level.biome);
  particles = [];
  screenShake = 0;
  keys.clear();
  setStick(0, 0);
  ui.landing.hidden = true;
  ui.arena.hidden = false;
  ui.arena.classList.toggle("auto-mode", selectedMode === "auto");
  ui.arenaName.textContent = selectedLevel.name.toUpperCase();
  ui.arena.setAttribute("aria-label", selectedLevel.name + " arena");
  ui.footer.hidden = true;
  document.querySelector(".site-shell").classList.add("is-playing");
  document.querySelector("main").classList.add("is-playing");
  ui.result.hidden = true;
  ui.callout.hidden = true;
  ui.playerDecisionCard.hidden = selectedMode !== "auto";
  ui.decisionPanels.classList.toggle("is-hidden", !decisionsVisible);
  ui.decisionToggle.setAttribute("aria-pressed", String(decisionsVisible));
  ui.decisionToggle.setAttribute("aria-label", decisionsVisible ? "Hide decision panels" : "Show decision panels");
  ui.nextLevel.hidden = selectedLevelIndex === levels.length - 1;
  ui.intent.dataset.mode = "pursue";
  ui.intent.classList.remove("is-thinking");
  setMode("pursue", 0, "engine");
  setPlan("steady_pressure", 0, true);
  game.jev.planUntil = game.elapsed;
  renderHealth();
  renderJevHealth();
  renderHud(true);
  resizeCanvas();
  ui.canvas.focus({ preventScroll: true });
  lastFrame = performance.now();
  nextJevDecisionAt = lastFrame;
  animationFrame = requestAnimationFrame(frame);
  void requestJevDecision();
}

function setMode(mode, confidence, source = "system_one") {
  if (!Object.hasOwn(modeLabels, mode)) return;
  const requestedMode = mode;
  const gap = distance(combatTarget(), game.jev);
  const playerGap = distance(game.player, game.jev);
  if (requestedMode !== "rift_aegis" && game.player.pulseTimer > 0 && playerGap < 174 &&
      !game.player.echo && game.jev.shadowDodgeCooldown <= 0) mode = "shadow_dodge";
  if (mode === "rift_rend" && (
    game.jev.rendCooldown > 0 || game.jev.rendPhase || playerGap > RIFT_REND_RANGE + game.player.radius || playerGap < 30 ||
    game.player.invulnerable > 0.12 || game.player.hurtTimer > 0.25 || game.jev.stunned > 0 ||
    !isLaneClear(game.jev, game.player, game.jev.radius)
  )) {
    mode = Math.hypot(game.player.vx, game.player.vy) > 35 ? "intercept" : "pursue";
  }
  if (mode === "rift_mine" && (game.jev.mineCooldown > 0 || game.activeMine)) {
    mode = "flank";
  }
  if (mode === "power_blast" && (
    game.jev.blastCooldown > 0 || gap < 174 || gap > 475 || game.jev.rendPhase || game.jev.stunned > 0 ||
    !isPowerBlastLaneClear(game.jev, predictedPowerBlastTarget())
  )) {
    mode = Math.hypot(game.player.vx, game.player.vy) > 35 ? "intercept" : "pursue";
  }
  if (mode === "soul_salvo" && (
    game.jev.salvoCooldown > 0 || game.jev.salvoPhase || game.jev.stunned > 0 || gap < 240 || gap > 820 ||
    !isSoulSalvoLaneClear(game.jev, predictedSoulSalvoTarget())
  )) {
    mode = Math.hypot(game.player.vx, game.player.vy) > 35 ? "intercept" : "pursue";
  }
  if (mode === "rift_rush" && (
    game.jev.riftRushCooldown > 0 || gap < 235 || gap > 740 || game.jev.rendPhase ||
    game.jev.blastPhase || game.jev.salvoPhase || !riftRushDestination()
  )) {
    mode = "intercept";
  }
  if (mode === "rift_aegis" && (
    game.anchors.some((anchor) => anchor.health > 0) || game.jev.riftAegisCooldown > 0 ||
    game.jev.riftAegisTimer > 0 || game.jev.riftAegisCharges > 0 ||
    (!isPlayerShotThreateningJev() && !(game.player.pulseTimer > 0 && playerGap < 174))
  )) mode = "flank";
  const parryRecoveryActions = [
    "pursue", "intercept", "rift_rush", "ambush", "rift_rend", "power_blast",
    "soul_salvo", "rift_mine", "summon_wraiths", "meteor_storm",
  ];
  if (game.elapsed < game.jev.parryRecoveryUntil && parryRecoveryActions.includes(mode)) {
    mode = "flank";
  }
  if (mode === "shadow_dodge" && (
    game.jev.stunned > 0 || game.jev.shadowDodgeCooldown > 0 || game.jev.shadowDodgePhase ||
    (!isPlayerShotThreateningJev() && !(game.player.pulseTimer > 0 && playerGap < 174))
  )) {
    mode = "flank";
  }
  if (mode === "summon_wraiths" && (game.jev.summonCooldown > 0 || game.minions.length >= 3 || game.jev.stunned > 0)) mode = "intercept";
  if (mode === "meteor_storm" && (game.jev.meteorCooldown > 0 || game.meteors.length > 0 || game.jev.stunned > 0 || gap < 250 || gap > 920)) mode = "intercept";
  const changed = game.jev.mode !== mode;
  if (changed && mode === "flank") game.jev.flankSide *= -1;
  game.jev.mode = mode;
  game.modeConfidence = confidence;
  game.lastModeChange = game.elapsed;
  game.jev.actionHistory.push({
    plan: game.jev.plan,
    requested: requestedMode,
    executed: mode,
    result: requestedMode === mode ? "started" : "adjusted",
    outcome: requestedMode === mode ? "awaiting_result" : "engine_safety_adjustment",
    source,
    at: game.elapsed,
  });
  if (game.jev.actionHistory.length > 6) game.jev.actionHistory.shift();
  if (mode === "rift_aegis") startRiftAegis();
  ui.intent.dataset.mode = mode;
  renderJevIntent();
  if (mode === "rift_rend") startRiftRend();
  if (mode === "power_blast") startPowerBlast();
  if (mode === "rift_mine") startRiftMine();
  if (mode === "rift_rush") startRiftRush();
  if (mode === "shadow_dodge") startShadowDodge();
  if (mode === "soul_salvo") startSoulSalvo();
  if (mode === "summon_wraiths") summonWraiths();
  if (mode === "meteor_storm") startMeteorStorm();
}

function setPlan(plan, confidence, force = false) {
  if (!Object.hasOwn(planLabels, plan)) return;
  const expired = game.elapsed >= game.jev.planUntil;
  if (!force && !expired && game.jev.plan !== plan) return;
  const restart = force || expired || game.jev.plan !== plan;
  if (game.jev.plan !== plan) {
    game.jev.planHistory.push({ plan: game.jev.plan, at: game.elapsed });
    if (game.jev.planHistory.length > 5) game.jev.planHistory.shift();
  }
  game.jev.plan = plan;
  game.jev.planConfidence = confidence;
  if (restart) {
    game.jev.planStartedAt = game.elapsed;
    game.jev.planUntil = game.elapsed + PLAN_COMMITMENT;
    game.jev.planStep = "approach";
    game.jev.planStepStartedAt = game.elapsed;
  }
  renderJevIntent();
}

function queuePlan(plan, confidence) {
  if (!Object.hasOwn(planLabels, plan)) return;
  if (game.elapsed < game.jev.planUntil) return;
  game.jev.pendingPlan = { plan, confidence };
}

function commitPendingPlan() {
  const pending = game.jev.pendingPlan;
  if (!pending) return;
  if (game.elapsed < game.jev.planUntil && game.jev.plan !== pending.plan) return;
  game.jev.pendingPlan = null;
  setPlan(pending.plan, pending.confidence);
}

function advancePlanStep(step) {
  game.jev.planStep = step;
  game.jev.planStepStartedAt = game.elapsed;
}

function updatePlanProgress() {
  const jev = game.jev;
  const stepAge = game.elapsed - jev.planStepStartedAt;
  if (jev.planStep === "approach") {
    const target = strategicTarget();
    if ((stepAge >= 0.35 && distance(jev, target) < 155) || stepAge >= 1.15) advancePlanStep("set_up");
  } else if (jev.planStep === "set_up") {
    const committed = jev.actionHistory.some((action) =>
      action.plan === jev.plan && action.at >= jev.planStepStartedAt && commitmentTactics.has(action.executed)
    );
    if (committed || stepAge >= 1.05) advancePlanStep("capitalize");
  } else if (jev.planStep === "capitalize") {
    const resolved = [...jev.actionHistory].reverse().some((action) =>
      action.plan === jev.plan && action.at >= jev.planStepStartedAt && action.result !== "started"
    );
    if (resolved || stepAge >= 1.35) advancePlanStep("assess");
  } else if (jev.planStep === "assess" && stepAge >= 0.65) {
    advancePlanStep("approach");
  }
}

function positionDecisionPanels() {
  if (!game || ui.decisionPanels.classList.contains("is-hidden") || game.elapsed - lastDecisionPanelPlacementAt < 0.18) return;
  lastDecisionPanelPlacementAt = game.elapsed;
  const arenaRect = ui.arena.getBoundingClientRect();
  const panelRect = ui.decisionPanels.getBoundingClientRect();
  const mobile = window.matchMedia("(max-width: 720px)").matches;
  const autoMode = game.mode === "auto";
  const margin = mobile ? 8 : 20;
  const bottomInset = mobile && !autoMode ? 116 : margin;
  const panelWidth = Math.min(panelRect.width, arenaRect.width - margin * 2);
  const panelHeight = panelRect.height;
  const topLeft = arenaRect.top + (mobile ? 145 : 70);
  const topRight = arenaRect.top + (mobile ? 145 : 180);
  const bottom = Math.max(arenaRect.top + margin, arenaRect.bottom - panelHeight - bottomInset);
  const candidates = [
    { corner: "top-left", x: arenaRect.left + margin, y: topLeft },
    { corner: "top-right", x: arenaRect.right - panelWidth - margin, y: topRight },
    { corner: "bottom-left", x: arenaRect.left + margin, y: bottom },
    { corner: "bottom-right", x: arenaRect.right - panelWidth - margin, y: bottom },
  ].map((candidate) => ({
    ...candidate,
    width: panelWidth,
    height: panelHeight,
  }));
  const view = currentViewBounds();
  const canvasRect = ui.canvas.getBoundingClientRect();
  const screenPoint = (point) => ({
    x: canvasRect.left + (point.x - view.x) / view.width * canvasRect.width,
    y: canvasRect.top + (point.y - view.y) / view.height * canvasRect.height,
  });
  const actors = [game.player, game.jev, ...(game.player.echo ? [game.player.echo] : [])].map((actor) => ({
    ...screenPoint(actor),
    radius: actor === game.jev ? 54 : 48,
  }));
  const threats = game.projectiles.filter((projectile) => projectile.owner === "jev").slice(-8).map((projectile) => ({
    ...screenPoint(projectile),
    radius: 20,
  }));
  const controls = ui.touchControls.hidden || getComputedStyle(ui.touchControls).display === "none"
    ? []
    : [...ui.touchControls.children].map((control) => control.getBoundingClientRect());
  const hudRects = [ui.arenaHud, ui.mapOverview, ui.objectiveCallout]
    .filter(Boolean)
    .map((node) => node.getBoundingClientRect());
  hudRects.push(...controls);
  const rectGap = (point, box) => {
    const dx = Math.max(box.x - point.x, 0, point.x - box.x - box.width);
    const dy = Math.max(box.y - point.y, 0, point.y - box.y - box.height);
    return Math.hypot(dx, dy);
  };
  for (const candidate of candidates) {
    const screenBox = { x: candidate.x, y: candidate.y, width: candidate.width, height: candidate.height };
    candidate.actorClearance = Math.min(...actors.map((actor) => rectGap(actor, screenBox) - actor.radius));
    candidate.threatClearance = threats.length
      ? Math.min(...threats.map((threat) => rectGap(threat, screenBox) - threat.radius))
      : Infinity;
    candidate.uiOverlapCount = hudRects.filter((rect) =>
      screenBox.x < rect.right && screenBox.x + screenBox.width > rect.left &&
      screenBox.y < rect.bottom && screenBox.y + screenBox.height > rect.top
    ).length;
  }
  const current = candidates.find((candidate) => candidate.corner === decisionPanelCorner);
  const best = candidates.sort((left, right) =>
    right.actorClearance - left.actorClearance ||
    right.threatClearance - left.threatClearance ||
    left.uiOverlapCount - right.uiOverlapCount
  )[0];
  const selected = current && current.actorClearance > 56 && current.threatClearance > 18 ? current : best;
  const localX = Math.round(selected.x - arenaRect.left);
  const localY = Math.round(selected.y - arenaRect.top);
  if (selected.corner !== decisionPanelCorner || Math.abs(localX - decisionPanelX) > 3 || Math.abs(localY - decisionPanelY) > 3) {
    decisionPanelCorner = selected.corner;
    decisionPanelX = localX;
    decisionPanelY = localY;
    ui.decisionPanels.style.left = localX + "px";
    ui.decisionPanels.style.top = localY + "px";
  }
}

function renderJevIntent() {
  if (!game) return;
  const planText = planLabels[game.jev.plan] || "PRESSING";
  const tacticText = modeLabels[game.jev.mode] || "HUNT";
  const activeSkill = ["rift_rend", "power_blast", "rift_mine", "rift_rush", "shadow_dodge", "soul_salvo", "summon_wraiths", "meteor_storm", "rift_aegis"].includes(game.jev.mode);
  ui.modeLabel.textContent = activeSkill ? tacticText : planText;
  ui.intent.setAttribute("aria-label", "Jev is " + planText.toLowerCase() + "; current tactic: " + tacticText.toLowerCase());
}

function renderHealth() {
  ui.health.replaceChildren();
  const maxHealth = game.mode === "auto" ? 5 : 4;
  for (let index = 0; index < maxHealth; index += 1) {
    const heart = document.createElement("span");
    const fill = clamp(game.player.health - index, 0, 1) * 100;
    heart.className = "heart-pip" + (fill === 0 ? " is-lost" : "");
    heart.style.setProperty("--pip-fill", fill + "%");
    heart.setAttribute("aria-hidden", "true");
    heart.textContent = "♥";
    ui.health.append(heart);
  }
  ui.health.setAttribute("aria-label", game.player.health + " of " + maxHealth + " lives remaining");
}

function renderJevHealth() {
  ui.jevHealth.replaceChildren();
  for (let index = 0; index < 6; index += 1) {
    const pip = document.createElement("span");
    const fill = clamp(game.jev.health - index, 0, 1) * 100;
    pip.className = "jev-pip" + (fill === 0 ? " is-lost" : "");
    pip.style.setProperty("--pip-fill", fill + "%");
    pip.setAttribute("aria-hidden", "true");
    ui.jevHealth.append(pip);
  }
  ui.jevHealth.setAttribute("aria-label", "Jev: " + game.jev.health + " health remaining");
}

function renderHud(force) {
  if (!force && game.elapsed - lastHudUpdate < 0.15) return;
  lastHudUpdate = game.elapsed;
  const seconds = Math.ceil(game.remaining);
  ui.timer.textContent = game.enraged ? "SURGE" : String(Math.floor(seconds / 60)).padStart(1, "0") + ":" + String(seconds % 60).padStart(2, "0");
  ui.timerCaption.textContent = game.enraged ? "THE RIFT IS OPEN" : "UNTIL RIFT SURGE";
  if (game.mode === "auto") {
    const target = aiObjectiveTarget();
    ui.objectiveLabel.textContent = target === game.jev
      ? "Ghost target · Jev"
      : "Ghost target · Anchor " + (target.id + 1);
  } else {
    ui.objectiveLabel.textContent = game.anchors.every((anchor) => anchor.health <= 0)
      ? "Jev exposed · defeat the demon"
      : "Break the rift anchors";
  }
  ui.anchorProgress.querySelectorAll(".anchor-pip").forEach((pip, index) => {
    pip.classList.toggle("is-broken", game.anchors[index].health <= 0);
  });
  ui.dashTouch.disabled = game.player.dashCooldown > 0;
  ui.pulseTouch.disabled = game.player.pulseCooldown > 0;
  ui.echoTouch.disabled = game.player.echoCooldown > 0;
  ui.hookTouch.disabled = game.player.hookCooldown > 0;
  ui.guardTouch.disabled = game.player.guardCooldown > 0;
  ui.dashTouch.setAttribute("aria-label", game.player.dashCooldown > 0 ? "Phase Dash recharging" : "Phase Dash ready");
  ui.pulseTouch.setAttribute("aria-label", game.player.pulseCooldown > 0 ? "Close-range burst recharging" : "Close-range burst ready");
  ui.echoTouch.setAttribute("aria-label", game.player.echoCooldown > 0 ? "Mirror clones recharging" : "Mirror clones ready");
  ui.hookTouch.setAttribute("aria-label", game.player.hookCooldown > 0 ? "Rift hook recharging" : "Rift hook ready");
  ui.guardTouch.setAttribute("aria-label", game.player.guardCooldown > 0 ? "Lantern guard recharging" : "Lantern guard ready");
}

function announce(message, duration = 1450) {
  window.clearTimeout(calloutTimeout);
  ui.callout.textContent = message;
  ui.callout.hidden = false;
  calloutTimeout = window.setTimeout(() => { ui.callout.hidden = true; }, duration);
}

function showSkillCallout(owner, abilityId) {
  if (!game?.running || !skillIconCells[abilityId]) return;
  game.skillCallouts = game.skillCallouts.filter((entry) => entry.owner !== owner && game.elapsed - entry.at < 1.2);
  const role = owner === "ghost" ? "runner" : "chaser";
  const skin = skinForRole(role);
  const skill = skillManual[owner].find((item) => item.id === abilityId);
  game.skillCallouts.push({
    owner, abilityId, skinId: skin.id,
    skillName: skill ? brandedSkillName(skill, skin) : abilityId,
    at: game.elapsed, duration: 1.05,
  });
}

function remember(eventName) {
  game.history.push(eventName);
  if (game.history.length > 10) game.history.shift();
  game.actionTimeline.push({ event: eventName, at: game.elapsed });
  game.actionTimeline = game.actionTimeline.filter((entry) => game.elapsed - entry.at <= 14).slice(-18);
  const outcome = actionOutcomeEvents[eventName];
  if (outcome) {
    const action = [...game.jev.actionHistory].reverse().find((entry) =>
      entry.executed === outcome[0] && game.elapsed - entry.at <= 8
    );
    if (action) {
      action.result = outcome[1];
      action.outcome = eventName;
      action.outcomeAt = game.elapsed;
    }
  }
  if (planBreakEvents.has(eventName)) game.jev.planUntil = Math.min(game.jev.planUntil, game.elapsed);
}

function measurePlayerRoute() {
  const route = game.playerTrail;
  let routeLength = 0;
  let turns = 0;
  let reversals = 0;
  const cells = new Map();
  for (let index = 0; index < route.length; index += 1) {
    const point = route[index];
    const key = Math.floor(point.x / 72) + ":" + Math.floor(point.y / 72);
    const cell = cells.get(key) || { x: Math.floor(point.x / 72) * 72 + 36, y: Math.floor(point.y / 72) * 72 + 36, visits: 0 };
    cell.visits += 1;
    cells.set(key, cell);
    if (index < 1) continue;
    const previous = route[index - 1];
    const bx = point.x - previous.x;
    const by = point.y - previous.y;
    const bLength = Math.hypot(bx, by);
    routeLength += bLength;
    if (index < 2) continue;
    const before = route[index - 2];
    const ax = previous.x - before.x;
    const ay = previous.y - before.y;
    const aLength = Math.hypot(ax, ay);
    if (aLength > 12 && bLength > 12) {
      const direction = (ax * bx + ay * by) / (aLength * bLength);
      if (direction < 0.58) turns += 1;
      if (direction < -0.28) reversals += 1;
    }
  }
  const first = route[0];
  const last = route.at(-1);
  const directDistance = first && last ? distance(first, last) : 0;
  const repeats = [...cells.values()].reduce((total, cell) => total + Math.max(0, cell.visits - 1), 0);
  const hotspot = [...cells.values()]
    .filter((cell) => cell.visits >= 3 && distance(cell, game.player) > 62)
    .sort((left, right) => right.visits - left.visits || distance(left, game.jev) - distance(right, game.jev))[0] || null;
  return {
    pathEfficiency: routeLength > 0 ? clamp(directDistance / routeLength, 0, 1) : 1,
    turns,
    reversals,
    revisitedCells: repeats,
    hotspot: hotspot ? { x: Math.round(hotspot.x), y: Math.round(hotspot.y), visits: hotspot.visits } : null,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy || 1;
  const projection = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return Math.hypot(point.x - start.x - dx * projection, point.y - start.y - dy * projection);
}

function isPlayerShotThreateningJev() {
  const player = game.player;
  const incoming = game.projectiles.some((projectile) => {
    if (projectile.owner !== "player") return false;
    const speedSquared = projectile.vx ** 2 + projectile.vy ** 2 || 1;
    const projectedTime = clamp(
      ((game.jev.x - projectile.x) * projectile.vx + (game.jev.y - projectile.y) * projectile.vy) / speedSquared,
      0,
      0.34,
    );
    const predicted = {
      x: projectile.x + projectile.vx * projectedTime,
      y: projectile.y + projectile.vy * projectedTime,
    };
    return distance(predicted, game.jev) < game.jev.radius + projectile.radius + 18;
  });
  if (incoming) return true;
  if (!(player.fireHeld || keys.has("z"))) return false;
  const target = keys.has("z") || !player.aim ? predictedShotTarget() : player.aim;
  return distanceToSegment(game.jev, player, target) < 48 && isLaneClear(player, target, 7);
}

function isJevRiftRendThreateningPlayer() {
  const player = game.player;
  const jev = game.jev;
  if (jev.rendPhase !== "windup") return false;
  const gap = distance(jev, player);
  const angleToPlayer = Math.atan2(player.y - jev.y, player.x - jev.x);
  const angleDelta = Math.atan2(Math.sin(angleToPlayer - jev.rendAngle), Math.cos(angleToPlayer - jev.rendAngle));
  return gap <= RIFT_REND_RANGE + player.radius + 16 &&
    Math.abs(angleDelta) <= RIFT_REND_HALF_ANGLE && isLaneClear(jev, player, jev.radius);
}

function isJevAttackThreateningPlayer() {
  const player = game.player;
  const jev = game.jev;
  if (isJevRiftRendThreateningPlayer()) return true;
  if (jev.riftRushPhase === "windup" && jev.riftRushTarget && distance(jev.riftRushTarget, player) < 165) return true;
  if (jev.riftRushPhase === "charge" && distanceToSegment(player, jev, {
    x: jev.x + jev.riftRushVx * 0.38,
    y: jev.y + jev.riftRushVy * 0.38,
  }) < player.radius + jev.radius + 28) return true;
  const incoming = game.projectiles.some((projectile) => {
    if (projectile.owner !== "jev") return false;
    const speedSquared = projectile.vx ** 2 + projectile.vy ** 2 || 1;
    const projectedTime = ((player.x - projectile.x) * projectile.vx + (player.y - projectile.y) * projectile.vy) / speedSquared;
    if (projectedTime < 0 || projectedTime > 0.62) return false;
    const predicted = {
      x: projectile.x + projectile.vx * projectedTime,
      y: projectile.y + projectile.vy * projectedTime,
    };
    return distance(predicted, player) < player.radius + projectile.radius + 24;
  });
  if (incoming) return true;
  if (jev.blastPhase === "windup" && jev.blastTarget && distance(jev.blastTarget, player) < 115) return true;
  if (jev.salvoPhase === "windup" && jev.salvoTarget && distance(jev.salvoTarget, player) < 170) return true;
  if (game.meteors.some((meteor) => meteor.delay < 1.05 && distance(meteor, player) < meteor.radius + 76)) return true;
  if (game.minions.some((wraith) => distance(wraith, player) < wraith.radius + player.radius + 96)) return true;
  return Boolean(game.activeMine && game.activeMine.warning <= 1.05 && distance(game.activeMine, player) < game.activeMine.radius + 82);
}

function activeInput() {
  if (game?.mode === "auto") return game.player.aiInput || { x: 0, y: 0 };
  const left = keys.has("a") || keys.has("arrowleft");
  const right = keys.has("d") || keys.has("arrowright");
  const up = keys.has("w") || keys.has("arrowup");
  const down = keys.has("s") || keys.has("arrowdown");
  let x = Number(right) - Number(left) + stick.x;
  let y = Number(down) - Number(up) + stick.y;
  const length = Math.hypot(x, y);
  if (length > 1) { x /= length; y /= length; }
  return { x, y };
}

function usePhaseDash() {
  if (!game?.running) return;
  if (game.player.dashCooldown > 0) { announce("Phase Dash recharging", 700); return; }
  const input = activeInput();
  let x = input.x;
  let y = input.y;
  if (Math.hypot(x, y) < 0.1) {
    const target = combatTarget();
    x = game.player.x - target.x;
    y = game.player.y - target.y;
    const length = Math.hypot(x, y) || 1;
    x /= length;
    y /= length;
  }
  game.player.lastKnown = { x: game.player.x, y: game.player.y };
  game.player.afterimageTimer = PHASE_AFTERIMAGE_DURATION;
  game.player.dashVx = x;
  game.player.dashVy = y;
  game.player.dashTimer = 0.21;
  game.player.dashCooldown = PHASE_DASH_COOLDOWN;
  game.player.invulnerable = Math.max(game.player.invulnerable, 0.27);
  remember("phase_dash");
  showSkillCallout("ghost", "phase_dash");
  emitParticles(game.player.x, game.player.y, "#8ef3df", 15, 135);
  queueJevDecision();
}

function useSoulBurst() {
  if (!game?.running) return;
  if (game.player.pulseCooldown > 0) return;
  game.player.pulseCooldown = 3.6;
  game.player.pulseTimer = 0.42;
  remember("soul_burst");
  showSkillCallout("ghost", "soul_burst");
  const player = game.player;
  const jev = game.jev;
  const gap = distance(player, jev);
  const clearedWraiths = game.minions.filter((wraith) => distance(player, wraith) <= 148);
  if (clearedWraiths.length) {
    game.minions = game.minions.filter((wraith) => !clearedWraiths.includes(wraith));
    remember("wraith_burst");
    for (const wraith of clearedWraiths) emitParticles(wraith.x, wraith.y, "#b8f4df", 12, 125);
  }
  const nearbyAnchor = game.anchors
    .filter((anchor) => anchor.health > 0)
    .sort((left, right) => distance(left, player) - distance(right, player))[0];
  if (nearbyAnchor && distance(nearbyAnchor, player) < 142) {
    hitAnchor(nearbyAnchor);
    jev.stunned = Math.max(jev.stunned, 0.62);
    announce(nearbyAnchor.health > 0 ? "Anchor cracked" : "Anchor shattered");
  } else if (gap < 148 && jev.stunned <= 0) {
    jev.stunned = 0.72;
    jev.recoverTimer = 0;
    if (jev.rendPhase === "windup") remember("rift_rend_interrupted");
    jev.rendPhase = "";
    jev.rendTimer = 0;
    if (jev.blastPhase) remember("blast_canceled");
    jev.blastPhase = "";
    jev.blastTimer = 0;
    jev.blastTarget = null;
    jev.riftRushPhase = "";
    jev.riftRushTimer = 0;
    jev.riftRushTarget = null;
    if (game.anchors.every((anchor) => anchor.health <= 0) && !absorbRiftAegisHit()) {
      jev.health = Math.max(0, jev.health - 1);
    }
    const angle = Math.atan2(jev.y - player.y, jev.x - player.x);
    moveEntity(jev, Math.cos(angle) * 58, Math.sin(angle) * 58, jev.radius);
    remember("burst_hit");
    renderJevHealth();
    announce(game.anchors.some((anchor) => anchor.health > 0)
      ? "Jev staggered · ward holds"
      : jev.health > 0 ? "Jev staggered" : "Jev defeated");
    emitParticles(jev.x, jev.y, "#f8cb77", 24, 170);
    screenShake = Math.max(screenShake, 5);
    checkWin();
    queueJevDecision();
  } else {
    remember("burst_missed");
    emitParticles(player.x, player.y, "#d5a5f3", 18, 145);
    queueJevDecision();
  }
}

function useMirrorEcho() {
  const player = game?.player;
  if (!game?.running || !player || player.echoCooldown > 0) return;
  const clones = [];
  for (let index = 0; index < 3; index += 1) {
    const angle = game.elapsed * 1.4 + index * Math.PI * 2 / 3;
    const radius = 76;
    const point = {
      x: clamp(player.x + Math.cos(angle) * radius, 36, WORLD.width - 36),
      y: clamp(player.y + Math.sin(angle) * radius, 36, WORLD.height - 36),
    };
    if (!blocked(point.x, point.y, 15)) clones.push({
      ...point, angle, direction: index % 2 ? -1 : 1, orbit: radius,
      life: MIRROR_CLONE_DURATION, maxLife: MIRROR_CLONE_DURATION, radius: 14,
    });
  }
  if (!clones.length) return;
  player.clones = clones;
  player.echo = clones[0];
  player.echoCooldown = 10.5;
  remember("mirror_echo");
  showSkillCallout("ghost", "mirror_echo");
  emitParticles(player.x, player.y, "#a8f3df", 26, 145);
  queueJevDecision();
}

function useRiftHook(target = null) {
  const player = game?.player;
  if (!game?.running || !player || player.hookCooldown > 0) return false;
  const destination = target || player.aim || nearestObjectiveTarget();
  if (!destination) return false;
  const dx = destination.x - player.x;
  const dy = destination.y - player.y;
  const length = Math.hypot(dx, dy) || 1;
  const travel = Math.min(345, Math.max(120, length - 64));
  const jevGap = game.mode === "auto" ? distance(player, game.jev) : Infinity;
  const safeLandingGap = jevGap < GHOST_SAFE_GAP
    ? GHOST_SAFE_GAP + 35
    : Math.min(jevGap, GHOST_SAFE_GAP + 135);
  const minimumHookGap = Math.min(jevGap, safeLandingGap);
  const movementRadius = player.clearanceRadius ?? player.radius;
  let landing = null;
  for (let distanceAlong = travel; distanceAlong >= 105; distanceAlong -= 24) {
    const candidate = {
      x: clamp(player.x + dx / length * distanceAlong, 21 + movementRadius, WORLD.width - 21 - movementRadius),
      y: clamp(player.y + dy / length * distanceAlong, 22 + movementRadius, WORLD.height - 21 - movementRadius),
    };
    const preservesJevGap = game.mode !== "auto" || (
      distance(candidate, game.jev) >= safeLandingGap &&
      distanceToSegment(game.jev, player, candidate) >= minimumHookGap - 1
    );
    if (preservesJevGap && !blocked(candidate.x, candidate.y, movementRadius) && isLaneClear(player, candidate, movementRadius)) {
      landing = candidate;
      break;
    }
  }
  if (!landing) {
    announce("Hook blocked", 750);
    return false;
  }
  player.hookTarget = { x: player.x, y: player.y, endX: landing.x, endY: landing.y, life: 0.22 };
  emitParticles(player.x, player.y, "#d1a6ff", 11, 110);
  player.x = landing.x;
  player.y = landing.y;
  player.vx = dx / length * 220;
  player.vy = dy / length * 220;
  player.invulnerable = Math.max(player.invulnerable, 0.22);
  player.hookCooldown = 6.2;
  remember("rift_hook");
  showSkillCallout("ghost", "rift_hook");
  emitParticles(player.x, player.y, "#c7a0ff", 17, 135);
  queueJevDecision();
  return true;
}

function useLanternGuard() {
  const player = game?.player;
  if (!game?.running || !player || player.guardCooldown > 0) return;
  player.guardTimer = 0.8;
  player.guardCooldown = 4.2;
  remember("lantern_guard");
  showSkillCallout("ghost", "lantern_guard");
  emitParticles(player.x, player.y, "#b9f4e0", 16, 110);
}

function nearestObjectiveTarget() {
  if (!game) return null;
  const active = game.anchors.filter((anchor) => anchor.health > 0);
  if (active.length) return active.sort((left, right) => distance(left, game.player) - distance(right, game.player))[0];
  return game.jev;
}

function combatTarget() {
  if (!game?.player) return null;
  if (game.player.echo?.life > 0) return game.player.echo;
  if (game.player.afterimageTimer > 0) {
    return { ...game.player.lastKnown, vx: 0, vy: 0, radius: game.player.radius, afterimage: true };
  }
  return game.player;
}

function predictedShotTarget() {
  const anchor = nearestObjectiveTarget();
  if (anchor && anchor !== game.jev) return { x: anchor.x, y: anchor.y };
  const lead = clamp(distance(game.player, game.jev) / PLAYER_SHOT_SPEED, 0.1, 0.42);
  return {
    x: clamp(game.jev.x + game.jev.vx * lead, 24, WORLD.width - 24),
    y: clamp(game.jev.y + game.jev.vy * lead, 24, WORLD.height - 24),
  };
}

function firePlayerShot() {
  const player = game.player;
  const target = keys.has("z") || !player.aim ? predictedShotTarget() : player.aim;
  let dx = target.x - player.x;
  let dy = target.y - player.y;
  const length = Math.hypot(dx, dy) || 1;
  dx /= length;
  dy /= length;
  player.facing = Math.sign(dx || player.facing);
  player.fireCooldown = PLAYER_SHOT_INTERVAL;
  player.shotsFired += 1;
  remember("shot_fired");
  game.projectiles.push({
    owner: "player",
    skinId: skinForRole("runner").id,
    x: player.x + dx * 19,
    y: player.y + dy * 19,
    vx: dx * PLAYER_SHOT_SPEED,
    vy: dy * PLAYER_SHOT_SPEED,
    radius: 7,
    life: 1.24,
    age: 0,
  });
  const runnerSkin = skinForRole("runner");
  emitParticles(player.x + dx * 19, player.y + dy * 19, runnerSkin.accent, 3, 64, runnerSkin);
  if (game.projectiles.length > 28) game.projectiles.shift();
}

function absorbRiftAegisHit(eventName = "rift_aegis_blocked") {
  const jev = game.jev;
  if (game.anchors.some((anchor) => anchor.health > 0) || jev.riftAegisTimer <= 0 || jev.riftAegisCharges <= 0) return false;
  jev.riftAegisCharges -= 1;
  if (jev.riftAegisCharges <= 0) jev.riftAegisTimer = 0;
  remember(eventName);
  emitParticles(jev.x, jev.y, "#9be9ed", 18, 122);
  screenShake = Math.max(screenShake, 2.5);
  queueJevDecision();
  return true;
}

function hitJev(projectile) {
  const jev = game.jev;
  const skin = skinCatalog[projectile.skinId] || skinForRole("runner");
  if (game.anchors.some((anchor) => anchor.health > 0)) {
    emitParticles(projectile.x, projectile.y, skin.accent, 9, 95, skin);
    remember("ward_blocked");
    return;
  }
  if (absorbRiftAegisHit()) return;
  jev.health = Math.max(0, jev.health - 1);
  jev.hurtTimer = 0.18;
  game.player.hitsLanded += 1;
  if (jev.blastPhase === "windup") {
    jev.blastPhase = "";
    jev.blastTimer = 0;
    jev.blastTarget = null;
    remember("blast_canceled");
  }
  if (jev.rendPhase === "windup") {
    jev.rendPhase = "";
    jev.rendTimer = 0;
    remember("rift_rend_interrupted");
  }
  if (jev.riftRushPhase === "windup") {
    jev.riftRushPhase = "";
    jev.riftRushTimer = 0;
    jev.riftRushTarget = null;
    remember("rift_rush_canceled");
  }
  if (jev.shadowDodgePhase === "windup") {
    jev.shadowDodgePhase = "";
    jev.shadowDodgeTimer = 0;
    jev.shadowDodgeTarget = null;
    remember("shadow_dodge_canceled");
  }
  if (jev.salvoPhase === "windup") {
    jev.salvoPhase = "";
    jev.salvoTimer = 0;
    jev.salvoTarget = null;
    remember("soul_salvo_canceled");
  }
  const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
  moveEntity(jev, projectile.vx / speed * 9, projectile.vy / speed * 9, jev.radius);
  remember("shot_hit");
  renderJevHealth();
  emitParticles(projectile.x, projectile.y, skin.accent, 15, 125, skin);
  screenShake = Math.max(screenShake, 2.2);
  if (jev.health <= 0) {
    announce("Jev defeated");
    finishGame("fight");
  } else {
    queueJevDecision();
  }
}

function hitAnchor(anchor, skin = skinForRole("runner")) {
  if (!anchor || anchor.health <= 0) return;
  anchor.health = Math.max(0, anchor.health - 1);
  anchor.hitFlash = 0.3;
  game.player.hitsLanded += 1;
  remember(anchor.health === 0 ? "anchor_broken" : "anchor_hit");
  emitParticles(anchor.x, anchor.y, skin.accent, anchor.health === 0 ? 30 : 13, 130, skin);
  screenShake = Math.max(screenShake, anchor.health === 0 ? 4.5 : 2.2);
  renderHud(true);
  if (anchor.health === 0) {
    const wardBroken = game.anchors.every((item) => item.health <= 0);
    announce(wardBroken ? "Ward broken · Jev exposed" : "Rift anchor shattered");
    if (wardBroken && game.jev.health > 0 && game.jev.riftAegisCooldown <= 0 &&
        game.jev.riftAegisTimer <= 0 && game.jev.riftAegisCharges <= 0) startRiftAegis();
    queueJevDecision();
  }
}

function obstacleContains(x, y, block, radius = 0) {
  const centerX = block.x + block.w / 2;
  const centerY = block.y + block.h / 2;
  const angle = block.angle || 0;
  const dx = x - centerX;
  const dy = y - centerY;
  const localX = dx * Math.cos(angle) + dy * Math.sin(angle);
  const localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
  if (block.shape === "circle") {
    const obstacleRadius = block.radius || Math.min(block.w, block.h) / 2;
    return localX * localX + localY * localY < (obstacleRadius + radius) ** 2;
  }
  if (block.shape === "ellipse") {
    const rx = block.w / 2 + radius;
    const ry = block.h / 2 + radius;
    return (localX / rx) ** 2 + (localY / ry) ** 2 < 1;
  }
  const halfWidth = block.w / 2;
  const halfHeight = block.h / 2;
  const outsideX = Math.max(0, Math.abs(localX) - halfWidth);
  const outsideY = Math.max(0, Math.abs(localY) - halfHeight);
  return (outsideX === 0 && outsideY === 0) || outsideX ** 2 + outsideY ** 2 < radius ** 2;
}

function blocked(x, y, radius) {
  if (x - radius < 21 || x + radius > WORLD.width - 21 || y - radius < 22 || y + radius > WORLD.height - 21) return true;
  return blocks.some((block) => obstacleContains(x, y, block, radius));
}

function hazardState(hazard) {
  if (!hazard.period) return { active: true, warning: false, cycle: 0 };
  const cycle = (game.elapsed + hazard.phase) % hazard.period;
  return {
    active: cycle < hazard.activeFor,
    warning: cycle >= hazard.period - hazard.warningFor,
    cycle: Math.floor((game.elapsed + hazard.phase) / hazard.period),
  };
}

function hazardBounds(hazard) {
  if (hazard.kind !== "swarm" || !hazard.movePeriod) return hazard;
  const angle = ((game?.elapsed || 0) + (hazard.phase || 0)) * Math.PI * 2 / hazard.movePeriod;
  return {
    ...hazard,
    x: clamp(hazard.x + Math.cos(angle) * hazard.moveX, 30, WORLD.width - hazard.w - 30),
    y: clamp(hazard.y + Math.sin(angle * 0.82) * hazard.moveY, 30, WORLD.height - hazard.h - 30),
  };
}

function insideHazard(point, hazard) {
  const bounds = hazardBounds(hazard);
  return point.x >= bounds.x && point.x <= bounds.x + bounds.w &&
    point.y >= bounds.y && point.y <= bounds.y + bounds.h;
}

function touchesHazard(entity, hazard) {
  const bounds = hazardBounds(hazard);
  const nearX = clamp(entity.x, bounds.x, bounds.x + bounds.w);
  const nearY = clamp(entity.y, bounds.y, bounds.y + bounds.h);
  return Math.hypot(entity.x - nearX, entity.y - nearY) <= entity.radius;
}

function updateEnvironmentHazards() {
  for (const hazard of game.hazards) {
    if (hazard.kind !== "lava") continue;
    const status = hazardState(hazard);
    if (!status.active) continue;
    for (const [owner, actor] of [["player", game.player], ["jev", game.jev]]) {
      if (hazard.hitCycle[owner] === status.cycle || !touchesHazard(actor, hazard)) continue;
      hazard.hitCycle[owner] = status.cycle;
      if (owner === "player") {
        const angle = Math.atan2(actor.y - (hazard.y + hazard.h / 2), actor.x - (hazard.x + hazard.w / 2));
        if (actor.dashTimer > 0 || actor.invulnerable > 0 || actor.hurtTimer > 0) {
          remember("lava_evaded");
          continue;
        }
        damagePlayer("lava_hit", Math.cos(angle), Math.sin(angle), 0.5, true);
      } else if (actor.health > 0) {
        actor.health = Math.max(0, Number((actor.health - 0.75).toFixed(2)));
        actor.hurtTimer = Math.max(actor.hurtTimer || 0, 0.22);
        remember("lava_hit");
        renderJevHealth();
        emitParticles(actor.x, actor.y, "#ff8150", 12, 105);
        if (actor.health <= 0 && game.anchors.every((anchor) => anchor.health <= 0)) finishGame("fight");
      }
    }
  }
}

function environmentEffects(point) {
  const effect = { speed: 1, flowX: 0, flowY: 0 };
  for (const hazard of game.hazards) {
    if (!insideHazard(point, hazard)) continue;
    const status = hazardState(hazard);
    if (hazard.kind === "current") {
      effect.flowX += hazard.flowX * 105;
      effect.flowY += hazard.flowY * 105;
    } else if (status.active && ["steam", "spores", "quicksand", "swarm"].includes(hazard.kind)) {
      const slowdown = { steam: 0.56, spores: 0.68, quicksand: 0.46, swarm: 0.6 }[hazard.kind];
      effect.speed = Math.min(effect.speed, slowdown);
    } else if (status.active && hazard.kind === "lava") {
      effect.speed = Math.min(effect.speed, 0.72);
    } else if (status.active && hazard.kind === "arc_sparks") {
      const dx = point.x - (hazard.x + hazard.w / 2);
      const dy = point.y - (hazard.y + hazard.h / 2);
      const length = Math.hypot(dx, dy) || 1;
      effect.speed = Math.min(effect.speed, 0.82);
      effect.flowX += -dy / length * 118;
      effect.flowY += dx / length * 118;
    } else if (status.active && hazard.kind === "rift_surge") {
      const dx = point.x - (hazard.x + hazard.w / 2);
      const dy = point.y - (hazard.y + hazard.h / 2);
      const length = Math.hypot(dx, dy) || 1;
      effect.speed = Math.min(effect.speed, 0.9);
      effect.flowX += dx / length * 168;
      effect.flowY += dy / length * 168;
    }
  }
  return effect;
}

function terrainTravelCost(x, y, dx, dy, baseCost) {
  let multiplier = 1;
  const center = { x: x * WORLD.cell + WORLD.cell / 2, y: y * WORLD.cell + WORLD.cell / 2 };
  for (const hazard of game.hazards) {
    if (!insideHazard(center, hazard)) continue;
    if (hazard.kind === "current") {
      const directionLength = Math.hypot(dx, dy) || 1;
      const flowLength = Math.hypot(hazard.flowX, hazard.flowY) || 1;
      const alignment = (dx * hazard.flowX + dy * hazard.flowY) / (directionLength * flowLength);
      multiplier *= alignment < -0.35 ? 1.6 : alignment > 0.45 ? 1.04 : 1.18;
      continue;
    }
    const status = hazardState(hazard);
    const activeCost = {
      steam: 4.2,
      spores: 2.9,
      quicksand: 4.6,
      swarm: 3.1,
      lava: 2.4,
      arc_sparks: 6.1,
      rift_surge: 4.8,
    }[hazard.kind] || 3.5;
    if (status.active) multiplier *= activeCost;
    else if (status.warning) multiplier *= 1.7;
  }
  return baseCost * multiplier;
}

function predictedPowerBlastTarget() {
  const player = combatTarget();
  if (player !== game.player) return { x: player.x, y: player.y };
  const origin = { x: game.jev.x, y: game.jev.y - 5 };
  const flightTime = estimateInterceptTime(origin, player, POWER_BLAST_SPEED, POWER_BLAST_WINDUP, 1.8);
  const target = predictPlayerPosition(POWER_BLAST_WINDUP + flightTime);
  return target;
}

function predictedSoulSalvoTarget() {
  const player = combatTarget();
  if (player !== game.player) return { x: player.x, y: player.y };
  const origin = { x: game.jev.x, y: game.jev.y - 6 };
  const flightTime = estimateInterceptTime(origin, player, SOUL_SALVO_SPEED, SOUL_SALVO_WINDUP, 1.8);
  return predictPlayerPosition(SOUL_SALVO_WINDUP + flightTime);
}

function predictPlayerPosition(duration, trackRealGhost = false) {
  const player = trackRealGhost ? game.player : combatTarget();
  if (!trackRealGhost && player !== game.player) return { x: player.x, y: player.y };
  const input = activeInput();
  let x = player.x;
  let y = player.y;
  let dashRemaining = player.dashTimer;
  let elapsed = 0;
  let remaining = Math.max(0, duration);
  const stepSize = 1 / 30;
  while (remaining > 0) {
    const step = Math.min(stepSize, remaining, dashRemaining > 0 ? dashRemaining : Infinity);
    const dashing = dashRemaining > 0;
    const speed = player.speed * (player.snaredTimer > elapsed ? 0.54 : 1);
    const vx = dashing ? player.dashVx * 740 : input.x * speed;
    const vy = dashing ? player.dashVy * 740 : input.y * speed;
    const nextX = x + vx * step;
    if (!blocked(nextX, y, player.radius)) x = nextX;
    const nextY = y + vy * step;
    if (!blocked(x, nextY, player.radius)) y = nextY;
    x = clamp(x, 21 + player.radius, WORLD.width - 21 - player.radius);
    y = clamp(y, 22 + player.radius, WORLD.height - 21 - player.radius);
    dashRemaining = Math.max(0, dashRemaining - step);
    elapsed += step;
    remaining -= step;
  }
  return { x, y };
}

function estimateInterceptTime(origin, target, projectileSpeed, windup, maxFlight) {
  const vx = target.vx || 0;
  const vy = target.vy || 0;
  const rx = target.x + vx * windup - origin.x;
  const ry = target.y + vy * windup - origin.y;
  const a = vx * vx + vy * vy - projectileSpeed * projectileSpeed;
  const b = 2 * (rx * vx + ry * vy);
  const c = rx * rx + ry * ry;
  const times = [];
  if (Math.abs(a) < 0.001) {
    if (b < 0) times.push(-c / b);
  } else {
    const discriminant = b * b - 4 * a * c;
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      times.push((-b - root) / (2 * a), (-b + root) / (2 * a));
    }
  }
  const positiveTime = times.filter((time) => Number.isFinite(time) && time > 0).sort((left, right) => left - right)[0];
  return positiveTime === undefined
    ? clamp(Math.hypot(rx, ry) / projectileSpeed, 0.08, maxFlight)
    : clamp(positiveTime, 0.08, maxFlight);
}

function laneIntersectsBlock(origin, target, block, radius) {
  const centerX = block.x + block.w / 2;
  const centerY = block.y + block.h / 2;
  const angle = block.angle || 0;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const toLocal = (point) => {
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    return { x: dx * cosine + dy * sine, y: -dx * sine + dy * cosine };
  };
  const start = toLocal(origin);
  const end = toLocal(target);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (block.shape === "circle") {
    const obstacleRadius = block.radius || Math.min(block.w, block.h) / 2;
    return distanceToSegment({ x: 0, y: 0 }, start, end) < obstacleRadius + radius;
  }
  if (block.shape === "ellipse") {
    const rx = block.w / 2 + radius;
    const ry = block.h / 2 + radius;
    const inverseRxSquared = 1 / (rx * rx);
    const inverseRySquared = 1 / (ry * ry);
    const denominator = dx * dx * inverseRxSquared + dy * dy * inverseRySquared;
    const projection = denominator > 0
      ? clamp(-(start.x * dx * inverseRxSquared + start.y * dy * inverseRySquared) / denominator, 0, 1)
      : 0;
    const nearestX = start.x + dx * projection;
    const nearestY = start.y + dy * projection;
    return nearestX * nearestX * inverseRxSquared + nearestY * nearestY * inverseRySquared < 1;
  }

  const halfWidth = block.w / 2;
  const halfHeight = block.h / 2;
  let entry = 0;
  let exit = 1;
  let intersectsCore = true;
  for (const [position, delta, halfExtent] of [
    [start.x, dx, halfWidth],
    [start.y, dy, halfHeight],
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (position < -halfExtent || position > halfExtent) {
        intersectsCore = false;
        break;
      }
      continue;
    }
    const first = (-halfExtent - position) / delta;
    const second = (halfExtent - position) / delta;
    entry = Math.max(entry, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (entry > exit) {
      intersectsCore = false;
      break;
    }
  }
  if (intersectsCore) return true;

  const pointToRectDistanceSquared = (point) => {
    const outsideX = Math.max(0, Math.abs(point.x) - halfWidth);
    const outsideY = Math.max(0, Math.abs(point.y) - halfHeight);
    return outsideX * outsideX + outsideY * outsideY;
  };
  let nearestDistanceSquared = Math.min(pointToRectDistanceSquared(start), pointToRectDistanceSquared(end));
  for (const cornerX of [-halfWidth, halfWidth]) {
    for (const cornerY of [-halfHeight, halfHeight]) {
      nearestDistanceSquared = Math.min(
        nearestDistanceSquared,
        distanceToSegment({ x: cornerX, y: cornerY }, start, end) ** 2,
      );
    }
  }
  return nearestDistanceSquared < radius * radius;
}

function isLaneClear(origin, target, radius) {
  if (blocked(origin.x, origin.y, radius) || blocked(target.x, target.y, radius)) return false;
  return !blocks.some((block) => laneIntersectsBlock(origin, target, block, radius));
}

function isProjectileLaneClear(origin, target, radius) {
  return !blocked(target.x, target.y, radius) && isLaneClear(origin, target, radius);
}

function isPowerBlastLaneClear(origin, target) {
  return isProjectileLaneClear(origin, target, 14);
}

function isSoulSalvoLaneClear(origin, target) {
  return isProjectileLaneClear(origin, target, 11);
}

function moveEntity(entity, dx, dy, radius) {
  const movementRadius = entity.clearanceRadius ?? radius;
  const nextX = entity.x + dx;
  const nextY = entity.y + dy;
  if (!blocked(nextX, nextY, movementRadius) && isLaneClear(entity, { x: nextX, y: nextY }, movementRadius)) {
    entity.x = nextX;
    entity.y = nextY;
  } else {
    let movedX = false;
    let movedY = false;
    if (!blocked(nextX, entity.y, movementRadius) && isLaneClear(entity, { x: nextX, y: entity.y }, movementRadius)) {
      entity.x = nextX;
      movedX = true;
    }
    if (!blocked(entity.x, nextY, movementRadius) && isLaneClear(entity, { x: entity.x, y: nextY }, movementRadius)) {
      entity.y = nextY;
      movedY = true;
    }
    if (!movedX && !movedY) {
      for (const frac of [0.6, 0.3]) {
        const fx = entity.x + dx * frac;
        const fy = entity.y + dy * frac;
        if (!blocked(fx, entity.y, movementRadius) &&
            isLaneClear(entity, { x: fx, y: entity.y }, movementRadius)) {
          entity.x = fx;
          break;
        }
        if (!blocked(entity.x, fy, movementRadius) &&
            isLaneClear(entity, { x: entity.x, y: fy }, movementRadius)) {
          entity.y = fy;
          break;
        }
      }
    }
  }
  entity.x = clamp(entity.x, 21 + movementRadius, WORLD.width - 21 - movementRadius);
  entity.y = clamp(entity.y, 22 + movementRadius, WORLD.height - 21 - movementRadius);
}

function startRiftRend() {
  const jev = game.jev;
  const gap = distance(game.player, jev);
  if (jev.rendCooldown > 0 || jev.rendPhase || jev.blastPhase || jev.stunned > 0 ||
      gap < 30 || gap > RIFT_REND_RANGE + game.player.radius ||
      game.player.invulnerable > 0.12 || game.player.hurtTimer > 0.25) return;
  const predicted = predictPlayerPosition(RIFT_REND_WINDUP * 0.55, true);
  const angle = Math.atan2(predicted.y - jev.y, predicted.x - jev.x);
  if (!isLaneClear(jev, game.player, jev.radius)) return;
  jev.rendAngle = angle;
  jev.rendPhase = "windup";
  if (Math.abs(Math.cos(angle)) > 0.05) jev.facing = Math.sign(Math.cos(angle));
  jev.rendTimer = RIFT_REND_WINDUP;
  jev.rendCooldown = RIFT_REND_COOLDOWN;
  jev.path = [];
  remember("rift_rend_windup");
  showSkillCallout("jev", "rift_rend");
  announce("Jev winds up a Rift Rend!");
  emitParticles(jev.x, jev.y, "#fb686f", 14, 105);
}

function fireRiftRend() {
  const jev = game.jev;
  const player = game.player;
  const gap = distance(jev, player);
  const angleToPlayer = Math.atan2(player.y - jev.y, player.x - jev.x);
  const angleDelta = Math.atan2(Math.sin(angleToPlayer - jev.rendAngle), Math.cos(angleToPlayer - jev.rendAngle));
  const inArc = gap <= RIFT_REND_RANGE + player.radius && Math.abs(angleDelta) <= RIFT_REND_HALF_ANGLE;
  const clearLane = isLaneClear(jev, player, jev.radius);
  remember("rift_rend_fired");
  game.rendSlash = { x: jev.x, y: jev.y, angle: jev.rendAngle, at: game.elapsed, duration: 0.28 };
  screenShake = Math.max(screenShake, inArc && clearLane ? 5 : 2);
  if (inArc && clearLane) {
    if (player.invulnerable > 0 || player.hurtTimer > 0) {
      remember("rift_rend_evaded");
    } else {
      const dx = Math.cos(jev.rendAngle);
      const dy = Math.sin(jev.rendAngle);
      if (damagePlayer("rift_rend_hit", dx, dy, 1, false)) {
        emitParticles(player.x, player.y, "#ff8792", 23, 185);
      } else {
        remember("rift_rend_evaded");
      }
    }
  } else {
    remember("rift_rend_missed");
    emitParticles(jev.x + Math.cos(jev.rendAngle) * 96, jev.y + Math.sin(jev.rendAngle) * 96, "#ff9c9e", 12, 115);
  }
  jev.rendPhase = "recover";
  jev.rendTimer = 0.3;
  jev.vx = 0;
  jev.vy = 0;
}

function startPowerBlast() {
  const jev = game.jev;
  const gap = distance(combatTarget(), jev);
  if (jev.blastCooldown > 0 || jev.blastPhase || jev.rendPhase || jev.stunned > 0 || gap < 174 || gap > 475) return;
  const target = predictedPowerBlastTarget();
  if (!isPowerBlastLaneClear(jev, target)) return;
  jev.blastTarget = target;
  jev.blastPhase = "windup";
  if (Math.abs(target.x - jev.x) > 5) jev.facing = Math.sign(target.x - jev.x);
  jev.blastTimer = POWER_BLAST_WINDUP;
  jev.blastCooldown = 3.45;
  const skin = skinForRole("chaser");
  const skill = skillManual.jev.find((item) => item.id === "power_blast");
  announce(brandedSkillName(skill, skin) + " charging");
  emitParticles(jev.x, jev.y, skin.accent, 14, 110, skin);
}

function firePowerBlast() {
  const jev = game.jev;
  if (!jev.blastTarget) return;
  if (!isPowerBlastLaneClear(jev, jev.blastTarget)) {
    jev.blastPhase = "";
    jev.blastTarget = null;
    jev.blastCooldown = Math.min(jev.blastCooldown, 1.2);
    remember("blast_cover_blocked");
    queueJevDecision();
    return;
  }
  const dx = jev.blastTarget.x - jev.x;
  const dy = jev.blastTarget.y - jev.y;
  const length = Math.hypot(dx, dy) || 1;
  game.projectiles.push({
    owner: "jev", kind: "blast",
    skinId: skinForRole("chaser").id,
    x: jev.x, y: jev.y - 5,
    vx: dx / length * POWER_BLAST_SPEED, vy: dy / length * POWER_BLAST_SPEED,
    radius: 14, life: 2.2, age: 0, distanceTravelled: 0,
    maxDistance: length + (combatTarget().radius || game.player.radius) + 14,
  });
  jev.facing = Math.sign(dx || jev.facing);
  jev.blastPhase = "";
  jev.blastTarget = null;
  remember("power_blast_fired");
  showSkillCallout("jev", "power_blast");
  emitParticles(jev.x, jev.y, skinForRole("chaser").accent, 12, 125, skinForRole("chaser"));
}

function startSoulSalvo() {
  const jev = game.jev;
  const target = combatTarget();
  const gap = distance(target, jev);
  if (jev.salvoCooldown > 0 || jev.salvoPhase || jev.rendPhase || jev.blastPhase || jev.stunned > 0 || gap < 240 || gap > 820) return;
  const aim = target === game.player ? predictedSoulSalvoTarget() : { x: target.x, y: target.y };
  if (!isSoulSalvoLaneClear(jev, aim)) return;
  jev.salvoTarget = aim;
  jev.salvoPhase = "windup";
  jev.salvoTimer = SOUL_SALVO_WINDUP;
  jev.salvoCooldown = 7.4;
  jev.path = [];
  jev.facing = Math.sign(aim.x - jev.x || jev.facing);
  remember("soul_salvo_windup");
  const skin = skinForRole("chaser");
  const skill = skillManual.jev.find((item) => item.id === "soul_salvo");
  announce(brandedSkillName(skill, skin) + " assembling");
  emitParticles(jev.x, jev.y, skin.accent, 17, 120, skin);
}

function fireSoulSalvo() {
  const jev = game.jev;
  if (!jev.salvoTarget) return;
  const origin = { x: jev.x, y: jev.y - 6 };
  const angle = Math.atan2(jev.salvoTarget.y - origin.y, jev.salvoTarget.x - origin.x);
  const reach = Math.min(distance(origin, jev.salvoTarget), SOUL_SALVO_SPEED * 1.9);
  let fired = 0;
  for (const offset of [-0.035, 0, 0.035]) {
    const shotAngle = angle + offset;
    const endpoint = {
      x: origin.x + Math.cos(shotAngle) * reach,
      y: origin.y + Math.sin(shotAngle) * reach,
    };
    if (!isProjectileLaneClear(origin, endpoint, 11)) {
      remember("salvo_cover_blocked");
      continue;
    }
    game.projectiles.push({
      owner: "jev", kind: "salvo", skinId: skinForRole("chaser").id, x: origin.x, y: origin.y,
      vx: Math.cos(shotAngle) * SOUL_SALVO_SPEED,
      vy: Math.sin(shotAngle) * SOUL_SALVO_SPEED,
      radius: 11, life: 1.9, age: 0, distanceTravelled: 0,
      maxDistance: reach + (combatTarget().radius || game.player.radius) + 11,
    });
    fired += 1;
  }
  jev.salvoPhase = "";
  jev.salvoTarget = null;
  if (!fired) {
    jev.salvoCooldown = Math.min(jev.salvoCooldown, 1.2);
    queueJevDecision();
    return;
  }
  remember("soul_salvo_fired");
  showSkillCallout("jev", "soul_salvo");
  emitParticles(jev.x, jev.y, skinForRole("chaser").accent, 16, 155, skinForRole("chaser"));
}

function startRiftMine() {
  const jev = game.jev;
  if (jev.mineCooldown > 0 || game.activeMine) return;
  const predicted = predictPlayer(0.48);
  const speed = Math.hypot(game.player.vx, game.player.vy);
  const forwardX = speed > 45 ? game.player.vx / speed : 0;
  const forwardY = speed > 45 ? game.player.vy / speed : 0;
  const center = {
    x: clamp(predicted.x + forwardX * 52, 55, WORLD.width - 55),
    y: clamp(predicted.y + forwardY * 52, 55, WORLD.height - 55),
  };
  const candidates = [center];
  for (const radius of [36, 70]) {
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI / 4;
      candidates.push({
        x: clamp(center.x + Math.cos(angle) * radius, 55, WORLD.width - 55),
        y: clamp(center.y + Math.sin(angle) * radius, 55, WORLD.height - 55),
      });
    }
  }
  const point = candidates.find((candidate) =>
    !blocked(candidate.x, candidate.y, 24) && distance(candidate, game.player) > 54 && distance(candidate, jev) > 56
  );
  if (!point) return;
  game.activeMine = { x: point.x, y: point.y, warning: 1.15, life: 3.55, radius: 48 };
  jev.mineCooldown = 6.8;
  remember("mine_placed");
  showSkillCallout("jev", "rift_mine");
  emitParticles(point.x, point.y, "#cb8ff2", 13, 90);
}

function summonWraiths() {
  const jev = game.jev;
  if (jev.summonCooldown > 0 || game.minions.length >= 3 || jev.stunned > 0) return;
  const towardPlayer = Math.atan2(game.player.y - jev.y, game.player.x - jev.x);
  const newWraiths = [];
  for (const [index, offset] of [-0.7, 0, 0.7].entries()) {
    const angle = towardPlayer + offset + Math.PI;
    const candidate = [58, 86, 118].map((radius) => ({
      x: clamp(jev.x + Math.cos(angle) * radius, 40, WORLD.width - 40),
      y: clamp(jev.y + Math.sin(angle) * radius, 40, WORLD.height - 40),
    })).find((point) => !blocked(point.x, point.y, 12));
    if (!candidate) continue;
    newWraiths.push({
      ...candidate,
      vx: 0,
      vy: 0,
      radius: 12,
      life: 9.5,
      nextPathAt: 0,
      path: [],
      phase: game.elapsed * 1.3 + index * 2.1,
    });
  }
  if (!newWraiths.length) return;
  game.minions.push(...newWraiths.slice(0, 3 - game.minions.length));
  jev.summonCooldown = 14;
  remember("wraiths_summoned");
  showSkillCallout("jev", "summon_wraiths");
  for (const wraith of newWraiths) emitParticles(wraith.x, wraith.y, "#ca83fa", 10, 88);
}

function startMeteorStorm() {
  const jev = game.jev;
  const target = combatTarget();
  const gap = distance(target, jev);
  if (jev.meteorCooldown > 0 || jev.stunned > 0 || gap < 250 || gap > 920 || game.meteors.length) return;
  const speed = target === game.player ? Math.hypot(game.player.vx, game.player.vy) : Math.hypot(target.vx || 0, target.vy || 0);
  const lateral = speed > 35
    ? { x: -game.player.vy / speed, y: game.player.vx / speed }
    : { x: 0, y: 1 };
  for (let index = 0; index < 3; index += 1) {
    const lead = 0.38 + index * 0.24;
    const predicted = predictPlayer(lead);
    const spread = (index - 1) * 70;
    const point = {
      x: clamp(predicted.x + lateral.x * spread, 50, WORLD.width - 50),
      y: clamp(predicted.y + lateral.y * spread, 50, WORLD.height - 50),
    };
    if (blocked(point.x, point.y, 62)) {
      point.x = predicted.x;
      point.y = predicted.y;
    }
    game.meteors.push({ ...point, radius: 62, delay: 0.92 + index * 0.27 });
  }
  jev.meteorCooldown = 11.5;
  remember("meteor_storm_started");
  showSkillCallout("jev", "meteor_storm");
  announce("Meteor storm incoming");
}

function updateMeteors(dt) {
  const pending = [];
  for (const meteor of game.meteors) {
    meteor.delay -= dt;
    if (meteor.delay > 0) {
      pending.push(meteor);
      continue;
    }
    const gap = distance(game.player, meteor);
    const angle = Math.atan2(game.player.y - meteor.y, game.player.x - meteor.x);
    const hit = gap <= meteor.radius + game.player.radius && game.player.dashTimer <= 0;
    const landed = hit && damagePlayer("meteor_hit", Math.cos(angle), Math.sin(angle));
    if (!landed) remember("meteor_evaded");
    game.meteorImpacts.push({ x: meteor.x, y: meteor.y, radius: meteor.radius, life: 0.5, maxLife: 0.5 });
    emitParticles(meteor.x, meteor.y, landed ? "#ff865a" : "#f4c477", landed ? 27 : 17, 180);
    screenShake = Math.max(screenShake, landed ? 7 : 3);
  }
  game.meteors = pending;
  for (const impact of game.meteorImpacts) impact.life -= dt;
  game.meteorImpacts = game.meteorImpacts.filter((impact) => impact.life > 0);
}

function updateWraiths(dt) {
  const remaining = [];
  for (const wraith of game.minions) {
    wraith.life -= dt;
    if (wraith.life <= 0) continue;
    const target = game.player;
    if (game.elapsed >= wraith.nextPathAt || !wraith.path.length) {
      wraith.path = findPath(wraith, predictPlayer(0.16));
      wraith.nextPathAt = game.elapsed + 0.38;
    }
    while (wraith.path.length && distance(wraith, wraith.path[0]) < 14) wraith.path.shift();
    const waypoint = wraith.path[0] || target;
    const dx = waypoint.x - wraith.x;
    const dy = waypoint.y - wraith.y;
    const length = Math.hypot(dx, dy) || 1;
    const beforeX = wraith.x;
    const beforeY = wraith.y;
    const speed = 232 + Math.sin(game.elapsed * 8 + wraith.phase) * 18;
    wraith.vx = dx / length * speed;
    wraith.vy = dy / length * speed;
    moveEntity(wraith, wraith.vx * dt, wraith.vy * dt, wraith.radius);
    if (distance(wraith, target) <= wraith.radius + target.radius + 5) {
      if (target.dashTimer > 0) {
        remember("wraith_dash");
      } else if (target.guardTimer > 0) {
        target.guardTimer = 0;
        remember("wraith_burst");
      } else {
        damagePlayer("wraith_hit", Math.sign(target.x - wraith.x), Math.sign(target.y - wraith.y));
      }
      emitParticles(wraith.x, wraith.y, "#c993f1", 13, 110);
      continue;
    }
    if (Math.hypot(wraith.x - beforeX, wraith.y - beforeY) > 0.2) wraith.phase += dt * 3;
    remaining.push(wraith);
  }
  game.minions = remaining;
}

function updateRiftMine(dt) {
  const mine = game.activeMine;
  if (!mine) return;
  mine.warning = Math.max(0, mine.warning - dt);
  if (mine.warning <= 0 && distance(game.player, mine) < mine.radius && game.player.dashTimer <= 0) {
    game.player.snaredTimer = Math.max(game.player.snaredTimer, 0.72);
    remember("mine_triggered");
    damagePlayer("mine_hit", Math.sign(game.player.x - mine.x) || 0, Math.sign(game.player.y - mine.y) || -1);
    game.activeMine = null;
    emitParticles(mine.x, mine.y, "#cb8ff2", 22, 155);
    queueJevDecision();
    return;
  }
  if (mine.warning <= 0 && distance(game.player, mine) < mine.radius && game.player.dashTimer > 0) {
    remember("mine_evaded");
    game.activeMine = null;
    emitParticles(mine.x, mine.y, "#bfe8ef", 14, 105);
    return;
  }
  mine.life -= dt;
  if (mine.life <= 0) {
    remember("mine_evaded");
    game.activeMine = null;
  }
}

function predictPlayer(seconds) {
  const target = combatTarget();
  if (target !== game.player) return { x: target.x, y: target.y };
  return {
    x: clamp(game.player.x + game.player.vx * seconds, 38, WORLD.width - 38),
    y: clamp(game.player.y + game.player.vy * seconds, 38, WORLD.height - 38),
  };
}

function startRiftRush() {
  const jev = game.jev;
  const gap = distance(combatTarget(), jev);
  const destination = riftRushDestination();
  if (jev.riftRushCooldown > 0 || gap < 235 || gap > 740 || jev.rendPhase || jev.blastPhase || !destination) return;
  jev.riftRushTarget = destination;
  const dx = destination.x - jev.x;
  const dy = destination.y - jev.y;
  const length = Math.hypot(dx, dy) || 1;
  jev.riftRushVx = dx / length * RIFT_RUSH_SPEED;
  jev.riftRushVy = dy / length * RIFT_RUSH_SPEED;
  jev.riftRushRemaining = length;
  jev.riftRushPhase = "windup";
  jev.riftRushTimer = RIFT_RUSH_WINDUP;
  jev.riftRushCooldown = RIFT_RUSH_COOLDOWN;
  jev.path = [];
  remember("rift_rush_windup");
  showSkillCallout("jev", "rift_rush");
  emitParticles(jev.x, jev.y, "#ff9779", 18, 125);
}

function completeRiftRush() {
  const jev = game.jev;
  if (!jev.riftRushTarget || !isLaneClear(jev, jev.riftRushTarget, jev.radius)) {
    jev.riftRushPhase = "";
    jev.riftRushTarget = null;
    remember("rift_rush_canceled");
    return;
  }
  jev.riftRushPhase = "charge";
  jev.facing = Math.sign(jev.riftRushVx || jev.facing);
  emitParticles(jev.x, jev.y, "#ffb17f", 20, 180);
}

function riftRushDestination() {
  if (!game?.jev || !game?.player) return null;
  const target = combatTarget();
  const gap = distance(target, game.jev);
  if (gap < 235 || gap > 740) return null;
  const aim = target === game.player
    ? predictPlayer(clamp(gap / RIFT_RUSH_SPEED * 0.42, 0.16, 0.38))
    : { x: target.x, y: target.y };
  const dx = aim.x - game.jev.x;
  const dy = aim.y - game.jev.y;
  const length = Math.hypot(dx, dy) || 1;
  const travel = Math.min(RIFT_RUSH_MAX_TRAVEL, Math.max(0, length - 118));
  if (travel < 145) return null;
  const destination = {
    x: clamp(game.jev.x + dx / length * travel, 38, WORLD.width - 38),
    y: clamp(game.jev.y + dy / length * travel, 38, WORLD.height - 38),
  };
  if (blocked(destination.x, destination.y, game.jev.radius) || !isLaneClear(game.jev, destination, game.jev.radius)) return null;
  return destination;
}

function startRiftAegis() {
  const jev = game.jev;
  const anchorsRemain = game.anchors.some((anchor) => anchor.health > 0);
  if (anchorsRemain || jev.health <= 0 || jev.riftAegisCooldown > 0 || jev.riftAegisTimer > 0 || jev.riftAegisCharges > 0) return;
  const actionAlreadyRecorded = [...jev.actionHistory].reverse().some((entry) =>
    entry.executed === "rift_aegis" && game.elapsed - entry.at < 0.5
  );
  if (!actionAlreadyRecorded) {
    jev.actionHistory.push({
      plan: jev.plan, requested: "rift_aegis", executed: "rift_aegis", result: "started",
      outcome: "awaiting_result", source: "phase_transition", at: game.elapsed,
    });
    if (jev.actionHistory.length > 6) jev.actionHistory.shift();
  }
  jev.riftAegisTimer = 2.8;
  jev.riftAegisCharges = 2;
  jev.riftAegisCooldown = 15.5;
  remember("rift_aegis_activated");
  showSkillCallout("jev", "rift_aegis");
  emitParticles(jev.x, jev.y, "#91e1ed", 22, 130);
}

function startShadowDodge() {
  const jev = game.jev;
  const burstThreat = game.player.pulseTimer > 0 && distance(game.player, jev) < 174;
  const shotThreat = isPlayerShotThreateningJev();
  if (jev.shadowDodgeCooldown > 0 || jev.shadowDodgePhase || (!shotThreat && !burstThreat)) return;
  const player = game.player;
  const aim = shotThreat ? (keys.has("z") || !player.aim ? predictedShotTarget() : player.aim) : jev;
  const dx = aim.x - player.x;
  const dy = aim.y - player.y;
  const length = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / length, y: dx / length };
  jev.flankSide *= -1;
  const directions = [jev.flankSide, -jev.flankSide];
  const destination = directions
    .map((side) => ({
      x: clamp(jev.x + normal.x * 182 * side, 42, WORLD.width - 42),
      y: clamp(jev.y + normal.y * 182 * side, 42, WORLD.height - 42),
    }))
    .filter((point) => !blocked(point.x, point.y, jev.radius) && isLaneClear(jev, point, jev.radius))
    .sort((left, right) => distance(left, player) - distance(right, player))[0];
  if (!destination) return;
  jev.shadowDodgeTarget = destination;
  jev.shadowDodgePhase = "windup";
  jev.shadowDodgeTimer = 0.16;
  jev.shadowDodgeCooldown = 3.7;
  jev.path = [];
  remember("shadow_dodge_windup");
  showSkillCallout("jev", "shadow_dodge");
}

function completeShadowDodge() {
  const jev = game.jev;
  if (!jev.shadowDodgeTarget) return;
  const start = { x: jev.x, y: jev.y };
  const target = jev.shadowDodgeTarget;
  const dx = target.x - jev.x;
  const dy = target.y - jev.y;
  const length = Math.hypot(dx, dy) || 1;
  const steps = Math.ceil(length / 6);
  for (let index = 0; index < steps; index += 1) {
    const step = Math.min(6, length - index * 6);
    const beforeX = jev.x;
    const beforeY = jev.y;
    moveEntity(jev, dx / length * step, dy / length * step, jev.radius);
    if (Math.hypot(jev.x - beforeX, jev.y - beforeY) < step * 0.3) break;
  }
  jev.shadowDodgePhase = "";
  jev.shadowDodgeTarget = null;
  jev.facing = Math.sign(jev.x - start.x || jev.facing);
  remember("shadow_dodge_used");
  emitParticles(start.x, start.y, "#8fead3", 13, 110);
  emitParticles(jev.x, jev.y, "#c9fff0", 13, 110);
}

function tacticTarget() {
  const player = combatTarget();
  const jev = game.jev;
  const gap = distance(player, jev);
  if (game.elapsed < jev.parryRecoveryUntil && ["pursue", "intercept", "flank", "ambush"].includes(jev.mode)) {
    const ghost = game.player;
    const ghostGap = Math.max(distance(jev, ghost), 1);
    const awayX = (jev.x - ghost.x) / ghostGap;
    const awayY = (jev.y - ghost.y) / ghostGap;
    const side = jev.flankSide;
    return {
      x: clamp(ghost.x + awayX * 278 - awayY * 154 * side, 38, WORLD.width - 38),
      y: clamp(ghost.y + awayY * 278 + awayX * 154 * side, 38, WORLD.height - 38),
    };
  }
  if (jev.mode === "ambush") return strategicTarget();
  if (jev.mode === "intercept") return predictPlayer(clamp(0.58 + gap / 1500, 0.58, 0.96));
  if (jev.mode === "flank") {
    const speed = Math.hypot(player.vx, player.vy);
    const direction = speed > 35
      ? { x: player.vx / speed, y: player.vy / speed }
      : { x: (player.x - jev.x) / Math.max(gap, 1), y: (player.y - jev.y) / Math.max(gap, 1) };
    const lead = predictPlayer(0.34);
    return {
      x: clamp(lead.x - direction.y * 138 * jev.flankSide, 38, WORLD.width - 38),
      y: clamp(lead.y + direction.x * 138 * jev.flankSide, 38, WORLD.height - 38),
    };
  }
  return predictPlayer(jev.mode === "rift_rend" || jev.mode === "rift_mine" ? 0.22 : 0.34);
}

function strategicTarget() {
  const player = combatTarget();
  const jev = game.jev;
  const activeAnchors = game.anchors.filter((anchor) => anchor.health > 0);
  if (jev.plan === "guard_anchors" && activeAnchors.length) {
    const target = activeAnchors
      .map((anchor) => ({ anchor, score: distance(anchor, player) + distance(anchor, jev) * 0.32 }))
      .sort((left, right) => left.score - right.score)[0].anchor;
    const dx = player.x - target.x;
    const dy = player.y - target.y;
    const length = Math.hypot(dx, dy) || 1;
    return {
      x: clamp(target.x - dx / length * 168, 42, WORLD.width - 42),
      y: clamp(target.y - dy / length * 168, 42, WORLD.height - 42),
    };
  }
  const lead = predictPlayer(0.48);
  if (jev.plan === "cut_escape") {
    const speed = Math.hypot(player.vx, player.vy);
    const direction = speed > 40
      ? { x: player.vx / speed, y: player.vy / speed }
      : { x: (player.x - jev.x) / Math.max(distance(player, jev), 1), y: (player.y - jev.y) / Math.max(distance(player, jev), 1) };
    return {
      x: clamp(lead.x + direction.x * 112 - direction.y * jev.flankSide * 78, 38, WORLD.width - 38),
      y: clamp(lead.y + direction.y * 112 + direction.x * jev.flankSide * 78, 38, WORLD.height - 38),
    };
  }
  if (jev.plan === "flush_cover") {
    const candidates = Array.from({ length: 12 }, (_, index) => {
      const angle = index * Math.PI / 6;
      return {
        x: clamp(player.x + Math.cos(angle) * 142, 38, WORLD.width - 38),
        y: clamp(player.y + Math.sin(angle) * 142, 38, WORLD.height - 38),
      };
    }).filter((point) => !blocked(point.x, point.y, 18) && isLaneClear(jev, point, jev.radius));
    if (candidates.length) {
      return candidates.sort((left, right) =>
        distance(left, jev) + distance(left, lead) * 0.4 - (distance(right, jev) + distance(right, lead) * 0.4)
      )[0];
    }
  }
  if (jev.plan === "punish_recovery") {
    const committed = game.actionTimeline.some((entry) =>
      ["dash", "soul_burst", "shot_fired"].includes(entry.event) && game.elapsed - entry.at < 1.1
    );
    return predictPlayer(committed ? 0.12 : 0.38);
  }
  if (jev.plan === "relentless_assault") return predictPlayer(0.2);
  if (jev.plan === "hold_range") {
    const flankAngle = Math.atan2(jev.y - player.y, jev.x - player.x) + 0.35 * jev.flankSide;
    return {
      x: clamp(player.x + Math.cos(flankAngle) * 260, 38, WORLD.width - 38),
      y: clamp(player.y + Math.sin(flankAngle) * 260, 38, WORLD.height - 38),
    };
  }
  if (jev.plan === "control_chokepoint" && game.level.chokepoints?.length) {
    const target = predictPlayer(0.55);
    const destination = game.level.chokepoints
      .filter((point) => !blocked(point.x, point.y, jev.radius))
      .map((point) => ({
        ...point,
        score: distance(point, jev) * 0.58 + distance(point, player) * 0.18 + distance(point, target) * 0.24,
      }))
      .sort((left, right) => left.score - right.score)[0];
    if (destination) return destination;
  }
  return predictPlayer(jev.plan === "steady_pressure" ? 0.3 : 0.42);
}

function jevTarget() {
  const urgentModes = ["rift_mine", "rift_rush", "shadow_dodge", "summon_wraiths", "meteor_storm"];
  if (urgentModes.includes(game.jev.mode)) return tacticTarget();
  const tactical = tacticTarget();
  const strategic = strategicTarget();
  const readBias = {
    dash_dodger: 0.1,
    cover_kiter: 0.12,
    loop_runner: 0.1,
    burst_brawler: 0.08,
    close_brawler: 0.06,
    unpredictable: 0,
  }[game.jev.playerRead] || 0;
  const baseWeight = game.jev.plan === "steady_pressure" ? 0.4 : 0.62;
  const phaseBias = { approach: 0.18, set_up: 0.08, capitalize: -0.08, assess: 0 }[game.jev.planStep] || 0;
  const strategicWeight = clamp(baseWeight + readBias + phaseBias, 0.32, 0.82);
  return {
    x: clamp(strategic.x * strategicWeight + tactical.x * (1 - strategicWeight), 38, WORLD.width - 38),
    y: clamp(strategic.y * strategicWeight + tactical.y * (1 - strategicWeight), 38, WORLD.height - 38),
  };
}

function cellBlocked(gx, gy, radius = 17) {
  const cols = WORLD.width / WORLD.cell;
  const rows = WORLD.height / WORLD.cell;
  if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) return true;
  let grids = collisionGridCache.get(blocks);
  if (!grids) {
    grids = new Map();
    collisionGridCache.set(blocks, grids);
  }
  const clearance = Math.ceil(radius);
  let grid = grids.get(clearance);
  if (!grid) {
    grid = new Uint8Array(cols * rows);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const centerX = x * WORLD.cell + WORLD.cell / 2;
        const centerY = y * WORLD.cell + WORLD.cell / 2;
        const edge = centerX - clearance < 21 || centerX + clearance > WORLD.width - 21 ||
          centerY - clearance < 22 || centerY + clearance > WORLD.height - 21;
        if (edge || blocks.some((block) => obstacleContains(centerX, centerY, block, clearance))) grid[y * cols + x] = 1;
      }
    }
    grids.set(clearance, grid);
  }
  return grid[gy * cols + gx] === 1;
}

function pathEdgeClear(fromCell, toCell, radius) {
  const cols = WORLD.width / WORLD.cell;
  const totalCells = cols * (WORLD.height / WORLD.cell);
  const fromKey = fromCell.y * cols + fromCell.x;
  const toKey = toCell.y * cols + toCell.x;
  const edgeKey = Math.min(fromKey, toKey) * totalCells + Math.max(fromKey, toKey);
  let clearanceGrids = pathEdgeClearCache.get(blocks);
  if (!clearanceGrids) {
    clearanceGrids = new Map();
    pathEdgeClearCache.set(blocks, clearanceGrids);
  }
  let edges = clearanceGrids.get(radius);
  if (!edges) {
    edges = new Map();
    clearanceGrids.set(radius, edges);
  }
  if (edges.has(edgeKey)) return edges.get(edgeKey);
  const from = { x: fromCell.x * WORLD.cell + WORLD.cell / 2, y: fromCell.y * WORLD.cell + WORLD.cell / 2 };
  const to = { x: toCell.x * WORLD.cell + WORLD.cell / 2, y: toCell.y * WORLD.cell + WORLD.cell / 2 };
  const clear = isLaneClear(from, to, radius);
  edges.set(edgeKey, clear);
  return clear;
}

function findPath(start, target, avoidEntity = null) {
  const cols = WORLD.width / WORLD.cell;
  const rows = WORLD.height / WORLD.cell;
  const toCell = (value, count) => clamp(Math.floor(value / WORLD.cell), 0, count - 1);
  const keyOf = (x, y) => y * cols + x;
  const movementRadius = start.clearanceRadius ?? start.radius;
  const pointForCell = (cell) => ({
    x: cell.x * WORLD.cell + WORLD.cell / 2,
    y: cell.y * WORLD.cell + WORLD.cell / 2,
  });
  const nearestOpenCell = (centerX, centerY, reachableFrom) => {
    const isReachable = (x, y) => {
      if (cellBlocked(x, y, movementRadius)) return false;
      return isLaneClear(reachableFrom, pointForCell({ x, y }), movementRadius);
    };
    if (isReachable(centerX, centerY)) return { x: centerX, y: centerY };
    for (let radius = 1; radius < Math.max(cols, rows); radius += 1) {
      let best = null;
      let bestDistance = Infinity;
      for (let y = Math.max(0, centerY - radius); y <= Math.min(rows - 1, centerY + radius); y += 1) {
        for (let x = Math.max(0, centerX - radius); x <= Math.min(cols - 1, centerX + radius); x += 1) {
          if (Math.max(Math.abs(x - centerX), Math.abs(y - centerY)) !== radius || !isReachable(x, y)) continue;
          const dx = x - centerX;
          const dy = y - centerY;
          const candidateDistance = dx * dx + dy * dy;
          if (candidateDistance < bestDistance) {
            best = { x, y };
            bestDistance = candidateDistance;
          }
        }
      }
      if (best) return best;
    }
    return null;
  };
  const startCell = nearestOpenCell(toCell(start.x, cols), toCell(start.y, rows), start);
  const endCell = nearestOpenCell(toCell(target.x, cols), toCell(target.y, rows), target);
  if (!startCell || !endCell) return [];
  const sx = startCell.x;
  const sy = startCell.y;
  const ex = endCell.x;
  const ey = endCell.y;
  const startKey = keyOf(sx, sy);
  const endKey = keyOf(ex, ey);
  const avoidDistance = avoidEntity
    ? Math.max(start.radius + avoidEntity.radius + 58, start === game.player ? GHOST_PATH_CLEARANCE : 0)
    : 0;
  const startAvoidGap = avoidEntity ? distance(start, avoidEntity) : Infinity;
  const escapingAvoidZone = Boolean(avoidEntity && startAvoidGap < avoidDistance);
  const routeClear = (from, to) => !avoidEntity || distanceToSegment(avoidEntity, from, to) >= avoidDistance;
  const heuristic = (x, y) => {
    const dx = Math.abs(ex - x);
    const dy = Math.abs(ey - y);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const open = [];
  const comesBefore = (left, right) => left.f < right.f || (left.f === right.f && left.h < right.h);
  const push = (node) => {
    let index = open.length;
    open.push(node);
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (!comesBefore(node, open[parentIndex])) break;
      open[index] = open[parentIndex];
      index = parentIndex;
    }
    open[index] = node;
  };
  const pop = () => {
    const first = open[0];
    const last = open.pop();
    if (open.length && last) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let child = left;
        if (right < open.length && comesBefore(open[right], open[left])) child = right;
        if (child >= open.length || !comesBefore(open[child], last)) break;
        open[index] = open[child];
        index = child;
      }
      open[index] = last;
    }
    return first;
  };
  const startH = heuristic(sx, sy);
  push({ x: sx, y: sy, key: startKey, g: 0, h: startH, f: startH });
  const cost = new Map([[startKey, 0]]);
  const parent = new Map();
  const closed = new Set();
  let nearestKey = startKey;
  let nearestDistance = startH;
  let reachedTarget = false;
  const directions = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
  ];
  while (open.length) {
    const current = pop();
    if (closed.has(current.key)) continue;
    closed.add(current.key);
    if (current.h < nearestDistance || (current.h === nearestDistance && current.g < cost.get(nearestKey))) {
      nearestKey = current.key;
      nearestDistance = current.h;
    }
    if (current.key === endKey) {
      reachedTarget = true;
      break;
    }
    for (const [dx, dy, stepCost] of directions) {
      const x = current.x + dx;
      const y = current.y + dy;
      if (x < 0 || x >= cols || y < 0 || y >= rows || cellBlocked(x, y, movementRadius)) continue;
      if (dx && dy && (cellBlocked(current.x + dx, current.y, movementRadius) || cellBlocked(current.x, current.y + dy, movementRadius))) continue;
      if (!pathEdgeClear(current, { x, y }, movementRadius)) continue;
      const key = keyOf(x, y);
      const center = { x: x * WORLD.cell + WORLD.cell / 2, y: y * WORLD.cell + WORLD.cell / 2 };
      const currentCenter = pointForCell(current);
      if (!escapingAvoidZone && !routeClear(currentCenter, center)) continue;
      if (avoidEntity) {
        const nextAvoidGap = distance(center, avoidEntity);
        // Once an actor is already inside the preferred clearance radius,
        // allow a temporary step toward the threat when a wall or corner
        // makes that the only route out. The spacing cost still strongly
        // favors paths that regain distance as soon as geometry allows.
        if (!escapingAvoidZone && nextAvoidGap < avoidDistance) continue;
      }
      const spacingCost = avoidEntity
        ? Math.max(0, avoidDistance + 54 - distance(center, avoidEntity)) * 2.6
        : 0;
      const nextCost = current.g + terrainTravelCost(x, y, dx, dy, stepCost) + spacingCost;
      if (nextCost >= (cost.get(key) ?? Infinity)) continue;
      cost.set(key, nextCost);
      parent.set(key, current.key);
      const estimate = heuristic(x, y);
      push({ x, y, key, g: nextCost, h: estimate, f: nextCost + estimate });
    }
  }
  const destinationKey = reachedTarget ? endKey : nearestKey;
  if (destinationKey === startKey) {
    if (!blocked(target.x, target.y, movementRadius) && isLaneClear(start, target, movementRadius)) return [target];
    const startCenter = pointForCell(startCell);
    return distance(start, startCenter) > 12 && isLaneClear(start, startCenter, movementRadius) &&
      isLaneClear(startCenter, target, movementRadius) ? [startCenter, target] : [];
  }
  const rawPath = [];
  let cursor = destinationKey;
  while (cursor !== startKey) {
    const x = cursor % cols;
    const y = Math.floor(cursor / cols);
    rawPath.push({ x: x * WORLD.cell + WORLD.cell / 2, y: y * WORLD.cell + WORLD.cell / 2 });
    cursor = parent.get(cursor);
    if (cursor === undefined || rawPath.length > cols * rows) return [];
  }
  rawPath.reverse();
  rawPath.unshift(pointForCell(startCell));
  const path = [];
  let anchor = start;
  let nextIndex = 0;
  while (nextIndex < rawPath.length) {
    let farthest = -1;
    for (let candidateIndex = rawPath.length - 1; candidateIndex >= nextIndex; candidateIndex -= 1) {
      if (isLaneClear(anchor, rawPath[candidateIndex], movementRadius) && routeClear(anchor, rawPath[candidateIndex])) {
        farthest = candidateIndex;
        break;
      }
    }
    if (farthest < 0 && escapingAvoidZone && isLaneClear(anchor, rawPath[nextIndex], movementRadius)) {
      farthest = nextIndex;
    }
    if (farthest < 0) return [];
    anchor = rawPath[farthest];
    path.push(anchor);
    nextIndex = farthest + 1;
  }
  if (reachedTarget && !blocked(target.x, target.y, movementRadius) && isLaneClear(anchor, target, movementRadius) && routeClear(anchor, target)) {
    path.push(target);
  }
  return path;
}

function openEscapeDirections(point, radius) {
  const directions = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2],
    [-Math.SQRT1_2, Math.SQRT1_2], [-Math.SQRT1_2, -Math.SQRT1_2],
  ];
  return directions.reduce((count, [dx, dy]) => {
    const shortProbe = { x: point.x + dx * 56, y: point.y + dy * 56 };
    const longProbe = { x: point.x + dx * 112, y: point.y + dy * 112 };
    return count + (!blocked(shortProbe.x, shortProbe.y, radius) && !blocked(longProbe.x, longProbe.y, radius) ? 1 : 0);
  }, 0);
}

function deadEndPenalty(point, radius) {
  const edgeClearance = Math.min(
    point.x - (21 + radius), WORLD.width - 21 - radius - point.x,
    point.y - (22 + radius), WORLD.height - 21 - radius - point.y,
  );
  const edgeCost = Math.max(0, 220 - edgeClearance) * 1.25;
  const exits = openEscapeDirections(point, radius);
  const exitCost = Math.max(0, 4 - exits) * 105;
  return edgeCost + exitCost;
}

function findRecoveryTarget(entity, target, attempts) {
  const rings = [56, 88, 124, 164, 208, 252, 296];
  let best = null;
  let bestCost = Infinity;
  for (const radius of rings) {
    for (let index = 0; index < 16; index += 1) {
      const angleIndex = (index + attempts * 3) % 16;
      const angle = angleIndex * Math.PI / 8;
      const candidate = {
        x: clamp(entity.x + Math.cos(angle) * radius, 38, WORLD.width - 38),
        y: clamp(entity.y + Math.sin(angle) * radius, 39, WORLD.height - 38),
      };
      const movementRadius = entity.clearanceRadius ?? entity.radius;
      if (distance(entity, candidate) < 12 || blocked(candidate.x, candidate.y, movementRadius)) continue;
      // Recovery waypoints must be reachable from the entity's actual position
      // with its full collision radius. An offset origin or reduced radius can
      // approve a route that clips a wall, leaving the pathfinder with no path.
      if (!isLaneClear(entity, candidate, movementRadius)) continue;
      const enemySpacingCost = entity === game.player && game.anchors.some((anchor) => anchor.health > 0)
        ? Math.max(0, 280 - distance(candidate, game.jev)) * 5
        : 0;
      const hazardCost = game.hazards.reduce((sum, hazard) => sum + (insideHazard(candidate, hazard) ? 220 : 0), 0);
      const cost = distance(candidate, target) + distance(entity, candidate) * 0.2 +
        deadEndPenalty(candidate, movementRadius) + enemySpacingCost + hazardCost;
      if (cost < bestCost) {
        best = candidate;
        bestCost = cost;
      }
    }
  }
  return best;
}

function updateJev(dt) {
  const jev = game.jev;
  const difficulty = DIFFICULTY_SETTINGS[game.difficulty] || DIFFICULTY_SETTINGS.standard;
  const cooldownScale = (game.enraged ? 1.22 : 1) * difficulty.cooldown;
  jev.stunned = Math.max(0, jev.stunned - dt);
  jev.hurtTimer = Math.max(0, (jev.hurtTimer || 0) - dt);
  jev.rendCooldown = Math.max(0, jev.rendCooldown - dt * cooldownScale);
  jev.blastCooldown = Math.max(0, jev.blastCooldown - dt * cooldownScale);
  jev.salvoCooldown = Math.max(0, jev.salvoCooldown - dt * cooldownScale);
  jev.mineCooldown = Math.max(0, jev.mineCooldown - dt * cooldownScale);
  jev.riftRushCooldown = Math.max(0, jev.riftRushCooldown - dt * cooldownScale);
  jev.riftAegisCooldown = Math.max(0, jev.riftAegisCooldown - dt * cooldownScale);
  if (jev.riftAegisTimer > 0) {
    jev.riftAegisTimer = Math.max(0, jev.riftAegisTimer - dt);
    if (jev.riftAegisTimer === 0 && jev.riftAegisCharges > 0) {
      jev.riftAegisCharges = 0;
      remember("rift_aegis_expired");
    }
  }
  jev.shadowDodgeCooldown = Math.max(0, jev.shadowDodgeCooldown - dt * cooldownScale);
  jev.summonCooldown = Math.max(0, jev.summonCooldown - dt * cooldownScale);
  jev.meteorCooldown = Math.max(0, jev.meteorCooldown - dt * cooldownScale);
  if (jev.recoverTimer > 0) jev.recoverTimer = Math.max(0, jev.recoverTimer - dt);
  if (jev.stunned > 0) {
    if (jev.rendPhase === "windup") remember("rift_rend_interrupted");
    jev.rendPhase = "";
    jev.rendTimer = 0;
    jev.riftRushPhase = "";
    jev.riftRushTimer = 0;
    jev.riftRushTarget = null;
    if (jev.blastPhase) remember("blast_canceled");
    jev.blastPhase = "";
    jev.blastTimer = 0;
    jev.blastTarget = null;
    jev.salvoPhase = "";
    jev.salvoTimer = 0;
    jev.salvoTarget = null;
    jev.vx *= Math.pow(0.04, dt);
    jev.vy *= Math.pow(0.04, dt);
    return;
  }
  if (jev.rendPhase === "windup") {
    jev.rendTimer -= dt;
    jev.vx = 0;
    jev.vy = 0;
    if (jev.rendTimer <= 0) fireRiftRend();
    return;
  }
  if (jev.rendPhase === "recover") {
    jev.rendTimer = Math.max(0, jev.rendTimer - dt);
    if (jev.rendTimer <= 0) jev.rendPhase = "";
    jev.vx *= Math.pow(0.04, dt);
    jev.vy *= Math.pow(0.04, dt);
    return;
  }
  if (jev.riftRushPhase === "charge") {
    const requestedStep = Math.min(RIFT_RUSH_SPEED * dt, jev.riftRushRemaining);
    const beforeX = jev.x;
    const beforeY = jev.y;
    moveEntity(jev, jev.riftRushVx / RIFT_RUSH_SPEED * requestedStep, jev.riftRushVy / RIFT_RUSH_SPEED * requestedStep, jev.radius);
    const travelled = Math.hypot(jev.x - beforeX, jev.y - beforeY);
    jev.riftRushRemaining = Math.max(0, jev.riftRushRemaining - travelled);
    jev.vx = jev.riftRushVx;
    jev.vy = jev.riftRushVy;
    if (travelled < requestedStep * 0.42 || jev.riftRushRemaining <= 1) {
      jev.riftRushPhase = "";
      jev.riftRushTarget = null;
      jev.riftRushRemaining = 0;
      jev.vx = 0;
      jev.vy = 0;
      remember("rift_rush_used");
      emitParticles(jev.x, jev.y, "#ffb17f", 16, 130);
      queueJevDecision();
    }
    return;
  }
  if (jev.riftRushPhase === "windup") {
    jev.riftRushTimer -= dt;
    jev.vx = 0;
    jev.vy = 0;
    if (jev.riftRushTimer <= 0) completeRiftRush();
    return;
  }
  if (jev.shadowDodgePhase === "windup") {
    jev.shadowDodgeTimer -= dt;
    jev.vx = 0;
    jev.vy = 0;
    if (jev.shadowDodgeTimer <= 0) completeShadowDodge();
    return;
  }
  if (jev.salvoPhase === "windup") {
    jev.salvoTimer -= dt;
    jev.vx *= Math.pow(0.04, dt);
    jev.vy *= Math.pow(0.04, dt);
    const target = combatTarget();
    jev.salvoTarget = target === game.player ? predictedSoulSalvoTarget() : { x: target.x, y: target.y };
    if (jev.salvoTimer <= 0) fireSoulSalvo();
    return;
  }
  if (jev.blastPhase === "windup") {
    jev.blastTimer -= dt;
    jev.vx *= Math.pow(0.04, dt);
    jev.vy *= Math.pow(0.04, dt);
    const predictedTarget = predictedPowerBlastTarget();
    if (isPowerBlastLaneClear(jev, predictedTarget)) jev.blastTarget = predictedTarget;
    else if (!jev.blastTarget || !isPowerBlastLaneClear(jev, jev.blastTarget)) {
      jev.blastPhase = "";
      jev.blastTarget = null;
      jev.blastCooldown = Math.min(jev.blastCooldown, 1.2);
      remember("blast_cover_blocked");
      queueJevDecision();
      return;
    }
    if (jev.blastTimer <= 0) firePowerBlast();
    return;
  }
  let target = jevTarget();
  const movementRadius = jev.clearanceRadius ?? jev.radius;
  if (jev.recoveryTarget) {
    if (game.elapsed >= jev.recoveryUntil || distance(jev, jev.recoveryTarget) < 12) {
      jev.recoveryTarget = null;
      jev.recoveryUntil = 0;
    } else {
      target = jev.recoveryTarget;
    }
  }
  if (jev.recoveryTarget && isLaneClear(jev, jev.recoveryTarget, movementRadius)) {
    // Recovery points are chosen for direct, full-radius clearance. Follow
    // those points directly because the coarse path grid can seal narrow
    // boundary gaps that the collision geometry allows.
    jev.path = [jev.recoveryTarget];
    jev.nextPathAt = game.elapsed + 0.14;
  } else if (game.elapsed >= jev.nextPathAt ||
      (jev.path.length > 0 && !isLaneClear(jev, jev.path[0], movementRadius))) {
    jev.path = findPath(jev, target);
    jev.nextPathAt = game.elapsed + 0.14;
  }
  while (jev.path.length && distance(jev, jev.path[0]) < 13) {
    const nextWaypoint = jev.path[1];
    if (nextWaypoint && !isLaneClear(jev, nextWaypoint, movementRadius) && distance(jev, jev.path[0]) > 1) break;
    jev.path.shift();
  }
  const targetLaneClear = !blocked(target.x, target.y, movementRadius) && isLaneClear(jev, target, movementRadius);
  const waypoint = jev.path[0] || (targetLaneClear ? target : jev);
  let dx = waypoint.x - jev.x;
  let dy = waypoint.y - jev.y;
  const length = Math.hypot(dx, dy);
  if (length > 0.5) { dx /= length; dy /= length; }
  const speeds = {
    pursue: 300,
    intercept: 318,
    flank: 310,
    ambush: 270,
    rift_rend: 282,
    rift_mine: 296,
    rift_rush: 298,
    shadow_dodge: 340,
    summon_wraiths: 310,
    meteor_storm: 316,
  };
  const terrain = environmentEffects(jev);
  const autoPressure = game.mode === "auto" ? 1.05 : 1;
  const speed = (speeds[jev.mode] || speeds.pursue) * terrain.speed * autoPressure * difficulty.speed * (game.enraged ? 1.2 : 1);
  jev.vx = dx * speed + terrain.flowX;
  jev.vy = dy * speed + terrain.flowY;
  jev.facing = Math.sign(dx || jev.facing);
  const beforeX = jev.x;
  const beforeY = jev.y;
  const waypointGap = distance(jev, waypoint);
  let stepX = jev.vx * dt;
  let stepY = jev.vy * dt;
  if (length > 0 && length <= speed * dt && isLaneClear(jev, waypoint, movementRadius)) {
    // Land on a clear waypoint exactly so the next segment starts from the
    // same collision-safe point used by path smoothing.
    stepX = dx * length;
    stepY = dy * length;
  }
  moveEntity(jev, stepX, stepY, jev.radius);
  jev.vx = dt > 0 ? (jev.x - beforeX) / dt : 0;
  jev.vy = dt > 0 ? (jev.y - beforeY) / dt : 0;
  const waypointProgress = waypointGap - distance(jev, waypoint);
  if (distance(jev, target) > 36 && waypointProgress < Math.max(0.5, dt * 20)) jev.stuckTimer += dt;
  else jev.stuckTimer = 0;
  if (jev.stuckTimer >= 0.32) {
    const recovery = findRecoveryTarget(jev, jevTarget(), jev.recoveryAttempts);
    jev.recoveryAttempts += 1;
    jev.stuckTimer = 0;
    if (recovery) {
      jev.recoveryTarget = recovery;
      jev.recoveryUntil = game.elapsed + 1.4;
      jev.path = [];
      jev.nextPathAt = game.elapsed;
    } else {
      jev.recoveryTarget = null;
      jev.path = [];
      jev.nextPathAt = game.elapsed + 0.08;
    }
  }
}

function updatePlayer(dt) {
  const player = game.player;
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.pulseCooldown = Math.max(0, player.pulseCooldown - dt);
  player.echoCooldown = Math.max(0, player.echoCooldown - dt);
  player.hookCooldown = Math.max(0, player.hookCooldown - dt);
  player.guardCooldown = Math.max(0, player.guardCooldown - dt);
  player.guardTimer = Math.max(0, player.guardTimer - dt);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.snaredTimer = Math.max(0, player.snaredTimer - dt);
  player.dashTimer = Math.max(0, player.dashTimer - dt);
  player.pulseTimer = Math.max(0, player.pulseTimer - dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.afterimageTimer = Math.max(0, player.afterimageTimer - dt);
  if (player.afterimageTimer <= 0) player.lastKnown = { x: player.x, y: player.y };
  updateMirrorClones(dt);
  if (player.hookTarget) {
    player.hookTarget.life -= dt;
    if (player.hookTarget.life <= 0) player.hookTarget = null;
  }
  if (game.mode === "auto") updateAIPlayer(dt);
  const input = activeInput();
  if (player.dashTimer > 0) {
    player.vx = player.dashVx * 740;
    player.vy = player.dashVy * 740;
    player.invulnerable = Math.max(player.invulnerable, player.dashTimer);
  } else {
    const terrain = environmentEffects(player);
    const speed = player.speed * (player.snaredTimer > 0 ? 0.54 : 1) * terrain.speed;
    player.vx = input.x * speed + terrain.flowX;
    player.vy = input.y * speed + terrain.flowY;
  }
  if (player.dashTimer > 0) {
    const terrain = environmentEffects(player);
    player.vx += terrain.flowX;
    player.vy += terrain.flowY;
  }
  const facingInput = player.dashTimer > 0 ? player.dashVx : input.x;
  if (Math.abs(facingInput) > 0.12) player.facing = Math.sign(facingInput);
  const beforeX = player.x;
  const beforeY = player.y;
  let stepX = player.vx * dt;
  let stepY = player.vy * dt;
  const arrivalTarget = game.mode === "auto" ? player.aiArrivalTarget : null;
  player.aiArrivalTarget = null;
  const movementRadius = player.clearanceRadius ?? player.radius;
  if (arrivalTarget && player.dashTimer <= 0 && isLaneClear(player, arrivalTarget, movementRadius)) {
    // Auto movement lands on a clear route pivot precisely, avoiding a corner
    // cut when the next waypoint lies on the far side of an obstacle.
    stepX = arrivalTarget.x - player.x;
    stepY = arrivalTarget.y - player.y;
  }
  moveEntity(player, stepX, stepY, player.radius);
  player.vx = dt > 0 ? (player.x - beforeX) / dt : 0;
  player.vy = dt > 0 ? (player.y - beforeY) / dt : 0;
  if (game.mode === "auto" && player.aiTarget && distance(player, player.aiTarget) > 36 && Math.hypot(player.x - beforeX, player.y - beforeY) < Math.max(0.7, dt * 32)) {
    player.stuckTimer += dt;
  } else {
    player.stuckTimer = 0;
  }
  if (player.stuckTimer >= 0.48) {
    const recovery = findRecoveryTarget(player, player.aiTarget, player.recoveryAttempts);
    player.recoveryAttempts += 1;
    player.stuckTimer = 0;
    if (recovery) {
      player.recoveryTarget = recovery;
      player.recoveryUntil = game.elapsed + 1.1;
      player.aiPath = [];
      player.aiNextPathAt = game.elapsed;
    } else {
      player.recoveryTarget = null;
      player.aiNextPathAt = game.elapsed + 0.24;
    }
  }
  if (game.mode === "auto" ? player.fireHeld : player.fireHeld || keys.has("z")) {
    if (player.fireCooldown <= 0) firePlayerShot();
  }
}

function updateMirrorClones(dt) {
  const player = game.player;
  const active = [];
  for (const clone of player.clones) {
    clone.life -= dt;
    if (clone.life <= 0) continue;
    const previousX = clone.x;
    const previousY = clone.y;
    clone.angle += dt * (clone.direction || 1) * 1.65;
    const target = {
      x: clamp(player.x + Math.cos(clone.angle) * clone.orbit, 36, WORLD.width - 36),
      y: clamp(player.y + Math.sin(clone.angle) * clone.orbit, 36, WORLD.height - 36),
    };
    if (!blocked(target.x, target.y, clone.radius)) {
      const dx = target.x - clone.x;
      const dy = target.y - clone.y;
      const gap = Math.hypot(dx, dy);
      const travel = Math.min(gap, 420 * dt);
      if (gap > 0.1) moveEntity(clone, dx / gap * travel, dy / gap * travel, clone.radius);
    }
    clone.vx = dt > 0 ? (clone.x - previousX) / dt : 0;
    clone.vy = dt > 0 ? (clone.y - previousY) / dt : 0;
    clone.facing = player.facing;
    active.push(clone);
  }
  player.clones = active;
  player.echo = active[0] || null;
}

function aiObjectiveTarget() {
  const activeAnchors = game.anchors.filter((anchor) => anchor.health > 0);
  if (activeAnchors.length) {
    const lockedAnchor = activeAnchors.find((anchor) => anchor.id === game.player.aiObjectiveAnchorId);
    if (lockedAnchor) {
      if (!game.player.aiObjectivePosition) game.player.aiObjectivePosition = chooseAnchorApproach(lockedAnchor);
      return lockedAnchor;
    }
    const target = activeAnchors
      .map((anchor) => ({
        anchor,
        score: distance(anchor, game.player) + Math.max(0, 320 - distance(anchor, game.jev)) * 0.72,
      }))
      .sort((left, right) => left.score - right.score)[0].anchor;
    game.player.aiObjectiveAnchorId = target.id;
    game.player.aiObjectivePosition = chooseAnchorApproach(target);
    return target;
  }
  game.player.aiObjectiveAnchorId = null;
  game.player.aiObjectivePosition = null;
  return game.jev;
}

function chooseAnchorApproach(anchor) {
  const candidates = [];
  const firingOffsets = Array.from({ length: 8 }, (_, index) => {
    const angle = index * Math.PI / 4;
    return { x: Math.cos(angle) * 12, y: Math.sin(angle) * 12 };
  });
  for (const radius of [260, 320, 220, 370]) {
    for (let index = 0; index < 16; index += 1) {
      const angle = index * Math.PI / 8;
      const point = {
        x: clamp(anchor.x + Math.cos(angle) * radius, 48, WORLD.width - 48),
        y: clamp(anchor.y + Math.sin(angle) * radius, 48, WORLD.height - 48),
      };
      if (blocked(point.x, point.y, game.player.radius)) continue;
      const clearShot = isLaneClear(point, anchor, 8);
      const robustShot = clearShot && firingOffsets.every((offset) => {
        const nearby = { x: point.x + offset.x, y: point.y + offset.y };
        return !blocked(nearby.x, nearby.y, game.player.radius) && isLaneClear(nearby, anchor, 8);
      });
      const terrain = environmentEffects(point);
      const spacingCost = Math.max(0, 300 - distance(point, game.jev)) * 6;
      const hazardCost = game.hazards.reduce((sum, hazard) => sum + (insideHazard(point, hazard) ? 260 : 0), 0);
      candidates.push({
        ...point,
        clearShot,
        robustShot,
        score: distance(game.player, point) + (robustShot ? 0 : clearShot ? 140 : 260) + spacingCost + hazardCost + (1 - terrain.speed) * 260,
      });
    }
    if (candidates.some((candidate) => candidate.robustShot)) break;
  }
  const robustShots = candidates.filter((candidate) => candidate.robustShot);
  const clearShots = candidates.filter((candidate) => candidate.clearShot);
  const usable = robustShots.length ? robustShots : clearShots.length ? clearShots : candidates;
  return usable.sort((left, right) => left.score - right.score)[0] || { x: anchor.x, y: anchor.y };
}

function aiAttackPosition(target, preferredRange = 400) {
  const attackingDemon = target === game.jev;
  const currentGap = distance(game.player, target);
  if (!attackingDemon) {
    if (currentGap <= 690 && (distance(game.player, game.jev) >= GHOST_SAFE_GAP || game.jev.stunned > 0) && isLaneClear(game.player, target, 8)) {
      return { x: game.player.x, y: game.player.y };
    }
    return game.player.aiObjectivePosition || target;
  }
  // When attacking Jev, NEVER chase or charge him!
  // If Jev is inside 360 units, kite and retreat directly away!
  if (attackingDemon && currentGap < 360) {
    const escapeAngle = Math.atan2(game.player.y - target.y, game.player.x - target.x);
    for (const offset of [0, 0.4, -0.4, 0.8, -0.8]) {
      const angle = escapeAngle + offset;
      const point = {
        x: clamp(game.player.x + Math.cos(angle) * 180, 48, WORLD.width - 48),
        y: clamp(game.player.y + Math.sin(angle) * 180, 48, WORLD.height - 48),
      };
      if (!blocked(point.x, point.y, game.player.radius)) return point;
    }
    return aiEvadePoint();
  }
  // If at good kiting range (360-500) with clear shot, hold position and fire!
  if (attackingDemon && currentGap >= 360 && currentGap <= 500 && isLaneClear(game.player, target, 8)) {
    return { x: game.player.x, y: game.player.y };
  }
  const candidates = [];
  for (let radius of [420, 480, 370]) {
    for (let index = 0; index < 16; index += 1) {
      const angle = index * Math.PI / 8;
      const point = {
        x: clamp(target.x + Math.cos(angle) * radius, 48, WORLD.width - 48),
        y: clamp(target.y + Math.sin(angle) * radius, 48, WORLD.height - 48),
      };
      if (blocked(point.x, point.y, game.player.radius) || !isLaneClear(point, target, 8)) continue;
      const terrain = environmentEffects(point);
      const closePenalty = distance(point, target) < 340 ? 1000 : 0;
      candidates.push({
        ...point,
        score: distance(point, game.player) + closePenalty + (1 - terrain.speed) * 200,
      });
    }
  }
  const clearAngle = candidates.sort((left, right) => left.score - right.score)[0];
  if (clearAngle) return clearAngle;
  return aiEvadePoint();
}

function aiEvadePoint() {
  const player = game.player;
  const threats = game.projectiles.filter((projectile) => projectile.owner === "jev");
  const areaThreats = [
    ...(game.activeMine ? [{ ...game.activeMine, radius: game.activeMine.radius + player.radius + 34 }] : []),
    ...game.meteors.filter((meteor) => meteor.delay < 1.5).map((meteor) => ({ ...meteor, radius: meteor.radius + player.radius + 34 })),
    ...game.minions.filter((wraith) => distance(wraith, player) < 210).map((wraith) => ({ ...wraith, radius: wraith.radius + player.radius + 34 })),
  ];
  const candidates = [];
  const candidateKeys = new Set();
  const anchor = aiObjectiveTarget();
  const hasActiveAnchors = game.anchors.some((item) => item.health > 0);
  for (const travel of [300, 460]) {
    for (let index = 0; index < 16; index += 1) {
      const angle = index * Math.PI / 8;
      const point = {
        x: clamp(player.x + Math.cos(angle) * travel, 42, WORLD.width - 42),
        y: clamp(player.y + Math.sin(angle) * travel, 42, WORLD.height - 42),
      };
      const key = Math.round(point.x / 24) + ":" + Math.round(point.y / 24);
      if (candidateKeys.has(key) || blocked(point.x, point.y, player.radius)) continue;
      candidateKeys.add(key);
      const hazardCost = game.hazards.reduce((sum, hazard) => sum + (insideHazard(point, hazard) ? 260 : 0), 0);
      const nearestProjectile = threats.reduce((min, projectile) => Math.min(min, distance(point, projectile)), Infinity);
      const nearestAreaThreat = areaThreats.reduce((min, hazard) => Math.min(min, Math.max(0, distance(point, hazard) - hazard.radius)), Infinity);
      const objectiveCost = hasActiveAnchors ? distance(point, anchor) * 0.08 : 0;
      const areaThreatCost = Number.isFinite(nearestAreaThreat) ? -Math.min(420, nearestAreaThreat) * 0.72 : 0;
      const routeCost = isLaneClear(player, point, player.radius) ? 0 : 165;
      const score = distance(point, game.jev) * -0.28 - Math.min(420, nearestProjectile) * 0.72 +
        areaThreatCost + hazardCost + objectiveCost + routeCost + deadEndPenalty(point, player.radius);
      candidates.push({ ...point, score });
    }
  }
  const safeCandidates = candidates.filter((point) => distance(point, game.jev) >= GHOST_SAFE_GAP + 120);
  return (safeCandidates.length ? safeCandidates : candidates).sort((left, right) => left.score - right.score)[0] || player;
}

function stableEvasionTarget() {
  const player = game.player;
  const current = player.evadeTarget;
  const stale = !current || game.elapsed >= player.evadeTargetUntil ||
    distance(player, current) < 84 || blocked(current.x, current.y, player.radius) ||
    distance(game.jev, current) < GHOST_SAFE_GAP + 80 ||
    game.hazards.some((hazard) => insideHazard(current, hazard));
  if (stale) {
    player.evadeTarget = aiEvadePoint();
    player.evadeTargetUntil = game.elapsed + 0.62;
  }
  return player.evadeTarget;
}

function secondsToGhostSafeGap(position, velocity, jev) {
  const dx = position.x - jev.x;
  const dy = position.y - jev.y;
  const gap = Math.hypot(dx, dy);
  if (gap <= GHOST_SAFE_GAP) return 0;
  const relativeVx = velocity.vx - jev.vx;
  const relativeVy = velocity.vy - jev.vy;
  const closingSpeed = Math.max(0, -(dx * relativeVx + dy * relativeVy) / gap);
  return closingSpeed > 20 ? (gap - GHOST_SAFE_GAP) / closingSpeed : null;
}

function recordGhostActionOverride(tactic) {
  const player = game.player;
  if (player.aiTactic === tactic) return;
  const selected = player.aiTactic;
  player.aiTactic = tactic;
  player.aiHistory.push({ tactic, at: game.elapsed });
  if (player.aiHistory.length > 6) player.aiHistory.shift();
  renderDecisionCard("ghost", tactic, lastDecision.ghost?.probabilities, selected);
}

function updateAIPlayer(dt) {
  const player = game.player;
  const movementRadius = player.clearanceRadius ?? player.radius;
  player.aiArrivalTarget = null;
  const tactic = player.aiTactic;
  const activeAnchors = game.anchors.filter((anchor) => anchor.health > 0);
  const objective = aiObjectiveTarget();
  player.aim = objective === game.jev ? predictedShotTarget() : { x: objective.x, y: objective.y };
  let objectiveGap = distance(player, objective);
  let jevGap = distance(player, game.jev);
  let contactSeconds = secondsToGhostSafeGap(player, player, game.jev);
  let contactRisk = jevGap < GHOST_SAFE_GAP || (contactSeconds !== null && contactSeconds < 0.7 && jevGap < GHOST_SAFE_GAP + 220);
  let threatened = isJevAttackThreateningPlayer();
  let rendThreat = isJevRiftRendThreateningPlayer();
  const areaThreat = (
    game.activeMine && game.activeMine.warning <= 0.34 &&
    distance(game.activeMine, player) < game.activeMine.radius + player.radius + 40
  ) || game.meteors.some((meteor) =>
    meteor.delay <= 0.28 && distance(meteor, player) < meteor.radius + player.radius + 34
  ) || game.minions.some((wraith) =>
    distance(wraith, player) < wraith.radius + player.radius + 45
  );

  const projectileThreat = game.projectiles.some((projectile) => projectile.owner === "jev" &&
    distanceToSegment(player, projectile, {
      x: projectile.x + projectile.vx * 0.5,
      y: projectile.y + projectile.vy * 0.5,
    }) < player.radius + projectile.radius + 30);
  const echoThreat = projectileThreat ||
    (game.jev.blastPhase === "windup" && jevGap < 610) ||
    (game.jev.salvoPhase === "windup" && jevGap < 610) ||
    game.minions.some((wraith) => distance(wraith, player) < 190);
  const directBurstCounter = jevGap < 138 && (
    rendThreat || (threatened && player.guardCooldown > 0) || game.jev.stunned > 0
  );
  if (player.pulseCooldown <= 0 && (
    (distance(player, objective) < 145 && (tactic === "soul_burst" || game.jev.stunned > 0)) || directBurstCounter
  )) useSoulBurst();

  objectiveGap = distance(player, objective);
  jevGap = distance(player, game.jev);
  contactSeconds = secondsToGhostSafeGap(player, player, game.jev);
  rendThreat = isJevRiftRendThreateningPlayer();
  contactRisk = game.jev.stunned <= 0 && (
    jevGap < GHOST_SAFE_GAP || (contactSeconds !== null && contactSeconds < 0.7 && jevGap < GHOST_SAFE_GAP + 200)
  );
  threatened = isJevAttackThreateningPlayer();

  const guardableRend = rendThreat && player.dashCooldown > 0 && player.dashTimer <= 0 &&
    player.hookCooldown > 0 && player.invulnerable <= 0.08;
  const guardNow = player.guardCooldown <= 0 && player.guardTimer <= 0 && game.elapsed >= player.guardAdaptUntil &&
    ((threatened && jevGap < 250 && !rendThreat) || guardableRend);
  const immediateDanger = threatened || rendThreat || areaThreat || (game.jev.stunned <= 0 && (
    jevGap < 205 || (contactSeconds !== null && contactSeconds < 0.34 && jevGap < GHOST_SAFE_GAP + 180)
  ));
  let usedDefense = false;
  if (guardNow) {
    useLanternGuard();
    recordGhostActionOverride("lantern_guard");
    usedDefense = true;
  } else if (echoThreat && jevGap < 620 && player.echoCooldown <= 0 && !player.echo) {
    useMirrorEcho();
    recordGhostActionOverride("mirror_echo");
    usedDefense = true;
  }

  const mustEvade = threatened || rendThreat || areaThreat || contactRisk;
  const escape = mustEvade ? stableEvasionTarget() : null;
  if (!usedDefense && immediateDanger && player.dashCooldown <= 0 && player.dashTimer <= 0) {
    const dx = escape.x - player.x;
    const dy = escape.y - player.y;
    const length = Math.hypot(dx, dy) || 1;
    player.aiInput = { x: dx / length, y: dy / length };
    usePhaseDash();
    recordGhostActionOverride("evade_warning");
    usedDefense = true;
  } else if (!usedDefense && immediateDanger && player.dashCooldown > 0 && player.dashTimer <= 0 &&
      player.hookCooldown <= 0 && jevGap < 265) {
    if (useRiftHook(escape)) {
      recordGhostActionOverride("rift_hook");
      usedDefense = true;
    }
  } else if (contactRisk && !["lantern_guard", "mirror_echo", "phase_dash"].includes(player.aiTactic)) {
    recordGhostActionOverride("evade_warning");
  }

  const anchorApproach = player.aiObjectivePosition || objective;
  const approachGap = distance(player, anchorApproach);
  const wantsHook = tactic === "rift_hook" || (tactic === "advance_anchor" && approachGap > 900);
  if (activeAnchors.length && wantsHook && player.hookCooldown <= 0 && !mustEvade &&
      jevGap > GHOST_SAFE_GAP + 145 && approachGap > 620) {
    if (useRiftHook(anchorApproach) && tactic !== "rift_hook") recordGhostActionOverride("rift_hook");
  }

  objectiveGap = distance(player, objective);
  jevGap = distance(player, game.jev);
  const hasAnchorObjective = objective !== game.jev;
  const objectiveInRange = objectiveGap <= (hasAnchorObjective ? 690 : 740);
  const clearLane = isLaneClear(player, player.aim, 8);
  // Firing is independent of movement, so Jev's proximity should not suppress anchor pressure.
  player.fireHeld = objectiveInRange && clearLane;

  if (player.recoveryTarget && (
    game.elapsed >= player.recoveryUntil || distance(player, player.recoveryTarget) < 26
  )) {
    player.recoveryTarget = null;
    player.recoveryUntil = 0;
  }

  let destination;
  const evading = threatened || rendThreat || areaThreat || contactRisk || (tactic === "evade_warning" && threatened);
  if (player.recoveryTarget) destination = player.recoveryTarget;
  else if (evading) destination = escape || stableEvasionTarget();
  else destination = aiAttackPosition(objective, activeAnchors.length > 0 ? 260 : 420);
  if (!evading) {
    player.evadeTarget = null;
    player.evadeTargetUntil = 0;
  }
  player.aiTarget = destination;

  const pathRefresh = evading ? 0.08 : 0.24;
  const blockedCurrentLeg = player.aiPath.length > 0 && !isLaneClear(player, player.aiPath[0], movementRadius);
  if (game.elapsed >= player.aiNextPathAt || blockedCurrentLeg) {
    player.aiPath = findPath(player, destination, game.jev);
    player.aiNextPathAt = game.elapsed + pathRefresh;
  }
  while (player.aiPath.length && distance(player, player.aiPath[0]) < 18) {
    const nextWaypoint = player.aiPath[1];
    const gap = distance(player, player.aiPath[0]);
    if (nextWaypoint && !isLaneClear(player, nextWaypoint, movementRadius) && gap > 1) break;
    player.aiPath.shift();
  }
  const targetLaneClear = !blocked(destination.x, destination.y, movementRadius) && isLaneClear(player, destination, movementRadius);
  const distanceToJev = distance(player, game.jev);
  const directLaneGap = distanceToSegment(game.jev, player, destination);
  const objectiveLaneSafe = distanceToJev < GHOST_PATH_CLEARANCE
    ? distance(destination, game.jev) > distanceToJev && directLaneGap >= distanceToJev
    : directLaneGap >= GHOST_PATH_CLEARANCE;
  const safeEscapeLane = evading && escape && distance(escape, game.jev) > distanceToJev + 8 &&
    !blocked(escape.x, escape.y, movementRadius) && isLaneClear(player, escape, movementRadius);
  const fallbackWaypoint = safeEscapeLane ? escape : targetLaneClear && objectiveLaneSafe ? destination : player;
  const waypoint = player.aiPath[0] || fallbackWaypoint;
  const dx = waypoint.x - player.x;
  const dy = waypoint.y - player.y;
  const length = Math.hypot(dx, dy);
  player.aiInput = length > 1 ? { x: dx / length, y: dy / length } : { x: 0, y: 0 };
  const terrain = environmentEffects(player);
  const movementSpeed = player.speed * (player.snaredTimer > 0 ? 0.54 : 1) * terrain.speed;
  if (player.dashTimer <= 0 && length > 0 && length <= movementSpeed * dt &&
      isLaneClear(player, waypoint, movementRadius)) {
    player.aiArrivalTarget = waypoint;
  }
  if (Math.abs(player.aiInput.x) > 0.15) player.facing = Math.sign(player.aiInput.x);
}

function checkContact() {
  const player = game.player;
  const jev = game.jev;
  const gap = distance(player, jev);
  if (["windup", "recover"].includes(jev.rendPhase) || gap > player.radius + jev.radius + 2 ||
      player.invulnerable > 0 || player.hurtTimer > 0 || jev.stunned > 0) return;
  const angle = Math.atan2(player.y - jev.y, player.x - jev.x);
  const target = { x: player.x, y: player.y };
  const parried = player.guardTimer > 0;
  const hit = damagePlayer("player_hit", Math.cos(angle), Math.sin(angle));
  jev.contactStrike = {
    at: game.elapsed,
    x: jev.x,
    y: jev.y,
    angle,
    targetX: target.x,
    targetY: target.y,
    outcome: parried ? "parried" : hit ? "hit" : "blocked",
  };
}

function damagePlayer(event, knockbackX, knockbackY, amount = 1, quiet = false, canParry = true) {
  const player = game.player;
  if (canParry && player.guardTimer > 0 && event !== "lava_hit") {
    player.guardTimer = 0;
    player.guardCooldown = 2.6;
    player.guardAdaptUntil = game.elapsed + 4.1;
    game.jev.stunned = Math.max(game.jev.stunned, 0.85);
    game.jev.parryRecoveryUntil = game.elapsed + 3.8;
    game.jev.flankSide *= -1;
    game.jev.mode = "flank";
    game.jev.path = [];
    game.jev.nextPathAt = game.elapsed;
    game.jev.riftRushPhase = "";
    game.jev.riftRushTimer = 0;
    game.jev.riftRushTarget = null;
    game.jev.vx = 0;
    game.jev.vy = 0;
    remember("lantern_parry");
    const parrySkin = skinForRole("runner");
    emitParticles(player.x, player.y, parrySkin.accent, 30, 200, parrySkin);
    announce("PERFECT PARRY!", 900);
    screenShake = Math.max(screenShake, 7);
    queueJevDecision();
    return false;
  }
  if (player.invulnerable > 0 || player.hurtTimer > 0) return false;
  player.health = Math.max(0, Number((player.health - amount).toFixed(2)));
  player.hurtTimer = 1.2;
  player.invulnerable = 0.8;
  moveEntity(player, knockbackX * 45, knockbackY * 45, player.radius);
  remember(event);
  renderHealth();
  if (!quiet) announce(event === "mine_hit"
    ? player.health > 0 ? "Rift mine detonated" : "Jev caught you"
    : event === "salvo_hit"
      ? player.health > 0 ? "Soul salvo hit" : "Jev caught you"
      : event === "blast_hit"
        ? player.health > 0 ? "Blast hit" : "Jev caught you"
        : event === "rift_rend_hit"
          ? player.health > 0 ? "Rift Rend struck" : "Rift Rend caught you"
      : player.health > 0 ? "Jev caught you" : "Jev caught you");
  const brandedAttack = ["blast_hit", "salvo_hit"].includes(event);
  const impactSkin = brandedAttack ? skinForRole("chaser") : null;
  emitParticles(player.x, player.y, impactSkin?.accent || "#ff806d", 20, 170, impactSkin);
  screenShake = Math.max(screenShake, 8);
  if (player.health <= 0) finishGame("caught");
  return true;
}

function updateProjectiles(dt) {
  const remaining = [];
  for (const projectile of game.projectiles) {
    projectile.life -= dt;
    projectile.age += dt;
    let consumed = projectile.life <= 0;
    const distanceThisFrame = Math.hypot(projectile.vx, projectile.vy) * dt;
    const steps = Math.max(1, Math.ceil(distanceThisFrame / 8));
    for (let step = 0; step < steps && !consumed; step += 1) {
      const stepDistance = distanceThisFrame / steps;
      if (projectile.maxDistance !== undefined &&
          (projectile.distanceTravelled || 0) + stepDistance > projectile.maxDistance) {
        remember(projectile.kind === "salvo" ? "salvo_missed" : "blast_missed");
        consumed = true;
        break;
      }
      if (projectile.maxDistance !== undefined) projectile.distanceTravelled = (projectile.distanceTravelled || 0) + stepDistance;
      projectile.x += projectile.vx * dt / steps;
      projectile.y += projectile.vy * dt / steps;
      const anchor = projectile.owner === "player"
        ? game.anchors.find((item) => item.health > 0 && distance(projectile, item) <= projectile.radius + 31)
        : null;
      const mirrorClone = projectile.owner === "jev"
        ? game.player.clones.find((clone) => distance(projectile, clone) <= projectile.radius + clone.radius)
        : null;
      if (anchor) {
        hitAnchor(anchor, skinCatalog[projectile.skinId] || skinForRole("runner"));
        consumed = true;
      } else if (mirrorClone) {
        if (projectile.owner === "jev" && ["blast", "salvo"].includes(projectile.kind)) {
          remember(projectile.kind === "salvo" ? "salvo_decoy_blocked" : "blast_decoy_blocked");
        }
        breakMirrorClone(mirrorClone);
        consumed = true;
      } else {
        const target = projectile.owner === "player" ? game.jev : game.player;
        if (distance(projectile, target) <= projectile.radius + target.radius) {
        if (projectile.owner === "player") {
          hitJev(projectile);
        } else {
          const parrying = game.player.guardTimer > 0;
          if (parrying) {
            const reflectLength = distance(game.player, game.jev) || 1;
            game.projectiles.push({
              owner: "player", kind: "reflected", skinId: skinForRole("runner").id, x: game.player.x, y: game.player.y,
              vx: (game.jev.x - game.player.x) / reflectLength * PLAYER_SHOT_SPEED,
              vy: (game.jev.y - game.player.y) / reflectLength * PLAYER_SHOT_SPEED,
              radius: 9, life: 0.8, age: 0,
            });
          }
          const projectileOutcome = projectile.kind === "salvo" ? "salvo_hit" : "blast_hit";
          const attackPrefix = projectile.kind === "salvo" ? "salvo" : "blast";
          const knockback = Math.hypot(projectile.vx, projectile.vy) || 1;
          if (parrying) remember(attackPrefix + "_guard_blocked");
          if (!damagePlayer(projectileOutcome, projectile.vx / knockback, projectile.vy / knockback) && !parrying) {
            remember(projectile.kind === "salvo" ? "salvo_dodged" : "blast_dodged");
            const skin = skinCatalog[projectile.skinId] || skinForRole("chaser");
            emitParticles(projectile.x, projectile.y, skin.accent, 12, 105, skin);
          }
        }
        consumed = true;
        } else if (blocked(projectile.x, projectile.y, projectile.radius)) {
          const attackPrefix = projectile.kind === "salvo" ? "salvo" : "blast";
          remember(projectile.owner === "player" ? "shot_blocked" : attackPrefix + "_cover_blocked");
          const skin = skinCatalog[projectile.skinId] || skinForRole(projectile.owner === "player" ? "runner" : "chaser");
          emitParticles(projectile.x, projectile.y, skin.accent, 10, 80, skin);
          consumed = true;
        }
      }
    }
    if (projectile.life <= 0 && projectile.owner === "jev") {
      remember(projectile.kind === "salvo" ? "salvo_missed" : "blast_missed");
    }
    if (!consumed) remaining.push(projectile);
  }
  game.projectiles = remaining;
}

function breakMirrorClone(clone) {
  if (!clone || !game.player.clones.includes(clone)) return;
  emitParticles(clone.x, clone.y, "#bdffec", 13, 110);
  game.player.clones = game.player.clones.filter((item) => item !== clone);
  game.player.echo = game.player.clones[0] || null;
  remember("mirror_echo_broken");
}

function checkWin() {
  if (game.jev.health <= 0 && game.anchors.every((anchor) => anchor.health <= 0)) finishGame("fight");
}

function advanceSpriteTravel(entity, dt) {
  const speed = Math.hypot(Number(entity.vx) || 0, Number(entity.vy) || 0);
  if (speed > 35) {
    entity.spriteTravel = (entity.spriteTravel || 0) + Math.min(speed, 330) * dt;
    entity.spriteAnimationTime = (entity.spriteAnimationTime || 0) + dt;
  } else {
    entity.spriteAnimationTime = 0;
  }
}

function update(dt) {
  game.elapsed += dt;
  game.remaining = Math.max(0, game.remaining - dt);
  if (game.remaining <= 0 && !game.enraged) {
    game.enraged = true;
    announce("The rift surges. Jev grows faster.", 2100);
  }
  updatePlayer(dt);
  updateMeteors(dt);
  updateWraiths(dt);
  if (game.elapsed >= game.nextTrailSampleAt) {
    game.playerTrail.push({ x: Math.round(game.player.x), y: Math.round(game.player.y), at: game.elapsed });
    if (game.playerTrail.length > 24) game.playerTrail.shift();
    game.routeProfile = measurePlayerRoute();
    game.nextTrailSampleAt = game.elapsed + 0.42;
  }
  updateRiftMine(dt);
  updateJev(dt);
  advanceSpriteTravel(game.player, dt);
  advanceSpriteTravel(game.jev, dt);
  for (const clone of game.player.clones) advanceSpriteTravel(clone, dt);
  updateEnvironmentHazards();
  updateProjectiles(dt);
  checkContact();
  checkWin();
  const threat = clamp(1 - (distance(game.player, game.jev) - 92) / 500, 0, 1);
  const danger = 1 - game.player.health / 4;
  const intensity = Math.max(threat * 0.76, danger * 0.92);
  music.intensity += (intensity - music.intensity) * Math.min(1, dt * 1.45);
  renderHud(false);
  updateParticles(dt);
  for (const anchor of game.anchors) anchor.hitFlash = Math.max(0, anchor.hitFlash - dt);
  screenShake = Math.max(0, screenShake - dt * 22);
}

function frame(now) {
  if (!game?.running) return;
  if (game.paused) {
    lastFrame = now;
    drawWorld();
    positionDecisionPanels();
    animationFrame = requestAnimationFrame(frame);
    return;
  }
  const dt = Math.min((now - lastFrame) / 1000, 0.04);
  lastFrame = now;
  update(dt);
  drawWorld();
  positionDecisionPanels();
  if (!game.paused && !jevRequestInFlight && now >= nextJevDecisionAt) void requestJevDecision();
  animationFrame = requestAnimationFrame(frame);
}

function emitParticles(x, y, color, count, speed, skin = null) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.25 + Math.random() * 0.75);
    particles.push({
      x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity,
      life: 0.35 + Math.random() * 0.45, maxLife: 0.8, size: 1.5 + Math.random() * 3, color,
      company: skin?.company || null,
    });
  }
}

function updateParticles(dt) {
  for (const particle of particles) {
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= Math.pow(0.18, dt);
    particle.vy *= Math.pow(0.18, dt);
  }
  particles = particles.filter((particle) => particle.life > 0);
}

function drawWorld() {
  const ctx = ui.context;
  ctx.save();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const rect = ui.canvas.getBoundingClientRect();
  const portraitArena = rect.width < 720;
  const idealWidth = portraitArena ? 700 : 1500;
  const idealHeight = portraitArena ? 1515 : 940;
  const zoom = Math.max(
    Math.min(rect.width / idealWidth, rect.height / idealHeight),
    rect.width / WORLD.width,
    rect.height / WORLD.height,
  );
  const viewWidth = rect.width / zoom;
  const viewHeight = rect.height / zoom;
  const targetCameraX = clamp(game.player.x - viewWidth / 2, 0, WORLD.width - viewWidth);
  const targetCameraY = clamp(game.player.y - viewHeight / 2, 0, WORLD.height - viewHeight);
  const now = performance.now();
  if (!cameraState.ready) {
    cameraState.x = targetCameraX;
    cameraState.y = targetCameraY;
    cameraState.updatedAt = now;
    cameraState.ready = true;
  } else {
    const cameraDt = clamp((now - cameraState.updatedAt) / 1000, 0, 0.05);
    const isTeleporting = game.player.hookTarget?.life > 0;
    const response = isTeleporting ? 7.5 : 15;
    const follow = 1 - Math.exp(-response * cameraDt);
    cameraState.x = clamp(
      cameraState.x + (targetCameraX - cameraState.x) * follow,
      0,
      WORLD.width - viewWidth,
    );
    cameraState.y = clamp(
      cameraState.y + (targetCameraY - cameraState.y) * follow,
      0,
      WORLD.height - viewHeight,
    );
    cameraState.updatedAt = now;
  }
  const cameraX = cameraState.x;
  const cameraY = cameraState.y;
  const shakeX = screenShake > 0 ? (Math.random() - 0.5) * screenShake : 0;
  const shakeY = screenShake > 0 ? (Math.random() - 0.5) * screenShake : 0;
  ctx.setTransform(
    ratio * zoom, 0, 0, ratio * zoom,
    (-cameraX + shakeX) * ratio * zoom,
    (-cameraY + shakeY) * ratio * zoom,
  );
  drawFloor(ctx);
  drawHazards(ctx);
  drawWorldLighting(ctx);
  drawAnchors(ctx);
  drawDepthSortedArena(ctx);
  drawParticles(ctx);
  drawWraithlings(ctx);
  drawMirrorEcho(ctx);
  drawProjectiles(ctx);
  drawTacticalEffects(ctx);
  drawSkillCallouts(ctx);
  ctx.restore();
  if (game.elapsed - lastMapDrawAt > 0.12) {
    drawMapOverview();
    lastMapDrawAt = game.elapsed;
  }
}

function drawAnchors(ctx) {
  const chaserSkin = skinForRole("chaser");
  const accentTint = colorWithAlpha(chaserSkin.accent, 0.29);
  for (const anchor of game.anchors) {
    const broken = anchor.health <= 0;
    const ghostTarget = game.mode === "auto" && !broken && anchor.id === game.player.aiObjectiveAnchorId;
    const pulse = 0.5 + Math.sin(game.elapsed * 4.8 + anchor.id) * 0.13;
    const color = broken ? "#71827e" : anchor.hitFlash > 0 ? "#ffffff" : chaserSkin.accent;
    ctx.save();
    ctx.globalAlpha = broken ? 0.28 : 0.9;
    const glow = ctx.createRadialGradient(anchor.x, anchor.y, 5, anchor.x, anchor.y, 66);
    glow.addColorStop(0, broken ? "rgb(121 153 143 / 20%)" : accentTint);
    glow.addColorStop(1, "rgb(99 233 203 / 0%)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, 66, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = anchor.hitFlash > 0 ? 4 : 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = broken ? 0 : 16;
    ctx.setLineDash(broken ? [6, 7] : []);
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, broken ? 30 : 29 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    drawAnimatedAnchorEmblem(ctx, anchor, chaserSkin, broken);
    if (!broken) {
      for (let pip = 0; pip < anchor.maxHealth; pip += 1) {
        ctx.fillStyle = pip < anchor.health ? "#fff3d8" : "rgb(216 255 239 / 22%)";
        ctx.beginPath();
        ctx.arc(anchor.x + (pip - 0.5) * 11, anchor.y + 38, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (ghostTarget) {
      ctx.globalAlpha = 0.82;
      ctx.strokeStyle = "#f1c987";
      ctx.lineWidth = 2.4;
      ctx.setLineDash([3, 6]);
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, 47 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
  if (game.anchors.some((anchor) => anchor.health > 0) && game.jev.health > 0) {
    ctx.save();
    ctx.globalAlpha = 0.1 + Math.sin(game.elapsed * 3) * 0.025;
    ctx.strokeStyle = "#b99aff";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 13]);
    for (const anchor of game.anchors.filter((item) => item.health > 0)) {
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(game.jev.x, game.jev.y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function colorWithAlpha(hexColor, alpha) {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hexColor);
  if (!match) return `rgba(159, 242, 215, ${alpha})`;
  const [, red, green, blue] = match;
  return `rgba(${Number.parseInt(red, 16)}, ${Number.parseInt(green, 16)}, ${Number.parseInt(blue, 16)}, ${alpha})`;
}

function buildAnchorBrandSpriteSheets() {
  const framesPerRow = 4;
  const frameCount = 8;
  const cellSize = 72;
  const brands = [
    { company: "OpenAI", mark: "openai", accent: "#79e4cf", core: "#d7fff2", dark: "#173b36" },
    { company: "Anthropic", mark: "anthropicMark", accent: "#f29a68", core: "#fff0d8", dark: "#55352c" },
  ];
  for (const brand of brands) {
    const mark = artwork.brandMarks[brand.mark];
    if (!mark?.complete || !mark.naturalWidth || artwork.anchorBrandSheets[brand.company]?.spriteVersion === 1) continue;
    const sheet = document.createElement("canvas");
    sheet.width = cellSize * framesPerRow;
    sheet.height = cellSize * (frameCount / framesPerRow);
    sheet.spriteVersion = 1;
    const sheetContext = sheet.getContext("2d");
    if (!sheetContext) continue;
    for (let frame = 0; frame < frameCount; frame += 1) {
      const column = frame % framesPerRow;
      const row = Math.floor(frame / framesPerRow);
      const centerX = column * cellSize + cellSize / 2;
      const centerY = row * cellSize + cellSize / 2;
      const phase = frame / frameCount * Math.PI * 2;
      const pulse = 0.94 + Math.sin(phase) * 0.06;
      sheetContext.save();
      sheetContext.translate(centerX, centerY);

      const halo = sheetContext.createRadialGradient(0, 0, 7, 0, 0, 31 * pulse);
      halo.addColorStop(0, colorWithAlpha(brand.accent, 0.3));
      halo.addColorStop(1, colorWithAlpha(brand.accent, 0));
      sheetContext.fillStyle = halo;
      sheetContext.beginPath();
      sheetContext.arc(0, 0, 31 * pulse, 0, Math.PI * 2);
      sheetContext.fill();

      sheetContext.strokeStyle = colorWithAlpha(brand.accent, 0.75);
      sheetContext.lineWidth = 1.5;
      sheetContext.beginPath();
      sheetContext.arc(0, 0, 27, phase, phase + Math.PI * 1.48);
      sheetContext.stroke();

      sheetContext.fillStyle = brand.dark;
      sheetContext.shadowColor = brand.accent;
      sheetContext.shadowBlur = 8 + Math.sin(phase) * 3;
      sheetContext.beginPath();
      sheetContext.arc(0, 0, 19 * pulse, 0, Math.PI * 2);
      sheetContext.fill();
      sheetContext.shadowBlur = 0;
      sheetContext.strokeStyle = colorWithAlpha(brand.accent, 0.9);
      sheetContext.lineWidth = 2;
      sheetContext.beginPath();
      sheetContext.arc(0, 0, 19 * pulse, 0, Math.PI * 2);
      sheetContext.stroke();

      sheetContext.fillStyle = brand.core;
      sheetContext.beginPath();
      sheetContext.arc(0, 0, 14, 0, Math.PI * 2);
      sheetContext.fill();
      const markScale = Math.min(26 / mark.naturalWidth, 24 / mark.naturalHeight);
      const markWidth = mark.naturalWidth * markScale;
      const markHeight = mark.naturalHeight * markScale;
      sheetContext.drawImage(mark, -markWidth / 2, -markHeight / 2, markWidth, markHeight);

      for (let mote = 0; mote < 3; mote += 1) {
        const angle = phase + mote * Math.PI * 2 / 3;
        const distance = 27;
        const moteX = Math.cos(angle) * distance;
        const moteY = Math.sin(angle) * distance;
        sheetContext.fillStyle = brand.core;
        if (brand.company === "OpenAI") {
          sheetContext.fillRect(moteX - 2, moteY - 2, 4, 4);
        } else {
          sheetContext.beginPath();
          sheetContext.moveTo(moteX, moteY - 3);
          sheetContext.lineTo(moteX + 2, moteY);
          sheetContext.lineTo(moteX, moteY + 3);
          sheetContext.lineTo(moteX - 2, moteY);
          sheetContext.closePath();
          sheetContext.fill();
        }
      }
      sheetContext.restore();
    }
    artwork.anchorBrandSheets[brand.company] = sheet;
  }
}

function drawAnimatedAnchorEmblem(ctx, anchor, chaserSkin, broken) {
  const company = chaserSkin.company;
  const sheet = artwork.anchorBrandSheets[company];
  if (!sheet) {
    drawCompanyMark(ctx, chaserSkin, anchor.x, anchor.y, 20);
    return;
  }
  const frame = Math.floor(game.elapsed * 8 + anchor.id * 1.7) % 8;
  const cellSize = 72;
  ctx.save();
  ctx.globalAlpha = broken ? 0.24 : 0.94;
  ctx.drawImage(
    sheet,
    (frame % 4) * cellSize,
    Math.floor(frame / 4) * cellSize,
    cellSize,
    cellSize,
    anchor.x - 33,
    anchor.y - 33,
    66,
    66,
  );
  ctx.restore();
}

function drawMirrorEcho(ctx) {
  const runnerSkin = skinForRole("runner");
  const companion = artwork.companions[runnerSkin.companion];
  const runnerSprite = spriteForRole("runner");
  for (const clone of game.player.clones) {
    const alpha = clamp(clone.life / clone.maxLife, 0.22, 0.75);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = runnerSkin.accent;
    ctx.shadowBlur = 24;
    ctx.strokeStyle = runnerSkin.accent;
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(clone.x, clone.y + 8, 37, 45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    const sprite = companion?.complete && companion.naturalWidth > 0 ? companion : runnerSprite;
    if (sprite?.complete && sprite.naturalWidth > 0) {
      const spriteId = companion?.complete ? runnerSkin.companion : runnerSkin.id;
      const direction = spriteDirectionFor(clone);
      const row = Math.hypot(clone.vx || 0, clone.vy || 0) > 35
        ? 1 + Math.floor((clone.spriteAnimationTime || 0) / 0.085) % 2
        : 0;
      drawSpriteFrame(ctx, sprite, spriteId, direction, row, clone.x, clone.y, 88, 96);
    }
    ctx.restore();
  }
}

function drawWraithlings(ctx) {
  const skin = skinForRole("chaser");
  const anthropic = skin.company === "Anthropic";
  for (const wraith of game.minions) {
    const pulse = 0.72 + Math.sin(game.elapsed * 11 + wraith.phase) * 0.13;
    const rotation = game.elapsed * (anthropic ? -1.35 : 1.1) + wraith.phase;
    ctx.save();
    ctx.translate(wraith.x, wraith.y);
    ctx.globalAlpha = pulse;
    ctx.shadowColor = skin.accent;
    ctx.shadowBlur = 17;
    ctx.fillStyle = anthropic ? "#713c3a" : "#214d4a";
    ctx.strokeStyle = skin.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, wraith.radius * 0.84, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (anthropic) {
      ctx.strokeStyle = "rgb(255 210 158 / 78%)";
      ctx.lineWidth = 1.5;
      for (let ray = 0; ray < 8; ray += 1) {
        const angle = rotation + ray * Math.PI / 4;
        const inner = wraith.radius * 0.9;
        const outer = inner + (ray % 2 ? 3 : 7);
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = "rgb(168 244 224 / 78%)";
      ctx.lineWidth = 1.4;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.ellipse(0, 0, wraith.radius * 1.22, wraith.radius * 0.72, rotation, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let node = 0; node < 3; node += 1) {
        const angle = rotation + node * Math.PI * 2 / 3;
        ctx.fillStyle = "#b9ffed";
        ctx.fillRect(Math.cos(angle) * wraith.radius - 1.5, Math.sin(angle) * wraith.radius - 1.5, 3, 3);
      }
    }
    ctx.fillStyle = anthropic ? "#fff1d7" : "#e4fff6";
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(3, wraith.radius * 0.37), 0, Math.PI * 2);
    ctx.fill();
    drawCompanyMark(ctx, skin, 0, 0, Math.min(10, wraith.radius * 0.6));
    ctx.restore();
  }
}

function drawMapOverview() {
  const canvas = ui.mapOverview;
  const ctx = ui.mapContext;
  if (!canvas.width || !canvas.height) return;
  const sx = canvas.width / WORLD.width;
  const sy = canvas.height / WORLD.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.fillStyle = "#191827";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  const floor = artwork.floors[game.level.biome];
  if (floor?.complete && floor.naturalWidth > 0) {
    ctx.globalAlpha = 0.78;
    ctx.drawImage(floor, 0, 0, WORLD.width, WORLD.height);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "rgb(7 6 15 / 42%)";
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  drawCompanyFloorBranding(ctx, game.level.biome, 0.42, game.level);
  for (const hazard of game.hazards) {
    const status = hazardState(hazard);
    const bounds = hazardBounds(hazard);
    ctx.fillStyle = status.active ? "rgb(252 124 151 / 54%)" : status.warning ? "rgb(255 209 126 / 48%)" : "rgb(175 144 210 / 22%)";
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
  }
  ctx.fillStyle = "rgb(26 20 35 / 90%)";
  ctx.strokeStyle = "rgb(242 226 242 / 35%)";
  ctx.lineWidth = 8;
  for (const block of blocks) {
    ctx.save();
    ctx.translate(block.x + block.w / 2, block.y + block.h / 2);
    ctx.rotate(block.angle || 0);
    ctx.fillRect(-block.w / 2, -block.h / 2, block.w, block.h);
    ctx.strokeRect(-block.w / 2, -block.h / 2, block.w, block.h);
    ctx.restore();
  }
  const anchorBrandAccent = skinForRole("chaser").accent;
  for (const anchor of game.anchors) {
    ctx.fillStyle = anchor.health > 0 ? anchorBrandAccent : "rgb(157 197 180 / 35%)";
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, anchor.health > 0 ? 32 : 22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = skinForRole("chaser").accent;
  ctx.beginPath();
  ctx.arc(game.jev.x, game.jev.y, 35, 0, Math.PI * 2);
  ctx.fill();
  for (const clone of game.player.clones) {
    ctx.fillStyle = skinForRole("runner").accent;
    ctx.beginPath();
    ctx.arc(clone.x, clone.y, 21, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = skinForRole("runner").accent;
  ctx.beginPath();
  ctx.arc(game.player.x, game.player.y, 27, 0, Math.PI * 2);
  ctx.fill();
  const view = currentViewBounds();
  ctx.strokeStyle = "rgb(255 247 229 / 82%)";
  ctx.lineWidth = 8;
  ctx.strokeRect(view.x, view.y, view.width, view.height);
}

function currentViewBounds() {
  const rect = ui.canvas.getBoundingClientRect();
  const portraitArena = rect.width < 720;
  const idealWidth = portraitArena ? 700 : 1500;
  const idealHeight = portraitArena ? 1515 : 940;
  const zoom = Math.max(
    Math.min(rect.width / idealWidth, rect.height / idealHeight),
    rect.width / WORLD.width,
    rect.height / WORLD.height,
  );
  const width = rect.width / zoom;
  const height = rect.height / zoom;
  const x = clamp(game.player.x - width / 2, 0, WORLD.width - width);
  const y = clamp(game.player.y - height / 2, 0, WORLD.height - height);
  return { x, y, width, height };
}

function floorPalette(biome) {
  return {
    office: { edge: "#293932", trim: "#c09a62", glass: "#4c8b83" },
    cinder: { edge: "#252f35", trim: "#c8754c", glass: "#519f9b" },
    archive: { edge: "#39372e", trim: "#c79c68", glass: "#66866b" },
    garden: { edge: "#343a31", trim: "#ca8664", glass: "#7b9d68" },
    vault: { edge: "#3b3933", trim: "#b99b70", glass: "#728d78" },
    rift: { edge: "#30383a", trim: "#c27b57", glass: "#5c9e97" },
  }[biome] || { edge: "#293932", trim: "#c09a62", glass: "#4c8b83" };
}

function drawPixelRoomFrame(ctx, biome) {
  const palette = floorPalette(biome);
  const wall = 22;
  ctx.fillStyle = palette.edge;
  ctx.fillRect(0, 0, WORLD.width, wall);
  ctx.fillRect(0, WORLD.height - wall, WORLD.width, wall);
  ctx.fillRect(0, wall, wall, WORLD.height - wall * 2);
  ctx.fillRect(WORLD.width - wall, wall, wall, WORLD.height - wall * 2);
  ctx.fillStyle = palette.trim;
  ctx.fillRect(wall, wall - 5, WORLD.width - wall * 2, 5);
  ctx.fillRect(wall, WORLD.height - wall, WORLD.width - wall * 2, 5);
  ctx.fillRect(wall - 5, wall, 5, WORLD.height - wall * 2);
  ctx.fillRect(WORLD.width - wall, wall, 5, WORLD.height - wall * 2);
  ctx.fillStyle = palette.glass;
  for (let x = 112; x < WORLD.width - 96; x += 192) {
    ctx.fillRect(x, 5, 28, 7);
    ctx.fillRect(x, WORLD.height - 12, 28, 7);
  }
  for (let y = 112; y < WORLD.height - 96; y += 192) {
    ctx.fillRect(5, y, 7, 28);
    ctx.fillRect(WORLD.width - 12, y, 7, 28);
  }
}

function drawCompanyFloorPlaque(ctx, brand, x, y, opacity = 0.34) {
  const openAI = brand === "openai";
  const logo = artwork.brandMarks[openAI ? "openai" : "anthropic"];
  if (!logo?.complete || !logo.naturalWidth) return;
  const width = openAI ? 76 : 152;
  const height = openAI ? 62 : 42;
  ctx.save();
  ctx.globalAlpha = opacity;
  const plate = openAI ? "rgba(224, 226, 206, 0.68)" : "rgba(231, 216, 190, 0.7)";
  const trim = openAI ? "rgba(48, 88, 78, 0.75)" : "rgba(123, 73, 49, 0.76)";
  ctx.fillStyle = "rgba(19, 19, 17, 0.2)";
  ctx.fillRect(x - width / 2, y - height / 2 + 4, width, height);
  ctx.fillStyle = plate;
  ctx.fillRect(x - width / 2, y - height / 2, width, height);
  ctx.fillStyle = trim;
  ctx.fillRect(x - width / 2, y - height / 2, width, 3);
  ctx.fillRect(x - width / 2, y + height / 2 - 3, width, 3);
  const logoWidth = openAI ? 38 : 128;
  const logoHeight = logo.naturalHeight * logoWidth / logo.naturalWidth;
  ctx.drawImage(logo, x - logoWidth / 2, y - logoHeight / 2, logoWidth, logoHeight);
  ctx.restore();
}

const companyFloorPositionCache = new WeakMap();
function companyFloorPositions(level) {
  if (companyFloorPositionCache.has(level)) return companyFloorPositionCache.get(level);
  const regions = [
    { x: [360, 1080], y: [280, 720], target: [720, 470] },
    { x: [1480, 2180], y: [280, 720], target: [1840, 470] },
    { x: [360, 1080], y: [880, 1220], target: [720, 1080] },
    { x: [1480, 2180], y: [880, 1220], target: [1840, 1080] },
  ];
  const obstacles = level.blocks || [];
  const hazards = level.hazards || [];
  const spawns = [level.playerStart, level.jevStart].filter(Boolean);
  const anthropicMap = ["archive", "garden", "vault"].includes(level.biome);
  const halfPlaqueWidth = anthropicMap ? 84 : 46;
  const halfPlaqueHeight = anthropicMap ? 30 : 40;
  const clear = (x, y) => {
    const overlaps = (left, top, right, bottom) =>
      x + halfPlaqueWidth > left - 16 && x - halfPlaqueWidth < right + 16
      && y + halfPlaqueHeight > top - 16 && y - halfPlaqueHeight < bottom + 16;
    if (obstacles.some((block) => {
      const angle = block.angle || 0;
      const width = Math.abs(block.w * Math.cos(angle)) + Math.abs(block.h * Math.sin(angle));
      const height = Math.abs(block.w * Math.sin(angle)) + Math.abs(block.h * Math.cos(angle));
      const centerX = block.x + block.w / 2;
      const centerY = block.y + block.h / 2;
      return overlaps(centerX - width / 2, centerY - height / 2, centerX + width / 2, centerY + height / 2);
    })) return false;
    if (hazards.some((hazard) => overlaps(hazard.x, hazard.y, hazard.x + hazard.w, hazard.y + hazard.h))) return false;
    return spawns.every((spawn) => Math.hypot(x - spawn.x, y - spawn.y) >= 255);
  };
  const positions = regions.map((region) => {
    const options = [];
    for (let y = region.y[0]; y <= region.y[1]; y += 40) {
      for (let x = region.x[0]; x <= region.x[1]; x += 40) {
        if (clear(x, y)) options.push([x, y]);
      }
    }
    options.sort((left, right) =>
      Math.hypot(left[0] - region.target[0], left[1] - region.target[1]) -
      Math.hypot(right[0] - region.target[0], right[1] - region.target[1])
    );
    return options[0] || null;
  });
  companyFloorPositionCache.set(level, positions);
  return positions;
}

function drawCompanyFloorBranding(ctx, biome, opacity = 0.38, level = game?.level) {
  if (!level) return;
  const positions = companyFloorPositions(level);
  const brand = biome === "office" || biome === "cinder" ? "openai"
    : biome === "archive" || biome === "garden" || biome === "vault" ? "anthropic" : "shared";
  positions.forEach((position, index) => {
    if (!position) return;
    const [x, y] = position;
    const plaqueBrand = brand === "shared" ? ((index % 2) ? "anthropic" : "openai") : brand;
    drawCompanyFloorPlaque(ctx, plaqueBrand, x, y, Math.min(0.56, opacity + 0.12));
  });
}

function drawFloor(ctx) {
  const floor = artwork.floors[game.level.biome];
  if (floor?.complete && floor.naturalWidth > 0) {
    const baseColors = {
      office: "#d3d0c3", cinder: "#1d292e", archive: "#cabda5",
      garden: "#173631", vault: "#c9bda5", rift: "#273039",
    };
    const textureOpacity = {
      office: 0.34, cinder: 0.78, archive: 0.43,
      garden: 0.43, vault: 0.4, rift: 0.46,
    };
    ctx.fillStyle = baseColors[game.level.biome] || "#273039";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.globalAlpha = textureOpacity[game.level.biome] ?? 0.46;
    for (let y = 0; y < WORLD.height; y += floor.naturalHeight) {
      for (let x = 0; x < WORLD.width; x += floor.naturalWidth) {
        ctx.drawImage(floor, x, y);
      }
    }
    ctx.globalAlpha = 1;
    drawLabFloorDetails(ctx, game.level.biome);
    ctx.fillStyle = "rgba(10, 16, 15, 0.06)";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    drawPixelRoomFrame(ctx, game.level.biome);
  } else if (game.level.biome === "cinder") {
    drawCinderFloor(ctx);
  } else if (game.level.biome === "archive") {
    drawArchiveFloor(ctx);
  } else if (game.level.biome === "garden") {
    drawGardenFloor(ctx);
  } else if (game.level.biome === "vault") {
    drawVaultFloor(ctx);
  } else if (game.level.biome === "rift") {
    drawRiftFloor(ctx);
  } else {
    ctx.fillStyle = "#201a2c";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    const tile = 48;
    for (let y = 22; y < WORLD.height - 22; y += tile) {
      for (let x = 22; x < WORLD.width - 22; x += tile) {
        const shade = ((x / tile + y / tile) % 2) === 0 ? "#241e30" : "#221c2e";
        ctx.fillStyle = shade;
        ctx.fillRect(x, y, tile - 1, tile - 1);
      }
    }
    ctx.strokeStyle = "rgb(199 167 204 / 8%)";
    ctx.lineWidth = 1;
    ctx.strokeRect(21.5, 21.5, WORLD.width - 43, WORLD.height - 43);
    ctx.strokeStyle = "rgb(212 177 219 / 6%)";
    ctx.setLineDash([3, 12]);
    ctx.beginPath();
    ctx.moveTo(30, WORLD.height / 2);
    ctx.lineTo(WORLD.width - 30, WORLD.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const corners = [
      [38, 38, 1, 1], [WORLD.width - 38, 38, -1, 1],
      [38, WORLD.height - 38, 1, -1], [WORLD.width - 38, WORLD.height - 38, -1, -1],
    ];
    for (const [x, y, sx, sy] of corners) {
      ctx.strokeStyle = "rgb(239 197 131 / 23%)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + sy * 24);
      ctx.lineTo(x, y);
      ctx.lineTo(x + sx * 24, y);
      ctx.stroke();
    }
  }
  if (!(floor?.complete && floor.naturalWidth > 0)) drawLabFloorDetails(ctx, game.level.biome);
  drawCompanyFloorBranding(ctx, game.level.biome, 0.42);
}

function drawLabFloorDetails(ctx, biome) {
  const anthropic = ["archive", "garden", "vault"].includes(biome);
  const openAi = ["office", "cinder"].includes(biome);
  const seam = anthropic ? "rgba(235, 207, 164, 0.1)" : "rgba(155, 220, 207, 0.1)";
  const channel = anthropic ? "rgba(198, 143, 99, 0.11)" : "rgba(108, 212, 192, 0.12)";
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = seam;
  for (let x = 128; x < WORLD.width; x += 256) {
    ctx.beginPath();
    ctx.moveTo(x, 24);
    ctx.lineTo(x, WORLD.height - 24);
    ctx.stroke();
  }
  for (let y = 128; y < WORLD.height; y += 256) {
    ctx.beginPath();
    ctx.moveTo(24, y);
    ctx.lineTo(WORLD.width - 24, y);
    ctx.stroke();
  }
  ctx.strokeStyle = channel;
  ctx.lineWidth = 4;
  for (let x = 640; x < WORLD.width; x += 640) {
    ctx.beginPath();
    ctx.moveTo(x, 28);
    ctx.lineTo(x, WORLD.height - 28);
    ctx.stroke();
  }
  for (let y = 400; y < WORLD.height; y += 400) {
    ctx.beginPath();
    ctx.moveTo(28, y);
    ctx.lineTo(WORLD.width - 28, y);
    ctx.stroke();
  }
  const lightColor = openAi ? "119, 220, 194" : anthropic ? "242, 178, 115" : "197, 213, 200";
  for (const [x, y] of [[320, 260], [960, 290], [1600, 1040], [2240, 1240]]) {
    const light = ctx.createRadialGradient(x, y, 12, x, y, 300);
    light.addColorStop(0, `rgba(${lightColor}, 0.1)`);
    light.addColorStop(1, `rgba(${lightColor}, 0)`);
    ctx.fillStyle = light;
    ctx.fillRect(x - 300, y - 300, 600, 600);
  }
  ctx.restore();
}

function drawGardenFloor(ctx) {
  const floor = ctx.createLinearGradient(0, 0, WORLD.width, WORLD.height);
  floor.addColorStop(0, "#102a2c");
  floor.addColorStop(0.46, "#183a36");
  floor.addColorStop(1, "#10282c");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  for (let y = 30; y < WORLD.height; y += 74) {
    const offset = (Math.floor(y / 74) % 2) * 36;
    for (let x = 22 + offset; x < WORLD.width - 24; x += 132) {
      ctx.fillStyle = "rgb(148 203 155 / 3%)";
      ctx.fillRect(x, y, 128, 69);
      ctx.strokeStyle = "rgb(164 211 171 / 8%)";
      ctx.strokeRect(x + 0.5, y + 0.5, 127, 68);
      ctx.fillStyle = "rgb(202 225 155 / 22%)";
      ctx.beginPath();
      ctx.arc(x + 22 + (x % 37), y + 20 + (y % 25), 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = "rgb(194 225 180 / 8%)";
  ctx.lineWidth = 2;
  for (let x = 74; x < WORLD.width; x += 256) {
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.quadraticCurveTo(x + 38, WORLD.height / 2, x, WORLD.height - 20);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgb(172 222 178 / 18%)";
  ctx.lineWidth = 2;
  ctx.strokeRect(22, 22, WORLD.width - 44, WORLD.height - 44);
  const vignette = ctx.createRadialGradient(WORLD.width / 2, WORLD.height / 2, 160, WORLD.width / 2, WORLD.height / 2, WORLD.width * 0.68);
  vignette.addColorStop(0, "rgb(3 18 20 / 0%)");
  vignette.addColorStop(1, "rgb(4 15 19 / 50%)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
}

function drawVaultFloor(ctx) {
  const centerX = WORLD.width / 2;
  const centerY = WORLD.height / 2;
  const floor = ctx.createRadialGradient(centerX, centerY, 60, centerX, centerY, WORLD.width * 0.72);
  floor.addColorStop(0, "#44395b");
  floor.addColorStop(0.5, "#28243d");
  floor.addColorStop(1, "#171829");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.save();
  ctx.translate(centerX, centerY);
  for (let ring = 0; ring < 5; ring += 1) {
    const radius = 110 + ring * 102;
    ctx.strokeStyle = ring % 2 ? "rgb(224 194 151 / 9%)" : "rgb(204 173 247 / 12%)";
    ctx.lineWidth = ring === 0 ? 2 : 1;
    ctx.setLineDash(ring % 2 ? [4, 12] : []);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (let spoke = 0; spoke < 16; spoke += 1) {
    const angle = spoke * Math.PI / 8;
    ctx.strokeStyle = "rgb(232 203 160 / 10%)";
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 105, Math.sin(angle) * 105);
    ctx.lineTo(Math.cos(angle) * 625, Math.sin(angle) * 625);
    ctx.stroke();
    ctx.fillStyle = "rgb(237 207 162 / 38%)";
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 314, Math.sin(angle) * 314, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = "rgb(215 190 238 / 15%)";
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, WORLD.width - 48, WORLD.height - 48);
}

function drawRiftFloor(ctx) {
  const floor = ctx.createLinearGradient(0, WORLD.height, WORLD.width, 0);
  floor.addColorStop(0, "#111a32");
  floor.addColorStop(0.48, "#20213e");
  floor.addColorStop(1, "#18172d");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  for (let row = -WORLD.height; row < WORLD.height * 2; row += 88) {
    ctx.strokeStyle = "rgb(160 157 226 / 7%)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, row + 160);
    ctx.lineTo(WORLD.width - 20, row - 40);
    ctx.stroke();
  }
  const cracks = [
    [[142, 110], [223, 195], [198, 274], [286, 338]],
    [[1070, 148], [1001, 239], [1089, 313], [1035, 394]],
    [[350, 500], [431, 551], [408, 626], [489, 687]],
    [[812, 220], [758, 289], [831, 356], [777, 426]],
  ];
  for (const crack of cracks) {
    ctx.beginPath();
    ctx.moveTo(crack[0][0], crack[0][1]);
    for (let index = 1; index < crack.length; index += 1) ctx.lineTo(crack[index][0], crack[index][1]);
    ctx.strokeStyle = "rgb(166 121 251 / 18%)";
    ctx.lineWidth = 13;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.strokeStyle = "rgb(243 163 237 / 40%)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  for (let index = 0; index < 38; index += 1) {
    const x = (index * 137 + 73) % WORLD.width;
    const y = (index * 89 + 47) % WORLD.height;
    ctx.fillStyle = "rgb(225 200 255 / 42%)";
    ctx.beginPath();
    ctx.arc(x, y, index % 5 === 0 ? 2 : 1, 0, Math.PI * 2);
    ctx.fill();
  }
  const vignette = ctx.createRadialGradient(WORLD.width / 2, WORLD.height / 2, 130, WORLD.width / 2, WORLD.height / 2, WORLD.width * 0.68);
  vignette.addColorStop(0, "rgb(4 5 15 / 0%)");
  vignette.addColorStop(1, "rgb(4 4 12 / 56%)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
}

function drawHazards(ctx) {
  for (const hazard of game.hazards) {
    const status = hazardState(hazard);
    const colors = {
      lava: [255, 91, 53],
      steam: [255, 124, 72],
      current: [100, 221, 219],
      quicksand: [213, 179, 111],
      swarm: [168, 227, 134],
      spores: [174, 229, 128],
      arc_sparks: [255, 210, 119],
      rift_surge: [216, 135, 255],
    };
    const color = colors[hazard.kind] || [204, 172, 255];
    const alpha = hazard.kind === "current" ? 0.12 : status.active ? 0.31 : status.warning ? 0.24 + Math.sin(game.elapsed * 12) * 0.06 : 0.055;
    const bounds = hazardBounds(hazard);
    const { x, y, w, h } = bounds;
    ctx.save();
    ctx.fillStyle = "rgba(" + color.join(",") + ", " + alpha + ")";
    ctx.shadowColor = "rgba(" + color.join(",") + ", " + (status.active || status.warning ? 0.7 : 0.18) + ")";
    ctx.shadowBlur = status.active || status.warning ? 20 : 8;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 18);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(" + color.join(",") + ", " + (status.active ? 0.72 : status.warning ? 0.65 : 0.28) + ")";
    ctx.lineWidth = status.warning ? 2.5 : 1.5;
    ctx.setLineDash(hazard.kind === "current" ? [8, 8] : status.warning ? [4, 5] : []);
    ctx.stroke();
    ctx.setLineDash([]);
    if (hazard.kind === "lava") {
      ctx.fillStyle = status.active ? "rgba(255, 114, 54, 0.42)" : "rgba(255, 126, 62, 0.12)";
      ctx.beginPath();
      ctx.roundRect(x + 7, y + 7, w - 14, h - 14, 14);
      ctx.fill();
      ctx.strokeStyle = status.warning ? "#ffe3a0" : "rgba(255, 193, 113, 0.8)";
      ctx.lineWidth = status.warning ? 2.4 : 1.6;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.18, y + h * 0.24);
      ctx.lineTo(x + w * 0.35, y + h * 0.48);
      ctx.lineTo(x + w * 0.27, y + h * 0.78);
      ctx.moveTo(x + w * 0.68, y + h * 0.15);
      ctx.lineTo(x + w * 0.56, y + h * 0.45);
      ctx.lineTo(x + w * 0.77, y + h * 0.72);
      ctx.stroke();
    } else if (hazard.kind === "current") {
      const flowLength = Math.hypot(hazard.flowX, hazard.flowY) || 1;
      const flowX = hazard.flowX / flowLength;
      const flowY = hazard.flowY / flowLength;
      for (let index = 0; index < 3; index += 1) {
        const offset = (index + 1) / 4;
        const centerX = x + w * offset;
        const centerY = y + h * (0.34 + index % 2 * 0.32);
        ctx.strokeStyle = "rgba(" + color.join(",") + ", 0.55)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX - flowX * 16, centerY - flowY * 16);
        ctx.lineTo(centerX + flowX * 15, centerY + flowY * 15);
        ctx.lineTo(centerX + flowX * 7 - flowY * 7, centerY + flowY * 7 + flowX * 7);
        ctx.moveTo(centerX + flowX * 15, centerY + flowY * 15);
        ctx.lineTo(centerX + flowX * 7 + flowY * 7, centerY + flowY * 7 - flowX * 7);
        ctx.stroke();
      }
    } else if (hazard.kind === "quicksand" || hazard.kind === "swarm") {
      ctx.globalAlpha = status.active ? 0.82 : status.warning ? 0.54 : 0.32;
      ctx.strokeStyle = "rgba(" + color.join(",") + ", 0.78)";
      ctx.lineWidth = hazard.kind === "swarm" ? 2 : 1.5;
      if (hazard.kind === "swarm") ctx.setLineDash([3, 6]);
      for (let ring = 0; ring < 4; ring += 1) {
        const cx = x + w * (0.2 + (ring % 2) * 0.42) + Math.sin(game.elapsed * 2 + ring) * 5;
        const cy = y + h * (0.26 + Math.floor(ring / 2) * 0.4) + Math.cos(game.elapsed * 2.4 + ring) * 4;
        const radius = (hazard.kind === "swarm" ? 8 : 10) + ring * 2 + (status.active ? Math.sin(game.elapsed * 5 + ring) * 2 : 0);
        ctx.beginPath();
        ctx.ellipse(cx, cy, radius * 1.4, radius, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    } else {
      ctx.globalAlpha = status.active ? 0.8 : status.warning ? 0.44 : 0.2;
      ctx.strokeStyle = "rgba(" + color.join(",") + ", 0.7)";
      ctx.lineWidth = 1;
      for (let ring = 0; ring < 3; ring += 1) {
        const pulse = status.active ? (game.elapsed * 28 + ring * 18) % Math.min(w, h) : 10 + ring * 10;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, Math.max(3, w * 0.2 + pulse), Math.max(3, h * 0.2 + pulse * 0.6), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

function drawWorldLighting(ctx) {
  const biome = game.level.biome;
  const color = biomeAccent(biome);
  const accent = [1, 3, 5].map((start) => Number.parseInt(color.slice(start, start + 2), 16));
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const ambient = ctx.createRadialGradient(WORLD.width / 2, WORLD.height / 2, 8, WORLD.width / 2, WORLD.height / 2, 390);
  ambient.addColorStop(0, "rgba(" + accent.join(",") + ", 0.15)");
  ambient.addColorStop(0.46, "rgba(" + accent.join(",") + ", 0.055)");
  ambient.addColorStop(1, "rgba(" + accent.join(",") + ", 0)");
  ctx.fillStyle = ambient;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  const movingLights = [
    { x: game.player.x, y: game.player.y, color: skinForRole("runner").light, radius: 250, strength: 0.18 },
    { x: game.jev.x, y: game.jev.y, color: skinForRole("chaser").light, radius: 230, strength: 0.15 },
  ];
  const hotspots = [
    ...movingLights,
    ...game.hazards.map((hazard) => {
      const bounds = hazardBounds(hazard);
      return {
      x: bounds.x + bounds.w / 2,
      y: bounds.y + bounds.h / 2,
      color: accent,
      radius: Math.max(bounds.w, bounds.h) * 0.8,
      strength: hazardState(hazard).active ? 0.19 : 0.09,
    }; }),
  ];
  for (const { x, y, radius, color: lightColor, strength } of hotspots) {
    const gradient = ctx.createRadialGradient(x, y, 2, x, y, radius);
    gradient.addColorStop(0, "rgba(" + lightColor.join(",") + ", " + strength + ")");
    gradient.addColorStop(1, "rgba(" + lightColor.join(",") + ", 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  ctx.restore();

  const centerX = WORLD.width / 2;
  const centerY = WORLD.height / 2;
  const vignette = ctx.createRadialGradient(centerX, centerY, WORLD.width * 0.24, centerX, centerY, WORLD.width * 0.72);
  vignette.addColorStop(0, "rgba(6, 7, 14, 0)");
  vignette.addColorStop(1, "rgba(6, 7, 14, 0.28)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
}

function drawCinderFloor(ctx) {
  const designWidth = 960;
  const designHeight = 600;
  ctx.save();
  ctx.scale(WORLD.width / designWidth, WORLD.height / designHeight);
  const floor = ctx.createLinearGradient(0, 0, designWidth, designHeight);
  floor.addColorStop(0, "#291b24");
  floor.addColorStop(0.52, "#352027");
  floor.addColorStop(1, "#211820");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, designWidth, designHeight);
  for (let y = 34; y < designHeight; y += 56) {
    ctx.strokeStyle = "rgb(209 142 112 / 9%)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(22, y + Math.sin(y) * 4);
    ctx.lineTo(designWidth - 22, y - Math.sin(y * 0.7) * 4);
    ctx.stroke();
  }
  const fissures = [
    [[58, 178], [130, 202], [165, 244], [214, 254]],
    [[354, 44], [376, 108], [355, 146], [382, 194]],
    [[560, 404], [602, 382], [633, 337], [690, 322]],
    [[845, 230], [800, 258], [829, 304], [790, 358]],
    [[91, 455], [140, 432], [183, 448], [225, 425]],
    [[553, 94], [581, 123], [567, 158], [599, 184]],
  ];
  for (const fissure of fissures) {
    ctx.beginPath();
    ctx.moveTo(fissure[0][0], fissure[0][1]);
    for (let index = 1; index < fissure.length; index += 1) ctx.lineTo(fissure[index][0], fissure[index][1]);
    ctx.strokeStyle = "rgb(236 100 58 / 23%)";
    ctx.lineWidth = 8;
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.strokeStyle = "rgb(255 177 89 / 44%)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  for (let y = 66; y < designHeight - 40; y += 112) {
    for (let x = 74 + (y % 3) * 20; x < designWidth - 45; x += 128) {
      ctx.strokeStyle = "rgb(229 177 140 / 10%)";
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgb(245 144 87 / 19%)";
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const glow = ctx.createRadialGradient(480, 300, 90, 480, 300, 700);
  glow.addColorStop(0, "rgb(255 125 65 / 0%)");
  glow.addColorStop(1, "rgb(12 7 12 / 48%)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, designWidth, designHeight);
  ctx.restore();
}

function drawArchiveFloor(ctx) {
  const designWidth = 960;
  const designHeight = 600;
  ctx.save();
  ctx.scale(WORLD.width / designWidth, WORLD.height / designHeight);
  const floor = ctx.createLinearGradient(0, 0, 0, designHeight);
  floor.addColorStop(0, "#152d37");
  floor.addColorStop(0.45, "#173840");
  floor.addColorStop(1, "#102831");
  ctx.fillStyle = floor;
  ctx.fillRect(0, 0, designWidth, designHeight);
  for (let y = 28; y < designHeight; y += 46) {
    const offset = (Math.floor(y / 46) % 2) * 38;
    ctx.fillStyle = Math.floor(y / 46) % 2 ? "rgb(127 177 166 / 4%)" : "rgb(5 20 29 / 9%)";
    ctx.fillRect(22, y, designWidth - 44, 44);
    ctx.strokeStyle = "rgb(165 218 202 / 10%)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(22, y + 1);
    ctx.lineTo(designWidth - 22, y + 1);
    ctx.moveTo(96 + offset, y + 2);
    ctx.lineTo(96 + offset, y + 43);
    ctx.stroke();
  }
  const pools = [
    [95, 220, 58, 20], [474, 280, 78, 24], [844, 270, 53, 18],
    [171, 516, 75, 18], [718, 174, 61, 19], [566, 516, 74, 22],
  ];
  for (const [x, y, rx, ry] of pools) {
    ctx.fillStyle = "rgb(77 180 173 / 8%)";
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, -0.12, 0, Math.PI * 2);
    ctx.fill();
    for (let ring = 0; ring < 3; ring += 1) {
      ctx.strokeStyle = "rgb(154 224 207 / " + (15 - ring * 3) + "%)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, y, rx * (0.46 + ring * 0.22), ry * (0.42 + ring * 0.22), -0.12, 0.18, Math.PI * 1.85);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "rgb(164 228 211 / 16%)";
  ctx.lineWidth = 2;
  ctx.strokeRect(23, 23, designWidth - 46, designHeight - 46);
  const vignette = ctx.createRadialGradient(480, 300, 170, 480, 300, 650);
  vignette.addColorStop(0, "rgb(9 22 28 / 0%)");
  vignette.addColorStop(1, "rgb(5 15 21 / 44%)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, designWidth, designHeight);
  ctx.restore();
}

function pixelObstaclePalette(biome) {
  return {
    office: { edge: "#342b25", face: "#8d694d", highlight: "#c49a67", dark: "#293c3d", glass: "#3f716d", accent: "#d1aa6e", plant: "#58734e", warm: "#c87755" },
    cinder: { edge: "#1d292f", face: "#35464a", highlight: "#5f7774", dark: "#182329", glass: "#2e6061", accent: "#d78050", plant: "#63774c", warm: "#db9560" },
    archive: { edge: "#302d27", face: "#917451", highlight: "#c7a77a", dark: "#303b31", glass: "#58705b", accent: "#d5b17b", plant: "#60794f", warm: "#bf7452" },
    garden: { edge: "#30352c", face: "#6d7650", highlight: "#a6ad75", dark: "#29332c", glass: "#52765e", accent: "#d08c68", plant: "#598457", warm: "#d3ac74" },
    vault: { edge: "#36332c", face: "#9b8d74", highlight: "#d4c29d", dark: "#38413b", glass: "#608477", accent: "#bd9162", plant: "#657d60", warm: "#ca805e" },
    rift: { edge: "#2a3133", face: "#58645f", highlight: "#8e9a83", dark: "#222e32", glass: "#467a79", accent: "#d09062", plant: "#637b59", warm: "#c67b58" },
  }[biome] || { edge: "#342b25", face: "#8d694d", highlight: "#c49a67", dark: "#293c3d", glass: "#3f716d", accent: "#d1aa6e", plant: "#58734e", warm: "#c87755" };
}

function drawPixelEllipse(ctx, x, y, width, height, color, step = 10) {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const radiusX = width / 2;
  const radiusY = height / 2;
  ctx.fillStyle = color;
  for (let offsetY = -radiusY; offsetY < radiusY; offsetY += step) {
    const curve = Math.sqrt(Math.max(0, 1 - (offsetY / radiusY) ** 2));
    const halfWidth = Math.floor((radiusX * curve) / step) * step;
    ctx.fillRect(centerX - halfWidth, centerY + offsetY, Math.max(step, halfWidth * 2), step);
  }
}

function drawPixelOfficeObstacle(ctx, block, biome) {
  const { x, y, w, h, kind } = block;
  const palette = pixelObstaclePalette(biome);
  const unit = Math.max(3, Math.min(9, Math.floor(Math.min(w, h) / 8)));
  const horizontal = w >= h;
  const major = horizontal ? w : h;
  const minor = horizontal ? h : w;
  const longCoordinate = (index) => horizontal ? x + index : y + index;
  const center = (along) => horizontal ? { x: along, y: y + h / 2 } : { x: x + w / 2, y: along };
  const isAnthropic = biome === "archive" || biome === "garden" || biome === "vault";
  const wood = isAnthropic ? "#79543e" : biome === "cinder" ? "#3c3739" : "#6d5039";
  const woodLight = isAnthropic ? "#c69a68" : biome === "cinder" ? "#c78352" : "#c5a16c";
  const screen = biome === "cinder" ? "#66d6c0" : "#7bd8c8";
  const drawFrame = (left, top, width, height, face) => {
    ctx.fillStyle = "rgba(8, 13, 14, 0.48)";
    ctx.fillRect(left + unit, top + unit * 2, width, height);
    ctx.fillStyle = palette.edge;
    ctx.fillRect(left, top, width, height);
    ctx.fillStyle = face;
    ctx.fillRect(left + unit, top + unit, Math.max(unit, width - unit * 2), Math.max(unit, height - unit * 2));
    ctx.fillStyle = palette.highlight;
    ctx.fillRect(left + unit, top + unit, Math.max(unit, width - unit * 2), Math.max(2, unit / 2));
  };
  if (block.shape === "circle" || block.shape === "ellipse") {
    const inset = unit * 1.2;
    drawPixelEllipse(ctx, x + unit, y + unit * 1.8, w, h, palette.edge, unit * 2);
    drawPixelEllipse(ctx, x, y, w, h, isAnthropic ? wood : palette.glass, unit * 2);
    drawPixelEllipse(ctx, x + inset, y + inset, w - inset * 2, h - inset * 2, palette.dark, unit * 2);
    if (kind === "reflecting_pool") {
      drawPixelEllipse(ctx, x + inset * 1.5, y + inset * 1.5, w - inset * 3, h - inset * 3, "#397b7d", unit * 2);
      ctx.fillStyle = "rgba(181, 240, 218, 0.55)";
      for (let line = 0; line < 5; line += 1) {
        const lineY = y + h * (0.28 + line * 0.1);
        ctx.fillRect(x + w * 0.31, lineY, w * (0.25 + (line % 2) * 0.14), Math.max(2, unit / 2));
      }
    } else {
      drawPixelEllipse(ctx, x + inset * 1.55, y + inset * 1.55, w - inset * 3.1, h - inset * 3.1, wood, unit * 2);
      const cx = x + w / 2;
      const cy = y + h / 2;
      ctx.fillStyle = woodLight;
      ctx.fillRect(cx - unit * 2, cy - unit * 2, unit * 4, unit * 4);
      ctx.fillStyle = palette.plant;
      ctx.fillRect(cx - unit, cy - unit, unit * 2, unit * 2);
      for (let seat = 0; seat < 4; seat += 1) {
        const angle = seat * Math.PI / 2;
        const seatX = cx + Math.cos(angle) * w * 0.32;
        const seatY = cy + Math.sin(angle) * h * 0.32;
        ctx.fillStyle = palette.accent;
        ctx.fillRect(seatX - unit * 2, seatY - unit, unit * 4, unit * 2);
      }
    }
    return;
  }

  if (["hedge", "flowerbed"].includes(kind)) {
    drawFrame(x, y, w, h, wood);
    ctx.fillStyle = "#253d32";
    ctx.fillRect(x + unit * 2, y + unit * 2, w - unit * 4, h - unit * 4);
    for (let py = y + unit * 2; py < y + h - unit * 2; py += unit * 2) {
      for (let px = x + unit * 2; px < x + w - unit * 2; px += unit * 2) {
        const cell = (Math.floor(px / (unit * 2)) + Math.floor(py / (unit * 2))) % 4;
        ctx.fillStyle = cell === 0 ? "#8baa67" : cell === 1 ? "#517e55" : cell === 2 ? "#396e50" : "#c49e71";
        ctx.fillRect(px, py, unit * 1.5, unit * 1.5);
        if (cell === 0 || cell === 3) {
          ctx.fillStyle = cell === 0 ? "#e8d38a" : "#d38b9d";
          ctx.fillRect(px + unit / 2, py + unit / 2, Math.max(2, unit / 2), Math.max(2, unit / 2));
        }
      }
    }
    return;
  }

  if (kind === "trellis") {
    drawFrame(x, y, w, h, wood);
    ctx.fillStyle = "#314d40";
    ctx.fillRect(x + unit * 2, y + unit * 2, w - unit * 4, h - unit * 4);
    const spacing = Math.max(unit * 3, 18);
    for (let position = spacing; position < major - unit * 3; position += spacing) {
      const along = longCoordinate(position);
      const leaf = center(along);
      ctx.fillStyle = "#b38a5d";
      if (horizontal) ctx.fillRect(along, y + unit * 2, unit / 2, h - unit * 4);
      else ctx.fillRect(x + unit * 2, along, w - unit * 4, unit / 2);
      ctx.fillStyle = palette.plant;
      ctx.fillRect(leaf.x - unit, leaf.y - unit, unit * 2, unit * 2);
    }
    return;
  }

  const isBookStorage = ["shelf", "vault_wall", "vault_rib"].includes(kind);
  if (isBookStorage) {
    drawFrame(x, y, w, h, wood);
    ctx.fillStyle = isAnthropic ? "#34382f" : "#283338";
    ctx.fillRect(x + unit * 2, y + unit * 2, w - unit * 4, h - unit * 4);
    const covers = ["#b67555", "#c7a16c", "#678c78", "#827091", "#d0bd91", "#4f7773"];
    if (kind === "shelf" && horizontal) {
      const inset = unit * 2.2;
      const span = Math.max(1, w - inset * 2);
      const count = Math.max(4, Math.floor(span / 19));
      const bookWidth = span / count;
      for (let index = 0; index < count; index += 1) {
        const left = x + inset + index * bookWidth + 1;
        const spineWidth = Math.max(4, bookWidth - 2);
        const spineHeight = h - unit * (4 + index % 3);
        ctx.fillStyle = covers[index % covers.length];
        ctx.fillRect(left, y + (h - spineHeight) / 2, spineWidth, spineHeight);
        ctx.fillStyle = "rgba(255, 238, 203, 0.7)";
        ctx.fillRect(left + Math.max(2, spineWidth * 0.25), y + h * 0.42, Math.max(2, spineWidth * 0.5), Math.max(2, unit / 2));
        ctx.fillStyle = "rgba(40, 34, 31, 0.4)";
        ctx.fillRect(left + spineWidth - 2, y + unit * 2.1, 1.5, h - unit * 4.2);
      }
    } else if (kind === "shelf") {
      const inset = unit * 2.2;
      const span = Math.max(1, h - inset * 2);
      const count = Math.max(4, Math.floor(span / 19));
      const bookHeight = span / count;
      for (let index = 0; index < count; index += 1) {
        const top = y + inset + index * bookHeight + 1;
        const spineHeight = Math.max(4, bookHeight - 2);
        const spineWidth = w - unit * (4 + index % 3);
        ctx.fillStyle = covers[index % covers.length];
        ctx.fillRect(x + (w - spineWidth) / 2, top, spineWidth, spineHeight);
        ctx.fillStyle = "rgba(255, 238, 203, 0.7)";
        ctx.fillRect(x + w * 0.42, top + Math.max(2, spineHeight * 0.24), Math.max(2, unit / 2), Math.max(2, spineHeight * 0.52));
      }
    } else if (horizontal) {
      let bookX = x + unit * 2;
      let index = 0;
      while (bookX < x + w - unit * 2) {
        const bookWidth = unit + (index % 3) * 2;
        const bookHeight = Math.max(unit * 2, h - unit * (3 + index % 2));
        ctx.fillStyle = covers[index % covers.length];
        ctx.fillRect(bookX, y + h - unit * 2 - bookHeight, bookWidth, bookHeight);
        ctx.fillStyle = "rgba(249, 228, 184, 0.62)";
        ctx.fillRect(bookX + 1, y + h - unit * 3, Math.max(1, bookWidth - 2), Math.max(1, unit / 2));
        bookX += bookWidth + Math.max(2, unit / 2);
        index += 1;
      }
    } else {
      let bookY = y + unit * 2;
      let index = 0;
      while (bookY < y + h - unit * 2) {
        const bookHeight = unit + (index % 3) * 2;
        const bookWidth = Math.max(unit * 2, w - unit * (3 + index % 2));
        ctx.fillStyle = covers[index % covers.length];
        ctx.fillRect(x + w - unit * 2 - bookWidth, bookY, bookWidth, bookHeight);
        ctx.fillStyle = "rgba(249, 228, 184, 0.62)";
        ctx.fillRect(x + w - unit * 3, bookY + 1, Math.max(1, unit / 2), Math.max(1, bookHeight - 2));
        bookY += bookHeight + Math.max(2, unit / 2);
        index += 1;
      }
    }
    ctx.fillStyle = woodLight;
    if (horizontal) ctx.fillRect(x + unit, y + h - unit * 2, w - unit * 2, unit);
    else ctx.fillRect(x + w - unit * 2, y + unit, unit, h - unit * 2);
    if (kind === "shelf" && Math.min(w, h) >= 34) {
      const mark = artwork.brandMarks[isAnthropic ? "anthropicMark" : "openai"];
      if (mark?.complete && mark.naturalWidth) {
        const markSize = Math.min(15, Math.min(w, h) * 0.34);
        ctx.fillStyle = isAnthropic ? "#e9d7bb" : "#d9ece1";
        ctx.fillRect(x + unit * 2.2, y + unit * 2.2, markSize + 3, markSize + 3);
        ctx.drawImage(mark, x + unit * 2.2 + 1.5, y + unit * 2.2 + 1.5, markSize, markSize * mark.naturalHeight / mark.naturalWidth);
      }
    }
    return;
  }

  const isCompute = ["vent", "furnace", "obelisk"].includes(kind);
  if (isCompute) {
    drawFrame(x, y, w, h, "#242d32");
    ctx.fillStyle = "#121b21";
    ctx.fillRect(x + unit * 2, y + unit * 2, w - unit * 4, h - unit * 4);
    const rackCount = Math.max(1, Math.floor((major - unit * 4) / Math.max(40, minor * 0.92)));
    for (let rack = 0; rack < rackCount; rack += 1) {
      const start = unit * 2 + rack * ((major - unit * 4) / rackCount);
      const bay = (major - unit * 4) / rackCount - unit;
      const left = horizontal ? x + start : x + unit * 2;
      const top = horizontal ? y + unit * 2 : y + start;
      const bayWidth = horizontal ? bay : w - unit * 4;
      const bayHeight = horizontal ? h - unit * 4 : bay;
      ctx.fillStyle = "#314048";
      ctx.fillRect(left, top, bayWidth, bayHeight);
      const rows = Math.max(2, Math.floor((horizontal ? bayHeight : bayWidth) / (unit * 1.6)));
      for (let row = 0; row < rows; row += 1) {
        ctx.fillStyle = row % 2 ? "#52666b" : "#202c33";
        if (horizontal) ctx.fillRect(left + unit, top + unit + row * unit * 1.4, Math.max(2, bayWidth - unit * 2), Math.max(2, unit / 2));
        else ctx.fillRect(left + unit + row * unit * 1.4, top + unit, Math.max(2, unit / 2), Math.max(2, bayHeight - unit * 2));
      }
      ctx.fillStyle = screen;
      ctx.fillRect(left + unit, top + unit, Math.max(2, unit / 2), Math.max(2, unit / 2));
      ctx.fillStyle = "#e2a06e";
      ctx.fillRect(left + unit * 2, top + unit, Math.max(2, unit / 2), Math.max(2, unit / 2));
    }
    const mark = artwork.brandMarks[isAnthropic ? "anthropicMark" : "openai"];
    if (mark?.complete && mark.naturalWidth && minor >= 48) {
      const markSize = Math.min(13, minor * 0.22);
      ctx.fillStyle = "#ecede2";
      ctx.fillRect(x + w - markSize - unit * 2, y + unit * 2, markSize + 2, markSize + 2);
      ctx.drawImage(mark, x + w - markSize - unit * 2 + 1, y + unit * 2 + 1, markSize, markSize * mark.naturalHeight / mark.naturalWidth);
    }
    return;
  }

  if (["pillar", "glass_pillar", "rift_pillar", "reliquary", "crystal"].includes(kind)) {
    drawFrame(x, y, w, h, kind === "pillar" || kind === "glass_pillar" ? "#314b4b" : palette.dark);
    ctx.fillStyle = "rgba(105, 190, 178, 0.42)";
    ctx.fillRect(x + unit * 2, y + unit * 2, w - unit * 4, h - unit * 4);
    ctx.fillStyle = palette.highlight;
    if (horizontal) {
      ctx.fillRect(x + w / 2 - unit / 2, y + unit * 2, unit, h - unit * 4);
      ctx.fillRect(x + unit * 2, y + h / 2 - unit / 2, w - unit * 4, unit);
    } else {
      ctx.fillRect(x + w / 2 - unit / 2, y + unit * 2, unit, h - unit * 4);
      ctx.fillRect(x + unit * 2, y + h / 2 - unit / 2, w - unit * 4, unit);
    }
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    ctx.fillStyle = palette.accent;
    ctx.fillRect(centerX - unit, centerY - unit, unit * 2, unit * 2);
    return;
  }

  if (kind === "bench") {
    drawFrame(x, y, w, h, wood);
    ctx.fillStyle = isAnthropic ? "#657265" : "#536c68";
    ctx.beginPath();
    ctx.roundRect(x + unit * 2, y + unit * 1.5, w - unit * 4, h - unit * 3, Math.max(4, unit));
    ctx.fill();
    const seats = Math.max(1, Math.min(7, Math.floor((major - unit * 8) / 64)));
    for (let seat = 0; seat < seats; seat += 1) {
      const along = unit * 4 + (major - unit * 8) * (seat + 0.5) / seats;
      const point = center(longCoordinate(along));
      const seatWidth = horizontal ? (major - unit * 10) / seats - unit * 1.5 : minor - unit * 6;
      const seatHeight = horizontal ? minor - unit * 5 : (major - unit * 10) / seats - unit * 1.5;
      const left = point.x - seatWidth / 2;
      const top = point.y - seatHeight / 2;
      ctx.fillStyle = seat % 2 ? "#b87557" : isAnthropic ? "#d7bf97" : "#c7b895";
      ctx.beginPath();
      ctx.roundRect(left, top, seatWidth, seatHeight, Math.max(3, unit));
      ctx.fill();
      ctx.fillStyle = "rgba(255, 242, 215, 0.52)";
      ctx.beginPath();
      ctx.roundRect(left + unit, top + unit, Math.max(2, seatWidth - unit * 2), Math.max(2, seatHeight * 0.24), Math.max(2, unit / 2));
      ctx.fill();
    }
    const mark = artwork.brandMarks[isAnthropic ? "anthropicMark" : "openai"];
    if (mark?.complete && mark.naturalWidth && minor >= 40) {
      const markSize = Math.min(12, minor * 0.22);
      ctx.fillStyle = isAnthropic ? "#ede0c9" : "#d9ece1";
      ctx.fillRect(x + w - markSize - unit * 2, y + unit * 2, markSize + 2, markSize + 2);
      ctx.drawImage(mark, x + w - markSize - unit * 2 + 1, y + unit * 2 + 1, markSize, markSize * mark.naturalHeight / mark.naturalWidth);
    }
    return;
  }

  if (["desk", "rift_wall", "vault_wall", "vault_rib"].includes(kind)) {
    drawFrame(x, y, w, h, wood);
    ctx.fillStyle = isAnthropic ? "#8d684b" : "#a37a51";
    ctx.fillRect(x + unit * 2, y + unit * 2, w - unit * 4, h - unit * 4);
    const stations = Math.max(1, Math.floor((major - unit * 4) / Math.max(64, minor * 1.55)));
    for (let station = 0; station < stations; station += 1) {
      const along = unit * 2 + (major - unit * 4) * (station + 0.5) / stations;
      const point = center(longCoordinate(along));
      const monitorWidth = horizontal ? Math.min(30, minor * 0.4) : Math.min(minor * 0.4, 30);
      const monitorHeight = Math.min(18, minor * 0.35);
      ctx.fillStyle = "#1f2c31";
      ctx.fillRect(point.x - monitorWidth / 2, point.y - monitorHeight / 2 - unit, monitorWidth, monitorHeight);
      ctx.fillStyle = screen;
      ctx.fillRect(point.x - monitorWidth / 2 + unit, point.y - monitorHeight / 2, Math.max(2, monitorWidth - unit * 2), Math.max(2, monitorHeight / 2));
      ctx.fillStyle = "#362f2a";
      if (horizontal) ctx.fillRect(point.x - monitorWidth / 2, point.y + monitorHeight / 2 + unit, monitorWidth, Math.max(2, unit / 2));
      else ctx.fillRect(point.x + monitorWidth / 2 + unit, point.y - monitorHeight / 2, Math.max(2, unit / 2), monitorHeight);
      ctx.fillStyle = palette.highlight;
      ctx.fillRect(point.x - unit / 2, point.y + monitorHeight / 2 + unit * 2, unit, unit);
    }
    const mark = artwork.brandMarks[isAnthropic ? "anthropicMark" : "openai"];
    if (mark?.complete && mark.naturalWidth && minor >= 50) {
      const markSize = Math.min(18, minor * 0.24);
      ctx.globalAlpha *= 0.8;
      ctx.drawImage(mark, x + w - markSize - unit * 2, y + h - markSize - unit * 2, markSize, markSize * mark.naturalHeight / mark.naturalWidth);
      ctx.globalAlpha = opacityValue(ctx.globalAlpha);
    }
    return;
  }

  drawFrame(x, y, w, h, palette.face);
  ctx.fillStyle = palette.dark;
  ctx.fillRect(x + unit * 2, y + unit * 2, w - unit * 4, h - unit * 4);
  const railCount = Math.max(2, Math.floor(major / 34));
  for (let rail = 1; rail < railCount; rail += 1) {
    const along = major * rail / railCount;
    ctx.fillStyle = rail % 2 ? palette.glass : palette.accent;
    if (horizontal) ctx.fillRect(x + along, y + unit * 2, unit / 2, h - unit * 4);
    else ctx.fillRect(x + unit * 2, y + along, w - unit * 4, unit / 2);
  }
}

function opacityValue(value) {
  return Math.min(1, value);
}

const workplacePropFrames = {
  openai: {
    desk: [0, 4], bench: [6, 7], pillar: [2], glass_pillar: [1],
    vent: [2], furnace: [2], obelisk: [2, 5], shelf: [3], trellis: [7],
    hedge: [7], flowerbed: [7], vault_core: [5], vault_rib: [0, 4],
    reliquary: [2], crystal: [2], vault_wall: [5], rift_wall: [0, 4, 7],
    rift_pillar: [2], rift_crystal: [2],
  },
  anthropic: {
    desk: [1, 4, 7], bench: [2, 5, 6], pillar: [3, 5], glass_pillar: [3],
    vent: [6], furnace: [6], obelisk: [5, 0], shelf: [0], trellis: [7],
    hedge: [3], flowerbed: [3], vault_core: [5], vault_rib: [1, 5],
    reliquary: [0], crystal: [3], vault_wall: [5], rift_wall: [0, 4, 7],
    rift_pillar: [3], rift_crystal: [3],
  },
  shared: {
    desk: [0, 7], bench: [4, 5], pillar: [1, 5], glass_pillar: [1],
    vent: [2], furnace: [2], obelisk: [2, 6], shelf: [3], trellis: [5],
    hedge: [5], flowerbed: [5], vault_core: [1], vault_rib: [0, 7],
    reliquary: [2], crystal: [2], vault_wall: [1], rift_wall: [0, 4, 7],
    rift_pillar: [2], rift_crystal: [3],
  },
};

const workplaceBarrierFrames = {
  openai: {
    desk: [3, 7], bench: [1, 5], pillar: [1, 5], glass_pillar: [0, 4],
    vent: [1, 5], furnace: [1, 5], obelisk: [1, 5], shelf: [0, 4],
    trellis: [6, 7], hedge: [6, 7], flowerbed: [6, 7], vault_core: [5],
    vault_rib: [0, 4], reliquary: [2, 5], crystal: [0, 4], vault_wall: [0, 4],
    rift_wall: [0, 4], rift_pillar: [1, 5], rift_crystal: [1, 5],
  },
  anthropic: {
    desk: [1, 3, 7], bench: [2, 3, 7], pillar: [0, 4], glass_pillar: [6],
    vent: [5], furnace: [5], obelisk: [2, 4], shelf: [0, 4],
    trellis: [4, 6], hedge: [4, 6, 7], flowerbed: [4, 7], vault_core: [2],
    vault_rib: [0, 4], reliquary: [2, 5], crystal: [6], vault_wall: [0, 4],
    rift_wall: [0, 4, 6], rift_pillar: [0, 4], rift_crystal: [6],
  },
};

function workplaceArtLab(biome) {
  if (biome === "office" || biome === "cinder") return "openai";
  if (["archive", "garden", "vault"].includes(biome)) return "anthropic";
  return "shared";
}

function drawWorkplaceProp(ctx, block, biome) {
  const lab = workplaceArtLab(biome);
  const sheet = artwork.props[lab];
  if (!sheet?.complete || !sheet.naturalWidth || !sheet.naturalHeight) return false;
  if (block.kind === "reflecting_pool") return false;
  const aspect = block.w / block.h;
  const compact = aspect >= 0.58 && aspect <= 1.72 && Math.min(block.w, block.h) >= 88;
  if (!compact) return false;
  const alternatives = workplacePropFrames[lab][block.kind] || [0];
  const choice = Math.abs(Math.floor((block.x * 7 + block.y * 11 + block.w * 3 + block.h) / 64)) % alternatives.length;
  const frame = alternatives[choice];
  const columns = 4;
  const rows = 2;
  const cellWidth = sheet.naturalWidth / columns;
  const cellHeight = sheet.naturalHeight / rows;
  const sourceX = (frame % columns) * cellWidth;
  const sourceY = Math.floor(frame / columns) * cellHeight;
  drawPixelOfficeObstacle(ctx, block, biome);
  ctx.save();
  ctx.beginPath();
  ctx.rect(block.x + 2, block.y + 2, block.w - 4, block.h - 4);
  ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.98;
  const targetSize = Math.min(block.w, block.h) - 8;
  const targetX = block.x + (block.w - targetSize) / 2;
  const targetY = block.y + (block.h - targetSize) / 2;
  ctx.drawImage(sheet, sourceX, sourceY, cellWidth, cellHeight, targetX, targetY, targetSize, targetSize);
  ctx.restore();
  return true;
}

function drawWorkplaceBarrier(ctx, block, biome) {
  const lab = workplaceArtLab(biome);
  const sheet = artwork.barriers[lab];
  const bounds = artwork.barrierBounds[lab];
  if (!sheet?.complete || !sheet.naturalWidth || !bounds || block.kind === "reflecting_pool") return false;
  const horizontal = block.w >= block.h;
  const longSide = Math.max(block.w, block.h);
  const shortSide = Math.min(block.w, block.h);
  if (longSide / shortSide < 2.25 || shortSide < 34) return false;
  const alternatives = workplaceBarrierFrames[lab]?.[block.kind] || [0, 3, 4, 7];
  const choice = Math.abs(Math.floor((block.x * 7 + block.y * 11 + block.w * 3 + block.h) / 64)) % alternatives.length;
  const columns = 4;
  const cellWidth = sheet.naturalWidth / columns;
  const cellHeight = sheet.naturalHeight / 2;
  const targetLength = longSide - 8;
  const targetThickness = shortSide - 8;
  if (targetThickness <= 0) return true;
  const tiles = [];
  let runLength = 0;
  while (runLength < targetLength && tiles.length < 20) {
    const frameIndex = alternatives[(choice + tiles.length) % alternatives.length];
    const frame = bounds[frameIndex];
    if (!frame?.width || !frame?.height) break;
    const tileLength = frame.width * targetThickness / frame.height;
    if (tileLength <= 0) break;
    tiles.push({ frameIndex, frame, tileLength });
    runLength += tileLength;
  }
  if (!tiles.length) return true;
  const mark = artwork.brandMarks[lab === "openai" ? "openai" : "anthropicMark"];

  const palette = pixelObstaclePalette(biome);
  const base = lab === "openai" ? "#25373c" : "#4c4036";
  ctx.fillStyle = "rgba(5, 9, 12, 0.42)";
  ctx.fillRect(block.x + 5, block.y + 6, block.w - 1, block.h - 1);
  ctx.fillStyle = palette.edge;
  ctx.fillRect(block.x, block.y, block.w, block.h);
  ctx.fillStyle = base;
  ctx.fillRect(block.x + 3, block.y + 3, block.w - 6, block.h - 6);
  ctx.fillStyle = palette.highlight;
  if (horizontal) ctx.fillRect(block.x + 5, block.y + 4, block.w - 10, 2);
  else ctx.fillRect(block.x + 4, block.y + 5, 2, block.h - 10);

  ctx.save();
  ctx.beginPath();
  ctx.rect(block.x + 2, block.y + 2, block.w - 4, block.h - 4);
  ctx.clip();
  ctx.translate(block.x + block.w / 2, block.y + block.h / 2);
  if (!horizontal) ctx.rotate(Math.PI / 2);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.98;
  let tileX = -targetLength / 2;
  for (const { frameIndex, frame, tileLength } of tiles) {
    const sourceX = (frameIndex % columns) * cellWidth + frame.x;
    const sourceY = Math.floor(frameIndex / columns) * cellHeight + frame.y;
    ctx.drawImage(
      sheet,
      sourceX, sourceY, frame.width, frame.height,
      tileX, -targetThickness / 2, tileLength, targetThickness,
    );
    tileX += tileLength;
  }
  if (mark?.complete && mark.naturalWidth > 0) {
    const markSize = Math.min(16, targetThickness * 0.24);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(
      mark,
      -markSize / 2, -markSize / 2,
      markSize, markSize * mark.naturalHeight / mark.naturalWidth,
    );
  }
  ctx.restore();
  return true;
}

function drawObstacle(ctx, source) {
  ctx.save();
  let block = source;
  if (source.angle) {
    ctx.translate(source.x + source.w / 2, source.y + source.h / 2);
    ctx.rotate(source.angle);
    block = { ...source, x: -source.w / 2, y: -source.h / 2, angle: 0 };
  }
  if (!drawWorkplaceProp(ctx, block, game.level.biome) && !drawWorkplaceBarrier(ctx, block, game.level.biome)) {
    drawPixelOfficeObstacle(ctx, block, game.level.biome);
  }
  ctx.restore();
}

function drawDepthSortedArena(ctx) {
  const renderables = blocks.map((block) => ({
    depth: block.y + block.h,
    draw: () => drawObstacle(ctx, block),
  }));
  renderables.push(
    { depth: game.jev.y + 60, draw: () => drawJev(ctx) },
    { depth: game.player.y + 66, draw: () => drawPlayer(ctx) },
  );
  renderables.sort((left, right) => left.depth - right.depth);
  for (const renderable of renderables) renderable.draw();
}

function drawBlocks(ctx) {
  for (const source of blocks) {
    drawObstacle(ctx, source);
  }
}

function drawRoundObstacle(ctx, block) {
  const { x, y, w, h } = block;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const palette = {
    garden: ["#315b59", "#102a31", "#9fe0d1"],
    vault: ["#65517b", "#2b2441", "#f1d393"],
    rift: ["#5d4c76", "#181c35", "#e6a5ff"],
  }[game.level.biome] || ["#5c4e66", "#241f2f", "#dab5ed"];
  const surface = ctx.createRadialGradient(cx - rx * 0.35, cy - ry * 0.38, 4, cx, cy, Math.max(rx, ry));
  surface.addColorStop(0, palette[0]);
  surface.addColorStop(0.62, palette[1]);
  surface.addColorStop(1, "#111620");
  ctx.fillStyle = surface;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = palette[2];
  ctx.globalAlpha = 0.72;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.84, ry * 0.84, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.38;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.65, ry * 0.65, 0, 0.24, Math.PI * 1.84);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (block.kind === "reflecting_pool") {
    ctx.fillStyle = "rgb(127 219 207 / 27%)";
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.2, cy - ry * 0.14, rx * 0.34, ry * 0.16, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgb(202 249 224 / 52%)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 5, rx * 0.38, ry * 0.19, -0.12, 0.2, Math.PI * 1.75);
    ctx.stroke();
  } else {
    ctx.fillStyle = palette[2];
    ctx.shadowColor = palette[2];
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(rx, ry) * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGardenObstacle(ctx, block) {
  const { x, y, w, h } = block;
  if (block.kind === "hedge") {
    const hedge = ctx.createLinearGradient(x, y, x, y + h);
    hedge.addColorStop(0, "#628c66");
    hedge.addColorStop(0.22, "#345c4d");
    hedge.addColorStop(1, "#19352f");
    ctx.fillStyle = hedge;
    ctx.beginPath();
    ctx.roundRect(x, y + 5, w, h, Math.min(16, h / 3));
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 2, y, w - 4, h - 4, Math.min(15, h / 3));
    ctx.clip();
    for (let leafX = x + 12; leafX < x + w; leafX += 23) {
      const leafY = y + 12 + ((Math.floor((leafX - x) / 23) % 2) * 9);
      ctx.fillStyle = Math.floor(leafX / 23) % 2 ? "#6c9b6d" : "#4d805e";
      ctx.beginPath();
      ctx.ellipse(leafX, leafY, 13, 11, 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgb(210 230 159 / 50%)";
      ctx.beginPath();
      ctx.arc(leafX - 3, leafY - 4, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = "rgb(190 224 157 / 62%)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x + 1, y + 1, w - 2, h - 7, Math.min(15, h / 3));
    ctx.stroke();
    return;
  }
  if (block.kind === "trellis") {
    ctx.fillStyle = "#473a35";
    ctx.beginPath();
    ctx.roundRect(x, y + 5, w, h, 7);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 5, y + 4, w - 10, h - 10, 4);
    ctx.clip();
    ctx.strokeStyle = "#9c7953";
    ctx.lineWidth = 5;
    for (let lattice = -h; lattice < w + h; lattice += 38) {
      ctx.beginPath();
      ctx.moveTo(x + lattice, y);
      ctx.lineTo(x + lattice + h, y + h);
      ctx.moveTo(x + lattice, y + h);
      ctx.lineTo(x + lattice + h, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgb(162 220 135 / 86%)";
    ctx.lineWidth = 2;
    for (let leafX = x + 30; leafX < x + w; leafX += 92) {
      ctx.beginPath();
      ctx.ellipse(leafX, y + h / 2, 8, 4, -0.6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  if (block.kind === "flowerbed") {
    ctx.fillStyle = "#263c34";
    ctx.beginPath();
    ctx.roundRect(x, y + 5, w, h, 12);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#86a375";
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let flower = 0; flower < 5; flower += 1) {
      const flowerX = x + 18 + flower * (w - 36) / 4;
      const flowerY = y + h * (0.35 + (flower % 2) * 0.22);
      ctx.strokeStyle = "#85a77d";
      ctx.beginPath();
      ctx.moveTo(flowerX, flowerY + 10);
      ctx.lineTo(flowerX + 2, flowerY);
      ctx.stroke();
      ctx.fillStyle = ["#d5bd82", "#b8a0d3", "#c791a3"][flower % 3];
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.arc(flowerX + 2, flowerY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  const glass = ctx.createLinearGradient(x, y, x + w, y + h);
  glass.addColorStop(0, "#c0e5d4");
  glass.addColorStop(0.35, "#496b69");
  glass.addColorStop(1, "#1c3439");
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.roundRect(x, y + 5, w, h, 12);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#b9e7d6";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgb(228 255 227 / 46%)";
  ctx.fillRect(x + w * 0.28, y + 12, 3, h - 23);
}

function drawVaultObstacle(ctx, block) {
  const { x, y, w, h } = block;
  const stone = ctx.createLinearGradient(x, y, x + w, y + h);
  stone.addColorStop(0, "#71617b");
  stone.addColorStop(0.38, "#413951");
  stone.addColorStop(1, "#28263c");
  ctx.fillStyle = stone;
  ctx.beginPath();
  ctx.roundRect(x, y + 5, w, h, 9);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgb(223 190 142 / 72%)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "rgb(206 182 237 / 30%)";
  ctx.lineWidth = 1;
  for (let xLine = x + 20; xLine < x + w - 8; xLine += 44) {
    ctx.beginPath();
    ctx.moveTo(xLine, y + 9);
    ctx.lineTo(xLine + 12, y + h - 8);
    ctx.stroke();
  }
  ctx.fillStyle = "#f2d390";
  ctx.shadowColor = "#f2d390";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, 2.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawRiftObstacle(ctx, block) {
  const { x, y, w, h } = block;
  const rock = ctx.createLinearGradient(x, y, x + w, y + h);
  rock.addColorStop(0, "#6a597b");
  rock.addColorStop(0.45, "#37344f");
  rock.addColorStop(1, "#20243d");
  ctx.fillStyle = rock;
  ctx.beginPath();
  if (block.kind === "rift_crystal") {
    ctx.moveTo(x + w * 0.08, y + h * 0.48);
    ctx.lineTo(x + w * 0.27, y + h * 0.08);
    ctx.lineTo(x + w * 0.87, y + h * 0.18);
    ctx.lineTo(x + w * 0.98, y + h * 0.63);
    ctx.lineTo(x + w * 0.71, y + h * 0.93);
    ctx.lineTo(x + w * 0.16, y + h * 0.82);
    ctx.closePath();
  } else {
    ctx.roundRect(x, y + 5, w, h, 8);
  }
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgb(229 160 251 / 78%)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "rgb(163 135 255 / 54%)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.17, y + h * 0.72);
  ctx.lineTo(x + w * 0.4, y + h * 0.44);
  ctx.lineTo(x + w * 0.55, y + h * 0.57);
  ctx.lineTo(x + w * 0.79, y + h * 0.22);
  ctx.stroke();
}

function drawCinderObstacle(ctx, block) {
  const x = block.x;
  const y = block.y;
  const { w, h } = block;
  const stone = ctx.createLinearGradient(x, y, x + w, y + h);
  stone.addColorStop(0, block.kind === "furnace" ? "#594047" : "#47333b");
  stone.addColorStop(1, "#241d27");
  ctx.fillStyle = stone;
  ctx.beginPath();
  ctx.roundRect(x, y + 4, w, h, block.kind === "obelisk" ? 16 : 10);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgb(244 156 102 / 58%)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = "rgb(16 12 19 / 76%)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 12, w - 16, h - 16, 7);
  ctx.stroke();
  ctx.strokeStyle = "rgb(255 154 82 / 55%)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (block.kind === "obelisk" || block.kind === "pillar") {
    ctx.moveTo(x + w * 0.33, y + h * 0.17);
    ctx.lineTo(x + w * 0.52, y + h * 0.39);
    ctx.lineTo(x + w * 0.42, y + h * 0.61);
    ctx.lineTo(x + w * 0.59, y + h * 0.83);
  } else {
    ctx.moveTo(x + w * 0.16, y + h * 0.68);
    ctx.lineTo(x + w * 0.34, y + h * 0.46);
    ctx.lineTo(x + w * 0.52, y + h * 0.59);
    ctx.lineTo(x + w * 0.76, y + h * 0.27);
  }
  ctx.stroke();
  if (block.kind === "vent" || block.kind === "furnace") {
    ctx.fillStyle = "rgb(255 147 79 / 30%)";
    ctx.shadowColor = "#f07645";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2 + 3, Math.min(w, h) * 0.29, Math.min(w, h) * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffc27d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.32, y + h * 0.51);
    ctx.lineTo(x + w * 0.68, y + h * 0.51);
    ctx.stroke();
  }
}

function drawArchiveShelf(ctx, block) {
  const { x, y, w, h } = block;
  ctx.fillStyle = "#263c42";
  ctx.beginPath();
  ctx.roundRect(x, y + 4, w, h, 5);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#8ab9ae";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#10242d";
  ctx.fillRect(x + 7, y + 8, w - 14, h - 14);
  const covers = ["#a66c66", "#bd9a68", "#618a84", "#877092", "#82989a", "#b7785b"];
  let bookX = x + 12;
  let book = 0;
  while (bookX < x + w - 14) {
    const width = 8 + (book % 3) * 2;
    ctx.fillStyle = covers[book % covers.length];
    ctx.fillRect(bookX, y + 11 + book % 2, width, h - 21 - book % 3 * 2);
    ctx.fillStyle = "rgb(234 221 185 / 42%)";
    ctx.fillRect(bookX + 2, y + 14 + book % 2, 1, h - 28);
    bookX += width + 3;
    book += 1;
  }
  ctx.fillStyle = "#a3c8b9";
  ctx.fillRect(x + 4, y + h - 8, w - 8, 4);
}

function drawCompanyMark(ctx, skin, x, y, size) {
  const image = artwork.brandMarks[skin.company === "Anthropic" ? "anthropicMark" : "openai"];
  if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return;
  const width = size;
  const height = size * image.naturalHeight / image.naturalWidth;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
  ctx.restore();
}

function drawParticles(ctx) {
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    if (particle.company === "OpenAI") {
      const size = particle.size * 1.45;
      ctx.fillRect(particle.x - size / 2, particle.y - size / 2, size, size);
      ctx.fillRect(particle.x + size * 0.8, particle.y - size * 0.2, size * 0.45, size * 0.45);
    } else if (particle.company === "Anthropic") {
      ctx.beginPath();
      ctx.moveTo(particle.x, particle.y - particle.size * 1.7);
      ctx.lineTo(particle.x + particle.size * 0.58, particle.y);
      ctx.lineTo(particle.x, particle.y + particle.size * 1.7);
      ctx.lineTo(particle.x - particle.size * 0.58, particle.y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawLabProjectile(ctx, projectile, skin) {
  const anthropic = skin.company === "Anthropic";
  const scale = projectile.kind === "salvo" ? 0.76 : projectile.owner === "player" ? 0.72 : 1;
  const radius = Math.max(7, projectile.radius * scale);
  const accent = skin.accent;
  const pale = anthropic ? "#fff1d7" : "#e4fff6";
  const angle = Math.atan2(projectile.vy, projectile.vx);
  const pulse = 0.94 + Math.sin(projectile.age * 24) * 0.06;
  ctx.save();
  ctx.translate(projectile.x, projectile.y);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowColor = accent;
  ctx.shadowBlur = projectile.owner === "jev" ? 19 : 12;
  ctx.lineCap = "round";
  if (anthropic) {
    ctx.strokeStyle = "rgb(242 154 104 / 76%)";
    for (let ray = -1; ray <= 1; ray += 1) {
      const offset = ray * radius * 0.48;
      ctx.lineWidth = ray === 0 ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(-radius * 3.3, offset * 0.42);
      ctx.quadraticCurveTo(-radius * 1.5, offset * 0.6, -radius * 0.35, offset * 0.26);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgb(255 211 159 / 86%)";
    ctx.lineWidth = 1.5;
    for (let ray = 0; ray < 9; ray += 1) {
      const rayAngle = ray * Math.PI * 2 / 9 + projectile.age * 1.8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(rayAngle) * radius * 0.72, Math.sin(rayAngle) * radius * 0.72);
      ctx.lineTo(Math.cos(rayAngle) * radius * (ray % 3 === 0 ? 1.62 : 1.3), Math.sin(rayAngle) * radius * (ray % 3 === 0 ? 1.62 : 1.3));
      ctx.stroke();
    }
    ctx.strokeStyle = "rgb(255 219 172 / 76%)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(-1, 0, radius * 1.18, radius * 0.72, projectile.age * -1.6, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "rgb(121 228 207 / 88%)";
    for (let rail = -1; rail <= 1; rail += 1) {
      const offset = rail * radius * 0.5;
      ctx.lineWidth = rail === 0 ? 3.5 : 1.7;
      ctx.beginPath();
      ctx.moveTo(-radius * 3.4, offset);
      ctx.lineTo(-radius * 1.7, offset);
      ctx.lineTo(-radius * 0.46, offset * 0.35);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgb(166 255 226 / 92%)";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.ellipse(-2, 0, radius * 1.18, radius * 0.76, projectile.age * 1.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let node = 0; node < 4; node += 1) {
      const nodeAngle = node * Math.PI / 2 + projectile.age * 2.2;
      const nodeX = Math.cos(nodeAngle) * radius * 1.05 - 2;
      const nodeY = Math.sin(nodeAngle) * radius * 0.7;
      ctx.fillStyle = pale;
      ctx.fillRect(nodeX - 1.7, nodeY - 1.7, 3.4, 3.4);
    }
  }
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = anthropic ? "#e58a5f" : "#6edac0";
  ctx.beginPath();
  ctx.arc(0, 0, radius * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pale;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.64, 0, Math.PI * 2);
  ctx.fill();
  drawCompanyMark(ctx, skin, 0, 0, Math.min(radius * 0.88, 13));
  ctx.restore();
}

function drawCompanyShockwave(ctx, x, y, progress, skin, maxRadius = 128) {
  const anthropic = skin.company === "Anthropic";
  const radius = 20 + progress * maxRadius;
  const alpha = 1 - progress;
  ctx.save();
  ctx.globalAlpha = alpha * 0.9;
  ctx.strokeStyle = skin.accent;
  ctx.shadowColor = skin.accent;
  ctx.shadowBlur = 15 * (1 - progress);
  ctx.lineWidth = Math.max(1.3, 4 * (1 - progress));
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  if (anthropic) {
    for (let ray = 0; ray < 12; ray += 1) {
      const angle = ray * Math.PI / 6 + game.elapsed * 0.22;
      const start = radius - (ray % 3 === 0 ? 4 : 1);
      const end = radius + (ray % 3 === 0 ? 12 : 7);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * start, y + Math.sin(angle) * start);
      ctx.lineTo(x + Math.cos(angle) * end, y + Math.sin(angle) * end);
      ctx.stroke();
    }
  } else {
    for (let node = 0; node < 6; node += 1) {
      const angle = node * Math.PI / 3 + game.elapsed * 0.38;
      const nodeX = x + Math.cos(angle) * radius;
      const nodeY = y + Math.sin(angle) * radius;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * (radius - 9), y + Math.sin(angle) * (radius - 9));
      ctx.lineTo(nodeX, nodeY);
      ctx.stroke();
      ctx.fillStyle = "#dffff5";
      ctx.fillRect(nodeX - 2.2, nodeY - 2.2, 4.4, 4.4);
    }
  }
  ctx.restore();
}

function drawProjectiles(ctx) {
  for (const projectile of game.projectiles) {
    const role = projectile.owner === "player" ? "runner" : "chaser";
    const skin = skinCatalog[projectile.skinId] || skinForRole(role);
    drawLabProjectile(ctx, projectile, skin);
  }
}

function contactFacing(angle) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy < 0 ? "up" : "down";
}

function drawContactStrike(ctx) {
  const strike = game.jev.contactStrike;
  if (!strike) return;
  const age = game.elapsed - strike.at;
  const duration = 0.38;
  if (age < 0 || age > duration) return;
  const progress = clamp(age / duration, 0, 1);
  const fade = 1 - progress;
  const skin = skinForRole("chaser");
  const accent = skin.accent;
  ctx.save();
  ctx.translate(strike.x, strike.y - 12);
  ctx.rotate(strike.angle);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = fade * 0.92;
  ctx.strokeStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 14;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (skin.company === "Anthropic") {
    ctx.lineWidth = 8 * fade + 1.8;
    for (let claw = -1; claw <= 1; claw += 1) {
      const offset = claw * 10;
      ctx.beginPath();
      ctx.moveTo(20, offset - 8);
      ctx.quadraticCurveTo(47, offset - 28, 78, offset - 7);
      ctx.stroke();
    }
    ctx.strokeStyle = "#fff0df";
    ctx.lineWidth = 4 * fade + 1.2;
    ctx.beginPath();
    ctx.moveTo(24, -5);
    ctx.quadraticCurveTo(47, -22, 79, -3);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(64, 0, 18 + progress * 15, -0.9, 0.9);
    ctx.stroke();
  } else {
    ctx.lineWidth = 8 * fade + 1.8;
    for (let claw = -1; claw <= 1; claw += 1) {
      const offset = claw * 10;
      ctx.beginPath();
      ctx.moveTo(20, offset - 9);
      ctx.lineTo(41, offset - 6);
      ctx.lineTo(62 + progress * 16, offset + 8);
      ctx.stroke();
    }
    ctx.strokeStyle = "#e9fff8";
    ctx.lineWidth = 4 * fade + 1.2;
    ctx.beginPath();
    ctx.moveTo(23, -5);
    ctx.lineTo(44, -1);
    ctx.lineTo(70 + progress * 12, 5);
    ctx.stroke();
    ctx.strokeStyle = accent;
    ctx.fillStyle = accent;
    for (let node = 0; node < 3; node += 1) {
      const x = 70 + progress * 12 + node * 5;
      const y = (node - 1) * 12;
      ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
    }
  }
  ctx.restore();

  const markX = strike.outcome === "parried" ? (strike.x + strike.targetX) / 2 : strike.targetX;
  const markY = strike.outcome === "parried" ? (strike.y + strike.targetY) / 2 : strike.targetY;
  const markColor = strike.outcome === "parried" ? skinForRole("runner").accent : accent;
  ctx.save();
  ctx.globalAlpha = fade * 0.86;
  ctx.strokeStyle = markColor;
  ctx.fillStyle = strike.outcome === "parried" ? "rgba(244, 255, 247, 0.22)" : "rgba(255, 246, 227, 0.28)";
  ctx.shadowColor = markColor;
  ctx.shadowBlur = 18;
  ctx.lineWidth = strike.outcome === "parried" ? 3 : 2.5;
  const radius = 20 + progress * 22;
  ctx.beginPath();
  ctx.arc(markX, markY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (strike.outcome === "parried") {
    ctx.beginPath();
    ctx.moveTo(markX - radius * 0.6, markY - radius * 0.6);
    ctx.lineTo(markX + radius * 0.6, markY + radius * 0.6);
    ctx.moveTo(markX + radius * 0.6, markY - radius * 0.6);
    ctx.lineTo(markX - radius * 0.6, markY + radius * 0.6);
    ctx.stroke();
  } else {
    for (let ray = 0; ray < 4; ray += 1) {
      const angle = strike.angle + ray * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(markX + Math.cos(angle) * (radius + 3), markY + Math.sin(angle) * (radius + 3));
      ctx.lineTo(markX + Math.cos(angle) * (radius + 9), markY + Math.sin(angle) * (radius + 9));
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawTacticalEffects(ctx) {
  drawContactStrike(ctx);
  const jev = game.jev;
  if (game.player.hookTarget) {
    const hook = game.player.hookTarget;
    ctx.save();
    ctx.globalAlpha = clamp(hook.life / 0.22, 0, 1);
    ctx.strokeStyle = "#d7b1ff";
    ctx.shadowColor = "#bb89f4";
    ctx.shadowBlur = 15;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(hook.x, hook.y);
    ctx.lineTo(hook.endX, hook.endY);
    ctx.stroke();
    ctx.restore();
  }
  for (const meteor of game.meteors) {
    const pulse = 0.78 + Math.sin(game.elapsed * 21) * 0.12;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "rgb(255 111 84 / 11%)";
    ctx.strokeStyle = "#ffb477";
    ctx.shadowColor = "#ff764f";
    ctx.shadowBlur = 18;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.arc(meteor.x, meteor.y, meteor.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(meteor.x - 13, meteor.y);
    ctx.lineTo(meteor.x + 13, meteor.y);
    ctx.moveTo(meteor.x, meteor.y - 13);
    ctx.lineTo(meteor.x, meteor.y + 13);
    ctx.stroke();
    ctx.restore();
  }
  for (const impact of game.meteorImpacts) {
    const progress = 1 - impact.life / impact.maxLife;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = "#ff956d";
    ctx.lineWidth = 4 * (1 - progress) + 1;
    ctx.beginPath();
    ctx.arc(impact.x, impact.y, impact.radius * (0.42 + progress * 0.72), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (jev.shadowDodgePhase === "windup" && jev.shadowDodgeTarget) {
    const pulse = 0.5 + Math.sin(game.elapsed * 31) * 0.18;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = "#8fead3";
    ctx.fillStyle = "rgb(143 234 211 / 12%)";
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.moveTo(jev.x, jev.y);
    ctx.lineTo(jev.shadowDodgeTarget.x, jev.shadowDodgeTarget.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(jev.shadowDodgeTarget.x, jev.shadowDodgeTarget.y, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  if (jev.riftRushPhase === "windup" && jev.riftRushTarget) {
    const pulse = 0.36 + Math.sin(game.elapsed * 30) * 0.12;
    const skin = skinForRole("chaser");
    const anthropic = skin.company === "Anthropic";
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = anthropic ? "#f29a68" : "#79e4cf";
    ctx.fillStyle = anthropic ? "rgb(242 154 104 / 10%)" : "rgb(121 228 207 / 10%)";
    ctx.lineWidth = 2.5;
    const rushDx = jev.riftRushTarget.x - jev.x;
    const rushDy = jev.riftRushTarget.y - jev.y;
    const rushLength = Math.hypot(rushDx, rushDy) || 1;
    const normalX = -rushDy / rushLength;
    const normalY = rushDx / rushLength;
    for (const rail of anthropic ? [-0.07, 0, 0.07] : [-0.045, 0, 0.045]) {
      const endX = jev.riftRushTarget.x + normalX * rushLength * rail;
      const endY = jev.riftRushTarget.y + normalY * rushLength * rail;
      ctx.beginPath();
      ctx.moveTo(jev.x, jev.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(jev.riftRushTarget.x, jev.riftRushTarget.y, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = anthropic ? "#fff0d9" : "#e4fff6";
    ctx.beginPath();
    ctx.arc(jev.riftRushTarget.x, jev.riftRushTarget.y, 8, 0, Math.PI * 2);
    ctx.fill();
    drawCompanyMark(ctx, skin, jev.riftRushTarget.x, jev.riftRushTarget.y, 12);
    ctx.restore();
  } else if (jev.riftRushPhase === "charge") {
    const skin = skinForRole("chaser");
    const anthropic = skin.company === "Anthropic";
    const trailStartX = jev.x - jev.riftRushVx * 0.34;
    const trailStartY = jev.y - jev.riftRushVy * 0.34;
    const rushSpeed = Math.hypot(jev.riftRushVx, jev.riftRushVy) || 1;
    const normalX = -jev.riftRushVy / rushSpeed;
    const normalY = jev.riftRushVx / rushSpeed;
    ctx.save();
    ctx.globalAlpha = 0.68;
    ctx.strokeStyle = skin.accent;
    ctx.shadowColor = skin.accent;
    ctx.shadowBlur = 19;
    ctx.lineCap = "round";
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(trailStartX, trailStartY);
    ctx.lineTo(jev.x, jev.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    for (const offset of anthropic ? [-10, 0, 10] : [-8, 0, 8]) {
      ctx.globalAlpha = offset === 0 ? 0.92 : 0.62;
      ctx.strokeStyle = anthropic ? (offset === 0 ? "#fff0d9" : "#f29a68") : (offset === 0 ? "#e4fff6" : "#79e4cf");
      ctx.lineWidth = offset === 0 ? 2.5 : 1.6;
      ctx.beginPath();
      ctx.moveTo(trailStartX + normalX * offset, trailStartY + normalY * offset);
      ctx.lineTo(jev.x + normalX * offset * 0.38, jev.y + normalY * offset * 0.38);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (jev.rendPhase === "windup") {
    const pulse = 0.72 + Math.sin(game.elapsed * 25) * 0.12;
    const startAngle = jev.rendAngle - RIFT_REND_HALF_ANGLE;
    const endAngle = jev.rendAngle + RIFT_REND_HALF_ANGLE;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "rgb(255 96 116 / 13%)";
    ctx.strokeStyle = "rgb(255 139 151 / 85%)";
    ctx.shadowColor = "#ff586f";
    ctx.shadowBlur = 22;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(jev.x, jev.y);
    ctx.arc(jev.x, jev.y, RIFT_REND_RANGE, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(jev.x, jev.y);
    ctx.lineTo(jev.x + Math.cos(jev.rendAngle) * RIFT_REND_RANGE, jev.y + Math.sin(jev.rendAngle) * RIFT_REND_RANGE);
    ctx.strokeStyle = "rgba(255, 232, 231, .78)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  if (game.rendSlash) {
    const progress = (game.elapsed - game.rendSlash.at) / game.rendSlash.duration;
    if (progress >= 1) game.rendSlash = null;
    else if (progress >= 0) {
      ctx.save();
      ctx.translate(game.rendSlash.x, game.rendSlash.y);
      ctx.rotate(game.rendSlash.angle);
      ctx.globalAlpha = (1 - progress) * 0.92;
      ctx.strokeStyle = "#ffd0d1";
      ctx.shadowColor = "#ff536e";
      ctx.shadowBlur = 26;
      ctx.lineWidth = 16 * (1 - progress) + 3;
      ctx.beginPath();
      ctx.arc(0, 0, RIFT_REND_RANGE * 0.72, -RIFT_REND_HALF_ANGLE * 0.9, RIFT_REND_HALF_ANGLE * 0.9);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255, 245, 239, .92)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    }
  }
  if (jev.blastPhase === "windup" && jev.blastTarget) {
    const pulse = 0.66 + Math.sin(game.elapsed * 28) * 0.2;
    const skin = skinForRole("chaser");
    const anthropic = skin.company === "Anthropic";
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = skin.accent;
    ctx.shadowColor = skin.accent;
    ctx.shadowBlur = 12;
    ctx.lineCap = "round";
    ctx.lineWidth = anthropic ? 6 : 4;
    ctx.beginPath();
    ctx.moveTo(jev.x, jev.y - 5);
    ctx.lineTo(jev.blastTarget.x, jev.blastTarget.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
    const targetRadius = 25 + Math.sin(game.elapsed * 28) * 3;
    ctx.fillStyle = anthropic ? "rgb(242 154 104 / 17%)" : "rgb(121 228 207 / 17%)";
    ctx.strokeStyle = anthropic ? "#ffd29e" : "#c8fff0";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(jev.blastTarget.x, jev.blastTarget.y, targetRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (anthropic) {
      for (let ray = 0; ray < 9; ray += 1) {
        const angle = ray * Math.PI * 2 / 9 + game.elapsed * 0.4;
        ctx.beginPath();
        ctx.moveTo(jev.blastTarget.x + Math.cos(angle) * targetRadius, jev.blastTarget.y + Math.sin(angle) * targetRadius);
        ctx.lineTo(jev.blastTarget.x + Math.cos(angle) * (targetRadius + (ray % 3 === 0 ? 10 : 5)), jev.blastTarget.y + Math.sin(angle) * (targetRadius + (ray % 3 === 0 ? 10 : 5)));
        ctx.stroke();
      }
    } else {
      for (let node = 0; node < 4; node += 1) {
        const angle = node * Math.PI / 2 + game.elapsed * 0.55;
        const nodeX = jev.blastTarget.x + Math.cos(angle) * targetRadius;
        const nodeY = jev.blastTarget.y + Math.sin(angle) * targetRadius;
        ctx.fillStyle = "#e4fff6";
        ctx.fillRect(nodeX - 2.5, nodeY - 2.5, 5, 5);
      }
    }
    ctx.restore();
  }
  if (jev.salvoPhase === "windup" && jev.salvoTarget) {
    const pulse = 0.56 + Math.sin(game.elapsed * 24) * 0.16;
    const centerAngle = Math.atan2(jev.salvoTarget.y - jev.y, jev.salvoTarget.x - jev.x);
    const skin = skinForRole("chaser");
    const anthropic = skin.company === "Anthropic";
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = skin.accent;
    ctx.shadowColor = skin.accent;
    ctx.shadowBlur = 12;
    ctx.lineCap = "round";
    ctx.lineWidth = 2.5;
    for (const offset of anthropic ? [-0.27, 0, 0.27] : [-0.21, 0, 0.21]) {
      const angle = centerAngle + offset;
      ctx.beginPath();
      ctx.moveTo(jev.x, jev.y - 5);
      ctx.lineTo(jev.x + Math.cos(angle) * 760, jev.y + Math.sin(angle) * 760);
      ctx.stroke();
    }
    for (const angle of [centerAngle - 0.21, centerAngle, centerAngle + 0.21]) {
      ctx.fillStyle = anthropic ? "#fff0d9" : "#e4fff6";
      ctx.beginPath();
      ctx.arc(jev.x + Math.cos(angle) * 30, jev.y + Math.sin(angle) * 30 - 5, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  const mine = game.activeMine;
  if (mine) {
    const warning = mine.warning > 0;
    const pulse = warning ? 0.55 + Math.sin(game.elapsed * 20) * 0.22 : 0.8;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = warning ? "rgb(196 122 255 / 10%)" : "rgb(190 125 234 / 22%)";
    ctx.strokeStyle = warning ? "#e0a4ff" : "#d99ef3";
    ctx.lineWidth = warning ? 2 : 3;
    ctx.setLineDash(warning ? [5, 6] : []);
    ctx.beginPath();
    ctx.arc(mine.x, mine.y, mine.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(mine.x, mine.y, 21 + Math.sin(game.elapsed * 13) * 2, -Math.PI / 3, Math.PI * 1.2);
    ctx.stroke();
    ctx.restore();
  }
}

function spriteDirectionFor(entity) {
  const vx = Number(entity.vx) || 0;
  const vy = Number(entity.vy) || 0;
  if (Math.hypot(vx, vy) > 35) {
    entity.spriteDirection = Math.abs(vx) >= Math.abs(vy)
      ? vx < 0 ? "left" : "right"
      : vy < 0 ? "up" : "down";
  }
  if (!entity.spriteDirection) entity.spriteDirection = entity.facing < 0 ? "left" : "right";
  return entity.spriteDirection;
}

function drawSpriteFrame(ctx, sheet, skinId, direction, row, x, y, width, height) {
  const layout = companionSpriteCatalog[skinId] || skinCatalog[skinId];
  const columns = layout?.columns ?? 4;
  const rows = layout?.rows ?? layout?.spriteRows ?? 3;
  const frameWidth = sheet.naturalWidth / columns;
  const frameHeight = sheet.naturalHeight / rows;
  const directionColumns = { down: 0, left: 1, right: 2, up: 3 };
  const companion = Object.hasOwn(companionSpriteCatalog, skinId);
  const mirrorLeftProfile = layout?.mirrorLeftProfile && direction === "left";
  const flipMascot = companion && direction === "left";
  // The mascot profile cells read like cropped art at gameplay scale; keep their full face visible.
  const horizontalMascot = companion && (direction === "left" || direction === "right");
  const sourceColumn = horizontalMascot
    ? layout.horizontalFrameColumn
    : mirrorLeftProfile ? directionColumns.right : directionColumns[direction] ?? directionColumns.down;
  const sourceRow = clamp(Math.floor(row), 0, rows - 1);
  const sourceX = sourceColumn * frameWidth;
  const sourceY = sourceRow * frameHeight;
  const skin = skinCatalog[skinId];
  const autoContent = skin?.normalizeSpriteFrames ? artwork.spriteBounds[skinId]?.[sourceRow]?.[sourceColumn] : null;
  const manualContent = skin?.spriteFrameBounds?.[sourceRow]?.[sourceColumn];
  const content = manualContent ?? (autoContent ? [autoContent.x, autoContent.y, autoContent.width, autoContent.height] : null);
  const padding = autoContent ? 0 : content ? 2 : 0;
  const cropX = content ? Math.max(0, content[0] - padding) : 0;
  const cropY = content ? Math.max(0, content[1] - padding) : 0;
  const cropWidth = content ? Math.min(frameWidth - cropX, content[2] + padding * 2) : frameWidth;
  const cropHeight = content ? Math.min(frameHeight - cropY, content[3] + padding * 2) : frameHeight;
  const visualScale = skinCatalog[skinId]?.spriteVisualScale ?? 1;
  if (autoContent) {
    const contentScale = skin.frameSizeScale ?? 1;
    const fitScale = Math.min(
      height * visualScale * contentScale / cropHeight,
      width * visualScale * contentScale / cropWidth,
    );
    const drawWidth = cropWidth * fitScale;
    const drawHeight = cropHeight * fitScale;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(mirrorLeftProfile || flipMascot ? -1 : 1, 1);
    ctx.drawImage(
      sheet,
      sourceX + cropX, sourceY + cropY, cropWidth, cropHeight,
      -drawWidth / 2, height / 2 - drawHeight, drawWidth, drawHeight,
    );
    ctx.restore();
    return;
  }
  const scaledCellWidth = width * visualScale;
  const scaledCellHeight = height * visualScale;
  const cellLeft = -scaledCellWidth / 2;
  const cellTop = height / 2 - scaledCellHeight;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(mirrorLeftProfile || flipMascot ? -1 : 1, 1);
  ctx.drawImage(
    sheet,
    sourceX + cropX, sourceY + cropY, cropWidth, cropHeight,
    cellLeft + scaledCellWidth * (cropX / frameWidth),
    cellTop + scaledCellHeight * (cropY / frameHeight),
    scaledCellWidth * (cropWidth / frameWidth),
    scaledCellHeight * (cropHeight / frameHeight),
  );
  ctx.restore();
}

function drawJev(ctx) {
  const jev = game.jev;
  if (jev.health <= 0) return;
  const chaserSkin = skinForRole("chaser");
  const chaserSprite = spriteForRole("chaser");
  const contactAge = jev.contactStrike ? game.elapsed - jev.contactStrike.at : Infinity;
  const contactActive = contactAge >= 0 && contactAge < 0.3;
  const contactLunge = contactActive ? Math.sin(Math.PI * contactAge / 0.3) * 16 : 0;
  const drawX = contactActive ? jev.x + Math.cos(jev.contactStrike.angle) * contactLunge : jev.x;
  const bob = jev.stunned > 0 ? Math.sin(game.elapsed * 35) * 3 : Math.sin(game.elapsed * 12) * 1.5;
  if (jev.riftAegisTimer > 0 && jev.riftAegisCharges > 0) {
    const pulse = 0.72 + Math.sin(game.elapsed * 18) * 0.12;
    ctx.save();
    ctx.translate(jev.x, jev.y + bob);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = "rgba(117, 222, 232, 0.09)";
    ctx.strokeStyle = "#9ceaf0";
    ctx.shadowColor = "#66d7ea";
    ctx.shadowBlur = 24;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, 47, 43, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    for (let index = 0; index < jev.riftAegisCharges; index += 1) {
      ctx.fillStyle = "#d6ffff";
      ctx.beginPath();
      ctx.arc(-7 + index * 14, -48, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (chaserSprite?.complete && chaserSprite.naturalWidth > 0) {
    const modeColors = {
      pursue: "#f27d68", intercept: "#f4c774", flank: "#d69df0", ambush: "#a9dec8",
      rift_rend: "#ff7768", power_blast: "#ffc977", rift_mine: "#d69df0", rift_rush: "#dfa7ff",
      shadow_dodge: "#8fead3", soul_salvo: "#ff9c73", rift_aegis: "#9ceaf0",
    };
    const direction = contactActive ? contactFacing(jev.contactStrike.angle) : spriteDirectionFor(jev);
    const speed = Math.hypot(jev.vx, jev.vy);
    const runningProfile = !contactActive && speed > 35
      && Boolean(artwork.runFrames[chaserSkin.id]?.frames[direction]?.length);
    const runPose = profileRunPose(jev, chaserSkin.id, direction);
    const row = !contactActive && speed > 35 ? 1 + Math.floor((jev.spriteAnimationTime || 0) / 0.085) % 3 : 0;
    ctx.save();
    ctx.translate(drawX, jev.y + 10);
    const groundShadow = ctx.createRadialGradient(0, 23, 2, 0, 23, 37);
    groundShadow.addColorStop(0, "rgba(5, 4, 12, 0.6)");
    groundShadow.addColorStop(0.58, "rgba(5, 4, 12, 0.32)");
    groundShadow.addColorStop(1, "rgba(5, 4, 12, 0)");
    ctx.fillStyle = groundShadow;
    ctx.beginPath();
    ctx.ellipse(0, 23, 30, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = jev.stunned > 0 ? "#ffe08a" : jev.hurtTimer > 0 ? "#e3fff6" : modeColors[jev.mode] || modeColors.pursue;
    ctx.lineWidth = jev.stunned > 0 ? 3 : 2;
    ctx.globalAlpha = jev.stunned > 0 || jev.hurtTimer > 0 ? 0.95 : 0.66;
    ctx.beginPath();
    ctx.ellipse(0, 9, 43, 27, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (game.anchors.some((anchor) => anchor.health > 0)) {
      ctx.globalAlpha = 0.36 + Math.sin(game.elapsed * 7) * 0.08;
      ctx.strokeStyle = "#c5a9ff";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 8]);
      ctx.beginPath();
      ctx.ellipse(0, 5, 43, 36, 0, game.elapsed * 0.5, game.elapsed * 0.5 + Math.PI * 1.6);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    const nativeSideRun = runningProfile && chaserSkin.nativeSideRunMotion
      && (direction === "left" || direction === "right");
    const spriteY = jev.y + (nativeSideRun ? 0 : runningProfile && runPose === 2 ? -2 : bob);
    if (!runningProfile || !drawProfileRunFrame(ctx, chaserSkin.id, direction, runPose, drawX, spriteY, CHARACTER_SPRITE_WIDTH, CHARACTER_SPRITE_HEIGHT)) {
      drawSpriteFrame(ctx, chaserSprite, chaserSkin.id, direction, row, drawX, spriteY, CHARACTER_SPRITE_WIDTH, CHARACTER_SPRITE_HEIGHT);
    }
    if (jev.riftAegisTimer > 0 && jev.riftAegisCharges > 0) {
      ctx.save();
      ctx.globalAlpha = 0.84 + Math.sin(game.elapsed * 16) * 0.1;
      ctx.strokeStyle = "#b3f7fa";
      ctx.shadowColor = "#66d7ea";
      ctx.shadowBlur = 16;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([9, 7]);
      ctx.beginPath();
      ctx.ellipse(jev.x, jev.y + bob, 53, 49, 0, game.elapsed * 0.42, game.elapsed * 0.42 + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      for (let index = 0; index < jev.riftAegisCharges; index += 1) {
        ctx.fillStyle = "#e1ffff";
        ctx.beginPath();
        ctx.arc(jev.x - 7 + index * 14, jev.y - 53 + bob, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    return;
  }
  ctx.save();
  ctx.translate(drawX, jev.y + bob);
  ctx.scale(jev.facing || -1, 1);
  ctx.fillStyle = "rgb(7 5 12 / 42%)";
  ctx.beginPath();
  ctx.ellipse(0, 18, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  const modeColors = {
    pursue: "#f27d68",
    intercept: "#f4c774",
    flank: "#d69df0",
    ambush: "#a9dec8",
    rift_rend: "#ff7768",
    power_blast: "#ffc977",
    rift_mine: "#d69df0",
    rift_rush: "#dfa7ff",
    shadow_dodge: "#8fead3",
  };
  ctx.strokeStyle = jev.stunned > 0 ? "#ffe08a" : modeColors[jev.mode] || modeColors.pursue;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 25 + Math.sin(game.elapsed * 5) * 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#44354e";
  ctx.beginPath();
  ctx.moveTo(-16, 9); ctx.quadraticCurveTo(-22, 18, -15, 19); ctx.lineTo(15, 19); ctx.quadraticCurveTo(22, 18, 16, 9); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#d86f61";
  ctx.beginPath();
  ctx.moveTo(-12, -10); ctx.lineTo(-18, -28); ctx.quadraticCurveTo(-6, -25, -2, -11);
  ctx.quadraticCurveTo(5, -17, 12, -11); ctx.lineTo(19, -25); ctx.lineTo(18, -7);
  ctx.quadraticCurveTo(22, 10, 7, 13); ctx.lineTo(-7, 13); ctx.quadraticCurveTo(-21, 8, -12, -10);
  ctx.fill();
  ctx.strokeStyle = "#211b28"; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = "#352b3c";
  ctx.beginPath();
  ctx.moveTo(-12, -10); ctx.quadraticCurveTo(-7, -24, 5, -16); ctx.lineTo(13, -9); ctx.lineTo(7, -12); ctx.lineTo(1, -5); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#241e2e";
  ctx.beginPath(); ctx.ellipse(-5, 0, 2.7, 3.5, 0, 0, Math.PI * 2); ctx.ellipse(7, 0, 2.7, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff0d9";
  ctx.beginPath(); ctx.arc(-4, -1, 0.9, 0, Math.PI * 2); ctx.arc(8, -1, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#813f4d"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-3, 7); ctx.quadraticCurveTo(2, 4, 8, 7); ctx.stroke();
  ctx.fillStyle = "#f0e6d1";
  ctx.beginPath(); ctx.moveTo(-8, 13); ctx.lineTo(0, 20); ctx.lineTo(8, 13); ctx.lineTo(6, 21); ctx.lineTo(-6, 21); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx) {
  const player = game.player;
  const runnerSkin = skinForRole("runner");
  const runnerSprite = spriteForRole("runner");
  const direction = spriteDirectionFor(player);
  const heading = Math.atan2(player.vy, player.vx || 1);
  const dash = player.dashTimer > 0;
  if (player.afterimageTimer > 0) {
    ctx.save();
    ctx.globalAlpha = 0.22 + Math.sin(game.elapsed * 18) * 0.06;
    ctx.strokeStyle = runnerSkin.accent;
    ctx.shadowColor = runnerSkin.accent;
    ctx.shadowBlur = 23;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 5, 31, 39, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (player.guardTimer > 0) {
    ctx.save();
    ctx.globalAlpha = 0.55 + Math.sin(game.elapsed * 25) * 0.16;
    ctx.strokeStyle = "#baffea";
    ctx.shadowColor = "#80efd1";
    ctx.shadowBlur = 20;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 31 + Math.sin(game.elapsed * 18) * 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (dash) {
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = runnerSkin.accent;
    ctx.beginPath();
    ctx.ellipse(player.x - player.dashVx * 27, player.y - player.dashVy * 27, 17, 30, heading + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (player.hurtTimer > 0 && Math.floor(game.elapsed * 18) % 2 === 0) return;
  if (runnerSprite?.complete && runnerSprite.naturalWidth > 0) {
    const speed = Math.hypot(player.vx, player.vy);
      const runningProfile = speed > 35
        && Boolean(artwork.runFrames[runnerSkin.id]?.frames[direction]?.length);
      const runPose = profileRunPose(player, runnerSkin.id, direction);
      const row = speed > 35 ? 1 + Math.floor((player.spriteAnimationTime || 0) / 0.085) % 3 : 0;
    if (player.afterimageTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.32 * clamp(player.afterimageTimer / PHASE_AFTERIMAGE_DURATION, 0, 1);
      ctx.shadowColor = runnerSkin.accent;
      ctx.shadowBlur = 15;
      drawSpriteFrame(ctx, runnerSprite, runnerSkin.id, direction, 0, player.lastKnown.x, player.lastKnown.y, 92, 102);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(player.x, player.y + 11);
    const groundShadow = ctx.createRadialGradient(0, 21, 2, 0, 21, 33);
    groundShadow.addColorStop(0, "rgba(4, 5, 12, 0.62)");
    groundShadow.addColorStop(0.58, "rgba(4, 5, 12, 0.3)");
    groundShadow.addColorStop(1, "rgba(4, 5, 12, 0)");
    ctx.fillStyle = groundShadow;
    ctx.beginPath();
    ctx.ellipse(0, 21, 26, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    if (player.snaredTimer > 0) {
      ctx.strokeStyle = "rgb(217 158 243 / 88%)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 28 + Math.sin(game.elapsed * 20) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    const stretch = dash ? 1.08 : 1;
    ctx.save();
    ctx.globalAlpha = 1;
    const nativeSideRun = runningProfile && runnerSkin.nativeSideRunMotion
      && (direction === "left" || direction === "right");
    const spriteY = player.y + (nativeSideRun ? 0 : runningProfile && runPose === 2 ? -2 : Math.sin(game.elapsed * 9) * 1.5);
    if (!runningProfile || !drawProfileRunFrame(ctx, runnerSkin.id, direction, runPose, player.x, spriteY, CHARACTER_SPRITE_WIDTH * stretch, CHARACTER_SPRITE_HEIGHT / stretch)) {
      drawSpriteFrame(ctx, runnerSprite, runnerSkin.id, direction, row, player.x, spriteY, CHARACTER_SPRITE_WIDTH * stretch, CHARACTER_SPRITE_HEIGHT / stretch);
    }
    ctx.restore();
    if (player.pulseTimer > 0) {
      const progress = 1 - player.pulseTimer / 0.42;
      drawCompanyShockwave(ctx, player.x, player.y, progress, runnerSkin);
    }
    return;
  }
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.translate(player.x, player.y + Math.sin(game.elapsed * 9) * 1.5);
  if (player.snaredTimer > 0) {
    ctx.strokeStyle = "rgb(217 158 243 / 76%)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 26 + Math.sin(game.elapsed * 20) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "rgb(4 5 12 / 48%)";
  ctx.beginPath(); ctx.ellipse(0, 17, 17, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#a9c8d0";
  ctx.beginPath();
  ctx.moveTo(-15, -3); ctx.quadraticCurveTo(-17, -20, 0, -23); ctx.quadraticCurveTo(16, -20, 15, -2);
  ctx.lineTo(18, 12); ctx.quadraticCurveTo(12, 9, 7, 14); ctx.quadraticCurveTo(0, 8, -7, 14); ctx.quadraticCurveTo(-12, 9, -18, 13); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#eff6eb"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "#eaf2eb";
  ctx.beginPath(); ctx.ellipse(0, -4, 13, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#35434c";
  ctx.beginPath(); ctx.arc(-4, -5, 1.7, 0, Math.PI * 2); ctx.arc(5, -5, 1.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff4b9";
  ctx.beginPath(); ctx.arc(-3.5, -5.5, 0.6, 0, Math.PI * 2); ctx.arc(5.5, -5.5, 0.6, 0, Math.PI * 2); ctx.fill();
  if (player.pulseTimer > 0) {
    const progress = 1 - player.pulseTimer / 0.42;
    drawCompanyShockwave(ctx, 0, -Math.sin(game.elapsed * 9) * 1.5, progress, runnerSkin);
  }
  ctx.restore();
}

function drawCompanySkillSignature(ctx, actor, skin, progress, cell) {
  const phase = clamp(progress / 0.62, 0, 1);
  const alpha = (1 - phase) * 0.64;
  if (alpha <= 0) return;
  const radius = 44 + phase * 24;
  const seed = cell[0] + cell[1] * 4;
  ctx.save();
  ctx.translate(actor.x, actor.y);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = skin.accent;
  ctx.fillStyle = skin.accent;
  ctx.shadowColor = skin.accent;
  ctx.shadowBlur = 14;
  ctx.lineWidth = 2.2;
  if (skin.company === "OpenAI") {
    ctx.rotate(phase * 0.8 + seed * 0.12);
    ctx.setLineDash([4, 7]);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let node = 0; node < 4; node += 1) {
      const angle = node * Math.PI / 2 + Math.PI / 4;
      const inner = radius - 9;
      const outer = radius + 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
      ctx.fillRect(Math.cos(angle) * outer - 2.5, Math.sin(angle) * outer - 2.5, 5, 5);
    }
    ctx.beginPath();
    ctx.moveTo(-radius * 0.54, 0);
    ctx.lineTo(-radius * 0.27, -radius * 0.27);
    ctx.lineTo(0, 0);
    ctx.lineTo(radius * 0.27, radius * 0.27);
    ctx.lineTo(radius * 0.54, 0);
    ctx.stroke();
  } else {
    ctx.rotate(-phase * 0.58 + seed * 0.09);
    ctx.beginPath();
    ctx.arc(0, 0, radius - 5, -Math.PI * 0.82, Math.PI * 0.82);
    ctx.stroke();
    for (let ray = 0; ray < 9; ray += 1) {
      const angle = ray * Math.PI * 2 / 9;
      const inner = radius - 2;
      const outer = radius + (ray % 3 === 0 ? 9 : 4);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * outer, Math.sin(angle) * outer, ray % 3 === 0 ? 2.5 : 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawSkillCallouts(ctx) {
  if (!game.skillCallouts.length) return;
  game.skillCallouts = game.skillCallouts.filter((entry) => game.elapsed - entry.at < entry.duration);
  for (const entry of game.skillCallouts) {
    const actor = entry.owner === "jev" ? game.jev : game.player;
    const skill = skillManual[entry.owner].find((item) => item.id === entry.abilityId);
    const cell = skillIconCells[entry.abilityId];
    if (!skill || !cell) continue;
    const actorSkin = skinCatalog[entry.skinId] || skinForRole(entry.owner === "ghost" ? "runner" : "chaser");
    const progress = clamp((game.elapsed - entry.at) / entry.duration, 0, 1);
    const alpha = Math.min(1, (1 - progress) * 4.2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "700 12px Inter, ui-sans-serif, system-ui, sans-serif";
    const skillName = entry.skillName || brandedSkillName(skill, actorSkin);
    const textWidth = ctx.measureText(skillName).width;
    const boxWidth = textWidth + 45;
    const opponent = entry.owner === "jev" ? game.player : game.jev;
    const relativeX = opponent.x - actor.x;
    const side = Math.abs(relativeX) < 145 ? -Math.sign(relativeX || (entry.owner === "jev" ? -1 : 1)) : 1;
    const x = clamp(actor.x + side * 28 - (side < 0 ? boxWidth : 0), 24, WORLD.width - boxWidth - 24);
    const y = actor.y - 48 - progress * 12;
    drawCompanySkillSignature(ctx, actor, actorSkin, progress, cell);
    ctx.fillStyle = "rgba(17, 14, 25, 0.9)";
    ctx.strokeStyle = actorSkin.accent;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = actorSkin.accent;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.roundRect(x, y - 17, boxWidth, 32, 10);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.stroke();
    const iconSheet = artwork.skillIcons[actorSkin.id];
    if (cell && iconSheet?.complete && iconSheet.naturalWidth > 0) {
      const cellWidth = iconSheet.naturalWidth / 4;
      const cellHeight = iconSheet.naturalHeight / 4;
      ctx.drawImage(iconSheet, cell[0] * cellWidth, cell[1] * cellHeight, cellWidth, cellHeight, x + 4, y - 14, 26, 26);
    }
    ctx.fillStyle = "#fff5e8";
    ctx.textBaseline = "middle";
    ctx.fillText(skillName, x + 34, y - 1, boxWidth - 39);
    ctx.restore();
  }
}

function renderDecisionCard(owner, action, probabilities, selectedAction = action) {
  const isGhost = owner === "ghost";
  const actionNode = isGhost ? ui.playerDecisionAction : ui.jevDecisionAction;
  const optionsNode = isGhost ? ui.playerDecisionOptions : ui.jevDecisionOptions;
  const expandNode = isGhost ? ui.playerDecisionExpand : ui.jevDecisionExpand;
  const cardNode = isGhost ? ui.playerDecisionCard : ui.jevDecisionCard;
  const labels = isGhost ? playerModeLabels : modeLabels;
  const chosen = labels[action] ? action : Object.keys(labels)[0];
  const selected = labels[selectedAction] ? selectedAction : chosen;
  lastDecision[owner] = { action: chosen, selectedAction: selected, probabilities };
  actionNode.textContent = labels[chosen];
  const adjusted = chosen !== selected;
  const actionDescription = adjusted
    ? (isGhost ? "Ghost selected " : "Jev selected ") + labels[selected].toLowerCase() + " but the game chose " + labels[chosen].toLowerCase() + " to honor the active objective or action safety."
    : (isGhost ? "Ghost used " : "Jev executed ") + labels[chosen].toLowerCase() + ".";
  cardNode.title = actionDescription;
  actionNode.setAttribute("aria-label", actionDescription);
  optionsNode.replaceChildren();
  const distribution = Object.keys(labels)
    .map((key) => {
      const raw = probabilities && typeof probabilities === "object" ? probabilities[key] : null;
      const numeric = raw === null || raw === undefined ? null : Number(raw);
      const value = Number.isFinite(numeric) ? Math.min(1, numeric > 1 ? numeric / 100 : numeric) : null;
      return [key, value];
    })
    .sort((left, right) => (right[1] ?? -1) - (left[1] ?? -1));
  const ranked = distribution.filter(([, probability]) => probability !== null && probability > 0);
  const ordered = decisionExpanded[owner]
    ? distribution
    : ranked.length ? ranked.slice(0, 3) : [[selected, null]];
  if (!decisionExpanded[owner] && ranked.length && !ordered.some(([key]) => key === selected)) {
    if (ordered.length >= 3) ordered.pop();
    ordered.push(distribution.find(([key]) => key === selected) || [selected, null]);
  }
  for (const [key, probability] of ordered) {
    const row = document.createElement("div");
    row.className = "decision-option" + (key === selected ? " is-chosen" : "");
    const copy = document.createElement("span");
    copy.className = "decision-option-name";
    copy.textContent = labels[key];
    const value = document.createElement("span");
    value.className = "decision-option-value";
    value.textContent = probability === null ? "" : Math.round(probability * 100) + "%";
    row.append(copy, value);
    if (probability !== null) {
      const track = document.createElement("span");
      track.className = "decision-option-track";
      const fill = document.createElement("span");
      fill.className = "decision-option-fill";
      fill.style.width = Math.round(probability * 100) + "%";
      track.append(fill);
      row.append(track);
    }
    optionsNode.append(row);
  }
  const expanded = decisionExpanded[owner];
  const choiceCount = Object.keys(labels).length;
  expandNode.textContent = expanded ? "Show leading choices" : ordered.length + " shown · view all " + choiceCount;
  expandNode.setAttribute("aria-label", expanded ? "Show leading choices" : "View all " + choiceCount + " available tactics");
  expandNode.setAttribute("aria-expanded", String(expanded));
  optionsNode.classList.toggle("is-expanded", expanded);
  cardNode.classList.toggle("is-expanded", expanded);
}

function toggleDecisionOptions(owner) {
  const decision = lastDecision[owner];
  if (!decision) return;
  decisionExpanded[owner] = !decisionExpanded[owner];
  renderDecisionCard(owner, decision.action, decision.probabilities, decision.selectedAction);
}

function modeFallback() {
  const gap = distance(combatTarget(), game.jev);
  const playerGap = distance(game.player, game.jev);
  if (game.jev.rendCooldown <= 0 && playerGap >= 30 &&
      playerGap <= RIFT_REND_RANGE + game.player.radius &&
      isLaneClear(game.jev, game.player, game.jev.radius)) return "rift_rend";
  const anchorsBroken = game.anchors.every((anchor) => anchor.health <= 0);
  const burstThreat = game.player.pulseTimer > 0 && distance(game.player, game.jev) < 174;
  if (anchorsBroken && game.jev.riftAegisCooldown <= 0 && game.jev.riftAegisTimer <= 0 &&
      game.jev.riftAegisCharges <= 0 && (isPlayerShotThreateningJev() || burstThreat)) return "rift_aegis";
  if (game.player.pulseTimer > 0 && gap < 165 && game.jev.shadowDodgeCooldown <= 0) return "shadow_dodge";
  if (game.jev.shadowDodgeCooldown <= 0 && isPlayerShotThreateningJev()) return "shadow_dodge";
  if (game.jev.meteorCooldown <= 0 && game.meteors.length === 0 && gap >= 250 && gap <= 920) return "meteor_storm";
  if (game.jev.summonCooldown <= 0 && game.minions.length === 0 && gap > 260) return "summon_wraiths";
  if (game.jev.blastCooldown <= 0 && gap >= 175 && gap <= 490 && isPowerBlastLaneClear(game.jev, predictedPowerBlastTarget())) return "power_blast";
  if (game.jev.salvoCooldown <= 0 && gap >= 240 && gap <= 820 && isSoulSalvoLaneClear(game.jev, predictedSoulSalvoTarget())) return "soul_salvo";
  if (game.jev.riftRushCooldown <= 0 && gap >= 245 && gap <= 520) return "rift_rush";
  if (game.jev.mineCooldown <= 0 && !game.activeMine && gap < 340 && game.elapsed % 13 > 10) return "rift_mine";
  if (game.routeProfile.revisitedCells > 5) return "flank";
  if (Math.hypot(game.player.vx, game.player.vy) > 120) return "intercept";
  return "pursue";
}

function playerModeFallback() {
  const threatened = isJevAttackThreateningPlayer();
  const rendThreat = isJevRiftRendThreateningPlayer();
  const jevGap = distance(game.player, game.jev);
  const objective = aiObjectiveTarget();
  if (rendThreat && game.player.dashCooldown <= 0) return "phase_dash";
  if (rendThreat && game.player.hookCooldown <= 0) return "rift_hook";
  if (rendThreat && game.player.guardCooldown <= 0) return "lantern_guard";
  if (game.player.guardCooldown <= 0 && threatened && !rendThreat) return "lantern_guard";
  if (game.player.dashCooldown <= 0 && threatened) return "phase_dash";
  if (game.player.echoCooldown <= 0 && !game.player.echo && (threatened || jevGap < 400)) return "mirror_echo";
  if (game.player.hookCooldown <= 0 && (jevGap < 260 || distance(game.player, objective) > 500)) return "rift_hook";
  if (game.player.pulseCooldown <= 0 && distance(game.player, objective) < 145) return "soul_burst";
  if (game.anchors.some((anchor) => anchor.health > 0)) {
    if (threatened || jevGap < GHOST_SAFE_GAP) return "evade_warning";
    if (distance(game.player, objective) <= 690 && isLaneClear(game.player, objective, 8)) return "fire_anchors";
    return "advance_anchor";
  }
  if (threatened || jevGap < 320) return "evade_warning";
  return "kite_and_shoot";
}

function setGhostTactic(tactic) {
  const anchorsRemain = game.anchors.some((anchor) => anchor.health > 0);
  if (anchorsRemain && (tactic === "attack_jev" || tactic === "kite_and_shoot")) {
    const objective = aiObjectiveTarget();
    tactic = distance(game.player, objective) <= 700 && isLaneClear(game.player, objective, 8)
      ? "fire_anchors"
      : "advance_anchor";
  } else if (!anchorsRemain && (tactic === "advance_anchor" || tactic === "fire_anchors")) {
    tactic = "kite_and_shoot";
  }
  game.player.aiTactic = tactic;
  game.player.aiHistory.push({ tactic, at: game.elapsed });
  if (game.player.aiHistory.length > 6) game.player.aiHistory.shift();
  return tactic;
}

const tacticalGridCache = new WeakMap();
function buildTacticalGrid() {
  const level = game.level;
  const cellSize = 64;
  const columns = Math.ceil(WORLD.width / cellSize);
  const rows = Math.ceil(WORLD.height / cellSize);
  let terrain = tacticalGridCache.get(level);
  if (!terrain) {
    const cells = Array.from({ length: rows }, () => Array(columns).fill("."));
    const offsets = [-cellSize / 2 + 8, 0, cellSize / 2 - 8];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const centerX = column * cellSize + cellSize / 2;
        const centerY = row * cellSize + cellSize / 2;
        const covered = level.blocks.some((block) => offsets.some((offsetY) => offsets.some((offsetX) =>
          obstacleContains(centerX + offsetX, centerY + offsetY, block, game.player.radius * 0.45)
        )));
        if (covered) cells[row][column] = "#";
      }
    }
    for (const crossing of level.chokepoints) {
      const column = Math.floor(crossing.x / cellSize);
      const row = Math.floor(crossing.y / cellSize);
      if (cells[row]?.[column] === ".") cells[row][column] = "+";
    }
    terrain = cells.map((row) => row.join(""));
    tacticalGridCache.set(level, terrain);
  }

  const cells = terrain.map((row) => [...row]);
  const hazardSymbols = {
    lava: "L", quicksand: "Q", swarm: "S", spores: "s", current: "~", steam: "!", arc_sparks: "^",
  };
  for (const hazard of game.hazards) {
    const symbol = hazardSymbols[hazard.kind];
    if (!symbol) continue;
    const bounds = hazardBounds(hazard);
    const left = clamp(Math.floor(bounds.x / cellSize), 0, columns - 1);
    const right = clamp(Math.floor((bounds.x + bounds.w) / cellSize), 0, columns - 1);
    const top = clamp(Math.floor(bounds.y / cellSize), 0, rows - 1);
    const bottom = clamp(Math.floor((bounds.y + bounds.h) / cellSize), 0, rows - 1);
    for (let row = top; row <= bottom; row += 1) {
      for (let column = left; column <= right; column += 1) {
        if (cells[row][column] !== "#") cells[row][column] = symbol;
      }
    }
  }

  const putActor = (x, y, symbol) => {
    const column = clamp(Math.floor(x / cellSize), 0, columns - 1);
    const row = clamp(Math.floor(y / cellSize), 0, rows - 1);
    cells[row][column] = symbol;
  };
  for (const anchor of game.anchors) putActor(anchor.x, anchor.y, anchor.health > 0 ? String.fromCharCode(65 + anchor.id) : String.fromCharCode(97 + anchor.id));
  putActor(game.jev.x, game.jev.y, "J");
  putActor(game.player.x, game.player.y, "G");
  return {
    cell_size: cellSize,
    columns,
    rows,
    legend: "Rows run north to south; columns west to east. G runner, J chaser, A-C live anchors, a-c broken anchors, # obstacle, + chokepoint, L lava, Q quicksand, S swarm, s spores, ~ current, ! steam, ^ arc hazard, . open floor.",
    cells: cells.map((row) => row.join("")),
  };
}

function getJevState() {
  updatePlanProgress();
  const player = game.player;
  const jev = game.jev;
  const objectiveTarget = aiObjectiveTarget();
  const modelPosition = player.afterimageTimer > 0 ? player.lastKnown : player;
  const modelVelocity = player.afterimageTimer > 0 ? { vx: 0, vy: 0 } : player;
  const timeToGhostBuffer = secondsToGhostSafeGap(modelPosition, modelVelocity, jev);
  return {
    map_id: game.level.id,
    game_mode: game.mode,
    difficulty: game.difficulty,
    phase: game.anchors.every((anchor) => anchor.health <= 0) ? "demon_exposed" : "break_anchors",
    seconds_remaining: Math.round(game.remaining),
    rift_surge: game.enraged,
    objective: {
      name: "Shatter all three rift anchors, then defeat Jev.",
      active_anchors: game.anchors.filter((anchor) => anchor.health > 0).map((anchor) => ({
        id: anchor.id, x: Math.round(anchor.x), y: Math.round(anchor.y), health: anchor.health,
      })),
      demon_warded: game.anchors.some((anchor) => anchor.health > 0),
    },
    player: {
      x: Math.round(modelPosition.x), y: Math.round(modelPosition.y),
      vx: player.afterimageTimer > 0 ? 0 : Math.round(player.vx), vy: player.afterimageTimer > 0 ? 0 : Math.round(player.vy),
      afterimage_active: player.afterimageTimer > 0,
      last_known_position: player.afterimageTimer > 0 ? { x: Math.round(player.lastKnown.x), y: Math.round(player.lastKnown.y) } : null,
      health: player.health,
      phase_dash_ready: player.dashCooldown <= 0,
      burst_ready: player.pulseCooldown <= 0,
      echo_ready: player.echoCooldown <= 0,
      hook_ready: player.hookCooldown <= 0,
      guard_ready: player.guardCooldown <= 0,
      guard_active: player.guardTimer > 0,
      guard_adapting: game.elapsed < player.guardAdaptUntil,
      echo: player.echo ? { x: Math.round(player.echo.x), y: Math.round(player.echo.y), seconds_left: Math.round(player.echo.life * 10) / 10 } : null,
      clones: player.clones.slice(0, 3).map((clone) => ({
        x: Math.round(clone.x), y: Math.round(clone.y), seconds_left: Math.round(clone.life * 10) / 10,
      })),
      firing: player.fireHeld || keys.has("z"),
      current_tactic: player.aiTactic,
      objective_target: objectiveTarget === game.jev
        ? { type: "jev" }
        : {
            type: "anchor", id: objectiveTarget.id, x: Math.round(objectiveTarget.x), y: Math.round(objectiveTarget.y),
            approach_position: game.player.aiObjectivePosition
              ? { x: Math.round(game.player.aiObjectivePosition.x), y: Math.round(game.player.aiObjectivePosition.y) }
              : null,
          },
      decision_history: player.aiHistory.map((entry) => ({
        tactic: entry.tactic,
        seconds_ago: Math.max(0, Math.round((game.elapsed - entry.at) * 10) / 10),
      })),
      fire_cooldown: Math.round(player.fireCooldown * 10) / 10,
      aim: player.aim ? { x: Math.round(player.aim.x), y: Math.round(player.aim.y) } : null,
      shots_fired: player.shotsFired,
      hits_landed: player.hitsLanded,
      recent_route: game.playerTrail.map((point) => ({
        x: point.x, y: point.y, seconds_ago: Math.round((game.elapsed - point.at) * 10) / 10,
      })),
      route_profile: player.afterimageTimer > 0 ? { ...game.routeProfile, hotspot: null } : game.routeProfile,
      recent_actions: game.history.slice(-8),
      projectiles: game.projectiles.filter((projectile) => projectile.owner === "player").slice(-6).map((projectile) => ({
        x: Math.round(projectile.x), y: Math.round(projectile.y), vx: Math.round(projectile.vx), vy: Math.round(projectile.vy),
      })),
      action_timeline: game.actionTimeline.map((entry) => ({
        event: entry.event, seconds_ago: Math.round((game.elapsed - entry.at) * 10) / 10,
      })),
      soul_burst_threat: player.pulseTimer > 0 && distance(player, jev) < 174,
      route_pattern: player.afterimageTimer > 0 ? "hidden"
        : game.routeProfile.revisitedCells >= 5 ? "looping"
          : game.routeProfile.reversals >= 4 && game.routeProfile.turns >= 8 ? "erratic"
            : "open",
      slowed: player.snaredTimer > 0 || environmentEffects(player).speed < 0.98,
      under_attack: isJevAttackThreateningPlayer(),
      stuck_seconds: Math.round(player.stuckTimer * 10) / 10,
      recovery_active: Boolean(player.recoveryTarget),
      distance_to_objective: Math.round(distance(player, objectiveTarget)),
      objective_lane_clear: isLaneClear(player, objectiveTarget, 8),
      burst_target_in_range: distance(player, objectiveTarget) < 145 ||
        game.minions.some((wraith) => distance(player, wraith) < 145),
    },
    jev: {
      x: Math.round(jev.x), y: Math.round(jev.y),
      distance_to_player: Math.round(distance(jev, modelPosition)),
      seconds_to_ghost_buffer: timeToGhostBuffer === null ? null : Math.round(timeToGhostBuffer * 10) / 10,
      current_tactic: jev.mode, current_plan: jev.plan,
      plan_seconds_left: Math.max(0, Math.round((jev.planUntil - game.elapsed) * 10) / 10),
      plan_step: jev.planStep,
      plan_step_seconds: Math.max(0, Math.round((game.elapsed - jev.planStepStartedAt) * 10) / 10),
      plan_step_goal: planStepDescriptions[jev.planStep],
      action_history: jev.actionHistory.map((action) => ({
        plan: action.plan,
        requested_tactic: action.requested,
        executed_tactic: action.executed,
        result: action.result,
        outcome: action.outcome,
        seconds_ago: Math.max(0, Math.round((game.elapsed - action.at) * 10) / 10),
      })),
      player_read: jev.playerRead,
      player_read_age: Math.max(0, Math.round((game.elapsed - jev.playerReadAt) * 10) / 10),
      recent_plans: jev.planHistory.map((entry) => ({
        plan: entry.plan, seconds_ago: Math.round((game.elapsed - entry.at) * 10) / 10,
      })),
      stunned: jev.stunned > 0, health: jev.health,
      rend_ready: jev.rendCooldown <= 0,
      rend_lane_clear: isLaneClear(jev, game.player, jev.radius),
      rend_arc_threatening: isJevRiftRendThreateningPlayer(),
      rend_phase: jev.rendPhase || "ready",
      blast_ready: jev.blastCooldown <= 0,
      blast_lane_clear: isPowerBlastLaneClear(jev, predictedPowerBlastTarget()),
      salvo_lane_clear: isSoulSalvoLaneClear(jev, predictedSoulSalvoTarget()),
      blast_phase: jev.blastPhase || "ready",
      mine_ready: jev.mineCooldown <= 0 && !game.activeMine,
      active_mine: game.activeMine ? {
        x: Math.round(game.activeMine.x), y: Math.round(game.activeMine.y),
        warning: game.activeMine.warning > 0,
        warning_seconds_left: Math.round(Math.max(0, game.activeMine.warning) * 10) / 10,
        radius: game.activeMine.radius,
      } : null,
      rift_rush_ready: jev.riftRushCooldown <= 0,
      rift_rush_lane_clear: Boolean(riftRushDestination()),
      rift_rush_phase: jev.riftRushPhase || "ready",
      rift_aegis_ready: game.anchors.every((anchor) => anchor.health <= 0) &&
        jev.riftAegisCooldown <= 0 && jev.riftAegisTimer <= 0 && jev.riftAegisCharges <= 0,
      rift_aegis_active_seconds: Math.round(jev.riftAegisTimer * 10) / 10,
      rift_aegis_charges: jev.riftAegisCharges,
      recently_parried: game.elapsed < jev.parryRecoveryUntil,
      parry_recovery_seconds: Math.max(0, Math.round((jev.parryRecoveryUntil - game.elapsed) * 10) / 10),
      shadow_dodge_ready: jev.shadowDodgeCooldown <= 0,
      shadow_dodge_phase: jev.shadowDodgePhase || "ready",
      soul_salvo_ready: jev.salvoCooldown <= 0,
      soul_salvo_phase: jev.salvoPhase || "ready",
      summon_ready: jev.summonCooldown <= 0,
      meteor_ready: jev.meteorCooldown <= 0 && game.meteors.length === 0,
      wraithlings: game.minions.slice(0, 3).map((wraith) => ({
        x: Math.round(wraith.x), y: Math.round(wraith.y), health: 1, seconds_left: Math.round(wraith.life * 10) / 10,
      })),
      meteors: game.meteors.slice(0, 3).map((meteor) => ({
        x: Math.round(meteor.x), y: Math.round(meteor.y), radius: meteor.radius, seconds_to_impact: Math.round(meteor.delay * 10) / 10,
      })),
      stuck_seconds: Math.round(jev.stuckTimer * 10) / 10,
      recovery_active: Boolean(jev.recoveryTarget),
      shot_threatened: isPlayerShotThreateningJev(),
    },
    recent_events: game.history.slice(-8),
    arena: {
      width: WORLD.width,
      height: WORLD.height,
      tactical_grid: buildTacticalGrid(),
      topology: game.level.topology,
      chokepoints: game.level.chokepoints.map((point) => ({ ...point })),
      hazards: game.hazards.map((hazard) => ({
        x: hazard.x, y: hazard.y, width: hazard.w, height: hazard.h, kind: hazard.kind,
        ...hazardState(hazard), flow_x: hazard.flowX || 0, flow_y: hazard.flowY || 0,
        seconds_to_change: hazard.period ? Math.max(0, Math.round((hazard.period - ((game.elapsed + hazard.phase) % hazard.period)) * 10) / 10) : null,
      })),
      anchors: game.anchors.map((anchor) => ({
        x: Math.round(anchor.x), y: Math.round(anchor.y), health: anchor.health, max_health: anchor.maxHealth,
      })),
      projectiles: game.projectiles.filter((projectile) => projectile.owner === "jev").slice(-6).map((projectile) => ({
        x: Math.round(projectile.x), y: Math.round(projectile.y), vx: Math.round(projectile.vx), vy: Math.round(projectile.vy),
      })),
    },
  };
}

function queueJevDecision() {
  if (!game?.running || game.paused) return;
  urgentJevDecisionQueued = true;
  if (!jevRequestInFlight) scheduleQueuedJevDecision();
}

function scheduleQueuedJevDecision() {
  if (!urgentJevDecisionQueued || jevRequestInFlight || !game?.running || game.paused || urgentJevDecisionTimer) return;
  const minimumGap = TACTIC_DECISION_MIN_GAP;
  const delay = Math.max(0, lastJevDecisionStartedAt + minimumGap - performance.now());
  urgentJevDecisionTimer = window.setTimeout(() => {
    urgentJevDecisionTimer = 0;
    if (!urgentJevDecisionQueued || jevRequestInFlight || !game?.running || game.paused) return;
    urgentJevDecisionQueued = false;
    void requestJevDecision(true);
  }, delay);
}

async function requestJevDecision(urgent = false) {
  if (!game?.running || game.paused) return;
  if (jevRequestInFlight) {
    if (urgent) urgentJevDecisionQueued = true;
    return;
  }
  const now = performance.now();
  if (!urgent && now < nextJevDecisionAt) return;
  if (urgent && now - lastJevDecisionStartedAt < TACTIC_DECISION_MIN_GAP) {
    urgentJevDecisionQueued = true;
    scheduleQueuedJevDecision();
    return;
  }
  window.clearTimeout(urgentJevDecisionTimer);
  urgentJevDecisionTimer = 0;
  urgentJevDecisionQueued = false;
  const requestedGame = game;
  const requestedPauseVersion = game.pauseVersion;
  jevRequestInFlight = true;
  lastJevDecisionStartedAt = now;
  ui.intent.classList.add("is-thinking");
  commitPendingPlan();
  const snapshot = getJevState();
  try {
    const response = await fetch("/api/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(snapshot),
      signal: AbortSignal.timeout(14_000),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Jev could not decide.");
    if (game === requestedGame && game.running && !game.paused && game.pauseVersion === requestedPauseVersion && Object.hasOwn(modeLabels, result.mode)) {
      if (Object.hasOwn(playerReadLabels, result.player_read)) {
        game.jev.playerRead = result.player_read;
        game.jev.playerReadAt = game.elapsed;
      }
      setMode(result.mode, Number(result.confidence) || 0, "system_one");
      renderDecisionCard("jev", game.jev.mode, result.probabilities, result.mode);
      if (Object.hasOwn(planLabels, result.plan)) queuePlan(result.plan, Number(result.plan_confidence) || 0);
      if (game.mode === "auto") {
        const playerMode = Object.hasOwn(playerModeLabels, result.player_mode) ? result.player_mode : playerModeFallback();
        const executedPlayerMode = setGhostTactic(playerMode);
        renderDecisionCard("ghost", executedPlayerMode, result.player_probabilities, playerMode);
      }
      setConnection(true);
    }
  } catch {
    if (game === requestedGame && game.running && !game.paused && game.pauseVersion === requestedPauseVersion) {
      const fallback = modeFallback();
      setMode(fallback, 0, "local_fallback");
      renderDecisionCard("jev", game.jev.mode, null, fallback);
      if (game.mode === "auto") {
        const playerFallback = playerModeFallback();
        const executedPlayerFallback = setGhostTactic(playerFallback);
        renderDecisionCard("ghost", executedPlayerFallback, null, playerFallback);
      }
      setConnection(false);
    }
  } finally {
    jevRequestInFlight = false;
    ui.intent.classList.remove("is-thinking");
    nextJevDecisionAt = performance.now() + TACTIC_DECISION_INTERVAL;
    scheduleQueuedJevDecision();
  }
}

function finishGame(outcome) {
  if (!game?.running) return;
  game.running = false;
  stopMusic();
  cancelAnimationFrame(animationFrame);
  ui.footer.hidden = false;
  ui.result.hidden = false;
  const foughtBack = outcome === "fight";
  const winner = skinForRole(foughtBack ? "runner" : "chaser");
  const loser = skinForRole(foughtBack ? "chaser" : "runner");
  ui.resultKicker.textContent = "MATCH WINNER";
  ui.resultTitle.textContent = winner.victoryHeadline || `${winner.company} won`;
  ui.resultCopy.textContent = foughtBack
    ? `${winner.name} broke the anchors and defeated ${loser.name}.`
    : `${winner.name} caught ${loser.name}.`;
  ui.nextLevel.hidden = !foughtBack || selectedLevelIndex >= levels.length - 1;
  if (foughtBack) {
    emitParticles(game.jev.x, game.jev.y, "#ffd07b", 60, 260);
    drawWorld();
  }
  ui.restart.focus({ preventScroll: true });
}

function setStick(x, y) {
  stick.x = x;
  stick.y = y;
  ui.stickKnob.style.transform = "translate(calc(-50% + " + (x * 25) + "px), calc(-50% + " + (y * 25) + "px))";
}

function pointerStick(event) {
  if (stick.pointer !== event.pointerId) return;
  const rect = ui.stickZone.getBoundingClientRect();
  const dx = event.clientX - stick.originX;
  const dy = event.clientY - stick.originY;
  const limit = Math.min(rect.width, rect.height) * 0.34;
  const magnitude = Math.hypot(dx, dy);
  const ratio = magnitude > limit ? limit / magnitude : 1;
  setStick(dx * ratio / limit, dy * ratio / limit);
}

function pointerToWorld(event) {
  const rect = ui.canvas.getBoundingClientRect();
  const view = currentViewBounds();
  return {
    x: view.x + clamp((event.clientX - rect.left) / rect.width, 0, 1) * view.width,
    y: view.y + clamp((event.clientY - rect.top) / rect.height, 0, 1) * view.height,
  };
}

function updateAim(event) {
  if (!game?.running || game.paused || game.mode === "auto" || !ui.arena || ui.arena.hidden) return;
  game.player.aim = pointerToWorld(event);
}

function beginPlayerFire(event) {
  if (!game?.running || game.paused || game.mode === "auto") return;
  if (event.pointerType === "mouse" && event.button !== 0) return;
  event.preventDefault();
  ui.canvas.focus({ preventScroll: true });
  game.player.fireHeld = true;
  updateAim(event);
  ui.canvas.setPointerCapture(event.pointerId);
}

function endPlayerFire(event) {
  if (ui.canvas.hasPointerCapture(event.pointerId)) ui.canvas.releasePointerCapture(event.pointerId);
  if (game?.player) game.player.fireHeld = false;
}

function handleKeyDown(event) {
  const key = event.key.toLowerCase();
  if (key === "escape") {
    event.preventDefault();
    toggleSettings();
    return;
  }
  if (game?.paused) {
    if (key === "tab") {
      const focusable = [...ui.settingsPanel.querySelectorAll("button, input, select")].filter((item) => !item.disabled);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    return;
  }
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
  if (event.repeat) { keys.add(key); return; }
  keys.add(key);
  if (game?.mode !== "auto") {
    if (key === " ") usePhaseDash();
    if (key === "f" || key === "x") useSoulBurst();
    if (key === "q") useMirrorEcho();
    if (key === "e") useRiftHook();
    if (key === "c" || key === "shift") useLanternGuard();
  }
}

function handleKeyUp(event) {
  keys.delete(event.key.toLowerCase());
}

ui.levelPrev.addEventListener("click", () => changeSelectedLevel(-1));
ui.levelNext.addEventListener("click", () => changeSelectedLevel(1));
ui.musicToggle.addEventListener("click", toggleMusic);
ui.settingsToggle.addEventListener("click", toggleSettings);
ui.settingsClose.addEventListener("click", resumeGame);
ui.settingsResume.addEventListener("click", resumeGame);
ui.settingsOverlay.addEventListener("click", (event) => {
  if (event.target === ui.settingsOverlay) resumeGame();
});
ui.settingsMusic.addEventListener("change", () => {
  if (ui.settingsMusic.checked !== music.enabled) toggleMusic();
});
ui.settingsVolume.addEventListener("input", () => setMusicVolume(ui.settingsVolume.value));
ui.settingsDifficulty.addEventListener("change", () => setDifficulty(ui.settingsDifficulty.value));
document.querySelectorAll(".skin-choice-input").forEach((control) => {
  control.addEventListener("change", () => {
    if (control.checked) setSelectedSkin(control.dataset.role, control.value);
  });
});
ui.skinSwap.addEventListener("click", swapSkinRoles);
ui.modeHuman.addEventListener("click", () => setSelectedMode("human"));
ui.modeAuto.addEventListener("click", () => setSelectedMode("auto"));
ui.decisionToggle.addEventListener("click", () => {
  decisionsVisible = !decisionsVisible;
  ui.decisionPanels.classList.toggle("is-hidden", !decisionsVisible);
  ui.decisionToggle.setAttribute("aria-pressed", String(decisionsVisible));
  ui.decisionToggle.setAttribute("aria-label", decisionsVisible ? "Hide decision panels" : "Show decision panels");
});
ui.jevDecisionExpand.addEventListener("click", () => toggleDecisionOptions("jev"));
ui.playerDecisionExpand.addEventListener("click", () => toggleDecisionOptions("ghost"));
ui.start.addEventListener("click", startGame);
ui.restart.addEventListener("click", startGame);
ui.nextLevel.addEventListener("click", () => {
  selectedLevelIndex = clamp(selectedLevelIndex + 1, 0, levels.length - 1);
  renderLevelSelection();
  startGame();
});
ui.home.addEventListener("click", () => {
  cancelAnimationFrame(animationFrame);
  stopMusic();
  if (game) game.running = false;
  ui.arena.hidden = true;
  ui.landing.hidden = false;
  ui.footer.hidden = false;
  document.querySelector(".site-shell").classList.remove("is-playing");
  document.querySelector("main").classList.remove("is-playing");
});
window.addEventListener("keydown", handleKeyDown, { passive: false });
window.addEventListener("keyup", handleKeyUp);
window.addEventListener("blur", () => { keys.clear(); setStick(0, 0); if (game?.player) game.player.fireHeld = false; });
window.addEventListener("resize", resizeCanvas);
ui.dashTouch.addEventListener("pointerdown", (event) => { event.preventDefault(); usePhaseDash(); });
ui.pulseTouch.addEventListener("pointerdown", (event) => { event.preventDefault(); useSoulBurst(); });
ui.echoTouch.addEventListener("pointerdown", (event) => { event.preventDefault(); useMirrorEcho(); });
ui.hookTouch.addEventListener("pointerdown", (event) => { event.preventDefault(); useRiftHook(); });
ui.guardTouch.addEventListener("pointerdown", (event) => { event.preventDefault(); useLanternGuard(); });
ui.stickZone.addEventListener("pointerdown", (event) => {
  if (stick.pointer !== null) return;
  event.preventDefault();
  stick.pointer = event.pointerId;
  const rect = ui.stickZone.getBoundingClientRect();
  stick.originX = rect.left + rect.width / 2;
  stick.originY = rect.top + rect.height / 2;
  ui.stickZone.setPointerCapture(event.pointerId);
  pointerStick(event);
});
ui.stickZone.addEventListener("pointermove", pointerStick);
function releaseStick(event) {
  if (stick.pointer !== event.pointerId) return;
  stick.pointer = null;
  setStick(0, 0);
}
ui.stickZone.addEventListener("pointerup", releaseStick);
ui.stickZone.addEventListener("pointercancel", releaseStick);
ui.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
ui.canvas.addEventListener("pointermove", updateAim);
ui.canvas.addEventListener("pointerdown", (event) => {
  if (event.button === 2) {
    event.preventDefault();
    useLanternGuard();
    return;
  }
  beginPlayerFire(event);
});
ui.canvas.addEventListener("pointerup", endPlayerFire);
ui.canvas.addEventListener("pointercancel", endPlayerFire);

if (new URLSearchParams(window.location.search).get("qa") === "1") {
  window.__FRONTIER_QA__ = Object.freeze({
    snapshot: () => {
      if (!game) return null;
      const player = game.player;
      const jev = game.jev;
      const playerMovementRadius = player.clearanceRadius ?? player.radius;
      const jevMovementRadius = jev.clearanceRadius ?? jev.radius;
      return {
        map: game.level.id,
        mode: game.mode,
        skinLoadout: { runner: skinForRole("runner").id, chaser: skinForRole("chaser").id },
        elapsed: Math.round(game.elapsed * 100) / 100,
        remaining: Math.round(game.remaining * 100) / 100,
        camera: { x: cameraState.x, y: cameraState.y },
        running: game.running,
        paused: game.paused,
        result: { visible: !ui.result.hidden, title: ui.resultTitle.textContent },
        anchors: game.anchors.map(({ id, x, y, health }) => ({ id, x, y, health })),
        player: {
          x: player.x, y: player.y, vx: player.vx, vy: player.vy, health: player.health,
          radius: player.radius, clearanceRadius: playerMovementRadius,
          currentBlocked: blocked(player.x, player.y, playerMovementRadius),
          movedFromSpawn: Math.round(distance(player, game.level.playerStart)),
          hookActive: Boolean(player.hookTarget),
          tactic: player.aiTactic, input: { ...player.aiInput }, target: player.aiTarget, objective: player.aiObjectiveAnchorId,
          stuck: player.stuckTimer, recoveryAttempts: player.recoveryAttempts,
          recoveryTarget: player.recoveryTarget, pathLength: player.aiPath.length,
          targetBlocked: player.aiTarget ? blocked(player.aiTarget.x, player.aiTarget.y, playerMovementRadius) : null,
          targetLaneClear: player.aiTarget ? isLaneClear(player, player.aiTarget, playerMovementRadius) : null,
          dashCooldown: player.dashCooldown, hookCooldown: player.hookCooldown,
          guardCooldown: player.guardCooldown, echoCooldown: player.echoCooldown,
          shots: player.shotsFired, hits: player.hitsLanded,
        },
        jev: {
          x: jev.x, y: jev.y, vx: jev.vx, vy: jev.vy, health: jev.health,
          radius: jev.radius, clearanceRadius: jevMovementRadius,
          currentBlocked: blocked(jev.x, jev.y, jevMovementRadius),
          mode: jev.mode, plan: jev.plan, stuck: jev.stuckTimer,
          recoveryAttempts: jev.recoveryAttempts, recoveryTarget: jev.recoveryTarget,
          pathLength: jev.path.length, rendPhase: jev.rendPhase, blastPhase: jev.blastPhase,
          target: jevTarget(), targetBlocked: blocked(jevTarget().x, jevTarget().y, jevMovementRadius),
          targetLaneClear: isLaneClear(jev, jevTarget(), jevMovementRadius),
          salvoPhase: jev.salvoPhase, rushPhase: jev.riftRushPhase, aegisCharges: jev.riftAegisCharges,
          parryRecoveryUntil: jev.parryRecoveryUntil,
          actionHistory: jev.actionHistory.map((action) => ({ ...action })),
        },
        events: game.actionTimeline.map((entry) => ({ ...entry })),
        history: [...game.history],
      artwork: Object.fromEntries(Object.entries(artwork.props).map(([lab, image]) => [lab, {
        loaded: image.complete && image.naturalWidth > 0,
        width: image.naturalWidth,
        height: image.naturalHeight,
      }])),
      barrierArt: Object.fromEntries(Object.entries(artwork.barriers).map(([lab, image]) => [lab, {
        loaded: image.complete && image.naturalWidth > 0,
        width: image.naturalWidth,
        height: image.naturalHeight,
        frames: artwork.barrierBounds[lab]?.length ?? 0,
      }])),
      runSprites: Object.fromEntries(Object.entries(artwork.runFrames).map(([skinId, animation]) => [skinId, {
        right: animation.frames.right.length,
        left: animation.frames.left.length,
        frameSizes: Object.fromEntries(Object.entries(animation.frames).map(([direction, frames]) => [
          direction,
          frames.map((frame) => ({ width: frame.width, height: frame.height })),
        ])),
        frameBounds: animation.bounds,
      }])),
      runSideSprites: Object.fromEntries(Object.entries(artwork.runSides).map(([skinId, image]) => [skinId, {
        loaded: image.complete && image.naturalWidth > 0,
        width: image.naturalWidth,
        height: image.naturalHeight,
      }])),
      floorBrandPositions: companyFloorPositions(game.level),
        brandMarks: Object.fromEntries(Object.entries(artwork.brandMarks).map(([brand, image]) => [brand, {
          loaded: image.complete && image.naturalWidth > 0,
          width: image.naturalWidth,
          height: image.naturalHeight,
        }])),
        companions: Object.fromEntries(Object.entries(artwork.companions).map(([mascot, image]) => [mascot, {
          loaded: image.complete && image.naturalWidth > 0,
          width: image.naturalWidth,
          height: image.naturalHeight,
        }])),
        anchorBrandSheets: Object.fromEntries(Object.entries(artwork.anchorBrandSheets).map(([company, sheet]) => [company, {
          loaded: Boolean(sheet?.width && sheet?.height),
          width: sheet?.width ?? 0,
          height: sheet?.height ?? 0,
          frame: Math.floor(game.elapsed * 8) % 8,
        }])),
        decisions: {
          jev: lastDecision.jev ? { ...lastDecision.jev } : null,
          ghost: lastDecision.ghost ? { ...lastDecision.ghost } : null,
        },
        tacticalGrid: buildTacticalGrid(),
      };
    },
  });
}

syncSkinSelector("runner");
syncSkinSelector("chaser");
renderLevelSelection();
renderSkillCatalog();
renderMusicButton();
resizeCanvas();
checkConnection();
