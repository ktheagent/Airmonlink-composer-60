# Airmonlink Composer 1.1.15 Build 35 — Local Premium Checkpoint

GITHUB_EMBARGO_STATUS: ACTIVE
PROJECT_STATUS: IN PROGRESS — NOT FINAL

## Build assignment
Instruments, staves, linked parts and engraving

## Implemented in this checkpoint
- Professional ensemble templates cover solo, piano, choir, lead sheet, chamber, concert band, brass band, orchestra and percussion ensemble.
- Standard, grand, percussion, tablature, linked and ossia staff descriptors are normalized with four voice layers.
- Linked part descriptors reference authoritative source parts rather than duplicating musical events.
- Part-specific page setup, layout overrides, naming and deterministic batch-export plans are implemented.
- Cue notes preserve source IDs and are explicitly muted in playback.
- Manual visual overrides are isolated from onset, duration and pitch; engraving and range audits are covered.

## Verification
- JavaScript syntax/lint: passed
- Automated tests: 278/278 passed
- GitHub reads/writes: none
- Windows compilation: not performed
- Physical MIDI/audio/printer testing: not performed

## Known limitations
- Windows font rasterization, native batch PDF generation and physical print output are not verified locally.
- Advanced guitar bends, harp pedal diagrams and drum-map UI editing are represented by extensible staff data but not fully exposed in the interface.
- Part extraction files are planned and validated semantically; native Windows export remains for Build 38.

## Exact next action
Continue with Build 36 playback, mixer, MIDI, audio export and practice workflows.
