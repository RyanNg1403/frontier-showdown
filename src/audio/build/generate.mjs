#!/usr/bin/env node
// Regenerates every file under assets/audio/ from code.
//
//   node src/audio/build/generate.mjs                # sfx + music (+ voice when VOICE_TAKES is set)
//   node src/audio/build/generate.mjs sfx music      # subsets: sfx | music | voice
//   python3 src/audio/build/voice_takes.py --model en_US-john-medium.onnx --out /tmp/voice-takes
//   VOICE_TAKES=/tmp/voice-takes node src/audio/build/generate.mjs voice
//   node src/audio/build/generate.mjs --list-voice   # JSON line list consumed by voice_takes.py
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join, relative } from "node:path";
import { SOUNDS, VOICE, MUSIC, soundFiles } from "../catalog.js";
import { readWav, writeWav } from "./dsp.mjs";
import { renderSfx } from "./sfx.mjs";
import { renderFight, renderSelect, renderVictory } from "./music.mjs";
import { processVoice } from "./voice.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = join(root, "assets/audio");
const SFX_RATE = 32000;
const MUSIC_RATE = 32000;

const args = process.argv.slice(2);
if (args.includes("--list-voice")) {
  const lines = Object.entries(VOICE).map(([id, e]) => ({ id, file: soundFiles(e)[0], text: e.text, say: e.say }));
  process.stdout.write(JSON.stringify(lines));
  process.exit(0);
}
const want = (part) => args.length === 0 || args.includes(part);
const log = (path, seconds) => console.log(`${relative(root, path).padEnd(44)} ${seconds.toFixed(2)}s`);

if (want("sfx")) {
  for (const [id, entry] of Object.entries(SOUNDS)) {
    soundFiles(entry).forEach((file, i) => {
      const data = renderSfx(id, i, SFX_RATE);
      const path = join(out, file);
      writeWav(path, data, SFX_RATE);
      log(path, data.length / SFX_RATE);
    });
  }
}

if (want("music")) {
  const renderers = { select: renderSelect, fight: renderFight, victory: renderVictory };
  for (const [id, render] of Object.entries(renderers)) {
    const data = render(MUSIC_RATE);
    const path = join(out, MUSIC[id].file);
    writeWav(path, data, MUSIC_RATE);
    log(path, data.length / MUSIC_RATE);
  }
}

if (want("voice")) {
  const takes = process.env.VOICE_TAKES;
  if (!takes || !existsSync(takes)) {
    console.warn("Skipping voice: run voice_takes.py first and set VOICE_TAKES to its --out directory.");
  } else {
    for (const entry of Object.values(VOICE)) {
      const file = soundFiles(entry)[0];
      const raw = join(takes, basename(file));
      if (!existsSync(raw)) { console.warn(`missing take ${raw}`); continue; }
      const { sr, data } = readWav(raw);
      const processed = processVoice(data, sr);
      const path = join(out, file);
      writeWav(path, processed, sr);
      log(path, processed.length / sr);
    }
  }
}
