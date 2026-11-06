import { registerMechanic } from "../mechanics.js";

/**
 * "finisher-no-jump" (fighter-level): during the finish phase the winner's up inputs don't
 * start a jump, so finishers with up in the motion (Elon's D,U,U+HK) can be entered from the
 * ground. The prejump is cancelled back to idle every frame it starts.
 */
registerMechanic("finisher-no-jump", {
  update(f, env) {
    const m = env.match;
    if (m?.phase === "finish" && m.finishSide === f.side && f.state === "jump_start") {
      f.setState("idle");
      f.vx = 0;
    }
  },
});
