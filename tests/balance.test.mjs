import test from "node:test";
import assert from "node:assert/strict";
import { Match } from "../src/combat/match.js";
import { createCpu } from "../src/combat/ai.js";
import { dario, sam } from "./helpers.mjs";

function play(a, b, seed, difficulty) {
  const m = new Match({
    seed,
    sides: [
      { team: [a], control: "cpu", cpu: createCpu(difficulty, seed * 3 + 1) },
      { team: [b], control: "cpu", cpu: createCpu(difficulty, seed * 7 + 5) },
    ],
  });
  m.start();
  let f = 0;
  while (m.phase !== "matchEnd" && f < 60 * 60 * 10) {
    m.step();
    f += 1;
  }
  return m.winner;
}

test("hard CPU Sam vs hard CPU Dario stays competitive (25-75% over 16 side-swapped matches)", () => {
  let samWins = 0;
  for (let i = 0; i < 16; i += 1) {
    const swap = i % 2 === 1;
    const w = play(swap ? dario : sam, swap ? sam : dario, 100 + i, "hard");
    if (w === (swap ? 1 : 0)) samWins += 1;
  }
  assert.ok(samWins >= 4 && samWins <= 12, `Sam won ${samWins}/16`);
});
