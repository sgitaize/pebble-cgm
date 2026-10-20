# pebble-cgm

[English](README.md) · **Deutsch**

Gemeinsame CGM-Logik für **Pebble-Watchfaces**: Glukosewerte aus **Nightscout** oder der iPhone-App **iPump-mini** (lokal, ohne Internet) holen, den letzten Wert über Neustarts retten und im Takt der Quelle bleiben – damit nicht jedes CGM-Watchface das neu bauen muss.

Genutzt von [CasioCGM](https://github.com/sgitaize/casiocgm), [Nightscout-supercgm](https://github.com/sgitaize/Nightscout-supercgm) und [91 Dub CGM](https://github.com/sgitaize/dubv4cgm).

**Status:** 1.1.0 · im Einsatz in drei Watchfaces im Pebble Appstore · wird aktiv gepflegt

## So kommst du dran

| | |
|---|---|
| **In dein Watchface kopieren** | `scripts/sync.sh <dein-repo>` legt `js/cgm.js` und `c/cgm.{c,h}` in die passenden Ordner |
| **Releases** | [GitHub-Releases](https://github.com/sgitaize/pebble-cgm/releases/latest) · Änderungen im [CHANGELOG.md](CHANGELOG.md) |
| **Einbau-Anleitung** | [docs/integration.md](docs/integration.md) – Nachrichten-Schlüssel, Einstellungsfelder, Schritt für Schritt (Englisch) |

> Kein Medizinprodukt. Watchfaces mit dieser Bibliothek zeigen nur Informationen an; Therapieentscheidungen gehören zu CGM/Pumpe und deinem Behandlungsteam.

## Was sie kann

| | |
|---|---|
| **Nightscout** (Standard) | `GET <url>/pebble` (mit Token). Der nächste Abruf richtet sich nach dem Zeitstempel des Werts plus einer **gelernten Upload-Verzögerung** – die Uhr holt direkt nach einem neuen Wert, statt ständig zu fragen. |
| **iPump-mini** (optional) | Liest den lokalen, Nightscout-kompatiblen Server der App [iPump-mini](https://github.com/sgitaize/iPump-mini) auf demselben iPhone (`http://127.0.0.1:17580`), ohne Internet. iOS lässt die App nach jedem Pumpen-Update nur ~25 s laufen; `/pebble` meldet diesen **Weckplan** (`ompSync`), und die Bibliothek fragt genau dann. |
| **Ersatzquelle** | Mit iPump-mini als Quelle kann Nightscout einspringen – erst nach einem verpassten Weckfenster und höchstens alle 4,5 min (Internet kostet Akku). Ersatzwerte sind markiert, damit das Watchface eine kleine Wolke zeigen kann. |
| **Weckruf von der Uhr** | Timer in PebbleKit JS werden gedrosselt, solange die Handy-App im Hintergrund ist. Die Uhr hält die Zeit zuverlässig, bekommt den nächsten Weckzeitpunkt vom JS und fragt das Handy genau dann. |
| **Letzter Wert** | Auf der Uhr gespeichert und nach einem Neustart des Watchfaces (Mitteilung, andere App) sofort wieder da, altert nach seinem Zeitstempel – kein kurzes „keine Verbindung“. |
| **Status** | `OK`, `NO_DATA`, `NO_CONN`, `OLD`, `NO_APP` (iPump-mini 15 min nicht erreichbar: „App öffnen“), `NO_URL`. |
| **Robust** | AppMessage-Warteschlange mit Bestätigungs-Timeout und Zusammenfassen, Suche nach verpasstem Weckfenster, immer nur eine Anfrage, Schutz vor XHRs ohne Rückmeldung, mmol/L-Erkennung. |

## Architektur

<p align="center"><img src="docs/architecture.png" alt="Architektur: Auf der Uhr hält cgm.c den letzten Wert und einen Weck-Timer für dein Watchface; auf dem Handy hat cgm.js eine Sendewarteschlange, einen Zeitplaner und die Quellen-Logik für Nightscout oder iPump-mini" width="100%"></p>

<sub>Quelle: <a href="docs/architecture.mmd">docs/architecture.mmd</a> (Mermaid)</sub>

**So funktioniert es**
- **Zwei Hälften, ein Vertrag.** `js/cgm.js` läuft in PebbleKit JS auf dem Handy und erledigt das Netzwerk; `c/cgm.c` läuft auf der Uhr und hält Zeit, Zustand und letzten Wert. Beide sprechen über eine Handvoll AppMessage-Schlüssel.
- **Abrufen, wenn es Neues gibt.** Der Zeitplaner plant die nächste Anfrage aus dem Zeitstempel plus gelernter Upload-Verzögerung (Nightscout) oder aus dem Weckplan von iPump-mini (`ompSync`).
- **Die Uhr gibt den Takt vor.** JS-Timer werden im Hintergrund gedrosselt, also wacht die Uhr selbst auf und schickt `REQUEST_BG` genau dann, wenn der nächste Wert fällig ist.
- **Nichts geht verloren.** Die Warteschlange schickt immer eine Nachricht, wartet auf die Bestätigung (mit Timeout), fasst veraltete Nachrichten zusammen und versucht es erneut.

| Baustein | Ort | Aufgabe |
|---|---|---|
| Handy-Modul | `js/cgm.js` | Quelle, Ersatzquelle, Zeitplaner, Parser, Warteschlange (braucht `"enableMultiJS": true`) |
| Uhr-Modul | `c/cgm.h`, `c/cgm.c` | Statuscodes, Speicher für den letzten Wert, Weck-Timer, Wolken-Symbol |
| Doku | `docs/integration.md`, `docs/ipump-mini.md` | Einbau Schritt für Schritt, der Weckplan `ompSync` |
| Sync-Skript | `scripts/sync.sh` | kopiert die Bibliothek in ein Watchface-Repository |
| Tests | `test/run.sh` | JS-Simulation und Simulation des Uhr-Timers auf dem PC |

## Schnellstart

```js
// src/pkjs/index.js
var cgm = require('./cgm')({
  name: 'myface',
  settings: function () { return { source: cfg.source, nsUrl: cfg.nsUrl, nsToken: cfg.nsToken,
                                   ompUrl: cfg.ompUrl, ompFallback: cfg.ompFallback,
                                   sensorMin: 5, sync: true, manualMin: 5 }; },
  onReading: function (r) { /* r.sgvMgdl, r.deltaMgdl, r.direction, r.tsSec, r.fallback formatieren und senden */ },
  onStatus: function (code) { /* 'NO_DATA' | 'NO_CONN' | 'NO_APP' | 'NO_URL' → Status senden */ },
  onWakeSchedule: function (next, interval) { /* an die Uhr: CGM_WAKE_NEXT, CGM_WAKE_INTERVAL */ }
});
var outbox = require('./cgm').outbox('myface');   // outbox.send(msg, label, {key: 'bg'})
Pebble.addEventListener('ready', function () { cgm.start(); });
// wenn die Uhr deinen REQUEST_BG-Schlüssel schickt: cgm.fetchNow();
```

```c
// src/c/main.c
#include "cgm.h"
cgm_wake_init(request_bg_fetch);                                   // in init()
cgm_send_request(MESSAGE_KEY_REQUEST_BG);                          // in request_bg_fetch()
cgm_wake_handle_inbox(iter, MESSAGE_KEY_CGM_WAKE_NEXT, MESSAGE_KEY_CGM_WAKE_INTERVAL);  // Inbox
cgm_last_save(PERSIST_KEY_CGM, &last);  /  cgm_last_load(PERSIST_KEY_CGM, &last, 6 * 3600);
cgm_draw_cloud(ctx, GPoint(x, y), color);                          // wenn last.fallback
```

Details: [docs/integration.md](docs/integration.md).

## Status & Pläne

- **1.1.0** (Oktober 2026): Stabilitäts-Fixes – die Uhr hört nicht mehr auf zu aktualisieren, ein verschobener iPump-mini-Rhythmus wird wiedergefunden, verlorene Anfragen werden wiederholt.
- Im Einsatz in [CasioCGM](https://github.com/sgitaize/casiocgm), [Nightscout-supercgm](https://github.com/sgitaize/Nightscout-supercgm) und [91 Dub CGM](https://github.com/sgitaize/dubv4cgm).
- Ideen und Fehler gerne als [Issue](https://github.com/sgitaize/pebble-cgm/issues).

## Lizenz

MIT – nutz sie gern in deinen eigenen Watchfaces. Eine Namensnennung freut mich.
