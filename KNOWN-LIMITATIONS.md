# Known Limitations — Airmonlink Composer 1.3.0 Build 50

## Release boundary

The locally modified Build 50 source passed Linux/Chromium validation, but it
has not been freshly compiled into Windows Setup and Portable executables.
Earlier repository artifacts do not contain these local changes.

## External verification still required

- Fresh dependency installation requires registry access.
- Windows install, startup, file association, save/reopen, export, upgrade,
  uninstall, and artifact checksum verification are pending.
- The executables are expected to be unsigned unless signing credentials are
  supplied; SmartScreen warnings are possible.
- Physical printer behavior, paper handling, MIDI hardware timing, audio-device
  behavior, and assistive-technology operation are not device-tested.
- Independent real-user acceptance has not been performed.

## Format fidelity

MusicXML/MXL import and export cover the application's supported score model,
but uncommon MusicXML elements and exact typography from arbitrary third-party
applications may not round-trip losslessly. MIDI export represents musical
events rather than full engraving semantics.

## Engraving boundary

The product includes page layout, parts, breaks, lyrics, chords, annotations,
Staff notation, and Tonic Sol-fa publication. It is not claimed to reproduce
every specialist engraving convention or every third-party notation feature.

## Browser validation boundary

Browser validation uses deterministic desktop and MIDI mocks. It verifies
command integration and output payloads, not operating-system dialogs or
physical devices.
