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
      // Try the next locally available Playwright installation.
    }
  }
  throw new Error("Playwright was not found. Set PLAYWRIGHT_MODULE to its entry point.");
}

const { chromium } = await loadPlaywright();
const baseUrl = process.env.GAME_URL || "http://127.0.0.1:4173";
const origin = new URL(baseUrl).origin;
const screenshots = process.env.SCREENSHOT_DIR || path.join(os.tmpdir(), "frontier-soul-salvo-audit");
const arenas = [
  ["crossing", "OpenAI Glass Atrium"],
  ["cinder", "OpenAI Compute Studio"],
  ["drowned", "Anthropic Reading Room"],
  ["glassgarden", "Anthropic Living Studio"],
  ["meridian", "Paris AI Action Hall"],
  ["fractured", "AI Impact Expo Pavilion"],
];
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  args: ["--no-sandbox", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await context.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem("jevil.musicEnabled", "false");
  localStorage.setItem("frontier.runnerSkin", "sam");
  localStorage.setItem("frontier.chaserSkin", "dario");
});
const errors = [];
const network = { decisionStubs: 0, blockedExternal: [] };

async function openMatch(mapName, capture = false) {
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`${mapName}: ${error.message}`));
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin === origin) {
      if (requestUrl.pathname === "/api/decision") {
        network.decisionStubs += 1;
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
      } else {
        await route.continue();
      }
      return;
    }
    network.blockedExternal.push(requestUrl.href);
    await route.abort();
  });

  await page.goto(`${baseUrl}/?qa=1`, { waitUntil: "domcontentloaded" });
  await page.locator(`#level-thumbnails button[aria-label="Select ${mapName}"]`).click();
  assert.equal(await page.locator("#settings-volume").inputValue(), "27.5", "fresh installs should halve the prior 55% music volume");
  await page.locator("#start-button").click();
  await page.waitForFunction(() => Boolean(window.__FRONTIER_QA__?.snapshot()?.running));
  assert.equal(await page.evaluate(() => window.__FRONTIER_QA__.snapshot().musicVolume), 0.275, "the runtime audio level should be exactly half of 55%");
  if (capture) {
    await page.locator("#settings-toggle").click();
    assert.equal(await page.locator("#settings-volume").inputValue(), "27.5", "settings should show the halved default volume");
    assert.equal(await page.locator("#settings-volume-value").textContent(), "27.5%");
    await page.locator("#settings-resume").click();
    const decisionVisible = await page.locator("#decision-toggle").getAttribute("aria-pressed");
    if (decisionVisible === "true") await page.locator("#decision-toggle").click();
    await page.evaluate(() => {
      if (!document.querySelector("#decision-panels").classList.contains("is-hidden")) {
        document.querySelector("#decision-toggle").click();
      }
    });
    await page.waitForTimeout(220);
    assert.equal(
      await page.locator("#decision-panels").evaluate((element) => element.classList.contains("is-hidden")),
      true,
      "the probability panel should be hidden for uncluttered screenshot captures",
    );
  }
  return page;
}

function checkVolley(volley, expectedSkin) {
  assert.equal(volley.phase, "", "wind-up should complete");
  assert.equal(volley.projectiles.length, 3, "a clear lane should emit three bolts");
  assert.deepEqual(volley.projectiles.map((shot) => shot.skinId), Array(3).fill(expectedSkin));
  const speeds = volley.projectiles.map((shot) => Math.hypot(shot.vx, shot.vy));
  for (const speed of speeds) assert.ok(Math.abs(speed - 920) < 0.01, `expected 920-unit speed, got ${speed}`);
  const angles = volley.projectiles.map((shot) => Math.atan2(shot.vy, shot.vx));
  const angleDelta = (to, from) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
  assert.ok(Math.abs(angleDelta(angles[1], angles[0]) - 0.15) < 0.002, "left fan lane should match its 0.15-radian warning");
  assert.ok(Math.abs(angleDelta(angles[2], angles[1]) - 0.15) < 0.002, "right fan lane should match its 0.15-radian warning");
  assert.ok(volley.events.includes("soul_salvo_windup"));
  assert.ok(volley.events.includes("soul_salvo_fired"));
}

function interceptMissDistance(projectile, runner) {
  const speed = Math.hypot(projectile.vx, projectile.vy);
  const relativeX = runner.x - projectile.x;
  const relativeY = runner.y - projectile.y;
  const a = runner.vx ** 2 + runner.vy ** 2 - speed ** 2;
  const b = 2 * (relativeX * runner.vx + relativeY * runner.vy);
  const c = relativeX ** 2 + relativeY ** 2;
  const discriminant = b ** 2 - 4 * a * c;
  const times = discriminant >= 0
    ? [(-b - Math.sqrt(discriminant)) / (2 * a), (-b + Math.sqrt(discriminant)) / (2 * a)]
    : [];
  const flightTime = times.filter((time) => Number.isFinite(time) && time > 0).sort((left, right) => left - right)[0];
  assert.ok(flightTime, "the volley should have a valid intercept with the runner's current trajectory");
  const predicted = { x: runner.x + runner.vx * flightTime, y: runner.y + runner.vy * flightTime };
  const directionLength = Math.hypot(projectile.vx, projectile.vy);
  const direction = { x: projectile.vx / directionLength, y: projectile.vy / directionLength };
  const projection = Math.max(0, Math.min(projectile.maxDistance, (predicted.x - projectile.x) * direction.x + (predicted.y - projectile.y) * direction.y));
  const nearest = { x: projectile.x + direction.x * projection, y: projectile.y + direction.y * projection };
  return Math.hypot(predicted.x - nearest.x, predicted.y - nearest.y);
}

try {
  await fs.mkdir(screenshots, { recursive: true });
  const mainPage = await openMatch(arenas[0][1], true);
  const fixture = await mainPage.evaluate(() => window.__FRONTIER_QA__.prepareSoulSalvoFixture("dario"));
  assert.equal(fixture.phase, "windup", "skill should enter its telegraphed wind-up");
  assert.ok(Math.abs(fixture.warningSeconds - 0.36) < 0.001, "the 0.36-second dodge window should be preserved");
  await mainPage.waitForTimeout(250);
  await mainPage.screenshot({ path: path.join(screenshots, "arena-combat.png") });

  const volley = await mainPage.evaluate(() => window.__FRONTIER_QA__.advanceSoulSalvo(0.36));
  checkVolley(volley, "dario");
  assert.equal(volley.callouts.at(-1)?.skillName, "Claude Scatterflare", "Anthropic skin should keep its branded callout");
  const firstShot = { ...volley.projectiles[1] };
  const firstStep = await mainPage.evaluate(() => window.__FRONTIER_QA__.stepSoulSalvoProjectiles(0.12));
  assert.ok(
    Math.hypot(firstStep.projectiles[1].x - firstShot.x, firstStep.projectiles[1].y - firstShot.y) > 100,
    "bolts should travel during the deterministic simulation step",
  );
  assert.equal(firstStep.projectiles[1].vx, firstShot.vx, "fired bolts must not home toward a moving runner");
  await mainPage.waitForTimeout(1500);
  await mainPage.screenshot({ path: path.join(screenshots, "soul-salvo.png") });

  const hit = await mainPage.evaluate(() => window.__FRONTIER_QA__.stepSoulSalvoProjectiles(0.9));
  assert.equal(hit.playerHealth, 3, "the center bolt should hit a stationary, exposed runner");
  assert.ok(hit.events.includes("salvo_hit"));

  const parryFixture = await mainPage.evaluate(() => window.__FRONTIER_QA__.prepareSoulSalvoFixture("dario"));
  assert.equal(parryFixture.phase, "windup");
  const parryVolley = await mainPage.evaluate(() => window.__FRONTIER_QA__.advanceSoulSalvo(0.36));
  checkVolley(parryVolley, "dario");
  await mainPage.evaluate(() => window.__FRONTIER_QA__.setSoulSalvoTestGuard());
  const parried = await mainPage.evaluate(() => window.__FRONTIER_QA__.stepSoulSalvoProjectiles(0.9));
  assert.equal(parried.playerHealth, 4, "Lantern Guard should still parry the center bolt");
  assert.ok(parried.events.includes("salvo_guard_blocked"));
  assert.ok(parried.events.includes("lantern_parry"));

  const decoyFixture = await mainPage.evaluate(() => window.__FRONTIER_QA__.prepareSoulSalvoFixture("dario"));
  assert.equal(decoyFixture.phase, "windup");
  await mainPage.evaluate(() => window.__FRONTIER_QA__.advanceSoulSalvo(0.36));
  await mainPage.evaluate(() => window.__FRONTIER_QA__.setSoulSalvoTestDecoy());
  const decoy = await mainPage.evaluate(() => window.__FRONTIER_QA__.stepSoulSalvoProjectiles(0.9));
  assert.equal(decoy.playerHealth, 4, "Mirror Echo should draw the center bolt away from the runner");
  assert.ok(decoy.events.includes("salvo_decoy_blocked"));

  const dodgeFixture = await mainPage.evaluate(() => window.__FRONTIER_QA__.prepareSoulSalvoFixture("dario"));
  await mainPage.evaluate(() => window.__FRONTIER_QA__.advanceSoulSalvo(0.36));
  await mainPage.evaluate(() => window.__FRONTIER_QA__.moveSoulSalvoTestRunner(220));
  const dodged = await mainPage.evaluate(() => window.__FRONTIER_QA__.stepSoulSalvoProjectiles(1.2));
  assert.equal(dodged.playerHealth, 4, "a runner who leaves the marked fan should avoid damage");
  assert.ok(
    dodged.events.some((event) => ["salvo_missed", "salvo_cover_blocked"].includes(event)),
    `a dodged volley should resolve as a miss or hit cover; events: ${dodged.events.join(", ")}`,
  );
  assert.equal(dodgeFixture.phase, "windup");

  const movingFixture = await mainPage.evaluate(() => window.__FRONTIER_QA__.prepareSoulSalvoFixture("dario", true));
  assert.ok(Math.hypot(movingFixture.runnerInput.x, movingFixture.runnerInput.y) > 0.99);
  const movingVolley = await mainPage.evaluate(() => window.__FRONTIER_QA__.advanceSoulSalvo(0.36));
  checkVolley(movingVolley, "dario");
  const movingShot = movingVolley.projectiles[1];
  const movingAimError = interceptMissDistance(movingShot, movingVolley.runner);
  assert.ok(
    movingAimError < movingShot.radius + 14 + 3,
    `wind-up prediction should not lead a second full warning window; miss distance was ${movingAimError.toFixed(1)}`,
  );
  const movingHit = await mainPage.evaluate(() => window.__FRONTIER_QA__.stepSoulSalvoProjectiles(0.9));
  assert.equal(movingHit.playerHealth, 3, "the volley should intercept a runner who holds a clear, steady route");
  assert.ok(movingHit.events.includes("salvo_hit"));

  const openAiVolleyFixture = await mainPage.evaluate(() => window.__FRONTIER_QA__.prepareSoulSalvoFixture("sam"));
  assert.equal(openAiVolleyFixture.phase, "windup");
  const openAiVolley = await mainPage.evaluate(() => window.__FRONTIER_QA__.advanceSoulSalvo(0.36));
  checkVolley(openAiVolley, "sam");
  assert.equal(openAiVolley.callouts.at(-1)?.skillName, "Parallel Salvo", "OpenAI skin should keep its branded callout");
  await mainPage.close();

  for (const [mapId, mapName] of arenas.slice(1)) {
    const page = await openMatch(mapName);
    const lane = await page.evaluate((skinId) => window.__FRONTIER_QA__.prepareSoulSalvoFixture(skinId), mapId === "drowned" ? "sam" : "dario");
    assert.equal(lane.phase, "windup", `${mapId} should have a valid attack lane`);
    assert.ok(lane.gap >= 240 && lane.gap <= 820, `${mapId} fixture must be within skill range`);
    const shot = await page.evaluate(() => window.__FRONTIER_QA__.advanceSoulSalvo(0.36));
    checkVolley(shot, mapId === "drowned" ? "sam" : "dario");
    await page.close();
  }

  assert.ok(network.decisionStubs >= arenas.length, "each test match should use the local decision stub");
  assert.deepEqual(network.blockedExternal, [], "the test must not contact external services");
  assert.deepEqual(errors, [], "the game should not raise browser runtime errors");
  for (const filename of ["arena-combat.png", "soul-salvo.png"]) {
    const image = await fs.stat(path.join(screenshots, filename));
    assert.ok(image.size > 40_000, `${filename} should contain a full gameplay capture`);
  }
  console.log(JSON.stringify({
    result: "passed",
    arenas: arenas.map(([id]) => id),
    scenarios: ["six arena lanes", "wind-up and three-shot fan", "stationary hit", "moving-target intercept", "Lantern Guard parry", "Mirror Echo diversion", "post-fire dodge", "both company skins", "fresh-install music volume"],
    movingTargetMissDistance: Number(movingAimError.toFixed(2)),
    decisionApiStubs: network.decisionStubs,
    externalRequests: network.blockedExternal.length,
    screenshots: ["arena-combat.png", "soul-salvo.png"].map((filename) => path.join(screenshots, filename)),
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
