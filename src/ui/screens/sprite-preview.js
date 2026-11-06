import { h } from "../core/dom.js";
import { asset, portraitImg } from "../core/assets.js";

const atlasCache = new Map();

function loadAtlas(id) {
  if (!atlasCache.has(id)) {
    atlasCache.set(id, (async () => {
      try {
        const res = await fetch(asset(`assets/fighters/${id}/atlas.json`));
        if (!res.ok) return null;
        const json = await res.json();
        const img = new Image();
        img.src = asset(`assets/fighters/${id}/${json.image || "atlas.png"}`);
        await img.decode();
        return { json, img };
      } catch {
        return null;
      }
    })());
  }
  return atlasCache.get(id);
}

/**
 * Animated fighter preview for the move list panel. Plays atlas animations from
 * assets/fighters/<id>/ when the sprite worker's files exist, otherwise shows the portrait.
 */
export function createSpritePreview() {
  const canvas = h("canvas", { class: "fs-sprite", width: 256, height: 256, "aria-hidden": "true" });
  const ctx = canvas.getContext("2d");
  let atlas = null;
  let anim = "idle";
  let returnTo = "idle";
  let frame = 0;
  let acc = 0;
  let last = 0;
  let raf = 0;
  let token = 0;

  function draw(now) {
    raf = requestAnimationFrame(draw);
    const a = atlas?.json.animations?.[anim] || atlas?.json.animations?.idle;
    if (!a) return;
    acc += (now - (last || now)) / 1000;
    last = now;
    const step = 1 / (a.fps || 10);
    while (acc >= step) {
      acc -= step;
      frame++;
      if (frame >= a.frames.length) {
        if (a.loop === false || anim !== returnTo) {
          anim = returnTo;
          frame = 0;
        } else frame = 0;
      }
    }
    const f = a.frames[Math.min(frame, a.frames.length - 1)];
    ctx.clearRect(0, 0, 256, 256);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(atlas.img, f.x, f.y, f.w, f.h, 0, 0, 256, 256 * (f.h / f.w));
  }

  return {
    mount(fighter) {
      const my = ++token;
      cancelAnimationFrame(raf);
      atlas = null;
      const wrap = h("div", { class: "fs-sprite-wrap" }, portraitImg(fighter, "fs-sprite-fallback", { alt: "" }));
      loadAtlas(fighter.id).then((loaded) => {
        if (!loaded || my !== token) return;
        atlas = loaded;
        anim = "idle";
        returnTo = "idle";
        frame = 0;
        wrap.replaceChildren(canvas);
        wrap.classList.add("has-sprite");
        raf = requestAnimationFrame(draw);
      });
      return wrap;
    },
    play(name) {
      if (!atlas?.json.animations?.[name]) return;
      anim = name;
      frame = 0;
    },
    stop() {
      token++;
      cancelAnimationFrame(raf);
    },
  };
}
