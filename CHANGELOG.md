# Changelog

## 1.0.0 (2026-10-15)
- First release: Nightscout and iPump-mini sources, wake schedule, fallback with flag, watch-driven wake timer, last value storage, status codes incl. NO_APP, cloud icon. Extracted from CasioCGM 2.4.5.
- With a known wake schedule the Nightscout fallback starts 45 s after a missed iPump-mini window (instead of 6 min).
- `scripts/cgm_suite.sh`: emulator regression suite (Nightscout, sleeping iPump-mini, restart, fallback); used by CasioCGM 2.5.0, Nightscout-supercgm 2.7 and 91 Dub CGM 1.2.0.
