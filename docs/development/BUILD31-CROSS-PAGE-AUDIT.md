# Build 31 Cross-Page Editing and Publication Audit

Version: 1.1.11  
Build: 31  
Status: LOCAL DEVELOPMENT CHECKPOINT - NOT FINAL  
GITHUB_EMBARGO_STATUS: ACTIVE

## Defects addressed

Build 30 preserved each viewport but did not provide one authoritative mapping
between semantic events and physical pages. Selection, playback, and publication
commands could therefore make independent page decisions.

Build 31 adds `src/composer3/page-flow-service.js` as the shared mapping layer.
It records each physical page's beat range, measure range, and semantic event
identifiers. Staff and Tonic Sol-fa both populate this model from their actual
pagination results.

## Integrated behavior

- Beat, event, selection, and measure-to-page mapping.
- Selection reveal that preserves a currently visible part of a multi-page
  selection.
- Selection-anchor navigation when a specific event is chosen.
- Playback page following.
- Temporary manual-navigation hold during playback.
- Visible playback-event highlighting on Staff pages.
- Current page, measure range, and zoom in the status bar.
- Shared publication profile for print preview, PDF, PNG, and native print.
- Dynamic CSS page size, orientation, and margins.
- Full physical-page PNG dimensions and margin placement.
- Explicit page size and landscape handling in Electron print IPC.
- Page-boundary lyric, delete, undo, redo, reflow, navigation, playback, and
  publication-profile regression tests.

## Preserved behavior

- Build 29 physical-page dimensions and page layout service.
- Build 30 independent Staff and Tonic Sol-fa viewport sessions.
- Continuous, single, spread, and horizontal modes.
- Fit Page, Fit Width, Actual Size, and manual zoom.
- Navy, royal-blue, white, and gold Airmonlink identity.
- Canonical semantic score model and exactly four voice layers.

## Unavailable production gates

- Clean dependency installation.
- Windows x64 installer.
- Portable executable.
- PE metadata verification.
- File association testing.
- Upgrade testing.
- Human Windows visual inspection.
- Physical audio testing.
- Physical MIDI testing.
- Physical printer testing.
- Code signing.
- Best-Version Exit Gate.

No GitHub write, workflow dispatch, tag, release, or artifact upload is
authorized while the embargo remains active.
