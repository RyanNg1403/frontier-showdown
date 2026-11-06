/**
 * Loading screen with progress, driven by boot steps and the engine's `loading` / `loaded`
 * events. At boot it covers the screen; for a match it fades in over the menus only when
 * loading takes longer than `delayMs`, so cached matches start without a flash.
 */
export function createLoadingScreen(el = document.getElementById("fs-loader")) {
  if (!el) return { set() {}, show() {}, hide() {}, attach() {} };
  const fill = el.querySelector(".fs-loader__fill");
  const label = el.querySelector(".fs-loader__label");
  let showTimer = 0;
  let hideTimer = 0;

  function set(progress, text) {
    const p = Math.max(0.04, Math.min(1, Number(progress) || 0));
    if (fill) fill.style.transform = `scaleX(${p})`;
    el.setAttribute("aria-valuenow", String(Math.round(p * 100)));
    if (text && label) label.textContent = text;
  }

  function show({ overlay = false, delayMs = 0 } = {}) {
    clearTimeout(hideTimer);
    clearTimeout(showTimer);
    const reveal = () => {
      el.classList.toggle("is-overlay", overlay);
      el.classList.remove("is-fading");
      el.hidden = false;
    };
    if (delayMs > 0 && el.hidden) showTimer = setTimeout(reveal, delayMs);
    else reveal();
  }

  function hide() {
    clearTimeout(showTimer);
    if (el.hidden) return;
    set(1);
    el.classList.add("is-fading");
    hideTimer = setTimeout(() => {
      el.hidden = true;
      el.classList.remove("is-fading");
    }, 260);
  }

  /** Follow a game's match loading. */
  function attach(game) {
    game.events.on("loading", (e) => {
      show({ overlay: true, delayMs: 250 });
      set(e.progress, e.label);
    });
    game.events.on("loaded", hide);
    game.events.on("menu", hide);
    game.events.on("matchClosed", hide);
  }

  return { set, show, hide, attach };
}
