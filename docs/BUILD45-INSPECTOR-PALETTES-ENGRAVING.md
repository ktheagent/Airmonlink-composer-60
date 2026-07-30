# Build 45 — Inspector, Palettes, Composition Hub and Engraving

Build 45 replaces the score-summary-only inspector with a selected-object
property editor backed by the authoritative score model.

Verified behavior:

- Pitch, duration, voice, visibility, placement, alignment, stem, beam,
  notehead, articulation, playback, text/font, colour, part visibility and
  Tonic Sol-fa properties have normalized inspector representations.
- Inspector edits validate the complete selection before mutation, form one
  undoable transaction, and survive `.airscore` reopening.
- Manual engraving offsets and reset operations preserve pitch, onset and
  duration.
- The notation palette supports click-to-apply, typed drag-to-score payloads,
  staff/event drop validation, search, favourites, recent symbols and
  contextual enablement.
- Palette symbols call real engine methods for notes, rests, articulations,
  fermatas, ties, slurs and beams.
- Composition Hub retains eight real workflow groups with guided analysis,
  composition and harmony previews applied as undoable score edits.
- The layout engine retains content-aware rhythmic spacing, lyric allowance,
  chord collision offsets, measure stretching and forced system/page breaks.

Build 45 is an intermediate source checkpoint. It is not a functional release
candidate and does not claim Windows installer or physical printer validation.
