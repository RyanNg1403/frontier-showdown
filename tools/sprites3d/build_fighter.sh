#!/usr/bin/env bash
# Build one fighter's atlas with the 3D-to-pixel pipeline: shared states plus any move modules for it.
#   tools/sprites3d/build_fighter.sh <id> [out_dir] [anims]
# out_dir defaults to tools/sprites3d/build/<id>/out; pass assets/fighters/<id> to update the game atlas.
# anims defaults to all (comma-separated names to render a subset). Previews and the contact sheet go to
# tools/sprites3d/build/<id>/preview.
set -euo pipefail
cd "$(dirname "$0")/../.."

id="${1:?fighter id}"
out="${2:-tools/sprites3d/build/$id/out}"
anims="${3:-all}"
config="tools/sprites3d/fighters/$id.json"
render="tools/sprites3d/build/$id/render"
preview="tools/sprites3d/build/$id/preview"
blender="${BLENDER:-blender}"

[ -f "$config" ] || { echo "no config $config" >&2; exit 1; }
rm -rf "$render"
mkdir -p "$render" "$out" "$preview"
"$blender" -b --python tools/sprites3d/blender/build.py -- \
  --config "$config" --out "$render" --anims "$anims" 2>&1 | grep -E "^\[sprites3d\]|Error|Traceback|  File" || true
[ -f "$render/build.json" ] || { echo "render failed for $id" >&2; exit 1; }
python3 tools/sprites3d/post/process.py --config "$config" --build "$render" --out "$out" --preview-dir "$preview"
