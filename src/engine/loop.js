/**
 * Fixed-step loop: `step()` runs at exactly `hz`, `render(alpha)` once per animation frame.
 * Caps catch-up so a background tab doesn't spiral.
 */
export function createLoop({ step, render, hz = 60, maxSteps = 5, now = () => performance.now(), raf = (fn) => requestAnimationFrame(fn) }) {
  const dt = 1000 / hz;
  let acc = 0;
  let last = 0;
  let running = false;
  let timeScale = 1;

  function frame(t) {
    if (!running) return;
    if (!last) last = t;
    acc += Math.min(250, t - last) * timeScale;
    last = t;
    let steps = 0;
    while (acc >= dt && steps < maxSteps) {
      step();
      acc -= dt;
      steps += 1;
    }
    if (steps === maxSteps) acc = 0;
    render(acc / dt);
    raf(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = 0;
      acc = 0;
      raf(frame);
    },
    stop() {
      running = false;
    },
    get running() {
      return running;
    },
    set timeScale(v) {
      timeScale = Math.max(0, v);
    },
    get timeScale() {
      return timeScale;
    },
    /** Advance `n` fixed steps immediately (tests, frame-stepping). */
    advance(n = 1) {
      for (let i = 0; i < n; i += 1) step();
      render(0);
    },
    now,
  };
}
