// Offline DSP toolkit used by the asset generator. Mono Float32Array buffers throughout.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const TAU = Math.PI * 2;

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const buf = (sr, seconds) => new Float32Array(Math.max(1, Math.round(sr * seconds)));
export const semis = (n) => 2 ** (n / 12);
export const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
export const db = (d) => 10 ** (d / 20);

export function noise(sr, seconds, rand) {
  const out = buf(sr, seconds);
  for (let i = 0; i < out.length; i++) out[i] = rand() * 2 - 1;
  return out;
}

// Pink-ish noise (Paul Kellet's economy filter).
export function pink(sr, seconds, rand) {
  const out = buf(sr, seconds);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = rand() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    out[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25;
  }
  return out;
}

const valueAt = (v, t, i) => (typeof v === "function" ? v(t, i) : v);

// Oscillator with an optional frequency function f(t) -> Hz.
export function osc(sr, seconds, type, freq, { phase = 0 } = {}) {
  const out = buf(sr, seconds);
  let p = phase;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const f = valueAt(freq, t, i);
    const dt = f / sr;
    let s;
    switch (type) {
      case "sine": s = Math.sin(TAU * p); break;
      case "tri": s = 1 - 4 * Math.abs(((p + 0.25) % 1) - 0.5); break;
      case "square": s = (p % 1) < 0.5 ? 1 : -1; s -= polyBlep(p % 1, dt) - polyBlep((p + 0.5) % 1, dt); break;
      default: s = 2 * (p % 1) - 1; s -= polyBlep(p % 1, dt); // saw
    }
    out[i] = s;
    p += dt;
    if (p > 1e6) p -= Math.floor(p);
  }
  return out;
}

function polyBlep(t, dt) {
  if (dt <= 0) return 0;
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}

// RBJ biquad with per-sample (or constant) cutoff.
export function biquad(input, sr, type, freq, q = 0.707, gainDb = 0) {
  const out = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let b0, b1, b2, a1, a2, lastF = -1;
  const A = 10 ** (gainDb / 40);
  for (let i = 0; i < input.length; i++) {
    const f = Math.min(sr * 0.45, Math.max(10, valueAt(freq, i / sr, i)));
    if (f !== lastF) {
      lastF = f;
      const w = (TAU * f) / sr, cw = Math.cos(w), sw = Math.sin(w), alpha = sw / (2 * q);
      let a0;
      switch (type) {
        case "highpass": b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
        case "bandpass": b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
        case "peak": b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A; break;
        case "lowshelf": {
          const s = 2 * Math.sqrt(A) * alpha;
          b0 = A * ((A + 1) - (A - 1) * cw + s); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - s);
          a0 = (A + 1) + (A - 1) * cw + s; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - s; break;
        }
        default: b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; // lowpass
      }
      b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
    }
    const x = input[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

export const lp = (x, sr, f, q) => biquad(x, sr, "lowpass", f, q);
export const hp = (x, sr, f, q) => biquad(x, sr, "highpass", f, q);
export const bp = (x, sr, f, q) => biquad(x, sr, "bandpass", f, q);

// Envelope helpers return gain-at-time functions.
export const expDecay = (tau, attack = 0.001) => (t) => (t < attack ? t / attack : Math.exp(-(t - attack) / tau));
export function adsr(a, d, s, r, hold) {
  return (t) => {
    if (t < a) return t / a;
    if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
    if (t < hold) return s;
    return Math.max(0, s * (1 - (t - hold) / r));
  };
}
export const bell = (dur, peak = 0.4, curve = 2) => (t) => {
  const x = t / dur;
  if (x <= 0 || x >= 1) return 0;
  return x < peak ? (x / peak) ** curve : ((1 - x) / (1 - peak)) ** curve;
};

export function env(input, sr, fn) {
  for (let i = 0; i < input.length; i++) input[i] *= fn(i / sr, i);
  return input;
}

export function gain(input, g) {
  for (let i = 0; i < input.length; i++) input[i] *= g;
  return input;
}

export function drive(input, amount = 2) {
  const norm = Math.tanh(amount);
  for (let i = 0; i < input.length; i++) input[i] = Math.tanh(input[i] * amount) / norm;
  return input;
}

// Mix sources into a buffer of the longest length (or `length`), each with optional offset seconds and gain.
export function mix(sr, parts, length) {
  let len = length ?? 0;
  if (length == null) for (const p of parts) len = Math.max(len, Math.round((p.at ?? 0) * sr) + p.buf.length);
  const out = new Float32Array(len);
  for (const p of parts) addInto(out, p.buf, Math.round((p.at ?? 0) * sr), p.gain ?? 1);
  return out;
}

export function addInto(target, src, offset = 0, g = 1, wrap = false) {
  for (let i = 0; i < src.length; i++) {
    let j = offset + i;
    if (wrap) j %= target.length;
    if (j < 0 || j >= target.length) continue;
    target[j] += src[i] * g;
  }
  return target;
}

export function peak(x) {
  let m = 0;
  for (let i = 0; i < x.length; i++) m = Math.max(m, Math.abs(x[i]));
  return m;
}

export function normalize(x, target = 0.89) {
  const m = peak(x);
  return m > 0 ? gain(x, target / m) : x;
}

export function fadeOut(x, sr, seconds) {
  const n = Math.min(x.length, Math.round(sr * seconds));
  for (let i = 0; i < n; i++) x[x.length - 1 - i] *= i / n;
  return x;
}

export function fadeIn(x, sr, seconds) {
  const n = Math.min(x.length, Math.round(sr * seconds));
  for (let i = 0; i < n; i++) x[i] *= i / n;
  return x;
}

export function trimTail(x, sr, threshold = 0.0008, pad = 0.02) {
  let end = x.length - 1;
  while (end > 0 && Math.abs(x[end]) < threshold) end--;
  return fadeOut(x.slice(0, Math.min(x.length, end + Math.round(sr * pad))), sr, 0.01);
}

export function trimHead(x, sr, threshold = 0.004, pad = 0.005) {
  let start = 0;
  while (start < x.length && Math.abs(x[start]) < threshold) start++;
  return x.slice(Math.max(0, start - Math.round(sr * pad)));
}

export function reverse(x) {
  return x.slice().reverse();
}

// Fractional resample: rate > 1 raises pitch and shortens.
export function resample(x, rate) {
  const n = Math.floor(x.length / rate);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * rate, i0 = Math.floor(p), f = p - i0;
    const a = x[i0 - 1] ?? x[i0], b = x[i0], c = x[i0 + 1] ?? b, d = x[i0 + 2] ?? c;
    out[i] = b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
  }
  return out;
}

// Small Freeverb-style reverb; returns dry + wet. Comb feedback is derived from `tail`
// (RT60 in seconds) so the wet signal has fully decayed by the end of the buffer.
// The send is high-passed at `lowCut` so low thumps stay tight instead of booming.
export function reverb(input, sr, { damp = 0.4, wet = 0.3, dry = 1, tail = 1.2, predelay = 0.01, seed = 7, lowCut = 220 } = {}) {
  const len = input.length + Math.round(tail * sr);
  const src = new Float32Array(len);
  src.set(input);
  const send = lowCut > 0 ? hp(src, sr, lowCut, 0.6) : src;
  const scale = sr / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => Math.round(d * scale));
  const allpasses = [556, 441, 341, 225].map((d) => Math.round(d * scale));
  const pre = Math.round(predelay * sr);
  const wetBuf = new Float32Array(len);
  const r = rng(seed);
  let energy = 0;
  for (const base of combs) {
    const d = base + Math.floor(r() * 23);
    const fb = 10 ** ((-3 * d) / (tail * 0.8 * sr));
    energy += 1 / Math.sqrt(1 - fb * fb) / combs.length;
    const line = new Float32Array(d);
    let idx = 0, store = 0;
    for (let i = 0; i < len; i++) {
      const x = i - pre >= 0 ? send[i - pre] : 0;
      const y = line[idx];
      store = y * (1 - damp) + store * damp;
      line[idx] = x + store * fb;
      wetBuf[i] += y;
      idx = (idx + 1) % d;
    }
  }
  let sig = wetBuf;
  for (const d of allpasses) {
    const line = new Float32Array(d);
    const out = new Float32Array(len);
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const b = line[idx];
      out[i] = -sig[i] + b;
      line[idx] = sig[i] + b * 0.5;
      idx = (idx + 1) % d;
    }
    sig = out;
  }
  const out = new Float32Array(len);
  const wetGain = (wet * 0.097) / energy;
  for (let i = 0; i < len; i++) out[i] = src[i] * dry + sig[i] * wetGain;
  return out;
}

export function delay(input, sr, { time = 0.25, feedback = 0.3, wet = 0.3, tail = 1 } = {}) {
  const len = input.length + Math.round(tail * sr);
  const out = new Float32Array(len);
  out.set(input);
  const d = Math.round(time * sr);
  const line = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const back = i - d >= 0 ? line[i - d] : 0;
    line[i] = (input[i] ?? 0) + back * feedback;
    out[i] += back * wet;
  }
  return out;
}

// Simple feed-forward compressor on a mono buffer.
export function compress(x, sr, { threshold = -18, ratio = 4, attack = 0.003, release = 0.08, makeup = 0 } = {}) {
  const out = new Float32Array(x.length);
  const ga = Math.exp(-1 / (attack * sr)), gr = Math.exp(-1 / (release * sr));
  let envDb = -120;
  for (let i = 0; i < x.length; i++) {
    const lvl = 20 * Math.log10(Math.abs(x[i]) + 1e-9);
    envDb = lvl > envDb ? ga * envDb + (1 - ga) * lvl : gr * envDb + (1 - gr) * lvl;
    const over = envDb - threshold;
    const red = over > 0 ? over - over / ratio : 0;
    out[i] = x[i] * db(makeup - red);
  }
  return out;
}

export function writeWav(path, data, sr, channels = 1) {
  mkdirSync(dirname(path), { recursive: true });
  const frames = channels === 1 ? data.length : data[0].length;
  const bytes = frames * channels * 2;
  const b = Buffer.alloc(44 + bytes);
  b.write("RIFF", 0); b.writeUInt32LE(36 + bytes, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(channels, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * channels * 2, 28); b.writeUInt16LE(channels * 2, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(bytes, 40);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = channels === 1 ? data[i] : data[c][i];
      b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), o);
      o += 2;
    }
  }
  writeFileSync(path, b);
}

export function readWav(path) {
  const b = readFileSync(path);
  let o = 12, sr = 22050, channels = 1, bits = 16, data = null;
  while (o + 8 <= b.length) {
    const id = b.toString("ascii", o, o + 4), size = b.readUInt32LE(o + 4);
    if (id === "fmt ") { channels = b.readUInt16LE(o + 10); sr = b.readUInt32LE(o + 12); bits = b.readUInt16LE(o + 22); }
    if (id === "data") data = b.subarray(o + 8, o + 8 + size);
    o += 8 + size + (size & 1);
  }
  if (!data || bits !== 16) throw new Error(`Unsupported WAV: ${path}`);
  const frames = data.length / (2 * channels);
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < channels; c++) s += data.readInt16LE((i * channels + c) * 2) / 32768;
    out[i] = s / channels;
  }
  return { sr, data: out };
}
