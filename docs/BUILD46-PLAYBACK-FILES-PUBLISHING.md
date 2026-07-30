# Build 46 — Playback, Parts, Files and Publishing

Build 46 verifies the authoritative score through performance scheduling,
linked parts, persistence, interchange and transactional publishing.

- Playback now derives duration, attack and gain from articulations, fermatas,
  grace notes, dynamics, hairpins and pedal state.
- Repeat expansion produces deterministic performance occurrences while tied
  notes remain a single attack.
- Written/sounding pitch metadata remains attached to the sounding MIDI event.
- Linked part layout, cues and timing-safe engraving overrides survive
  `.airscore` reopen.
- MusicXML import is available in both renderer and Node validation contexts;
  measure, note, voice, lyric and repeat round trips are regression tested.
- Publishing plans cover score and parts for AIRSCORE, MusicXML, MXL, MIDI,
  PDF, PNG and WAV as one rollback-capable transaction.
- Atomic saving, autosave recovery, migration backup and checksum corruption
  gates remain explicit.

This remains an intermediate source checkpoint. Windows installer, physical
printing and hardware audio/MIDI validation remain release-gate work.
