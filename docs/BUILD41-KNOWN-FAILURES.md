# Build 41 Known Failures and Boundaries

Build 41 is a functional-audit checkpoint, not a professional release.

## Intentionally hidden pending repair

- Direct note and rest entry
- Chord-tone and interval entry
- Dot and tuplet editing
- Selection-dependent notation commands
- Voices and layers editing commands
- Lyrics editing commands
- Direct Tonic Sol-fa editing commands
- Real-time MIDI and MIDI output
- Physical printing
- Composition Hub
- Engrave, Play and Publish workspace shortcuts

The semantic engine methods remain available for regression tests and later reconstruction, but these controls are not represented as production-complete.

## External verification not performed

- Windows compilation
- Setup installation and uninstall
- Portable executable startup
- Physical printer
- Audio device
- MIDI input/output hardware
- Human usability session on Build 41

## Exact next action

Build 42 must implement one professional staff-input path:

`place caret → choose duration → enter note/rest/chord → advance safely across measures → select/edit → undo/redo → save/reopen`

No hidden Build 41 command may be promoted merely by changing its registry status. It must gain command-level tests and manual Windows evidence.
