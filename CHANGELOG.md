# Changelog

## 1.1.0 (2026-10-18)
Fixes the watch occasionally stopping to update or drifting out of the iPump-mini rhythm until the face was restarted.
- **AppMessage queue** `require('./cgm').outbox(name)`: an unanswered `sendAppMessage` (phone app suspended mid-send) counts as failed after 10 s instead of blocking the queue for good; checked by a timer and on every send, since JS timers may be throttled. Retries, coalescing by key (`bg`, `wake`), max. 16 queued. Use it for all messages of the face.
- **Search after a missed wake window** (JS and watch): when the app's rhythm has shifted, one request every 15 s for one interval + 1 min until a response brings the new schedule; repeated after 30 min while the app stays unreachable. Before, every request kept hitting the old window and the schedule was never re-learned.
- **One request at a time**: watch requests while one is pending (< 20 s) are skipped; answers of requests superseded by a newer success are ignored.
- `start()` re-sends the stored wake schedule, so a restarted face has its wake timer right away.
- `cgm_send_request(key)` (C): the "request BG" message retries while the outbox is busy instead of being dropped.
- PC tests: `test/run.sh` (JS simulation with fake clock, C wake timer simulation).

## 1.0.0 (2026-10-15)
- First release: Nightscout and iPump-mini sources, wake schedule, fallback with flag, watch-driven wake timer, last value storage, status codes incl. NO_APP, cloud icon. Extracted from CasioCGM 2.4.5.
- With a known wake schedule the Nightscout fallback starts 45 s after a missed iPump-mini window (instead of 6 min).
- `scripts/cgm_suite.sh`: emulator regression suite (Nightscout, sleeping iPump-mini, restart, fallback); used by CasioCGM 2.5.0, Nightscout-supercgm 2.7 and 91 Dub CGM 1.2.0.
