import { createAudio, createFootstepTracker, BUSES, SOUNDS, VOICE, MUSIC, LABS } from "../../src/audio/index.js";

const $ = (s) => document.querySelector(s);
const log = (text) => {
  const li = document.createElement("li");
  li.innerHTML = text;
  $("#log").prepend(li);
  while ($("#log").children.length > 12) $("#log").lastChild.remove();
};

const audio = createAudio({
  onPlay: (id, info) => {
    log(`<b>${id}</b> v${info.variant + 1} ×${info.rate.toFixed(2)} ${(20 * Math.log10(info.level)).toFixed(1)}dB${info.pan ? ` pan ${info.pan.toFixed(2)}` : ""}`);
    const card = document.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (card) { card.classList.add("flash"); setTimeout(() => card.classList.remove("flash"), Math.min(900, info.duration * 1000)); }
  },
});
window.audio = audio;
let variation = 1;

// ---- status / unlock ----------------------------------------------------------------
const ctxState = () => { $("#ctx-state").textContent = audio.context.state; $("#unlock").hidden = audio.context.state === "running"; };
audio.context.addEventListener?.("statechange", ctxState);
ctxState();
$("#unlock").onclick = () => audio.unlock().then(ctxState);

// ---- mixer ------------------------------------------------------------------------------
for (const bus of BUSES) {
  const row = document.createElement("div");
  row.className = "bus";
  row.innerHTML = `<label for="vol-${bus}">${bus}</label><input id="vol-${bus}" type="range" min="0" max="1" step="0.01"><output></output><input type="checkbox" title="Mute ${bus}">`;
  const [range, out, mute] = [row.querySelector("input[type=range]"), row.querySelector("output"), row.querySelector("input[type=checkbox]")];
  const sync = () => { out.textContent = `${Math.round(audio.getVolume(bus) * 100)}`; };
  range.value = audio.getVolume(bus);
  mute.checked = audio.isMuted(bus);
  range.oninput = () => { audio.setVolume(bus, range.value); sync(); };
  mute.onchange = () => audio.setMuted(bus, mute.checked);
  sync();
  $("#mixer").append(row);
}
$("#variation").onclick = (e) => { variation = variation ? 0 : 1; e.currentTarget.classList.toggle("on", Boolean(variation)); };
$("#slowmo").onclick = (e) => { audio.setSlowMotion(!audio.slowMotion); e.currentTarget.classList.toggle("on", audio.slowMotion); };

// ---- music --------------------------------------------------------------------------------
$("#fade").oninput = () => { $("#fade-out").textContent = `${(+$("#fade").value).toFixed(1)}s`; };
const nowPlaying = () => { $("#now").textContent = audio.currentMusic ? MUSIC[audio.currentMusic].title : "—"; };
for (const [id, track] of [...Object.entries(MUSIC), ["none", { title: "Stop music", file: "fade out" }]]) {
  const b = document.createElement("button");
  b.innerHTML = `${track.title}<small>${id === "none" ? "fade out" : `${id} · ${track.loop === false ? "one-shot" : "loop"}`}</small>`;
  b.onclick = () => { audio.unlock(); audio.music(id, { fade: +$("#fade").value }).then(nowPlaying); nowPlaying(); };
  $("#tracks").append(b);
}

// ---- sound cards --------------------------------------------------------------------------
const label = (id) => {
  const words = id.replace(/^(fx|move|ko)\./, "").replace(/[.-]/g, " ").replace(/^ui /, "UI ");
  return words[0].toUpperCase() + words.slice(1);
};
const GROUPS = [
  ["Hits", "light, heavy, counter, block", ["hit.light", "hit.heavy", "hit.counter", "hit.block"]],
  ["Whooshes", "one per attack weight", ["whoosh.light", "whoosh.medium", "whoosh.heavy"]],
  ["Movement", "footsteps, dash, jump, land", ["step.walk", "step.run", "move.dash", "move.jump", "move.land", "body.fall"]],
  ["Throws", "", ["throw.grab", "throw.slam", "throw.break"]],
  ["Stingers · KO · Tag", "", ["stinger.special", "stinger.super", "ko.impact", "fx.slowmo-in", "fx.slowmo-out", "tag.in"]],
  ["UI", "menu navigation and lock-in", ["ui.move", "ui.confirm", "ui.back", "ui.lock"]],
  ["Announcer", "Piper TTS · public-domain voices", Object.keys(VOICE).filter((id) => !id.startsWith("ann.wins."))],
  ["Winners", "“<lab> wins”", Object.keys(VOICE).filter((id) => id.startsWith("ann.wins."))],
];
const listed = new Set(GROUPS.flatMap((g) => g[2]));
const rest = Object.keys({ ...SOUNDS, ...VOICE }).filter((id) => !listed.has(id));
if (rest.length) GROUPS.push(["Other", "", rest]);

const cards = [];
for (const [title, sub, ids] of GROUPS) {
  const g = document.createElement("section");
  g.className = "group";
  g.innerHTML = `<h3>${title}<em>${sub}</em></h3><div class="cards"></div>`;
  for (const id of ids) {
    const entry = SOUNDS[id] ?? VOICE[id];
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.id = id;
    const name = id.startsWith("ann.wins.") ? `${LABS[id.slice(9)].name} wins` : entry.text ?? label(id);
    card.innerHTML = `<span class="bus-tag ${entry.bus}">${entry.bus}</span><div class="name">${name}</div><code>${id}</code><canvas width="380" height="76"></canvas><div class="meta"><span class="dur">…</span><span class="chips"></span></div>`;
    if (entry.variants > 1) {
      for (let i = 0; i < entry.variants; i++) {
        const chip = document.createElement("button");
        chip.textContent = i + 1;
        chip.title = `Variant ${i + 1}`;
        chip.onclick = (e) => { e.stopPropagation(); trigger(id, { variant: i }); };
        card.querySelector(".chips").append(chip);
      }
    }
    card.onclick = () => trigger(id);
    g.querySelector(".cards").append(card);
    cards.push({ id, card });
  }
  $("#groups").append(g);
}

function trigger(id, opts = {}) {
  audio.unlock();
  return VOICE[id] ? audio.announce(id, { interrupt: true, ...opts }) : audio.play(id, { variation, ...opts });
}

function drawWave(canvas, buffer, color) {
  const c = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  c.clearRect(0, 0, w, h);
  if (!buffer) return;
  const data = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / w));
  c.fillStyle = color;
  for (let x = 0; x < w; x++) {
    let lo = 1, hi = -1;
    for (let i = x * step; i < Math.min(data.length, (x + 1) * step); i++) { const v = data[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    if (hi < lo) continue;
    c.fillRect(x, (1 - hi) * h / 2, 1, Math.max(1, (hi - lo) * h / 2));
  }
}

audio.ready.then(() => {
  let loaded = 0;
  for (const { id, card } of cards) {
    const buffer = audio.buffer(id);
    if (buffer) loaded++;
    drawWave(card.querySelector("canvas"), buffer, (SOUNDS[id] ?? VOICE[id]).bus === "voice" ? "#9d7bff" : "#3fd1c0");
    card.querySelector(".dur").textContent = buffer ? `${buffer.duration.toFixed(2)}s` : "missing";
  }
  $("#load-state").textContent = `${loaded}/${cards.length} sounds loaded`;
  window.previewReady = true;
});

// ---- play all ----------------------------------------------------------------------------------
let playAllTimer = 0;
$("#play-all").onclick = async (e) => {
  if (playAllTimer) { clearTimeout(playAllTimer); playAllTimer = 0; e.currentTarget.textContent = "Play all"; return; }
  await audio.unlock();
  e.currentTarget.textContent = "Stop";
  let i = 0;
  const next = () => {
    if (i >= cards.length) { playAllTimer = 0; $("#play-all").textContent = "Play all"; return; }
    const { id, card } = cards[i++];
    card.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const h = trigger(id);
    playAllTimer = setTimeout(next, Math.min(1800, Math.max(350, (h?.duration ?? 0.5) * (VOICE[id] ? 550 : 700))));
  };
  next();
};

// ---- game event simulator -------------------------------------------------------------------------
function createEmitter() {
  const map = new Map();
  return {
    on(name, fn) { if (!map.has(name)) map.set(name, new Set()); map.get(name).add(fn); return () => map.get(name).delete(fn); },
    emit(name, payload) { log(`event <b>${name}</b> ${payload ? JSON.stringify(payload).slice(0, 60) : ""}`); map.get(name)?.forEach((fn) => fn(payload)); },
  };
}
const game = { events: createEmitter(), state: { fighters: [] } };
audio.attach(game, { fightDelay: 1.3 });
const emit = (name, payload, delay = 0) => setTimeout(() => game.events.emit(name, payload), delay);

for (const [id, lab] of Object.entries(LABS)) {
  const o = document.createElement("option");
  o.value = id;
  o.textContent = lab.name;
  $("#lab").append(o);
}
$("#lab").value = "anthropic";

const SCENARIOS = {
  "Round 1 → Fight": () => emit("roundStart", { round: 1 }),
  "Final round → Fight": () => emit("roundStart", { round: 3, final: true }),
  "Light-heavy combo": () => {
    [["light", 0], ["light", 160], ["medium", 330], ["heavy", 560]].forEach(([w, t], i) => {
      emit("attack", { weight: w, x: 600 + i * 30 }, t);
      emit("hit", { weight: w, x: 640 + i * 30 }, t + (w === "heavy" ? 110 : 70));
    });
  },
  "Counter hit": () => { emit("attack", { weight: "heavy", x: 700 }); emit("hit", { weight: "heavy", counter: true, x: 720 }, 110); },
  "Block string": () => [0, 170, 340].forEach((t, i) => { emit("attack", { weight: i === 2 ? "heavy" : "light", x: 500 }, t); emit("block", { x: 520 }, t + 70); }),
  "Throw": () => { emit("throw", { x: 640 }); emit("hit", { throw: true, x: 640 }, 420); },
  "Special": () => { emit("special", { x: 400 }); emit("hit", { weight: "special", x: 820 }, 650); },
  "Super": () => { emit("super", { x: 640 }); [700, 860, 1020].forEach((t) => emit("hit", { weight: "super", x: 700 }, t)); },
  "Tag-in": () => emit("tag", { x: 200 }),
  "Throw break": () => emit("throwBreak", { x: 640 }),
  "KO (slow-mo)": () => { emit("hit", { weight: "heavy", x: 760 }); emit("ko", { x: 760 }, 60); },
  "Perfect + match win": () => {
    emit("hit", { weight: "heavy", x: 760 });
    emit("ko", { x: 760 }, 60);
    emit("roundEnd", { winner: 0, perfect: true, reason: "ko", matchOver: true, winnerLab: $("#lab").value }, 900);
  },
  "Time over": () => emit("roundEnd", { winner: 1, reason: "time" }),
  "Finish them": () => emit("finishThem", {}),
  "UI: move ×4 → lock": () => { [0, 120, 240, 360].forEach((t) => setTimeout(() => audio.ui("move"), t)); setTimeout(() => audio.ui("confirm"), 520); setTimeout(() => audio.ui("lock"), 760); },
  "Jump → land": () => { emit("jump", { x: 500 }); emit("land", { x: 520 }, 620); },
};
for (const [name, run] of Object.entries(SCENARIOS)) {
  const b = document.createElement("button");
  b.textContent = name;
  b.onclick = () => { audio.unlock(); run(); };
  $("#scenarios").append(b);
}

// ---- footstep demo -------------------------------------------------------------------------------
// A mock atlas in the contract's format: 8-frame cycles with step events on contact frames.
const atlas = {
  id: "demo",
  animations: {
    walk_fwd: { fps: 10, loop: true, frames: new Array(8).fill({ w: 256, h: 256 }), events: [{ frame: 0, type: "step" }, { frame: 4, type: "step" }] },
    run: { fps: 14, loop: true, frames: new Array(8).fill({ w: 256, h: 256 }), events: [{ frame: 1, type: "step" }, { frame: 5, type: "step" }] },
  },
};
const tracker = createFootstepTracker(audio, { atlases: { demo: atlas } });
const walker = { key: "p1", character: "demo", anim: null, frame: 0, x: 640 };
let gaitStart = 0;
document.querySelectorAll("[data-gait]").forEach((b) => {
  b.onclick = () => {
    audio.unlock();
    walker.anim = b.dataset.gait || null;
    gaitStart = performance.now();
    tracker.reset();
    document.querySelectorAll("[data-gait]").forEach((x) => x.classList.toggle("on", x === b && Boolean(walker.anim)));
  };
});

function drawFeet(now) {
  const cv = $("#feet"), c = cv.getContext("2d"), W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  const anim = walker.anim ? atlas.animations[walker.anim] : atlas.animations.walk_fwd;
  const n = anim.frames.length;
  if (walker.anim) {
    walker.frame = Math.floor(((now - gaitStart) / 1000) * anim.fps) % n;
    walker.x = 640 + Math.sin((now - gaitStart) / 900) * 500;
    tracker.update({ fighters: [walker] });
  }
  const steps = new Set(anim.events.map((e) => e.frame));
  const cw = (W - 40) / n;
  for (let i = 0; i < n; i++) {
    const x = 20 + i * cw, current = walker.anim && i === walker.frame;
    c.fillStyle = current ? "#f2b43c" : "#1d1a26";
    c.fillRect(x + 3, 30, cw - 6, 80);
    c.fillStyle = current ? "#1a1205" : "#9a91ad";
    c.font = "bold 22px system-ui";
    c.textAlign = "center";
    c.fillText(String(i), x + cw / 2, 80);
    if (steps.has(i)) { c.fillStyle = "#3fd1c0"; c.font = "22px system-ui"; c.fillText("▲", x + cw / 2, 140); }
  }
  c.fillStyle = "#9a91ad";
  c.font = "20px system-ui";
  c.textAlign = "left";
  c.fillText(walker.anim ? `${walker.anim} · ${anim.fps} fps · frame ${walker.frame}` : "idle", 20, 200);
  c.fillText(`pan x=${Math.round(walker.x)}`, W - 200, 200);
}

// ---- scope ----------------------------------------------------------------------------------------------
const analyser = audio.context.createAnalyser();
analyser.fftSize = 2048;
audio.output.connect(analyser);
const wave = new Uint8Array(analyser.fftSize), spec = new Uint8Array(analyser.frequencyBinCount);
function drawScope() {
  const cv = $("#scope"), c = cv.getContext("2d"), W = cv.width, H = cv.height;
  analyser.getByteTimeDomainData(wave);
  analyser.getByteFrequencyData(spec);
  c.clearRect(0, 0, W, H);
  const bars = 96;
  for (let i = 0; i < bars; i++) {
    const v = spec[Math.floor((i / bars) ** 2 * spec.length * 0.6)] / 255;
    c.fillStyle = `hsla(${40 - v * 40}, 90%, 55%, ${0.25 + v * 0.6})`;
    c.fillRect(i * (W / bars), H - v * H, W / bars - 2, v * H);
  }
  c.strokeStyle = "#3fd1c0";
  c.lineWidth = 2;
  c.beginPath();
  for (let i = 0; i < wave.length; i += 2) {
    const x = (i / wave.length) * W, y = (wave[i] / 255) * H;
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.stroke();
}

function frame(now) {
  drawFeet(now);
  drawScope();
  nowPlaying();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
