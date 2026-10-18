# Integration

## 1. Copy the files
`scripts/sync.sh <watchface-repo>` copies `js/cgm.js` to `src/pkjs/` (or `src/js/`) and `c/cgm.{h,c}` to `src/c/`. Commit the copies; re-run after library updates. Set `"enableMultiJS": true` in `package.json`.

## 2. Message keys
Add to `messageKeys` in `package.json` (names are suggestions):

| Key | Direction | Content |
|---|---|---|
| `CGM_STATUS` | phone → watch | `CgmStatus` (0 OK … 5 NO_URL) |
| your value keys | phone → watch | formatted value, delta, trend, timestamp – as your face needs |
| `CGM_SOURCE` | phone → watch | 1 = value from the Nightscout fallback (draw the cloud) |
| `CGM_WAKE_NEXT` | phone → watch | next iPump-mini wake, Unix seconds |
| `CGM_WAKE_INTERVAL` | phone → watch | wake interval in seconds (usually 300) |
| `REQUEST_BG` | watch → phone | "fetch now" – call `cgm.fetchNow()` |

## 3. Settings
`settings()` returns:

| Field | Meaning |
|---|---|
| `source` | `'nightscout'` (default) or `'ipumpmini'` |
| `nsUrl`, `nsToken` | Nightscout base URL and optional token (also the fallback for iPump-mini) |
| `ompUrl` | iPump-mini server, default `http://127.0.0.1:17580` |
| `ompFallback` | true: use Nightscout when iPump-mini is unreachable |
| `sensorMin` | sensor interval in minutes (5) |
| `sync`, `manualMin` | plan fetches after the reading (default) or poll every `manualMin` |

In your configuration page offer: data source (Nightscout / iPump-mini), the Nightscout fields, the iPump-mini server (prefilled) and "Nightscout as fallback".

## 3a. Sending messages
Send everything through the library's queue (one message in flight, ack timeout, retries):
```js
var outbox = require('./cgm').outbox('myface');
outbox.send(msg, 'BG', { key: 'bg' });          // onReading / onStatus
outbox.send(wakeMsg, 'wake', { key: 'wake' });  // onWakeSchedule
```
Messages with the same `key` replace each other while they wait. Plain `Pebble.sendAppMessage` calls back to back fail with `APP_MSG_BUSY`, and a send that never calls back blocks a hand-written queue.

## 4. Watch side
- **Status:** on `NO_DATA`, `NO_CONN`, `NO_URL` clear the value; on `NO_APP` show a hint such as "OPEN APP / IPUMP-MINI"; on `OLD` keep the value (it is just stale).
- **Last value:** after every valid reading `cgm_last_save()`, at start `cgm_last_load()` with a max age (e.g. 6 h) and show it; compute staleness from `ts`.
- **Wake timer:** `cgm_wake_init(request_bg_fetch)` in `init()`, `cgm_wake_handle_inbox()` in the inbox handler, `cgm_wake_deinit()` in `deinit()`. `request_bg_fetch` should call `cgm_send_request(MESSAGE_KEY_REQUEST_BG)` (retries while the outbox is busy).
- **Bluetooth lost:** show "no connection" immediately (watch side, not the library).

## 5. Testing
- `test/run.sh`: PC simulation of the JS and the watch timer (Node, cc), no SDK needed.
- Nightscout: a mock `/pebble` on `127.0.0.1` in the emulator.
- iPump-mini: a mock that is reachable only 25 s every 120 s and returns `ompSync` – the watch should fetch ~3 s after each wake and not in between.
- Fallback: no local server, Nightscout mock – one Nightscout request after ~7 min.
