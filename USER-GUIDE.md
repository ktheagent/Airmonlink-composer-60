# Airmonlink Composer 1.3.0 Build 50 User Guide

## Start a score

Open **Setup**, choose a template, key, meter, pickup, tempo, measures, title,
composer, and page settings, then create the score. The title shown in the
window and publication page comes from the score's authoritative metadata.

## Workspaces

- **Setup** — score identity, ensemble, meter, key, pickup, and page settings.
- **Write** — note, rest, chord, layer, lyric, annotation, and measure entry.
- **Engrave** — layout, spacing, breaks, and publication presentation.
- **Play** — playback, mixer, navigation, and MIDI workflows.
- **Publish** — preview, PDF/PNG, MusicXML/MXL, MIDI, print, and save/export.

The **Composition Hub** provides project entry points and can be opened or
closed without changing the current score.

## Note entry and editing

Choose a duration, pitch, voice/layer, or rest. Add notes, rests, chord tones,
intervals, measures, repeats, system breaks, and page breaks. Selection
commands support copy, paste, replacement, layer copying, and deletion.
Undo/redo protects supported editing operations.

## Lyrics and text

Attach lyrics to notes, advance with spaces, use hyphens for syllabic
continuation, and underscores for melisma. Multiple verses, paragraph entry,
copy, search/replace, offsets, reset, and deletion are available. Add dynamics,
chord symbols, rehearsal marks, and other text through the notation controls.

## Staff and Tonic Sol-fa

Staff and Tonic Sol-fa views edit the same score events. Changes in either view
remain synchronized through save/reopen, playback, and supported exports.

## Playback and MIDI

Use **Play** to start and stop playback. MIDI input can connect, record events,
stop recording, and disconnect. Confirm the selected physical device and audio
configuration on the target Windows computer.

## Save, open, import, and export

- Save the editable project as `.airscore`.
- Reopen saved projects from the application.
- Import/export supported MusicXML or compressed MXL.
- Export supported MIDI, PDF, and PNG outputs.
- Use Print Preview before printing.

Keep backups of important `.airscore` files before upgrading or importing
third-party notation files.

## Printing

Open Print Preview, select the required printer and paper settings, and print.
Cancelling the operating-system print dialog is reported as cancellation rather
than an application failure. Physical printer output must still be checked on
the target device.

## Recovery and troubleshooting

After an interrupted operation, reopen the most recent saved project or recovery
copy offered by the application. See `docs/TROUBLESHOOTING.md` for build,
startup, import, playback, MIDI, and printing diagnostics.
