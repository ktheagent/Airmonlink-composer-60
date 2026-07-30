# Airmonlink Composer 3 — Build 30 Local Checkpoint

Version: 1.1.10  
Build: 30  
Build version: 1.1.10.30  
Classification: LOCAL VIEWPORT-STABILIZATION CHECKPOINT — NOT FINAL  
GITHUB_EMBARGO_STATUS: ACTIVE

## Baseline

The Build 29 local checkpoint was restored only after its SHA-256 matched:

`470e8667f101ab2c86b334d9dde405cf285291c528d28297e1fff48ae671b8e4`

## Build 30 change set

- Per-view Staff and Tonic Sol-fa viewport sessions.
- Persistent zoom mode, zoom level, page mode, current page, and focal anchor.
- Two-dimensional page selection for spread and horizontal modes.
- Focal-page preservation across window and dock-sized viewport changes.
- Real scroll-extent clamping.
- Sanitized stored viewport state.
- Browser scroll-anchor suppression during authoritative reflow.
- Removal of forced page-one resets when changing view or page mode.

## Local validation

- JavaScript syntax: 63 files passed.
- Automated tests: 219/219 passed.
- Performance gates: 6/6 passed.
- Browser interaction checks: 46/46 passed.
- Viewport matrix: 36/36 passed across four scenarios.
- Preview generation passed.
- PDF header, page count, dimensions, and rendered-page checks passed.

## Blocked or not performed

The npm registry ping timed out after 20 seconds, so a clean dependency restore
was not completed. No Windows Setup or Portable executable was built locally.
Windows installation, startup, association, upgrade, uninstall, signing, human
visual review, and physical audio, MIDI, and printer tests remain incomplete.

No GitHub write was performed.
