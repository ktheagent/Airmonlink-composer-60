# Build 48 — Performance, Accessibility, Security and Recovery

- Measured semantic entry, selection and layout reflow pass declared budgets.
- The large-score audit passes measure lookup, AIRSCORE serialization/reopen,
  MusicXML export, layout and rapid chord-entry thresholds.
- Keyboard focus, live status/error regions, scalable controls, high contrast
  and reduced-motion behavior are source-verified.
- Renderer isolation remains enabled with Node integration disabled and the
  Electron sandbox enabled.
- External links are now validated in the main process; scripts, credentials,
  localhost and malformed links are blocked.
- File-type and input-size policies reject unsafe inputs.
- Recovery classification covers read-only destinations, full disks, damaged
  projects, missing resources, unavailable devices and isolated plugin faults.
- Production dependency audit reports zero known vulnerabilities.

This source checkpoint is not a Windows or hardware certification.
