import test from "node:test";
import assert from "node:assert/strict";
import { BTN, N, dario, makeMatch, place, sam } from "./helpers.mjs";

/** Two buttons the attacker can mash without cancelling `moveKey` (fresh presses every frame). */
const MASH = { lp: [BTN.LK, BTN.HK], hp: [BTN.LK, BTN.HK], lk: [BTN.LP, BTN.HP], hk: [BTN.LK, BTN.LP] };

/**
 * Both fighters press a fresh button every frame after contact; the first frame each one
 * starts a new move is when it can act. Returns defender frame - attacker frame.
 */
function advantage(attackerDef, moveKey, blocked) {
  const m = makeMatch({ p1: [attackerDef], p2: [dario] });
  place(m, -60, 60);
  const guard = { dir: 5, buttons: BTN.BLOCK };
  for (let i = 0; i < 6; i += 1) m.step([N, blocked ? guard : N]);
  const bit = { lp: BTN.LP, hp: BTN.HP, lk: BTN.LK, hk: BTN.HK }[moveKey];
  m.step([{ dir: 5, buttons: bit }, blocked ? guard : N]);
  const a = m.point(0);
  const d = m.point(1);
  const first = a.move;
  let contact = -1;
  let aAct = -1;
  let dAct = -1;
  for (let f = 0; f < 150 && (aAct < 0 || dAct < 0); f += 1) {
    const mash = contact >= 0;
    const ab = mash ? MASH[moveKey][f % 2] : 0;
    const db = mash ? (f % 2 ? BTN.LP : BTN.LK) : blocked ? BTN.BLOCK : 0;
    m.step([{ dir: 5, buttons: ab }, { dir: 5, buttons: db }]);
    if (contact < 0 && (d.state === "blockstun" || d.state === "hitstun")) {
      contact = f;
      d.x = a.x + 420;
    }
    if (contact >= 0 && aAct < 0 && a.state === "attack" && a.move !== first && a.moveFrame === 1) aAct = f;
    if (contact >= 0 && dAct < 0 && d.state === "attack" && d.moveFrame === 1) dAct = f;
  }
  assert.ok(aAct >= 0 && dAct >= 0, "both fighters acted");
  return dAct - aAct;
}

for (const key of ["lp", "hp", "lk", "hk"]) {
  test(`Sam ${key}: on-block and on-hit advantage equal stun - (active - 1 + recovery)`, () => {
    const mv = sam.normals[key];
    assert.equal(advantage(sam, key, true), mv.blockstun - (mv.active - 1 + mv.recovery), "on block");
    assert.equal(advantage(sam, key, false), mv.hitstun - (mv.active - 1 + mv.recovery), "on hit");
  });
}

test("Sam's jab is +1 on block, inside the roster doc's jab class (+1 to +3)", () => {
  assert.equal(advantage(sam, "lp", true), 1);
});
