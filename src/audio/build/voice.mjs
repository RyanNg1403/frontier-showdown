// Announcer post-processing. Raw takes come from voice_takes.py (Piper TTS, verified by
// speech recognition); this pitches them down and adds EQ, saturation, slapback and hall.
import {
  resample, biquad, hp, drive, compress, delay, reverb, trimHead, trimTail, normalize, addInto, semis, fadeIn,
} from "./dsp.mjs";

export function processVoice(data, sr, { pitch = -2.5 } = {}) {
  // Resampling down lowers pitch and formants together, giving a larger-than-life voice.
  let x = fadeIn(trimHead(resample(data, semis(pitch)), sr, 0.01, 0.01), sr, 0.004);
  x = hp(x, sr, 75, 0.7);
  x = biquad(x, sr, "lowshelf", 160, 0.7, 5);
  x = biquad(x, sr, "peak", 2600, 0.9, 3.5);
  x = drive(normalize(x, 0.9), 1.6);
  x = compress(x, sr, { threshold: -16, ratio: 4, attack: 0.002, release: 0.1, makeup: 4 });
  const doubled = new Float32Array(x.length + Math.round(0.012 * sr));
  addInto(doubled, x, 0, 1);
  addInto(doubled, x, Math.round(0.012 * sr), 0.25);
  const slap = delay(doubled, sr, { time: 0.095, feedback: 0.15, wet: 0.16, tail: 0.3 });
  const hall = reverb(slap, sr, { damp: 0.55, wet: 0.22, tail: 1.2, predelay: 0.02, seed: 101 });
  return normalize(trimTail(hall, sr, 0.002), 0.92);
}
