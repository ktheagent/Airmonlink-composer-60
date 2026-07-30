# Airmonlink Composer 1.1.16 Build 36 — Local Premium Checkpoint

GITHUB_EMBARGO_STATUS: ACTIVE
PROJECT_STATUS: IN PROGRESS — NOT FINAL

## Build assignment
Playback, mixer, MIDI, audio export and practice

## Implemented in this checkpoint
- Persistent mixer model provides instrument channels, mute, solo, volume, pan, reverb send, sound and master output settings.
- Practice presets support SATB voice isolation/emphasis, tempo scaling, loops, count-in, metronome, transposition and accompaniment-only mixes.
- MIDI configuration covers step-time/real-time modes, quantisation, latency, velocity, channel and note filters.
- Recorded MIDI events quantise deterministically and duplicate same-note events are removed.
- Audio export plans generate deterministic full-mix, stem and part filenames.
- A real deterministic PCM WAV renderer exports score events and excludes muted cue notes.

## Verification
- JavaScript syntax/lint: passed
- Automated tests: 287/287 passed
- GitHub reads/writes: none
- Windows compilation: not performed
- Physical MIDI/audio/printer testing: not performed

## Known limitations
- Physical audio output devices, MIDI keyboards and latency calibration are not tested in this environment.
- Compressed audio formats are intentionally not included without a verified lawful encoder; WAV is implemented.
- Windows native audio-device selection and long-score real-time playback remain unverified.

## Exact next action
Continue with Build 37 Premium Composition Hub, assisted composition and analysis.
