/**
 * Saved progress for return visits, driven by engine events:
 * - session (localStorage): last mode, matchup, stage, fighter picks and controls, restored into
 *   the menus so a refresh lands on the last selection;
 * - stats (IndexedDB): per-fighter wins, losses, rounds, perfects and matches;
 * - history (IndexedDB): the last 200 matches;
 * - resume checkpoint (IndexedDB): written at every round boundary of an unfinished match and
 *   offered on the next visit; cleared when the match ends or the player quits.
 * Settings, control remaps and volumes are already kept in localStorage by the UI and audio
 * modules. There are no unlockable items in the game yet.
 */
import { local } from "./storage.js";

const SESSION_KEY = "session.v1";
const RESUME_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

function matchupOf(sides) {
  const c = sides.map((s) => s.control);
  if (c[0] === "cpu" && c[1] === "cpu") return "cpuvcpu";
  if (c[0] === "human" && c[1] === "human") return "local";
  return "cpu";
}

export function createProgress(game, storage) {
  let current = null;

  function sessionFromConfig(config) {
    const ui = game.ui?.session;
    return {
      mode: config.mode,
      matchup: ui?.matchup || matchupOf(config.sides),
      stage: config.stage || null,
      difficulty: config.sides.find((s) => s.control === "cpu")?.difficulty || config.sides[0]?.difficulty || "normal",
      sides: config.sides.map((s) => ({ team: [...s.team], control: s.control, player: s.player ?? null })),
      savedAt: Date.now(),
    };
  }

  function emptyRecord() {
    return { wins: 0, losses: 0, draws: 0, matches: 0, roundsWon: 0, roundsLost: 0, perfects: 0 };
  }

  async function bumpStats(fn) {
    const stats = (await storage.get("stats")) || { fighters: {}, totals: { matches: 0 } };
    fn(stats);
    stats.updatedAt = Date.now();
    await storage.set("stats", stats);
    return stats;
  }

  const on = (name, fn) => game.events.on(name, (e) => {
    try {
      fn(e || {});
    } catch (error) {
      console.warn(`[progress] ${name} handler failed`, error);
    }
  });

  on("matchStart", (e) => {
    const config = game.lastConfig;
    if (!config) return;
    const session = sessionFromConfig(config);
    local.set(SESSION_KEY, session);
    current = { startedAt: Date.now(), rounds: [], config, resumed: Boolean(e.resumed) };
    if (!e.resumed) void storage.remove("resume");
  });

  on("roundEnd", (e) => {
    if (!current) return;
    const config = current.config;
    current.rounds.push({ round: e.round, winner: e.winner, reason: e.reason, perfect: Boolean(e.perfect) });
    if (e.winner === 0 || e.winner === 1) {
      void bumpStats((stats) => {
        config.sides.forEach((side, i) => {
          for (const id of side.team) {
            const r = (stats.fighters[id] ||= emptyRecord());
            if (i === e.winner) {
              r.roundsWon += 1;
              if (e.perfect) r.perfects += 1;
            } else r.roundsLost += 1;
          }
        });
      });
    }
    if (e.matchOver) return;
    const live = game.match;
    const checkpoint = {
      v: 1,
      config,
      round: e.round + 1,
      sides: config.sides.map((_, i) => ({
        wins: e.wins?.[i] ?? 0,
        meter: live?.sides?.[i]?.meter ?? 0,
        lastCheckpointUsed: Boolean(live?.sides?.[i]?.lastCheckpointUsed),
      })),
      savedAt: Date.now(),
      appVersion: game.version || null,
    };
    void storage.set("resume", checkpoint);
  });

  on("matchEnd", (e) => {
    if (!current) return;
    const { config, startedAt, rounds } = current;
    current = null;
    void storage.remove("resume");
    const winner = e.winner === 0 || e.winner === 1 ? e.winner : null;
    void bumpStats((stats) => {
      stats.totals.matches = (stats.totals.matches || 0) + 1;
      config.sides.forEach((side, i) => {
        for (const id of side.team) {
          const r = (stats.fighters[id] ||= emptyRecord());
          r.matches += 1;
          if (winner === null) r.draws += 1;
          else if (winner === i) r.wins += 1;
          else r.losses += 1;
        }
      });
    });
    void storage.addMatch({
      at: Date.now(),
      seconds: Math.round((Date.now() - startedAt) / 1000),
      mode: config.mode,
      stage: config.stage || null,
      sides: config.sides.map((s) => ({ team: s.team, control: s.control, difficulty: s.difficulty })),
      winner,
      wins: e.wins || null,
      rounds,
    });
  });

  // Quitting on purpose discards the checkpoint; closing or refreshing the tab keeps it.
  const quit = () => {
    if (!current) return;
    current = null;
    void storage.remove("resume");
  };
  on("menu", quit);
  on("matchClosed", quit);

  return {
    /** Last session from localStorage, or null. */
    session: () => local.get(SESSION_KEY, null),

    /** Push the saved session into the UI so menus open on the last mode, stage and picks. */
    restoreMenus(uiInstance) {
      const s = local.get(SESSION_KEY, null);
      const target = uiInstance?.session;
      if (!s || !target) return false;
      const ids = new Set(game.listCharacters().map((c) => c.id));
      const stages = new Set(game.listStages().map((st) => st.id));
      if (s.mode === "1v1" || s.mode === "2v2") target.mode = s.mode;
      if (["cpu", "local", "cpuvcpu"].includes(s.matchup)) target.matchup = s.matchup;
      if (s.stage && stages.has(s.stage)) target.stageId = s.stage;
      const picks = (s.sides || []).map((side) => (side.team || []).filter((id) => ids.has(id)));
      if (picks.length === 2) target.lastPicks = { [target.mode]: picks };
      return true;
    },

    /** A resumable checkpoint whose fighters and stage still exist, or null. */
    async pendingResume() {
      const cp = await storage.get("resume");
      if (!cp || cp.v !== 1 || !cp.config?.sides || !(cp.round >= 2)) return null;
      if (Date.now() - (cp.savedAt || 0) > RESUME_MAX_AGE_MS) {
        void storage.remove("resume");
        return null;
      }
      const ids = new Set(game.listCharacters().map((c) => c.id));
      if (!cp.config.sides.every((s) => s.team?.length && s.team.every((id) => ids.has(id)))) return null;
      return cp;
    },

    describe(cp) {
      const names = (team) => team.map((id) => game.listCharacters().find((c) => c.id === id)?.shortName || id).join(" & ");
      const [a, b] = cp.config.sides;
      return `${cp.config.mode === "2v2" ? "Tag Team" : "Duel"} · Round ${cp.round} · ${cp.sides[0].wins}–${cp.sides[1].wins}\n${names(a.team)} vs ${names(b.team)}`;
    },

    resume(cp) {
      return game.startMatch({ ...cp.config, resume: { round: cp.round, sides: cp.sides } });
    },

    discardResume: () => storage.remove("resume"),
    stats: () => storage.get("stats"),
    history: (n) => storage.listMatches(n),
    storageStatus: () => storage.status(),
  };
}
