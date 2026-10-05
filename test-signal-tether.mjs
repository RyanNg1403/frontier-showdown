import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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
      // Try the next local Playwright installation.
    }
  }
  throw new Error("Playwright was not found. Set PLAYWRIGHT_MODULE to its entry point.");
}

const { chromium } = await loadPlaywright();
const baseUrl = process.env.GAME_URL || "http://127.0.0.1:4173";
const origin = new URL(baseUrl).origin;
const screenshotDirectory = path.join(os.tmpdir(), "frontier-signal-tether-audit");
const arenas = [
  ["crossing", "OpenAI Glass Atrium"],
  ["cinder", "OpenAI Compute Studio"],
  ["drowned", "Anthropic Reading Room"],
  ["glassgarden", "Anthropic Living Studio"],
  ["meridian", "Paris AI Action Hall"],
  ["fractured", "AI Impact Expo Pavilion"],
];
const skinPairs = [
  { runner: "sam", chaser: "dario", company: "Anthropic", icon: "anthropic", name: "Claude Thread Latch" },
  { runner: "dario", chaser: "sam", company: "OpenAI", icon: "openai", name: "Codex Signal Latch" },
];
const expectedArt = ["signalSam", "signalDario", "signalOpenAI", "signalAnthropic"];
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--no-sandbox", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
});

const totals = { arenaSkinPasses: 0, skillHits: 0, apiStubs: 0, externalRequests: [], pageErrors: [] };

function checkArt(fixture) {
  assert.equal(fixture.laneClear, true, `${fixture.map}: fixture should provide a clear lane`);
  assert.ok(fixture.gap >= 250 && fixture.gap <= 690, `${fixture.map}: fixture range is valid`);
  assert.deepEqual(Object.keys(fixture.skillArt).sort(), [...expectedArt].sort());
  for (const [id, atlas] of Object.entries(fixture.skillArt)) {
    assert.equal(atlas.loaded, true, `${id} atlas should load`);
    assert.equal(atlas.nonemptyFrames, 8, `${id} should expose all eight frames`);
    const cellWidth = atlas.width / 4;
    const cellHeight = atlas.height / 2;
    assert.ok(Math.abs(cellWidth - cellHeight) < 1, `${id} should use square atlas cells`);
    for (const [index, frame] of atlas.frameBounds.entries()) {
      assert.ok(frame, `${id} frame ${index} should be nonempty`);
      assert.ok(frame.width > 25 && frame.height > 25, `${id} frame ${index} should be visible`);
      assert.ok(frame.x >= 0 && frame.y >= 0, `${id} frame ${index} should stay inside its cell`);
      assert.ok(frame.x + frame.width <= cellWidth + 1, `${id} frame ${index} should not spill right`);
      assert.ok(frame.y + frame.height <= cellHeight + 1, `${id} frame ${index} should not spill down`);
    }
  }
  for (const company of ["OpenAI", "Anthropic"]) {
    const icon = fixture.icons[company];
    assert.equal(icon.loaded, true, `${company} Signal Tether icon should load`);
    assert.ok(icon.width > 0 && icon.height > 0, `${company} Signal Tether icon should have dimensions`);
    assert.ok(Math.abs(icon.width - icon.height) <= 2, `${company} icon should preserve its square shape`);
  }
}

async function openMatch(context, mapId, mapName, pair) {
  const page = await context.newPage();
  page.on("pageerror", (error) => totals.pageErrors.push(`${mapId}/${pair.chaser}: ${error.message}`));
  await page.addInitScript(({ runner, chaser }) => {
    localStorage.clear();
    localStorage.setItem("jevil.musicEnabled", "false");
    localStorage.setItem("frontier.runnerSkin", runner);
    localStorage.setItem("frontier.chaserSkin", chaser);
  }, pair);
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin !== origin) {
      totals.externalRequests.push(requestUrl.href);
      await route.abort();
      return;
    }
    if (requestUrl.pathname === "/api/decision") {
      totals.apiStubs += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          mode: "pursue",
          confidence: 0.8,
          probabilities: { pursue: 0.8, intercept: 0.2 },
          plan: "steady_pressure",
          plan_confidence: 0.7,
        }),
      });
      return;
    }
    await route.continue();
  });
  await page.goto(`${baseUrl}/?qa=1&signal-tether-audit=${mapId}-${pair.chaser}`, { waitUntil: "domcontentloaded" });
  await page.locator(`#level-thumbnails button[aria-label="Select ${mapName}"]`).click();
  await page.locator("#start-button").click();
  await page.waitForFunction(() => Boolean(window.__FRONTIER_QA__?.snapshot()?.running));
  await page.waitForFunction(() => window.__FRONTIER_QA__?.runnerSkillArtReady() === true);
  return page;
}

async function openFixture(page, pair) {
  const fixture = await page.evaluate(({ runner, chaser }) =>
    window.__FRONTIER_QA__.prepareSignalTetherFixture(runner, chaser), pair);
  checkArt(fixture);
  assert.equal(fixture.runnerSkin, pair.runner);
  assert.equal(fixture.chaserSkin, pair.chaser);
  assert.equal(fixture.chaserCompany, pair.company);
  return fixture;
}

async function castUntilFlight(page) {
  const started = await page.evaluate(() => window.__FRONTIER_QA__.chooseSignalTether());
  assert.equal(started.mode, "signal_tether", "clear, in-range use should start the skill");
  assert.equal(started.phase, "windup");
  assert.ok(started.events.includes("signal_tether_windup"));
  const fired = await page.evaluate(() => window.__FRONTIER_QA__.advanceSignalTether(0.39));
  assert.ok(fired.events.includes("signal_tether_fired"), "wind-up should end in a projectile");
  assert.ok(fired.projectiles.some((projectile) => projectile.kind === "signal_tether"));
  return fired;
}

async function verifyCallout(page, pair, callouts) {
  const callout = callouts.at(-1);
  assert.equal(callout?.abilityId, "signal_tether");
  assert.equal(callout?.owner, "jev");
  assert.equal(callout?.skillName, pair.name);
  const icon = await page.evaluate(() => {
    const node = document.querySelector('#skill-catalog .skill-icon[data-owner="jev"][data-skill-id="signal_tether"]');
    return node ? getComputedStyle(node).backgroundImage : "";
  });
  assert.match(icon, new RegExp(`frontier-skill-signal-icon-${pair.icon}\\.svg`));
}

async function verifySettings(page, pair) {
  const manual = await page.evaluate(() => ({
    names: [...document.querySelectorAll("#skill-catalog [data-skill-name]")].map((node) => node.textContent),
    signalIcon: getComputedStyle(document.querySelector('#skill-catalog .skill-icon[data-owner="jev"][data-skill-id="signal_tether"]')).backgroundImage,
  }));
  assert.ok(manual.names.includes(pair.name), "settings should use the chaser lab's Signal Tether name");
  assert.doesNotMatch(manual.names.join(" "), /summon wraith|wraithling|inference rush|redline charge/i,
    "retired ability names must not remain in the live skill manual");
  assert.match(manual.signalIcon, new RegExp(`frontier-skill-signal-icon-${pair.icon}\\.svg`));
}

async function testCounter(page, pair, counter) {
  await openFixture(page, pair);
  await castUntilFlight(page);
  await page.evaluate((name) => window.__FRONTIER_QA__[name](), counter.prepare);
  const result = await page.evaluate(() => window.__FRONTIER_QA__.advanceSignalTether(0.5));
  assert.ok(result.events.includes(counter.event), `${counter.label} should counter Signal Tether`);
  assert.equal(result.runnerHealth, 4, `${counter.label} must not lose health to Signal Tether`);
  if (counter.noSnare) assert.equal(result.runnerSnared, 0, `${counter.label} should prevent the snare`);
}

async function testCounters(page, pair) {
  await testCounter(page, pair, {
    label: "Lantern Guard",
    prepare: "setSignalTetherGuard",
    event: "signal_tether_guard_blocked",
    noSnare: true,
  });
  await testCounter(page, pair, {
    label: "Phase Dash / invulnerability",
    prepare: "setSignalTetherDash",
    event: "signal_tether_evaded",
    noSnare: true,
  });
  await testCounter(page, pair, {
    label: "Mirror Echo decoy",
    prepare: "setSignalTetherDecoy",
    event: "signal_tether_decoy_blocked",
    noSnare: true,
  });

  await openFixture(page, pair);
  const blocked = await page.evaluate(() => window.__FRONTIER_QA__.prepareSignalTetherBlockedLane());
  assert.equal(blocked.laneClear, false, "cover fixture should obstruct the projectile lane");
  const blockedChoice = await page.evaluate(() => window.__FRONTIER_QA__.chooseSignalTether());
  assert.notEqual(blockedChoice.mode, "signal_tether", "cover should prevent the skill from starting");
  assert.equal(blockedChoice.phase, "");
  assert.equal(blockedChoice.events.includes("signal_tether_windup"), false);

  await openFixture(page, pair);
  const interrupted = await page.evaluate(() => window.__FRONTIER_QA__.interruptSignalTether());
  assert.equal(interrupted.started, true, "a clear lane should allow the wind-up before interruption");
  assert.equal(interrupted.phase, "");
  assert.equal(interrupted.projectiles, 0);
  assert.ok(interrupted.events.includes("signal_tether_canceled"), "stun should interrupt wind-up");

  await openFixture(page, pair);
  await castUntilFlight(page);
  const repeat = await page.evaluate(() => window.__FRONTIER_QA__.chooseSignalTether());
  assert.notEqual(repeat.mode, "signal_tether", "cooldown should prevent immediate recast");
}

async function testMovingTarget(page, pair, mapId) {
  const fixture = await page.evaluate(({ runner, chaser }) =>
    window.__FRONTIER_QA__.prepareSignalTetherFixture(runner, chaser, true), pair);
  const input = fixture.movementInput;
  assert.ok(input, `${mapId}: fixture should offer a safe moving-target route`);
  const started = await page.evaluate((direction) => window.__FRONTIER_QA__.chooseSignalTether(direction), input);
  assert.equal(started.phase, "windup",
    `${mapId}: a moving runner should not prevent a valid wind-up (fixture=${JSON.stringify({ laneClear: fixture.laneClear, gap: fixture.gap, input, started })})`);
  const fired = await page.evaluate((direction) =>
    window.__FRONTIER_QA__.advanceSignalTether(0.5, direction, "signal_tether_fired"), input);
  assert.ok(fired.events.includes("signal_tether_fired"), `${mapId}: moving-target cast should fire`);
  const impact = await page.evaluate((direction) =>
    window.__FRONTIER_QA__.advanceSignalTether(1.25, direction, "signal_tether_hit"), input);
  assert.ok(impact.events.includes("signal_tether_hit"), `${mapId}: lead should intercept the moving runner`);
  assert.ok(fired.runnerTravel + impact.runnerTravel >= 70, `${mapId}: runner should move meaningfully during the cast`);
  assert.equal(impact.runnerHealth, 4, `${mapId}: Signal Tether remains control-only`);
  assert.ok(impact.runnerSnared >= 0.8, `${mapId}: moving hit should apply a visible slow`);
  assert.ok(impact.runnerReaction >= 0.65, `${mapId}: moving hit should play a visible reaction`);
  return { fixture, input, impact };
}

try {
  await fs.mkdir(screenshotDirectory, { recursive: true });
  for (const [mapId, mapName] of arenas) {
    for (const pair of skinPairs) {
      const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
      try {
        const page = await openMatch(context, mapId, mapName, pair);
        const fixture = await openFixture(page, pair);
        const initialDistance = fixture.gap;
        const started = await page.evaluate(() => window.__FRONTIER_QA__.chooseSignalTether());
        assert.equal(started.phase, "windup");

        const saveVisuals = mapId === "crossing";
        if (saveVisuals) {
          await page.evaluate(() => window.__FRONTIER_QA__.advanceSignalTether(0.16));
          await page.screenshot({ path: path.join(screenshotDirectory, `${pair.icon}-windup.png`) });
        }
        const fired = await page.evaluate((seconds) => window.__FRONTIER_QA__.advanceSignalTether(seconds),
          saveVisuals ? 0.23 : 0.39);
        assert.ok(fired.events.includes("signal_tether_fired"));
        await verifyCallout(page, pair, fired.callouts);
        if (saveVisuals) {
          await page.screenshot({ path: path.join(screenshotDirectory, `${pair.icon}-projectile.png`) });
        }
        const impact = await page.evaluate(() =>
          window.__FRONTIER_QA__.advanceSignalTether(0.48, { x: 0, y: 0 }, "signal_tether_hit"));
        assert.ok(impact.events.includes("signal_tether_hit"), `${mapId}: stationary clear-lane target should be hit`);
        assert.equal(impact.runnerHealth, 4, "the skill is control, not health damage");
        assert.ok(impact.runnerSnared >= 0.8, "a hit should visibly slow the runner");
        assert.ok(impact.runnerReaction >= 0.7, "a hit should play the runner reaction animation");
        assert.ok(Math.hypot(impact.runner.x - fixture.runner.x, impact.runner.y - fixture.runner.y) >= 30,
          `${mapId}: a hit should pull the runner toward the chaser`);
        if (saveVisuals) {
          await page.screenshot({ path: path.join(screenshotDirectory, `${pair.icon}-impact.png`) });
        }
        totals.skillHits += 1;
        totals.arenaSkinPasses += 1;

        await verifySettings(page, pair);
        if (mapId === "crossing" && pair === skinPairs[0]) await testCounters(page, pair);
        const moving = await testMovingTarget(page, pair, mapId);
        if (saveVisuals) await page.screenshot({ path: path.join(screenshotDirectory, `${pair.icon}-moving-impact.png`) });
        console.log(`PASS ${mapId} | runner=${pair.runner} | chaser=${pair.chaser} | gap=${initialDistance} | stationary + moving hit (${moving.input.label})`);
        await page.close();
      } finally {
        await context.close();
      }
    }
  }
  assert.deepEqual(totals.externalRequests, [], "headless run must not contact external services");
  assert.deepEqual(totals.pageErrors, [], "game should not produce browser errors");
  console.log(JSON.stringify({ ...totals, screenshots: screenshotDirectory }, null, 2));
} finally {
  await browser.close();
}
