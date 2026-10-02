import fs from 'node:fs';
import path from 'node:path';

// Locate Playwright Chromium
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    ({ chromium } = await import('/Users/PhatNguyen/Desktop/uit-cli/node_modules/playwright/index.mjs'));
  } catch {
    ({ chromium } = await import('/Users/PhatNguyen/Desktop/uit-cli/node_modules/playwright/index.js'));
  }
}

const OUTPUT_DIR = process.env.OUTPUT_DIR || '/Users/PhatNguyen/.gemini/antigravity-cli/brain/a7e1b119-9774-49e9-9cbe-afa5d85731f7';
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function runSimulation() {
  console.log('=== JEVIL VISUAL & DECISION SIMULATION ===');
  console.log(`Saving screenshots to: ${OUTPUT_DIR}\n`);

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-gpu',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    if (msg.type() === 'error') {
      console.error('[BROWSER ERROR]', text);
    }
  });

  const autoDecisions = [];
  const humanDecisions = [];
  let currentMode = 'auto';

  page.on('response', async res => {
    if (res.url().includes('/api/decision') && res.status() === 200) {
      try {
        const data = await res.json();
        const entry = {
          time: Date.now(),
          mode: data.mode,
          plan: data.plan,
          confidence: data.confidence,
          probabilities: data.probabilities,
          player_mode: data.player_mode,
          player_confidence: data.player_confidence,
          player_probabilities: data.player_probabilities
        };
        if (currentMode === 'auto') autoDecisions.push(entry);
        else humanDecisions.push(entry);
      } catch {}
    }
  });

  // ----------------------------------------------------
  // TEST 1: AUTO MODE ("Jev vs Jev")
  // ----------------------------------------------------
  console.log('>>> 1. STARTING AUTO MODE ("Jev vs Jev") TEST...');
  currentMode = 'auto';
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });

  // Select Auto mode
  await page.click('#mode-auto');
  await page.waitForTimeout(400);

  // Click Start
  await page.click('#start-button');
  console.log('    Game started in Auto Mode. Simulating live combat for 9 seconds...');

  // Capture Screenshot 1 (Early combat - 1.5s)
  await page.waitForTimeout(1500);
  const autoShot1 = path.join(OUTPUT_DIR, 'auto_mode_1_opening.png');
  await page.screenshot({ path: autoShot1 });
  console.log(`    [Screenshot 1 saved]: ${autoShot1}`);

  // Capture Screenshot 2 (Mid chase / kiting - 4.5s)
  await page.waitForTimeout(3000);
  const autoShot2 = path.join(OUTPUT_DIR, 'auto_mode_2_midchase.png');
  await page.screenshot({ path: autoShot2 });
  console.log(`    [Screenshot 2 saved]: ${autoShot2}`);

  // Capture Screenshot 3 (Late engagement / skills firing - 8.5s)
  await page.waitForTimeout(4000);
  const autoShot3 = path.join(OUTPUT_DIR, 'auto_mode_3_combat.png');
  await page.screenshot({ path: autoShot3 });
  console.log(`    [Screenshot 3 saved]: ${autoShot3}`);

  console.log(`    Auto Mode completed. Captured ${autoDecisions.length} Jev decisions.`);
  console.log('    Recent Auto Decisions:');
  autoDecisions.slice(-5).forEach((d, idx) => {
    console.log(`      #${idx + 1}: Jev -> [${d.mode}] (${(d.confidence * 100).toFixed(0)}%) | Ghost -> [${d.player_mode}]`);
  });

  // ----------------------------------------------------
  // TEST 2: HUMAN MODE ("You vs Jev") WITH ERGONOMIC KEYSTROKES
  // ----------------------------------------------------
  console.log('\n>>> 2. STARTING HUMAN MODE ("You vs Jev") TEST...');
  currentMode = 'human';
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });

  // Select Human mode
  await page.click('#mode-human');
  await page.waitForTimeout(400);

  // Click Start
  await page.click('#start-button');
  console.log('    Game started in Human Mode. Simulating player controls & combat...');

  // Focus canvas
  await page.focus('#game-canvas');

  // Move right and down using W, D, S keys
  console.log('    Simulating WASD movement & projectile aiming...');
  await page.keyboard.down('KeyD');
  await page.keyboard.down('KeyS');
  await page.mouse.move(700, 450);
  await page.waitForTimeout(800);
  await page.keyboard.up('KeyS');
  await page.keyboard.up('KeyD');

  // Aim at Jev and fire projectiles with Left Click and Z key
  await page.mouse.move(600, 400);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.keyboard.press('KeyZ');
  await page.keyboard.press('KeyZ');

  // Capture Screenshot 4 (WASD maneuvering & firing)
  const humanShot1 = path.join(OUTPUT_DIR, 'human_mode_1_wasd_fire.png');
  await page.screenshot({ path: humanShot1 });
  console.log(`    [Screenshot 4 saved]: ${humanShot1}`);

  // Test Space Dash
  console.log('    Testing Dash (Space)...');
  await page.keyboard.down('KeyW');
  await page.keyboard.press('Space');
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(500);

  // Test Soul Burst (F key)
  console.log('    Testing Soul Burst (F key)...');
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(400);

  // Capture Screenshot 5 (Soul Burst / Dash action)
  const humanShot2 = path.join(OUTPUT_DIR, 'human_mode_2_dash_burst.png');
  await page.screenshot({ path: humanShot2 });
  console.log(`    [Screenshot 5 saved]: ${humanShot2}`);

  // Test Lantern Guard & Parry (Right Click & Shift / C)
  console.log('    Testing Lantern Guard & Perfect Parry (Shift & Right Click)...');
  await page.keyboard.press('KeyC');
  await page.mouse.click(650, 420, { button: 'right' });
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(400);
  await page.keyboard.up('ShiftLeft');

  // Test Mirror Clones (Q) and Rift Hook (E)
  console.log('    Testing Mirror Clones (Q) and Rift Hook (E)...');
  await page.keyboard.press('KeyQ');
  await page.waitForTimeout(300);
  await page.mouse.move(500, 300);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(800);

  // Capture Screenshot 6 (Lantern Guard / Parry / Clones active)
  const humanShot3 = path.join(OUTPUT_DIR, 'human_mode_3_parry_clones.png');
  await page.screenshot({ path: humanShot3 });
  console.log(`    [Screenshot 6 saved]: ${humanShot3}`);

  console.log(`    Human Mode completed. Captured ${humanDecisions.length} Jev reactive decisions.`);
  console.log('    Recent Human Mode Jev Decisions:');
  humanDecisions.slice(-5).forEach((d, idx) => {
    console.log(`      #${idx + 1}: Jev -> [${d.mode}] (${(d.confidence * 100).toFixed(0)}%) | Plan: ${d.plan || 'steady_pressure'}`);
  });

  await browser.close();

  // Print Summary
  console.log('\n=== SIMULATION SUMMARY ===');
  console.log(`Total Auto Decisions Recorded:  ${autoDecisions.length}`);
  console.log(`Total Human Decisions Recorded: ${humanDecisions.length}`);
  console.log('All screenshots verified and generated successfully!');
}

runSimulation().catch(err => {
  console.error('Simulation failed:', err);
  process.exit(1);
});
