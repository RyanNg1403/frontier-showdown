// Maps `game.events` to sounds. Contract events: hit, block, ko, roundStart, roundEnd,
// tag, special, super. Optional extras the engine may emit are handled too (see EXTRA).
// Payload fields are read defensively; the ones used are listed next to each handler.
import { createFootstepTracker, soundForFrameEvent, weightFromAnim } from "./footsteps.js";

const lower = (v) => (typeof v === "string" ? v.toLowerCase() : "");

function subscribe(emitter, name, fn) {
  if (typeof emitter.on === "function") {
    const off = emitter.on(name, fn);
    if (typeof off === "function") return off;
    return () => (emitter.off ?? emitter.removeListener)?.call(emitter, name, fn);
  }
  if (typeof emitter.addEventListener === "function") {
    const h = (ev) => fn(ev?.detail ?? ev);
    emitter.addEventListener(name, h);
    return () => emitter.removeEventListener(name, h);
  }
  if (typeof emitter.subscribe === "function") return emitter.subscribe(name, fn);
  throw new Error("audio: game.events needs on/off, addEventListener or subscribe");
}

const moveOf = (e) => (e?.move && typeof e.move === "object" ? e.move : e?.attack && typeof e.attack === "object" ? e.attack : {});

// "light" | "medium" | "heavy" | "special" | "super"
export function attackWeight(e = {}) {
  const m = moveOf(e);
  const w = lower(e.weight ?? e.strength ?? e.level ?? m.weight ?? m.strength ?? m.level ?? m.kind ?? e.kind);
  const id = lower(e.moveId ?? m.id ?? m.name ?? (typeof e.move === "string" ? e.move : "") ?? e.anim);
  if (e.super || m.super || /super/.test(w) || /super/.test(id)) return "super";
  if (e.special || /special|^ex/.test(w) || /special/.test(id)) return "special";
  if (/heavy|hard|strong/.test(w) || /heavy|^h[pk]$|_h[pk]$/.test(id)) return "heavy";
  if (/medium|mid/.test(w) || /medium|^m[pk]$/.test(id)) return "medium";
  if (/light|jab|weak/.test(w) || /light|jab|^l[pk]$|_l[pk]$/.test(id)) return "light";
  const dmg = e.damage ?? m.damage;
  const max = e.maxHealth ?? e.defender?.maxHealth ?? e.target?.maxHealth;
  if (typeof dmg === "number" && typeof max === "number" && max > 0) return dmg / max >= 0.08 ? "heavy" : dmg / max >= 0.05 ? "medium" : "light";
  return "medium";
}

const isThrow = (e) => Boolean(e.throw || e.isThrow || /throw|grab/.test(lower(e.type ?? e.kind ?? moveOf(e).type ?? moveOf(e).id ?? (typeof e.move === "string" ? e.move : ""))));
const isCounter = (e) => Boolean(e.counter ?? e.counterHit ?? e.isCounter ?? e.punish);

function xOf(e) {
  const x = e?.x ?? e?.pos?.x ?? e?.position?.x ?? e?.defender?.x ?? e?.target?.x ?? e?.fighter?.x;
  return typeof x === "number" ? { x, pixels: true } : {};
}

function labOf(e, side, opts) {
  const w = side ?? e.winner ?? e.matchWinner;
  return e.winnerLab ?? e.lab ?? w?.lab ?? w?.character?.lab ?? w?.fighter?.lab ?? opts.labOf?.(w, e) ?? (typeof w === "number" ? `player${w + (opts.oneBasedSides ? 0 : 1)}` : w);
}

export function bindGameEvents(audio, game, opts = {}) {
  const emitter = game?.events ?? game;
  const offs = [];
  const timers = new Set();
  const later = (sec, fn) => { const t = setTimeout(() => { timers.delete(t); fn(); }, sec * 1000); timers.add(t); return t; };
  const on = (names, fn) => { for (const n of [].concat(names)) offs.push(subscribe(emitter, n, (e) => fn(e ?? {}, n))); };

  let fightTimer = null;
  let engineSlowmo = false;
  let engineFrameEvents = false;
  let winnerAnnounced = false;
  let tracker = null;

  const hitSound = (e) => {
    if (isThrow(e)) return audio.play("throw.slam", xOf(e));
    if (isCounter(e)) return audio.play("hit.counter", xOf(e));
    const w = attackWeight(e);
    if (w === "light") return audio.play("hit.light", xOf(e));
    if (w === "medium") return audio.play("hit.heavy", { ...xOf(e), pitch: 2.5, gainDb: -2 });
    return audio.play("hit.heavy", { ...xOf(e), gainDb: w === "heavy" ? 0 : 1.5 });
  };

  // hit: { blocked?, counter?, throw?, weight|strength|move:{weight,id,damage}, damage, maxHealth, x }
  on("hit", (e) => (e.blocked ? audio.play("hit.block", xOf(e)) : hitSound(e)));

  // block: { guardBreak?, x }
  on("block", (e) => {
    audio.play("hit.block", xOf(e));
    if (e.guardBreak) audio.play("hit.heavy", { ...xOf(e), pitch: -2 });
  });

  // ko: { double?, slowmo?: seconds, x }
  on("ko", (e) => {
    audio.play("ko.impact", xOf(e));
    later(0.18, () => audio.play("body.fall", { ...xOf(e), delay: 0.25 }));
    if (!engineSlowmo && opts.slowmo !== false) {
      audio.setSlowMotion(true);
      later(typeof e.slowmo === "number" ? e.slowmo : opts.slowmoSeconds ?? 1.8, () => audio.setSlowMotion(false));
    }
    audio.announce(e.double ? "ann.doubleko" : "ann.ko", { delay: 0.3 });
  });

  // roundStart: { round (1-based), final?, maxRounds?, announceFight? }
  on("roundStart", (e) => {
    const round = e.round ?? e.index ?? e.number ?? 1;
    if (round <= 1) winnerAnnounced = false;
    const final = e.final ?? e.isFinal ?? round >= (e.maxRounds ?? 3);
    audio.announce(final ? "ann.final" : `ann.round${Math.min(3, round)}`, { interrupt: true });
    clearTimeout(fightTimer);
    if (e.announceFight !== false) fightTimer = later(e.fightDelay ?? opts.fightDelay ?? 1.6, () => audio.announce("ann.fight"));
    if (opts.music !== false && audio.currentMusic !== "fight") audio.music("fight", { fade: 1.5 });
  });

  // roundEnd: { winner, perfect?, reason: "ko"|"time"|"draw", draw?, matchOver?, matchWinner?, winnerLab? }
  on("roundEnd", (e) => {
    const reason = lower(e.reason);
    if (reason === "time" || e.timeout || e.timeUp) audio.announce("ann.time", { interrupt: true });
    if (reason === "draw" || e.draw) audio.announce("ann.draw");
    if (e.perfect) audio.announce("ann.perfect", { gap: 0.35 });
    if ((e.matchOver || e.matchWinner != null) && !winnerAnnounced) announceMatch(e, e.matchWinner ?? e.winner);
  });

  function announceMatch(e, side) {
    winnerAnnounced = true;
    later(opts.winnerDelay ?? 1.4, () => {
      audio.announceWinner(labOf(e, side, opts));
      if (opts.music !== false) audio.music("victory", { fade: 0.8 });
    });
  }

  on("tag", (e) => audio.play("tag.in", xOf(e)));
  on("special", (e) => audio.play("stinger.special", xOf(e)));
  on("super", (e) => audio.play("stinger.super", xOf(e)));

  // ---- optional extras ------------------------------------------------------------
  on(["fight", "fightStart", "roundFight"], () => { clearTimeout(fightTimer); audio.announce("ann.fight", { interrupt: true }); });
  on(["finishThem", "finish"], () => audio.announce("ann.finish", { interrupt: true }));
  on(["matchEnd", "matchOver"], (e) => { if (!winnerAnnounced) announceMatch(e, e.winner ?? e.matchWinner); });
  on(["attack", "whiff", "swing", "attackStart"], (e) => {
    const w = attackWeight(e);
    audio.play(`whoosh.${w === "light" ? "light" : w === "medium" ? "medium" : "heavy"}`, xOf(e));
  });
  on(["throw", "throwStart", "grab"], (e) => audio.play("throw.grab", xOf(e)));
  on(["throwBreak", "throwTech"], (e) => audio.play("throw.break", xOf(e)));
  on("jump", (e) => audio.play("move.jump", xOf(e)));
  on("land", (e) => audio.play("move.land", xOf(e)));
  on("dash", (e) => audio.play("move.dash", xOf(e)));
  on("knockdown", (e) => audio.play("body.fall", { ...xOf(e), delay: 0.2 }));
  on(["step", "footstep"], (e) => audio.play(e.run || /run/.test(lower(e.anim)) ? "step.run" : "step.walk", xOf(e)));
  // animEvent: { type, anim, fighter, frame, x } forwarded from atlas frame events.
  on(["animEvent", "frameEvent"], (e) => {
    engineFrameEvents = true;
    const id = soundForFrameEvent(e.type ?? e.event, e.anim ?? e.animation);
    if (id) audio.play(id, xOf(e));
    else if (/hit|active/.test(lower(e.type))) audio.play(`whoosh.${weightFromAnim(e.anim)}`, xOf(e));
  });
  // slowmo: { active, rate } — when the engine drives slow motion, KO stops doing it.
  on(["slowmo", "slowMotion"], (e) => { engineSlowmo = true; audio.setSlowMotion(Boolean(e.active ?? e.on ?? true), { rate: e.rate ?? e.scale }); });
  on("pause", () => audio.setPaused(true));
  on(["resume", "unpause"], () => audio.setPaused(false));

  // Without engine frame events, poll game.state against atlas step frames.
  if (opts.atlases && opts.trackFootsteps !== false && game?.state !== undefined) {
    tracker = createFootstepTracker(audio, { atlases: opts.atlases });
    let raf = 0;
    const tick = () => {
      if (!engineFrameEvents) tracker.update(typeof game.state === "function" ? game.state() : game.state);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    offs.push(() => cancelAnimationFrame(raf));
  }

  return function detach() {
    offs.forEach((off) => off?.());
    timers.forEach(clearTimeout);
    timers.clear();
  };
}
