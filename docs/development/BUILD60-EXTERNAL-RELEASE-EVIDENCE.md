# Build 60 External Release Evidence Requiring User Action

The Build 60 source gate is locally verifiable. The following evidence cannot be
produced truthfully in the current Linux-only local development environment:

| Evidence | Required environment or authority | Completion criterion |
|---|---|---|
| Windows Setup and Portable build | Authorized Windows runner | Both Build 60 executables are produced and PE metadata matches 1.3.0.60. |
| Fresh installation and startup | Clean supported Windows system | Silent/interactive install, launch and uninstall pass. |
| Upgrade and user-data preservation | Windows system with previous release data | Existing scores, preferences and recovery data remain available after upgrade. |
| Physical printing | Real supported printer | Preview and printed page match, cancellation is non-fatal, and margins are acceptable. |
| MIDI and audio hardware | Real MIDI controller and audio output device | Step/real-time entry, playback, latency and device recovery pass. |
| Code signing | Valid signing certificate | Setup and Portable signatures validate and publisher identity is correct. |
| Assistive technology | Windows screen reader and keyboard-only review | Names, focus order, status announcements and workflows are usable. |
| Independent user acceptance | Representative external users | Assigned realistic notation workflows complete without release-blocking defects. |

None of these items is represented as completed.
