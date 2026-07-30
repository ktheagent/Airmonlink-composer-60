# Build 43 Rhythmic-Notation Implementation

## Scope

Build 43 repairs tuplets, beams, ties, slurs and four-voice stem behaviour on the
authoritative score model. It does not expand decorative feature breadth.

## Semantic operations

- `applyTuplet`: exactly N selected rhythmic onsets are retimed into N:M space.
- `applyManualBeam`: selected contiguous short-note onsets receive complete beam levels.
- `applyAutomaticBeams`: groups short notes by the active metre.
- `clearBeams`: removes beam data as one transaction.
- `createTie`: requires two adjacent notes of the same sounding pitch in one lane.
- `createSlur`: spans two or more ordered note positions in one lane.
- `stemDirection`: resolves explicit stems first, then four-voice and pitch policy.

Every operation is preflighted before mutation and uses the Composer engine history
transaction. Invalid requests leave the score unchanged.

## Rendering and interchange

Staff SVG output draws complete beam polygons, hooks, tuplet brackets/numbers,
ties, slurs, articulation marks and voice-aware stems. `.airscore` preserves the
semantic events and spanners. MusicXML emits time modification, tuplet, beam,
tie/tied and slur elements.

## Important correction

The engine constructor now honours an expressly supplied score instead of silently
creating a default lead score. Score normalization also avoids reconstructing a
second shorter slur or tie when an explicit spanner already begins on an event.
