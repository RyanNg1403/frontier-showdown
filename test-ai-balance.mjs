import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function loadPlaywright() {
  for (const specifier of [
    "playwright",
    process.env.PLAYWRIGHT_MODULE,
    "/Users/PhatNguyen/Desktop/uit-cli/node_modules/playwright/index.mjs",
    "/tmp/frontier-asset-tools/node_modules/playwright/index.mjs",
  ].filter(Boolean)) {
    try {
      return await import(specifier);
    } catch {
      // Try the next locally available Playwright installation.
    }
  }
  throw new Error("Playwright was not found. Set PLAYWRIGHT_MODULE to its entry point.");
}

const { chromium } = await loadPlaywright();
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const runsPerArena = Number(process.env.RUNS_PER_ARENA || 15);
const concurrency = Number(process.env.BALANCE_CONCURRENCY || 12);
const timeoutMs = Number(process.env.MATCH_TIMEOUT_MS || 120_000);
const sampleIntervalMs = Number(process.env.SAMPLE_INTERVAL_MS || 300);
const outputPath = process.env.BALANCE_OUTPUT || "/tmp/frontier-ai-balance.json";
const decisionPolicy = process.env.DECISION_POLICY || "local-fallback";
const deterministicFallback = decisionPolicy === "local-fallback";
if (!deterministicFallback && decisionPolicy !== "live") {
  throw new Error('DECISION_POLICY must be "local-fallback" or "live".');
}
const baseUrl = deterministicFallback ? "http://frontier.test" : process.env.GAME_URL || "http://127.0.0.1:4173";
const allArenas = ["crossing", "cinder", "drowned", "glassgarden", "meridian", "fractured"];
const requestedArenas = (process.env.BALANCE_ARENAS || "").split(",").map((value) => value.trim()).filter(Boolean);
const arenas = requestedArenas.length
  ? requestedArenas.filter((arena) => allArenas.includes(arena))
  : allArenas;
const traceMatch = process.env.TRACE_MATCH || "";
if (!arenas.length) throw new Error("BALANCE_ARENAS did not include a known arena.");
const attackModes = new Set([
  "rift_rend", "power_blast", "soul_salvo", "rift_mine", "signal_tether", "meteor_storm",
]);
const existingReport = process.env.RESUME_BALANCE === "1" && fs.existsSync(outputPath)
  ? JSON.parse(fs.readFileSync(outputPath, "utf8"))
  : null;
if (existingReport && (existingReport.baseUrl !== baseUrl || existingReport.runsPerArena !== runsPerArena ||
    (existingReport.decisionPolicy || "live") !== decisionPolicy)) {
  throw new Error("The saved balance report does not match this URL, run count, or decision policy; choose another BALANCE_OUTPUT.");
}
const completed = existingReport?.matches || [];
const isVerifiedMatch = (match) => Boolean(match.complete && match.winner && match.errors?.length === 0 && match.decisionCalls > 0);
const completedKeys = new Set(completed.filter(isVerifiedMatch).map((match) => `${match.arena}:${match.run}`));
const allJobs = Array.from({ length: runsPerArena }, (_, run) =>
  arenas.map((arena) => ({ arena, run: run + 1 })),
).flat().filter((job) => !completedKeys.has(`${job.arena}:${job.run}`));
const jobs = process.env.TRACE_ONLY === "1" && traceMatch
  ? allJobs.filter((job) => `${job.arena}-${job.run}` === traceMatch)
  : allJobs;
if (!jobs.length) throw new Error("No balance matches were selected.");

const chromePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browser = await chromium.launch({
  headless: true,
  executablePath: chromePath,
  args: [
    "--no-sandbox",
    "--disable-gpu",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
  ],
});

function makeReport() {
  const byArena = Object.fromEntries(arenas.map((arena) => {
    const matches = completed.filter((match) => match.arena === arena);
    const wins = { OpenAI: 0, Anthropic: 0, incomplete: 0 };
    for (const match of matches) wins[match.winner || "incomplete"] += 1;
    const mean = (selector) => matches.length
      ? Number((matches.reduce((sum, match) => sum + selector(match), 0) / matches.length).toFixed(2))
      : 0;
    const attackStats = {};
    for (const match of matches) {
      for (const [skill, stats] of Object.entries(match.attacks)) {
        const total = attackStats[skill] || (attackStats[skill] = { fired: 0, hit: 0, missed: 0, blocked: 0, dodged: 0 });
        for (const key of Object.keys(total)) total[key] += stats[key] || 0;
      }
    }
    return [arena, {
      matches: matches.length,
      wins,
      runnerWins: matches.filter((match) => match.winner === match.runnerCompany).length,
      chaserWins: matches.filter((match) => match.winner === match.chaserCompany).length,
      meanDurationSeconds: mean((match) => match.durationSeconds),
      maxRunnerStuckSeconds: Math.max(0, ...matches.map((match) => match.maxRunnerStuckSeconds)),
      maxChaserStuckSeconds: Math.max(0, ...matches.map((match) => match.maxChaserStuckSeconds)),
      matchesWithRunnerRecovery: matches.filter((match) => match.runnerRecoveryAttempts > 0).length,
      matchesWithChaserRecovery: matches.filter((match) => match.chaserRecoveryAttempts > 0).length,
      meanRunnerDamageTaken: mean((match) => match.runnerDamageTaken),
      meanAnchorsBroken: mean((match) => match.anchorsBroken),
      parries: matches.reduce((sum, match) => sum + (match.parryCount || 0), 0),
      postParryAttackEvents: matches.reduce((sum, match) => sum + (match.postParryAttackEvents || 0), 0),
      attackStats,
    }];
  }));
  return {
    baseUrl,
    decisionPolicy,
    runsPerArena,
    pairing: "Adjacent runs share a deterministic seed while swapping runner and chaser skins.",
    completed: completed.filter(isVerifiedMatch).length,
    incomplete: completed.filter((match) => !isVerifiedMatch(match)).length,
    byArena,
    matches: completed,
  };
}

function writeReport() {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(makeReport(), null, 2));
}

async function runMatch(job) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  let decisionCalls = 0;
  const arenaIndex = allArenas.indexOf(job.arena);
  // Match adjacent role swaps on the same random sequence so level/seed variance
  // does not masquerade as a runner or chaser advantage.
  const seedPair = Math.ceil(job.run / 2);
  const seed = ((arenaIndex + 1) * 1_000_000 + seedPair) >>> 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/api/decision") && response.status() >= 400) {
      errors.push(`decision HTTP ${response.status()}`);
    }
  });

  if (deterministicFallback) {
    await page.addInitScript((value) => {
      let state = value >>> 0;
      Math.random = () => {
        state = (state * 1_664_525 + 1_013_904_223) >>> 0;
        return state / 4_294_967_296;
      };
    }, seed);
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      try {
        if (url.origin !== baseUrl) {
          errors.push(`Blocked unexpected external resource: ${url.origin}`);
          await route.abort();
          return;
        }
        if (url.pathname === "/api/health") {
          await route.fulfill({ status: 200, json: { ready: true } });
          return;
        }
        if (url.pathname === "/api/decision") {
          decisionCalls += 1;
          const decision = route.request().postDataJSON()?.__offlineDecision;
          if (!decision) {
            errors.push("The deterministic local decision was missing from the request.");
            await route.fulfill({ status: 503, json: { error: "Offline decision unavailable." } });
            return;
          }
          await route.fulfill({ status: 200, json: decision });
          return;
        }
        const relativePath = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
        if (!["index.html", "game.js", "styles.css", "favicon.svg"].includes(relativePath) &&
            !relativePath.startsWith("assets/")) {
          await route.fulfill({ status: 404, body: "Not found." });
          return;
        }
        const filePath = path.resolve(projectRoot, relativePath);
        if (!filePath.startsWith(`${projectRoot}${path.sep}`)) {
          await route.fulfill({ status: 404, body: "Not found." });
          return;
        }
        let body = fs.readFileSync(filePath);
        if (relativePath === "game.js") {
          const source = body.toString("utf8");
          const offlineDecision = `(() => {
            const originalFetch = window.fetch.bind(window);
            window.fetch = (input, init = {}) => {
              if (input === "/api/decision" && init.body) {
                const state = JSON.parse(init.body);
                state.__offlineDecision = {
                  mode: modeFallback(), confidence: 0.5,
                  player_mode: playerModeFallback(), player_confidence: 0.5,
                  probabilities: {}, player_probabilities: {},
                };
                return originalFetch(input, { ...init, body: JSON.stringify(state) });
              }
              return originalFetch(input, init);
            };
          })();`;
          body = `${source}\n${offlineDecision}`;
        }
        const contentTypes = {
          ".css": "text/css; charset=utf-8",
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".jpg": "image/jpeg",
          ".png": "image/png",
          ".svg": "image/svg+xml",
        };
        await route.fulfill({
          status: 200,
          contentType: contentTypes[path.extname(filePath)] || "application/octet-stream",
          body,
        });
      } catch {
        // A resource may still be in flight as a finished match closes its page.
      }
    });
  }

  const runner = job.run % 2 ? "sam" : "dario";
  const chaser = runner === "sam" ? "dario" : "sam";
  const startedAt = Date.now();
  const eventKeys = new Set();
  const events = [];
  const observedActions = new Map();
  const trace = [];
  let maxRunnerStuckSeconds = 0;
  let maxChaserStuckSeconds = 0;
  let runnerRecoveryAttempts = 0;
  let chaserRecoveryAttempts = 0;
  let blockedSamples = 0;
  let runnerTravel = 0;
  let chaserTravel = 0;
  let runnerDamageTaken = 0;
  let minimumGap = Infinity;
  let contactSeconds = 0;
  let anchorsBroken = 0;
  let previous = null;
  let finalState = null;

  try {
    await page.goto(`${baseUrl}/?qa=1&balance=${job.arena}-${job.run}`, { waitUntil: "domcontentloaded" });
    await page.locator("#level-thumbnails .level-thumbnail").nth(arenaIndex).waitFor();
    await page.locator("#mode-auto").click();
    await page.locator(`#level-thumbnails .level-thumbnail`).nth(arenaIndex).click();
    await page.locator(`input[name="runner-skin"][value="${runner}"]`).check();
    await page.locator(`input[name="chaser-skin"][value="${chaser}"]`).check();
    await page.locator("#start-button").click();
    await page.waitForFunction(() => Boolean(window.__FRONTIER_QA__?.snapshot()?.running));

    while (Date.now() - startedAt < timeoutMs) {
      finalState = await page.evaluate(() => window.__FRONTIER_QA__?.snapshot());
      if (!finalState) throw new Error("The game QA snapshot is unavailable.");
      if (traceMatch === `${job.arena}-${job.run}`) {
        trace.push({
          elapsed: finalState.elapsed,
          player: {
            x: finalState.player.x, y: finalState.player.y, vx: finalState.player.vx, vy: finalState.player.vy,
            target: finalState.player.target, recoveryTarget: finalState.player.recoveryTarget,
            stuck: finalState.player.stuck, recoveryAttempts: finalState.player.recoveryAttempts,
            pathLength: finalState.player.pathLength, blocked: finalState.player.currentBlocked,
          },
          jev: {
            x: finalState.jev.x, y: finalState.jev.y, vx: finalState.jev.vx, vy: finalState.jev.vy,
            target: finalState.jev.target, recoveryTarget: finalState.jev.recoveryTarget,
            stuck: finalState.jev.stuck, recoveryAttempts: finalState.jev.recoveryAttempts,
            pathLength: finalState.jev.pathLength, blocked: finalState.jev.currentBlocked,
            mode: finalState.jev.mode,
          },
        });
      }
      if (previous) {
        const dt = Math.max(0, finalState.elapsed - previous.elapsed);
        runnerTravel += Math.hypot(finalState.player.x - previous.player.x, finalState.player.y - previous.player.y);
        chaserTravel += Math.hypot(finalState.jev.x - previous.jev.x, finalState.jev.y - previous.jev.y);
        if (Math.hypot(finalState.player.x - finalState.jev.x, finalState.player.y - finalState.jev.y) < 100) contactSeconds += dt;
        if (finalState.player.health < previous.player.health) runnerDamageTaken += previous.player.health - finalState.player.health;
      }
      previous = finalState;

      const gap = Math.hypot(finalState.player.x - finalState.jev.x, finalState.player.y - finalState.jev.y);
      minimumGap = Math.min(minimumGap, gap);
      maxRunnerStuckSeconds = Math.max(maxRunnerStuckSeconds, finalState.player.stuck || 0);
      maxChaserStuckSeconds = Math.max(maxChaserStuckSeconds, finalState.jev.stuck || 0);
      runnerRecoveryAttempts = Math.max(runnerRecoveryAttempts, finalState.player.recoveryAttempts || 0);
      chaserRecoveryAttempts = Math.max(chaserRecoveryAttempts, finalState.jev.recoveryAttempts || 0);
      if (finalState.player.currentBlocked || finalState.jev.currentBlocked) blockedSamples += 1;
      anchorsBroken = Math.max(anchorsBroken, finalState.anchors.filter((anchor) => anchor.health <= 0).length);
      for (const event of finalState.events || []) {
        const key = `${event.at}:${event.event}`;
        if (!eventKeys.has(key)) {
          eventKeys.add(key);
          events.push(event);
        }
      }
      for (const action of finalState.jev.actionHistory || []) {
        const key = `${action.at}:${action.requested}:${action.executed}`;
        observedActions.set(key, action);
      }
      if (!finalState.running || finalState.result.visible) break;
      await page.waitForTimeout(sampleIntervalMs);
    }
  } catch (error) {
    errors.push(error.message);
  }

  const eventCounts = events.reduce((counts, item) => {
    counts[item.event] = (counts[item.event] || 0) + 1;
    return counts;
  }, {});
  const attacks = {
    rift_rend: {
      fired: eventCounts.rift_rend_fired || 0,
      hit: eventCounts.rift_rend_hit || 0,
      missed: eventCounts.rift_rend_missed || 0,
      blocked: eventCounts.rift_rend_interrupted || 0,
      dodged: eventCounts.rift_rend_evaded || 0,
    },
    power_blast: {
      started: eventCounts.power_blast_windup || 0,
      fired: eventCounts.power_blast_fired || 0,
      hit: eventCounts.blast_hit || 0,
      missed: eventCounts.blast_missed || 0,
      dodged: eventCounts.blast_dodged || 0,
      blocked: (eventCounts.blast_cover_blocked || 0) + (eventCounts.blast_guard_blocked || 0),
      interrupted: eventCounts.blast_canceled || 0,
    },
    runner_skills: {
      stasis_casts: eventCounts.stasis_cast_fired || 0,
      freezes: eventCounts.freeze_hit || 0,
      stasis_misses: eventCounts.freeze_missed || 0,
      mascot_launches: eventCounts.mascot_charge_launched || 0,
      mascot_hits: eventCounts.mascot_charge_hit || 0,
      mascot_misses: eventCounts.mascot_charge_missed || 0,
    },
    soul_salvo: {
      fired: eventCounts.soul_salvo_fired || 0,
      hit: eventCounts.salvo_hit || 0,
      missed: eventCounts.salvo_missed || 0,
      blocked: (eventCounts.salvo_blocked || 0) + (eventCounts.salvo_cover_blocked || 0),
      dodged: eventCounts.salvo_dodged || 0,
    },
  };
  const parryTimes = events.filter((event) => event.event === "lantern_parry").map((event) => event.at);
  const attackEvents = new Set([
    "rift_rend_fired", "power_blast_windup", "soul_salvo_fired", "mine_placed",
    "signal_tether_fired", "meteor_storm_started",
  ]);
  const postParryAttackEvents = events.filter((event) => attackEvents.has(event.event) &&
    parryTimes.some((at) => event.at >= at && event.at < at + 3.8));
  const parryRecoveryActionOverrides = [...observedActions.values()].filter((action) =>
    attackModes.has(action.requested) && action.executed === "flank" &&
    parryTimes.some((at) => action.at >= at && action.at < at + 3.8));
  const title = finalState?.result?.visible ? finalState.result.title : "";
  const winner = title.includes("OpenAI won") ? "OpenAI" : title.includes("Anthropic won") ? "Anthropic" : "";
  const match = {
    arena: job.arena,
    run: job.run,
    runner,
    chaser,
    decisionPolicy,
    seed,
    seedPair,
    decisionCalls,
    runnerCompany: runner === "sam" ? "OpenAI" : "Anthropic",
    chaserCompany: chaser === "sam" ? "OpenAI" : "Anthropic",
    winner,
    title,
    complete: Boolean(finalState && (!finalState.running || finalState.result.visible)),
    durationSeconds: finalState?.elapsed || 0,
    timeout: Boolean(finalState?.running && Date.now() - startedAt >= timeoutMs),
    runnerDamageTaken: Number(runnerDamageTaken.toFixed(2)),
    runnerTravel: Math.round(runnerTravel),
    chaserTravel: Math.round(chaserTravel),
    minimumGap: Number.isFinite(minimumGap) ? Math.round(minimumGap) : null,
    contactSeconds: Number(contactSeconds.toFixed(2)),
    anchorsBroken,
    maxRunnerStuckSeconds: Number(maxRunnerStuckSeconds.toFixed(2)),
    maxChaserStuckSeconds: Number(maxChaserStuckSeconds.toFixed(2)),
    runnerRecoveryAttempts,
    chaserRecoveryAttempts,
    blockedSamples,
    parryCount: parryTimes.length,
    parryRecoveryActionOverrides: parryRecoveryActionOverrides.length,
    postParryAttackEvents: postParryAttackEvents.length,
    actionHistory: [...observedActions.values()].sort((left, right) => left.at - right.at),
    runnerHealth: finalState?.player.health ?? null,
    chaserHealth: finalState?.jev.health ?? null,
    attacks,
    events,
    errors,
    ...(trace.length ? { trace } : {}),
  };
  await page.close();
  return match;
}

let nextJob = 0;
async function worker() {
  while (nextJob < jobs.length) {
    const job = jobs[nextJob++];
    const match = await runMatch(job);
    const previousIndex = completed.findIndex((saved) => saved.arena === job.arena && saved.run === job.run);
    if (previousIndex >= 0) {
      const previous = completed[previousIndex];
      match.previousAttempts = [
        ...(previous.previousAttempts || []),
        {
          complete: previous.complete,
          timeout: previous.timeout,
          durationSeconds: previous.durationSeconds,
          errors: previous.errors,
          runnerRecoveryAttempts: previous.runnerRecoveryAttempts,
          chaserRecoveryAttempts: previous.chaserRecoveryAttempts,
        },
      ];
      completed[previousIndex] = match;
    } else {
      completed.push(match);
    }
    writeReport();
    console.log(`${completed.length}/${runsPerArena * arenas.length} ${match.arena} #${match.run}: ${match.title || (match.timeout ? "TIMEOUT" : "INCOMPLETE")} in ${match.durationSeconds.toFixed(1)}s; stuck ${match.maxRunnerStuckSeconds}/${match.maxChaserStuckSeconds}s, recoveries ${match.runnerRecoveryAttempts}/${match.chaserRecoveryAttempts}`);
  }
}

try {
  console.log(`Headless Jev-vs-Jev balance run: ${jobs.length} remaining of ${runsPerArena * arenas.length} matches; ${concurrency} parallel pages.`);
  if (completed.length) console.log(`Resuming with ${completed.length} saved matches.`);
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => worker()));
  writeReport();
  console.log(`Saved raw match data to ${outputPath}`);
  console.log(JSON.stringify(makeReport().byArena, null, 2));
} finally {
  await browser.close();
}
