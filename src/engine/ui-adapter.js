/**
 * Compatibility layer for the UI module (`src/ui`), which reads a few fields under other
 * names than contract v3. Everything here is additive: aliases on the snapshot and on event
 * payloads, plus the UI's config and settings shapes.
 */

const UI_ACTIONS = {
  up: "up", down: "down", left: "left", right: "right",
  lightPunch: "LP", heavyPunch: "HP", lightKick: "LK", heavyKick: "HK", block: "BLOCK", tag: "TAG",
};

/** Add `roundWins`, `fighters[]` (with `recoverable`), `meterSegments`, `tagReady`, `assistReady`. */
export function decorateSnapshot(snap, charMap) {
  if (!snap.sides?.length) return snap;
  for (const s of snap.sides) {
    s.roundWins = s.wins;
    s.meterSegments = Math.round(s.meterMax / 100);
    s.fighters = s.members.map((m) => {
      const def = charMap.get(m.id);
      return {
        id: m.id,
        name: m.name,
        lab: def?.labId,
        color: def?.palette.accent,
        health: m.health,
        maxHealth: m.maxHealth,
        recoverable: Math.min(m.maxHealth, m.health + m.red),
        ko: m.ko,
      };
    });
    const partner = s.members[1 - s.active];
    const partnerFree = Boolean(partner && !partner.ko && partner.health > 0 && !partner.onField);
    s.tagReady = snap.mode === "2v2" && partnerFree && s.tagCooldown === 0;
    s.assistReady = snap.mode === "2v2" && partnerFree && s.assistCooldown === 0 && !s.lastStanding;
  }
  return snap;
}

/** Add UI aliases to an event payload (returns a new object when changed). */
export function decorateEvent(name, payload) {
  switch (name) {
    case "hit":
    case "block":
      return { ...payload, target: 1 - payload.side };
    case "tag":
      return { ...payload, from: payload.out, to: payload.in };
    case "ko":
      return { ...payload, loser: payload.side, winner: 1 - payload.side };
    default:
      return payload;
  }
}

/** Accept the UI's `startMatch` config ({stageId, roundTime, sides:[{fighters, player}]}). */
export function normalizeMatchConfig(config = {}) {
  const uiShape = Array.isArray(config.sides) && config.sides.some((s) => Array.isArray(s?.fighters));
  if (!uiShape) return config;
  const roundTime = config.roundTime;
  return {
    mode: config.mode,
    stage: config.stageId ?? config.stage,
    roundsToWin: config.roundsToWin,
    timer: roundTime === null || roundTime === Infinity || roundTime === "infinite" ? Infinity : roundTime,
    backBlocks: config.backBlocks,
    sides: config.sides.map((s) => ({
      team: s.fighters,
      control: s.control,
      difficulty: s.difficulty ?? config.difficulty,
      player: s.player,
    })),
  };
}

/** Roster in the UI's shape: contract data plus `lab` as the lab id and an accent `color`. */
export function uiRoster(list) {
  return list.map((c) => ({ ...c, lab: c.labId, labName: c.lab, color: c.palette?.accent }));
}

export function uiStages(list) {
  return list.map((s) => {
    const out = { ...s, description: s.description ?? s.fieldNotes ?? s.location };
    const preview = s.preview ?? s.thumbnail;
    if (preview) out.preview = preview;
    else delete out.preview;
    return out;
  });
}

/** Apply the UI's settings object to the input devices and the audio module. */
export function applyUiSettings(settings, { devices, audio, options }) {
  const controls = settings?.controls;
  if (controls) {
    const primaries = new Set(["p1", "p2"].flatMap((p) => Object.values(controls[p]?.keyboard || {})));
    for (const p of ["p1", "p2"]) {
      const kb = controls[p]?.keyboard;
      const alt = controls[p]?.keyboardAlt || {};
      if (kb) {
        for (const [action, key] of Object.entries(UI_ACTIONS)) {
          if (!kb[action]) continue;
          const extra = alt[action] && !primaries.has(alt[action]) ? [alt[action]] : [];
          devices.bindings[p][key] = [kb[action], ...extra];
        }
      }
      const pad = controls[p]?.gamepad;
      if (pad) {
        for (const [action, key] of Object.entries(UI_ACTIONS)) {
          if (Number.isInteger(pad[action])) devices.padBindings[p][key] = [pad[action]];
        }
      }
    }
    devices.refreshBound();
  }
  const vol = settings?.audio;
  if (vol && audio?.setVolume) {
    for (const [bus, key] of [["master", "master"], ["music", "music"], ["sfx", "sfx"], ["voice", "announcer"]]) {
      if (typeof vol[key] === "number") audio.setVolume(bus, vol[key]);
    }
  }
  const a11y = settings?.accessibility;
  if (a11y) options.screenShake = a11y.screenShake !== false && !a11y.reduceFlashes;
  const play = settings?.gameplay;
  if (play) options.gameplay = { ...play };
}

/** Music per UI screen. */
export const SCREEN_MUSIC = { title: "menu", mode: "menu", settings: "menu", select: "select", stage: "select", versus: "select" };
