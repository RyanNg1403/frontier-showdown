import test from "node:test";
import assert from "node:assert/strict";
import { Match } from "../src/combat/match.js";
import { createCpu } from "../src/combat/ai.js";
import { discoverCharacters, loadCharacter } from "../src/characters/index.js";

/**
 * CPU-vs-CPU round-robin of the whole roster, two side-swapped matches per pair with fixed
 * seeds. The design target is 35-65 % per fighter (see the PR's 12-per-pair table); with only
 * 30 matches per fighter the sampling noise is about +-9 %, so the guard band is 20-80 %.
 */
const PER_PAIR = 2;
const BAND = [0.2, 0.8];

async function roster() {
  const { ids } = await discoverCharacters();
  return Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await loadCharacter(id)])));
}

function roundRobin(defs, difficulty) {
  const ids = Object.keys(defs);
  const wins = Object.fromEntries(ids.map((id) => [id, 0]));
  const games = Object.fromEntries(ids.map((id) => [id, 0]));
  let timeouts = 0;
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      for (let k = 0; k < PER_PAIR; k += 1) {
        const [l, r] = k % 2 ? [ids[j], ids[i]] : [ids[i], ids[j]];
        const seed = 1000 + i * 97 + j * 13 + k;
        const m = new Match({
          seed,
          sides: [
            { team: [defs[l]], control: "cpu", cpu: createCpu(difficulty, seed * 3 + 1) },
            { team: [defs[r]], control: "cpu", cpu: createCpu(difficulty, seed * 7 + 5) },
          ],
        });
        m.start();
        let f = 0;
        while (m.phase !== "matchEnd" && f < 60 * 60 * 10) {
          m.step();
          f += 1;
        }
        if (m.phase !== "matchEnd") timeouts += 1;
        games[l] += 1;
        games[r] += 1;
        if (m.winner !== null) wins[m.winner === 0 ? l : r] += 1;
      }
    }
  }
  return { rates: Object.fromEntries(ids.map((id) => [id, wins[id] / games[id]])), timeouts };
}

const defs = await roster();

for (const difficulty of ["hard", "normal"]) {
  test(`${difficulty} CPU round-robin: all ${Object.keys(defs).length} fighters win 20-80 %`, () => {
    assert.equal(Object.keys(defs).length, 16, "the full roster is discovered");
    const { rates, timeouts } = roundRobin(defs, difficulty);
    assert.equal(timeouts, 0, "every match finishes");
    const outside = Object.entries(rates)
      .filter(([, r]) => r < BAND[0] || r > BAND[1])
      .map(([id, r]) => `${id} ${Math.round(r * 100)}%`);
    assert.deepEqual(outside, [], `outside ${BAND[0] * 100}-${BAND[1] * 100} %: ${outside.join(", ")}`);
  });
}
