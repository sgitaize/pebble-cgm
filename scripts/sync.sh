#!/bin/sh
# Copies the library into a watch face repository: scripts/sync.sh <repo> [js-dir]
# js-dir defaults to src/pkjs (use src/js for older projects).
set -e
LIB="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${1:?usage: sync.sh <watchface-repo> [js-dir]}"
JSDIR="${2:-src/pkjs}"
mkdir -p "$REPO/$JSDIR" "$REPO/src/c"
cp "$LIB/js/cgm.js" "$REPO/$JSDIR/cgm.js"
cp "$LIB/c/cgm.h" "$LIB/c/cgm.c" "$REPO/src/c/"
echo "pebble-cgm $(git -C "$LIB" describe --tags --always 2>/dev/null || echo dev) -> $REPO"
