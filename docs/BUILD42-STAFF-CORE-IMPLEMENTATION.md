# Build 42 — Staff Core and Note-Input Reconstruction

GITHUB_EMBARGO_STATUS: ACTIVE

## Identity

- Product: Airmonlink Composer 3
- Version: 1.2.2
- Build: 42
- Status: local source-validated corrective checkpoint; not a professional release
- Baseline: Version 1.2.1 Build 41 functional-audit checkpoint

## Defects addressed

The Build 40 user recording showed that basic note entry could cross a barline and
fail, chord entry depended on an unclear selection, dots could create overlaps,
the active input position was difficult to see, and note entry was scattered across
large ribbon groups.

Build 42 introduces one direct staff-input loop:

1. place or move the insertion caret;
2. choose a duration;
3. choose Voice 1–4;
4. enter A–G, a rest, or a chord tone;
5. advance to the next rhythmic position;
6. split and tie a note safely when it crosses a barline;
7. reject conflicts without leaving a persistent technical-error banner.

## Production implementation

- Added `src/composer3/staff-input-service.js` for duration, pitch, beat snapping,
  measure segmentation, range selection and input context.
- Added a persistent collapsible notation keypad.
- Added direct A–G note input, R rest input, Shift+A–G chord-tone input,
  1–7 duration selection, Alt+1–4 voice selection, dot and octave shortcuts.
- Added a visible staff insertion caret with bar/beat/voice context.
- Added pointer placement on staff hit targets and Shift range selection.
- Replaced hard-coded C4 and MIDI-64 production commands with the active keypad state.
- Made note and rest entry automatically split at physical measure boundaries.
- Added semantic ties between split note segments.
- Added last-entry chord anchoring and duplicate-pitch rejection.
- Made augmentation-dot editing preflight barline and overlap conflicts atomically.
- Made engine transactions restore the exact previous score and selection on failure.
- Promoted 13 staff-core commands only after new automated evidence.
- Kept unverified tuplets, beaming, slurs and advanced notation commands hidden.

## Control contract

- Production commands registered: 106
- Verified and visible: 56
- Partially functional and hidden: 41
- Broken and hidden: 2
- Hardware-blocked and hidden: 7
- Dedicated Build 42 keypad controls traced: 23

See:

- `CONTROL-ENGINE-TRACEABILITY.csv`
- `BUILD42-INPUT-CONTROL-TRACEABILITY.csv`
- `BUILD42-KNOWN-LIMITATIONS.md`
- `BUILD42-VERIFICATION.md`

## Validation

- JavaScript syntax: 89 files passed
- Automated tests: 348/348 passed
- Browser interaction checks: 52/52 passed
- Viewport matrix: 36/36 passed
- Performance gates: 6/6 passed
- Preview and PDF evidence generated

Windows compilation, installer/portable execution, physical MIDI/audio/printer
testing and human Windows usability testing were not performed.
