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
      // Continue to the next locally available Playwright installation.
    }
  }
  throw new Error("Playwright was not found. Set PLAYWRIGHT_MODULE to its entry point.");
}

const { chromium } = await loadPlaywright();
const screenshotDirectory = process.env.SCREENSHOT_DIR || path.join(os.tmpdir(), "frontier-runner-skill-audit");
const baseUrl = process.env.GAME_URL || "http://127.0.0.1:4173";
const origin = new URL(baseUrl).origin;
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
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });

const errors = [];
const network = { decisionStubs: 0, externalRequests: [] };

async function openMatch(mapName, runnerSkin = "sam") {
  const page = await context.newPage();
  await page.addInitScript((skin) => {
    localStorage.clear();
    localStorage.setItem("jevil.musicEnabled", "false");
    localStorage.setItem("frontier.runnerSkin", skin);
    localStorage.setItem("frontier.chaserSkin", skin === "sam" ? "dario" : "sam");
  }, runnerSkin);
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
    network.externalRequests.push(requestUrl.href);
    await route.abort();
  });

  await page.goto(`${baseUrl}/?qa=1`, { waitUntil: "domcontentloaded" });
  await page.locator(`#level-thumbnails button[aria-label="Select ${mapName}"]`).click();
  await page.locator("#start-button").click();
  await page.waitForFunction(() => Boolean(window.__FRONTIER_QA__?.snapshot()?.running));
  await page.waitForFunction(() => window.__FRONTIER_QA__?.runnerSkillArtReady() === true);
  const decisionVisible = await page.locator("#decision-toggle").getAttribute("aria-pressed");
  if (decisionVisible === "true") await page.locator("#decision-toggle").click();
  return page;
}

async function verifyRunnerSkillCatalog(page, runnerSkin) {
  await page.locator("#settings-toggle").click();
  const catalog = await page.evaluate(() => ({
    names: [...document.querySelectorAll("#skill-catalog [data-skill-name]")].map((name) => name.textContent),
    ids: [...document.querySelectorAll("#skill-catalog .skill-icon[data-skill-id]")].map((icon) => icon.dataset.skillId),
    runnerEntries: [...document.querySelectorAll("#skill-catalog .skill-icon[data-owner='runner']")]
      .filter((icon) => ["stasis_cast", "mascot_charge"].includes(icon.dataset.skillId))
      .map((icon) => ({
        id: icon.dataset.skillId,
        name: icon.closest(".skill-card").querySelector("[data-skill-name]").textContent,
        key: icon.closest(".skill-card").querySelector(".skill-key").textContent,
        image: icon.style.backgroundImage,
        position: icon.style.backgroundPosition,
        size: icon.style.backgroundSize,
      })),
  }));
  assert.deepEqual(catalog.names.filter((name) => /inference\s+rush|redline\s+charge/i.test(name)), [],
    "retired Inference Rush and Redline Charge labels must not appear in the live skill manual");
  assert.equal(catalog.ids.some((id) => ["inference_rush", "redline_charge", "rift_rush"].includes(id)), false,
    "retired rush skills must not remain registered in the live skill manual");
  const entries = catalog.runnerEntries;
  const mascot = runnerSkin === "sam" ? "Codex" : "Claude";
  const names = new Map(entries.map(({ id, name }) => [id, name]));
  assert.equal(names.get("stasis_cast"), runnerSkin === "sam" ? "Codex Stasis Beam" : "Claude Stillpoint");
  assert.equal(names.get("mascot_charge"), `${mascot} Relay Charge`);
  for (const icon of entries) {
    assert.match(icon.image, /frontier-skill-icons-runner-pixel\.png/);
    assert.equal(icon.size, "200% 200%", "runner skills should use the dedicated, even 2x2 icon atlas");
    const expectedPosition = icon.id === "stasis_cast" ? "100% 0%"
      : runnerSkin === "sam" ? "0% 100%" : "100% 100%";
    assert.equal(icon.position, expectedPosition, `${icon.id} should use the correct lab icon cell`);
    assert.equal(icon.key, icon.id === "stasis_cast" ? "R" : "G");
  }
  await page.locator("#settings-resume").click();
}

function checkArt(fixture) {
  assert.equal(fixture.skillIcons.loaded, true, "runner skill icons should load");
  assert.equal(fixture.skillIcons.width % 2, 0, "runner skill icon grid should split into two equal columns");
  assert.equal(fixture.skillIcons.height % 2, 0, "runner skill icon grid should split into two equal rows");
  assert.ok(
    fixture.skillIcons.width / 2 === fixture.skillIcons.height / 2,
    "skill icons should use square cells so the settings UI does not stretch them",
  );
  const art = Object.values(fixture.skillArt);
  assert.equal(art.length, 14, "all character and company effect atlases should load");
  for (const atlas of art) {
    assert.equal(atlas.loaded, true, "each generated atlas should load");
    assert.equal(atlas.nonemptyFrames, 8, "each generated atlas should contain eight cut frames");
    const cellWidth = atlas.width / 4;
    const cellHeight = atlas.height / 2;
    if (Number.isInteger(cellWidth) && Number.isInteger(cellHeight)) {
      assert.equal(cellWidth, cellHeight, "animation atlas cells should be square and evenly divided");
    } else {
      assert.ok(atlas.width >= 1774 && atlas.height >= 887,
        "generated signal atlases should remain near the shared 4x2 pixel-art canvas size");
    }
    for (const frame of atlas.frameBounds) {
      assert.ok(frame.width > 40 && frame.height > 40, "every skill frame should contain visible art");
      assert.ok(frame.x >= 0 && frame.y >= 0, "frame crops should not begin outside their grid cell");
      assert.ok(frame.x + frame.width <= cellWidth + 1, "frame crop should not spill into the next column");
      assert.ok(frame.y + frame.height <= cellHeight + 1, "frame crop should not spill into the next row");
    }
  }
  for (const [samId, darioId] of [
    ["stasisCastSam", "stasisCastDario"],
    ["stasisReactionSam", "stasisReactionDario"],
    ["mascotReactionSam", "mascotReactionDario"],
  ]) {
    for (let frameIndex = 0; frameIndex < 8; frameIndex += 1) {
      const sam = fixture.skillArt[samId].frameBounds[frameIndex];
      const dario = fixture.skillArt[darioId].frameBounds[frameIndex];
      const scale = (frame) => Math.max(frame.width, frame.height);
      const ratio = Math.max(scale(sam), scale(dario)) / Math.min(scale(sam), scale(dario));
      assert.ok(ratio < 1.25, `${samId}/${darioId} frame ${frameIndex} should render at a matching character scale`);
    }
  }
}

function assertBrandedCallout(result, abilityId, company) {
  const callout = result.callouts.at(-1);
  assert.equal(callout?.abilityId, abilityId, `${abilityId} should show its on-screen skill callout`);
  assert.equal(callout?.owner, "runner", `${abilityId} callout should belong to the runner`);
  assert.match(callout.skillName, company === "OpenAI" ? /Codex|OpenAI/ : /Claude|Anthropic/);
}

try {
  await fs.mkdir(screenshotDirectory, { recursive: true });
  const scenarios = [];
  let mascotScreenshotSaved = false;
  let anthroScreenshotSaved = false;
  let stasisScreenshotSaved = false;
  let mascotHitScreenshotSaved = false;
  let anthroMascotHitScreenshotSaved = false;

  for (const [mapId, mapName] of arenas) {
    const page = await openMatch(mapName);
    for (const runnerSkin of ["sam", "dario"]) {
      const fixture = await page.evaluate((skin) => window.__FRONTIER_QA__.prepareRunnerSkillsFixture(skin), runnerSkin);
      assert.equal(fixture.map, mapId);
      checkArt(fixture);
      assert.ok(fixture.stasisLaneClear, `${mapId}/${runnerSkin} should have a clear Stasis Cast lane`);
      assert.ok(fixture.mascotLaneClear, `${mapId}/${runnerSkin} should have a clear Mascot Charge lane`);
      const company = runnerSkin === "sam" ? "OpenAI" : "Anthropic";
      const mascot = runnerSkin === "sam" ? "codex" : "claude";

      const channelStarted = await page.evaluate(() => window.__FRONTIER_QA__.useStasisCast());
      assert.equal(channelStarted, true, `${mapId}/${runnerSkin} Stasis Cast should start on a clear lane`);
      const channel = await page.evaluate(() => window.__FRONTIER_QA__.advanceStasisCast(0.18));
      assert.equal(channel.phase, "charging", "Stasis Cast should have an interruptible stationary wind-up");
      assert.ok(
        Math.hypot(channel.playerPosition.x - fixture.runner.x, channel.playerPosition.y - fixture.runner.y) < 0.01,
        "the charging runner should not drift",
      );
      const frozen = await page.evaluate(() => window.__FRONTIER_QA__.advanceStasisCast(1.35));
      assert.equal(frozen.chaserHealth, fixture.chaserHealth, "Stasis Cast should not deal health damage");
      assert.ok(
        frozen.stunned >= 1.5,
        `${mapId}/${runnerSkin} Stasis Cast should briefly stop the chaser; events: ${frozen.events.join(", ")}`,
      );
      assert.ok(frozen.frozenVisualSeconds >= 1.5, "the freeze feedback should remain visible for the full stop window");
      assert.ok(frozen.events.includes("freeze_hit"), "the cast should resolve as a freeze hit");
      assertBrandedCallout(frozen, "stasis_cast", company);
      if (!stasisScreenshotSaved && runnerSkin === "sam") {
        await page.screenshot({ path: path.join(screenshotDirectory, "runner-stasis.png") });
        stasisScreenshotSaved = true;
      }

      const interruptedFixture = await page.evaluate((skin) => window.__FRONTIER_QA__.prepareRunnerSkillsFixture(skin), runnerSkin);
      const interrupted = await page.evaluate(() => window.__FRONTIER_QA__.interruptStasisCast());
      assert.equal(interrupted.started, true);
      assert.equal(interrupted.interrupted, true, "damage should interrupt the channel");
      assert.equal(interrupted.healthLost, 1, "interruption should come from the incoming hit, not Stasis Cast");
      assert.ok(interrupted.events.includes("stasis_interrupted"));
      assert.equal(interruptedFixture.runnerSkin, runnerSkin);

      await page.evaluate((skin) => window.__FRONTIER_QA__.prepareRunnerSkillsFixture(skin), runnerSkin);
      const shielded = await page.evaluate(() => window.__FRONTIER_QA__.shieldStasisCast());
      assert.equal(shielded.started, true, "Stasis Cast should be legal into an active shield");
      assert.equal(shielded.chargesLeft, 1, "Rift Aegis should absorb one Stasis Cast");
      assert.equal(shielded.stunned, 0, "a shielded Stasis Cast must not stun through protection");
      assert.ok(shielded.events.includes("freeze_shield_blocked"));

      const mascotFixture = await page.evaluate((skin) => window.__FRONTIER_QA__.prepareRunnerSkillsFixture(skin), runnerSkin);
      assert.ok(mascotFixture.mascotHeading.x > 0, `${mapId}/${runnerSkin} default charge fixture should hit from the left`);
      const mascotStarted = await page.evaluate(() => window.__FRONTIER_QA__.useMascotCharge());
      assert.equal(mascotStarted, true, `${mapId}/${runnerSkin} Mascot Charge should launch`);
      const mascotInFlight = await page.evaluate(() => window.__FRONTIER_QA__.advanceMascotCharge(0.12));
      assert.equal(mascotInFlight.active, true, "the branded mascot should remain visible while traveling");
      assert.equal(mascotInFlight.mascot, mascot, "the runner must launch its own lab mascot");
      if (!mascotScreenshotSaved && runnerSkin === "sam") {
        await page.screenshot({ path: path.join(screenshotDirectory, "runner-skills.png") });
        mascotScreenshotSaved = true;
      }
      if (!anthroScreenshotSaved && runnerSkin === "dario") {
        await page.screenshot({ path: path.join(screenshotDirectory, "runner-skills-anthropic.png") });
        anthroScreenshotSaved = true;
      }
      const mascotResult = await page.evaluate(() => window.__FRONTIER_QA__.advanceMascotCharge(0.8));
      assert.equal(mascotFixture.mascot, mascot);
      assert.equal(mascotResult.chaserHealth, mascotFixture.chaserHealth, "Mascot Charge should shove without dealing damage");
      assert.ok(
        Math.hypot(mascotResult.chaserPosition.x - mascotFixture.chaser.x, mascotResult.chaserPosition.y - mascotFixture.chaser.y) > 1,
        "Mascot Charge should push the chaser off its line",
      );
      assert.ok(mascotResult.chaserSlow > 0, "Mascot Charge should briefly slow the chaser");
      assert.ok(mascotResult.chaserSlow >= 1.5, "the chaser should remain slowed long enough for viewers to notice");
      assert.ok(mascotResult.ramReactionTimer >= 0.8, "the shove reaction should remain visible after impact");
      assert.ok(mascotResult.ramKnockbackVx > 0, "a mascot charge travelling right should shove the chaser right");
      assert.equal(mascotResult.ramReactionFacing, "right", "the reaction sprite should face the incoming hit from the left");
      assert.ok(mascotResult.events.includes("mascot_charge_hit"));
      assertBrandedCallout(mascotResult, "mascot_charge", company);
      if (!mascotHitScreenshotSaved && runnerSkin === "sam") {
        await page.screenshot({ path: path.join(screenshotDirectory, "runner-mascot-charge-hit.png") });
        mascotHitScreenshotSaved = true;
      }
      if (!anthroMascotHitScreenshotSaved && runnerSkin === "dario") {
        await page.screenshot({ path: path.join(screenshotDirectory, "runner-mascot-charge-hit-anthropic.png") });
        anthroMascotHitScreenshotSaved = true;
      }

      const reverseFixture = await page.evaluate(
        (skin) => window.__FRONTIER_QA__.prepareRunnerSkillsFixture(skin, -1),
        runnerSkin,
      );
      assert.ok(reverseFixture.mascotHeading.x < 0, `${mapId}/${runnerSkin} reverse fixture should hit from the right`);
      assert.equal(await page.evaluate(() => window.__FRONTIER_QA__.useMascotCharge()), true);
      const reverseResult = await page.evaluate(() => window.__FRONTIER_QA__.advanceMascotCharge(0.8));
      assert.ok(reverseResult.ramKnockbackVx < 0, "a mascot charge travelling left should shove the chaser left");
      assert.equal(reverseResult.ramReactionFacing, "left", "the reaction sprite should face the incoming hit from the right");
      if (mapId === "crossing" && runnerSkin === "dario") {
        await page.screenshot({ path: path.join(screenshotDirectory, "sam-knockback-left.png") });
      }
      scenarios.push(`${mapId}/${runnerSkin}: Stasis hit, interruption, shield block, ${mascot} shove`);
    }
    await page.close();
  }

  for (const runnerSkin of ["sam", "dario"]) {
    const catalogPage = await openMatch(arenas[0][1], runnerSkin);
    await verifyRunnerSkillCatalog(catalogPage, runnerSkin);
    await catalogPage.close();
  }

  const blastPage = await openMatch(arenas[0][1]);
  for (const chaserSkin of ["sam", "dario"]) {
    const fixture = await blastPage.evaluate((skin) => window.__FRONTIER_QA__.preparePowerBlastFixture(skin), chaserSkin);
    assert.equal(fixture.blastLaneClear, true, `${chaserSkin} Power Blast should have a legal test lane`);
    const started = await blastPage.evaluate(() => window.__FRONTIER_QA__.startPowerBlast());
    assert.equal(started, undefined, "Power Blast start is validated by the wind-up state");
    const windup = await blastPage.evaluate(() => window.__FRONTIER_QA__.snapshot());
    assert.equal(windup.jev.blastPhase, "windup", "the restored blast should still have a readable wind-up");
    const result = await blastPage.evaluate(() => window.__FRONTIER_QA__.advancePowerBlast(0.9));
    assert.ok(result.events.includes("power_blast_fired"));
    assert.ok(result.events.includes("blast_hit"), "a stationary exposed target should be hit by the aimed blast");
    assert.equal(result.runnerHealth, 3, "Power Blast should retain its damaging role");
    assert.equal(result.callouts.at(-1)?.abilityId, "power_blast");
    assert.equal(result.callouts.at(-1)?.owner, "jev");
  }
  await blastPage.close();

  assert.ok(network.decisionStubs >= arenas.length, "the browser test should stub local decision requests");
  assert.deepEqual(network.externalRequests, [], "the tests must not contact external services");
  assert.deepEqual(errors, [], "the browser should not raise runtime errors");
  for (const filename of [
    "runner-skills.png", "runner-skills-anthropic.png", "runner-stasis.png",
    "runner-mascot-charge-hit.png", "runner-mascot-charge-hit-anthropic.png",
  ]) {
    const screenshot = await fs.stat(path.join(screenshotDirectory, filename));
    assert.ok(screenshot.size > 40_000, `${filename} should contain a full gameplay scene`);
  }
  console.log(JSON.stringify({
    result: "passed",
    arenas: arenas.map(([id]) => id),
    scenarios,
    chaserBlastSkins: ["sam", "dario"],
    generatedAtlases: 10,
    decisionApiStubs: network.decisionStubs,
    externalRequests: network.externalRequests.length,
    screenshots: [
      "runner-skills.png",
      "runner-skills-anthropic.png",
      "runner-stasis.png",
      "runner-mascot-charge-hit.png",
      "runner-mascot-charge-hit-anthropic.png",
    ].map((filename) => path.join(screenshotDirectory, filename)),
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
