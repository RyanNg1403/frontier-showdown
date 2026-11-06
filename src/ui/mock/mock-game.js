// Stand-in for the engine so the UI runs on its own preview page. It implements the surface the UI
// consumes (see src/ui/index.js) and plays a fake fight that emits the contract's events.
import { MOCK_ROSTER } from "./roster.js";
import { MOCK_STAGES } from "./stages.js";
import { fighterAccent } from "../data/labs.js";

const STEP = 1 / 60;
const METER_PER_SEGMENT = 100;

function createEmitter() {
  const map = new Map();
  return {
    on(type, fn) {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
      return () => map.get(type)?.delete(fn);
    },
    off(type, fn) { map.get(type)?.delete(fn); },
    emit(type, payload) { map.get(type)?.forEach((fn) => fn(payload)); map.get("*")?.forEach((fn) => fn(type, payload)); },
  };
}

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function createMockGame({ canvas = null, roster = MOCK_ROSTER, stages = MOCK_STAGES } = {}) {
  const events = createEmitter();
  const byId = new Map(roster.map((f) => [f.id, f]));
  const stageImages = new Map();
  let settings = null;
  let state = idleState();
  let config = null;
  let raf = 0;
  let last = 0;
  let acc = 0;
  let frozen = false;
  const sim = { t: 0, phaseT: 0, nextAction: 1, queue: [], comboTimer: [0, 0], lastHit: [0, 0], damageThisRound: [0, 0], x: [430, 850], anim: [{}, {}] };

  function idleState() {
    return { phase: "idle", paused: false, mode: "1v1", round: 0, roundsToWin: 2, timer: 99, timeLimit: 99, stageId: null, winner: null, sides: [] };
  }

  function makeSide(sideCfg, i) {
    const fighters = sideCfg.fighters.map((id) => {
      const data = byId.get(id) || roster[0];
      const maxHealth = data.stats.health;
      return { id: data.id, name: data.name, lab: data.lab, color: data.color, health: maxHealth, maxHealth, recoverable: maxHealth };
    });
    return {
      control: sideCfg.control, label: sideCfg.control === "cpu" ? "CPU" : `P${i + 1}`,
      roundWins: 0, meter: 0, meterMax: METER_PER_SEGMENT * 3, meterSegments: 3,
      active: 0, combo: { hits: 0, damage: 0 }, tagReady: fighters.length > 1, assistReady: fighters.length > 1, fighters,
    };
  }

  function startMatch(cfg) {
    config = cfg;
    frozen = false;
    const time = cfg.roundTime === null ? Infinity : cfg.roundTime || 99;
    state = {
      phase: "intro", paused: false, mode: cfg.mode, round: 0, roundsToWin: cfg.roundsToWin || 2,
      timer: time, timeLimit: time, stageId: cfg.stageId, winner: null,
      sides: cfg.sides.map(makeSide),
    };
    loadStageImage(cfg.stageId);
    startRound();
    start();
  }

  function startRound() {
    state.round += 1;
    state.phase = "intro";
    state.timer = state.timeLimit;
    sim.phaseT = 0;
    sim.nextAction = 0.8;
    sim.queue = [];
    sim.damageThisRound = [0, 0];
    sim.x = [430, 850];
    for (const side of state.sides) {
      side.active = 0;
      side.combo = { hits: 0, damage: 0 };
      for (const f of side.fighters) {
        f.health = f.maxHealth;
        f.recoverable = f.maxHealth;
      }
    }
    events.emit("roundStart", { round: state.round, final: state.sides.every((s) => s.roundWins === state.roundsToWin - 1) });
  }

  const active = (i) => state.sides[i].fighters[state.sides[i].active];

  function addMeter(i, amount) {
    const s = state.sides[i];
    s.meter = Math.min(s.meterMax, s.meter + amount);
  }

  function hit(att, dmg, kind = "normal", name) {
    const def = 1 - att;
    const target = active(def);
    if (target.health <= 0) return;
    const side = state.sides[att];
    const prevHealth = target.health;
    target.health = Math.max(0, target.health - dmg);
    // A share of each hit is recoverable (red) until the fighter is hit again or tags out.
    target.recoverable = Math.min(target.maxHealth, Math.max(target.health, target.recoverable - dmg * 0.55));
    side.combo.hits += 1;
    side.combo.damage += prevHealth - target.health;
    sim.comboTimer[att] = 0.7;
    sim.lastHit[def] = sim.t;
    sim.damageThisRound[def] += prevHealth - target.health;
    addMeter(att, dmg * 0.18);
    addMeter(def, dmg * 0.1);
    sim.anim[att] = { type: "attack", t: 0 };
    sim.anim[def] = { type: "hit", t: 0 };
    events.emit("hit", { attacker: att, target: def, damage: prevHealth - target.health, kind, move: name, combo: { ...side.combo } });
    if (target.health <= 0) onDepleted(att, def);
  }

  function onDepleted(att, def) {
    const s = state.sides[def];
    const partner = s.fighters.findIndex((f, i) => i !== s.active && f.health > 0);
    if (state.mode === "2v2" && partner >= 0) {
      const from = s.active;
      s.active = partner;
      events.emit("tag", { side: def, from: s.fighters[from].id, to: s.fighters[partner].id, forced: true });
      return;
    }
    sim.queue = [];
    const deciding = state.sides[att].roundWins === state.roundsToWin - 1;
    if (deciding) {
      state.phase = "finish";
      sim.phaseT = 0;
      events.emit("finishThem", { winner: att, loser: def });
    } else endRound(att, "ko");
  }

  function endRound(winner, reason) {
    state.phase = "roundEnd";
    sim.phaseT = 0;
    state.sides[winner].roundWins += 1;
    const perfect = sim.damageThisRound[winner] === 0;
    if (reason === "ko") events.emit("ko", { winner, loser: 1 - winner });
    events.emit("roundEnd", { round: state.round, winner, reason, perfect });
  }

  function cpuAction() {
    const att = Math.random() < 0.5 ? 0 : 1;
    const side = state.sides[att];
    const data = byId.get(active(att).id);
    const r = Math.random();
    if (side.meter >= side.meterMax && r < 0.5) {
      side.meter = 0;
      events.emit("super", { side: att, fighter: data.id, name: data.super.name });
      for (let i = 0; i < 4; i++) sim.queue.push({ at: sim.t + 1.1 + i * 0.18, fn: () => hit(att, i === 3 ? 140 : 55, "super", data.super.name) });
      return 2.6;
    }
    if (state.mode === "2v2" && side.tagReady && r < 0.08) {
      const from = side.active;
      const to = side.fighters.findIndex((f, i) => i !== from && f.health > 0);
      if (to >= 0) {
        side.active = to;
        side.tagReady = false;
        setTimeout(() => { side.tagReady = true; }, 6000);
        events.emit("tag", { side: att, from: side.fighters[from].id, to: side.fighters[to].id });
        return 0.8;
      }
    }
    if (r < 0.22) {
      const def = 1 - att;
      sim.anim[def] = { type: "block", t: 0 };
      addMeter(def, 4);
      events.emit("block", { attacker: att, target: def, chip: 0 });
      return rand(0.4, 0.8);
    }
    if (r < 0.42) {
      const sp = pick(data.specials);
      events.emit("special", { side: att, fighter: data.id, name: sp.name, input: sp.input });
      sim.queue.push({ at: sim.t + 0.25, fn: () => hit(att, sp.damage || 80, "special", sp.name) });
      return rand(0.9, 1.4);
    }
    const hits = 1 + Math.floor(Math.random() * 5);
    for (let i = 0; i < hits; i++) {
      const n = pick(["light_punch", "heavy_punch", "light_kick", "heavy_kick"]);
      sim.queue.push({ at: sim.t + i * 0.16, fn: () => hit(att, data.normals[n].damage * 0.8, "normal", n) });
    }
    return hits * 0.16 + rand(0.35, 0.9);
  }

  function update(dt) {
    if (state.paused || frozen || state.phase === "idle") return;
    sim.t += dt;
    sim.phaseT += dt;
    for (const a of sim.anim) if (a.type) a.t += dt;

    if (state.phase === "intro" && sim.phaseT > 2.4) {
      state.phase = "fight";
      sim.phaseT = 0;
      events.emit("fightStart", { round: state.round });
    } else if (state.phase === "fight") {
      state.timer = Math.max(0, state.timer - dt);
      sim.nextAction -= dt;
      if (sim.nextAction <= 0) sim.nextAction = cpuAction();
      if (state.timer <= 0) {
        const pct = (i) => active(i).health / active(i).maxHealth;
        endRound(pct(0) >= pct(1) ? 0 : 1, "time");
      }
    } else if (state.phase === "finish" && sim.phaseT > 2.2) {
      const winner = state.sides.findIndex((s, i) => active(1 - i).health <= 0);
      endRound(winner < 0 ? 0 : winner, "ko");
    } else if (state.phase === "roundEnd" && sim.phaseT > 3.2) {
      const champ = state.sides.findIndex((s) => s.roundWins >= state.roundsToWin);
      if (champ >= 0) {
        state.phase = "matchEnd";
        state.winner = champ;
        events.emit("matchEnd", { winner: champ });
      } else startRound();
    }

    sim.queue = sim.queue.filter((q) => {
      if (q.at > sim.t) return true;
      if (state.phase === "fight") q.fn();
      return false;
    });

    state.sides.forEach((side, i) => {
      sim.comboTimer[i] -= dt;
      if (sim.comboTimer[i] <= 0 && side.combo.hits) {
        events.emit("comboEnd", { side: i, ...side.combo });
        side.combo = { hits: 0, damage: 0 };
      }
      side.fighters.forEach((f, fi) => {
        const benched = fi !== side.active;
        const idle = sim.t - sim.lastHit[i] > 2.5;
        if (f.health > 0 && f.health < f.recoverable && (benched || idle)) f.health = Math.min(f.recoverable, f.health + dt * (benched ? 40 : 12));
      });
    });

    // Fighters drift toward each other and apart for a little life in the preview.
    const target = 160 + Math.sin(sim.t * 0.7) * 70;
    const mid = 640 + Math.sin(sim.t * 0.31) * 60;
    sim.x[0] += ((mid - target / 2) - sim.x[0]) * dt * 2;
    sim.x[1] += ((mid + target / 2) - sim.x[1]) * dt * 2;
  }

  function loadStageImage(id) {
    const st = stages.find((s) => s.id === id);
    if (!st?.preview || stageImages.has(id)) return;
    const img = new Image();
    img.src = st.preview;
    stageImages.set(id, img);
  }

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.save();
    ctx.scale(W / 1280, H / 720);
    ctx.fillStyle = "#07080c";
    ctx.fillRect(0, 0, 1280, 720);
    const img = stageImages.get(state.stageId);
    if (img?.complete && img.naturalWidth) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, 1280, 720);
      ctx.imageSmoothingEnabled = true;
    }
    const floor = ctx.createLinearGradient(0, 520, 0, 720);
    floor.addColorStop(0, "rgba(10,12,18,0.15)");
    floor.addColorStop(1, "rgba(5,6,9,0.9)");
    ctx.fillStyle = floor;
    ctx.fillRect(0, 520, 1280, 200);
    if (state.sides.length === 2) {
      drawFighter(ctx, 0, sim.x[0], 1);
      drawFighter(ctx, 1, sim.x[1], -1);
    }
    ctx.restore();
  }

  function drawFighter(ctx, i, x, facing) {
    const f = active(i);
    const color = fighterAccent(f);
    const a = sim.anim[i];
    const bob = Math.sin(sim.t * 6 + i) * 3;
    const lunge = a.type === "attack" && a.t < 0.15 ? Math.sin((a.t / 0.15) * Math.PI) * 26 : 0;
    const knock = a.type === "hit" && a.t < 0.2 ? -Math.sin((a.t / 0.2) * Math.PI) * 14 : 0;
    const ko = f.health <= 0;
    const y = 600;
    ctx.save();
    ctx.translate(x + (lunge + knock) * facing, y);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 70, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    if (ko) ctx.rotate(-facing * 1.35);
    const flash = a.type === "hit" && a.t < 0.08;
    const body = ctx.createLinearGradient(0, -230, 0, 0);
    body.addColorStop(0, flash ? "#fff" : color);
    body.addColorStop(1, flash ? "#fff" : "#151821");
    ctx.fillStyle = body;
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = 4;
    // Torso and legs
    roundRect(ctx, -34, -170 + bob, 68, 100, 22);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#151821";
    roundRect(ctx, -30, -80 + bob, 24, 80 - bob, 10); ctx.fill(); ctx.stroke();
    roundRect(ctx, 6, -80 + bob, 24, 80 - bob, 10); ctx.fill(); ctx.stroke();
    // Arms in guard
    ctx.fillStyle = flash ? "#fff" : color;
    const reach = a.type === "attack" && a.t < 0.15 ? 60 : 24;
    roundRect(ctx, 14 * facing - (facing < 0 ? reach : 0), -150 + bob, reach, 20, 10); ctx.fill(); ctx.stroke();
    // Head
    ctx.fillStyle = flash ? "#fff" : "#e9c39b";
    ctx.beginPath();
    ctx.arc(4 * facing, -198 + bob, 26, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    if (a.type === "block" && a.t < 0.3) {
      ctx.strokeStyle = "rgba(120,220,255,0.8)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(30 * facing, -130, 60, -1.2, 1.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    acc += dt;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    draw();
  }

  function start() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  return {
    events,
    get state() { return state; },
    roster,
    stages,
    getRoster: () => roster,
    getStages: () => stages,
    startMatch,
    pause() { state.paused = true; },
    resume() { state.paused = false; last = 0; },
    endMatch() { state = idleState(); config = null; sim.queue = []; },
    applySettings(next) { settings = next; },
    get config() { return config; },

    /** Preview-only: freeze the fight in a hand-made HUD state for screenshots. */
    debugPose(scene = "hud") {
      const mode = scene.includes("2v2") ? "2v2" : "1v1";
      const cfg = config || {
        mode, stageId: "openai-glass-atrium",
        sides: mode === "2v2"
          ? [{ control: "human", fighters: ["sam", "noam"] }, { control: "cpu", fighters: ["dario", "chris"] }]
          : [{ control: "human", fighters: ["sam"] }, { control: "cpu", fighters: ["dario"] }],
      };
      startMatch(cfg);
      frozen = true;
      state.phase = "fight";
      state.round = 2;
      state.timer = 47.3;
      const [a, b] = state.sides;
      a.roundWins = 1;
      a.meter = 248;
      b.meter = 300;
      const fa = a.fighters[0];
      fa.health = fa.maxHealth * 0.62; fa.recoverable = fa.maxHealth * 0.74;
      const fb = b.fighters[0];
      fb.health = fb.maxHealth * 0.24; fb.recoverable = fb.maxHealth * 0.36;
      a.combo = { hits: 7, damage: 238 };
      if (mode === "2v2") {
        const pa = a.fighters[1];
        pa.health = pa.maxHealth * 0.55; pa.recoverable = pa.maxHealth * 0.8;
        const pb = b.fighters[1];
        pb.health = pb.maxHealth * 0.9; pb.recoverable = pb.maxHealth;
        b.tagReady = false;
      }
      sim.x = [560, 760];
      sim.anim = [{ type: "attack", t: 0.05 }, { type: "hit", t: 0.12 }];
      draw();
      return state;
    },
    /** Preview-only: jump straight to the end of a match. */
    debugFinishMatch(winner = 0) {
      if (!config) this.debugPose("hud");
      frozen = true;
      state.sides[winner].roundWins = state.roundsToWin;
      state.phase = "matchEnd";
      state.winner = winner;
      events.emit("matchEnd", { winner });
    },
  };
}
