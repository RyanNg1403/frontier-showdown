// Menu input: keyboard and Gamepad API, normalised to actions per player.
// Actions: up down left right confirm back info tabPrev tabNext start.
// In the "fight" context only pause requests (Escape, pad Start) are handled so gameplay keys reach the engine.

const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const DIRS = ["up", "down", "left", "right"];
const REPEAT_DELAY = 360;
const REPEAT_RATE = 85;

export function createMenuInput({ settings, target = window }) {
  const listeners = new Set();
  const deviceListeners = new Set();
  const padState = new Map();
  let context = "menu";
  let split = false;
  let lastDevice = "keyboard";
  let capture = null;
  let raf = 0;

  function emit(action, player, device, extra = {}) {
    if (device !== lastDevice) {
      lastDevice = device;
      deviceListeners.forEach((fn) => fn(device));
    }
    const evt = { action, player, device, ...extra };
    for (const fn of [...listeners]) fn(evt);
  }

  function keyAction(code) {
    const { p1, p2 } = settings.get().controls;
    const universalPlayer = split ? 1 : 0;
    switch (code) {
      case "ArrowUp": return ["up", universalPlayer];
      case "ArrowDown": return ["down", universalPlayer];
      case "ArrowLeft": return ["left", universalPlayer];
      case "ArrowRight": return ["right", universalPlayer];
      case "Enter": case "NumpadEnter": return ["confirm", universalPlayer];
      case "Backspace": return ["back", universalPlayer];
      case "Space": return ["confirm", 0];
      case "Escape": return ["back", 0, { escape: true }];
      case "KeyQ": case "PageUp": return ["tabPrev", 0];
      case "KeyE": case "PageDown": return ["tabNext", 0];
      case "Tab": return null;
      default: break;
    }
    const sets = [[p1.keyboard, 0], [p2.keyboard, 1]];
    for (const [map, player] of sets) {
      if (code === map.up) return ["up", player];
      if (code === map.down) return ["down", player];
      if (code === map.left) return ["left", player];
      if (code === map.right) return ["right", player];
      if (code === map.lightPunch) return ["confirm", player];
      if (code === map.lightKick) return ["back", player];
      if (code === map.heavyPunch) return ["info", player];
      if (code === map.block) return ["tabPrev", player];
      if (code === map.tag) return ["tabNext", player];
    }
    return null;
  }

  function onKeyDown(e) {
    if (capture) {
      e.preventDefault();
      e.stopPropagation();
      const fn = capture;
      capture = null;
      fn({ device: "keyboard", code: e.code, cancel: e.code === "Escape" });
      return;
    }
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === "Tab") {
      e.preventDefault();
      emit(e.shiftKey ? "tabPrev" : "tabNext", 0, "keyboard");
      return;
    }
    const mapped = keyAction(e.code);
    if (!mapped) return;
    const [action, player, extra] = mapped;
    if (context === "fight") {
      if (!extra?.escape) return;
      e.preventDefault();
      emit("start", 0, "keyboard", { escape: true });
      return;
    }
    if (e.repeat && !DIRS.includes(action)) return;
    e.preventDefault();
    emit(action, player, "keyboard", { repeat: e.repeat, ...extra });
  }

  function pollPads(now) {
    raf = requestAnimationFrame(pollPads);
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean) : [];
    pads.forEach((pad, slot) => {
      const player = Math.min(slot, 1);
      let st = padState.get(pad.index);
      if (!st) {
        st = { pressed: new Set(), dir: null, dirSince: 0, lastRepeat: 0 };
        padState.set(pad.index, st);
      }
      const pressed = new Set();
      pad.buttons.forEach((b, i) => { if (b.pressed || b.value > 0.5) pressed.add(i); });

      if (capture) {
        for (const i of pressed) {
          if (!st.pressed.has(i)) {
            const fn = capture;
            capture = null;
            fn({ device: "gamepad", button: i, player, cancel: i === PAD.BACK });
            break;
          }
        }
        st.pressed = pressed;
        return;
      }

      const down = (i) => pressed.has(i) && !st.pressed.has(i);
      if (context === "fight") {
        if (down(PAD.START)) emit("start", player, "gamepad");
        st.pressed = pressed;
        return;
      }
      if (down(PAD.A)) emit("confirm", player, "gamepad");
      if (down(PAD.B)) emit("back", player, "gamepad");
      if (down(PAD.Y)) emit("info", player, "gamepad");
      if (down(PAD.LB)) emit("tabPrev", player, "gamepad");
      if (down(PAD.RB)) emit("tabNext", player, "gamepad");
      if (down(PAD.START)) emit("start", player, "gamepad");
      if (down(PAD.BACK)) emit("back", player, "gamepad");

      const [ax = 0, ay = 0] = pad.axes;
      let dir = null;
      if (pressed.has(PAD.UP) || ay < -0.55) dir = "up";
      else if (pressed.has(PAD.DOWN) || ay > 0.55) dir = "down";
      else if (pressed.has(PAD.LEFT) || ax < -0.55) dir = "left";
      else if (pressed.has(PAD.RIGHT) || ax > 0.55) dir = "right";
      if (dir !== st.dir) {
        st.dir = dir;
        st.dirSince = now;
        st.lastRepeat = now;
        if (dir) emit(dir, player, "gamepad");
      } else if (dir && now - st.dirSince > REPEAT_DELAY && now - st.lastRepeat > REPEAT_RATE) {
        st.lastRepeat = now;
        emit(dir, player, "gamepad", { repeat: true });
      }
      st.pressed = pressed;
    });
  }

  function onPadConnect() {
    deviceListeners.forEach((fn) => fn(lastDevice));
  }

  target.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("gamepadconnected", onPadConnect);
  window.addEventListener("gamepaddisconnected", onPadConnect);
  raf = requestAnimationFrame(pollPads);

  return {
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    onDevice(fn) { deviceListeners.add(fn); return () => deviceListeners.delete(fn); },
    setContext(next) { context = next; },
    get context() { return context; },
    /** When true, arrows/Enter/Backspace drive player 2 so two people can share a keyboard. */
    setSplit(next) { split = next; },
    get lastDevice() { return lastDevice; },
    /** Feed a synthetic menu action, e.g. from tests or an on-screen touch control. */
    inject(action, player = 0, device = lastDevice) { emit(action, player, device, { synthetic: true }); },
    padCount() {
      return navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean).length : 0;
    },
    /** Capture the next key or pad button for remapping. Resolves { device, code | button, cancel }. */
    captureNext() {
      return new Promise((resolve) => { capture = resolve; });
    },
    cancelCapture() {
      if (capture) capture({ cancel: true });
      capture = null;
    },
    destroy() {
      cancelAnimationFrame(raf);
      target.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("gamepadconnected", onPadConnect);
      window.removeEventListener("gamepaddisconnected", onPadConnect);
      listeners.clear();
    },
  };
}
