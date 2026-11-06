import { h, replace, pulseClass } from "../core/dom.js";
import { portraitImg, sigilUrl, uiAsset } from "../core/assets.js";
import { embers, hintBar, screenHeader, statBars } from "../core/widgets.js";
import { fighterAccent, labInfo, shortName } from "../data/labs.js";
import { renderInput, glyphCount } from "../data/notation.js";
import { createSpritePreview } from "./sprite-preview.js";

const ARCHETYPE_LABEL = { rushdown: "Rushdown", allround: "All-Rounder", zoner: "Zoner", grappler: "Grappler", technical: "Technical" };
const MATCHUP_LABEL = { cpu: "Versus CPU", local: "Local Versus", cpuvcpu: "CPU vs CPU" };

function moveIndex(i, action, cols, n) {
  const row = Math.floor(i / cols);
  const rows = Math.ceil(n / cols);
  if (action === "left") return i % cols === 0 ? Math.min(n - 1, i + cols - 1) : i - 1;
  if (action === "right") return i % cols === cols - 1 || i === n - 1 ? row * cols : i + 1;
  if (action === "up") {
    const j = i - cols;
    if (j >= 0) return j;
    const last = (rows - 1) * cols + (i % cols);
    return last < n ? last : last - cols;
  }
  if (action === "down") return i + cols < n ? i + cols : i % cols;
  return i;
}

export function createSelectScreen(ui) {
  const chip = h("span", { class: "fs-select__mode-chip" });
  const header = screenHeader("Choose Your Fighter");
  header.querySelector(".fs-screen__title-wrap").append(chip);
  const grid = h("div", { class: "fs-grid", role: "listbox", "aria-label": "Fighters" });
  const preview = h("section", { class: "fs-preview", "aria-label": "Move preview" });
  const panels = [makePanel(0), makePanel(1)];
  const banner = h("div", { class: "fs-select__banner", "aria-hidden": "true" }, h("span", null, "Ready"));
  const hints = hintBar(ui, []);
  const el = h("section", { class: "fs-screen fs-select fs-bg", "aria-label": "Character select" },
    embers(10),
    header,
    panels[0].el,
    h("div", { class: "fs-select__center" }, grid, preview),
    panels[1].el,
    banner,
    hints);

  const sprite = createSpritePreview();
  let tiles = [];
  let roster = [];
  let cols = 4;
  let teamSize = 1;
  let local = false;
  let current = 0;
  let previewSide = 0;
  let readyTimer = 0;
  let rouletteTimer = 0;
  let cycleTimer = 0;
  let sides = [];

  function makePanel(i) {
    const cls = i === 0 ? "is-p1" : "is-p2";
    const status = h("span", { class: "fs-sel-panel__status" });
    const who = h("span", { class: "fs-sel-panel__who" });
    const portraitSlot = h("div", { class: "fs-sel-card__portrait" });
    const stamp = h("div", { class: "fs-sel-card__stamp", "aria-hidden": "true" }, "Locked");
    const card = h("div", { class: "fs-sel-card" },
      h("div", { class: "fs-sel-card__bg" }),
      portraitSlot,
      h("img", { class: "fs-sel-card__frame", src: uiAsset("frames/portrait-frame.png"), alt: "", "aria-hidden": "true" }),
      stamp);
    const sigil = h("img", { class: "fs-sel-badge__sigil", alt: "" });
    const labName = h("span", { class: "fs-sel-badge__lab" });
    const style = h("span", { class: "fs-sel-badge__style" });
    const stars = h("span", { class: "fs-sel-badge__stars", role: "img" });
    const slots = h("div", { class: "fs-team-slots", "aria-label": "Team slots" });
    const name = h("h2", { class: "fs-sel-name__name" });
    const title = h("p", { class: "fs-sel-name__title" });
    const stats = h("div", { class: "fs-sel-panel__stats" });
    const el = h("section", { class: `fs-sel-panel ${cls}`, "aria-label": i === 0 ? "Side 1" : "Side 2" },
      h("div", { class: "fs-sel-panel__head" }, who, status),
      h("div", { class: "fs-sel-panel__top" },
        card,
        h("div", { class: "fs-sel-panel__aside" },
          h("div", { class: "fs-sel-badge" }, sigil, labName, style, stars),
          slots)),
      h("div", { class: "fs-sel-name" }, name, title),
      stats);
    return { el, status, who, portraitSlot, stamp, card, sigil, labName, style, stars, slots, name, title, stats, shownId: null };
  }

  function buildGrid() {
    roster = ui.roster;
    cols = roster.length <= 16 ? 4 : roster.length <= 25 ? 5 : 6;
    grid.style.setProperty("--cols", cols);
    tiles = roster.map((f, idx) => {
      const lab = labInfo(f.lab);
      const tile = h("button", { class: "fs-tile", type: "button", role: "option", "aria-label": `${f.name}, ${lab.name}`, vars: { lab: fighterAccent(f) } },
        h("span", { class: "fs-tile__bg" }),
        portraitImg(f, "fs-tile__img", { alt: "" }),
        h("img", { class: "fs-tile__sigil", src: sigilUrl(f.lab), alt: "" }),
        h("span", { class: "fs-tile__name" }, shortName(f)),
        h("span", { class: "fs-tile__cursor is-p1" }, h("b", null, "1P")),
        h("span", { class: "fs-tile__cursor is-p2" }, h("b", null, "2P")),
        h("span", { class: "fs-tile__picks" }));
      tile.addEventListener("pointerenter", () => {
        const s = local ? 0 : current;
        if (!sides[s] || sides[s].done) return;
        setCursor(s, idx);
      });
      tile.addEventListener("click", () => {
        const s = local ? 0 : current;
        if (!sides[s] || sides[s].done) return;
        setCursor(s, idx, false);
        pick(s, roster[idx].id);
      });
      return tile;
    });
    replace(grid, tiles);
  }

  function sideLabel(i) {
    const s = sides[i];
    if (s.control === "cpu") return "CPU";
    return local ? `Player ${i + 1}` : "Player 1";
  }

  function render() {
    tiles.forEach((tile, idx) => {
      const id = roster[idx].id;
      [0, 1].forEach((si) => {
        const s = sides[si];
        const showCursor = s && !s.done && s.cursor === idx && (local || si === current);
        tile.querySelector(`.fs-tile__cursor.is-p${si + 1}`).classList.toggle("is-on", showCursor);
      });
      tile.querySelector(".fs-tile__cursor.is-p2 b").textContent = sides[1]?.control === "cpu" ? "CPU" : "2P";
      tile.querySelector(".fs-tile__cursor.is-p1 b").textContent = sides[0]?.control === "cpu" ? "CPU" : "1P";
      const marks = [];
      sides.forEach((s, si) => s.picks.forEach((p, k) => { if (p === id) marks.push(h("i", { class: `is-p${si + 1}` }, teamSize > 1 ? String(k + 1) : "✓")); }));
      replace(tile.querySelector(".fs-tile__picks"), marks);
      tile.classList.toggle("is-picked", marks.length > 0);
    });
    sides.forEach((_, i) => renderPanel(i));
    const remaining = sides.filter((s) => !s.done).length;
    banner.classList.toggle("is-on", remaining === 0);
    hints.update([
      ["move", "Move"],
      ["confirm", teamSize > 1 ? "Pick" : "Select"],
      ["info", "Random"],
      ["back", "Back"],
    ]);
  }

  function renderPanel(i) {
    const p = panels[i];
    const s = sides[i];
    const choosing = !s.done && (local || current === i);
    const waiting = !s.done && !choosing;
    const shownId = s.done ? s.picks[0] : choosing ? roster[s.cursor]?.id : s.picks[0] || null;
    const f = shownId ? ui.fighter(shownId) : null;
    p.el.classList.toggle("is-choosing", choosing);
    p.el.classList.toggle("is-locked", s.done);
    p.el.classList.toggle("is-waiting", waiting && !f);
    p.who.textContent = sideLabel(i);
    p.status.textContent = s.done ? "Locked in" : choosing ? (teamSize > 1 ? `Pick ${s.picks.length + 1} of ${teamSize}` : "Choosing") : "Waiting";

    if (p.shownId !== shownId) {
      p.shownId = shownId;
      if (f) {
        const lab = labInfo(f.lab);
        p.el.style.setProperty("--lab", fighterAccent(f));
        replace(p.portraitSlot, portraitImg(f, "fs-sel-card__img"));
        pulseClass(p.card, "is-swapping");
        p.sigil.src = sigilUrl(f.lab);
        p.sigil.hidden = false;
        p.labName.textContent = lab.name;
        p.style.textContent = ARCHETYPE_LABEL[f.archetype] || f.archetype || "";
        p.stars.textContent = f.difficulty ? `${"★".repeat(f.difficulty)}${"☆".repeat(Math.max(0, 3 - f.difficulty))}` : "";
        p.stars.setAttribute("aria-label", f.difficulty ? `Difficulty ${f.difficulty} of 3` : "");
        p.name.textContent = f.name;
        p.title.textContent = f.title || "";
        replace(p.stats, statBars(f, ui.ranges));
      } else {
        p.el.style.removeProperty("--lab");
        replace(p.portraitSlot, h("div", { class: "fs-sel-card__unknown" }, "?"));
        p.sigil.hidden = true;
        p.labName.textContent = "";
        p.style.textContent = "";
        p.stars.textContent = "";
        p.name.textContent = s.control === "cpu" ? "CPU" : "???";
        p.title.textContent = s.control === "cpu" ? "Opponent picked next" : "Waiting for selection";
        replace(p.stats);
      }
    }
    p.stamp.classList.toggle("is-on", s.done);

    replace(p.slots, teamSize > 1 ? [
      h("span", { class: "fs-team-slots__label" }, "Team"),
      ...Array.from({ length: teamSize }, (_, k) => {
        const id = s.picks[k];
        const fd = id ? ui.fighter(id) : null;
        const next = !s.done && choosing && k === s.picks.length;
        return h("div", { class: ["fs-team-slot", fd && "is-filled", next && "is-next"], vars: fd ? { lab: fighterAccent(fd) } : null },
          fd ? portraitImg(fd, "fs-team-slot__img", { alt: fd.name }) : h("span", { class: "fs-team-slot__num" }, String(k + 1)),
          h("span", { class: "fs-team-slot__name" }, fd ? shortName(fd) : next ? "Choosing" : "Empty"));
      }),
    ] : []);
  }

  function renderPreview() {
    const s = sides[previewSide];
    const f = s && roster[s.cursor] && (!s.done ? roster[s.cursor] : ui.fighter(s.picks.at(-1)));
    if (!f) return;
    const moves = [...(f.specials || []).slice(0, 3).map((m) => ({ ...m, kind: "Special" })), f.super ? { ...f.super, kind: "Super" } : null].filter(Boolean);
    preview.style.setProperty("--lab", fighterAccent(f));
    preview.dataset.side = String(previewSide);
    const rows = moves.map((m, k) => h("li", { class: ["fs-preview__move", m.kind === "Super" && "is-super"], dataset: { k: String(k) } },
      h("span", { class: "fs-preview__kind" }, m.kind),
      h("span", { class: "fs-preview__name" }, m.name),
      h("span", { class: "fs-preview__input" }, renderInput(m.input, { size: "sm" }))));
    replace(preview,
      h("header", { class: "fs-preview__head" },
        h("span", null, "Move Preview"),
        h("strong", null, shortName(f))),
      h("div", { class: "fs-preview__body" },
        h("div", { class: "fs-preview__stage" }, sprite.mount(f)),
        h("div", { class: "fs-preview__side" },
          h("ol", { class: "fs-preview__list" }, rows))));
    startCycle(moves);
  }

  function startCycle(moves) {
    clearInterval(cycleTimer);
    let k = 0;
    let step = -4;
    const list = preview.querySelector(".fs-preview__list");
    const reduce = ui.settings.get().accessibility.reduceMotion;
    const tick = () => {
      const items = list.children;
      if (!items.length) return;
      const m = moves[k];
      const n = glyphCount(m.input);
      [...items].forEach((li, idx) => li.classList.toggle("is-playing", idx === k));
      const slot = items[k].querySelector(".fs-preview__input");
      slot.replaceChildren(renderInput(m.input, { size: "sm", activeIndex: reduce ? -1 : Math.max(-1, step) }));
      if (step === n) sprite.play(m.kind === "Super" ? "super" : `special_${k + 1}`);
      step++;
      if (step > n + 6) {
        slot.replaceChildren(renderInput(m.input, { size: "sm" }));
        k = (k + 1) % moves.length;
        step = -2;
      }
    };
    tick();
    cycleTimer = setInterval(tick, 150);
  }

  function setCursor(si, idx, sound = true) {
    const s = sides[si];
    if (s.cursor === idx) return;
    s.cursor = idx;
    previewSide = si;
    if (sound) ui.sound("move");
    render();
    renderPreview();
  }

  function pick(si, id) {
    const s = sides[si];
    if (s.done) return;
    if (s.picks.includes(id)) {
      ui.sound("error");
      pulseClass(tiles[s.cursor], "is-denied");
      return;
    }
    s.picks.push(id);
    ui.sound("lock");
    pulseClass(tiles[roster.findIndex((f) => f.id === id)], "is-locking");
    pulseClass(panels[si].card, "is-locking");
    ui.say(`${ui.fighter(id)?.name} selected for ${sideLabel(si)}`);
    if (s.picks.length >= teamSize) s.done = true;
    if (!local && s.done && si === 0 && !sides[1].done) {
      current = 1;
      previewSide = 1;
      sides[1].cursor = Math.min(roster.length - 1, cols - 1);
      panels[1].shownId = undefined;
    }
    render();
    renderPreview();
    if (sides.every((x) => x.done)) {
      clearTimeout(readyTimer);
      readyTimer = setTimeout(proceed, 1000);
    }
  }

  function random(si) {
    const s = sides[si];
    if (s.done || rouletteTimer) return;
    const pool = roster.map((f, idx) => idx).filter((idx) => !s.picks.includes(roster[idx].id));
    const target = pool[Math.floor(Math.random() * pool.length)];
    let steps = 9;
    const spin = () => {
      steps--;
      if (steps <= 0) {
        rouletteTimer = 0;
        setCursor(si, target, false);
        pick(si, roster[target].id);
        return;
      }
      setCursor(si, pool[Math.floor(Math.random() * pool.length)]);
      rouletteTimer = setTimeout(spin, 45 + (9 - steps) * 12);
    };
    spin();
  }

  function back(si, evt) {
    if (readyTimer) {
      clearTimeout(readyTimer);
      readyTimer = 0;
    }
    const s = sides[si];
    if (local) {
      if (s.picks.length) {
        s.picks.pop();
        s.done = false;
      } else if (sides.every((x) => !x.picks.length) && evt.player === 0) {
        return leave();
      } else if (sides.every((x) => !x.picks.length)) {
        return leave();
      } else {
        ui.sound("error");
        return;
      }
    } else if (current === 1 && !sides[1].picks.length) {
      current = 0;
      previewSide = 0;
      sides[0].picks.pop();
      sides[0].done = false;
    } else if (sides[current].picks.length) {
      sides[current].picks.pop();
      sides[current].done = false;
    } else return leave();
    ui.sound("back");
    render();
    renderPreview();
  }

  function leave() {
    ui.sound("back");
    ui.show("mode");
  }

  function proceed() {
    readyTimer = 0;
    ui.session.sides = sides.map((s) => ({ control: s.control, player: s.player, picks: [...s.picks] }));
    ui.sound("confirm");
    ui.show("stage", { fresh: true });
  }

  return {
    el,
    enter(params = {}) {
      buildGrid();
      teamSize = ui.session.mode === "2v2" ? 2 : 1;
      local = ui.session.matchup === "local";
      ui.input.setSplit(local);
      el.dataset.mode = ui.session.mode;
      chip.textContent = `${ui.session.mode === "2v2" ? "2v2 Tag Team" : "1v1 Duel"} · ${MATCHUP_LABEL[ui.session.matchup] || ""}`;
      const controls = ui.session.matchup === "cpuvcpu" ? ["cpu", "cpu"] : ui.session.matchup === "local" ? ["human", "human"] : ["human", "cpu"];
      const prev = !params.fresh && ui.session.sides.length === 2 ? ui.session.sides : null;
      sides = controls.map((control, i) => {
        const picks = prev ? [...prev[i].picks] : [];
        return {
          control, player: control === "human" ? i : null, picks,
          done: picks.length >= teamSize,
          cursor: picks.length ? roster.findIndex((f) => f.id === picks.at(-1)) : i === 0 ? 0 : Math.min(roster.length - 1, cols - 1),
        };
      });
      if (prev) {
        const last = sides[1].picks.length ? 1 : 0;
        sides[last].picks.pop();
        sides[last].done = false;
      }
      current = sides[0].done ? 1 : 0;
      previewSide = current;
      panels.forEach((p) => { p.shownId = undefined; });
      el.classList.toggle("is-local", local);
      render();
      renderPreview();
    },
    leave() {
      ui.input.setSplit(false);
      clearInterval(cycleTimer);
      clearTimeout(readyTimer);
      clearTimeout(rouletteTimer);
      readyTimer = 0;
      rouletteTimer = 0;
      sprite.stop();
    },
    input(evt) {
      const si = local ? evt.player : current;
      const s = sides[si];
      if (!s) return;
      switch (evt.action) {
        case "up": case "down": case "left": case "right":
          if (!s.done && !rouletteTimer) setCursor(si, moveIndex(s.cursor, evt.action, cols, roster.length));
          break;
        case "confirm":
          if (!s.done && !rouletteTimer) pick(si, roster[s.cursor].id);
          break;
        case "info":
          random(si);
          break;
        case "back":
          back(si, evt);
          break;
        case "start":
          ui.openOverlay("movelist", { fighters: [roster[s.cursor]?.id].filter(Boolean) });
          break;
        default:
          break;
      }
    },
  };
}
