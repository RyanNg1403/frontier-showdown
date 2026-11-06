import { fighterData } from "./core.js";

/** Runs the passive hooks that the engine core does not call itself (see `lab-passives.js`). */
export const passiveHooksModule = {
  name: "passive-hooks",

  reset(ctx) {
    ctx.state.lastAssist = [null, null];
    for (const f of ctx.match.allFighters) fighterData(f).flags.autoTechs = 0;
  },

  preStep(ctx) {
    const match = ctx.match;
    for (const f of match.fighters) {
      const limit = f.passiveDef?.autoTechThrows;
      const g = f.grab;
      if (!limit || f.state !== "thrown" || !g?.techable || !g.by || f.stateFrame < 1) continue;
      const flags = fighterData(f).flags;
      if ((flags.autoTechs ?? 0) >= limit) continue;
      flags.autoTechs = (flags.autoTechs ?? 0) + 1;
      match.techThrow(g.by, f);
      ctx.effect("auto_tech", f.x, f.y - 190, { side: f.side, life: 40, text: "COPILOT" });
    }
  },

  update(ctx) {
    for (const s of ctx.match.sides) {
      const prev = ctx.state.lastAssist[s.side];
      if (prev && !s.assist && s.assistCooldown > 0) {
        const mul = prev.passiveDef?.assistCooldownMul;
        if (mul) s.assistCooldown = Math.round(s.assistCooldown * mul);
      }
      ctx.state.lastAssist[s.side] = s.assist;
    }
  },

  beforeContact(ctx, a, d, props, at, info) {
    a.passiveDef?.modifyContact?.(a, d, props, info);
    return false;
  },
};
