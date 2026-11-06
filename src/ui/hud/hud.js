/**
 * DOM fight HUD. Reads `game.state` every animation frame while visible:
 *   state.mode            "1v1" | "2v2"
 *   state.phase           "intro" | "fight" | "finish" | "roundEnd" | "matchEnd"
 *   state.timer           seconds remaining (null or Infinity for no limit)
 *   state.round, state.roundsToWin
 *   state.sides[i]        { label, control, roundWins, meter, meterMax, meterSegments?, active,
 *                           combo: { hits, damage }, tagReady?, assistReady?, runway?, runwayMax?,
 *                           fighters: [{ id, name, lab, health, maxHealth, recoverable }] }
 * `recoverable` is the upper bound of red recoverable health (>= health).
 * Event-driven pieces (announcer, callouts, shakes) come through `onEvent(type, payload)`.
 */
import { h, pulseClass, clamp } from "../core/dom.js";
import { portraitImg, sigilUrl, uiAsset } from "../core/assets.js";
import { fighterAccent, shortName } from "../data/labs.js";

const TRAIL_HOLD = 0.45;

export function createHud(rootEl, ui) {
  const el = h("div", { class: "fs-hud", "aria-hidden": "true" });
  const top = h("div", { class: "fs-hud__top" });
  const timerEl = h("div", { class: "fs-hud-timer" },
    h("img", { class: "fs-hud-timer__frame", src: uiAsset("frames/timer-medallion.png"), alt: "" }),
    h("span", { class: "fs-hud-timer__value" }, "99"),
    h("span", { class: "fs-hud-timer__round" }, "Round 1"));
  const sides = [makeSide(0), makeSide(1)];
  top.append(sides[0].el, timerEl, sides[1].el);

  const bottom = h("div", { class: "fs-hud__bottom" }, sides[0].meter.el, sides[1].meter.el);
  const announcer = h("div", { class: "fs-announcer" });
  const superBand = h("div", { class: "fs-super-band" });
  el.append(top, sides[0].combo.el, sides[1].combo.el, sides[0].callout, sides[1].callout, superBand, bottom, announcer);
  rootEl.append(el);

  let raf = 0;
  let visible = false;
  let lastT = 0;
  let mode = null;
  const queue = [];
  let announcing = false;

  function makeSide(i) {
    const cls = i === 0 ? "is-p1" : "is-p2";
    const portrait = h("div", { class: "fs-hud-portrait" });
    const tag = h("span", { class: "fs-hud-portrait__tag" }, i === 0 ? "P1" : "P2");
    const bar = makeBar("fs-hp");
    const sigil = h("img", { class: "fs-hud-name__sigil", alt: "" });
    const name = h("span", { class: "fs-hud-name__text" });
    const pips = h("span", { class: "fs-hud-pips" });
    const partner = h("div", { class: "fs-hud-partner" });
    const partnerPortrait = h("div", { class: "fs-hud-partner__portrait" });
    const partnerBar = makeBar("fs-hp fs-hp--mini");
    const tagChip = h("span", { class: "fs-hud-partner__chip" }, "TAG");
    partner.append(partnerPortrait, h("div", { class: "fs-hud-partner__body" }, h("span", { class: "fs-hud-partner__name" }), partnerBar.el), tagChip);
    const sideEl = h("div", { class: `fs-hud-side ${cls}` },
      h("div", { class: "fs-hud-side__portrait-wrap" }, portrait, tag),
      h("div", { class: "fs-hud-side__main" },
        bar.el,
        h("div", { class: "fs-hud-name" }, sigil, name, pips),
        partner));

    const meterSegs = h("div", { class: "fs-meter__segs" });
    const meterLevel = h("span", { class: "fs-meter__level" }, "0");
    const runway = h("div", { class: "fs-runway", hidden: true }, h("span", { class: "fs-runway__label" }, "Runway"), h("span", { class: "fs-runway__segs" }));
    const meterEl = h("div", { class: `fs-meter ${cls}` },
      h("span", { class: "fs-meter__diamond" }, meterLevel),
      h("div", { class: "fs-meter__body" }, runway, h("span", { class: "fs-meter__label" }, "Super"), meterSegs),
      h("span", { class: "fs-meter__max" }, "MAX"));

    const comboHits = h("span", { class: "fs-combo__hits" });
    const comboDmg = h("span", { class: "fs-combo__dmg" });
    const comboEl = h("div", { class: `fs-combo ${cls}` }, h("div", { class: "fs-combo__row" }, comboHits, h("span", { class: "fs-combo__label" }, "Hits")), comboDmg);
    const callout = h("div", { class: `fs-callout ${cls}` });

    return {
      el: sideEl, portrait, tag, bar, sigil, name, pips, partner, partnerPortrait, partnerBar, tagChip,
      meter: { el: meterEl, segs: meterSegs, level: meterLevel, count: 0, prevFull: 0, runway, runwayCount: 0 },
      combo: { el: comboEl, hits: comboHits, dmg: comboDmg, last: 0, hideAt: 0 },
      callout,
      fighterKey: null, partnerKey: null, wins: -1, roundsToWin: 0,
    };
  }

  function makeBar(cls) {
    const trail = h("div", { class: "fs-hp__trail" });
    const red = h("div", { class: "fs-hp__red" });
    const fill = h("div", { class: "fs-hp__fill" });
    const el = h("div", { class: cls }, h("div", { class: "fs-hp__track" }, trail, red, fill, h("div", { class: "fs-hp__shine" })));
    return { el, trail, red, fill, trailV: 1, holdUntil: 0, lastV: 1, key: null };
  }

  function setBar(bar, f, now, dt) {
    const max = f.maxHealth || 1;
    const v = clamp(f.health / max, 0, 1);
    const r = clamp((f.recoverable ?? f.health) / max, v, 1);
    if (bar.key !== f.id) {
      bar.key = f.id;
      bar.trailV = v;
      bar.lastV = v;
    }
    if (v < bar.lastV - 1e-4) bar.holdUntil = now + TRAIL_HOLD;
    if (bar.trailV < v) bar.trailV = v;
    else if (now > bar.holdUntil) bar.trailV = Math.max(v, bar.trailV - dt * 0.9);
    bar.lastV = v;
    bar.fill.style.transform = `scaleX(${v})`;
    bar.red.style.transform = `scaleX(${r})`;
    bar.trail.style.transform = `scaleX(${Math.max(bar.trailV, v)})`;
    bar.el.classList.toggle("is-low", v > 0 && v <= 0.25);
    bar.el.classList.toggle("is-empty", v <= 0);
  }

  function setPortrait(container, fighter) {
    container.replaceChildren(portraitImg(fighter, "fs-hud-portrait__img", { alt: "" }));
    container.style.setProperty("--lab", fighterAccent(fighter));
  }

  function renderSide(s, side, i, now, dt, state) {
    const fighters = side.fighters || [];
    const activeIdx = side.active ?? 0;
    const f = fighters[activeIdx];
    if (!f) return;
    const data = ui.fighter(f.id) || f;
    if (s.fighterKey !== f.id) {
      s.fighterKey = f.id;
      setPortrait(s.portrait, { ...data, ...f });
      s.name.textContent = f.name || data.name;
      s.sigil.src = sigilUrl(f.lab || data.lab);
      pulseClass(s.portrait, "is-swapped");
    }
    s.tag.textContent = side.label || (side.control === "cpu" ? "CPU" : `P${i + 1}`);
    setBar(s.bar, f, now, dt);

    const partnerIdx = fighters.findIndex((_, idx) => idx !== activeIdx);
    const p = fighters[partnerIdx];
    s.partner.hidden = !p;
    if (p) {
      if (s.partnerKey !== p.id) {
        s.partnerKey = p.id;
        const pdata = ui.fighter(p.id) || p;
        setPortrait(s.partnerPortrait, { ...pdata, ...p });
        s.partner.querySelector(".fs-hud-partner__name").textContent = shortName({ ...pdata, ...p });
      }
      setBar(s.partnerBar, p, now, dt);
      s.partner.classList.toggle("is-out", p.health <= 0);
      s.tagChip.classList.toggle("is-ready", !!side.tagReady && p.health > 0);
      s.tagChip.textContent = p.health <= 0 ? "OUT" : side.tagReady ? "TAG" : "WAIT";
    }

    const rtw = state.roundsToWin || 2;
    if (s.wins !== side.roundWins || s.roundsToWin !== rtw) {
      const gained = side.roundWins > s.wins && s.wins >= 0;
      s.wins = side.roundWins;
      s.roundsToWin = rtw;
      s.pips.replaceChildren(...Array.from({ length: rtw }, (_, k) => h("i", { class: k < side.roundWins ? "is-won" : "" })));
      if (gained) pulseClass(s.pips, "is-gained");
    }

    renderMeter(s.meter, side);
    renderCombo(s.combo, side, now, f);
  }

  function renderMeter(m, side) {
    const max = side.meterMax || 300;
    const segs = side.meterSegments || Math.max(1, Math.round(max / 100));
    if (m.count !== segs) {
      m.count = segs;
      m.segs.replaceChildren(...Array.from({ length: segs }, () => h("span", { class: "fs-meter__seg" }, h("i"))));
    }
    const per = max / segs;
    const value = clamp(side.meter || 0, 0, max);
    const full = Math.floor(value / per + 1e-6);
    [...m.segs.children].forEach((seg, k) => {
      const t = clamp((value - k * per) / per, 0, 1);
      seg.firstChild.style.transform = `scaleX(${t})`;
      seg.classList.toggle("is-full", t >= 1);
    });
    m.level.textContent = String(full);
    m.el.classList.toggle("is-max", value >= max);
    if (full > m.prevFull) pulseClass(m.el, "is-level-up");
    m.prevFull = full;
    renderRunway(m, side);
  }

  // Optional defensive stamina (side.runway / side.runwayMax, two segments by default).
  function renderRunway(m, side) {
    const has = Number.isFinite(side.runway);
    m.runway.hidden = !has;
    if (!has) return;
    const max = side.runwayMax || 200;
    const segs = side.runwaySegments || 2;
    const box = m.runway.lastChild;
    if (m.runwayCount !== segs) {
      m.runwayCount = segs;
      box.replaceChildren(...Array.from({ length: segs }, () => h("span", { class: "fs-runway__seg" }, h("i"))));
    }
    const per = max / segs;
    [...box.children].forEach((seg, k) => {
      const t = clamp((side.runway - k * per) / per, 0, 1);
      seg.firstChild.style.transform = `scaleX(${t})`;
      seg.classList.toggle("is-full", t >= 1);
    });
  }

  function renderCombo(c, side, now, target) {
    const hits = side.combo?.hits || 0;
    const dmg = Math.round(side.combo?.damage || 0);
    if (hits >= 2) {
      if (hits !== c.last) {
        c.hits.textContent = hits;
        pulseClass(c.el, "is-pop");
      }
      const def = ui.game.state?.sides?.[side === ui.game.state.sides[0] ? 1 : 0];
      const victim = def?.fighters?.[def.active ?? 0];
      const pct = victim?.maxHealth ? Math.round((dmg / victim.maxHealth) * 100) : null;
      c.dmg.textContent = pct != null ? `${dmg} DMG · ${pct}%` : `${dmg} DMG`;
      c.el.classList.add("is-visible");
      c.el.classList.remove("is-ending");
      c.hideAt = now + 1.1;
    } else if (c.el.classList.contains("is-visible") && now > c.hideAt) {
      c.el.classList.remove("is-visible");
    } else if (c.last >= 2 && hits < 2) {
      c.el.classList.add("is-ending");
    }
    c.last = hits;
  }

  function renderTimer(state) {
    const t = state.timer;
    const val = timerEl.querySelector(".fs-hud-timer__value");
    const text = t == null || !Number.isFinite(t) ? "∞" : String(Math.ceil(Math.max(0, t)));
    if (val.textContent !== text) {
      val.textContent = text;
      if (Number.isFinite(t) && t <= 10 && t > 0 && state.phase === "fight") {
        pulseClass(timerEl, "is-tick");
        ui.sound("tick");
      }
    }
    timerEl.classList.toggle("is-urgent", Number.isFinite(t) && t <= 10);
    timerEl.querySelector(".fs-hud-timer__round").textContent = state.round ? `Round ${state.round}` : "";
  }

  function frame(ms) {
    raf = requestAnimationFrame(frame);
    const now = ms / 1000;
    const dt = Math.min(0.1, now - (lastT || now));
    lastT = now;
    const state = ui.game.state;
    if (!state?.sides?.length) return;
    if (mode !== state.mode) {
      mode = state.mode;
      el.dataset.mode = mode;
    }
    state.sides.slice(0, 2).forEach((side, i) => renderSide(sides[i], side, i, now, dt, state));
    renderTimer(state);
  }

  // Announcer --------------------------------------------------------------------------------

  const STYLES = {
    round: { dur: 1300 }, fight: { dur: 1000, sound: "gong" }, ko: { dur: 1700, sound: "lock" },
    perfect: { dur: 1600 }, finish: { dur: 1900 }, time: { dur: 1400 }, win: { dur: 2400 }, final: { dur: 1400 },
  };

  function announce(text, style = "round", opts = {}) {
    queue.push({ text, style, sub: opts.sub, speak: opts.speak ?? text, dur: opts.duration ?? STYLES[style]?.dur ?? 1300 });
    if (!announcing) nextAnnouncement();
  }

  function nextAnnouncement() {
    const item = queue.shift();
    if (!item) {
      announcing = false;
      return;
    }
    announcing = true;
    const node = h("div", { class: `fs-announce fs-announce--${item.style}` },
      h("span", { class: "fs-announce__text", dataset: { text: item.text } }, item.text),
      item.sub ? h("span", { class: "fs-announce__sub" }, item.sub) : null);
    announcer.replaceChildren(node);
    ui.say(item.sub ? `${item.text}. ${item.sub}` : item.text);
    if (STYLES[item.style]?.sound) ui.sound(STYLES[item.style].sound);
    ui.audio.announce(item.speak);
    if (item.style === "fight" || item.style === "ko") shake();
    setTimeout(() => {
      node.classList.add("is-out");
      setTimeout(nextAnnouncement, 180);
    }, item.dur);
  }

  function clearAnnouncer() {
    queue.length = 0;
    announcer.replaceChildren();
    announcing = false;
  }

  function shake(strength = "md") {
    if (!ui.settings.get().accessibility.screenShake) return;
    el.dataset.shake = strength;
    pulseClass(el, "is-shaking");
  }

  function callout(side, text, kind = "special") {
    const c = sides[side]?.callout;
    if (!c) return;
    c.replaceChildren(h("span", { class: `fs-callout__item is-${kind}` }, h("small", null, kind === "tag" ? "Tag In" : kind === "assist" ? "Assist" : "Special"), text));
    pulseClass(c, "is-showing");
  }

  function superCinematic(side, name, fighterId) {
    const data = ui.fighter(fighterId) || ui.game.state?.sides?.[side]?.fighters?.[0];
    superBand.replaceChildren(
      h("div", { class: `fs-super-band__inner ${side === 0 ? "is-p1" : "is-p2"}`, vars: { lab: fighterAccent(data) } },
        portraitImg(data, "fs-super-band__portrait", { alt: "" }),
        h("div", { class: "fs-super-band__text" }, h("small", null, "Super Move"), h("strong", null, name))));
    pulseClass(superBand, "is-showing");
    ui.say(`Super move: ${name}`);
  }

  function nameOf(sideIdx) {
    const side = ui.game.state?.sides?.[sideIdx];
    if (!side) return sideIdx === 0 ? "Player 1" : "Player 2";
    if (ui.game.state.mode === "2v2") {
      return side.fighters.map((f) => shortName(f)).join(" & ");
    }
    return side.fighters[side.active ?? 0]?.name || `Player ${sideIdx + 1}`;
  }

  function onEvent(type, e) {
    const state = ui.game.state;
    switch (type) {
      case "roundStart": {
        clearAnnouncer();
        const final = e.final ?? state?.sides?.every((s) => s.roundWins === (state.roundsToWin || 2) - 1);
        announce(final ? "Final Round" : `Round ${e.round ?? state?.round ?? 1}`, final ? "final" : "round");
        if (!e.waitForFight) announce("Fight!", "fight");
        break;
      }
      case "fightStart":
        break;
      case "hit":
        if (e.kind === "super" || (e.damage || 0) > 100) shake("sm");
        pulseClass(sides[e.target ?? 1]?.bar.el, "is-hit");
        break;
      case "special":
        callout(e.side ?? 0, e.name || "Special", "special");
        break;
      case "super":
        superCinematic(e.side ?? 0, e.name || "Super", e.fighter);
        break;
      case "tag": {
        const data = ui.fighter(e.to);
        callout(e.side ?? 0, data?.name || "Partner", "tag");
        break;
      }
      case "finishThem":
        announce("Finish Them!", "finish");
        break;
      case "ko":
        announce("K.O.", "ko", { speak: "K O" });
        break;
      case "roundEnd":
        if (e.reason === "time") announce("Time", "time");
        if (e.perfect) announce("Perfect", "perfect");
        break;
      case "matchEnd": {
        const w = e.winner ?? state?.winner ?? 0;
        const team = state?.mode === "2v2";
        announce(`${nameOf(w)} ${team ? "Win" : "Wins"}`, "win", { speak: `${nameOf(w)} ${team ? "win" : "wins"}` });
        break;
      }
      default:
        break;
    }
  }

  return {
    el,
    show() {
      if (visible) return;
      visible = true;
      el.classList.add("is-visible");
      sides.forEach((s) => { s.fighterKey = null; s.partnerKey = null; s.wins = -1; s.bar.key = null; s.partnerBar.key = null; });
      lastT = 0;
      raf = requestAnimationFrame(frame);
    },
    hide() {
      visible = false;
      el.classList.remove("is-visible");
      cancelAnimationFrame(raf);
      clearAnnouncer();
    },
    announce,
    clearAnnouncer,
    callout,
    superCinematic,
    shake,
    onEvent,
    destroy() {
      cancelAnimationFrame(raf);
      el.remove();
    },
  };
}
