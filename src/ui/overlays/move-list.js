import { h, replace } from "../core/dom.js";
import { portraitImg, sigilUrl } from "../core/assets.js";
import { hintBar } from "../core/widgets.js";
import { fighterAccent, labInfo, shortName } from "../data/labs.js";
import { renderInput, normalLabel } from "../data/notation.js";

const PROPS = {
  projectile: "Projectile", invincible: "Invincible", invuln: "Invincible", counter: "Counter", command_grab: "Command grab",
  teleport: "Teleport", buff: "Power-up", feint: "Feint", overhead: "Overhead", knockdown: "Knockdown",
  unblockable: "Unblockable", launcher: "Launcher", air: "Air",
};

function props(move) {
  const chips = Object.keys(PROPS).filter((k) => move[k]).map((k) => PROPS[k]);
  if (move.class) chips.unshift(move.class);
  return [...new Set(chips)].map((label) => h("span", { class: "fs-prop" }, label));
}

function onBlock(move) {
  if (move.onBlock != null) return String(move.onBlock);
  if (move.blockstun != null && move.recovery != null && move.active != null) {
    const adv = move.blockstun - move.recovery - move.active + 1;
    return adv > 0 ? `+${adv}` : String(adv);
  }
  return "—";
}

function frames(move) {
  if (move.startup == null) return "—";
  return `${move.startup} / ${move.active ?? "—"} / ${move.recovery ?? "—"}`;
}

export function createMoveListOverlay(ui, { fighters = [] } = {}) {
  const ids = [...new Set(fighters)].filter((id) => ui.fighter(id));
  if (!ids.length && ui.roster[0]) ids.push(ui.roster[0].id);
  const tabs = h("div", { class: "fs-tabs", role: "tablist" });
  const body = h("div", { class: "fs-movelist__body", tabindex: "-1" });
  const hints = hintBar(ui, [["tabs", "Fighter"], ["move", "Scroll"], ["back", "Close"]]);
  const el = h("div", { class: "fs-overlay fs-movelist", role: "dialog", "aria-modal": "true", "aria-label": "Move list" },
    h("div", { class: "fs-overlay__scrim" }),
    h("div", { class: "fs-panel fs-movelist__panel" },
      h("h2", { class: "fs-panel__title" }, "Move List"),
      tabs,
      body,
      hints));
  let tab = 0;
  let rows = [];
  let row = 0;

  function renderTabs() {
    replace(tabs, ids.map((id, i) => {
      const f = ui.fighter(id);
      const t = h("button", { class: ["fs-tab", i === tab && "is-active"], type: "button", role: "tab", "aria-selected": String(i === tab), vars: { lab: fighterAccent(f) } },
        portraitImg(f, "fs-tab__img", { alt: "" }), shortName(f));
      t.addEventListener("click", () => setTab(i));
      return t;
    }));
  }

  function renderBody() {
    const f = ui.fighter(ids[tab]);
    const lab = labInfo(f.lab);
    el.style.setProperty("--lab", fighterAccent(f));
    const moveRow = (name, input, move, kind) => h("tr", { class: `fs-mrow is-${kind}` },
      h("th", { scope: "row" }, h("span", { class: "fs-mrow__name" }, name), h("span", { class: "fs-mrow__props" }, props(move))),
      h("td", null, renderInput(input, { size: "sm" })),
      h("td", { class: "fs-mrow__num" }, move.damage ?? "—"),
      h("td", { class: "fs-mrow__num" }, frames(move)),
      h("td", { class: ["fs-mrow__num", "fs-mrow__adv", /^-/.test(onBlock(move)) && "is-minus", /^\+/.test(onBlock(move)) && "is-plus"] }, onBlock(move)));
    const section = (title, list) => [
      h("tr", { class: "fs-mrow__section" }, h("th", { colspan: "5", scope: "colgroup" }, title)),
      ...list,
    ];
    const normals = Object.entries(f.normals || {}).map(([key, m]) => {
      const { name, input } = normalLabel(key, m);
      return moveRow(name, input, m, "normal");
    });
    replace(body,
      h("aside", { class: "fs-movelist__who" },
        portraitImg(f, "fs-movelist__portrait"),
        h("div", { class: "fs-movelist__id" },
          h("strong", null, f.name),
          h("span", null, f.title || ""),
          h("span", { class: "fs-movelist__lab" }, h("img", { src: sigilUrl(f.lab), alt: "" }), lab.name),
          f.bio ? h("p", { class: "fs-movelist__bio" }, f.bio) : null)),
      h("div", { class: "fs-movelist__scroll" },
        h("table", { class: "fs-mtable" },
          h("caption", { class: "fs-sr-only" }, `${f.name} move list`),
          h("thead", null, h("tr", null,
            h("th", { scope: "col" }, "Move"), h("th", { scope: "col" }, "Input"),
            h("th", { scope: "col" }, "Dmg"), h("th", { scope: "col" }, "S / A / R"), h("th", { scope: "col" }, "On block"))),
          h("tbody", null,
            f.super ? section("Super", [moveRow(f.super.name, f.super.input, f.super, "super")]) : null,
            section("Specials", (f.specials || []).map((m) => moveRow(m.name, m.input, m, "special"))),
            section("Normals", normals),
            f.finisher ? section("Finisher", [moveRow(f.finisher.name, f.finisher.input, { class: f.finisher.range ? `${f.finisher.range} range` : "" }, "finisher")]) : null,
            section("Universal", [
              moveRow("Tag In", "TAG", {}, "normal"),
              moveRow("Tag Assist", "B+TAG", {}, "normal"),
              moveRow("Dash", "F,F", {}, "normal"),
              moveRow("Back Dash", "B,B", {}, "normal"),
            ])))));
    rows = [...body.querySelectorAll("tbody tr:not(.fs-mrow__section)")];
    row = 0;
    focusRow(0, false);
  }

  function focusRow(i, sound = true) {
    rows[row]?.classList.remove("is-focused");
    row = Math.max(0, Math.min(rows.length - 1, i));
    rows[row]?.classList.add("is-focused");
    rows[row]?.scrollIntoView({ block: "nearest" });
    if (sound) ui.sound("move");
  }

  function setTab(i) {
    tab = (i + ids.length) % ids.length;
    ui.sound("move");
    renderTabs();
    renderBody();
  }

  renderTabs();
  renderBody();

  return {
    el,
    input(evt) {
      switch (evt.action) {
        case "tabPrev": case "left": setTab(tab - 1); break;
        case "tabNext": case "right": setTab(tab + 1); break;
        case "up": focusRow(row - 1); break;
        case "down": focusRow(row + 1); break;
        case "back": case "start": case "confirm": ui.sound("back"); ui.closeOverlay(); break;
        default: break;
      }
    },
  };
}
