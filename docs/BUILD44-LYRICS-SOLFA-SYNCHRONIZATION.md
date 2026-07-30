# Build 44 — Lyrics, Tonic Sol-fa and Staff Synchronization

Build 44 connects lyrics and Tonic Sol-fa to the authoritative score rather
than maintaining independent display-only content.

## Implemented paths

- Direct selected-note lyric entry and rapid navigation.
- Verse metadata separated from lyric text.
- Space, hyphen, melisma, elision, chorus/refrain and translation semantics.
- Multiple rendered verses, independent offsets and part visibility.
- Copy/delete/search/replace with undoable score transactions.
- Four-voice Sol-fa preflight on a cloned score and one atomic commit.
- Bracketed chord syntax such as `[d m s]`.
- Staff-to-Sol-fa publication of pickup, repeat, tonic-change, chord and tuplet
  semantics.
- Staff/Sol-fa pitch edits share playback, `.airscore` and MusicXML state.

## Status

This is a source-verified intermediate checkpoint. Build 45 and later
professional release gates remain incomplete.
