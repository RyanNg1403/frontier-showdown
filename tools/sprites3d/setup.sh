#!/usr/bin/env bash
# One-time setup for the 3D-to-pixel pipeline: headless Blender 4.5 LTS, the MPFB extension
# (MakeHuman for Blender: CC0 base mesh, targets and rigs) and the Python imaging packages.
#   tools/sprites3d/setup.sh [install_dir]
set -euo pipefail

BLENDER_VERSION="4.5.9"
BLENDER_SERIES="4.5"
MPFB_URL="https://extensions.blender.org/download/sha256:c075b3e9b94b8e5556a5f03f4653602d02ea306de08126e8f55ed6dee28a2dad/add-on-mpfb-v2.0.18.zip"
dest="${1:-$HOME/.local/opt}"
mkdir -p "$dest"

if ! command -v blender >/dev/null 2>&1; then
  tarball="blender-${BLENDER_VERSION}-linux-x64.tar.xz"
  # download.blender.org rejects scripted downloads; the official mirrors serve the same files.
  for mirror in https://ftp.nluug.nl/pub/graphics/blender/release https://mirrors.ocf.berkeley.edu/blender/release; do
    if curl -fsSL -o "$dest/$tarball" "$mirror/Blender${BLENDER_SERIES}/$tarball"; then break; fi
  done
  tar -xf "$dest/$tarball" -C "$dest" && rm "$dest/$tarball"
  mkdir -p "$HOME/.local/bin"
  ln -sf "$dest/blender-${BLENDER_VERSION}-linux-x64/blender" "$HOME/.local/bin/blender"
  export PATH="$HOME/.local/bin:$PATH"
fi
blender -b --version | head -1

if ! blender -b --python-expr "import bl_ext.user_default.mpfb" >/dev/null 2>&1; then
  curl -fsSL -o /tmp/mpfb.zip "$MPFB_URL"
  blender -b --python-expr "import bpy; bpy.ops.extensions.package_install_files(repo='user_default', filepath='/tmp/mpfb.zip', enable_on_install=True); bpy.ops.wm.save_userpref()"
fi

python3 -m pip install --user -q numpy pillow scipy 2>/dev/null \
  || python3 -m pip install --user --break-system-packages -q numpy pillow scipy
echo "sprites3d setup done"
