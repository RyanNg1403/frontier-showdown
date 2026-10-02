import { createServer } from "node:http";
import { readFile, readFileSync } from "node:fs";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const apiUrl = "https://api.typesafe.ai/v1/systemone";
const maxRequestBytes = 32_000;

const tactics = {
  pounce: "High-speed lunge at the ghost. Best when within close/medium range and direct lane is clear.",
  power_blast: "Charged high-damage shot. Best when line of sight is clear at medium range.",
  soul_salvo: "Spread of three soul bolts. Best when ghost is dodging or at medium range.",
  meteor_storm: "Call down aerial meteor bombardment. Best when ghost is hiding behind cover or kiting.",
  rift_mine: "Place an explosive void trap. Best when cutting off the ghost's escape path or near an anchor.",
  summon_wraiths: "Summon tracking wraithlings. Best to swarm and flush out an evasive ghost.",
  phase_step: "Void blink through obstacles or space. Best to close distance instantly, ambush, or unstick from walls.",
  shadow_dodge: "Quick evasive sidestep. Best when incoming fire or burst threatens Jev.",
  pursue: "Relentless forward chase. Best to close in and corner the ghost.",
  intercept: "Predict ghost escape path and cut them off at a corner or gate.",
  flank: "Circle around cover to flush the ghost out into the open.",
};
const playerReads = {
  dash_dodger: "Frequent dashes and reversals; lead broadly, then punish cooldown.",
  cover_kiter: "Uses cover or sightlines to break attacks; circle to an exposed angle.",
  loop_runner: "Repeats cells; intercept the route instead of following.",
  burst_brawler: "Turns close and bursts to interrupt; attack laterally, outside its radius.",
  close_brawler: "Stays close for short-range bursts; create space before winding up.",
  unpredictable: "Evidence is sparse or mixed; use robust pressure and adapt.",
};
const plans = {
  steady_pressure: "Approach from an offset; force a turn and punish it without entering burst range.",
  cut_escape: "Use momentum and repeated cells to occupy an exit before the ghost reaches it.",
  flush_cover: "Reach an open angle around cover; pressure the exit the ghost is using.",
  punish_recovery: "Track a spent dash, burst, or firing commit; attack during its recovery.",
  relentless_assault: "Close through a reachable lane; use movement skills across blocked approaches.",
  hold_range: "Hold a medium-range lane, force a dodge with a visible attack, then relocate.",
  control_chokepoint: "Occupy a reachable crossing while leaving a bypass; strike if entered.",
  guard_anchors: "Interpose between the ghost and its threatened anchor, then attack its commit.",
};
const playerTactics = {
  kite_and_shoot: "Back away from Jev while firing from safe distance (keep 350+ distance). Never run toward Jev.",
  advance_anchor: "Approach a rift anchor cautiously from the flank, keeping cover between yourself and Jev.",
  fire_anchors: "Shoot the rift anchor from a safe angle, keeping 350+ distance from Jev.",
  attack_jev: "Back away while firing from safe long range (keep 350+ distance). Never run toward Jev.",
  evade_warning: "Dash away or through danger when Jev lunges, closes inside 240, or attacks.",
  lantern_guard: "Raise lantern to parry Jev's pounce or incoming projectiles.",
  ghost_veil: "Vanish into invisibility to break Jev's pursuit and escape when cornered.",
  mirror_echo: "Spawn mirror decoys to divert Jev's attention and intercept attacks.",
  rift_hook: "Grapple across the arena to instantly escape Jev or reach a far anchor.",
  soul_burst: "Pulse only when within 145 units of an anchor, Jev, or wraithlings.",
};
const arenas = {
  crossing: {
    name: "The Last Crossing",
    landscape: "afterlife customs office",
    topology: "Four connected districts surround a guarded central cross. The arrival hall, ledger gallery, gloam arcade, and rift registry have different obstacle patterns; narrow gate openings link the long outer loops.",
  },
  cinder: {
    name: "Cinderworks",
    landscape: "molten forge with cracked basalt and glowing vents",
    topology: "Four forge districts link through staggered gates: furnace islands divide the slag lanes, while broken spines and vent fields create several risky cut-throughs.",
  },
  drowned: {
    name: "Drowned Archive",
    landscape: "flooded teal library of submerged shelves and reflective pools",
    topology: "Four flooded library districts connect through narrow shelf gaps. Offset stacks create serpentine routes, diagonal shortcuts, long sightlines, and directional currents.",
  },
  glassgarden: {
    name: "Verdant Glasshouse",
    landscape: "moonlit botanical conservatory",
    topology: "Four glasshouse districts combine hedge loops, reflecting pools, trellis bridges, and spore pockets. Cross-gates connect broad outer lanes to tight garden cuts.",
  },
  meridian: {
    name: "Meridian Vault",
    landscape: "radial reliquary with prismatic cores",
    topology: "Four vault districts mix radial ribs, reliquaries, and broken circular walls. Rotated cuts and gated loops connect the outer chambers to the central heart.",
  },
  fractured: {
    name: "The Fractured Span",
    landscape: "rift bridge above a starless chasm",
    topology: "Four fractured districts form winding island bridges around an unstable center. Narrow crossings connect broad flanks, diagonal shortcuts, and the long return loop.",
  },
};
const gameEvents = new Set([
  "dash", "soul_burst", "burst_hit", "burst_missed", "shot_fired", "shot_hit", "shot_blocked",
  "player_hit", "mine_hit", "mine_placed", "mine_triggered", "mine_evaded", "pounce_hit", "pounce_blocked", "pounce_missed",
  "power_blast_fired", "blast_hit", "blast_missed", "blast_dodged", "blast_blocked", "blast_canceled",
  "salvo_hit", "salvo_missed", "salvo_dodged", "salvo_blocked",
  "phase_step_windup", "phase_step_used", "phase_step_canceled", "shadow_dodge_windup", "shadow_dodge_used", "shadow_dodge_canceled",
  "meteor_storm_started", "meteor_hit", "meteor_evaded", "wraiths_summoned", "wraith_hit", "wraith_shot", "wraith_burst", "wraith_dash",
  "soul_salvo_windup", "soul_salvo_fired", "soul_salvo_canceled", "anchor_hit", "anchor_broken",
  "mirror_echo", "mirror_echo_broken", "ghost_veil", "veil_broken", "rift_hook", "lantern_guard", "lantern_parry", "ward_blocked",
]);

function parseApiKeyFile(filePath) {
  try {
    const file = readFileSync(filePath, "utf8");
    for (const line of file.split(/\r?\n/u)) {
      const match = line.match(/^\s*(?:export\s+)?(JEV_API_KEY|TYPESAFE_API_KEY)\s*=\s*(.*?)\s*$/u);
      if (!match) continue;
      const value = match[2].replace(/^(["'])(.*)\1$/u, "$2").trim();
      if (value && !value.startsWith("put-your-key-here")) return value;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function getApiKey() {
  if (process.env.JEV_API_KEY) return process.env.JEV_API_KEY;
  if (process.env.TYPESAFE_API_KEY) return process.env.TYPESAFE_API_KEY;

  if (process.env.JEV_ENV_FILE) {
    const key = parseApiKeyFile(resolve(projectRoot, process.env.JEV_ENV_FILE));
    if (key) return key;
  }
  const localKey = parseApiKeyFile(join(projectRoot, ".env"));
  if (localKey) return localKey;
  const parentKey = parseApiKeyFile(join(projectRoot, "..", ".env"));
  if (parentKey) return parentKey;
  return undefined;
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

function readJson(request) {
  return new Promise((resolveBody, rejectBody) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxRequestBytes) {
        rejectBody(new Error("Request is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        rejectBody(new Error("The request body must be valid JSON."));
      }
    });
    request.on("error", rejectBody);
  });
}

function boundedNumber(value, min, max, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function buildState(body) {
  const player = body.player && typeof body.player === "object" ? body.player : {};
  const jev = body.jev && typeof body.jev === "object" ? body.jev : {};
  const arenaInput = body.arena && typeof body.arena === "object" ? body.arena : {};
  const isAuto = body.game_mode === "auto";
  const arena = Object.hasOwn(arenas, body.map_id) ? arenas[body.map_id] : arenas.crossing;
  const distanceToPlayer = boundedNumber(jev.distance_to_player, 0, 3000, 300);

  let rangeBracket = "medium_range";
  if (distanceToPlayer < 140) rangeBracket = "melee_range";
  else if (distanceToPlayer < 300) rangeBracket = "close_range";
  else if (distanceToPlayer < 500) rangeBracket = "medium_range";
  else rangeBracket = "long_range";

  const readyAbilities = [];
  const abilitiesOnCooldown = [];
  if (jev.pounce_ready) readyAbilities.push("pounce");
  else abilitiesOnCooldown.push("pounce");
  if (jev.blast_ready) readyAbilities.push("power_blast");
  else abilitiesOnCooldown.push("power_blast");
  if (jev.soul_salvo_ready) readyAbilities.push("soul_salvo");
  else abilitiesOnCooldown.push("soul_salvo");
  if (jev.phase_step_ready) readyAbilities.push("phase_step");
  else abilitiesOnCooldown.push("phase_step");
  if (jev.shadow_dodge_ready) readyAbilities.push("shadow_dodge");
  else abilitiesOnCooldown.push("shadow_dodge");
  if (jev.mine_ready && !jev.active_mine) readyAbilities.push("rift_mine");
  else abilitiesOnCooldown.push("rift_mine");
  if (jev.summon_ready) readyAbilities.push("summon_wraiths");
  else abilitiesOnCooldown.push("summon_wraiths");
  if (jev.meteor_ready) readyAbilities.push("meteor_storm");
  else abilitiesOnCooldown.push("meteor_storm");

  const activeAnchorsCount = Array.isArray(arenaInput.anchors)
    ? arenaInput.anchors.filter((a) => (a?.health ?? 0) > 0).length
    : 0;

  const isStuck = boundedNumber(jev.stuck_seconds, 0, 10, 0) > 0.35;
  const shotThreatened = jev.shot_threatened === true;

  return {
    combat_context: "Jev is the demonic apex predator hunting a fragile spirit in an afterlife realm.",
    arena: {
      name: arena.name,
      phase: activeAnchorsCount > 0 ? `ward_active_${activeAnchorsCount}_anchors_standing` : "demon_exposed",
      demon_warded: activeAnchorsCount > 0,
      active_anchors_count: activeAnchorsCount,
      seconds_remaining: boundedNumber(body.seconds_remaining, 0, 150),
    },
    engagement: {
      distance_to_ghost: Math.round(distanceToPlayer),
      range_bracket: rangeBracket,
      direct_pounce_lane_clear: jev.pounce_lane_clear === true,
      direct_blast_lane_clear: jev.blast_lane_clear === true,
      ghost_status: player.hidden ? "invisible_veil" : (player.guard_active ? "shield_guard_active" : (player.slowed ? "slowed" : "exposed")),
      ghost_health: boundedNumber(player.health, 0, 4, 4),
      demon_health: boundedNumber(jev.health, 0, 6, 6),
      demon_stuck_or_obstructed: isStuck,
      demon_shot_threatened: shotThreatened,
    },
    demon_tactical_status: {
      current_plan: Object.hasOwn(plans, jev.current_plan) ? jev.current_plan : "steady_pressure",
      plan_seconds_left: boundedNumber(jev.plan_seconds_left, 0, 5, 0),
      player_read: Object.hasOwn(playerReads, jev.player_read) ? jev.player_read : "unpredictable",
      ready_abilities: readyAbilities,
      abilities_on_cooldown: abilitiesOnCooldown,
    },
    ...(isAuto ? {
      ghost_perspective: {
        distance_to_demon: Math.round(distanceToPlayer),
        safe_distance_maintained: distanceToPlayer >= 350,
        demon_closing_in: distanceToPlayer < 350,
        ghost_defensive_ready: [
          ...(player.dash_ready ? ["evasive_dash"] : []),
          ...(player.guard_ready ? ["lantern_guard"] : []),
          ...(player.veil_ready ? ["ghost_veil"] : []),
          ...(player.echo_ready ? ["mirror_echo"] : []),
          ...(player.hook_ready ? ["rift_hook"] : []),
        ],
      }
    } : {})
  };
}

function buildDecisionPayload(state, gameMode, playerReadAge = 60) {
  const refreshPlayerRead = playerReadAge >= 2.5;
  const refreshPlan = (state.demon_tactical_status?.plan_seconds_left ?? 0) <= 0.1;
  return {
    state,
    model: "jev-latest",
    questions: {
      ...(refreshPlayerRead ? {
        player_read: {
          type: "choice",
          instructions: "Classify the ghost's combat playstyle from their movement, kiting, and firing behavior.",
          criteria: playerReads,
        },
      } : {}),
      ...(refreshPlan ? {
        strategic_plan: {
          type: "choice",
          instructions: "Choose Jev's high-level hunting strategy for the next few seconds.",
          criteria: plans,
        },
      } : {}),
      npc_tactic: {
        type: "choice",
        instructions: "You are Jev, the demonic boss. Choose your immediate tactical combat action. Relentlessly hunt, pressure, and destroy the ghost. If an ability is ready and its conditions are met (pounce if close with clear lane, blast if sightline clear, meteor if ghost is kiting/behind cover, phase_step to blink close or unstick, shadow_dodge if threatened), unleash it. Otherwise, use pursue to corner them aggressively, intercept to cut off their escape, or flank to flush them from behind obstacles.",
        criteria: tactics,
      },
      ...(gameMode === "auto" ? {
        player_tactic: {
          type: "choice",
          instructions: "You are the fragile ghost. Prioritize survival and distance. Stay 350+ units away from Jev. If Jev attacks or gets close, use defensive skills (lantern_guard, evade_warning, ghost_veil, mirror_echo, rift_hook). If anchors are alive, advance and destroy them from safe cover. When demon is exposed, kite and shoot from long range while retreating if Jev advances. NEVER run into or chase Jev.",
          criteria: playerTactics,
        },
      } : {}),
    },
  };
}

async function chooseResponse(request, response) {
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    sendJson(response, 400, { error: error.message });
    return;
  }

  let state;
  try {
    state = buildState(body);
  } catch (error) {
    sendJson(response, 400, { error: error.message });
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    sendJson(response, 503, { error: "Jev is unavailable. Add a TypeSafe API key to the server environment." });
    return;
  }

  try {
    const upstream = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildDecisionPayload(
        state,
        body.game_mode,
        boundedNumber(body.jev?.player_read_age, 0, 60, 60),
      )),
      signal: AbortSignal.timeout(15_000),
    });

    if (!upstream.ok) {
      const status = upstream.status === 401 ? 502 : 503;
      const message = upstream.status === 401
        ? "Jev could not authenticate the configured TypeSafe key."
        : "Jev could not make a decision right now. Please try again.";
      sendJson(response, status, { error: message });
      return;
    }

    const result = await upstream.json();
    const answer = result?.answers?.npc_tactic;
    const readAnswer = result?.answers?.player_read;
    const planAnswer = result?.answers?.strategic_plan;
    const playerAnswer = result?.answers?.player_tactic;
    const mode = answer?.choice;
    if (answer?.type !== "choice" || !Object.hasOwn(tactics, mode)) {
      sendJson(response, 502, { error: "Jev returned an unexpected response. Please try again." });
      return;
    }

    const probabilities = {};
    for (const option of Object.keys(tactics)) {
      const value = Number(answer.probabilities?.[option]);
      probabilities[option] = Number.isFinite(value) ? value : null;
    }
    const playerProbabilities = {};
    for (const option of Object.keys(playerTactics)) {
      const value = Number(playerAnswer?.probabilities?.[option]);
      playerProbabilities[option] = Number.isFinite(value) ? value : null;
    }
    sendJson(response, 200, {
      mode,
      confidence: Number.isFinite(Number(answer.confidence)) ? Number(answer.confidence) : 0,
      ...(readAnswer?.type === "choice" && Object.hasOwn(playerReads, readAnswer.choice)
        ? { player_read: readAnswer.choice }
        : {}),
      ...(planAnswer?.type === "choice" && Object.hasOwn(plans, planAnswer.choice)
        ? {
            plan: planAnswer.choice,
            plan_confidence: Number.isFinite(Number(planAnswer.confidence)) ? Number(planAnswer.confidence) : 0,
          }
        : {}),
      probabilities,
      player_mode: playerAnswer?.type === "choice" && Object.hasOwn(playerTactics, playerAnswer.choice)
        ? playerAnswer.choice
        : undefined,
      player_probabilities: playerAnswer?.type === "choice" ? playerProbabilities : undefined,
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError";
    sendJson(response, 503, {
      error: timedOut
        ? "Jev took too long to decide. Please try again."
        : "Jev could not connect. Check your connection and try again.",
    });
  }
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
const publicFiles = new Set([
  "index.html", "game.js", "styles.css", "favicon.svg",
  "assets/afterlife-floor.jpg", "assets/ghost-sheet-v2.png", "assets/jev-sheet-v2.png",
  "assets/cinder-floor.png", "assets/archive-floor.png", "assets/last-crossing-hero.png",
  "assets/ghost-combat-sheet.png", "assets/jev-combat-sheet.png",
  "assets/floor-crossing-v2.png", "assets/floor-cinder-v2.png", "assets/floor-archive-v2.png",
  "assets/floor-garden-v2.png", "assets/floor-vault-v2.png", "assets/floor-rift-v2.png",
]);

function serveFile(request, response) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname);
  } catch {
    sendJson(response, 400, { error: "Invalid path." });
    return;
  }
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!publicFiles.has(relativePath)) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }
  const filePath = resolve(projectRoot, relativePath);
  if (!filePath.startsWith(`${projectRoot}${sep}`)) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  readFile(filePath, (error, content) => {
    if (error) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(content);
  });
}

createServer((request, response) => {
  if (request.method === "GET" && request.url === "/api/health") {
    sendJson(response, 200, { ready: Boolean(getApiKey()) });
    return;
  }
  if (request.method === "POST" && request.url === "/api/decision") {
    void chooseResponse(request, response);
    return;
  }
  if (request.method === "GET") {
    serveFile(request, response);
    return;
  }
  sendJson(response, 405, { error: "Method not allowed." });
}).listen(port, host, () => {
  process.stdout.write(`JEVil is ready at http://${host}:${port}\n`);
});
