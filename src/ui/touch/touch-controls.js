/**
 * On-screen fight controls for phones and tablets: a floating or fixed 8-way stick, face buttons
 * (LP HP LK HK, Block, Throw, Tag) and an optional simple-special button. The layer lives on
 * `document.body`, outside the 16:9 game box, so controls can use the letterbox bars on wide phones.
 *
 * Input reaches the engine through `game.addInputSource(fn)`: once per 60 Hz step the engine asks
 * `read(player)` for `{x, y, buttons}`. Touch state is plain data updated in pointer handlers, so a
 * press lands on the next simulation step. Geometry is cached on resize; handlers never read layout.
 */
import { BTN } from "../../combat/constants.js";
import { mirrorDir } from "../../combat/input.js";
import { h, clamp } from "../core/dom.js";
import { dirAxes, motionScript, simpleMove, stickDir } from "./motion.js";
import { hasTouch, safeInsets } from "./device.js";

const BUTTONS = [
  { id: "LP", label: "LP", mask: BTN.LP, kind: "punch", x: -2.6, y: -0.9, r: 0.5 },
  { id: "LK", label: "LK", mask: BTN.LK, kind: "kick", x: -1.4, y: -0.72, r: 0.5 },
  { id: "HP", label: "HP", mask: BTN.HP, kind: "punch", x: -2.42, y: -2.06, r: 0.5 },
  { id: "HK", label: "HK", mask: BTN.HK, kind: "kick", x: -1.2, y: -1.88, r: 0.5 },
  { id: "BLOCK", label: "Block", mask: BTN.BLOCK, kind: "block", x: -3.76, y: -0.78, r: 0.47 },
  { id: "THROW", label: "Throw", mask: BTN.LP | BTN.LK, kind: "throw", x: -3.62, y: -1.92, r: 0.38 },
  { id: "TAG", label: "Tag", mask: BTN.TAG, kind: "tag", x: -0.42, y: -2.86, r: 0.4, only: "tag" },
  { id: "SP", label: "SP", mask: 0, kind: "special", x: -2.05, y: -3.12, r: 0.44, only: "simple" },
];
const ATTACK_MASK = BTN.LP | BTN.HP | BTN.LK | BTN.HK;
const MIN_RADIUS = 22;
const LATENCY_SAMPLES = 40;

export function createTouchControls(ui) {
  const S = ui.settings;
  const layer = h("div", { class: "fs-touch", hidden: true, "aria-hidden": "true" });
  const pauseBtn = h("button", { class: "fs-touch__pause", type: "button", "aria-label": "Pause" }, h("i"), h("i"));
  const toolbar = h("div", { class: "fs-touch__toolbar", hidden: true });
  layer.append(pauseBtn, toolbar);
  document.body.append(layer);

  const sets = [makeSet(0), makeSet(1)];
  const pointers = new Map();
  const stats = { latency: [], presses: 0 };
  let active = 0;
  let visible = false;
  let fight = false;
  let overlay = false;
  let edit = false;
  let device = hasTouch() ? "touch" : "keyboard";
  let geo = { W: 0, H: 0 };
  let padRaf = 0;
  let drag = null;
  let primary = 0;

  function makeSet(player) {
    const dirEl = h("div", { class: "fs-touch__dir" });
    const knob = h("div", { class: "fs-touch__knob" });
    const ring = h("div", { class: "fs-touch__ring" }, dirEl, h("span", { class: "fs-touch__ticks" }));
    const stick = h("div", { class: "fs-touch__stick" }, ring, knob);
    const btnEls = BUTTONS.map((b) => h("div", { class: `fs-touch__btn is-${b.kind}`, dataset: { id: b.id } }, h("span", { class: "fs-touch__label" }, b.label), b.id === "SP" ? h("small", { class: "fs-touch__move" }) : null));
    const el = h("div", { class: "fs-touch__set", dataset: { player: String(player) } }, stick, ...btnEls);
    layer.append(el);
    return {
      player, el, stick, knob, dirEl, btnEls, dir: 5, buttons: 0, script: [], pressAt: 0,
      stickPointer: null, center: { x: 0, y: 0 }, home: { x: 0, y: 0 }, R: 60, buttonsGeo: [], zone: null, simpleName: "",
    };
  }

  // Layout ------------------------------------------------------------------------------------

  function humans() {
    const sides = ui.session.sides || [];
    if (!sides.length) return [0];
    return sides.filter((s) => s.control === "human" && Number.isInteger(s.player)).map((s) => s.player);
  }

  const playerOf = (set) => (active === 2 ? set.player : primary);

  function sideOf(player) {
    const i = (ui.session.sides || []).findIndex((s) => s.player === player);
    return i >= 0 ? i : player;
  }

  function isTagMode() { return (ui.game.state?.mode || ui.session.mode) === "2v2"; }

  function layout(draft = null) {
    const vv = window.visualViewport;
    const W = Math.round(vv?.width || window.innerWidth);
    const H = Math.round(vv?.height || window.innerHeight);
    const ins = safeInsets();
    const t = S.get().touch;
    const players = humans();
    primary = players[0] ?? 0;
    const split = !edit && t.twoPlayer && players.includes(0) && players.includes(1);
    active = split ? 2 : 1;
    geo = { W, H, split };
    const portrait = H > W;
    const unit = clamp(Math.min(W, H) * (portrait ? 0.13 : 0.165), 46, 80) * clamp(t.size, 0.6, 1.6) * (split ? 0.82 : 1);
    sets.forEach((set, i) => {
      const on = i < active;
      set.el.hidden = !on;
      if (!on) return;
      const x0 = split ? (i === 0 ? 0 : W / 2) : 0;
      const x1 = split ? (i === 0 ? W / 2 : W) : W;
      const mirrored = !split && t.leftHanded;
      const m = Math.max(10, unit * 0.22);
      const left = x0 + (x0 === 0 ? ins.left : 0) + m;
      const right = x1 - (x1 === W ? ins.right : 0) - m;
      const bottom = H - ins.bottom - m;
      const R = unit * 1.02;
      const off = split ? { stick: { x: 0, y: 0 }, buttons: { x: 0, y: 0 } } : draft || t.layout;
      const flip = mirrored ? -1 : 1;
      let sx = mirrored ? right - R * 1.25 : left + R * 1.25;
      let sy = bottom - R * 1.25 - (portrait ? unit * 0.6 : 0);
      sx = clamp(sx + flip * off.stick.x * W, x0 + R, x1 - R);
      sy = clamp(sy + off.stick.y * H, R, H - R);
      let cx = mirrored ? left : right;
      let cy = bottom - (portrait ? unit * 0.4 : 0);
      cx += flip * off.buttons.x * W;
      cy += off.buttons.y * H;
      const tag = edit || isTagMode();
      const simple = edit || t.simple;
      set.R = R;
      set.home = { x: sx, y: sy };
      set.center = { ...set.home };
      set.buttonsGeo = BUTTONS.map((b, k) => {
        const shown = !b.only || (b.only === "tag" ? tag : simple);
        const r = Math.max(MIN_RADIUS, b.r * unit);
        const g = { ...b, k, shown, cx: cx + (mirrored ? -b.x : b.x) * unit, cy: cy + b.y * unit, r };
        const el = set.btnEls[k];
        el.hidden = !shown;
        el.style.width = el.style.height = `${r * 2}px`;
        el.style.left = `${g.cx - r}px`;
        el.style.top = `${g.cy - r}px`;
        return g;
      });
      const xs = set.buttonsGeo.filter((g) => g.shown).map((g) => (mirrored ? g.cx + g.r : g.cx - g.r));
      const edge = mirrored ? Math.max(...xs) : Math.min(...xs);
      set.zone = mirrored ? { x0: Math.max(edge + 8, x0 + (x1 - x0) * 0.5), x1 } : { x0, x1: Math.min(edge - 8, x0 + (x1 - x0) * 0.5) };
      set.stick.style.width = set.stick.style.height = `${R * 2}px`;
      set.knob.style.width = set.knob.style.height = `${R * 0.9}px`;
      placeStick(set);
    });
    const box = ui.root.parentElement?.getBoundingClientRect?.();
    const scale = box ? box.width / 1280 : 1;
    const ps = Math.max(44, 64 * scale);
    pauseBtn.style.width = pauseBtn.style.height = `${ps}px`;
    const py = box ? box.top + 148 * scale : 8;
    pauseBtn.style.transform = `translate3d(${(box ? box.left + box.width / 2 : W / 2) - ps / 2}px, ${py}px, 0)`;
    layer.style.setProperty("--fs-touch-opacity", String(clamp(t.opacity, 0.15, 1)));
    layer.classList.toggle("is-split", split);
    layer.classList.toggle("is-portrait", portrait);
  }

  function placeStick(set) {
    set.stick.style.transform = `translate3d(${set.center.x - set.R}px, ${set.center.y - set.R}px, 0)`;
    set.stick.classList.toggle("is-held", set.stickPointer != null);
    renderKnob(set, 0, 0);
  }

  function renderKnob(set, dx, dy) {
    const k = set.R * 0.45;
    set.knob.style.transform = `translate3d(${set.R - k + dx}px, ${set.R - k + dy}px, 0)`;
    const d = set.dir;
    set.dirEl.classList.toggle("is-on", d !== 5);
    if (d !== 5) {
      const [x, y] = dirAxes(d);
      set.dirEl.style.transform = `rotate(${Math.atan2(-y, x)}rad)`;
    }
  }

  // Input state -------------------------------------------------------------------------------

  function setFor(x) {
    if (active === 2) return x < geo.W / 2 ? sets[0] : sets[1];
    return sets[0];
  }

  function hitButton(set, x, y, slop = 1.3) {
    let best = null;
    let bestD = Infinity;
    for (const g of set.buttonsGeo) {
      if (!g.shown) continue;
      const d = Math.hypot(x - g.cx, y - g.cy);
      if (d < g.r * slop && d < bestD) { best = g; bestD = d; }
    }
    return best;
  }

  function inStickZone(set, x) { return set.zone && x >= set.zone.x0 && x <= set.zone.x1; }

  function recompute(set) {
    let mask = 0;
    const down = new Set();
    for (const p of pointers.values()) {
      if (p.set !== set || p.kind !== "btn" || !p.btn) continue;
      mask |= p.btn.mask;
      down.add(p.btn.k);
    }
    const pressed = mask & ~set.buttons;
    set.buttons = mask;
    set.btnEls.forEach((el, k) => el.classList.toggle("is-down", down.has(k)));
    return pressed;
  }

  function onPress(set, btn, pressed) {
    stats.presses++;
    const t = S.get().touch;
    if (t.haptics) navigator.vibrate?.(btn.id === "SP" ? 14 : 8);
    if (pressed & ATTACK_MASK) set.pressAt = performance.now();
    if (btn.id === "SP") startSimple(set);
  }

  function activeFighter(set) {
    const state = ui.game.state;
    const side = sideOf(playerOf(set));
    const s = state?.sides?.[side];
    if (!s) return null;
    const id = s.members?.[s.active ?? 0]?.id ?? s.fighters?.[s.active ?? 0]?.id;
    const f = state.fighters?.find((x) => x.side === side && x.id === id) || state.fighters?.find((x) => x.side === side);
    return f ? { id, facing: f.facing || (side === 0 ? 1 : -1) } : null;
  }

  function simpleFor(set) {
    const f = activeFighter(set);
    if (!f) return null;
    const rel = f.facing < 0 ? mirrorDir(set.dir) : set.dir;
    return { move: simpleMove(ui.fighter(f.id), rel), facing: f.facing };
  }

  function startSimple(set) {
    const pick = simpleFor(set);
    if (!pick?.move?.input) return;
    try {
      set.script = motionScript(pick.move.input, pick.facing);
      set.pressAt = performance.now();
    } catch (error) {
      console.warn("[touch] cannot script", pick.move.input, error);
    }
  }

  function updateSimpleLabel(set) {
    if (!S.get().touch.simple || !fight) return;
    const name = simpleFor(set)?.move?.name || "";
    if (name !== set.simpleName) {
      set.simpleName = name;
      const el = set.btnEls[BUTTONS.findIndex((b) => b.id === "SP")].querySelector(".fs-touch__move");
      el.textContent = name;
    }
  }

  function moveStick(set, x, y) {
    let dx = x - set.center.x;
    let dy = y - set.center.y;
    const dist = Math.hypot(dx, dy);
    const follow = set.R * 1.45;
    if (S.get().touch.stick === "floating" && dist > follow) {
      const k = (dist - follow) / dist;
      set.center.x += dx * k;
      set.center.y += dy * k;
      dx = x - set.center.x;
      dy = y - set.center.y;
      set.stick.style.transform = `translate3d(${set.center.x - set.R}px, ${set.center.y - set.R}px, 0)`;
    }
    const prev = set.dir;
    set.dir = stickDir(dx, dy, set.R);
    const d = Math.hypot(dx, dy);
    const lim = set.R * 0.62;
    const s = d > lim ? lim / d : 1;
    renderKnob(set, dx * s, dy * s);
    if (prev !== set.dir) updateSimpleLabel(set);
  }

  function release(id) {
    const p = pointers.get(id);
    if (!p) return;
    pointers.delete(id);
    if (p.kind === "stick") {
      p.set.stickPointer = null;
      p.set.dir = 5;
      if (S.get().touch.stick === "floating") p.set.center = { ...p.set.home };
      placeStick(p.set);
      updateSimpleLabel(p.set);
    } else if (p.kind === "btn") recompute(p.set);
  }

  function releaseAll() {
    for (const id of [...pointers.keys()]) release(id);
    drag = null;
    for (const set of sets) {
      set.buttons = 0;
      set.dir = 5;
      set.script = [];
      set.btnEls.forEach((el) => el.classList.remove("is-down"));
    }
  }

  function onDown(e) {
    if (e.target.closest(".fs-touch__toolbar, .fs-touch__pause")) return;
    e.preventDefault();
    try { layer.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    const x = e.clientX;
    const y = e.clientY;
    const set = setFor(x);
    if (edit) return startDrag(e, set, x, y);
    const btn = hitButton(set, x, y);
    if (btn) {
      pointers.set(e.pointerId, { set, kind: "btn", btn });
      const pressed = recompute(set);
      onPress(set, btn, pressed);
      return;
    }
    if (inStickZone(set, x) && set.stickPointer == null) {
      set.stickPointer = e.pointerId;
      pointers.set(e.pointerId, { set, kind: "stick" });
      if (S.get().touch.stick === "floating") {
        set.center = { x: clamp(x, set.R * 0.6, geo.W - set.R * 0.6), y: clamp(y, set.R * 0.6, geo.H - set.R * 0.6) };
      }
      placeStick(set);
      moveStick(set, x, y);
    }
  }

  function onMove(e) {
    if (drag && drag.id === e.pointerId) return moveDrag(e);
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const events = e.getCoalescedEvents?.() || [];
    const last = events.length ? events[events.length - 1] : e;
    if (p.kind === "stick") return moveStick(p.set, last.clientX, last.clientY);
    const btn = hitButton(p.set, last.clientX, last.clientY, 1.15);
    if (btn?.k === p.btn?.k) return;
    p.btn = btn;
    const pressed = recompute(p.set);
    if (btn && pressed) onPress(p.set, btn, pressed);
  }

  function onUp(e) {
    if (drag && drag.id === e.pointerId) return endDrag();
    release(e.pointerId);
  }

  layer.addEventListener("pointerdown", onDown);
  layer.addEventListener("pointermove", onMove);
  layer.addEventListener("pointerup", onUp);
  layer.addEventListener("pointercancel", onUp);
  layer.addEventListener("lostpointercapture", (e) => { if (pointers.has(e.pointerId)) release(e.pointerId); });
  // iOS can drop pointerup during system gestures; an empty touch list means no finger is down.
  const onTouchEnd = (e) => { if (e.touches.length === 0 && (pointers.size || drag)) releaseAll(); };
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("touchcancel", onTouchEnd, { passive: true });
  // Stops double-tap zoom, the callout menu and text selection on long presses.
  layer.addEventListener("touchstart", (e) => { if (e.cancelable && !e.target.closest(".fs-touch__toolbar, .fs-touch__pause")) e.preventDefault(); }, { passive: false });
  layer.addEventListener("contextmenu", (e) => e.preventDefault());
  const onHide = () => releaseAll();
  window.addEventListener("blur", onHide);
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", () => { if (document.hidden) releaseAll(); });

  pauseBtn.addEventListener("click", () => {
    if (!visible || edit) return;
    releaseAll();
    ui.input.inject("start", 0, "touch");
  });

  // Device switching: a trusted key or a pad press hides the controls, a touch brings them back.
  window.addEventListener("keydown", (e) => {
    if (!e.isTrusted || e.repeat || edit) return;
    setDevice("keyboard");
  }, true);
  window.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch") setDevice("touch");
  }, true);

  function setDevice(next) {
    if (device === next) return;
    device = next;
    if (next === "touch") ui.input.setDevice?.("touch");
    refresh();
  }

  function pollPads() {
    padRaf = visible ? requestAnimationFrame(pollPads) : 0;
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    for (const pad of pads) {
      if (pad.buttons.some((b) => b.pressed) || pad.axes.some((a) => Math.abs(a) > 0.6)) {
        setDevice("gamepad");
        return;
      }
    }
    for (const set of sets.slice(0, active)) updateSimpleLabel(set);
  }

  // Engine bridge -----------------------------------------------------------------------------

  function read(player) {
    if (!visible || edit) return null;
    const set = active === 2 ? sets[player] : player === primary ? sets[0] : null;
    if (!set) return null;
    if (set.script.length) {
      const f = set.script.shift();
      const [x, y] = dirAxes(f.dir);
      return { x, y, buttons: f.buttons | (set.buttons & BTN.BLOCK) };
    }
    const [x, y] = dirAxes(set.dir);
    return { x, y, buttons: set.buttons };
  }

  const removeSource = ui.game.addInputSource?.(read) || (() => {});

  const on = (type, fn) => {
    const off = ui.game.events?.on?.(type, fn);
    return typeof off === "function" ? off : () => {};
  };
  const touchSide = (side) => visible && sets.slice(0, active).some((set) => sideOf(playerOf(set)) === side);
  const offs = [
    on("attack", (e) => noteLatency(e.side)),
    on("special", (e) => noteLatency(e.side)),
    on("super", (e) => noteLatency(e.side)),
    on("hit", (e) => {
      if (!S.get().touch.haptics || !navigator.vibrate) return;
      if (touchSide(e.side) && (e.kind === "special" || e.kind === "super" || e.weight === "heavy")) navigator.vibrate(12);
      else if (touchSide(1 - e.side) && e.kind === "super") navigator.vibrate(30);
    }),
    on("ko", (e) => { if (S.get().touch.haptics && (touchSide(e.side) || touchSide(1 - e.side))) navigator.vibrate?.([25, 40, 25]); }),
    on("pause", () => releaseAll()),
  ];

  function noteLatency(side) {
    for (const set of sets.slice(0, active)) {
      if (!set.pressAt || sideOf(playerOf(set)) !== side) continue;
      stats.latency.push(performance.now() - set.pressAt);
      if (stats.latency.length > LATENCY_SAMPLES) stats.latency.shift();
      set.pressAt = 0;
    }
  }

  // Visibility --------------------------------------------------------------------------------

  function enabled() {
    const mode = S.get().touch.mode;
    if (mode === "off") return false;
    if (mode === "on") return true;
    return device === "touch" && hasTouch();
  }

  function refresh() {
    const show = edit || (fight && !overlay && enabled() && humans().length > 0);
    if (show !== visible) {
      visible = show;
      layer.hidden = !show;
      if (!show) releaseAll();
      if (show && !padRaf) padRaf = requestAnimationFrame(pollPads);
    }
    ui.root.classList.toggle("is-touch-play", show && !edit);
    if (show) layout();
  }

  const onResize = () => { if (visible) layout(); };
  window.addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("resize", onResize);
  S.subscribe((_, path) => { if (!path || path === "*" || path.startsWith("touch")) refresh(); });

  // Layout editor -----------------------------------------------------------------------------

  function startDrag(e, set, x, y) {
    if (set !== sets[0]) return;
    const btn = hitButton(set, x, y);
    const onStick = Math.hypot(x - set.center.x, y - set.center.y) < set.R * 1.3;
    if (!btn && !onStick) return;
    const t = S.get().touch;
    drag = { id: e.pointerId, part: btn ? "buttons" : "stick", x, y, start: { ...t.layout[btn ? "buttons" : "stick"] } };
    layer.classList.add("is-dragging");
  }

  function moveDrag(e) {
    const t = S.get().touch;
    const flip = t.leftHanded ? -1 : 1;
    const next = {
      x: clamp(drag.start.x + (flip * (e.clientX - drag.x)) / geo.W, -0.6, 0.6),
      y: clamp(drag.start.y + (e.clientY - drag.y) / geo.H, -0.6, 0.1),
    };
    drag.draft = { ...structuredClone(t.layout), [drag.part]: next };
    layout(drag.draft);
  }

  function endDrag() {
    layer.classList.remove("is-dragging");
    if (drag?.draft) S.set("touch.layout", drag.draft);
    drag = null;
  }

  function renderToolbar() {
    const t = S.get().touch;
    const btn = (label, fn, cls = "") => {
      const b = h("button", { class: `fs-touch__tool ${cls}`, type: "button" }, label);
      b.addEventListener("click", (ev) => { ev.stopPropagation(); fn(); renderToolbar(); });
      return b;
    };
    toolbar.replaceChildren(
      h("span", { class: "fs-touch__tool-note" }, "Drag the stick or the buttons"),
      h("span", { class: "fs-touch__tool-group" }, h("b", null, "Size"), btn("−", () => S.set("touch.size", Math.round(clamp(t.size - 0.1, 0.6, 1.6) * 10) / 10)), h("output", null, `${Math.round(t.size * 100)}%`), btn("+", () => S.set("touch.size", Math.round(clamp(t.size + 0.1, 0.6, 1.6) * 10) / 10))),
      h("span", { class: "fs-touch__tool-group" }, h("b", null, "Opacity"), btn("−", () => S.set("touch.opacity", Math.round(clamp(t.opacity - 0.1, 0.2, 1) * 10) / 10)), h("output", null, `${Math.round(t.opacity * 100)}%`), btn("+", () => S.set("touch.opacity", Math.round(clamp(t.opacity + 0.1, 0.2, 1) * 10) / 10))),
      btn(t.leftHanded ? "Left-handed" : "Right-handed", () => S.set("touch.leftHanded", !t.leftHanded)),
      btn("Reset", () => S.set("touch.layout", { stick: { x: 0, y: 0 }, buttons: { x: 0, y: 0 } })),
      btn("Done", () => closeEditor(), "is-primary"));
  }

  let editorDone = null;
  function openEditor() {
    edit = true;
    toolbar.hidden = false;
    pauseBtn.hidden = true;
    layer.classList.add("is-editing");
    renderToolbar();
    refresh();
    return new Promise((resolve) => { editorDone = resolve; });
  }

  function closeEditor() {
    edit = false;
    toolbar.hidden = true;
    pauseBtn.hidden = false;
    layer.classList.remove("is-editing");
    refresh();
    editorDone?.();
    editorDone = null;
  }

  return {
    el: layer,
    read,
    stats,
    get visible() { return visible; },
    get device() { return device; },
    setFight(on) { fight = on; refresh(); },
    setOverlay(on) { overlay = on; refresh(); },
    refresh,
    releaseAll,
    openEditor,
    closeEditor,
    /** Test hook: geometry of the visible controls in CSS px. */
    geometry() {
      return sets.slice(0, active).map((s) => ({ player: s.player, stick: { ...s.center, R: s.R }, zone: s.zone, buttons: s.buttonsGeo.filter((g) => g.shown).map(({ id, cx, cy, r }) => ({ id, cx, cy, r })) }));
    },
    destroy() {
      offs.forEach((off) => off());
      removeSource();
      cancelAnimationFrame(padRaf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      layer.remove();
    },
  };
}
