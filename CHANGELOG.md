# Changelog

## 1.3.0 - Build 50 - Local audited completion checkpoint

- Centralized release metadata and Build 50 artifact identity.
- Added consistency, stale-reference, workflow, control, browser, viewport, and
  three-cycle validation gates.
- Corrected print cancellation, score setup, playback page follow, metadata
  display, Chromium lifecycle, and MusicXML fallback behavior.
- Exposed and verified all five workspaces and Composition Hub.
- Reached 408/408 Node tests, 105/105 command traceability, 71/71 browser checks,
  36/36 viewport checks, and 6/6 performance gates.
- Windows packaging and external-device acceptance remain unverified for the
  modified local source.


## 1.2.3 - Build 43 - Rhythmic notation and four-voice engraving reconstruction

- Added real 3:2 tuplet retiming and atomic musical preflight.
- Added chord-aware tuplet grouping.
- Added nested manual beams and meter-aware automatic beaming.
- Added strict adjacent equal-pitch ties and phrase slurs.
- Added deterministic four-voice stem direction.
- Added grouped beam, hook, tuplet, tie, slur and articulation rendering.
- Added rhythmic notation keypad controls and keyboard shortcuts.
- Added `.airscore` and MusicXML persistence evidence.
- Corrected supplied-score engine initialization.
- Prevented duplicate legacy spanners during score normalization.
- Updated production command traceability for 105 controls.
- Kept the GitHub embargo active; no repository write or Windows artifact is claimed.


## 1.2.2 - Build 42 - Staff core and note-input reconstruction

- Added a persistent, collapsible notation keypad.
- Added a visible insertion caret and staff pointer placement.
- Added direct A–G note input, R rest input and Shift+A–G chord entry.
- Added duration keys 1–7 and Alt+1–4 voice selection.
- Replaced hard-coded renderer note/chord pitches with active input state.
- Split note and rest durations safely at measure boundaries.
- Added semantic ties for split note continuations.
- Added last-entry chord anchoring and duplicate-pitch rejection.
- Added atomic augmentation-dot conflict checks and exact rollback.
- Added range-selection helpers and direct staff event interaction.
- Promoted 13 staff-core commands after new functional evidence.
- Added 9 focused Build 42 tests and 6 browser interaction checks.
- Passed 89-file syntax validation, 348/348 tests, 6/6 performance gates,
  52/52 browser checks and 36/36 viewport checks.
- Kept GitHub embargo active and did not compile or publish Windows artifacts.

## 1.2.1 - Build 41 - Functional truth audit and production control gate

- Revoked Build 40's implied completion status.
- Inventoried 214 interactive elements and 106 production commands.
- Added complete control-to-engine traceability.
- Classified 43 commands verified, 50 partial, 6 broken, and 7 hardware-blocked.
- Removed the unbound beam selector.
- Hid the Composition Hub and deferred workspace modes.
- Added a central functional command registry and context-sensitive availability.
- Excluded hidden and disabled commands from the command palette.
- Added seven Build 41 audit/regression tests.
- Passed 87-file syntax validation, 339/339 tests, 6/6 performance gates,
  46/46 browser checks, and 36/36 viewport checks.
- Kept the GitHub embargo active; no Build 41 GitHub write was performed.


## 1.1.11 - Build 31 - Cross-page editing and publication parity

- Added a page-flow service shared by Staff and Tonic Sol-fa.
- Mapped score beats, semantic events, selections, and measure ranges to physical pages.
- Preserved multi-page selection identity during page reflow and view changes.
- Added page-aware selection reveal and current-measure status.
- Added playback page following with a temporary manual-navigation hold.
- Added playback-position highlighting on the active staff page.
- Unified preview, PDF, PNG, and native-print settings through one publication profile.
- Generated full physical-page PNG output using the same page size, orientation, and margins as print output.
- Passed page-size and orientation through explicit Electron IPC.
- Added cross-page lyric, delete, undo, redo, reflow, navigation, playback, and output-parity tests.
- Preserved Build 30 viewport sessions and the official Airmonlink colours.
- Kept the GitHub embargo active; no Build 31 GitHub write was performed.

## 1.1.10 - Build 30 - Persistent viewport stabilization

- Added sanitized per-view viewport sessions for Staff and Tonic Sol-fa.
- Preserved each view's zoom mode, zoom level, page layout, current page, and focal anchor.
- Replaced top-edge-only restoration with focal-page anchoring around the reading area.
- Added two-axis page selection so spread and horizontal modes restore the correct page.
- Preserved the same musical page while the window, ribbon, inspector area, or piano dock changes size.
- Clamped restored scroll offsets to real layout extents.
- Disabled competing browser scroll anchoring during controlled page reflow.
- Removed forced page-one resets when switching views or changing page layout.
- Added Build 30 persistence and viewport-regression coverage.
- Preserved Build 29's shared physical-page system and official Airmonlink colours.
- Kept the GitHub embargo active; no Build 30 GitHub write was performed.

## 1.1.9 - Build 29 - Integrated physical-page workspace

- Replaced Build 28's fixed `1120 x 780` page geometry with complete physical paper dimensions.
- Added one authoritative viewport and page-layout service shared by Staff and Tonic Sol-fa.
- Added printable margin boxes for A4, A3, A5, Letter, and Legal paper.
- Replaced transform-only zoom compensation with scaled layout boxes matching painted dimensions.
- Added Fit Width, Fit Page, Actual Size, custom zoom, and Ctrl-wheel zoom.
- Added continuous, single-page, two-page spread, and horizontal page modes.
- Added page navigation, current-page status, and scroll-anchor preservation.
- Added Staff page casting that keeps complete systems inside physical pages.
- Added continuation headers and page numbering.
- Added ResizeObserver and VisualViewport reflow.
- Prevented ribbon content from widening the desktop shell and detaching the score page.
- Added 17 Build 29 viewport/workspace regression tests.
- Added a four-scenario, 28-check viewport matrix covering 1366x768 and 1920x1080 at multiple display scales.
- Preserved the navy, royal-blue, white, and gold Airmonlink identity.
- Kept the GitHub embargo active; no Build 29 GitHub write or Windows release was performed.

## 1.1.0 — Build 13 — Tonic Sol-fa publication and entry rebuild

- Moved every Tonic Sol-fa editing control outside the printable score paper.
- Added a compact publication header with centred title and dedication, musical metadata on the left, and composer/date/supporting credits on the right.
- Replaced fixed equal-width Sol-fa systems with content-aware measure allocation and automatic wrapping.
- Hid empty voice layers by default while retaining an explicit “Empty layers” display option.
- Corrected lyric verse rendering so a verse number labels a line once and is never inserted into every syllable.
- Made verse selection independent from lyric text and added regression coverage for save and MusicXML round trips.
- Added automatic chord merging when a compatible note is entered at an existing onset; no chord icon is required.
- Reorganized composition functions into compact vertical labels with three-column flyouts.
- Closed the right dock by default so it occupies zero score width until requested.
- Added an open-source Tonic Sol-fa research and licensing decision record.

## 1.0.0 — Build 12 — Phase 2 release candidate

### Score, page, system, and staff layout

- Added a hierarchical layout model for page, system, staff, measure, rhythmic segment, and item coordinates.
- Replaced equal-width note placement with rhythmic-segment profiles and duration-aware horizontal spacing.
- Added measure minimum-width calculation for notes, rests, chords, accidentals, lyrics, text, grace/tuplet foundations, and measure attributes.
- Added forced system/page break preservation through `newSystem` and `newPage` measure properties.
- Added dynamic vertical expansion for lyrics, Tonic Sol-fa, text, and other above/below-staff content.
- Added controlled manual staff/system offsets and reset operations.
- Added Optimize Current System, Optimize Selected Range, and Optimize Complete Score commands.

### Chords and four layers

- Added semantic chord groups using stable chord IDs at one staff/layer/tick/duration.
- Added interval-above and interval-below commands.
- Added member-note insertion, movement, transposition, playback, removal, save/reopen, and undo/redo support.
- Added engraving offsets for seconds, unisons between voices, and accidental columns.
- Preserved exactly four independent user-facing layers per staff.

### Workspace and panels

- Added the grouped Composition Notepad on the right.
- Added managed Composition Notepad, Inspector, Tonic Sol-fa, Piano Input, Mixer, and playback View-menu controls.
- Inspector and Piano Input remain hidden by default.
- Added collapsible/tabbed right-dock state, bottom piano dock, safe splitter dimensions, compact-screen redocking, and workspace restoration.
- Panel opening changes viewport allocation rather than semantic score coordinates or playback.

### Metadata and anchored text

- Added semantic composition date, source, movement title, dedication, and supporting credits.
- Added right-aligned composer/date header presentation.
- Added staff-, system-, measure-, segment-, page-, header-, footer-, rehearsal-, tempo-, chord-symbol-, and generic anchored text foundations.
- Text offsets remain derived layout data tied to stable musical anchors.

### Pickup measures

- Added Create/Configure Pickup Measure.
- Added nominal-versus-actual first-measure duration handling.
- Added validation against existing note/rest endings.
- Added later-event timing shifts, rest recalculation, undo/redo, playback, and MusicXML implicit-measure support.

### MusicXML and MXL

- Added exact per-measure cursor logic using divisions, note duration, `<chord/>`, `<backup>`, and `<forward>`.
- Added metadata import/export for work/movement title, composer, lyricist, arranger, rights, source, composition date, dedication, and credits.
- Added multi-verse lyrics, syllabic states, elision, melisma/extend, placement, and stable note attachment.
- Added direction words, rehearsal marks, tempo, dynamics, harmony/chord symbols, page setup, manual page/system breaks, multiple staves/voices, tuplets, ties/slurs, pickup measures, and import reporting foundations.
- Added counts and warnings instead of silently discarding all unsupported content.

### Performance

- Preserved cached score timelines, stable event indexes, lazy Tonic Sol-fa/Mixer rendering, delegated score interaction, fast selection/layer refresh, idle autosave, and targeted invalidation from 0.9.1.
- Added layout-cache signatures and batched Phase 2 mutations.

### Shutdown lifecycle

- Replaced the dirty-score `beforeunload` close cancellation with an explicit Electron main/renderer shutdown protocol.
- Added native Save/Discard/Cancel handling.
- Added duplicate-request protection and deterministic cleanup ordering.
- Added playback/audio stop, all-notes-off, MIDI close, autosave cancellation, workspace persistence, owned-dialog closure, file-lock release, bounded waits, structured shutdown logging, and File → Exit.
- The app remains open on Cancel, save failure, cleanup timeout, or unsafe shutdown rather than silently hiding.

### Compatibility and branding

- Preserved `.airscore` schema `airscore-v9` and score format version 9.
- Preserved `com.airmonlink.composer`, official branding, logo, launcher icon, colours, typography, note-entry controls, staff styling, navigation, and dedicated Tonic Sol-fa page.
- No MuseScore source, branding, icons, UI, or assets were copied.

## 0.9.1 — Build 10

- Performance hotfix: cached timelines, indexed events, lazy heavy views, fast selection/layer refresh, and idle autosave.

## 0.9.0 — Build 9

- Formal Tonic Sol-fa parser, timed rests and continuations, diagnostics, reverse transcription, and optional above/below-staff integration.
