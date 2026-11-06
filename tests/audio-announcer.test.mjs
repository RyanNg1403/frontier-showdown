import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bindGameEvents } from "../src/audio/events.js";
import { VOICE, labId, soundFiles } from "../src/audio/catalog.js";
import { ROSTER_ORDER, loadCharacter } from "../src/characters/index.js";
import { dario, hold, makeMatch, sam, until } from "./helpers.mjs";

const audioDir = fileURLToPath(new URL("../assets/audio/", import.meta.url));
const tick = () => new Promise((r) => setTimeout(r, 5));

function recordingAudio() {
  const calls = [];
  return {
    calls,
    koCalls: () => calls.filter((c) => c[0] === "announce" && /ko/.test(c[1])).map((c) => c[1]),
    played: () => calls.filter((c) => c[0] === "play").map((c) => c[1]),
    announce: (id) => calls.push(["announce", id]),
    announceWinner: (lab) => calls.push(["winner", lab]),
    play: (id) => calls.push(["play", id]),
    music() {},
    setSlowMotion() {},
    setPaused() {},
    currentMusic: "fight",
  };
}

// A real 2v2 match whose engine events feed bindGameEvents, as in the game.
function wiredMatch() {
  const handlers = {};
  const emitter = { on: (n, fn) => { (handlers[n] ??= []).push(fn); return () => {}; } };
  const audio = recordingAudio();
  bindGameEvents(audio, emitter, { winnerDelay: 0 });
  const log = [];
  log.push = (e) => { Array.prototype.push.call(log, e); for (const fn of handlers[e.name] || []) fn(e.payload); return log.length; };
  const m = makeMatch({ mode: "2v2", p1: [sam, dario], p2: [dario, sam], events: log });
  return { m, audio, log };
}

test("every roster lab has a recorded winner line", async () => {
  for (const c of await Promise.all(ROSTER_ORDER.map(loadCharacter))) {
    const id = labId(c.labId);
    assert.ok(id && VOICE[`ann.wins.${id}`], `${c.id} (${c.labId}) resolves to a recorded line`);
    for (const file of soundFiles(VOICE[`ann.wins.${id}`])) assert.ok(existsSync(audioDir + file), `${file} exists`);
  }
});

test("2v2: a point fighter falling mid-round gets the tag sting, not K.O.; the round-ending KO says it once", async () => {
  const { m, audio, log } = wiredMatch();
  m.point(1).health = 0;
  hold(m, 1);
  await tick();
  assert.ok(log.some((e) => e.name === "ko") && log.some((e) => e.name === "lastStanding"), "engine KOs the point fighter mid-round");
  assert.deepEqual(audio.koCalls(), [], "no K.O. call mid-round");
  assert.ok(!audio.played().includes("ko.impact"));

  until(m, () => log.some((e) => e.name === "tag" && e.payload.forced), 200);
  await tick();
  assert.ok(audio.played().includes("stinger.tag"), "partner's forced entry plays the tag sting");

  until(m, () => m.point(1).isNeutral, 120);
  m.point(1).health = 0;
  hold(m, 1);
  await tick();
  assert.deepEqual(audio.koCalls(), ["ann.ko"], "K.O. once, when the round ends");
  assert.ok(audio.played().includes("ko.impact"));
});

test("a double KO is announced once", async () => {
  const { m, audio } = wiredMatch();
  for (const s of [0, 1]) for (const f of m.sides[s].members) f.health = 0;
  hold(m, 1);
  await tick();
  assert.deepEqual(audio.koCalls(), ["ann.doubleko"]);
});
