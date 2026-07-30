# Build 40 Functional Audit

## Decision

Build 40 is a rejected decorative baseline. A successful build, a visible control, an engine method, or a passing unit test is not sufficient evidence of professional musical functionality.

This audit follows the Build 40 Functional Reconstruction Master Prompt and the user's recorded Windows workflow evidence.

## Baseline integrity

- Source archive: `Airmonlink-Composer-1.2.0-Build40-Premium-Source-Checkpoint.zip`
- SHA-256: `efdea52487b6ae105f17b7a369de72177ccf7b5c1dcb8f7f1c67e18673a41812`
- Checksum: verified exact match
- Extracted project root: `Airmonlink-Composer-1.2.0-Build40`
- Baseline JavaScript syntax: 85 files passed
- Baseline automated tests: 332/332 passed
- Baseline browser checks: 46/46 passed
- Baseline viewport checks: 36/36 passed

These results establish that the supplied source is internally testable. They do not establish professional staff usability.

## Inventory

- Static HTML interactive elements: 214
- `data-command` production controls: 106
- Workspace mode controls: 5
- Ribbon tabs: 6
- Start Centre actions/templates: 8
- Other inputs, selectors and buttons: 89
- Commands directly invoked by browser smoke validation: 27
- Unbound visible Build 40 control found: `#beamValue`

## Command classification

| Status | Count | Meaning |
|---|---:|---|
| VERIFIED FUNCTIONAL | 43 | Direct renderer or engine path has automated evidence. Final Windows/manual evidence remains required. |
| PARTIALLY FUNCTIONAL | 50 | A path exists, but complete staff interaction, context gating, visual proof or round-trip proof is incomplete. |
| BROKEN | 6 | User evidence or source analysis confirms an incorrect workflow. |
| BLOCKED | 7 | Physical Windows hardware/device evidence is required. |
| DECORATIVE/NO-OP | 0 command controls | No literal no-op was found in the `data-command` switch; decorative breadth exists outside that switch. |

## Confirmed high-severity workflow failures

1. **Note entry is fixed-pitch and unsafe at barlines.** The renderer command calls `engine.addNote({ pitch: 'C4' })`. The engine advances the cursor without a professional insertion mode, automatic measure continuation, duration splitting or tie creation. The user's recording shows the resulting barline-crossing error.
2. **Chord tone entry is fixed-pitch and context-hostile.** The renderer calls `engine.addChordTone({ midi: 64 })`. It does not use the active keypad, keyboard, piano or staff pointer pitch. The user's recording shows the selection error.
3. **Dot mutates duration without reflow.** `toggleDot()` multiplies the selected duration while later events remain in place. The user's recording shows overlap/measure validation errors.
4. **Tuplet entry is metadata-first rather than rhythm-first.** `setTuplet(3, 2)` marks selected events but does not create a complete insertion-time tuplet group or reflow the passage.
5. **Print cancellation is treated as failure.** The user recording shows cancellation leaving an error state rather than returning quietly to the score.
6. **Selection-dependent controls are always enabled in Build 40.** The HTML has no central control-to-engine availability contract, so commands invite invalid actions and then expose engine errors.
7. **Ribbon breadth exceeds proven functionality.** Build 40 exposes notation, lyrics, playback, publishing, MIDI and composition-assistant surfaces before their staff workflows have complete manual proof.
8. **Composition Hub is disconnected from the immediate notation workflow.** Some service methods perform genuine transformations, but the launcher adds a large secondary tool world before core staff input is professional.
9. **One visible beam selector is entirely unbound.** `#beamValue` has no renderer reference and is decorative.

## Build 41 corrective action

Build 41 introduces one functional command registry. Only controls classified `VERIFIED FUNCTIONAL` are visible in the production surface. Context requirements disable verified commands when their prerequisites are unavailable. Partial, broken and hardware-blocked controls are removed from the visible production surface until their scheduled corrective build.

Build 41 also:

- removes the unbound `#beamValue` selector;
- hides the Composition Hub launcher until Build 45;
- hides Engrave, Play and Publish workspace-mode shortcuts until their workflows are audited;
- excludes hidden or disabled commands from the command palette;
- keeps the underlying semantic engine source intact for later repair and regression protection.

## Limits of this audit

No physical Windows desktop, printer, audio device, MIDI device or human usability session was available in this environment. The user's supplied recordings are the manual evidence for the listed Build 40 failures. A control is not promoted to final professional status by this audit.
