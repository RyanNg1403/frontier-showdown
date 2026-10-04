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
  rift_rend: "Close-range crescent slash. A visible 0.42s wind-up fixes a broad 96-degree arc. Use it to punish a committed route; a ready Lantern Guard can parry it, so first draw out or bypass the guard.",
  power_blast: "Charged high-damage shot. Best when line of sight is clear at medium range.",
  soul_salvo: "Three closely grouped lead bolts. Best against a moving runner in a clear lane.",
  meteor_storm: "Call down aerial meteor bombardment. Best when the runner is hiding behind cover or kiting.",
  rift_mine: "Place an explosive void trap. Best when cutting off the runner's escape path or near an anchor.",
  summon_wraiths: "Summon tracking wraithlings. Best to swarm and flush out an evasive runner.",
  rift_rush: "After a visible wind-up, charge through a clear mid-range lane and stop short; wait out post-parry recovery.",
  rift_aegis: "After all anchors fall, shield only against an incoming hit; keep pressure on the runner between threats.",
  shadow_dodge: "Quick evasive sidestep. Best when incoming fire or burst threatens the chaser.",
  pursue: "Relentless forward chase. Best to close in and corner the runner.",
  intercept: "Predict the runner's escape path and cut them off at a corner or gate.",
  flank: "Change angle and reset range after a parry; route around cover instead of running straight at the runner.",
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
  cut_escape: "Use momentum and repeated cells to occupy an exit before the runner reaches it.",
  flush_cover: "Reach an open angle around cover; pressure the exit the runner is using.",
  punish_recovery: "Track a spent dash, burst, or firing commit; attack during its recovery.",
  relentless_assault: "Close through a reachable lane; use movement skills across blocked approaches.",
  hold_range: "Hold a medium-range lane, force a dodge with a visible attack, then relocate.",
  control_chokepoint: "Occupy a reachable crossing while leaving a bypass; strike if entered.",
  guard_anchors: "Interpose between the runner and its threatened anchor, then attack its commit.",
};
const playerTactics = {
  kite_and_shoot: "Back away from the chaser while firing from safe distance (keep 350+ distance). Never run toward it.",
  advance_anchor: "Approach a rift anchor cautiously from the flank, keeping cover between yourself and the chaser.",
  fire_anchors: "Shoot the rift anchor from a safe angle, keeping 350+ distance from the chaser.",
  attack_jev: "Back away while firing from safe long range (keep 350+ distance). Never run toward the chaser.",
  evade_warning: "Move along a safe route when the chaser approaches or an area hazard is about to activate.",
  lantern_guard: "Timed parry for close contact, incoming projectiles, Rift Rush, or the marked Rift Rend arc. Prefer Phase Dash when ready; use Guard as a deliberate counter when escape is unavailable, never repeatedly.",
  phase_dash: "Burst through an imminent attack and leave an afterimage that misleads the chaser's aim.",
  mirror_echo: "Spawn mirror decoys to divert the chaser's attention and intercept attacks.",
  rift_hook: "Grapple across the arena to instantly escape the chaser or reach a far anchor.",
  soul_burst: "Pulse only when within 145 units of an anchor, the chaser, or wraithlings.",
};
const arenas = {
  crossing: {
    name: "OpenAI Glass Atrium",
    landscape: "afterlife customs office",
    topology: "Four connected districts surround a guarded central cross. The arrival hall, ledger gallery, gloam arcade, and rift registry have different obstacle patterns; narrow gate openings link the long outer loops.",
  },
  cinder: {
    name: "OpenAI Compute Studio",
    landscape: "molten forge with cracked basalt and glowing vents",
    topology: "Four forge districts link through staggered gates: furnace islands divide the slag lanes, while broken spines and vent fields create several risky cut-throughs.",
  },
  drowned: {
    name: "Anthropic Reading Room",
    landscape: "flooded teal library of submerged shelves and reflective pools",
    topology: "Four flooded library districts connect through narrow shelf gaps. Offset stacks create serpentine routes, diagonal shortcuts, long sightlines, and directional currents.",
  },
  glassgarden: {
    name: "Anthropic Living Studio",
    landscape: "moonlit botanical conservatory",
    topology: "Four glasshouse districts combine hedge loops, reflecting pools, trellis bridges, and spore pockets. Cross-gates connect broad outer lanes to tight garden cuts.",
  },
  meridian: {
    name: "Paris AI Action Hall",
    landscape: "ornate exhibition hall with limestone medallions and bronze floor inlays",
    topology: "Four vault districts mix radial ribs, reliquaries, and broken circular walls. Rotated cuts and gated loops connect the outer chambers to the central heart.",
  },
  fractured: {
    name: "AI Impact Expo Pavilion",
    landscape: "sunlit research expo pavilion with airy glass architecture and lotus-inspired geometry",
    topology: "Four fractured districts form winding island bridges around an unstable center. Narrow crossings connect broad flanks, diagonal shortcuts, and the long return loop.",
  },
};
const gameEvents = new Set([
  "dash", "phase_dash", "lava_hit", "lava_evaded", "soul_burst", "burst_hit", "burst_missed", "shot_fired", "shot_hit", "shot_blocked",
  "player_hit", "mine_hit", "mine_placed", "mine_triggered", "mine_evaded", "rift_rend_windup", "rift_rend_fired", "rift_rend_hit", "rift_rend_missed", "rift_rend_evaded", "rift_rend_interrupted",
  "power_blast_fired", "blast_hit", "blast_missed", "blast_dodged", "blast_blocked", "blast_canceled",
  "salvo_hit", "salvo_missed", "salvo_dodged", "salvo_blocked",
  "rift_rush_windup", "rift_rush_used", "rift_rush_canceled", "shadow_dodge_windup", "shadow_dodge_used", "shadow_dodge_canceled",
  "meteor_storm_started", "meteor_hit", "meteor_evaded", "wraiths_summoned", "wraith_hit", "wraith_shot", "wraith_burst", "wraith_dash",
  "soul_salvo_windup", "soul_salvo_fired", "soul_salvo_canceled", "anchor_hit", "anchor_broken",
  "mirror_echo", "mirror_echo_broken", "rift_hook", "lantern_guard", "lantern_parry", "ward_blocked",
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
  if (jev.rend_ready) readyAbilities.push("rift_rend");
  else abilitiesOnCooldown.push("rift_rend");
  if (jev.blast_ready) readyAbilities.push("power_blast");
  else abilitiesOnCooldown.push("power_blast");
  if (jev.soul_salvo_ready) readyAbilities.push("soul_salvo");
  else abilitiesOnCooldown.push("soul_salvo");
  if (jev.rift_rush_ready) readyAbilities.push("rift_rush");
  else abilitiesOnCooldown.push("rift_rush");
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
  if (activeAnchorsCount === 0) {
    if (jev.rift_aegis_ready === true) readyAbilities.push("rift_aegis");
    else abilitiesOnCooldown.push("rift_aegis");
  }

  const isStuck = boundedNumber(jev.stuck_seconds, 0, 10, 0) > 0.35;
  const shotThreatened = jev.shot_threatened === true;

  return {
    combat_context: "The chaser is a relentless rival hunting the runner through a research-lab arena.",
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
      direct_rend_lane_clear: jev.rend_lane_clear === true,
      rift_rend_warning: jev.rend_arc_threatening === true,
      direct_blast_lane_clear: jev.blast_lane_clear === true,
      ghost_status: player.afterimage_active ? "afterimage_decoy" : (player.echo?.seconds_left > 0 ? "mirror_echo_decoy" : (player.guard_active ? "shield_guard_active" : (player.slowed ? "slowed" : "exposed"))),
      ghost_health: boundedNumber(player.health, 0, 5, 5),
      demon_health: boundedNumber(jev.health, 0, 6, 6),
      demon_stuck_or_obstructed: isStuck,
      demon_shot_threatened: shotThreatened,
      ghost_just_parried: jev.recently_parried === true,
    },
    demon_tactical_status: {
      current_plan: Object.hasOwn(plans, jev.current_plan) ? jev.current_plan : "steady_pressure",
      plan_seconds_left: boundedNumber(jev.plan_seconds_left, 0, 5, 0),
      player_read: Object.hasOwn(playerReads, jev.player_read) ? jev.player_read : "unpredictable",
      ready_abilities: readyAbilities,
      abilities_on_cooldown: abilitiesOnCooldown,
      ...(activeAnchorsCount === 0 ? {
        rift_aegis_ready: jev.rift_aegis_ready === true,
        rift_aegis_active_seconds: boundedNumber(jev.rift_aegis_active_seconds, 0, 3),
        rift_aegis_charges: boundedNumber(jev.rift_aegis_charges, 0, 2),
      } : {}),
    },
    ...(isAuto ? {
      ghost_perspective: {
        distance_to_demon: Math.round(distanceToPlayer),
        safe_distance_maintained: distanceToPlayer >= 350,
        demon_closing_in: distanceToPlayer < 350,
        ghost_defensive_ready: [
          ...(player.phase_dash_ready ? ["phase_dash"] : []),
          ...(player.guard_ready ? ["lantern_guard"] : []),
          ...(player.echo_ready ? ["mirror_echo"] : []),
          ...(player.hook_ready ? ["rift_hook"] : []),
        ],
      }
    } : {}),
    npc_context: {
      rend_lane_clear: jev.rend_lane_clear === true,
      salvo_lane_clear: jev.salvo_lane_clear === true,
      ghost_near_burst_threat: player.soul_burst_threat === true,
      active_decoy: player.afterimage_active ? "afterimage" : (player.echo?.seconds_left > 0 ? "mirror_echo" : "none"),
      ghost_defense_history: Array.isArray(player.action_timeline)
        ? player.action_timeline
          .filter((action) => ["phase_dash", "lantern_guard", "lantern_parry", "mirror_echo", "rift_hook", "soul_burst"].includes(action?.event))
          .slice(-4)
          .map((action) => [action.event, Math.round(boundedNumber(action.seconds_ago, 0, 14) * 10) / 10])
        : [],
      ghost_motion: {
        vx: Math.round(boundedNumber(player.vx, -900, 900)),
        vy: Math.round(boundedNumber(player.vy, -900, 900)),
        route: ["looping", "erratic", "hidden"].includes(player.route_pattern) ? player.route_pattern : "open",
      },
      recent_attack_results: Array.isArray(jev.action_history)
        ? jev.action_history
          .filter((action) => action?.outcome && !["awaiting_result", "engine_safety_adjustment"].includes(action.outcome))
          .slice(-4)
          .map((action) => ({ skill: action.executed_tactic, result: action.outcome }))
        : [],
    },
  };
}

function buildDecisionPayload(state, gameMode, playerReadAge = 60) {
  const refreshPlayerRead = playerReadAge >= 2.5;
  const refreshPlan = (state.demon_tactical_status?.plan_seconds_left ?? 0) <= 0.1;
  const { npc_context: npcContext = {}, ...sharedState } = state;
  return {
    state: sharedState,
    model: "jev-latest",
    questions: {
      ...(refreshPlayerRead ? {
        player_read: {
          type: "choice",
          instructions: "Classify the runner's combat playstyle from their movement, kiting, and firing behavior.",
          criteria: playerReads,
        },
      } : {}),
      ...(refreshPlan ? {
        strategic_plan: {
          type: "choice",
          instructions: "Choose the chaser's high-level hunting strategy for the next few seconds.",
          criteria: plans,
        },
      } : {}),
      npc_tactic: {
        type: "choice",
        instructions: {
          goal: "Choose one hunt action that fits range, lane, recent defenses, and attack results. Use Rift Rend at close range to punish a committed route; its 0.42s arc is dodgeable and a ready Lantern Guard can parry it. Avoid repeating into recent guards; change angle or skill after a miss or parry. Avoid decoys with single-target attacks. With anchors down, use Rift Aegis only for an imminent hit.",
          attack_context: {
            recent_results: npcContext.recent_attack_results ?? [],
            ghost_motion: npcContext.ghost_motion ?? { vx: 0, vy: 0, route: "open" },
            active_decoy: npcContext.active_decoy ?? "none",
            ghost_defense_history: npcContext.ghost_defense_history ?? [],
            rend_lane_clear: npcContext.rend_lane_clear === true,
            salvo_lane_clear: npcContext.salvo_lane_clear === true,
            ghost_near_burst_threat: npcContext.ghost_near_burst_threat === true,
          },
        },
        criteria: tactics,
      },
      ...(gameMode === "auto" ? {
        player_tactic: {
          type: "choice",
          instructions: "Break anchors, then defeat the chaser. During Rift Aegis, move or use decoys until it fades. When Rift Rend marks you, move out of the arc; prefer Phase Dash if ready, or time Lantern Guard to parry if escape is unavailable. Guard projectile wind-ups and near-contact, then punish the chaser's stun. Adapt after a parry instead of repeating it. Avoid Rift Rush's marked lane, keep firing through clear lanes, and avoid active hazards.",
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
    sendJson(response, 503, { error: "Opponent decisions are unavailable. Check the server's TypeSafe configuration." });
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
        ? "The opponent service could not authenticate its configured key."
        : "The opponent could not make a decision right now. Please try again.";
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
      sendJson(response, 502, { error: "The opponent returned an unexpected response. Please try again." });
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
        ? "The opponent took too long to decide. Please try again."
        : "The opponent could not connect. Check your connection and try again.",
    });
  }
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};
const publicFiles = new Set([
  "index.html", "game.js", "styles.css", "favicon.svg",
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
  if (!publicFiles.has(relativePath) && !relativePath.startsWith("assets/")) {
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
  process.stdout.write(`Frontier Showdown is ready at http://${host}:${port}\n`);
});
