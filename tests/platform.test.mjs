import test from "node:test";
import assert from "node:assert/strict";
import { applyPlacements, packAtlas, uniqueRects } from "../src/engine/atlas-pack.js";
import { guessTier, createQuality } from "../src/platform/quality.js";
import { createStorage, local } from "../src/platform/storage.js";
import { createProgress } from "../src/platform/progress.js";
import { createEmitter } from "../src/engine/emitter.js";

/** Minimal RGBA canvas: unscaled drawImage, getImageData and clearRect are all packAtlas uses. */
class FakeCanvas {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
  getContext() {
    const c = this;
    return {
      clearRect(x, y, w, h) {
        for (let j = y; j < y + h; j += 1) c.data.fill(0, (j * c.width + x) * 4, (j * c.width + x + w) * 4);
      },
      drawImage(src, sx, sy, sw, sh, dx, dy) {
        for (let j = 0; j < sh; j += 1) {
          for (let i = 0; i < sw; i += 1) {
            const s = ((sy + j) * src.width + sx + i) * 4;
            const d = ((dy + j) * c.width + dx + i) * 4;
            if (dx + i < 0 || dy + j < 0 || dx + i >= c.width || dy + j >= c.height) continue;
            c.data.set(src.data.subarray(s, s + 4), d);
          }
        }
      },
      getImageData(x, y, w, h) {
        const out = new Uint8ClampedArray(w * h * 4);
        for (let j = 0; j < h; j += 1) out.set(c.data.subarray(((y + j) * c.width + x) * 4, ((y + j) * c.width + x + w) * 4), j * w * 4);
        return { data: out, width: w, height: h };
      },
    };
  }
  pixel(x, y) {
    const i = (y * this.width + x) * 4;
    return Array.from(this.data.subarray(i, i + 4)).join(",");
  }
}

function syntheticAtlas() {
  const cell = 32;
  const src = new FakeCanvas(cell * 4, cell * 2);
  const paint = (cx, cy, x, y, w, h, seed) => {
    for (let j = 0; j < h; j += 1) {
      for (let i = 0; i < w; i += 1) {
        const k = ((cy * cell + y + j) * src.width + cx * cell + x + i) * 4;
        src.data.set([(seed * 40 + i) & 255, (j * 9) & 255, seed * 17, 255], k);
      }
    }
  };
  paint(0, 0, 4, 6, 10, 20, 1);
  paint(1, 0, 8, 2, 16, 24, 2);
  paint(2, 0, 4, 6, 10, 20, 1); // duplicate of cell (0,0)
  paint(0, 1, 0, 0, 32, 32, 3); // full cell
  const frame = (cx, cy) => ({ x: cx * cell, y: cy * cell, w: cell, h: cell });
  const json = {
    animations: {
      idle: { frames: [frame(0, 0), frame(1, 0), frame(0, 0)] },
      walk: { frames: [frame(2, 0), frame(3, 0), frame(0, 1)] }, // (3,0) is empty
    },
  };
  return { src, json };
}

test("packAtlas trims, de-duplicates and keeps every frame pixel-identical", async () => {
  const { src, json } = syntheticAtlas();
  assert.equal(uniqueRects(json).length, 5);
  const { pages, placements, stats } = await packAtlas(src, json, (w, h) => new FakeCanvas(w, h));
  assert.equal(stats.unique, 3, "duplicate frame stored once, empty frame dropped");
  assert.ok(stats.packedBytes < stats.sourceBytes);
  const p = Object.fromEntries(placements);
  assert.deepEqual(p["96,0,32,32"], { empty: true });
  assert.deepEqual(p["64,0,32,32"], { ...p["0,0,32,32"] }, "duplicates share a placement");
  // No two unique placements overlap.
  const boxes = [...new Map(Object.values(p).filter((v) => !v.empty).map((v) => [`${v.page}:${v.x},${v.y}`, v])).values()];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const overlap = a.page === b.page && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!overlap, "placements overlap");
    }
  }
  // Every opaque source pixel appears at its placement.
  applyPlacements(json, p, pages);
  for (const anim of Object.values(json.animations)) {
    for (const f of anim.frames) {
      if (f.draw.empty) continue;
      for (let y = 0; y < f.h; y += 1) {
        for (let x = 0; x < f.w; x += 1) {
          const want = src.pixel(f.x + x, f.y + y);
          const inside = x >= f.draw.dx && y >= f.draw.dy && x < f.draw.dx + f.draw.w && y < f.draw.dy + f.draw.h;
          if (!inside) {
            assert.equal(want.endsWith(",0"), true, "pixel outside the trimmed box must be transparent");
            continue;
          }
          assert.equal(f.draw.img.pixel(f.draw.x + x - f.draw.dx, f.draw.y + y - f.draw.dy), want);
        }
      }
    }
  }
});

test("quality tier guesses from device hints and only steps down on slow frames", () => {
  assert.equal(guessTier({ deviceMemory: 8, hardwareConcurrency: 8 }, { matchMedia: () => ({ matches: false }) }), "high");
  assert.equal(guessTier({ deviceMemory: 4, hardwareConcurrency: 8 }, { matchMedia: () => ({ matches: false }) }), "medium");
  assert.equal(guessTier({ deviceMemory: 8, hardwareConcurrency: 8 }, { matchMedia: () => ({ matches: true }) }), "medium");
  assert.equal(guessTier({ deviceMemory: 2, hardwareConcurrency: 8, connection: { saveData: false } }), "low");
  assert.equal(guessTier({ deviceMemory: 8, hardwareConcurrency: 8, connection: { saveData: true } }), "low");
  const q = createQuality({ forced: null });
  q.set("high");
  for (let i = 0; i < 300; i += 1) q.sample(16.7);
  assert.equal(q.tier.id, "high");
  for (let i = 0; i < 90; i += 1) q.sample(40);
  assert.equal(q.tier.id, "medium");
  assert.equal(q.scaleFor(732, 1280, 2.6), (732 * 1.5) / 1280);
});

test("storage falls back to memory when IndexedDB and localStorage are unavailable", async () => {
  const storage = createStorage();
  assert.equal(await storage.set("stats", { a: 1 }), false);
  assert.deepEqual(await storage.get("stats"), { a: 1 });
  await storage.addMatch({ at: 1 });
  await storage.addMatch({ at: 2 });
  assert.deepEqual((await storage.listMatches(5)).map((m) => m.at), [2, 1]);
  await storage.remove("stats");
  assert.equal(await storage.get("stats"), null);
  assert.equal((await storage.status()).backend, "memory");
  local.remove("session.v1");
});

test("progress saves a resume checkpoint at round boundaries and clears it on quit", async () => {
  const events = createEmitter();
  const roster = [{ id: "sam", shortName: "Sam" }, { id: "dario", shortName: "Dario" }];
  const config = { mode: "1v1", stage: "openai-mission-bay", sides: [{ team: ["sam"], control: "human", difficulty: "normal", player: 0 }, { team: ["dario"], control: "cpu", difficulty: "hard", player: 1 }] };
  let started = null;
  const game = {
    events,
    lastConfig: config,
    match: { sides: [{ meter: 140, lastCheckpointUsed: false }, { meter: 60, lastCheckpointUsed: true }] },
    listCharacters: () => roster,
    listStages: () => [{ id: "openai-mission-bay" }],
    startMatch: async (c) => { started = c; },
  };
  const storage = createStorage();
  const progress = createProgress(game, storage);
  events.emit("matchStart", {});
  assert.equal(progress.session().stage, "openai-mission-bay");
  events.emit("roundEnd", { round: 1, winner: 0, wins: [1, 0], matchOver: false });
  await new Promise((r) => setTimeout(r, 0));
  const cp = await progress.pendingResume();
  assert.equal(cp.round, 2);
  assert.deepEqual(cp.sides, [{ wins: 1, meter: 140, lastCheckpointUsed: false }, { wins: 0, meter: 60, lastCheckpointUsed: true }]);
  assert.match(progress.describe(cp), /Round 2 · 1–0/);
  await progress.resume(cp);
  assert.deepEqual(started.resume, { round: 2, sides: cp.sides });
  const stats = await progress.stats();
  assert.equal(stats.fighters.sam.roundsWon, 1);
  assert.equal(stats.fighters.dario.roundsLost, 1);
  events.emit("menu", {});
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(await progress.pendingResume(), null);
  const ui = { session: { mode: "2v2", matchup: "local", sides: [] } };
  progress.restoreMenus(ui);
  assert.equal(ui.session.mode, "1v1");
  assert.equal(ui.session.matchup, "cpu");
  assert.deepEqual(ui.session.lastPicks, { "1v1": [["sam"], ["dario"]] });
  await storage.clear();
});
