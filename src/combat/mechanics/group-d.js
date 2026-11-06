/**
 * Group D mechanics (roster doc 3.13-3.16). Importing this file registers them with the shared
 * registry (`src/combat/mechanics.js`); the Group D character files import it.
 *
 * Move mechanics: return-counter, intangible, drift-cloud, timed-spawns, stance-router,
 * tracking-beam, echo, path-strike, marble-world, spatial-step.
 * Fighter mechanics: stance-router (Noam), mark and path-strike (Chris).
 * Systems (orders above Group C's 10-70): drift-cloud 110, stance-router and tracking-beam 120
 * (snapshots), compulsion 130 (after `placed` springs the Golden Gate), mark 150, and
 * group-d-visuals 190 (keeps the overlay entity alive).
 */
import "./return-counter.js";
import "./intangible.js";
import "./drift-cloud.js";
import "./timed-spawns.js";
import "./stance-router.js";
import "./tracking-beam.js";
import "./delayed-strike.js";
import "./mark.js";
import "./compulsion.js";
import "./path-strike.js";
import "./constructs.js";
import "./spatial-step.js";
import "./group-d-visuals.js";
