// Simulation tests for js/cgm.js with a fake clock: node test/cgm.test.js
'use strict';
var path = require('path');
var assert = require('assert');

// ── Fake clock, timers, localStorage, Pebble, XMLHttpRequest ─────────────────
var now = Date.UTC(2026, 9, 18, 12, 0, 0), timers = [], timerSeq = 0;
function setup() {
  timers = []; timerSeq = 0;
  global.Date.now = function () { return now; };
  global.setTimeout = function (fn, ms) { var id = ++timerSeq; timers.push({ id: id, at: now + (ms || 0), fn: fn }); return id; };
  global.clearTimeout = function (id) { timers = timers.filter(function (t) { return t.id !== id; }); };
  var store = {};
  global.localStorage = { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { store[k] = String(v); } };
  global.console = { log: function () { if (process.env.VERBOSE) process.stdout.write(new Date(now).toISOString().slice(11, 19) + ' ' + [].join.call(arguments, ' ') + '\n'); } };
}
function advance(ms) {
  var end = now + ms;
  for (;;) {
    timers.sort(function (a, b) { return a.at - b.at || a.id - b.id; });
    var t = timers[0];
    if (!t || t.at > end) break;
    timers.shift();
    now = Math.max(now, t.at);
    t.fn();
  }
  now = end;
}

// Mock iPump-mini server: awake for `window` s after each wake (every `interval` s from
// `phase`); requests while asleep are refused immediately. `announced` shifts the
// nextWake it reports (simulates a schedule that no longer matches).
function ompServer(o) {
  var srv = { hits: 0, okHits: 0 };
  srv.awake = function () { var t = (now / 1000 - o.phase) % o.interval; if (t < 0) t += o.interval; return t < o.window; };
  srv.handle = function (req) {
    srv.hits++;
    if (!srv.awake()) { setTimeout(function () { req.onerror && req.onerror(); }, 50); return; }
    srv.okHits++;
    var lastWake = Math.floor((now / 1000 - o.phase) / o.interval) * o.interval + o.phase;
    var body = { status: [{ now: now }], bgs: [{ sgv: '120', bgdelta: '1', direction: 'Flat', datetime: lastWake * 1000 }],
                 ompSync: { lastWake: lastWake * 1000, nextWake: (lastWake + o.interval + (o.shift || 0)) * 1000, intervalSec: o.interval, windowSec: o.window } };
    setTimeout(function () { req.status = 200; req.responseText = JSON.stringify(body); req.onload(); }, 100);
  };
  return srv;
}
var server = null;
global.XMLHttpRequest = function () {};
XMLHttpRequest.prototype.open = function (m, url) { this.url = url; };
XMLHttpRequest.prototype.abort = function () {};
XMLHttpRequest.prototype.send = function () { server.handle(this); };

function load() {
  var p = path.join(__dirname, '..', 'js', 'cgm.js');
  delete require.cache[p];
  return require(p);
}

// ── Tests ────────────────────────────────────────────────────────────────────
var tests = {};

tests['outbox: lost callback does not block the queue'] = function () {
  setup();
  var sent = [], mode = 'lose';
  global.Pebble = { sendAppMessage: function (msg, ok, fail) {
    sent.push(msg.n);
    if (mode === 'lose') { mode = 'ack'; return; }   // first send never calls back
    setTimeout(ok, 200);
  } };
  var box = load().outbox('t');
  var acked = [];
  box.send({ n: 1 }, 'one', { ok: function () { acked.push(1); } });
  box.send({ n: 2 }, 'two', { ok: function () { acked.push(2); } });
  advance(15000);
  assert.deepStrictEqual(acked, [1, 2], 'both delivered after the ack timeout');
  assert.strictEqual(box.size(), 0);
};

tests['outbox: lost callback with throttled timers, next send() recovers'] = function () {
  setup();
  var sent = [], first = true;
  global.Pebble = { sendAppMessage: function (msg, ok) { sent.push(msg.n); if (first) { first = false; return; } ok(); } };
  var box = load().outbox('t');
  box.send({ n: 1 }, 'one');
  timers = [];            // timers never fire (throttled JS)
  now += 30000;
  box.send({ n: 2 }, 'two');
  assert.deepStrictEqual(sent, [1, 1, 2]);
  assert.strictEqual(box.size(), 0);
};

tests['outbox: same key replaces queued message'] = function () {
  setup();
  var sent = [];
  global.Pebble = { sendAppMessage: function (msg, ok) { sent.push(msg.n); setTimeout(ok, 500); } };
  var box = load().outbox('t');
  box.send({ n: 1 }, 'bg', { key: 'bg' });   // in flight
  box.send({ n: 2 }, 'bg', { key: 'bg' });   // queued
  box.send({ n: 3 }, 'bg', { key: 'bg' });   // replaces 2
  box.send({ n: 9 }, 'wake', { key: 'wake' });
  advance(5000);
  assert.deepStrictEqual(sent, [1, 3, 9]);
};

tests['outbox: NACK retried, then dropped after 3 tries'] = function () {
  setup();
  var sent = [];
  global.Pebble = { sendAppMessage: function (msg, ok, fail) { sent.push(msg.n); setTimeout(msg.n === 1 ? fail : ok, 100); } };
  var box = load().outbox('t');
  box.send({ n: 1 }, 'bad');
  box.send({ n: 2 }, 'good');
  advance(10000);
  assert.deepStrictEqual(sent, [1, 1, 1, 2]);
};

function ompCgm(readings, schedules) {
  global.Pebble = { sendAppMessage: function () {} };
  return load()({
    name: 't',
    settings: function () { return { source: 'ipumpmini', ompUrl: 'http://127.0.0.1:17580', sensorMin: 5, sync: true, manualMin: 5 }; },
    onReading: function (r) { readings.push(now); },
    onStatus: function () {},
    onWakeSchedule: function (n, i) { schedules.push(n); }
  });
}

tests['ipump-mini: follows the wake schedule'] = function () {
  setup();
  server = ompServer({ phase: 7, interval: 300, window: 25 });
  var readings = [], schedules = [];
  var cgm = ompCgm(readings, schedules);
  now = (Math.floor(now / 300000) * 300 + 7 + 5) * 1000;   // inside a window
  cgm.start();
  advance(30 * 60000);
  assert.ok(readings.length >= 6, 'one reading per wake, got ' + readings.length);
  assert.ok(server.hits <= readings.length * 2 + 2, 'no polling between wakes: ' + server.hits + ' hits');
};

tests['ipump-mini: shifted rhythm is found again by the search'] = function () {
  setup();
  // The stored schedule says wakes at :07, the app actually wakes 120 s later.
  server = ompServer({ phase: 127, interval: 300, window: 25 });
  var readings = [], schedules = [];
  var base = Math.floor(now / 300000) * 300;
  localStorage.setItem('t_ompsync', JSON.stringify({ next: (base + 307) * 1000, interval: 300000, window: 25000 }));
  var cgm = ompCgm(readings, schedules);
  now = (base + 200) * 1000;   // app asleep
  cgm.start();
  advance(12 * 60000);
  assert.ok(readings.length >= 1, 'search finds the shifted window');
  var first = readings[0];
  advance(20 * 60000);
  assert.ok(readings.length >= 5, 'back in rhythm, got ' + readings.length);
  assert.ok(first - (base + 200) * 1000 <= 7 * 60000, 'found within one interval + 1 min');
};

tests['ipump-mini: duplicate watch requests while pending are skipped'] = function () {
  setup();
  var pending = [];
  server = { handle: function (req) { pending.push(req); } };   // never answers
  var cgm = ompCgm([], []);
  cgm.start();
  cgm.fetchNow(); cgm.fetchNow();
  assert.strictEqual(pending.length, 1);
  now += 21000;
  cgm.fetchNow();
  assert.strictEqual(pending.length, 2, 'a request older than 20 s does not block');
};

tests['ipump-mini: start() re-sends the stored schedule'] = function () {
  setup();
  server = { handle: function () {} };
  var base = Math.floor(now / 300000) * 300;
  localStorage.setItem('t_ompsync', JSON.stringify({ next: (base - 900) * 1000, interval: 300000, window: 25000 }));
  var schedules = [];
  ompCgm([], schedules).start();
  assert.strictEqual(schedules.length, 1);
  assert.ok(schedules[0] * 1000 + 25000 >= now, 'extrapolated to the current/next wake');
};

var failed = 0;
Object.keys(tests).forEach(function (name) {
  try { tests[name](); process.stdout.write('ok   ' + name + '\n'); }
  catch (e) { failed++; process.stdout.write('FAIL ' + name + '\n     ' + e.message + '\n'); }
});
process.exit(failed ? 1 : 0);
