// Synthesised UI sounds (no audio files) plus an optional speech-synthesis announcer.
export function createUiAudio(settings) {
  let ctx = null;
  let master = null;

  function vol(kind) {
    const a = settings.get().audio;
    return a.master * (kind === "announcer" ? a.announcer : a.sfx);
  }

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    return ctx;
  }

  const unlock = () => {
    const c = ensure();
    if (c?.state === "suspended") c.resume();
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });

  function tone({ freq = 440, to, type = "square", dur = 0.06, gain = 0.15, delay = 0 }) {
    const c = ensure();
    if (!c || c.state !== "running") return;
    const v = vol("sfx");
    if (v <= 0) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain * v, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise({ dur = 0.25, gain = 0.2, from = 2000, to = 400, q = 1.2, delay = 0 }) {
    const c = ensure();
    if (!c || c.state !== "running") return;
    const v = vol("sfx");
    if (v <= 0) return;
    const t = c.currentTime + delay;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain * v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
  }

  const sounds = {
    move: () => tone({ freq: 880, dur: 0.035, gain: 0.06, type: "triangle" }),
    confirm: () => { tone({ freq: 520, to: 780, dur: 0.08, gain: 0.1 }); tone({ freq: 1040, dur: 0.1, gain: 0.06, delay: 0.06, type: "triangle" }); },
    back: () => tone({ freq: 420, to: 260, dur: 0.09, gain: 0.08, type: "triangle" }),
    error: () => tone({ freq: 140, dur: 0.14, gain: 0.1, type: "sawtooth" }),
    lock: () => { noise({ dur: 0.35, gain: 0.25, from: 4000, to: 900, q: 6 }); tone({ freq: 196, dur: 0.4, gain: 0.08, type: "sawtooth" }); },
    whoosh: () => noise({ dur: 0.3, gain: 0.12, from: 600, to: 3200, q: 0.8 }),
    gong: () => { tone({ freq: 98, dur: 1.6, gain: 0.18, type: "sine" }); tone({ freq: 147, dur: 1.2, gain: 0.08, type: "sine" }); noise({ dur: 0.8, gain: 0.08, from: 1500, to: 200, q: 3 }); },
    tick: () => tone({ freq: 1400, dur: 0.03, gain: 0.05, type: "square" }),
  };

  let voice = null;
  function pickVoice() {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    voice = voices.find((v) => /en[-_](GB|US)/i.test(v.lang) && /male|daniel|george|alex|fred/i.test(v.name))
      || voices.find((v) => /^en/i.test(v.lang)) || null;
  }
  window.speechSynthesis?.addEventListener?.("voiceschanged", pickVoice);

  return {
    play(name) { sounds[name]?.(); },
    announce(text) {
      const v = vol("announcer");
      if (!window.speechSynthesis || v <= 0 || !text) return;
      if (!voice) pickVoice();
      const u = new SpeechSynthesisUtterance(text.replace(/\./g, " ").toLowerCase());
      if (voice) u.voice = voice;
      u.pitch = 0.35;
      u.rate = 0.82;
      u.volume = Math.min(1, v);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    },
  };
}
