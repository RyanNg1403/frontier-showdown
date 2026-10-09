// Records deterministic 1080p/30fps gameplay frames from the running game (npm start) by driving rAF/performance.now manually.
// Usage: node scripts/record-gameplay.mjs <outDir> <frames> [levelIndex]  (needs: npm i playwright-core; encode with ffmpeg)
import {chromium} from 'playwright-core';
import fs from 'node:fs';
const [,, outDir, frames, level='0'] = process.argv;
const N = Number(frames);
fs.mkdirSync(outDir, {recursive: true});
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-gpu','--disable-gpu-compositing']});
const p = await (await b.newContext({viewport:{width:1920,height:1080}, deviceScaleFactor:1})).newPage();
p.on('pageerror', e=>console.log('ERR', e.message));
await p.addInitScript(() => {
  window.__t = 1000; window.__raf = [];
  performance.now = () => window.__t;
  window.requestAnimationFrame = (cb) => { window.__raf.push(cb); return window.__raf.length; };
  window.cancelAnimationFrame = () => {};
  window.__tick = (ms) => { window.__t += ms; const q = window.__raf; window.__raf = []; q.forEach((cb) => { try { cb(window.__t); } catch (e) { console.error(e); } }); };
});
await p.goto('http://127.0.0.1:4173/');
await p.waitForTimeout(1000);
for (let i = 0; i < Number(level); i++) { await p.click('#level-next'); await p.waitForTimeout(150); }
await p.evaluate(() => { window.__tick(16.667); });
await p.click('#start-button');
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  await p.evaluate(() => { window.__tick(16.667); window.__tick(16.667); });
  await p.waitForTimeout(12);
  await p.screenshot({path: `${outDir}/f${String(i).padStart(5,'0')}.jpg`, type:'jpeg', quality:92});
  if (i % 60 === 0) {
    const timer = await p.evaluate(()=>document.getElementById('timer')?.textContent);
    const res = await p.evaluate(()=>!document.getElementById('result-overlay')?.hidden);
    console.log(`frame ${i} timer ${timer} result:${res} elapsed ${((Date.now()-t0)/1000).toFixed(0)}s`);
  }
}
await b.close();
