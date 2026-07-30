# Build 49 — Regression Correction

Build 49 added no feature breadth. It repeated the automated professional
workflows and corrected failures found by the full validation command.

| Failure | Reproduction | Root cause | Correction | Regression evidence |
|---|---|---|---|---|
| Three continuation identity tests failed | Run `npm test` after Build 48 identity update | Dynamically constructed version regex escaped dots twice | Compare the exact rendered identity string | Build 44–46 continuation identity tests pass |
| Unclosed MusicXML was accepted | Import `<score-partwise><part>` through the Node parser | Linkedom produces a recoverable tree without a browser `parsererror` node | Added parser-independent balanced-tag validation before DOM parsing | Build 27 malformed-import test passes |
| Browser smoke unavailable | Run `npm run browser-smoke` | `/usr/bin/chromium` is absent in this environment | No code claim; recorded as an external release blocker | Gate remains explicitly unverified |
| Viewport matrix unavailable | Run `npm run viewport-matrix` | Same absent Chromium executable | No code claim; retained deterministic unit coverage | Gate remains explicitly unverified |

After correction, syntax validation and all 397 discovered automated tests pass.
Performance and preview generation pass. Physical Windows, printer, audio/MIDI
hardware, browser smoke and viewport-matrix evidence remain release blockers.
