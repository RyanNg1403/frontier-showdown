import { createGame } from "./engine/game.js";

async function linkStylesheet(href) {
  try {
    const res = await fetch(href, { method: "HEAD" });
    if (!res.ok || !(res.headers.get("content-type") || "").includes("css")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  } catch {
    // The UI stylesheet is optional.
  }
}

async function boot() {
  const canvas = document.getElementById("game");
  const uiRoot = document.getElementById("ui-root");
  try {
    await linkStylesheet("/styles/ui.css");
    const game = await createGame({ canvas, uiRoot });
    window.frontierShowdown = game;
    const params = new URLSearchParams(location.search);
    if (params.has("quick")) {
      const mode = params.get("mode") === "2v2" ? "2v2" : "1v1";
      const team = (key, fallback) => (params.get(key) || fallback).split(",");
      await game.startMatch({
        mode,
        stage: params.get("stage") || undefined,
        sides: [
          { team: team("p1", mode === "2v2" ? "sam,dario" : "sam"), control: params.get("p1c") || "human", difficulty: params.get("d") || "normal" },
          { team: team("p2", mode === "2v2" ? "dario,sam" : "dario"), control: params.get("p2c") || "cpu", difficulty: params.get("d") || "normal" },
        ],
      });
    }
  } catch (error) {
    console.error(error);
    const el = document.getElementById("boot-error");
    el.style.display = "grid";
    el.textContent = `Frontier Showdown failed to start: ${error.message}`;
  }
}

boot();
