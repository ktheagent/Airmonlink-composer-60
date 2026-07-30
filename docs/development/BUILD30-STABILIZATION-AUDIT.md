# Build 30 Viewport Stabilization Audit

Product: Airmonlink Composer 3  
Version: 1.1.10  
Build: 30  
Status: LOCAL SOURCE CHECKPOINT - NOT FINAL  
GITHUB_EMBARGO_STATUS: ACTIVE

## Baseline

Build 30 starts from the checksum-verified Build 29 local checkpoint. Build 29
already replaced the half-page canvas with one physical-page system shared by
Staff and Tonic Sol-fa.

## Defect addressed

Build 29 preserved a page position using a raw layout offset anchored near the
top-left of the scroll container. That approach could select the wrong page in
spread mode and could visibly move the musical reading position when the score
viewport changed size. Staff and Tonic Sol-fa also shared transient global zoom
and page-mode variables, so switching views could discard the user's prior view
position.

## Build 30 correction

- Added normalized, immutable viewport session data for Staff and Tonic Sol-fa.
- Persisted zoom mode, zoom, page layout, current page, and a page-relative
  focal anchor in local application settings.
- Added two-dimensional page-at-point selection.
- Added focal viewport anchor capture and restoration.
- Added real scroll-extent clamping.
- Passed the previous usable viewport into the authoritative reflow service.
- Removed page-one resets from view and page-layout changes.
- Disabled competing browser scroll anchoring.
- Retained the same physical-page geometry and print model.

## Validation scope

The local validation suite covers semantic tests, viewport-anchor calculations,
settings sanitization, source architecture, performance gates, browser
interaction, preview generation, and the viewport matrix.

## Production gates still unavailable or separate

- Clean dependency installation from a fresh cache.
- Windows x64 installer compilation.
- Portable executable compilation.
- PE metadata and checksum verification.
- Installation and application startup.
- File association testing for `.airscore`.
- Upgrade testing from an earlier installed build.
- Uninstall and user-data preservation testing.
- Human Windows visual inspection.
- Independent Windows PDF and PNG inspection.
- Physical audio testing.
- Physical MIDI testing.
- Physical printer testing.
- Code signing and Windows trust verification.
- Best-Version Exit Gate.

No GitHub upload, commit, workflow dispatch, tag, release, or artifact operation
is authorized while the embargo is active.
