# Airmonlink Composer 1.1.12 Build 32 — Local Premium Checkpoint

GITHUB_EMBARGO_STATUS: ACTIVE
PROJECT_STATUS: IN PROGRESS — NOT FINAL

## Build assignment
Premium note input, selection and editing

## Implemented in this checkpoint
- Professional input state covers pitch-first, duration-first, rhythm-first, repitch, insert and overwrite modes.
- Chord input deduplicates pitches and creates one semantic chord in one undoable engine transaction.
- Single/double dots, grace and tuplet metadata are preserved by input.
- Voice exchange, staff movement, exact rest filling, selection summaries and Escape layering are implemented.
- Build 31 workspace and publishing regression suite remains green.

## Verification
- JavaScript syntax/lint: passed
- Automated tests: 247/247 passed
- GitHub reads/writes: none
- Windows compilation: not performed
- Physical MIDI/audio/printer testing: not performed

## Known limitations
- Windows installer and portable executables are not compiled in the local Linux environment.
- Touch hardware, physical MIDI devices, audio devices and printers are not tested.
- Advanced nested tuplet engraving and every microtonal glyph remain scheduled for Build 33.

## Exact next action
Continue with Build 33 notation, rhythm, symbol attachment and navigation.
