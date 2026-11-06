// Procedural recipes for every sound effect in SOUNDS. Each recipe gets a seeded
// random source so variants differ but re-running the generator is deterministic.
import {
  rng, buf, osc, noise, pink, lp, hp, bp, biquad, env, drive, mix, normalize, reverb,
  expDecay, bell, trimTail, fadeOut, midiHz, addInto,
} from "./dsp.mjs";

const hash = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

// ---- building blocks ------------------------------------------------------

function thump(sr, f0, f1, tau, dur, r) {
  const k = Math.log(f1 / f0);
  const tone = osc(sr, dur, "sine", (t) => f0 * Math.exp(k * Math.min(1, t / (tau * 3))), { phase: r() * 0.1 });
  return fadeOut(env(tone, sr, expDecay(tau, 0.0015)), sr, dur * 0.35);
}

function click(sr, r, cutoff = 4000) {
  return env(hp(noise(sr, 0.006, r), sr, cutoff), sr, expDecay(0.0012, 0.0002));
}

function snap(sr, r, freq, q, tau, dur = tau * 6) {
  return env(bp(noise(sr, dur, r), sr, freq, q), sr, expDecay(tau, 0.0008));
}

function crunch(sr, r, dur, f0, f1, tau) {
  const k = Math.log(f1 / f0);
  return env(lp(noise(sr, dur, r), sr, (t) => f0 * Math.exp(k * Math.min(1, t / dur)), 0.9), sr, expDecay(tau, 0.001));
}

function whooshCore(sr, r, dur, fLo, fHi, q = 1.4, peakAt = 0.45) {
  const shape = bell(dur, peakAt, 1.6);
  const n = pink(sr, dur, r);
  const filtered = bp(n, sr, (t) => fLo + (fHi - fLo) * shape(t) ** 0.8, q);
  return env(filtered, sr, shape);
}

function grains(sr, r, dur, count, freq, q, tau) {
  const out = buf(sr, dur + tau * 8);
  for (let i = 0; i < count; i++) {
    const at = Math.pow(r(), 1.8) * dur;
    const g = snap(sr, r, freq * (0.7 + r() * 0.8), q, tau * (0.6 + r() * 0.8));
    addInto(out, g, Math.round(at * sr), (0.3 + r() * 0.7) * (1 - at / dur));
  }
  return out;
}

function partials(sr, base, ratios, tau, dur, r, detune = 0.003) {
  const out = buf(sr, dur);
  ratios.forEach((ratio, i) => {
    const f = base * ratio * (1 + (r() - 0.5) * detune);
    const p = env(osc(sr, dur, "sine", f, { phase: r() }), sr, expDecay(tau / (1 + i * 0.35), 0.001));
    addInto(out, p, 0, 1 / (1 + i * 0.6));
  });
  return fadeOut(out, sr, dur * 0.35);
}

function chordStab(sr, notes, dur, tau, cutoff, r, wave = "saw") {
  const out = buf(sr, dur);
  for (const m of notes) {
    for (const det of [-0.08, 0.08]) {
      addInto(out, osc(sr, dur, wave, midiHz(m + det), { phase: r() }), 0, 1 / notes.length);
    }
  }
  return fadeOut(env(lp(out, sr, (t) => cutoff * (0.25 + 0.75 * Math.exp(-t / (tau * 0.8))), 1.2), sr, expDecay(tau, 0.004)), sr, dur * 0.35);
}

function blip(sr, wave, f0, f1, dur, tau, cutoff = 6000) {
  const k = Math.log(f1 / f0);
  const tone = osc(sr, dur, wave, (t) => f0 * Math.exp(k * Math.min(1, t / dur)));
  return env(lp(tone, sr, cutoff, 0.7), sr, expDecay(tau, 0.002));
}

const finish = (x, sr, { level = 0.89, tail = true } = {}) => {
  const y = tail ? trimTail(x, sr) : x;
  return normalize(fadeOut(y, sr, 0.008), level);
};

// ---- recipes ---------------------------------------------------------------

const recipes = {
  "hit.light"(sr, r, v) {
    const body = thump(sr, v(200, 250), v(80, 100), v(0.03, 0.04), 0.16, r);
    const s = snap(sr, r, v(2200, 3000), 1.2, v(0.014, 0.02));
    const flesh = crunch(sr, r, 0.08, 3000, 900, 0.02);
    const dry = drive(mix(sr, [{ buf: body, gain: 1 }, { buf: s, gain: 0.8 }, { buf: flesh, gain: 0.5 }, { buf: click(sr, r), gain: 0.5 }]), 1.8);
    return finish(reverb(dry, sr, { wet: 0.18, tail: 0.25, seed: 3 }), sr, { level: 0.8 });
  },

  "hit.heavy"(sr, r, v) {
    const sub = drive(thump(sr, v(130, 150), v(40, 46), v(0.1, 0.13), 0.5, r), 2.5);
    const body = thump(sr, v(280, 330), v(100, 120), 0.05, 0.25, r);
    const cr = drive(crunch(sr, r, 0.3, 2400, 350, v(0.06, 0.09)), 2);
    const s = snap(sr, r, v(1200, 1600), 0.9, 0.03);
    const dry = drive(mix(sr, [{ buf: sub, gain: 1 }, { buf: body, gain: 0.7 }, { buf: cr, gain: 0.55 }, { buf: s, gain: 0.6 }, { buf: click(sr, r, 3000), gain: 0.6 }]), 2.2);
    return finish(reverb(dry, sr, { wet: 0.25, tail: 0.6, seed: 5 }), sr);
  },

  "hit.counter"(sr, r, v) {
    const sub = drive(thump(sr, 150, 38, 0.13, 0.55, r), 3);
    const crack = env(hp(noise(sr, 0.12, r), sr, 2500), sr, expDecay(0.02, 0.0005));
    const cr = drive(crunch(sr, r, 0.3, 3000, 400, 0.07), 2);
    const ring = bp(partials(sr, v(860, 900), [1, 1.5, 2.37, 3.62, 4.9], 0.32, 0.9, r), sr, 2200, 0.6);
    const dry = mix(sr, [{ buf: sub, gain: 1 }, { buf: crack, gain: 0.8 }, { buf: cr, gain: 0.5 }, { buf: ring, gain: 0.55, at: 0.004 }]);
    return finish(reverb(drive(dry, 1.6), sr, { wet: 0.3, tail: 0.8, seed: 9 }), sr);
  },

  "hit.block"(sr, r, v) {
    const body = thump(sr, v(170, 200), v(110, 130), 0.03, 0.12, r);
    const clack = snap(sr, r, v(1000, 1250), 4, 0.012);
    const tick = snap(sr, r, v(3000, 3600), 6, 0.006);
    const guard = env(osc(sr, 0.15, "tri", v(560, 640)), sr, expDecay(0.03));
    const dry = drive(mix(sr, [{ buf: body, gain: 0.9 }, { buf: clack, gain: 1 }, { buf: tick, gain: 0.6 }, { buf: guard, gain: 0.25 }]), 1.5);
    return finish(reverb(dry, sr, { wet: 0.2, tail: 0.25, seed: 11 }), sr, { level: 0.75 });
  },

  "whoosh.light"(sr, r, v) {
    return finish(whooshCore(sr, r, v(0.13, 0.16), v(800, 1000), v(2800, 3400), 1.6), sr, { level: 0.7 });
  },

  "whoosh.medium"(sr, r, v) {
    return finish(whooshCore(sr, r, v(0.2, 0.24), v(550, 700), v(2000, 2500), 1.4), sr, { level: 0.75 });
  },

  "whoosh.heavy"(sr, r, v) {
    const dur = v(0.32, 0.37);
    const air = whooshCore(sr, r, dur, v(280, 340), v(1300, 1600), 1.2, 0.5);
    const flutter = env(air.slice(), sr, (t) => 0.75 + 0.25 * Math.sin(t * 2 * Math.PI * v(26, 34)));
    const rumble = env(osc(sr, dur, "sine", (t) => 75 - 25 * (t / dur)), sr, bell(dur, 0.5, 1.5));
    return finish(mix(sr, [{ buf: flutter, gain: 1 }, { buf: rumble, gain: 0.35 }]), sr, { level: 0.8 });
  },

  "step.walk"(sr, r, v) {
    const heel = env(lp(noise(sr, 0.1, r), sr, v(450, 650)), sr, expDecay(0.02, 0.002));
    const tone = thump(sr, v(90, 105), 60, 0.022, 0.1, r);
    const scuff = env(bp(noise(sr, 0.08, r), sr, v(2000, 2800), 0.8), sr, bell(0.06, 0.3));
    const dry = mix(sr, [{ buf: heel, gain: 1 }, { buf: tone, gain: 0.7 }, { buf: scuff, gain: 0.18, at: 0.012 }]);
    return finish(reverb(dry, sr, { wet: 0.1, tail: 0.12, seed: 13 }), sr, { level: 0.7 });
  },

  "step.run"(sr, r, v) {
    const heel = env(lp(noise(sr, 0.1, r), sr, v(700, 900)), sr, expDecay(0.016, 0.001));
    const tone = thump(sr, v(110, 125), 65, 0.02, 0.1, r);
    const scuff = env(bp(noise(sr, 0.1, r), sr, v(2400, 3200), 0.9), sr, bell(0.07, 0.25));
    const grit = grains(sr, r, 0.05, 6, 3200, 3, 0.002);
    const dry = mix(sr, [{ buf: heel, gain: 1 }, { buf: tone, gain: 0.7 }, { buf: scuff, gain: 0.3, at: 0.006 }, { buf: grit, gain: 0.25, at: 0.004 }]);
    return finish(reverb(dry, sr, { wet: 0.1, tail: 0.12, seed: 17 }), sr, { level: 0.75 });
  },

  "move.dash"(sr, r, v) {
    const scuff = env(bp(noise(sr, 0.12, r), sr, v(1600, 2000), 0.9), sr, bell(0.09, 0.15));
    const air = whooshCore(sr, r, v(0.17, 0.2), 500, v(2400, 2800), 1.3, 0.3);
    const stomp = thump(sr, 120, 60, 0.025, 0.1, r);
    return finish(mix(sr, [{ buf: stomp, gain: 0.7 }, { buf: scuff, gain: 0.5 }, { buf: air, gain: 0.9, at: 0.01 }]), sr, { level: 0.8 });
  },

  "move.jump"(sr, r, v) {
    const push = env(lp(noise(sr, 0.08, r), sr, 700), sr, expDecay(0.02));
    const scuff = env(bp(noise(sr, 0.08, r), sr, v(2200, 2800), 1), sr, bell(0.05, 0.2));
    const cloth = whooshCore(sr, r, v(0.2, 0.24), 600, v(1700, 2000), 1.1, 0.35);
    return finish(mix(sr, [{ buf: push, gain: 0.8 }, { buf: scuff, gain: 0.3 }, { buf: cloth, gain: 0.7, at: 0.02 }]), sr, { level: 0.7 });
  },

  "move.land"(sr, r, v) {
    const thud = drive(thump(sr, v(105, 120), 45, 0.07, 0.3, r), 1.5);
    const mass = env(lp(noise(sr, 0.2, r), sr, 420), sr, expDecay(0.05, 0.002));
    const dust = grains(sr, r, 0.14, 14, 2200, 2, 0.003);
    const dry = mix(sr, [{ buf: thud, gain: 1 }, { buf: mass, gain: 0.8 }, { buf: dust, gain: 0.25, at: 0.01 }]);
    return finish(reverb(dry, sr, { wet: 0.15, tail: 0.3, seed: 19 }), sr, { level: 0.85 });
  },

  "body.fall"(sr, r, v) {
    const torso = drive(thump(sr, v(85, 95), 34, 0.1, 0.4, r), 2);
    const mass = env(lp(noise(sr, 0.3, r), sr, 380), sr, expDecay(0.07));
    const limb = thump(sr, 140, 70, 0.03, 0.12, r);
    const rattle = grains(sr, r, 0.25, 18, 1800, 2.5, 0.004);
    const dry = mix(sr, [{ buf: torso, gain: 1 }, { buf: mass, gain: 0.8 }, { buf: limb, gain: 0.6, at: v(0.11, 0.15) }, { buf: rattle, gain: 0.2, at: 0.01 }]);
    return finish(reverb(dry, sr, { wet: 0.2, tail: 0.5, seed: 23 }), sr);
  },

  "throw.grab"(sr, r, v) {
    const cloth = env(bp(noise(sr, 0.15, r), sr, v(1000, 1400), 0.7), sr, expDecay(0.04, 0.005));
    const tug = whooshCore(sr, r, 0.12, 400, 1400, 1.2, 0.3);
    const hold = thump(sr, 180, 110, 0.03, 0.1, r);
    return finish(mix(sr, [{ buf: hold, gain: 0.8 }, { buf: cloth, gain: 0.9 }, { buf: tug, gain: 0.6, at: 0.03 }]), sr, { level: 0.8 });
  },

  "throw.slam"(sr, r, v) {
    const lead = whooshCore(sr, r, 0.18, 300, 1500, 1.2, 0.7);
    const sub = drive(thump(sr, v(115, 125), 33, 0.18, 0.8, r), 4);
    const boom = env(lp(noise(sr, 0.5, r), sr, 300), sr, expDecay(0.12));
    const debris = grains(sr, r, 0.45, 30, 2000, 2, 0.004);
    const crack = env(hp(noise(sr, 0.08, r), sr, 1800), sr, expDecay(0.015, 0.0005));
    const at = 0.16;
    const dry = mix(sr, [{ buf: lead, gain: 0.6 }, { buf: sub, gain: 1, at }, { buf: boom, gain: 0.8, at }, { buf: crack, gain: 0.5, at }, { buf: debris, gain: 0.3, at: at + 0.02 }]);
    return finish(reverb(drive(dry, 1.4), sr, { wet: 0.3, tail: 1, seed: 29 }), sr);
  },

  "throw.break"(sr, r, v) {
    const a = snap(sr, r, 1150, 4, 0.012), b = snap(sr, r, 1350, 4, 0.012);
    const shine = env(osc(sr, 0.4, "sine", (t) => 1500 + 900 * Math.min(1, t / 0.15)), sr, expDecay(0.1, 0.005));
    const air = whooshCore(sr, r, 0.2, 800, 2600, 1.4, 0.2);
    const dry = mix(sr, [{ buf: a, gain: 1 }, { buf: b, gain: 1, at: 0.05 }, { buf: shine, gain: 0.3, at: 0.05 }, { buf: air, gain: 0.5, at: 0.04 }]);
    return finish(reverb(dry, sr, { wet: 0.25, tail: 0.5, seed: 31 }), sr, { level: 0.8 });
  },

  "stinger.special"(sr, r) {
    const rise = 0.42;
    const sweepSaw = osc(sr, rise, "saw", (t) => 180 * Math.exp(Math.log(4) * (t / rise)));
    const riser = env(biquad(sweepSaw, sr, "lowpass", (t) => 300 + 5500 * (t / rise) ** 2, 5), sr, (t) => (t / rise) ** 1.5);
    const air = env(bp(pink(sr, rise, r), sr, (t) => 600 + 5000 * (t / rise) ** 2, 1.5), sr, (t) => (t / rise) ** 2);
    const burst = drive(thump(sr, 160, 50, 0.1, 0.5, r), 2.5);
    const chime = partials(sr, midiHz(84), [1, 1.5, 2, 3], 0.45, 1.1, r);
    const dry = mix(sr, [{ buf: riser, gain: 0.45 }, { buf: air, gain: 0.5 }, { buf: burst, gain: 0.9, at: rise }, { buf: chime, gain: 0.35, at: rise }]);
    return finish(reverb(dry, sr, { wet: 0.35, tail: 1.1, seed: 37 }), sr);
  },

  "stinger.super"(sr, r) {
    const boom = drive(thump(sr, 70, 28, 0.5, 1.6, r), 3);
    const gong = partials(sr, 110, [1, 2.76, 5.4, 8.93], 1.2, 2.2, r, 0.01);
    const stab = drive(chordStab(sr, [45, 48, 52, 57, 64], 1.4, 0.45, 3200, r), 1.8);
    const crack = env(hp(noise(sr, 0.15, r), sr, 3000), sr, expDecay(0.03, 0.0005));
    const shimmerTone = partials(sr, midiHz(88), [1, 1.5, 2.01, 3.02], 0.9, 1.8, r, 0.02);
    const shimmer = env(shimmerTone, sr, (t) => 0.6 + 0.4 * Math.sin(t * 2 * Math.PI * 7));
    const dry = mix(sr, [{ buf: boom, gain: 1 }, { buf: gong, gain: 0.45 }, { buf: stab, gain: 0.7 }, { buf: crack, gain: 0.5 }, { buf: shimmer, gain: 0.18, at: 0.05 }]);
    return finish(reverb(dry, sr, { wet: 0.4, tail: 1.8, seed: 41 }), sr);
  },

  "ko.impact"(sr, r) {
    const sub = drive(thump(sr, 100, 26, 0.5, 2, r), 5);
    const body = drive(thump(sr, 260, 90, 0.07, 0.4, r), 2);
    const crack = env(hp(noise(sr, 0.2, r), sr, 2000), sr, expDecay(0.035, 0.0005));
    const boom = env(lp(noise(sr, 1.2, r), sr, 220), sr, expDecay(0.3));
    const gong = partials(sr, 55, [1, 2.4, 3.9, 5.7, 8.1], 1.6, 2.8, r, 0.01);
    const dry = mix(sr, [{ buf: sub, gain: 1 }, { buf: body, gain: 0.6 }, { buf: crack, gain: 0.6 }, { buf: boom, gain: 0.8 }, { buf: gong, gain: 0.4 }]);
    return finish(reverb(drive(dry, 1.5), sr, { wet: 0.5, tail: 2.6, damp: 0.5, seed: 43 }), sr);
  },

  "fx.slowmo-in"(sr, r) {
    const dur = 1.3;
    const fall = (t) => Math.exp(-t / 0.45);
    const saw = osc(sr, dur, "saw", (t) => 55 + 165 * fall(t));
    const tone = env(biquad(saw, sr, "lowpass", (t) => 300 + 1800 * fall(t), 3), sr, bell(dur, 0.12, 1.2));
    const air = env(bp(pink(sr, dur, r), sr, (t) => 200 + 2800 * fall(t), 1.2), sr, bell(dur, 0.1, 1.4));
    const drone = env(osc(sr, dur, "sine", 41), sr, bell(dur, 0.35, 1));
    return finish(reverb(mix(sr, [{ buf: tone, gain: 0.6 }, { buf: air, gain: 0.8 }, { buf: drone, gain: 0.6 }]), sr, { wet: 0.35, tail: 1, seed: 47 }), sr, { level: 0.8 });
  },

  "fx.slowmo-out"(sr, r) {
    const dur = 0.7;
    const up = (t) => (t / dur) ** 1.5;
    const saw = osc(sr, dur, "saw", (t) => 60 + 220 * up(t));
    const tone = env(biquad(saw, sr, "lowpass", (t) => 300 + 2500 * up(t), 3), sr, bell(dur, 0.8, 1.2));
    const air = env(bp(pink(sr, dur, r), sr, (t) => 300 + 3500 * up(t), 1.3), sr, bell(dur, 0.85, 1.5));
    return finish(reverb(mix(sr, [{ buf: tone, gain: 0.5 }, { buf: air, gain: 0.9 }]), sr, { wet: 0.25, tail: 0.6, seed: 53 }), sr, { level: 0.75 });
  },

  "tag.in"(sr, r) {
    const zip = blip(sr, "square", 380, 1700, 0.18, 0.12, 5000);
    const slap = mix(sr, [{ buf: snap(sr, r, 1800, 1, 0.016), gain: 1 }, { buf: thump(sr, 320, 150, 0.025, 0.1, r), gain: 0.8 }]);
    const air = whooshCore(sr, r, 0.28, 500, 2400, 1.3, 0.35);
    const dry = mix(sr, [{ buf: zip, gain: 0.3 }, { buf: slap, gain: 1, at: 0.12 }, { buf: air, gain: 0.7, at: 0.1 }]);
    return finish(reverb(dry, sr, { wet: 0.22, tail: 0.5, seed: 59 }), sr, { level: 0.85 });
  },

  "stinger.tag"(sr, r) {
    const lead = 0.11;
    const rise = env(bp(pink(sr, lead, r), sr, (t) => 900 + 5000 * (t / lead) ** 2, 1.4), sr, (t) => (t / lead) ** 2);
    const hit = drive(chordStab(sr, [52, 59, 64, 71], 0.6, 0.16, 4200, r), 1.6);
    const chime = partials(sr, midiHz(88), [1, 1.5, 2], 0.22, 0.6, r);
    const punch = thump(sr, 180, 80, 0.04, 0.15, r);
    const dry = mix(sr, [{ buf: rise, gain: 0.45 }, { buf: hit, gain: 0.7, at: lead }, { buf: chime, gain: 0.22, at: lead }, { buf: punch, gain: 0.6, at: lead }]);
    return finish(reverb(dry, sr, { wet: 0.25, tail: 0.6, seed: 73 }), sr, { level: 0.8 });
  },

  "ui.move"(sr, r) {
    return finish(mix(sr, [{ buf: blip(sr, "tri", 1320, 1240, 0.05, 0.016), gain: 1 }, { buf: click(sr, r, 6000), gain: 0.15 }]), sr, { level: 0.6 });
  },

  "ui.confirm"(sr) {
    const a = blip(sr, "square", midiHz(88), midiHz(88), 0.12, 0.05, 4500);
    const b = blip(sr, "square", midiHz(95), midiHz(95), 0.25, 0.09, 4500);
    return finish(reverb(mix(sr, [{ buf: a, gain: 0.7 }, { buf: b, gain: 0.8, at: 0.06 }]), sr, { wet: 0.2, tail: 0.3, seed: 61 }), sr, { level: 0.65 });
  },

  "ui.back"(sr) {
    const a = blip(sr, "tri", midiHz(83), midiHz(83), 0.1, 0.04, 4000);
    const b = blip(sr, "tri", midiHz(76), midiHz(74), 0.18, 0.06, 4000);
    return finish(reverb(mix(sr, [{ buf: a, gain: 0.8 }, { buf: b, gain: 0.9, at: 0.055 }]), sr, { wet: 0.15, tail: 0.25, seed: 67 }), sr, { level: 0.6 });
  },

  "ui.lock"(sr, r) {
    const boom = drive(thump(sr, 95, 44, 0.25, 1, r), 2.5);
    const clang = bp(partials(sr, 410, [1, 2.32, 4.25, 6.63], 0.6, 1.3, r, 0.01), sr, 1800, 0.5);
    const stab = drive(chordStab(sr, [50, 53, 57, 62], 1, 0.35, 3000, r), 1.6);
    const crack = env(hp(noise(sr, 0.08, r), sr, 3000), sr, expDecay(0.015, 0.0005));
    const dry = mix(sr, [{ buf: boom, gain: 1 }, { buf: clang, gain: 0.5 }, { buf: stab, gain: 0.6 }, { buf: crack, gain: 0.4 }]);
    return finish(reverb(dry, sr, { wet: 0.35, tail: 1.2, seed: 71 }), sr, { level: 0.85 });
  },
};

export const SFX_IDS = Object.keys(recipes);

export function renderSfx(id, variant, sr) {
  const recipe = recipes[id];
  if (!recipe) throw new Error(`No recipe for ${id}`);
  const r = rng(hash(`${id}#${variant}`));
  const v = (a, b) => a + (b - a) * r();
  return recipe(sr, r, v);
}
