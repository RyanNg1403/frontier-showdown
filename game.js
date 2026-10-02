const WORLD = { width: 2560, height: 1600, cell: 40 };
const DISTRICT = { width: 1280, height: 800 };
const LEGACY_EXPANSION = DISTRICT.width / 960;
const POWER_BLAST_SPEED = 640;
const POWER_BLAST_WINDUP = 0.32;
const SOUL_SALVO_SPEED = 540;
const SOUL_SALVO_WINDUP = 0.36;
const POUNCE_SPEED = 860;
const POUNCE_WINDUP = 0.26;
const POUNCE_MAX_FLIGHT = 0.76;
const PLAYER_SHOT_SPEED = 780;
const PLAYER_SHOT_INTERVAL = 0.38;
const SURVIVAL_SECONDS = 75;
const TACTIC_DECISION_INTERVAL = 820;
const TACTIC_DECISION_MIN_GAP = 650;
const PLAN_COMMITMENT = 3.8;
const MIRROR_CLONE_DURATION = 3.2;
const VEIL_DURATION = 2.4;
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
    name: "The Last Crossing",
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
    name: "Cinderworks",
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
    name: "Drowned Archive",
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
    name: "Verdant Glasshouse",
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
    name: "Meridian Vault",
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
    name: "The Fractured Span",
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
  ],
  drowned: [
    { x: 1370, y: 250, w: 260, h: 112, kind: "current", flowX: 1, flowY: 0 },
    { x: 330, y: 1050, w: 250, h: 118, kind: "current", flowX: 0.7, flowY: -0.7 },
    { x: 1780, y: 1120, w: 270, h: 115, kind: "current", flowX: -1, flowY: 0 },
  ],
  glassgarden: [
    { x: 1510, y: 210, w: 130, h: 140, kind: "spores", phase: 2.5 },
    { x: 300, y: 1060, w: 134, h: 142, kind: "spores", phase: 5.7 },
    { x: 1860, y: 1110, w: 132, h: 138, kind: "spores", phase: 7.6 },
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
    const timing = ["steam", "spores", "arc_sparks", "rift_surge"].includes(hazard.kind)
      ? { period: 9, activeFor: 2.1, warningFor: 1.4 }
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
  pounce: "POUNCE",
  power_blast: "BLAST",
  rift_mine: "RIFT MINE",
  phase_step: "RIFT STEP",
  shadow_dodge: "RIFT SLIDE",
  soul_salvo: "SOUL SALVO",
  summon_wraiths: "WRAITH SWARM",
  meteor_storm: "METEOR STORM",
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
const commitmentTactics = new Set(["pounce", "power_blast", "rift_mine", "soul_salvo", "shadow_dodge", "summon_wraiths", "meteor_storm"]);
const planBreakEvents = new Set([
  "dash", "soul_burst", "burst_hit", "burst_missed", "shot_hit", "anchor_hit", "anchor_broken",
  "mirror_echo", "ghost_veil", "rift_hook", "lantern_parry", "blast_hit", "blast_dodged", "blast_blocked",
  "salvo_hit", "salvo_dodged", "salvo_blocked", "pounce_hit", "pounce_missed", "mine_hit", "mine_evaded",
]);
const actionOutcomeEvents = {
  pounce_hit: ["pounce", "hit"],
  pounce_blocked: ["pounce", "blocked"],
  pounce_missed: ["pounce", "missed"],
  power_blast_fired: ["power_blast", "in_flight"],
  blast_hit: ["power_blast", "hit"],
  blast_missed: ["power_blast", "missed"],
  blast_dodged: ["power_blast", "dodged"],
  blast_blocked: ["power_blast", "blocked"],
  blast_canceled: ["power_blast", "interrupted"],
  soul_salvo_windup: ["soul_salvo", "started"],
  soul_salvo_fired: ["soul_salvo", "in_flight"],
  salvo_hit: ["soul_salvo", "hit"],
  salvo_missed: ["soul_salvo", "missed"],
  salvo_dodged: ["soul_salvo", "dodged"],
  salvo_blocked: ["soul_salvo", "blocked"],
  soul_salvo_canceled: ["soul_salvo", "interrupted"],
  mine_placed: ["rift_mine", "deployed"],
  mine_triggered: ["rift_mine", "triggered"],
  mine_hit: ["rift_mine", "hit"],
  mine_evaded: ["rift_mine", "evaded"],
  phase_step_windup: ["phase_step", "started"],
  phase_step_used: ["phase_step", "gap_closed"],
  phase_step_canceled: ["phase_step", "interrupted"],
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
const artwork = { floors: {}, ghost: new Image(), jev: new Image() };
for (const [biome, file] of Object.entries({
  office: "floor-crossing-v2.png",
  cinder: "floor-cinder-v2.png",
  archive: "floor-archive-v2.png",
  garden: "floor-garden-v2.png",
  vault: "floor-vault-v2.png",
  rift: "floor-rift-v2.png",
})) {
  artwork.floors[biome] = new Image();
  artwork.floors[biome].src = "/assets/" + file;
}
artwork.ghost.src = "/assets/ghost-combat-sheet.png";
artwork.jev.src = "/assets/jev-combat-sheet.png";

const playerModeLabels = {
  advance_anchor: "MOVE TO ANCHOR",
  fire_anchors: "BREAK ANCHOR",
  attack_jev: "KITE & STRIKE",
  kite_and_shoot: "KITE & SHOOT",
  evade_warning: "EVADE ATTACK",
  rift_hook: "RIFT HOOK",
  mirror_echo: "MIRROR CLONES",
  ghost_veil: "GHOST VEIL",
  lantern_guard: "LANTERN GUARD",
  soul_burst: "SOUL BURST",
};
let selectedMode = "human";

const ui = {
  landing: document.querySelector("#landing-screen"),
  arena: document.querySelector("#arena-screen"),
  start: document.querySelector("#start-button"),
  landingDescription: document.querySelector("#landing-description"),
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
  veilTouch: document.querySelector("#veil-touch"),
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
    running: true,
    paused: false,
    pauseVersion: 0,
    difficulty: selectedDifficulty,
    elapsed: 0,
    remaining: SURVIVAL_SECONDS,
    enraged: false,
    anchors: makeAnchors(),
    player: {
      x: selectedLevel.playerStart.x, y: selectedLevel.playerStart.y, vx: 0, vy: 0, radius: 14, speed: 244,
      facing: 1, health: 4, shotsFired: 0, hitsLanded: 0, fireCooldown: 0,
      aim: null, fireHeld: false, dashTimer: 0, dashCooldown: 0, dashVx: 0, dashVy: 0,
      pulseCooldown: 0, pulseTimer: 0, hurtTimer: 0, invulnerable: 0, snaredTimer: 0,
      echoCooldown: 0, hookCooldown: 0, guardCooldown: 0, guardTimer: 0,
      veilCooldown: 0, veilTimer: 0, lastKnown: { x: selectedLevel.playerStart.x, y: selectedLevel.playerStart.y },
      echo: null, clones: [], hookTarget: null, aiInput: { x: 0, y: 0 }, aiTactic: "advance_anchor", aiHistory: [],
      aiObjectiveAnchorId: null, aiObjectivePosition: null,
      aiPath: [], aiNextPathAt: 0, aiActionUntil: 0, aiDecision: null, aiTarget: null,
      stuckTimer: 0, recoveryTarget: null, recoveryUntil: 0, recoveryAttempts: 0,
    },
    jev: {
      x: selectedLevel.jevStart.x, y: selectedLevel.jevStart.y, vx: 0, vy: 0, radius: 17, health: 6, mode: "pursue",
      stunned: 0, recoverTimer: 0, nextPathAt: 0, path: [], facing: -1,
      pounceCooldown: 0, pouncePhase: "", pounceTimer: 0, pounceTarget: null,
      pounceVx: 0, pounceVy: 0, pounceHit: false,
      blastCooldown: 0, blastPhase: "", blastTimer: 0, blastTarget: null,
      salvoCooldown: 0, salvoPhase: "", salvoTimer: 0, salvoTarget: null,
      mineCooldown: 0, phaseStepCooldown: 0, phaseStepPhase: "", phaseStepTimer: 0, phaseStepTarget: null,
      shadowDodgeCooldown: 0, shadowDodgePhase: "", shadowDodgeTimer: 0, shadowDodgeTarget: null,
      summonCooldown: 0, meteorCooldown: 0,
      stuckTimer: 0, recoveryTarget: null, recoveryUntil: 0, recoveryAttempts: 0,
      flankSide: 1,
      plan: "steady_pressure", planUntil: 0, planStartedAt: 0, planConfidence: 0,
      planStep: "approach", planStepStartedAt: 0, pendingPlan: null, actionHistory: [],
      playerRead: "unpredictable", playerReadAt: -3, planHistory: [],
    },
    hazards: selectedLevel.hazards.map((hazard) => ({ ...hazard })),
    projectiles: [],
    minions: [],
    meteors: [],
    meteorImpacts: [],
    history: [],
    actionTimeline: [],
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
  ui.landingDescription.textContent = "Break three rift anchors, expose Jev, and defeat him in " + selectedLevel.name + ".";
  ui.start.firstElementChild.textContent = "Enter " + selectedLevel.name;
  ui.levelPicker.dataset.biome = selectedLevel.biome;
  ui.levelPicker.setAttribute("aria-label", "Choose an arena. " + selectedLevel.topology);
  ui.levelPrev.disabled = selectedLevelIndex === 0;
  ui.levelNext.disabled = selectedLevelIndex === levels.length - 1;
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
  if (game.player.pulseTimer > 0 && playerGap < 174 && !game.player.echo && game.jev.shadowDodgeCooldown <= 0) mode = "shadow_dodge";
  if (mode === "pounce" && (
    game.jev.pounceCooldown > 0 || game.jev.pouncePhase || gap > 315 ||
    !isLaneClear(game.jev, predictedPounceTarget(), game.jev.radius)
  )) {
    mode = Math.hypot(game.player.vx, game.player.vy) > 35 ? "intercept" : "pursue";
  }
  if (mode === "rift_mine" && (game.jev.mineCooldown > 0 || game.activeMine)) {
    mode = "flank";
  }
  if (mode === "power_blast" && (
    game.jev.blastCooldown > 0 || gap < 174 || gap > 475 || game.jev.pouncePhase || game.jev.stunned > 0 ||
    !isPowerBlastLaneClear(game.jev, predictedPowerBlastTarget())
  )) {
    mode = Math.hypot(game.player.vx, game.player.vy) > 35 ? "intercept" : "pursue";
  }
  if (mode === "soul_salvo" && (
    game.jev.salvoCooldown > 0 || game.jev.salvoPhase || game.jev.stunned > 0 || gap < 240 || gap > 820 ||
    !isLaneClear(game.jev, predictedPowerBlastTarget(), game.jev.radius)
  )) {
    mode = Math.hypot(game.player.vx, game.player.vy) > 35 ? "intercept" : "pursue";
  }
  if (mode === "phase_step" && (
    game.jev.phaseStepCooldown > 0 || gap < 170 || gap > 540 || game.jev.pouncePhase || game.jev.blastPhase
  )) {
    mode = "intercept";
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
  ui.intent.dataset.mode = mode;
  renderJevIntent();
  if (mode === "pounce") startPounce();
  if (mode === "power_blast") startPowerBlast();
  if (mode === "rift_mine") startRiftMine();
  if (mode === "phase_step") startPhaseStep();
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
  const activeSkill = ["pounce", "power_blast", "rift_mine", "phase_step", "shadow_dodge", "soul_salvo", "summon_wraiths", "meteor_storm"].includes(game.jev.mode);
  ui.modeLabel.textContent = activeSkill ? tacticText : planText;
  ui.intent.setAttribute("aria-label", "Jev is " + planText.toLowerCase() + "; current tactic: " + tacticText.toLowerCase());
}

function renderHealth() {
  ui.health.replaceChildren();
  for (let index = 0; index < 4; index += 1) {
    const heart = document.createElement("span");
    heart.className = "heart-pip" + (index >= game.player.health ? " is-lost" : "");
    heart.setAttribute("aria-hidden", "true");
    heart.textContent = "♥";
    ui.health.append(heart);
  }
  ui.health.setAttribute("aria-label", game.player.health + (game.player.health === 1 ? " life remaining" : " lives remaining"));
}

function renderJevHealth() {
  ui.jevHealth.replaceChildren();
  for (let index = 0; index < 6; index += 1) {
    const pip = document.createElement("span");
    pip.className = "jev-pip" + (index >= game.jev.health ? " is-lost" : "");
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
  ui.veilTouch.disabled = game.player.veilCooldown > 0;
  ui.hookTouch.disabled = game.player.hookCooldown > 0;
  ui.guardTouch.disabled = game.player.guardCooldown > 0;
  ui.dashTouch.setAttribute("aria-label", game.player.dashCooldown > 0 ? "Dash recharging" : "Dash ready");
  ui.pulseTouch.setAttribute("aria-label", game.player.pulseCooldown > 0 ? "Close-range burst recharging" : "Close-range burst ready");
  ui.echoTouch.setAttribute("aria-label", game.player.echoCooldown > 0 ? "Mirror clones recharging" : "Mirror clones ready");
  ui.veilTouch.setAttribute("aria-label", game.player.veilCooldown > 0 ? "Ghost veil recharging" : "Vanish: ready");
  ui.hookTouch.setAttribute("aria-label", game.player.hookCooldown > 0 ? "Rift hook recharging" : "Rift hook ready");
  ui.guardTouch.setAttribute("aria-label", game.player.guardCooldown > 0 ? "Lantern guard recharging" : "Lantern guard ready");
}

function announce(message, duration = 1450) {
  window.clearTimeout(calloutTimeout);
  ui.callout.textContent = message;
  ui.callout.hidden = false;
  calloutTimeout = window.setTimeout(() => { ui.callout.hidden = true; }, duration);
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

function isJevPounceThreateningPlayer() {
  const player = game.player;
  const jev = game.jev;
  if (jev.pouncePhase === "windup" && jev.pounceTarget && distance(jev.pounceTarget, player) < 128) return true;
  if (jev.pouncePhase !== "lunge" || jev.pounceTimer <= 0) return false;
  const speedSquared = jev.pounceVx ** 2 + jev.pounceVy ** 2 || 1;
  const time = clamp(
    ((player.x - jev.x) * jev.pounceVx + (player.y - jev.y) * jev.pounceVy) / speedSquared,
    0,
    Math.min(0.34, jev.pounceTimer),
  );
  const predicted = { x: jev.x + jev.pounceVx * time, y: jev.y + jev.pounceVy * time };
  return distance(predicted, player) < player.radius + jev.radius + 34;
}

function isJevAttackThreateningPlayer() {
  const player = game.player;
  const jev = game.jev;
  if (isJevPounceThreateningPlayer()) return true;
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

function startDash() {
  if (!game?.running) return;
  if (game.player.dashCooldown > 0) { announce("Dash recharging", 700); return; }
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
  game.player.dashVx = x;
  game.player.dashVy = y;
  game.player.dashTimer = 0.18;
  game.player.dashCooldown = 1.15;
  game.player.invulnerable = Math.max(game.player.invulnerable, 0.25);
  remember("dash");
  emitParticles(game.player.x, game.player.y, "#c6e7e7", 9, 100);
  queueJevDecision();
}

function useSoulBurst() {
  if (!game?.running) return;
  if (game.player.pulseCooldown > 0) return;
  breakGhostVeil();
  game.player.pulseCooldown = 3.6;
  game.player.pulseTimer = 0.42;
  remember("soul_burst");
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
    jev.pouncePhase = "";
    jev.pounceTimer = 0;
    if (jev.blastPhase) remember("blast_canceled");
    jev.blastPhase = "";
    jev.blastTimer = 0;
    jev.blastTarget = null;
    jev.phaseStepPhase = "";
    jev.phaseStepTimer = 0;
    jev.phaseStepTarget = null;
    if (game.anchors.every((anchor) => anchor.health <= 0)) jev.health = Math.max(0, jev.health - 1);
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
  emitParticles(player.x, player.y, "#a8f3df", 26, 145);
  announce("Three mirror copies");
  queueJevDecision();
}

function useGhostVeil() {
  const player = game?.player;
  if (!game?.running || !player || player.veilCooldown > 0 || player.veilTimer > 0) return;
  player.lastKnown = { x: player.x, y: player.y };
  player.veilTimer = VEIL_DURATION;
  player.veilCooldown = 13;
  remember("ghost_veil");
  emitParticles(player.x, player.y, "#96e9dc", 20, 130);
  announce("Veil · move to break Jev's lock");
  queueJevDecision();
}

function breakGhostVeil() {
  const player = game?.player;
  if (!player || player.veilTimer <= 0) return;
  player.veilTimer = 0;
  remember("veil_broken");
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
  const minimumHookGap = Math.min(jevGap, GHOST_SAFE_GAP);
  let landing = null;
  for (let distanceAlong = travel; distanceAlong >= 105; distanceAlong -= 24) {
    const candidate = {
      x: clamp(player.x + dx / length * distanceAlong, 35, WORLD.width - 35),
      y: clamp(player.y + dy / length * distanceAlong, 35, WORLD.height - 35),
    };
    const preservesJevGap = game.mode !== "auto" || (
      distance(candidate, game.jev) >= GHOST_SAFE_GAP &&
      distanceToSegment(game.jev, player, candidate) >= minimumHookGap - 1
    );
    if (preservesJevGap && !blocked(candidate.x, candidate.y, player.radius) && isLaneClear(player, candidate, player.radius)) {
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
  emitParticles(player.x, player.y, "#b9f4e0", 16, 110);
  announce("Lantern guard ready");
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
  if (game.player.veilTimer > 0) {
    return { ...game.player.lastKnown, vx: 0, vy: 0, radius: game.player.radius, hidden: true };
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
  breakGhostVeil();
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
    x: player.x + dx * 19,
    y: player.y + dy * 19,
    vx: dx * PLAYER_SHOT_SPEED,
    vy: dy * PLAYER_SHOT_SPEED,
    radius: 7,
    life: 1.24,
    age: 0,
  });
  if (game.projectiles.length > 28) game.projectiles.shift();
}

function hitJev(projectile) {
  const jev = game.jev;
  if (game.anchors.some((anchor) => anchor.health > 0)) {
    emitParticles(projectile.x, projectile.y, "#ccadff", 9, 95);
    remember("ward_blocked");
    return;
  }
  jev.health = Math.max(0, jev.health - 1);
  jev.hurtTimer = 0.18;
  game.player.hitsLanded += 1;
  if (jev.blastPhase === "windup") {
    jev.blastPhase = "";
    jev.blastTimer = 0;
    jev.blastTarget = null;
    remember("blast_canceled");
  }
  if (jev.pouncePhase === "windup") {
    jev.pouncePhase = "";
    jev.pounceTimer = 0;
    jev.pounceTarget = null;
  }
  if (jev.phaseStepPhase === "windup") {
    jev.phaseStepPhase = "";
    jev.phaseStepTimer = 0;
    jev.phaseStepTarget = null;
    remember("phase_step_canceled");
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
  emitParticles(projectile.x, projectile.y, "#9ff7e2", 15, 125);
  screenShake = Math.max(screenShake, 2.2);
  if (jev.health <= 0) {
    announce("Jev defeated");
    finishGame("fight");
  } else {
    queueJevDecision();
  }
}

function hitAnchor(anchor) {
  if (!anchor || anchor.health <= 0) return;
  anchor.health = Math.max(0, anchor.health - 1);
  anchor.hitFlash = 0.3;
  game.player.hitsLanded += 1;
  remember(anchor.health === 0 ? "anchor_broken" : "anchor_hit");
  emitParticles(anchor.x, anchor.y, anchor.health === 0 ? "#a3f1d8" : "#c2a2ff", anchor.health === 0 ? 30 : 13, 130);
  screenShake = Math.max(screenShake, anchor.health === 0 ? 4.5 : 2.2);
  renderHud(true);
  if (anchor.health === 0) {
    announce(game.anchors.every((item) => item.health <= 0) ? "Ward broken · Jev exposed" : "Rift anchor shattered");
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
  return Math.abs(localX) < block.w / 2 + radius && Math.abs(localY) < block.h / 2 + radius;
}

function blocked(x, y, radius) {
  if (x - radius < 21 || x + radius > WORLD.width - 21 || y - radius < 22 || y + radius > WORLD.height - 21) return true;
  return blocks.some((block) => obstacleContains(x, y, block, radius));
}

function hazardState(hazard) {
  if (!hazard.period) return { active: true, warning: false };
  const cycle = (game.elapsed + hazard.phase) % hazard.period;
  return {
    active: cycle < hazard.activeFor,
    warning: cycle >= hazard.period - hazard.warningFor,
  };
}

function insideHazard(point, hazard) {
  return point.x >= hazard.x && point.x <= hazard.x + hazard.w &&
    point.y >= hazard.y && point.y <= hazard.y + hazard.h;
}

function environmentEffects(point) {
  const effect = { speed: 1, flowX: 0, flowY: 0 };
  for (const hazard of game.hazards) {
    if (!insideHazard(point, hazard)) continue;
    const status = hazardState(hazard);
    if (hazard.kind === "current") {
      effect.flowX += hazard.flowX * 105;
      effect.flowY += hazard.flowY * 105;
    } else if (status.active && (hazard.kind === "steam" || hazard.kind === "spores")) {
      effect.speed = Math.min(effect.speed, hazard.kind === "steam" ? 0.56 : 0.68);
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

function predictedPounceTarget() {
  const player = combatTarget();
  if (player !== game.player) return { x: player.x, y: player.y };
  const flightTime = estimateInterceptTime(game.jev, player, POUNCE_SPEED, POUNCE_WINDUP, POUNCE_MAX_FLIGHT);
  return predictPlayerPosition(POUNCE_WINDUP + flightTime);
}

function predictPlayerPosition(duration) {
  const player = combatTarget();
  if (player !== game.player) return { x: player.x, y: player.y };
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

function isLaneClear(origin, target, radius) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const steps = Math.ceil(Math.hypot(dx, dy) / 8);
  for (let index = 1; index < steps; index += 1) {
    const x = origin.x + dx * index / steps;
    const y = origin.y + dy * index / steps;
    if (blocked(x, y, radius)) return false;
  }
  return true;
}

function isPowerBlastLaneClear(origin, target) {
  return isLaneClear(origin, target, 14);
}

function moveEntity(entity, dx, dy, radius) {
  const nextX = entity.x + dx;
  const nextY = entity.y + dy;
  if (!blocked(nextX, nextY, radius) && isLaneClear(entity, { x: nextX, y: nextY }, radius)) {
    entity.x = nextX;
    entity.y = nextY;
  } else {
    let movedX = false;
    let movedY = false;
    if (!blocked(nextX, entity.y, radius) && isLaneClear(entity, { x: nextX, y: entity.y }, radius)) {
      entity.x = nextX;
      movedX = true;
    }
    if (!blocked(entity.x, nextY, radius) && isLaneClear(entity, { x: entity.x, y: nextY }, radius)) {
      entity.y = nextY;
      movedY = true;
    }
    if (!movedX && !movedY) {
      for (const frac of [0.6, 0.3]) {
        const fx = entity.x + dx * frac;
        const fy = entity.y + dy * frac;
        if (!blocked(fx, entity.y, radius)) { entity.x = fx; break; }
        if (!blocked(entity.x, fy, radius)) { entity.y = fy; break; }
      }
    }
  }
  entity.x = clamp(entity.x, 21 + radius, WORLD.width - 21 - radius);
  entity.y = clamp(entity.y, 22 + radius, WORLD.height - 21 - radius);
}

function startPounce() {
  const jev = game.jev;
  const targetActor = combatTarget();
  if (jev.pounceCooldown > 0 || jev.pouncePhase || jev.blastPhase || jev.stunned > 0) return;
  if (distance(targetActor, jev) > 315) return;
  const target = predictedPounceTarget();
  if (!isLaneClear(jev, target, jev.radius)) return;
  jev.pounceTarget = target;
  jev.pouncePhase = "windup";
  if (Math.abs(target.x - jev.x) > 5) jev.facing = Math.sign(target.x - jev.x);
  jev.pounceTimer = POUNCE_WINDUP;
  jev.pounceCooldown = 3.25;
  jev.pounceHit = false;
  jev.path = [];
  announce("Jev is winding up!");
  emitParticles(jev.x, jev.y, "#f07d69", 10, 90);
}

function startPowerBlast() {
  const jev = game.jev;
  const gap = distance(combatTarget(), jev);
  if (jev.blastCooldown > 0 || jev.blastPhase || jev.pouncePhase || jev.stunned > 0 || gap < 174 || gap > 475) return;
  const target = predictedPowerBlastTarget();
  if (!isPowerBlastLaneClear(jev, target)) return;
  jev.blastTarget = target;
  jev.blastPhase = "windup";
  if (Math.abs(target.x - jev.x) > 5) jev.facing = Math.sign(target.x - jev.x);
  jev.blastTimer = POWER_BLAST_WINDUP;
  jev.blastCooldown = 3.45;
  announce("Jev is charging a blast!");
  emitParticles(jev.x, jev.y, "#f2c36f", 14, 110);
}

function firePowerBlast() {
  const jev = game.jev;
  if (!jev.blastTarget) return;
  const dx = jev.blastTarget.x - jev.x;
  const dy = jev.blastTarget.y - jev.y;
  const length = Math.hypot(dx, dy) || 1;
  game.projectiles.push({
    owner: "jev",
    x: jev.x, y: jev.y - 5,
    vx: dx / length * POWER_BLAST_SPEED, vy: dy / length * POWER_BLAST_SPEED,
    radius: 14, life: 2.2, age: 0,
  });
  jev.facing = Math.sign(dx || jev.facing);
  jev.blastPhase = "";
  jev.blastTarget = null;
  remember("power_blast_fired");
  announce("Blast fired!", 700);
  emitParticles(jev.x, jev.y, "#ffc977", 12, 125);
}

function startSoulSalvo() {
  const jev = game.jev;
  const target = combatTarget();
  const gap = distance(target, jev);
  if (jev.salvoCooldown > 0 || jev.salvoPhase || jev.pouncePhase || jev.blastPhase || jev.stunned > 0 || gap < 240 || gap > 820) return;
  const aim = target === game.player ? predictedPowerBlastTarget() : { x: target.x, y: target.y };
  if (!isLaneClear(jev, aim, jev.radius)) return;
  jev.salvoTarget = aim;
  jev.salvoPhase = "windup";
  jev.salvoTimer = SOUL_SALVO_WINDUP;
  jev.salvoCooldown = 7.4;
  jev.path = [];
  jev.facing = Math.sign(aim.x - jev.x || jev.facing);
  remember("soul_salvo_windup");
  announce("Jev is gathering a soul salvo");
  emitParticles(jev.x, jev.y, "#ff9c73", 17, 120);
}

function fireSoulSalvo() {
  const jev = game.jev;
  if (!jev.salvoTarget) return;
  const angle = Math.atan2(jev.salvoTarget.y - jev.y, jev.salvoTarget.x - jev.x);
  for (const offset of [-0.24, 0, 0.24]) {
    const shotAngle = angle + offset;
    game.projectiles.push({
      owner: "jev", kind: "salvo", x: jev.x, y: jev.y - 6,
      vx: Math.cos(shotAngle) * SOUL_SALVO_SPEED,
      vy: Math.sin(shotAngle) * SOUL_SALVO_SPEED,
      radius: 11, life: 1.9, age: 0,
    });
  }
  jev.salvoPhase = "";
  jev.salvoTarget = null;
  remember("soul_salvo_fired");
  announce("Soul salvo", 650);
  emitParticles(jev.x, jev.y, "#ffad7c", 16, 155);
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
  announce("Wraithlings unleashed");
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

function startPhaseStep() {
  const jev = game.jev;
  const gap = distance(combatTarget(), jev);
  if (jev.phaseStepCooldown > 0 || gap < 170 || gap > 540 || jev.pouncePhase || jev.blastPhase) return;
  jev.phaseStepTarget = predictPlayer(clamp(gap / 900, 0.18, 0.38));
  jev.phaseStepPhase = "windup";
  jev.phaseStepTimer = 0.24;
  jev.phaseStepCooldown = 5.8;
  jev.path = [];
  remember("phase_step_windup");
  emitParticles(jev.x, jev.y, "#c491ff", 12, 95);
}

function completePhaseStep() {
  const jev = game.jev;
  if (!jev.phaseStepTarget) return;
  const start = { x: jev.x, y: jev.y };
  const dx = jev.phaseStepTarget.x - jev.x;
  const dy = jev.phaseStepTarget.y - jev.y;
  const length = Math.hypot(dx, dy) || 1;
  const travel = Math.min(260, Math.max(0, length - 105));
  const steps = Math.max(1, Math.ceil(travel / 7));
  for (let index = 0; index < steps; index += 1) {
    const step = travel / steps;
    const beforeX = jev.x;
    const beforeY = jev.y;
    moveEntity(jev, dx / length * step, dy / length * step, jev.radius);
    if (Math.hypot(jev.x - beforeX, jev.y - beforeY) < step * 0.35) break;
  }
  jev.phaseStepPhase = "";
  jev.phaseStepTarget = null;
  jev.facing = Math.sign(jev.x - start.x || jev.facing);
  remember("phase_step_used");
  emitParticles(start.x, start.y, "#c491ff", 18, 120);
  emitParticles(jev.x, jev.y, "#eea8ff", 20, 135);
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
  return predictPlayer(jev.mode === "pounce" || jev.mode === "rift_mine" ? 0.22 : 0.34);
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
  const urgentModes = ["rift_mine", "pounce", "phase_step", "shadow_dodge", "summon_wraiths", "meteor_storm"];
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

function cellBlocked(gx, gy) {
  const cols = WORLD.width / WORLD.cell;
  const rows = WORLD.height / WORLD.cell;
  if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) return true;
  let grid = collisionGridCache.get(blocks);
  if (!grid) {
    grid = new Uint8Array(cols * rows);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const centerX = x * WORLD.cell + WORLD.cell / 2;
        const centerY = y * WORLD.cell + WORLD.cell / 2;
        const edge = centerX - 17 < 21 || centerX + 17 > WORLD.width - 21 || centerY - 17 < 22 || centerY + 17 > WORLD.height - 21;
        if (edge || blocks.some((block) => obstacleContains(centerX, centerY, block, 17))) grid[y * cols + x] = 1;
      }
    }
    collisionGridCache.set(blocks, grid);
  }
  return grid[gy * cols + gx] === 1;
}

function findPath(start, target, avoidEntity = null) {
  const cols = WORLD.width / WORLD.cell;
  const rows = WORLD.height / WORLD.cell;
  const toCell = (value, count) => clamp(Math.floor(value / WORLD.cell), 0, count - 1);
  const keyOf = (x, y) => y * cols + x;
  const nearestOpenCell = (centerX, centerY) => {
    if (!cellBlocked(centerX, centerY)) return { x: centerX, y: centerY };
    for (let radius = 1; radius < Math.max(cols, rows); radius += 1) {
      let best = null;
      let bestDistance = Infinity;
      for (let y = Math.max(0, centerY - radius); y <= Math.min(rows - 1, centerY + radius); y += 1) {
        for (let x = Math.max(0, centerX - radius); x <= Math.min(cols - 1, centerX + radius); x += 1) {
          if (Math.max(Math.abs(x - centerX), Math.abs(y - centerY)) !== radius || cellBlocked(x, y)) continue;
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
    return { x: centerX, y: centerY };
  };
  const startCell = nearestOpenCell(toCell(start.x, cols), toCell(start.y, rows));
  const endCell = nearestOpenCell(toCell(target.x, cols), toCell(target.y, rows));
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
      if (x < 0 || x >= cols || y < 0 || y >= rows || cellBlocked(x, y)) continue;
      if (dx && dy && (cellBlocked(current.x + dx, current.y) || cellBlocked(current.x, current.y + dy))) continue;
      const key = keyOf(x, y);
      const center = { x: x * WORLD.cell + WORLD.cell / 2, y: y * WORLD.cell + WORLD.cell / 2 };
      if (avoidEntity) {
        const nextAvoidGap = distance(center, avoidEntity);
        const currentCenter = { x: current.x * WORLD.cell + WORLD.cell / 2, y: current.y * WORLD.cell + WORLD.cell / 2 };
        const currentAvoidGap = distance(currentCenter, avoidEntity);
        if ((!escapingAvoidZone && nextAvoidGap < avoidDistance) || (escapingAvoidZone && nextAvoidGap < currentAvoidGap - 1)) continue;
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
    return !blocked(target.x, target.y, start.radius) && isLaneClear(start, target, start.radius) ? [target] : [];
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
  const path = [];
  let anchor = start;
  let nextIndex = 0;
  while (nextIndex < rawPath.length) {
    let farthest = rawPath.length - 1;
    while (farthest > nextIndex && (!isLaneClear(anchor, rawPath[farthest], start.radius) || !routeClear(anchor, rawPath[farthest]))) farthest -= 1;
    anchor = rawPath[farthest];
    path.push(anchor);
    nextIndex = farthest + 1;
  }
  if (reachedTarget && !blocked(target.x, target.y, start.radius) && isLaneClear(anchor, target, start.radius)) path.push(target);
  return path;
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
      if (distance(entity, candidate) < 34 || blocked(candidate.x, candidate.y, entity.radius)) continue;
      const offsetOrigin = {
        x: entity.x + Math.cos(angle) * 12,
        y: entity.y + Math.sin(angle) * 12,
      };
      if (!isLaneClear(offsetOrigin, candidate, entity.radius * 0.75)) continue;
      const enemySpacingCost = entity === game.player && game.anchors.some((anchor) => anchor.health > 0)
        ? Math.max(0, 280 - distance(candidate, game.jev)) * 5
        : 0;
      const cost = distance(candidate, target) + distance(entity, candidate) * 0.2 + enemySpacingCost;
      if (cost < bestCost) {
        best = candidate;
        bestCost = cost;
      }
    }
    if (best) return best;
  }
  return best;
}

function updateJev(dt) {
  const jev = game.jev;
  const difficulty = DIFFICULTY_SETTINGS[game.difficulty] || DIFFICULTY_SETTINGS.standard;
  const cooldownScale = (game.enraged ? 1.22 : 1) * difficulty.cooldown;
  jev.stunned = Math.max(0, jev.stunned - dt);
  jev.hurtTimer = Math.max(0, (jev.hurtTimer || 0) - dt);
  jev.pounceCooldown = Math.max(0, jev.pounceCooldown - dt * cooldownScale);
  jev.blastCooldown = Math.max(0, jev.blastCooldown - dt * cooldownScale);
  jev.salvoCooldown = Math.max(0, jev.salvoCooldown - dt * cooldownScale);
  jev.mineCooldown = Math.max(0, jev.mineCooldown - dt * cooldownScale);
  jev.phaseStepCooldown = Math.max(0, jev.phaseStepCooldown - dt * cooldownScale);
  jev.shadowDodgeCooldown = Math.max(0, jev.shadowDodgeCooldown - dt * cooldownScale);
  jev.summonCooldown = Math.max(0, jev.summonCooldown - dt * cooldownScale);
  jev.meteorCooldown = Math.max(0, jev.meteorCooldown - dt * cooldownScale);
  if (jev.recoverTimer > 0) jev.recoverTimer = Math.max(0, jev.recoverTimer - dt);
  if (jev.stunned > 0) {
    jev.pouncePhase = "";
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
  if (jev.pouncePhase === "windup") {
    jev.pounceTimer -= dt;
    jev.vx = 0;
    jev.vy = 0;
    if (jev.pounceTimer <= 0) {
      const dx = jev.pounceTarget.x - jev.x;
      const dy = jev.pounceTarget.y - jev.y;
      const length = Math.hypot(dx, dy) || 1;
      jev.pounceVx = dx / length * POUNCE_SPEED;
      jev.pounceVy = dy / length * POUNCE_SPEED;
      jev.pouncePhase = "lunge";
      jev.pounceTimer = Math.min(POUNCE_MAX_FLIGHT, length / POUNCE_SPEED);
    }
    return;
  }
  if (jev.pouncePhase === "lunge") {
    const step = Math.min(dt, jev.pounceTimer);
    jev.vx = jev.pounceVx;
    jev.vy = jev.pounceVy;
    if (Math.abs(jev.vx) > 5) jev.facing = Math.sign(jev.vx);
    moveEntity(jev, jev.vx * step, jev.vy * step, jev.radius);
    jev.pounceTimer -= dt;
    if (jev.pounceTimer <= 0) {
      if (!jev.pounceHit && distance(combatTarget(), jev) > (combatTarget().radius || game.player.radius) + jev.radius + 8) {
        remember("pounce_missed");
        queueJevDecision();
      }
      jev.pouncePhase = "recover";
      jev.recoverTimer = 0.22;
    }
    return;
  }
  if (jev.pouncePhase === "recover" || jev.recoverTimer > 0) {
    if (jev.recoverTimer <= 0) jev.pouncePhase = "";
    jev.vx *= Math.pow(0.04, dt);
    jev.vy *= Math.pow(0.04, dt);
    return;
  }
  if (jev.phaseStepPhase === "windup") {
    jev.phaseStepTimer -= dt;
    jev.vx = 0;
    jev.vy = 0;
    if (jev.phaseStepTimer <= 0) completePhaseStep();
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
    jev.salvoTarget = target === game.player ? predictedPowerBlastTarget() : { x: target.x, y: target.y };
    if (jev.salvoTimer <= 0) fireSoulSalvo();
    return;
  }
  if (jev.blastPhase === "windup") {
    jev.blastTimer -= dt;
    jev.vx *= Math.pow(0.04, dt);
    jev.vy *= Math.pow(0.04, dt);
    const predictedTarget = predictedPowerBlastTarget();
    if (isPowerBlastLaneClear(jev, predictedTarget)) jev.blastTarget = predictedTarget;
    if (jev.blastTimer <= 0) firePowerBlast();
    return;
  }
  let target = jevTarget();
  if (jev.recoveryTarget) {
    if (game.elapsed >= jev.recoveryUntil || distance(jev, jev.recoveryTarget) < 26) {
      jev.recoveryTarget = null;
      jev.recoveryUntil = 0;
    } else {
      target = jev.recoveryTarget;
    }
  }
  if (game.elapsed >= jev.nextPathAt || !jev.path.length) {
    jev.path = findPath(jev, target);
    jev.nextPathAt = game.elapsed + 0.14;
  }
  while (jev.path.length && distance(jev, jev.path[0]) < 13) jev.path.shift();
  const targetLaneClear = !blocked(target.x, target.y, jev.radius) && isLaneClear(jev, target, jev.radius);
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
    pounce: 282,
    rift_mine: 296,
    phase_step: 298,
    shadow_dodge: 340,
    summon_wraiths: 310,
    meteor_storm: 316,
  };
  const terrain = environmentEffects(jev);
  const autoPressure = game.mode === "auto" ? 1.12 : 1;
  const speed = (speeds[jev.mode] || speeds.pursue) * terrain.speed * autoPressure * difficulty.speed * (game.enraged ? 1.2 : 1);
  jev.vx = dx * speed + terrain.flowX;
  jev.vy = dy * speed + terrain.flowY;
  jev.facing = Math.sign(dx || jev.facing);
  const beforeX = jev.x;
  const beforeY = jev.y;
  const waypointGap = distance(jev, waypoint);
  moveEntity(jev, jev.vx * dt, jev.vy * dt, jev.radius);
  const moved = Math.hypot(jev.x - beforeX, jev.y - beforeY);
  const waypointProgress = waypointGap - distance(jev, waypoint);
  if (distance(jev, target) > 36 && waypointProgress < Math.max(0.5, dt * 20)) jev.stuckTimer += dt;
  else jev.stuckTimer = 0;
  if (jev.stuckTimer >= 0.32) {
    const targetEntity = combatTarget();
    if (jev.phaseStepCooldown <= 0 || jev.stuckTimer >= 0.52) {
      jev.stuckTimer = 0;
      jev.phaseStepCooldown = 3.6;
      const angleToTarget = Math.atan2(targetEntity.y - jev.y, targetEntity.x - jev.x);
      let blinkTarget = null;
      for (const dist of [180, 140, 220, 100]) {
        for (const angleOffset of [0, 0.4, -0.4, 0.8, -0.8]) {
          const pt = {
            x: clamp(jev.x + Math.cos(angleToTarget + angleOffset) * dist, 40, WORLD.width - 40),
            y: clamp(jev.y + Math.sin(angleToTarget + angleOffset) * dist, 40, WORLD.height - 40),
          };
          if (!blocked(pt.x, pt.y, jev.radius)) {
            blinkTarget = pt;
            break;
          }
        }
        if (blinkTarget) break;
      }
      if (blinkTarget) {
        emitParticles(jev.x, jev.y, "#c491ff", 18, 120);
        jev.x = blinkTarget.x;
        jev.y = blinkTarget.y;
        jev.path = [];
        jev.nextPathAt = game.elapsed;
        emitParticles(jev.x, jev.y, "#eea8ff", 20, 135);
        remember("phase_step_used");
        announce("Jev phases through cover!");
        return;
      }
    }
    const recovery = findRecoveryTarget(jev, jevTarget(), jev.recoveryAttempts);
    jev.recoveryAttempts += 1;
    jev.stuckTimer = 0;
    if (recovery) {
      jev.recoveryTarget = recovery;
      jev.recoveryUntil = game.elapsed + 0.8;
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
  player.veilCooldown = Math.max(0, player.veilCooldown - dt);
  player.guardTimer = Math.max(0, player.guardTimer - dt);
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.snaredTimer = Math.max(0, player.snaredTimer - dt);
  player.dashTimer = Math.max(0, player.dashTimer - dt);
  player.pulseTimer = Math.max(0, player.pulseTimer - dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.veilTimer = Math.max(0, player.veilTimer - dt);
  if (player.veilTimer <= 0) player.lastKnown = { x: player.x, y: player.y };
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
  moveEntity(player, player.vx * dt, player.vy * dt, player.radius);
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
  if (player.veilTimer <= 0 && (game.mode === "auto" ? player.fireHeld : player.fireHeld || keys.has("z"))) {
    if (player.fireCooldown <= 0) firePlayerShot();
  }
}

function updateMirrorClones(dt) {
  const player = game.player;
  const active = [];
  for (const clone of player.clones) {
    clone.life -= dt;
    if (clone.life <= 0) continue;
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
    if (currentGap <= 690 && distance(game.player, game.jev) >= GHOST_SAFE_GAP && isLaneClear(game.player, target, 8)) {
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
  const candidates = Array.from({ length: 16 }, (_, index) => {
    const angle = index * Math.PI / 8;
    const point = {
      x: clamp(player.x + Math.cos(angle) * 290, 42, WORLD.width - 42),
      y: clamp(player.y + Math.sin(angle) * 290, 42, WORLD.height - 42),
    };
    const hazardCost = game.hazards.reduce((sum, hazard) => sum + (insideHazard(point, hazard) ? 260 : 0), 0);
    const nearestProjectile = threats.reduce((min, projectile) => Math.min(min, distance(point, projectile)), Infinity);
    const nearestAreaThreat = areaThreats.reduce((min, hazard) => Math.min(min, Math.max(0, distance(point, hazard) - hazard.radius)), Infinity);
    const anchor = aiObjectiveTarget();
    const objectiveCost = game.anchors.some((item) => item.health > 0) ? distance(point, anchor) * 0.08 : 0;
    const areaThreatCost = Number.isFinite(nearestAreaThreat) ? -Math.min(420, nearestAreaThreat) * 0.72 : 0;
    return { ...point, score: distance(point, game.jev) * -0.28 - Math.min(420, nearestProjectile) * 0.72 + areaThreatCost + hazardCost + objectiveCost };
  }).filter((point) => !blocked(point.x, point.y, player.radius));
  const safeCandidates = candidates.filter((point) => distance(point, game.jev) >= GHOST_SAFE_GAP);
  return (safeCandidates.length ? safeCandidates : candidates).sort((left, right) => left.score - right.score)[0] || player;
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

function updateAIPlayer() {
  const player = game.player;
  const tactic = player.aiTactic;
  const activeAnchors = game.anchors.filter((anchor) => anchor.health > 0);
  const objective = aiObjectiveTarget();
  player.aim = objective === game.jev ? predictedShotTarget() : { x: objective.x, y: objective.y };
  let objectiveGap = distance(player, objective);
  let jevGap = distance(player, game.jev);
  let contactSeconds = secondsToGhostSafeGap(player, player, game.jev);
  let contactRisk = jevGap < GHOST_SAFE_GAP || (contactSeconds !== null && contactSeconds < 0.7 && jevGap < GHOST_SAFE_GAP + 200);
  let threatened = isJevAttackThreateningPlayer();
  const pounceThreat = isJevPounceThreateningPlayer();
  const areaThreat = (
    game.activeMine && game.activeMine.warning <= 0.34 &&
    distance(game.activeMine, player) < game.activeMine.radius + player.radius + 40
  ) || game.meteors.some((meteor) =>
    meteor.delay <= 0.28 && distance(meteor, player) < meteor.radius + player.radius + 34
  ) || game.minions.some((wraith) =>
    distance(wraith, player) < wraith.radius + player.radius + 45
  );

  if (tactic === "rift_hook" && player.hookCooldown <= 0 && objectiveGap > 420) {
    useRiftHook(player.aiObjectivePosition || objective);
  }
  if (tactic === "mirror_echo" && player.echoCooldown <= 0 && !player.echo && (threatened || jevGap < 430)) useMirrorEcho();
  if (tactic === "ghost_veil" && player.veilCooldown <= 0 && (threatened || jevGap < 360)) useGhostVeil();
  if (tactic === "lantern_guard" && player.guardCooldown <= 0 && threatened) useLanternGuard();
  if (tactic === "soul_burst" && player.pulseCooldown <= 0 && distance(player, objective) < 165) useSoulBurst();

  objectiveGap = distance(player, objective);
  jevGap = distance(player, game.jev);
  contactSeconds = secondsToGhostSafeGap(player, player, game.jev);
  contactRisk = jevGap < GHOST_SAFE_GAP || (contactSeconds !== null && contactSeconds < 0.7 && jevGap < GHOST_SAFE_GAP + 200);
  threatened = isJevAttackThreateningPlayer();

  const guardNow = player.guardCooldown <= 0 && player.guardTimer <= 0 &&
    (pounceThreat || jevGap < 125 || (threatened && jevGap < 245));
  if (guardNow) {
    useLanternGuard();
    recordGhostActionOverride("lantern_guard");
  } else if ((contactRisk || (threatened && jevGap < 410)) && player.echoCooldown <= 0 && !player.echo) {
    useMirrorEcho();
    recordGhostActionOverride("mirror_echo");
  } else if ((contactRisk || (threatened && jevGap < 300)) && player.veilCooldown <= 0 && player.veilTimer <= 0) {
    useGhostVeil();
    recordGhostActionOverride("ghost_veil");
  }

  const mustEvade = threatened || pounceThreat || areaThreat || contactRisk;
  if (mustEvade && player.dashCooldown <= 0 && player.dashTimer <= 0 && (threatened || jevGap < 185)) {
    const escape = aiEvadePoint();
    const dx = escape.x - player.x;
    const dy = escape.y - player.y;
    const length = Math.hypot(dx, dy) || 1;
    player.aiInput = { x: dx / length, y: dy / length };
    startDash();
    recordGhostActionOverride("evade_warning");
  } else if (contactRisk && !["lantern_guard", "mirror_echo", "ghost_veil"].includes(player.aiTactic)) {
    recordGhostActionOverride("evade_warning");
  }

  const anchorApproach = player.aiObjectivePosition || objective;
  const approachGap = distance(player, anchorApproach);
  const wantsHook = tactic === "rift_hook" || (tactic === "advance_anchor" && approachGap > 780);
  if (activeAnchors.length && wantsHook && player.hookCooldown <= 0 && !mustEvade && jevGap > GHOST_SAFE_GAP + 90) {
    if (useRiftHook(anchorApproach) && tactic !== "rift_hook") recordGhostActionOverride("rift_hook");
  }

  objectiveGap = distance(player, objective);
  jevGap = distance(player, game.jev);
  const hasAnchorObjective = objective !== game.jev;
  const safeToFire = !hasAnchorObjective || jevGap >= GHOST_SAFE_GAP;
  const objectiveInRange = objectiveGap <= (hasAnchorObjective ? 690 : 740);
  const clearLane = isLaneClear(player, player.aim, 8);
  player.fireHeld = player.veilTimer <= 0 && safeToFire && objectiveInRange && clearLane;

  let destination;
  const evading = threatened || pounceThreat || areaThreat || contactRisk || (tactic === "evade_warning" && threatened);
  if (evading) destination = aiEvadePoint();
  else destination = aiAttackPosition(objective, activeAnchors.length > 0 ? 260 : 420);
  if (evading) {
    player.recoveryTarget = null;
    player.recoveryUntil = 0;
  } else if (player.recoveryTarget) {
    if (game.elapsed >= player.recoveryUntil || distance(player, player.recoveryTarget) < 26) {
      player.recoveryTarget = null;
      player.recoveryUntil = 0;
    } else {
      destination = player.recoveryTarget;
    }
  }
  player.aiTarget = destination;

  const pathRefresh = evading ? 0.08 : 0.24;
  if (game.elapsed >= player.aiNextPathAt || !player.aiPath.length) {
    player.aiPath = findPath(player, destination, game.jev);
    player.aiNextPathAt = game.elapsed + pathRefresh;
  }
  while (player.aiPath.length && distance(player, player.aiPath[0]) < 18) player.aiPath.shift();
  const targetLaneClear = !blocked(destination.x, destination.y, player.radius) && isLaneClear(player, destination, player.radius);
  const waypoint = player.aiPath[0] || (targetLaneClear ? destination : player);
  const dx = waypoint.x - player.x;
  const dy = waypoint.y - player.y;
  const length = Math.hypot(dx, dy);
  // Steering must continue until the path waypoint's 18-unit arrival radius.
  player.aiInput = length > 12 ? { x: dx / length, y: dy / length } : { x: 0, y: 0 };
  if (Math.abs(player.aiInput.x) > 0.15) player.facing = Math.sign(player.aiInput.x);
}

function checkContact() {
  const player = game.player;
  const jev = game.jev;
  const gap = distance(player, jev);
  if (gap > player.radius + jev.radius + 2 || player.invulnerable > 0 || player.hurtTimer > 0 || jev.stunned > 0) return;
  if (jev.pouncePhase === "lunge") {
    jev.pounceHit = true;
    remember(player.guardTimer > 0 ? "pounce_blocked" : "pounce_hit");
  }
  const angle = Math.atan2(player.y - jev.y, player.x - jev.x);
  damagePlayer("player_hit", Math.cos(angle), Math.sin(angle));
}

function damagePlayer(event, knockbackX, knockbackY) {
  const player = game.player;
  if (player.guardTimer > 0) {
    player.guardTimer = 0;
    player.guardCooldown = 0.4;
    game.jev.stunned = Math.max(game.jev.stunned, 0.85);
    remember("lantern_parry");
    emitParticles(player.x, player.y, "#bdf7df", 30, 200);
    announce("PERFECT PARRY!", 900);
    screenShake = Math.max(screenShake, 7);
    queueJevDecision();
    return false;
  }
  if (player.invulnerable > 0 || player.hurtTimer > 0) return false;
  breakGhostVeil();
  player.health -= 1;
  player.hurtTimer = 1.2;
  player.invulnerable = 0.8;
  moveEntity(player, knockbackX * 45, knockbackY * 45, player.radius);
  remember(event);
  renderHealth();
  announce(event === "mine_hit"
    ? player.health > 0 ? "Rift mine detonated" : "Jev caught you"
    : event === "salvo_hit"
      ? player.health > 0 ? "Soul salvo hit" : "Jev caught you"
      : event === "blast_hit"
        ? player.health > 0 ? "Blast hit" : "Jev caught you"
      : player.health > 0 ? "Jev caught you" : "Jev caught you");
  emitParticles(player.x, player.y, "#ff806d", 20, 170);
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
      projectile.x += projectile.vx * dt / steps;
      projectile.y += projectile.vy * dt / steps;
      const anchor = projectile.owner === "player"
        ? game.anchors.find((item) => item.health > 0 && distance(projectile, item) <= projectile.radius + 31)
        : null;
      const mirrorClone = projectile.owner === "jev"
        ? game.player.clones.find((clone) => distance(projectile, clone) <= projectile.radius + clone.radius)
        : null;
      if (anchor) {
        hitAnchor(anchor);
        consumed = true;
      } else if (mirrorClone) {
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
              owner: "player", kind: "reflected", x: game.player.x, y: game.player.y,
              vx: (game.jev.x - game.player.x) / reflectLength * PLAYER_SHOT_SPEED,
              vy: (game.jev.y - game.player.y) / reflectLength * PLAYER_SHOT_SPEED,
              radius: 9, life: 0.8, age: 0,
            });
          }
          const projectileOutcome = projectile.kind === "salvo" ? "salvo_hit" : "blast_hit";
          const knockback = Math.hypot(projectile.vx, projectile.vy) || 1;
          if (parrying) remember(projectile.kind === "salvo" ? "salvo_blocked" : "blast_blocked");
          if (!damagePlayer(projectileOutcome, projectile.vx / knockback, projectile.vy / knockback) && !parrying) {
            remember(projectile.kind === "salvo" ? "salvo_dodged" : "blast_dodged");
            emitParticles(projectile.x, projectile.y, "#bfe8ef", 12, 105);
          }
        }
        consumed = true;
        } else if (blocked(projectile.x, projectile.y, projectile.radius)) {
          remember(projectile.owner === "player" ? "shot_blocked" : projectile.kind === "salvo" ? "salvo_blocked" : "blast_blocked");
          emitParticles(projectile.x, projectile.y, projectile.owner === "player" ? "#9ff7e2" : "#e5ae72", 10, 80);
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

function emitParticles(x, y, color, count, speed) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.25 + Math.random() * 0.75);
    particles.push({
      x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity,
      life: 0.35 + Math.random() * 0.45, maxLife: 0.8, size: 1.5 + Math.random() * 3, color,
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
  const cameraX = clamp(game.player.x - viewWidth / 2, 0, WORLD.width - viewWidth);
  const cameraY = clamp(game.player.y - viewHeight / 2, 0, WORLD.height - viewHeight);
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
  drawBlocks(ctx);
  drawParticles(ctx);
  drawJev(ctx);
  drawWraithlings(ctx);
  drawMirrorEcho(ctx);
  drawPlayer(ctx);
  drawProjectiles(ctx);
  drawTacticalEffects(ctx);
  ctx.restore();
  if (game.elapsed - lastMapDrawAt > 0.12) {
    drawMapOverview();
    lastMapDrawAt = game.elapsed;
  }
}

function drawAnchors(ctx) {
  for (const anchor of game.anchors) {
    const broken = anchor.health <= 0;
    const ghostTarget = game.mode === "auto" && !broken && anchor.id === game.player.aiObjectiveAnchorId;
    const pulse = 0.5 + Math.sin(game.elapsed * 4.8 + anchor.id) * 0.13;
    const color = broken ? "#71827e" : anchor.hitFlash > 0 ? "#ffffff" : "#9ff2d7";
    ctx.save();
    ctx.globalAlpha = broken ? 0.28 : 0.9;
    const glow = ctx.createRadialGradient(anchor.x, anchor.y, 5, anchor.x, anchor.y, 66);
    glow.addColorStop(0, broken ? "rgb(121 153 143 / 20%)" : "rgb(108 238 201 / 29%)");
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
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y - 24);
    ctx.lineTo(anchor.x + 17, anchor.y);
    ctx.lineTo(anchor.x, anchor.y + 24);
    ctx.lineTo(anchor.x - 17, anchor.y);
    ctx.closePath();
    ctx.fillStyle = broken ? "rgb(118 150 141 / 30%)" : "rgb(129 246 211 / 26%)";
    ctx.fill();
    ctx.stroke();
    if (!broken) {
      for (let pip = 0; pip < anchor.maxHealth; pip += 1) {
        ctx.fillStyle = pip < anchor.health ? "#d8ffef" : "rgb(216 255 239 / 22%)";
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

function drawMirrorEcho(ctx) {
  for (const clone of game.player.clones) {
    const alpha = clamp(clone.life / clone.maxLife, 0.22, 0.75);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = "#91ffe1";
    ctx.shadowBlur = 24;
    ctx.strokeStyle = "#aaffea";
    ctx.fillStyle = "rgb(151 255 225 / 15%)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(clone.x, clone.y + 8, 29, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (artwork.ghost.complete && artwork.ghost.naturalWidth > 0) {
      drawSpriteFrame(ctx, artwork.ghost, 0, clone.x, clone.y, 60, 68, clone.facing < 0);
    }
    ctx.restore();
  }
}

function drawWraithlings(ctx) {
  for (const wraith of game.minions) {
    const pulse = 0.72 + Math.sin(game.elapsed * 11 + wraith.phase) * 0.13;
    ctx.save();
    ctx.translate(wraith.x, wraith.y);
    ctx.globalAlpha = pulse;
    ctx.shadowColor = "#cc86ff";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "rgb(171 100 224 / 74%)";
    ctx.strokeStyle = "#f0c6ff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, wraith.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#fff2d4";
    ctx.beginPath();
    ctx.arc(-4, -2, 1.8, 0, Math.PI * 2);
    ctx.arc(4, -2, 1.8, 0, Math.PI * 2);
    ctx.fill();
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
  for (const hazard of game.hazards) {
    const status = hazardState(hazard);
    ctx.fillStyle = status.active ? "rgb(252 124 151 / 54%)" : status.warning ? "rgb(255 209 126 / 48%)" : "rgb(175 144 210 / 22%)";
    ctx.fillRect(hazard.x, hazard.y, hazard.w, hazard.h);
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
  for (const anchor of game.anchors) {
    ctx.fillStyle = anchor.health > 0 ? "#9effdf" : "rgb(157 197 180 / 35%)";
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, anchor.health > 0 ? 32 : 22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ff836f";
  ctx.beginPath();
  ctx.arc(game.jev.x, game.jev.y, 35, 0, Math.PI * 2);
  ctx.fill();
  for (const clone of game.player.clones) {
    ctx.fillStyle = "#9ffff0";
    ctx.beginPath();
    ctx.arc(clone.x, clone.y, 21, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#fff0c7";
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

function drawFloor(ctx) {
  const floor = artwork.floors[game.level.biome];
  if (floor?.complete && floor.naturalWidth > 0) {
    ctx.drawImage(floor, 0, 0, WORLD.width, WORLD.height);
    const centerX = WORLD.width / 2;
    const centerY = WORLD.height / 2;
    const vignette = ctx.createRadialGradient(centerX, centerY, 220, centerX, centerY, WORLD.width * 0.74);
    vignette.addColorStop(0, "rgb(13 10 20 / 3%)");
    vignette.addColorStop(1, "rgb(11 8 18 / 37%)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    return;
  }
  if (game.level.biome === "cinder") {
    drawCinderFloor(ctx);
    return;
  }
  if (game.level.biome === "archive") {
    drawArchiveFloor(ctx);
    return;
  }
  if (game.level.biome === "garden") {
    drawGardenFloor(ctx);
    return;
  }
  if (game.level.biome === "vault") {
    drawVaultFloor(ctx);
    return;
  }
  if (game.level.biome === "rift") {
    drawRiftFloor(ctx);
    return;
  }
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
      steam: [255, 124, 72],
      current: [100, 221, 219],
      spores: [174, 229, 128],
      arc_sparks: [255, 210, 119],
      rift_surge: [216, 135, 255],
    };
    const color = colors[hazard.kind] || [204, 172, 255];
    const alpha = hazard.kind === "current" ? 0.12 : status.active ? 0.27 : status.warning ? 0.2 + Math.sin(game.elapsed * 12) * 0.06 : 0.045;
    const x = hazard.x;
    const y = hazard.y;
    const w = hazard.w;
    const h = hazard.h;
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
    if (hazard.kind === "current") {
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
    { x: game.player.x, y: game.player.y, color: [133, 235, 210], radius: 250, strength: 0.18 },
    { x: game.jev.x, y: game.jev.y, color: [255, 101, 104], radius: 230, strength: 0.15 },
  ];
  const hotspots = [
    ...movingLights,
    ...game.hazards.map((hazard) => ({
      x: hazard.x + hazard.w / 2,
      y: hazard.y + hazard.h / 2,
      color: accent,
      radius: Math.max(hazard.w, hazard.h) * 0.8,
      strength: hazardState(hazard).active ? 0.19 : 0.09,
    })),
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

function drawBlocks(ctx) {
  for (const source of blocks) {
    ctx.save();
    ctx.shadowColor = "rgb(5 4 10 / 50%)";
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 8;
    let block = source;
    if (source.angle) {
      ctx.translate(source.x + source.w / 2, source.y + source.h / 2);
      ctx.rotate(source.angle);
      block = { ...source, x: -source.w / 2, y: -source.h / 2, angle: 0 };
    }
    if (block.shape === "circle" || block.shape === "ellipse") {
      drawRoundObstacle(ctx, block);
      ctx.restore();
      continue;
    }
    if (game.level.biome === "cinder") {
      drawCinderObstacle(ctx, block);
      ctx.restore();
      continue;
    }
    if (game.level.biome === "garden") {
      drawGardenObstacle(ctx, block);
      ctx.restore();
      continue;
    }
    if (game.level.biome === "vault") {
      drawVaultObstacle(ctx, block);
      ctx.restore();
      continue;
    }
    if (game.level.biome === "rift") {
      drawRiftObstacle(ctx, block);
      ctx.restore();
      continue;
    }
    if (game.level.biome === "archive") {
      drawArchiveShelf(ctx, block);
      ctx.restore();
      continue;
    }
    if (block.kind === "pillar") {
      ctx.fillStyle = "#493b55";
      ctx.beginPath();
      ctx.ellipse(block.x + block.w / 2, block.y + block.h / 2, block.w * 0.57, block.h * 0.54, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "#9b7e9d";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(block.x + block.w / 2, block.y + block.h / 2, block.w * 0.42, block.h * 0.41, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgb(226 186 135 / 50%)";
      ctx.beginPath();
      ctx.arc(block.x + block.w / 2 - 8, block.y + block.h / 2 - 7, 2.2, 0, Math.PI * 2);
      ctx.arc(block.x + block.w / 2 + 8, block.y + block.h / 2 + 7, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const top = block.kind === "desk" ? "#77617a" : "#554760";
      ctx.fillStyle = top;
      ctx.beginPath();
      ctx.roundRect(block.x, block.y, block.w, block.h, 9);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = "#a4879f";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#342c3e";
      ctx.beginPath();
      ctx.roundRect(block.x + 9, block.y + 9, block.w - 18, block.h - 18, 5);
      ctx.fill();
      ctx.fillStyle = "rgb(238 193 137 / 68%)";
      if (block.kind === "desk") {
        ctx.fillRect(block.x + 26, block.y + 25, 34, 18);
        ctx.fillRect(block.x + 76, block.y + 29, 45, 5);
        ctx.fillRect(block.x + 76, block.y + 39, 31, 4);
        ctx.beginPath();
        ctx.arc(block.x + block.w - 30, block.y + block.h / 2, 5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(block.x + 21, block.y + block.h / 2 - 3, block.w - 42, 6);
      }
    }
    ctx.restore();
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

function drawParticles(ctx) {
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawProjectiles(ctx) {
  for (const projectile of game.projectiles) {
    const playerShot = projectile.owner === "player";
    const salvo = projectile.kind === "salvo";
    const core = playerShot ? "#caffeb" : salvo ? "#ffd0a8" : "#fff1b4";
    const glowColor = playerShot ? "rgb(80 255 207 / 72%)" : salvo ? "rgb(255 109 94 / 74%)" : "rgb(255 153 76 / 66%)";
    const angle = Math.atan2(projectile.vy, projectile.vx);
    const pulse = 0.92 + Math.sin(projectile.age * 28) * 0.08;
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    ctx.rotate(angle);
    ctx.globalCompositeOperation = "lighter";
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, playerShot ? 24 : 28);
    glow.addColorStop(0, playerShot ? "rgb(220 255 245 / 88%)" : "rgb(255 247 197 / 82%)");
    glow.addColorStop(0.34, glowColor);
    glow.addColorStop(1, playerShot ? "rgb(49 244 187 / 0%)" : "rgb(255 118 80 / 0%)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = playerShot ? "rgb(142 255 222 / 82%)" : "rgb(255 196 118 / 74%)";
    ctx.lineWidth = playerShot ? 2 : 3;
    ctx.beginPath();
    ctx.moveTo(-36, 0);
    ctx.lineTo(-9, 0);
    ctx.stroke();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(0, 0, projectile.radius * pulse, projectile.radius * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = playerShot ? "#f0fff8" : "#fff8d9";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}

function drawTacticalEffects(ctx) {
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
  if (jev.phaseStepPhase === "windup" && jev.phaseStepTarget) {
    const pulse = 0.36 + Math.sin(game.elapsed * 30) * 0.12;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = "#dfa7ff";
    ctx.fillStyle = "rgb(196 122 255 / 10%)";
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 8]);
    ctx.beginPath();
    ctx.moveTo(jev.x, jev.y);
    ctx.lineTo(jev.phaseStepTarget.x, jev.phaseStepTarget.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(jev.phaseStepTarget.x, jev.phaseStepTarget.y, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  if (jev.pouncePhase === "windup" && jev.pounceTarget) {
    const pulse = 0.72 + Math.sin(game.elapsed * 23) * 0.16;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = "#ff7768";
    ctx.fillStyle = "rgb(255 103 88 / 12%)";
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.moveTo(jev.x, jev.y);
    ctx.lineTo(jev.pounceTarget.x, jev.pounceTarget.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(jev.pounceTarget.x, jev.pounceTarget.y, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (jev.pouncePhase === "lunge") {
    ctx.save();
    ctx.globalAlpha = 0.52;
    ctx.strokeStyle = "#ff9b7d";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(jev.x - jev.pounceVx * 0.075, jev.y - jev.pounceVy * 0.075);
    ctx.lineTo(jev.x, jev.y);
    ctx.stroke();
    ctx.restore();
  }
  if (jev.blastPhase === "windup" && jev.blastTarget) {
    const pulse = 0.66 + Math.sin(game.elapsed * 28) * 0.2;
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.setLineDash([9, 6]);
    ctx.lineWidth = 12;
    ctx.strokeStyle = "rgb(255 153 76 / 38%)";
    ctx.beginPath();
    ctx.moveTo(jev.x, jev.y - 5);
    ctx.lineTo(jev.blastTarget.x, jev.blastTarget.y);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffe6aa";
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgb(255 190 104 / 18%)";
    ctx.strokeStyle = "#ffe6aa";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(jev.blastTarget.x, jev.blastTarget.y, 27 + Math.sin(game.elapsed * 28) * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(jev.blastTarget.x - 10, jev.blastTarget.y);
    ctx.lineTo(jev.blastTarget.x + 10, jev.blastTarget.y);
    ctx.moveTo(jev.blastTarget.x, jev.blastTarget.y - 10);
    ctx.lineTo(jev.blastTarget.x, jev.blastTarget.y + 10);
    ctx.stroke();
    ctx.restore();
  }
  if (jev.salvoPhase === "windup" && jev.salvoTarget) {
    const pulse = 0.56 + Math.sin(game.elapsed * 24) * 0.16;
    const centerAngle = Math.atan2(jev.salvoTarget.y - jev.y, jev.salvoTarget.x - jev.x);
    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = "#ffbd8e";
    ctx.shadowColor = "#ff835f";
    ctx.shadowBlur = 12;
    ctx.setLineDash([9, 8]);
    ctx.lineWidth = 3;
    for (const offset of [-0.24, 0, 0.24]) {
      const angle = centerAngle + offset;
      ctx.beginPath();
      ctx.moveTo(jev.x, jev.y - 5);
      ctx.lineTo(jev.x + Math.cos(angle) * 760, jev.y + Math.sin(angle) * 760);
      ctx.stroke();
    }
    ctx.setLineDash([]);
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

function drawSpriteFrame(ctx, sheet, frame, x, y, width, height, flipX = false) {
  const columns = 4;
  const rows = 3;
  const frameWidth = sheet.naturalWidth / columns;
  const frameHeight = sheet.naturalHeight / rows;
  const safeFrame = ((frame % (columns * rows)) + columns * rows) % (columns * rows);
  const sourceX = (safeFrame % columns) * frameWidth;
  const sourceY = Math.floor(safeFrame / columns) * frameHeight;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flipX ? -1 : 1, 1);
  ctx.drawImage(
    sheet,
    sourceX, sourceY, frameWidth, frameHeight,
    -width / 2, -height / 2, width, height,
  );
  ctx.restore();
}

function drawJev(ctx) {
  const jev = game.jev;
  if (jev.health <= 0) return;
  const bob = jev.stunned > 0 ? Math.sin(game.elapsed * 35) * 3 : Math.sin(game.elapsed * 12) * 1.5;
  if (artwork.jev.complete && artwork.jev.naturalWidth > 0) {
    const modeColors = {
      pursue: "#f27d68", intercept: "#f4c774", flank: "#d69df0", ambush: "#a9dec8",
      pounce: "#ff7768", power_blast: "#ffc977", rift_mine: "#d69df0", phase_step: "#dfa7ff",
      shadow_dodge: "#8fead3", soul_salvo: "#ff9c73",
    };
    const frame = jev.hurtTimer > 0 ? 11
      : jev.salvoPhase || jev.blastPhase ? 4
        : jev.pouncePhase === "windup" ? 6
          : jev.pouncePhase === "lunge" ? 7
            : jev.pouncePhase === "recover" ? 11
              : jev.mode === "rift_mine" ? 8
                : jev.mode === "phase_step" ? 9
                  : jev.mode === "shadow_dodge" ? 10
                    : Math.hypot(jev.vx, jev.vy) > 35 ? 1 + Math.floor(game.elapsed * 8) % 3 : 0;
    ctx.save();
    ctx.translate(jev.x, jev.y + 10);
    const groundShadow = ctx.createRadialGradient(0, 23, 2, 0, 23, 31);
    groundShadow.addColorStop(0, "rgba(5, 4, 12, 0.6)");
    groundShadow.addColorStop(0.58, "rgba(5, 4, 12, 0.32)");
    groundShadow.addColorStop(1, "rgba(5, 4, 12, 0)");
    ctx.fillStyle = groundShadow;
    ctx.beginPath();
    ctx.ellipse(0, 23, 24, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = jev.stunned > 0 ? "#ffe08a" : jev.hurtTimer > 0 ? "#e3fff6" : modeColors[jev.mode] || modeColors.pursue;
    ctx.lineWidth = jev.stunned > 0 ? 3 : 2;
    ctx.globalAlpha = jev.stunned > 0 || jev.hurtTimer > 0 ? 0.95 : 0.66;
    ctx.beginPath();
    ctx.ellipse(0, 9, 34, 21, 0, 0, Math.PI * 2);
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
    drawSpriteFrame(ctx, artwork.jev, frame, jev.x, jev.y + bob, 78, 84, jev.facing > 0);
    return;
  }
  ctx.save();
  ctx.translate(jev.x, jev.y + bob);
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
    pounce: "#ff7768",
    power_blast: "#ffc977",
    rift_mine: "#d69df0",
    phase_step: "#dfa7ff",
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
  const heading = Math.atan2(player.vy, player.vx || 1);
  const dash = player.dashTimer > 0;
  if (player.veilTimer > 0) {
    ctx.save();
    ctx.globalAlpha = 0.22 + Math.sin(game.elapsed * 18) * 0.06;
    ctx.strokeStyle = "#92f3e2";
    ctx.shadowColor = "#72eed9";
    ctx.shadowBlur = 23;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 5, 23, 30, 0, 0, Math.PI * 2);
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
    ctx.fillStyle = "#c7e7e6";
    ctx.beginPath();
    ctx.ellipse(player.x - player.dashVx * 27, player.y - player.dashVy * 27, 13, 24, heading + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (player.hurtTimer > 0 && Math.floor(game.elapsed * 18) % 2 === 0) return;
  if (artwork.ghost.complete && artwork.ghost.naturalWidth > 0) {
    const speed = Math.hypot(player.vx, player.vy);
    const frame = player.hurtTimer > 0 ? 11 : dash ? 4 : player.pulseTimer > 0 ? 6 : player.guardTimer > 0 ? 8
      : player.fireHeld || keys.has("z") ? 5
      : player.hookTarget ? 9 : speed > 35 ? 1 + Math.floor(game.elapsed * 10) % 3 : 0;
    ctx.save();
    ctx.translate(player.x, player.y + 11);
    const groundShadow = ctx.createRadialGradient(0, 21, 2, 0, 21, 27);
    groundShadow.addColorStop(0, "rgba(4, 5, 12, 0.62)");
    groundShadow.addColorStop(0.58, "rgba(4, 5, 12, 0.3)");
    groundShadow.addColorStop(1, "rgba(4, 5, 12, 0)");
    ctx.fillStyle = groundShadow;
    ctx.beginPath();
    ctx.ellipse(0, 21, 19, 8, 0, 0, Math.PI * 2);
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
    ctx.globalAlpha = player.veilTimer > 0 ? 0.24 : 1;
    drawSpriteFrame(ctx, artwork.ghost, frame, player.x, player.y + Math.sin(game.elapsed * 9) * 1.5, 70 * stretch, 76 / stretch, player.facing < 0);
    ctx.restore();
    if (player.pulseTimer > 0) {
      const progress = 1 - player.pulseTimer / 0.42;
      ctx.strokeStyle = "rgba(226, 179, 255, " + (1 - progress) + ")";
      ctx.lineWidth = 4 * (1 - progress) + 1;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 20 + progress * 128, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }
  ctx.save();
  ctx.globalAlpha = player.veilTimer > 0 ? 0.24 : 1;
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
    ctx.strokeStyle = "rgba(226, 179, 255, " + (1 - progress) + ")";
    ctx.lineWidth = 4 * (1 - progress) + 1;
    ctx.beginPath(); ctx.arc(0, 0, 20 + progress * 128, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
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
  if (game.player.pulseTimer > 0 && gap < 165 && game.jev.shadowDodgeCooldown <= 0) return "shadow_dodge";
  if (game.jev.shadowDodgeCooldown <= 0 && isPlayerShotThreateningJev()) return "shadow_dodge";
  if (game.jev.meteorCooldown <= 0 && game.meteors.length === 0 && gap >= 250 && gap <= 920) return "meteor_storm";
  if (game.jev.summonCooldown <= 0 && game.minions.length === 0 && gap > 260) return "summon_wraiths";
  if (game.jev.pounceCooldown <= 0 && gap < 330 && isLaneClear(game.jev, predictedPounceTarget(), game.jev.radius)) return "pounce";
  if (game.jev.blastCooldown <= 0 && gap >= 175 && gap <= 490 && isPowerBlastLaneClear(game.jev, predictedPowerBlastTarget())) return "power_blast";
  if (game.jev.salvoCooldown <= 0 && gap >= 240 && gap <= 820 && isLaneClear(game.jev, predictedPowerBlastTarget(), game.jev.radius)) return "soul_salvo";
  if (game.jev.phaseStepCooldown <= 0 && gap >= 245 && gap <= 520) return "phase_step";
  if (game.jev.mineCooldown <= 0 && !game.activeMine && gap < 340 && game.elapsed % 13 > 10) return "rift_mine";
  if (game.routeProfile.revisitedCells > 5) return "flank";
  if (Math.hypot(game.player.vx, game.player.vy) > 120) return "intercept";
  return "pursue";
}

function playerModeFallback() {
  const threatened = isJevAttackThreateningPlayer();
  const jevGap = distance(game.player, game.jev);
  const objective = aiObjectiveTarget();
  if (game.player.guardCooldown <= 0 && threatened) return "lantern_guard";
  if (game.player.veilCooldown <= 0 && (threatened || jevGap < 280)) return "ghost_veil";
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

function getJevState() {
  updatePlanProgress();
  const player = game.player;
  const jev = game.jev;
  const objectiveTarget = aiObjectiveTarget();
  const modelPosition = player.veilTimer > 0 ? player.lastKnown : player;
  const modelVelocity = player.veilTimer > 0 ? { vx: 0, vy: 0 } : player;
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
      vx: player.veilTimer > 0 ? 0 : Math.round(player.vx), vy: player.veilTimer > 0 ? 0 : Math.round(player.vy),
      hidden: player.veilTimer > 0,
      invisibility_seconds: Math.round(player.veilTimer * 10) / 10,
      veil_ready: player.veilCooldown <= 0,
      last_known_position: player.veilTimer > 0 ? { x: Math.round(player.lastKnown.x), y: Math.round(player.lastKnown.y) } : null,
      health: player.health,
      dash_ready: player.dashCooldown <= 0,
      burst_ready: player.pulseCooldown <= 0,
      echo_ready: player.echoCooldown <= 0,
      hook_ready: player.hookCooldown <= 0,
      guard_ready: player.guardCooldown <= 0,
      guard_active: player.guardTimer > 0,
      echo: player.echo ? { x: Math.round(player.echo.x), y: Math.round(player.echo.y), seconds_left: Math.round(player.echo.life * 10) / 10 } : null,
      clones: player.clones.slice(0, 3).map((clone) => ({
        x: Math.round(clone.x), y: Math.round(clone.y), seconds_left: Math.round(clone.life * 10) / 10,
      })),
      firing: player.veilTimer <= 0 && (player.fireHeld || keys.has("z")),
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
      route_profile: player.veilTimer > 0 ? { ...game.routeProfile, hotspot: null } : game.routeProfile,
      recent_actions: game.history.slice(-8),
      projectiles: game.projectiles.filter((projectile) => projectile.owner === "player").slice(-6).map((projectile) => ({
        x: Math.round(projectile.x), y: Math.round(projectile.y), vx: Math.round(projectile.vx), vy: Math.round(projectile.vy),
      })),
      action_timeline: game.actionTimeline.map((entry) => ({
        event: entry.event, seconds_ago: Math.round((game.elapsed - entry.at) * 10) / 10,
      })),
      slowed: player.snaredTimer > 0 || environmentEffects(player).speed < 0.98,
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
      pounce_ready: jev.pounceCooldown <= 0,
      pounce_lane_clear: isLaneClear(jev, predictedPounceTarget(), jev.radius),
      pounce_phase: jev.pouncePhase || "ready",
      blast_ready: jev.blastCooldown <= 0,
      blast_lane_clear: isPowerBlastLaneClear(jev, predictedPowerBlastTarget()),
      blast_phase: jev.blastPhase || "ready",
      mine_ready: jev.mineCooldown <= 0 && !game.activeMine,
      active_mine: game.activeMine ? {
        x: Math.round(game.activeMine.x), y: Math.round(game.activeMine.y),
        warning: game.activeMine.warning > 0,
        warning_seconds_left: Math.round(Math.max(0, game.activeMine.warning) * 10) / 10,
        radius: game.activeMine.radius,
      } : null,
      phase_step_ready: jev.phaseStepCooldown <= 0,
      phase_step_phase: jev.phaseStepPhase || "ready",
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
      shot_threatened: isPlayerShotThreateningJev(),
    },
    recent_events: game.history.slice(-8),
    arena: {
      width: WORLD.width,
      height: WORLD.height,
      topology: game.level.topology,
      chokepoints: game.level.chokepoints.map((point) => ({ ...point })),
      cover: [],
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
  ui.resultKicker.textContent = foughtBack ? "ANCHORS BROKEN · JEV DEFEATED" : "RIFT HUNT ENDED";
  ui.resultTitle.textContent = foughtBack ? "The hunt is yours." : "Jev got you.";
  ui.resultCopy.textContent = foughtBack
    ? "You shattered all three anchors, broke Jev's ward, and ended the hunt."
    : "Use the anchors to pull Jev across the arena. Dash through the telegraphs; guard can turn a blast back on him.";
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
    if (key === " ") startDash();
    if (key === "f" || key === "x") useSoulBurst();
    if (key === "q") useMirrorEcho();
    if (key === "r") useGhostVeil();
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
ui.dashTouch.addEventListener("pointerdown", (event) => { event.preventDefault(); startDash(); });
ui.pulseTouch.addEventListener("pointerdown", (event) => { event.preventDefault(); useSoulBurst(); });
ui.echoTouch.addEventListener("pointerdown", (event) => { event.preventDefault(); useMirrorEcho(); });
ui.veilTouch.addEventListener("pointerdown", (event) => { event.preventDefault(); useGhostVeil(); });
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

renderLevelSelection();
renderMusicButton();
resizeCanvas();
checkConnection();
