# Airmonlink Composer — Version 1.3.0 Build 60

Airmonlink Composer is a Windows desktop music-notation application built around
one canonical semantic score model shared by Staff notation, Tonic Sol-fa,
playback, parts and publishing.

## Current local checkpoint

This source continues the verified Build 50 baseline through product Builds
51–60. Build 60 integrates the professional workspace, semantic New Score
templates, direct note entry, rhythmic safety, four-voice editing, engraving,
Staff/Sol-fa/lyrics, playback, mixer, parts, publishing, accessibility,
performance and release-quality gates.

Visible identity:

```text
Airmonlink Composer
Version 1.3.0
Build 60
Build version 1.3.0.60
```

Expected Windows outputs after an authorized Windows workflow run:

```text
Airmonlink-Composer-1.3.0-Build60-Setup.exe
Airmonlink-Composer-1.3.0-Build60-Portable.exe
```

## Validation

```bash
npm ci --no-audit --no-fund
npm run version:check
npm run workflow:check
npm run lint
npm test
npm run audit:release
npm run performance
npm run preview
npm run browser-smoke
npm run viewport-matrix
npm run gate:build60
```

The complete requirement-level evidence is in:

- `docs/development/BUILD60-REQUIREMENTS-REGISTER.json`
- `docs/development/BUILD60-REQUIREMENTS-REGISTER.md`
- `docs/development/BUILD60-TRACEABILITY-MATRIX.md`
- `docs/development/BUILD60-AUDIT-CYCLES.json`
- `docs/development/BUILD60-COMPLETION-AUDIT.md`
- `docs/development/BUILD60-SELF-CRITIQUE.md`

## Release boundary

This local source checkpoint does not by itself prove Windows installation,
upgrade preservation, physical printing, physical MIDI/audio hardware,
code-signing, assistive-technology behavior or independent user acceptance.
Those external release-evidence items are recorded separately and do not replace
the completed locally verifiable software gate.

See `BUILDING-WINDOWS.md` for the authorized Windows release procedure.
