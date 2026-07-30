# Build 42 Verification Record

GITHUB_EMBARGO_STATUS: ACTIVE

## Automated semantic verification

`test/v122-build42-staff-input.test.js` proves:

- keypad duration and pitch mapping;
- safe segmentation at measure boundaries;
- tied note continuation across a barline;
- untied rest continuation across a barline;
- one-onset chord creation;
- duplicate-pitch rejection with exact rollback;
- dot overlap rejection with exact rollback;
- undo of a valid dotted value;
- ordered range selection;
- production keypad, caret and keyboard wiring;
- absence of the former hard-coded C4/MIDI-64 renderer commands.

The full source suite passed 348/348 tests.

## Rendered browser verification

The Chromium validation executes the real preview interface and proves:

- the notation keypad performs tied barline entry;
- active duration and active voice are reflected by the keypad;
- an insertion caret is rendered;
- chord tones are entered at one onset;
- duplicate chord pitches are rejected without a persistent failure banner;
- rest entry advances the same staff caret;
- the canonical model remains synchronized;
- the production workspace remains within the viewport.

Browser result: 52/52 checks passed.

## Page and viewport verification

- Four viewport/display-scale scenarios passed 36/36 geometry checks.
- Staff and Tonic Sol-fa screenshots were generated.
- A print PDF was generated.
- These are automated Linux Chromium checks, not human Windows approval.

## Not verified

- Windows Setup or Portable compilation for Build 42
- Windows installed and portable startup
- Physical keyboard/MIDI latency and device handling
- Audio-device output
- Printer hardware and driver behavior
- Real-user usability acceptance
- Professional engraving equivalence to established notation software
