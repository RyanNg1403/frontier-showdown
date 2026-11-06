import { groupCKits } from "./group-c.js";

/** Per-character CPU tactics, keyed by character id. See each group file for the kit API. */
const KITS = { ...groupCKits };

export function kitFor(id) {
  return KITS[id] || null;
}
