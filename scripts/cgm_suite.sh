#!/usr/bin/env bash
# CGM regression suite for a watch face using pebble-cgm (emery emulator).
# Usage: cgm_suite.sh <repo-dir> <uuid> <config-storage-key> <cfg-nightscout-json> <cfg-ipump-json> <cfg-fallback-json> <out-dir>
# Cases: 1 Nightscout mock, 2 sleeping iPump-mini mock (wake schedule), 3 restart while sleeping
#        (last value shown), 4 fallback (no local server, Nightscout mock).
export PATH=$HOME/.local/bin:$PATH PYTHONUNBUFFERED=1
T=/root/workspace/projects/casiocgm/test
REPO=$1 UUID=$2 SKEY=$3 CNS=$4 COMP=$5 CFB=$6 OUT=$7
CASES=${CASES:-1234}   # e.g. CASES=4 runs only the fallback case
mkdir -p "$OUT"; cd "$REPO"
inject() { python3 - "$UUID" "$SKEY" "$1" <<'PY'
import dbm.dumb, json, os, sys
uuid, key, cfg = sys.argv[1], sys.argv[2], sys.argv[3]
active = os.path.realpath(os.path.expanduser("~/.local/share/pebble-sdk/SDKs/current")).split("/")[-1]
path = os.path.expanduser(f"~/.local/share/pebble-sdk/{active}/emery/localstorage/{uuid}")
os.makedirs(os.path.dirname(path), exist_ok=True)
db = dbm.dumb.open(path, "c"); db[key] = json.dumps(json.loads(cfg))
for k in list(db.keys()):
    if k.decode().endswith("_ompsync") or k.decode().endswith("_upload_lag"): del db[k]
db.close()
PY
}
killmocks() { pgrep -f "python3 .*mock_om[p]" | xargs -r kill; pgrep -f "python3 .*mock_n[s]" | xargs -r kill; fuser -k 8765/tcp 17580/tcp >/dev/null 2>&1; sleep 1; }
logs() { ( timeout "$1" pebble logs --emulator emery > "$OUT/$2.log" 2>&1 ) & }
shot() { pebble screenshot --emulator emery --no-open "$OUT/$1.png" >/dev/null 2>&1; }
pebble kill >/dev/null 2>&1; pebble wipe >/dev/null 2>&1; sleep 1; killmocks
( timeout 1500 pebble install --emulator emery build/*.pbw > "$OUT/emu.log" 2>&1 ) &
sleep 40
if [[ $CASES == *1* ]]; then
echo "== 1 nightscout"
python3 $T/mock_ns.py 8765 142 FortyFiveUp 3 2 > "$OUT/ns1.log" 2>&1 &
inject "$CNS"; timeout 60 pebble install --emulator emery build/*.pbw >/dev/null 2>&1; logs 40 case1; sleep 25; shot case1-nightscout
echo "ns hits: $(grep -c GET "$OUT/ns1.log")"; killmocks
fi
if [[ $CASES == *2* ]]; then
echo "== 2 ipump-mini sleeping"
python3 $T/mock_omp.py 120 25 > "$OUT/omp.log" 2>&1 &
inject "$COMP"; timeout 60 pebble install --emulator emery build/*.pbw >/dev/null 2>&1; logs 270 case2; sleep 260; shot case2-ipump
cat "$OUT/omp.log"
echo "== 3 restart while sleeping"
while tail -1 "$OUT/omp.log" | grep -q WAKE; do sleep 2; done
timeout 60 pebble install --emulator emery build/*.pbw >/dev/null 2>&1; sleep 5; shot case3-restart; killmocks
fi
if [[ $CASES == *4* ]]; then
echo "== 4 fallback (app ran, then stops)"
python3 $T/mock_omp.py 120 25 > "$OUT/omp4.log" 2>&1 &
inject "$CFB"; timeout 60 pebble install --emulator emery build/*.pbw >/dev/null 2>&1; logs 420 case4
for i in $(seq 1 70); do grep -q GET "$OUT/omp4.log" && break; sleep 2; done
echo "schedule learned: $(grep -m1 GET "$OUT/omp4.log")"; sleep 3; killmocks
python3 $T/mock_ns.py 8765 140 Flat 1 1 > "$OUT/ns4.log" 2>&1 &
date +%H:%M:%S; sleep 200; shot case4-fallback; grep GET "$OUT/ns4.log" | head -3
echo "fallback ns hits: $(grep -c GET "$OUT/ns4.log")"; killmocks
fi
pebble kill >/dev/null 2>&1
echo DONE
