#!/usr/bin/env bash
# Build one fighter with the 3D-to-pixel pipeline.
#   tools/sprites3d/build_fighter.sh <id> [out_dir] [anims]
# out_dir defaults to tools/sprites3d/build/<id>/out (pass assets/fighters/<id>/3d to update the game assets).
# anims defaults to walk,run,idle,stance,dash.
set -euo pipefail
cd "$(dirname "$0")/../.."

id="${1:?fighter id}"
out="${2:-tools/sprites3d/build/$id/out}"
anims="${3:-walk,run,idle,stance,dash}"
config="tools/sprites3d/fighters/$id.json"
render="tools/sprites3d/build/$id/render"
blender="${BLENDER:-blender}"

[ -f "$config" ] || { echo "no config $config" >&2; exit 1; }
mkdir -p "$render" "$out"
"$blender" -b --python tools/sprites3d/blender/build.py -- \
  --config "$config" --out "$render" --anims "$anims" 2>&1 | grep -E "^\[sprites3d\]|Error|Traceback|  File" || true
[ -f "$render/build.json" ] || { echo "render failed" >&2; exit 1; }
python3 tools/sprites3d/post/process.py --config "$config" --build "$render" --out "$out" --preview-dir "$out/preview"
