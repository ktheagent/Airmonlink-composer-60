# Airmonlink Composer 1.2.0 Build 40 Architecture

## Canonical model
`src/core/score-model.js` is the authoritative semantic score. Staff rendering, Tonic Sol-fa, lyrics, playback, MIDI, linked parts, interchange and publishing consume the same event identities.

Every user edit enters through `src/composer3/engine-api.js`. The engine wraps semantic mutations in history transactions, validates the score, invalidates downstream state through change events and exposes one state snapshot to the interface.

## Major services
- `professional-editing.js`: canonical note/chord/rest and selection operations.
- `notation-system-service.js`: meter, accidentals, marks, spanners and navigation.
- `choir-solfa-service.js`: Tonic Sol-fa, lyrics, SATB and synchronization.
- `parts-engraving-service.js`: linked parts, cues, ranges and visual overrides.
- `practice-audio-service.js`: mixer, practice presets, MIDI quantization and PCM WAV.
- `composition-hub-service.js`: context-aware assistance, preview and analysis.
- `file-publishing-service.js`: integrity, migrations, transactions, templates and plugins.
- `productivity-reliability-service.js`: palette, tasks, validation, accessibility and budgets.
- `release-audit-service.js`: requirements and release-gate evidence.

## Desktop boundaries
The Electron renderer uses context isolation and no Node integration. The preload bridge exposes narrow IPC methods. The HTML applies a restrictive Content Security Policy. File, URL and plugin inputs are validated before privileged operations.

## Workspace
The five connected modes are Setup, Write, Engrave, Play and Publish. They select the relevant command context without creating separate score models.
