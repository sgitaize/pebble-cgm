# iPump-mini wake schedule (`ompSync`)

iPump-mini reads a MiniMed 780G over Bluetooth and serves a Nightscout-compatible API on port 17580. iOS suspends the app between pump updates; the server is reachable for ~25 s after each update (every 5 min). `/pebble` therefore adds:

```json
"ompSync": {"lastWake": 1792012800000, "nextWake": 1792013100000, "intervalSec": 300, "windowSec": 25}
```

- `lastWake`, `nextWake`: ms since 1970, server clock (compare with `status[0].now`).
- `intervalSec`: learned from recent wake-ups.
- `windowSec`: how long the server stays reachable after a wake.

`js/cgm.js` converts the times to phone time, fetches 2–3 s after `nextWake`, retries every 3 s inside the window and stays quiet otherwise. Requests made while the app sleeps are refused immediately (connection refused) or answered when the app wakes.
