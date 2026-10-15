#!/bin/sh
# Copies the library into a watch face repository: scripts/sync.sh <repo> [js-dir] [c-dir]
# js-dir defaults to src/pkjs (src/js for older projects), c-dir to src/c (src if the
# project keeps its C files there).
set -e
LIB="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${1:?usage: sync.sh <watchface-repo> [js-dir]}"
JSDIR="${2:-src/pkjs}"
CDIR="${3:-src/c}"
mkdir -p "$REPO/$JSDIR" "$REPO/$CDIR"
cp "$LIB/js/cgm.js" "$REPO/$JSDIR/cgm.js"
cp "$LIB/c/cgm.h" "$LIB/c/cgm.c" "$REPO/$CDIR/"
echo "pebble-cgm $(git -C "$LIB" describe --tags --always 2>/dev/null || echo dev) -> $REPO"
