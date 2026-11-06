import sam from "../src/characters/sam.js";
import dario from "../src/characters/dario.js";
import { Match } from "../src/combat/match.js";
import { BTN } from "../src/combat/constants.js";

export { sam, dario, BTN };

export const N = Object.freeze({ dir: 5, buttons: 0 });

/** A started match with the intro skipped and both sides human (scripted) unless overridden. */
export function makeMatch({ p1 = [sam], p2 = [dario], mode = "1v1", events = null, ...rest } = {}) {
  const log = events || [];
  const m = new Match({
    mode,
    skipIntro: true,
    sides: [{ team: p1 }, { team: p2 }],
    emit: (name, payload) => {
      if (name !== "tick") log.push({ name, payload, frame: m.frame });
    },
    ...rest,
  });
  m.start();
  m.log = log;
  return m;
}

export function place(m, x0, x1) {
  const a = m.point(0);
  const b = m.point(1);
  a.x = x0;
  b.x = x1;
  a.facing = x0 <= x1 ? 1 : -1;
  b.facing = -a.facing;
}

/** Step `frames` times with constant inputs for each side. */
export function hold(m, frames, p1 = N, p2 = N) {
  for (let i = 0; i < frames; i += 1) m.step([p1, p2]);
}

/** Feed a list of `{dir, buttons, frames}` steps to one side while the other stays neutral. */
export function play(m, side, steps, other = N) {
  for (const s of steps) {
    const input = { dir: s.dir ?? 5, buttons: s.buttons ?? 0 };
    for (let i = 0; i < (s.frames ?? 1); i += 1) m.step(side === 0 ? [input, other] : [other, input]);
  }
}

/** Press a button (with optional direction) for one frame, then release. */
export function tap(m, side, buttons, dir = 5, other = N) {
  play(m, side, [{ dir, buttons, frames: 1 }, { dir, frames: 1 }], other);
}

export function events(m, name) {
  return m.log.filter((e) => e.name === name).map((e) => e.payload);
}

/** Run until `pred()` or the frame cap. Returns frames stepped. */
export function until(m, pred, cap = 600, p1 = N, p2 = N) {
  let n = 0;
  while (!pred() && n < cap) {
    m.step([p1, p2]);
    n += 1;
  }
  return n;
}

/** Forward relative to a facing, as an absolute numpad direction. */
export const fwd = (facing) => (facing > 0 ? 6 : 4);
export const back = (facing) => (facing > 0 ? 4 : 6);
export const downBack = (facing) => (facing > 0 ? 1 : 3);
