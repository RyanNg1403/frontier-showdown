import { h } from "../core/dom.js";
import { portraitImg } from "../core/assets.js";
import { acquireAtlas, releaseAtlas } from "../../engine/atlas-store.js";

/** Shared, reference-counted packed atlas (the same copy a running match uses). */
function loadAtlas(id, hasAtlas) {
  if (hasAtlas === false) return Promise.resolve(null);
  return acquireAtlas(id).then((atlas) => (atlas ? { json: atlas, id } : (releaseAtlas(id), null)));
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
    if (atlas.json.released) return;
    const an = f.anchor || atlas.json.anchor || { x: 128, y: 244 };
    const d = f.draw;
    if (d) {
      if (!d.empty) ctx.drawImage(d.img, d.x, d.y, d.w, d.h, 128 - an.x + d.dx, 244 - an.y + d.dy, d.dw ?? d.w, d.dh ?? d.h);
    } else if (atlas.json.image) {
      ctx.drawImage(atlas.json.image, f.x, f.y, f.w, f.h, 128 - an.x, 244 - an.y, f.w, f.h);
    }
  }

  function drop() {
    if (atlas) releaseAtlas(atlas.id);
    atlas = null;
  }

  return {
    mount(fighter) {
      const my = ++token;
      cancelAnimationFrame(raf);
      drop();
      const wrap = h("div", { class: "fs-sprite-wrap" }, portraitImg(fighter, "fs-sprite-fallback", { alt: "" }));
      loadAtlas(fighter.id, fighter.hasAtlas).then((loaded) => {
        if (!loaded) return;
        if (my !== token) {
          releaseAtlas(loaded.id);
          return;
        }
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
      drop();
    },
  };
}
