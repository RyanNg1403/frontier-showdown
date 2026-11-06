// Standalone preview: mounts the UI on the mock game. `?scene=` jumps straight to a screen, e.g.
// title, mode, select, select-2v2, select-local, stage, versus, versus-2v2, fight, fight-2v2, hud,
// hud-2v2, announce-ko, pause, movelist, settings, results.
import { mountUI, drawHud } from "./index.js";
import { createMockGame } from "./mock/mock-game.js";

const canvas = document.getElementById("game");
const root = document.getElementById("ui-root");
const params = new URLSearchParams(location.search);
const scene = params.get("scene") || "title";

const game = createMockGame({ canvas });
const two = scene.includes("2v2");
const teams = two
  ? [{ control: "human", player: 0, picks: ["sam", "noam"] }, { control: "cpu", player: null, picks: ["dario", "chris"] }]
  : [{ control: "human", player: 0, picks: ["sam"] }, { control: "cpu", player: null, picks: ["dario"] }];

const ui = mountUI(root, game);
const inner = ui._ui;
const press = (action, player = 0) => inner.input.inject(action, player);
window.fsUI = ui;
window.fsGame = game;

function session(overrides = {}) {
  Object.assign(inner.session, {
    mode: two ? "2v2" : "1v1",
    matchup: scene.includes("local") ? "local" : "cpu",
    sides: teams.map((t) => ({ ...t, picks: [...t.picks] })),
    stageId: "openai-glass-atrium",
    ...overrides,
  });
}

async function poseFight(kind = "hud") {
  session();
  await ui.show("fight", { instant: true });
  game.debugPose(kind);
  inner.hud.show();
  inner.hud.clearAnnouncer();
}

const scenes = {
  async title() {},
  async mode() { await ui.show("mode", { instant: true }); },
  async select() {
    session({ sides: [] });
    await ui.show("select", { instant: true, fresh: true });
  },
  async "select-2v2"() {
    session({ sides: [] });
    await ui.show("select", { instant: true, fresh: true });
    press("confirm");
    press("right"); press("right"); press("down");
  },
  async "select-local"() {
    session({ sides: [] });
    await ui.show("select", { instant: true, fresh: true });
    press("right", 1); press("down", 1);
  },
  async stage() { session(); await ui.show("stage", { instant: true }); },
  async versus() { session(); await ui.show("versus", { instant: true }); },
  async "versus-2v2"() { session(); await ui.show("versus", { instant: true }); },
  async fight() { session(); await ui.show("fight", { instant: true, fresh: true }); },
  async "fight-2v2"() { session(); await ui.show("fight", { instant: true, fresh: true }); },
  async hud() { await poseFight("hud"); },
  async "hud-2v2"() { await poseFight("hud-2v2"); },
  async "announce-ko"() { await poseFight("hud"); inner.hud.announce("K.O.", "ko"); },
  async "announce-fight"() { await poseFight("hud"); inner.hud.announce("Fight!", "fight"); },
  async "announce-finish"() { await poseFight("hud"); inner.hud.announce("Finish Them!", "finish"); },
  async "announce-perfect"() { await poseFight("hud"); inner.hud.announce("Perfect", "perfect"); },
  async "announce-round"() { await poseFight("hud"); inner.hud.announce("Round 2", "round"); },
  async "canvas-hud"() {
    await poseFight("hud-2v2");
    inner.hud.hide();
    const ctx = canvas.getContext("2d");
    const loop = () => { drawHud(ctx, game.state); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  },
  async "super-2v2"() { await poseFight("hud-2v2"); inner.hud.superCinematic(0, "Scaling Law", "sam"); },
  async pause() { await poseFight(two ? "hud-2v2" : "hud"); ui.openOverlay("pause"); },
  async "pause-2v2"() { await poseFight("hud-2v2"); ui.openOverlay("pause"); },
  async movelist() { await poseFight("hud"); ui.openOverlay("pause"); ui.openOverlay("movelist", { fighters: ["sam", "dario"] }); },
  async settings() { await ui.show("mode", { instant: true }); ui.openOverlay("settings", { tab: params.get("tab") || "controls" }); },
  async results() {
    await poseFight(two ? "hud-2v2" : "hud");
    const st = inner.session.stats.sides;
    Object.assign(st[0], { damage: 2140, maxCombo: 9, specials: 7, supers: 2, perfects: 1, tags: 3 });
    Object.assign(st[1], { damage: 1210, maxCombo: 5, specials: 4, supers: 1, perfects: 0, tags: 1 });
    inner.session.stats.startedAt = performance.now() - 154000;
    game.debugFinishMatch(0);
    inner.session.result = { winner: 0, state: structuredClone(game.state) };
    await ui.show("results", { instant: true });
  },
  get "results-2v2"() { return this.results; },
};

window.__fsReady = (async () => {
  await document.fonts.ready;
  await new Promise((r) => setTimeout(r, 50));
  await (scenes[scene] || scenes.title)();
  return true;
})();
