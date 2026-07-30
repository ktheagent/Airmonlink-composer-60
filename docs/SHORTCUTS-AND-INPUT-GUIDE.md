# Shortcuts and Input — Build 42

## Staff note input

- `A`–`G`: enter a note using the selected octave, duration and voice
- `Shift+A`–`Shift+G`: add a chord tone to the last entered or selected note
- `R`: enter a rest
- `1`: whole note
- `2`: half note
- `3`: quarter note
- `4`: eighth note
- `5`: sixteenth note
- `6`: thirty-second note
- `7`: sixty-fourth note
- `.`: toggle the pending or selected augmentation dot
- `+` / `-`: move the pending input octave
- `Alt+1`–`Alt+4`: select Voice 1–4
- `Left` / `Right`: move selection or the insertion caret
- `Shift+Left` / `Shift+Right`: extend event-range selection
- `Up` / `Down`: transpose selected notes
- `Delete` / `Backspace`: delete the selected musical events
- `Escape`: clear selection and return to neutral note input

Click an empty staff position to place the insertion caret. Click an event to
select it. Shift-click another event to select the event range between them.

## File and editing

- `Ctrl+K`: command palette
- `Ctrl+N`: new score
- `Ctrl+O`: open
- `Ctrl+S`: save
- `Ctrl+Shift+S`: save as
- `Ctrl+Z`: undo
- `Ctrl+Y`: redo
- `Ctrl+C`: copy
- `Ctrl+V`: paste

Only functionally verified commands are exposed in the production interface.
Composition Hub and unverified advanced notation controls remain hidden.


## Build 43 rhythmic notation

| Shortcut | Operation | Required context |
|---|---|---|
| Ctrl+3 | Convert selection to a 3:2 triplet | Exactly three rhythmic onsets in one lane |
| Ctrl+B | Beam selected notes | Two or more contiguous short-note positions |
| Ctrl+Shift+B | Apply automatic beaming | Selected short-note positions in one lane |
| Ctrl+T | Create tie | Two adjacent equal-pitch notes in one lane |
| Ctrl+L | Create slur | Two or more ordered notes in one lane |

The same operations are available from the notation keypad. Invalid context is
rejected before mutation and leaves the score unchanged.
