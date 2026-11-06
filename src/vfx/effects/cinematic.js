export const cinematicEffects = {
  screen_flash: {
    life: 0.1,
    realtime: true,
    init(fx) { fx.life = (fx.opts.frames ?? 4) / 60; },
    screen(fx, ctx, vfx, layer) {
      if (layer !== "front") return;
      ctx.globalAlpha = (fx.opts.alpha ?? 0.8) * (1 - fx.t / fx.life);
      ctx.fillStyle = fx.opts.color || "#fff";
      ctx.fillRect(0, 0, vfx.viewW, vfx.viewH);
    },
  },
};
