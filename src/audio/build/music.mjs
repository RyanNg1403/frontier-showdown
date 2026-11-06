// Procedural music loops. Every note tail and the reverb send wrap past the loop end
// back onto the start, so the rendered buffer loops without a seam.
import {
  rng, buf, osc, noise, lp, hp, bp, biquad, env, drive, addInto, normalize, reverb, compress,
  expDecay, adsr, midiHz, mix, fadeOut,
} from "./dsp.mjs";

// ---- instruments ------------------------------------------------------------

const kick = (sr, r) => {
  const tone = env(osc(sr, 0.45, "sine", (t) => 45 + 110 * Math.exp(-t / 0.03)), sr, expDecay(0.14, 0.001));
  const tick = env(hp(noise(sr, 0.01, r), sr, 3000), sr, expDecay(0.002));
  return drive(mix(sr, [{ buf: tone, gain: 1 }, { buf: tick, gain: 0.3 }]), 1.8);
};

const snare = (sr, r) => {
  const body = env(osc(sr, 0.2, "tri", (t) => 160 + 60 * Math.exp(-t / 0.02)), sr, expDecay(0.05));
  const rattle = env(bp(noise(sr, 0.3, r), sr, 2200, 0.7), sr, expDecay(0.08, 0.001));
  const air = env(hp(noise(sr, 0.3, r), sr, 6000), sr, expDecay(0.1));
  return mix(sr, [{ buf: body, gain: 0.7 }, { buf: rattle, gain: 0.8 }, { buf: air, gain: 0.3 }]);
};

const hat = (sr, r, open = false) => env(hp(noise(sr, open ? 0.35 : 0.08, r), sr, 7500), sr, expDecay(open ? 0.09 : 0.016, 0.0005));

const taiko = (sr, r, pitch = 1) => {
  const tone = env(osc(sr, 0.8, "sine", (t) => pitch * (62 + 40 * Math.exp(-t / 0.04))), sr, expDecay(0.28, 0.002));
  const skin = env(lp(noise(sr, 0.2, r), sr, 700), sr, expDecay(0.04));
  return drive(mix(sr, [{ buf: tone, gain: 1 }, { buf: skin, gain: 0.6 }]), 1.5);
};

const rim = (sr, r) => env(bp(noise(sr, 0.05, r), sr, 1800, 5), sr, expDecay(0.01));

function bass(sr, note, dur, { cutoff = 1300, q = 4 } = {}) {
  const f = midiHz(note);
  const s = mix(sr, [{ buf: osc(sr, dur + 0.05, "saw", f), gain: 0.6 }, { buf: osc(sr, dur + 0.05, "square", f / 2), gain: 0.4 }]);
  const filtered = biquad(s, sr, "lowpass", (t) => 140 + cutoff * Math.exp(-t / 0.09), q);
  return drive(env(filtered, sr, adsr(0.003, 0.08, 0.7, 0.04, dur)), 1.6);
}

function subBass(sr, note, dur) {
  return env(osc(sr, dur + 0.2, "sine", midiHz(note)), sr, adsr(0.02, 0.2, 0.8, 0.2, dur));
}

function lead(sr, note, dur, r) {
  const f = midiHz(note);
  const vib = (t) => f * (1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t / 0.15));
  const s = mix(sr, [
    { buf: osc(sr, dur + 0.2, "saw", (t) => vib(t) * 1.004, { phase: r() }), gain: 0.5 },
    { buf: osc(sr, dur + 0.2, "saw", (t) => vib(t) * 0.996, { phase: r() }), gain: 0.5 },
    { buf: osc(sr, dur + 0.2, "square", (t) => vib(t) / 2), gain: 0.25 },
  ]);
  return env(lp(s, sr, 2600, 1.1), sr, adsr(0.01, 0.1, 0.75, 0.15, dur));
}

function pluck(sr, note, wave = "square", tau = 0.12, cutoff = 3500) {
  const s = osc(sr, tau * 6, wave, midiHz(note));
  return env(biquad(s, sr, "lowpass", (t) => 300 + cutoff * Math.exp(-t / (tau * 0.7)), 2), sr, expDecay(tau, 0.002));
}

function bell(sr, note, r) {
  const f = midiHz(note), out = buf(sr, 2);
  [[1, 1], [2.01, 0.5], [3.98, 0.25], [5.4, 0.12]].forEach(([ratio, g], i) => {
    addInto(out, env(osc(sr, 2, "sine", f * ratio, { phase: r() }), sr, expDecay(0.9 / (1 + i), 0.002)), 0, g);
  });
  return out;
}

function pad(sr, notes, dur, r, cutoff = 1200) {
  const out = buf(sr, dur + 0.6);
  for (const n of notes) for (const d of [-0.1, 0, 0.1]) addInto(out, osc(sr, dur + 0.6, "saw", midiHz(n + d), { phase: r() }), 0, 0.33 / notes.length);
  return env(lp(out, sr, cutoff, 0.8), sr, adsr(0.35, 0.3, 0.8, 0.5, dur));
}

function stab(sr, notes, r, tau = 0.25) {
  const out = buf(sr, 1);
  for (const n of notes) for (const d of [-0.08, 0.08]) addInto(out, osc(sr, 1, "saw", midiHz(n + d), { phase: r() }), 0, 1 / notes.length);
  return drive(env(biquad(out, sr, "lowpass", (t) => 500 + 3500 * Math.exp(-t / 0.08), 1.5), sr, expDecay(tau, 0.003)), 1.5);
}

function riser(sr, r, dur) {
  return env(biquad(noise(sr, dur, r), sr, "bandpass", (t) => 500 + 7000 * (t / dur) ** 2, 1.2), sr, (t) => (t / dur) ** 2.2);
}

// ---- sequencing ---------------------------------------------------------------

function createSong(sr, bpm, bars, seed) {
  const step = 60 / bpm / 4;
  const length = Math.round(bars * 16 * step * sr);
  const r = rng(seed);
  const dry = new Float32Array(length);
  const send = new Float32Array(length);
  const at = (bar, s) => Math.round((bar * 16 + s) * step * sr);
  return {
    sr, step, length, r, dry, send,
    add(b, bar, s, g = 1, wet = 0) {
      const o = at(bar, s);
      addInto(dry, b, o, g, true);
      if (wet) addInto(send, b, o, g * wet, true);
    },
    render({ reverbWet = 0.35, level = 0.85 } = {}) {
      const tail = reverb(send, sr, { wet: 1, dry: 0, tail: 2.5, seed: seed + 1 });
      const out = dry.slice();
      addInto(out, tail, 0, reverbWet * 3, true);
      return normalize(compress(out, sr, { threshold: -14, ratio: 3, attack: 0.005, release: 0.12, makeup: 2 }), level);
    },
  };
}

const triad = (root, quality) => (quality === "maj" ? [root, root + 4, root + 7] : quality === "dim" ? [root, root + 3, root + 6] : [root, root + 3, root + 7]);

export function renderFight(sr) {
  const song = createSong(sr, 140, 16, 1403);
  const { r } = song;
  const k = kick(sr, r), sn = snare(sr, r), hc = hat(sr, r), ho = hat(sr, r, true);
  const tk = taiko(sr, r), tkHi = taiko(sr, r, 1.4);
  // E Phrygian: roots and chord qualities per bar.
  const prog = [[40, "min"], [40, "min"], [41, "maj"], [40, "min"], [36, "maj"], [38, "min"], [40, "min"], [40, "min"]];
  const riffA = [[0, 76, 3], [3, 74, 1], [4, 72, 2], [6, 71, 2], [8, 72, 2], [10, 71, 1], [11, 69, 1], [12, 67, 2], [14, 65, 2]];
  const riffB = [[0, 64, 4], [4, 67, 2], [6, 69, 2], [8, 71, 3], [11, 72, 1], [12, 71, 2], [14, 69, 1], [15, 67, 1]];
  const bassSteps = [0, 2, 3, 6, 7, 8, 10, 11, 14, 15];

  for (let bar = 0; bar < 16; bar++) {
    const [root, quality] = prog[bar % 8];
    const chord = triad(root + 12, quality);
    for (let s = 0; s < 16; s += 4) song.add(k, bar, s, 1);
    if (bar % 4 === 3) song.add(k, bar, 14, 0.7);
    song.add(sn, bar, 4, 0.75, 0.25);
    song.add(sn, bar, 12, 0.75, 0.25);
    if (bar % 8 === 7) for (const s of [13, 14, 15]) song.add(sn, bar, s, 0.35 + s * 0.02, 0.2);
    for (let s = 0; s < 16; s++) song.add(s % 4 === 2 ? ho : hc, bar, s, s % 4 === 2 ? 0.22 : s % 2 ? 0.16 : 0.1);

    for (const s of bassSteps) {
      const note = root + (s === 7 || s === 15 ? 12 : 0);
      song.add(bass(sr, note, song.step * 0.9, { cutoff: 900 + (bar % 4) * 150 }), bar, s, 0.55);
    }
    song.add(pad(sr, chord.map((n) => n + 12), song.step * 16, r, 900), bar, 0, 0.16, 0.6);

    if (bar >= 4) {
      const arp = [0, 1, 2, 1].map((i) => chord[i] + 24);
      for (let s = 0; s < 16; s++) song.add(pluck(sr, arp[s % 4] + (s >= 8 ? 12 : 0), "square", 0.07, 2500), bar, s, 0.09, 0.4);
    }
    if ((bar >= 4 && bar < 8) || bar >= 12) {
      song.add(stab(sr, chord.map((n) => n + 12), r), bar, 0, 0.32, 0.4);
      song.add(stab(sr, chord.map((n) => n + 12), r, 0.12), bar, 10, 0.22, 0.4);
    }
    if (bar >= 8) {
      const riff = bar % 2 === 0 ? riffA : riffB;
      for (const [s, note, len] of riff) song.add(lead(sr, note - (bar % 4 >= 2 ? 0 : 12), len * song.step * 0.95, r), bar, s, 0.2, 0.45);
    }
    if (bar >= 12) {
      for (const s of [0, 6, 10]) song.add(tk, bar, s, 0.45, 0.3);
      if (bar === 15) for (const s of [12, 13, 14, 15]) song.add(tkHi, bar, s, 0.35, 0.3);
    }
  }
  song.add(riser(sr, r, song.step * 16), 15, 0, 0.12, 0.5);
  return song.render({ reverbWet: 0.3 });
}

export function renderSelect(sr) {
  const song = createSong(sr, 112, 8, 1121);
  const { r } = song;
  const k = kick(sr, r), rm = rim(sr, r), hc = hat(sr, r), tk = taiko(sr, r, 0.85);
  // D minor: Dm Bb F C Dm Bb Gm A
  const prog = [[50, "min"], [46, "maj"], [41, "maj"], [48, "maj"], [50, "min"], [46, "maj"], [43, "min"], [45, "maj"]];
  const motif = [[0, 74], [3, 77], [6, 76], [8, 72], [11, 69]];
  for (let bar = 0; bar < 8; bar++) {
    const [root, quality] = prog[bar];
    const chord = triad(root, quality);
    song.add(k, bar, 0, 0.8);
    song.add(k, bar, 8, 0.6);
    if (bar % 2 === 1) song.add(k, bar, 11, 0.4);
    song.add(rm, bar, 4, 0.35, 0.3);
    song.add(rm, bar, 12, 0.35, 0.3);
    for (let s = 2; s < 16; s += 4) song.add(hc, bar, s, 0.1);
    song.add(subBass(sr, root - 12, song.step * 15), bar, 0, 0.5);
    song.add(bass(sr, root - 12, song.step * 1.6, { cutoff: 600, q: 2 }), bar, 6, 0.25);
    song.add(pad(sr, chord.map((n) => n + 12), song.step * 16, r, 1500), bar, 0, 0.22, 0.7);
    const arp = [0, 1, 2, 3, 2, 1].map((i) => (chord[i % 3] + (i === 3 ? 12 : 0)) + 24);
    for (let s = 0; s < 16; s += 2) song.add(pluck(sr, arp[(s / 2) % arp.length], "tri", 0.16, 2000), bar, s, 0.18, 0.55);
    if (bar % 4 === 0) for (const [s, note] of motif) song.add(bell(sr, note, r), bar, s, 0.12, 0.8);
    if (bar === 7) for (const s of [8, 11, 14]) song.add(tk, bar, s, 0.35, 0.4);
  }
  return song.render({ reverbWet: 0.4, level: 0.8 });
}

// One-shot fanfare (no wrap).
export function renderVictory(sr) {
  const bpm = 120, step = 60 / bpm / 4, r = rng(777);
  const total = Math.round(6 * sr);
  const dry = new Float32Array(total), send = new Float32Array(total);
  const add = (b, s, g, wet = 0.5) => { addInto(dry, b, Math.round(s * step * sr), g); addInto(send, b, Math.round(s * step * sr), g * wet); };
  const tk = taiko(sr, r), k = kick(sr, r);
  const chords = [[0, [52, 56, 59, 64]], [4, [57, 61, 64, 69]], [6, [59, 63, 66, 71]], [8, [64, 68, 71, 76]]];
  for (const [s, notes] of chords) {
    const long = s === 8;
    add(stab(sr, notes, r, long ? 0.9 : 0.3), s, long ? 0.5 : 0.4);
    if (long) add(pad(sr, notes, 2.2, r, 2200), s, 0.35, 0.7);
    add(tk, s, 0.6, 0.3);
    add(k, s, 0.6, 0.1);
  }
  const melody = [[0, 76, 2], [2, 79, 1], [3, 80, 1], [4, 81, 2], [6, 83, 2], [8, 88, 8]];
  for (const [s, note, len] of melody) add(lead(sr, note - 12, len * step, r), s, 0.28, 0.6);
  for (const s of [9, 10, 11]) add(tk, s, 0.3, 0.3);
  const wet = reverb(send, sr, { wet: 1, dry: 0, tail: 1.8, seed: 778 });
  addInto(dry, wet, 0, 1);
  return normalize(fadeOut(compress(dry, sr, { threshold: -14, ratio: 3, makeup: 2 }), sr, 1.2), 0.85);
}
