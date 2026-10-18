#!/bin/sh
# Runs the PC tests (no Pebble SDK needed): JS simulation and C wake timer simulation.
set -e
cd "$(dirname "$0")"
node cgm.test.js
OUT="${TMPDIR:-/tmp}/pebble-cgm-wake-sim"
cc -Wall -Wno-unused-parameter -Ic c/wake_sim.c -o "$OUT"
"$OUT"
