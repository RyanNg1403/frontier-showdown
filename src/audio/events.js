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
  // From matchStart: each side's control and point fighter (updated on tags).
  let controls = [];
  let points = [];
  const say = (fighter, line, o) => (fighter && audio.speak ? audio.speak(`${fighter}.${line}`, o) : null);

  // matchStart: { sides: [{ team: [fighter ids], control: "human"|"cpu" }] }
  on("matchStart", (e) => {
    controls = (e.sides ?? []).map((s) => s.control);
    points = (e.sides ?? []).map((s) => s.team?.[0] ?? null);
  });

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

  // In 2v2 a point fighter can fall while their partner still stands. The engine follows that
  // `ko` with `lastStanding` for the same side in the same tick, so the call waits a tick:
  // only a round-ending KO gets the KO impact, slow motion and one "K.O." per round. A
  // mid-round fall gets a heavy hit and body fall, and the partner's forced entry gets the tag sting.
  const fellMidRound = new Set(); // sides that just got `lastStanding`
  const awaitingEntry = new Set(); // sides whose partner is about to be forced in
  let koCalled = false;

  on("lastStanding", (e) => { if (e.side != null) fellMidRound.add(e.side); });

  // ko: { side, double?, roundOver?, slowmo?: seconds, x }
  on("ko", (e) => later(0, () => {
    const midRound = e.roundOver === false || (e.roundOver !== true && e.side != null && fellMidRound.has(e.side));
    fellMidRound.delete(e.side);
    if (midRound) {
      awaitingEntry.add(e.side);
      audio.play("hit.heavy", { ...xOf(e), pitch: -2 });
      audio.play("body.fall", { ...xOf(e), delay: 0.35 });
      return;
    }
    audio.play("ko.impact", xOf(e));
    audio.play("body.fall", { ...xOf(e), delay: 0.43 });
    if (!engineSlowmo && opts.slowmo !== false) {
      audio.setSlowMotion(true);
      later(typeof e.slowmo === "number" ? e.slowmo : opts.slowmoSeconds ?? 1.8, () => audio.setSlowMotion(false));
    }
    if (koCalled) return;
    koCalled = true;
    audio.announce(e.double ? "announcer.double-ko" : "announcer.ko", { delay: 0.3 });
  }));

  // roundStart: { round (1-based), final?, maxRounds?, announceFight? }
  on("roundStart", (e) => {
    const round = e.round ?? e.index ?? e.number ?? 1;
    if (round <= 1) {
      winnerAnnounced = false;
      audio.hush?.();
    }
    koCalled = false;
    fellMidRound.clear();
    awaitingEntry.clear();
    const final = e.final ?? e.isFinal ?? round >= (e.maxRounds ?? 3);
    const call = final ? "announcer.final-round" : round <= 1 ? "announcer.round-1" : round === 2 ? "announcer.round-2" : "ann.round3";
    audio.announce(call, { interrupt: true });
    clearTimeout(fightTimer);
    if (e.announceFight !== false) fightTimer = later(e.fightDelay ?? opts.fightDelay ?? 1.6, () => audio.announce("announcer.fight"));
    if (opts.music !== false && audio.currentMusic !== "fight") audio.music("fight", { fade: 1.5 });
  });

  // roundEnd: { winner, winnerFighter?, perfect?, reason: "ko"|"time"|"draw", draw?, matchOver?, matchWinner?, winnerLab? }
  // A round won short of the match gets the winner's taunt over the victory pose.
  on("roundEnd", (e) => {
    const reason = lower(e.reason);
    if (reason === "time" || e.timeout || e.timeUp) audio.announce("announcer.time-up", { interrupt: true });
    if (reason === "draw" || e.draw) audio.announce("announcer.draw");
    if (e.perfect) audio.announce("announcer.perfect", { gap: 0.35 });
    const matchOver = e.matchOver || e.matchWinner != null;
    if (matchOver && !winnerAnnounced) announceMatch(e, e.matchWinner ?? e.winner);
    else if (!matchOver && Number.isInteger(e.winner)) say(e.winnerFighter ?? points[e.winner], "taunt", { queue: true, delay: 0.5, gap: 0.3 });
  });

  // Single player (one human side) hears "You win!" or "You lose!", otherwise "Player one/two!";
  // then the winning fighter's win line, or the lab's recorded "Winner!" if that can't load.
  function announceMatch(e, side) {
    winnerAnnounced = true;
    const won = Number.isInteger(side);
    const fighter = won ? e.winnerFighter ?? points[side] : null;
    later(opts.winnerDelay ?? 1.4, () => {
      if (won) {
        const humans = controls.filter((c) => c === "human").length;
        const call = humans === 1 ? (controls[side] === "human" ? "announcer.you-win" : "announcer.you-lose") : `announcer.player-${side + 1}`;
        audio.announce(call);
      }
      if (!say(fighter, "win", { queue: true, gap: 0.25 }) && won) audio.announceWinner(labOf(e, side, opts), { side });
      if (opts.music !== false) audio.music("victory", { fade: 0.8 });
    });
  }

  // tag: { side, in, forced?, x }. A forced tag brings in the partner of a fallen point fighter.
  on("tag", (e) => {
    audio.play("tag.in", xOf(e));
    if (e.forced || awaitingEntry.has(e.side)) {
      awaitingEntry.delete(e.side);
      audio.play("stinger.tag", { ...xOf(e), delay: 0.08 });
    }
    const incoming = e.in ?? e.to;
    if (Number.isInteger(e.side) && typeof incoming === "string") points[e.side] = incoming;
    say(incoming, "tag-in", { channel: `${e.side}:${incoming}`, delay: 0.1 });
  });
  // special / super: { fighter, side, moveId, x }, called out at startup and at the super freeze.
  on("special", (e) => {
    audio.play("stinger.special", xOf(e));
    say(e.fighter, `special.${e.moveId}`, { channel: `${e.side}:${e.fighter}` });
  });
  on("super", (e) => {
    audio.play("stinger.super", xOf(e));
    say(e.fighter, `super.${e.moveId}`, { channel: `${e.side}:${e.fighter}` });
  });

  // ---- optional extras ------------------------------------------------------------
  on(["fight", "fightStart", "roundFight"], () => { clearTimeout(fightTimer); audio.announce("announcer.fight", { interrupt: true }); });
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

// Menu-screen voice cues, called on each UI screen change with `{ from, session }` (the UI's
// session: `sides[i].picks` are fighter ids, point fighter first). The announcer pack loads on
// the way to character select, and the picked fighters' packs on the stage screen, so the
// versus lines are ready when the portraits slide in.
let screenToken = 0;
export function screenVoice(audio, id, { from = null, session = null } = {}) {
  const token = ++screenToken;
  const picks = (session?.sides ?? []).map((s) => s?.picks ?? []);
  const current = () => token === screenToken;
  if (id === "mode") return audio.loadVoices([]);
  if (id === "select") {
    if (from === "stage") return undefined;
    return audio.loadVoices([]).then(() => { if (current()) audio.announce("announcer.choose-your-fighter", { interrupt: true }); });
  }
  if (id === "stage") return audio.loadVoices(picks.flat());
  if (id === "versus") {
    // One line per side (the point fighters), timed with their portraits sliding in.
    return audio.loadVoices(picks.flat()).then(() => {
      if (!current()) return;
      picks.forEach((team, side) => { if (team[0]) audio.speak(`${team[0]}.versus`, { queue: true, delay: side ? 0 : 0.15, gap: 0.15, channel: `versus${side}` }); });
    });
  }
  if (id !== "fight") audio.hush?.();
  return undefined;
}
