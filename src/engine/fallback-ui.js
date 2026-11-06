/**
 * Built-in menu used only when `src/ui/index.js` is absent. Deliberately small:
 * the UI module owns the real menus.
 */
const CSS = `
.fs-menu{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;font-family:system-ui,sans-serif;color:#f4f1ff}
.fs-panel{pointer-events:auto;background:rgba(14,11,28,.88);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:22px 26px;min-width:560px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.fs-panel h1{margin:0 0 4px;font-size:30px;letter-spacing:.08em}
.fs-panel h1 em{color:#ffb02e;font-style:normal}
.fs-panel p{margin:0 0 16px;color:#b9b2d6;font-size:13px}
.fs-row{display:flex;gap:10px;align-items:center;margin:10px 0;flex-wrap:wrap}
.fs-row label{width:90px;color:#b9b2d6;font-size:13px}
.fs-panel select,.fs-panel button{background:#241d3d;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:7px 10px;font-size:14px}
.fs-panel button.fs-go{background:#ffb02e;color:#1a1326;font-weight:800;border:0;padding:10px 22px;margin-top:8px}
.fs-panel button.is-on{background:#5b47c9}
.fs-keys{font-size:12px;color:#9a93b8;line-height:1.6;margin-top:14px}
.fs-overlay .fs-panel{min-width:320px;text-align:center}
`;

export function mountFallbackUI(root, game) {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
  const menu = document.createElement("div");
  menu.className = "fs-menu";
  root.appendChild(menu);

  const chars = game.listCharacters();
  const stages = game.listStages();
  const opts = (list) => list.map((c) => `<option value="${c.id}">${c.name}${c.title ? " - " + c.title : ""}</option>`).join("");
  const config = { mode: "1v1" };

  function showMain() {
    menu.className = "fs-menu";
    menu.innerHTML = `
      <div class="fs-panel">
        <h1>FRONTIER <em>SHOWDOWN</em></h1>
        <p>Built-in menu (the UI module is not installed).</p>
        <div class="fs-row"><label>Mode</label>
          <button data-mode="1v1" class="${config.mode === "1v1" ? "is-on" : ""}">1 vs 1</button>
          <button data-mode="2v2" class="${config.mode === "2v2" ? "is-on" : ""}">2 vs 2 Tag</button></div>
        <div class="fs-row"><label>Player 1</label>
          <select id="fs-p1a">${opts(chars)}</select>
          ${config.mode === "2v2" ? `<select id="fs-p1b">${opts(chars)}</select>` : ""}
          <select id="fs-p1c"><option value="human">Human</option><option value="cpu">CPU</option></select></div>
        <div class="fs-row"><label>Player 2</label>
          <select id="fs-p2a">${opts(chars)}</select>
          ${config.mode === "2v2" ? `<select id="fs-p2b">${opts(chars)}</select>` : ""}
          <select id="fs-p2c"><option value="cpu">CPU</option><option value="human">Human</option></select>
          <select id="fs-diff"><option value="easy">Easy</option><option value="normal" selected>Normal</option><option value="hard">Hard</option><option value="brutal">Brutal</option></select></div>
        <div class="fs-row"><label>Stage</label><select id="fs-stage">${opts(stages)}</select></div>
        <button class="fs-go" id="fs-start">FIGHT</button>
        <div class="fs-keys">
          P1: WASD move, U/I punch, J/K kick, L block, O tag, P assist. P2: arrows, Numpad 4/5 punch, 1/2 kick, 6 block, 8 tag, 9 assist.<br>
          Throw LP+LK, breaker Forward+Block in a combo, dash by double-tapping. Esc pauses, F1 shows hitboxes. Gamepads work too.
        </div>
      </div>`;
    const ids = chars.map((c) => c.id);
    const p2a = menu.querySelector("#fs-p2a");
    if (ids.length > 1) p2a.value = ids[1];
    const p1b = menu.querySelector("#fs-p1b");
    if (p1b && ids.length > 1) p1b.value = ids[1];
    menu.querySelectorAll("[data-mode]").forEach((b) => b.addEventListener("click", () => {
      config.mode = b.dataset.mode;
      showMain();
    }));
    menu.querySelector("#fs-start").addEventListener("click", () => {
      const v = (id) => menu.querySelector(id)?.value;
      const team = (a, b) => (config.mode === "2v2" ? [v(a), v(b)] : [v(a)]);
      const diff = v("#fs-diff");
      game.startMatch({
        mode: config.mode,
        stage: v("#fs-stage"),
        sides: [
          { team: team("#fs-p1a", "#fs-p1b"), control: v("#fs-p1c"), difficulty: diff },
          { team: team("#fs-p2a", "#fs-p2b"), control: v("#fs-p2c"), difficulty: diff },
        ],
      });
      hide();
    });
  }

  function overlay(title, buttons) {
    menu.className = "fs-menu fs-overlay";
    menu.innerHTML = `<div class="fs-panel"><h1>${title}</h1><div class="fs-row" style="justify-content:center"></div></div>`;
    const row = menu.querySelector(".fs-row");
    for (const [label, fn] of buttons) {
      const b = document.createElement("button");
      b.textContent = label;
      b.addEventListener("click", fn);
      row.appendChild(b);
    }
  }

  function hide() {
    menu.innerHTML = "";
  }

  game.events.on("pause", () => overlay("PAUSED", [["Resume", () => game.resume()], ["Quit to menu", () => game.quitToMenu()]]));
  game.events.on("resume", hide);
  game.events.on("matchStart", hide);
  game.events.on("menu", showMain);
  game.events.on("matchEnd", () => setTimeout(() => {
    if (game.state.phase === "matchEnd") overlay("MATCH OVER", [["Rematch", () => { hide(); game.rematch(); }], ["Menu", () => game.quitToMenu()]]);
  }, 2500));
  showMain();
}
