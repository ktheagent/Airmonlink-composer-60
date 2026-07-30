# Troubleshooting Guide

## Application does not start

Confirm Windows x64, verify the artifact checksum, check antivirus quarantine,
and launch from PowerShell to capture an exit code. Reinstall into a clean
directory if files are missing.

## Project does not open

Work on a copy. Confirm the extension and file size. Try the most recent backup
or recovery copy. Do not overwrite the only copy of a damaged project.

## MusicXML import differs

Confirm the source is valid MusicXML/MXL. Review unsupported specialist
elements and compare parts, meter, key, voices, lyrics, repeats, and breaks.

## No playback or MIDI

Check Windows audio output, application volume, MIDI permissions, device
selection, cabling, and whether another application has exclusive access.
Disconnect and reconnect the device.

## Printing fails

Open Print Preview first. Confirm printer availability, driver, paper size,
margins, queue state, and write access to temporary folders. Cancellation is a
normal outcome; other failures should retain their reported reason.

## Build validation fails

Run the failing command directly. Do not use `continue-on-error`. Check
`release-metadata.json`, `package.json`, `package-lock.json`, the packaging
configuration, and expected filenames before rerunning the full gate.
