/**
 * Per-frame movement and guard modifiers a fighter reads from `fighter.mods`.
 * The mechanics layer recomputes them at the start of every step from statuses and zones.
 */
export const NO_MODS = Object.freeze({
  /** Multiplies walk, run and dash speed. */
  speedMul: 1,
  /** Forward dash, back dash and run are disabled. */
  noDash: false,
  /** Holding BLOCK does nothing; only an Alignment Block (a fresh BLK press just before the hit) guards. */
  noBlock: false,
  /** On contact, any ground normal chains into any other normal. */
  chainNormals: false,
  /** Normals cancel into specials from their first active frame even on whiff. */
  whiffCancel: false,
});

export function combineMods(list) {
  if (!list.length) return NO_MODS;
  const out = { ...NO_MODS };
  for (const m of list) {
    if (m.speedMul !== undefined) out.speedMul *= m.speedMul;
    for (const k of ["noDash", "noBlock", "chainNormals", "whiffCancel"]) if (m[k]) out[k] = true;
  }
  return Object.freeze(out);
}
