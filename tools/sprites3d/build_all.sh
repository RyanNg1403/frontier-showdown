#!/usr/bin/env bash
# Rebuild every fighter's atlas into assets/fighters/<id>/ (JOBS fighters at a time, default 4).
#   tools/sprites3d/build_all.sh [id ...]
set -euo pipefail
cd "$(dirname "$0")/../.."
ids=("$@")
if [ ${#ids[@]} -eq 0 ]; then
  ids=($(ls tools/sprites3d/fighters/*.json | xargs -n1 basename | sed 's/\.json$//'))
fi
mkdir -p tools/sprites3d/build
printf '%s\n' "${ids[@]}" | xargs -P "${JOBS:-4}" -I{} sh -c \
  'tools/sprites3d/build_fighter.sh {} assets/fighters/{} > tools/sprites3d/build/{}.log 2>&1 && echo "ok {}" || echo "FAILED {} (see tools/sprites3d/build/{}.log)"'
