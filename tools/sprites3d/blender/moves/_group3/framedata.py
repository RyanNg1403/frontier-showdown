#!/usr/bin/env python3
"""Snapshot a fighter's move timings from its character file into moves/_group3/framedata/<id>.json.

    python3 tools/sprites3d/blender/moves/_group3/framedata.py <id> <git-ref>
    e.g. framedata.py liang origin/main

Reads src/characters/<id>.js at the ref (with `defineCharacter` stubbed out), keeps startup/active/recovery and
the animation name of every normal, special, super, stance variant, throw and finisher. Needs node.
"""

import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", "..", ".."))

NODE = r"""
const src = require('fs').readFileSync(0, 'utf8')
  .replace(/^import[^\n]*\n/gm, '')
  .replace('export default defineCharacter(', 'module.exports = (');
const m = { exports: {} };
new Function('module', 'exports', src)(m, m.exports);
const c = m.exports;
const pick = (mv, anim) => mv && ({ name: mv.name, anim: mv.anim || anim, startup: mv.startup, active: mv.active,
  recovery: mv.recovery, hits: mv.hits, hitbox: mv.hitbox || (mv.projectile && mv.projectile.offset ? { x: mv.projectile.offset.x - 10, y: mv.projectile.offset.y - 10, w: 20, h: 20 } : undefined), projectile: !!mv.projectile, parry: !!(mv.parry || (mv.mech && mv.mech.parry) || mv.mechanic === 'parry') });
const NORMAL_ANIMS = { lp: 'light_punch', hp: 'heavy_punch', lk: 'light_kick', hk: 'heavy_kick', c_lp: 'crouch_light',
  c_lk: 'crouch_light', c_hp: 'crouch_heavy', c_hk: 'crouch_heavy', j_p: 'air_attack', j_k: 'air_attack',
  f_lp: 'light_punch', f_hp: 'heavy_punch', f_hk: 'heavy_kick', b_hp: 'heavy_punch', b_hk: 'heavy_kick' };
const out = { id: c.id, normals: {}, specials: [], experts: {} };
for (const [k, mv] of Object.entries(c.normals || {})) out.normals[k] = pick(mv, NORMAL_ANIMS[k] || k);
(c.specials || []).forEach((sp, i) => out.specials.push({ id: sp.id, ...pick(sp, sp.anim || `special_${i + 1}`) }));
out.super = c.super && { id: c.super.id, ...pick(c.super, c.super.anim || 'super') };
out.throw = c.throw && { name: c.throw.name };
out.finisher = c.finisher && { id: c.finisher.id, name: c.finisher.name, anim: c.finisher.anim || 'finisher' };
const router = (c.specials || []).map((s) => (s.mech && s.mech.router) || (s.mechanic === 'stance-router' && s.mechanicData)).find(Boolean);
if (router) for (const [stance, moves] of Object.entries(router.experts))
  for (const [k, mv] of Object.entries(moves)) out.experts[`${k}_${stance}`] = pick(mv, mv.anim);
process.stdout.write(JSON.stringify(out, null, 1));
"""


def main():
    fid, ref = sys.argv[1], sys.argv[2]
    src = subprocess.check_output(["git", "-C", ROOT, "show", f"{ref}:src/characters/{fid}.js"])
    commit = subprocess.check_output(["git", "-C", ROOT, "rev-parse", "--short", ref]).decode().strip()
    out = json.loads(subprocess.check_output(["node", "-e", NODE], input=src))
    out["source"] = {"ref": ref, "commit": commit, "file": f"src/characters/{fid}.js"}
    path = os.path.join(HERE, "framedata", f"{fid}.json")
    with open(path, "w") as fh:
        json.dump(out, fh, indent=1)
        fh.write("\n")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
