# Build 40 Requirements Register

Generated: 2026-07-27T14:46:16.523422+00:00

GITHUB_EMBARGO_STATUS: ACTIVE
PROJECT_STATUS: IN PROGRESS — NOT FINAL

| ID | Requirement | Status | Evidence / blocker |
|---|---|---|---|
| ARCH-01 | One authoritative semantic score model across staff, Sol-fa, lyrics, playback, MIDI, parts and interchange | VERIFIED COMPLETE | 332/332 automated tests; Build 40 SATB, piano, ensemble and Sol-fa scenarios |
| ARCH-02 | Direct Composer 3 engine API without hidden legacy UI dependency | VERIFIED COMPLETE | Build 40 source architecture audit; Restricted renderer tests |
| WORK-31 | Build 31 window, zoom, panels, multi-page, print preview, save and reopen regressions | VERIFIED COMPLETE | 46/46 browser checks; 36/36 viewport checks across four scenarios |
| EDIT-32 | Professional note, chord, rest, tuplet, selection and four-layer editing | VERIFIED COMPLETE | Build 32 tests retained in 332-test suite |
| NOTATE-33 | Notation semantics, meter, accidentals, spanners, repeats and navigation | VERIFIED COMPLETE | Build 33 tests retained in 332-test suite |
| CHOIR-34 | Tonic Sol-fa, lyrics, SATB ranges and synchronized staff/Sol-fa semantics | VERIFIED COMPLETE | Build 34 and Build 40 Sol-fa/SATB tests |
| PARTS-35 | Linked parts, cues, instrument ranges and engraving overrides | VERIFIED COMPLETE | Build 35 and Build 40 ensemble tests |
| AUDIO-36 | Mixer, practice presets, MIDI quantization, deterministic plans and PCM WAV rendering | VERIFIED COMPLETE | Build 36 tests; Build 40 SATB WAV scenario |
| COMPOSE-37 | Premium Composition Hub with previewable assisted transformations and analysis | VERIFIED COMPLETE | Build 37 tests; Composition Hub browser/source validation |
| OMR-37 | Bundled production OMR recognition engine | PARTIALLY IMPLEMENTED | Confidence-gated review/import contract; No bundled recognition model or representative production fixture corpus |
| TRANSCRIBE-37 | Bundled production audio transcription engine | PARTIALLY IMPLEMENTED | Confidence-gated review/import contract; No bundled transcription model or representative production audio corpus |
| FILES-38 | Integrity, migrations, atomic save, autosave and recovery planning | VERIFIED COMPLETE | Build 38 file-failure and migration tests |
| PUBLISH-38 | Transactional score/part publishing plans, metadata, watermark and rollback | VERIFIED COMPLETE | Build 38 publishing tests |
| PLUGIN-38 | Permission-scoped plugin API with isolation, logging and safe uninstall | VERIFIED COMPLETE | Build 38 plugin tests |
| A11Y-39 | Keyboard names, focus, high contrast, scaling, reduced motion and accessible notifications | IMPLEMENTED BUT NOT VERIFIED | Source assertions and automated accessibility-oriented tests; Not manually tested with Windows Narrator, NVDA or keyboard-only user session |
| SEC-39 | Restricted Electron renderer, narrow preload, CSP, path and URL validation | VERIFIED COMPLETE | Build 39 and Build 40 security source audits |
| PERF-39 | Performance budgets and small/medium/large semantic workload checks | VERIFIED COMPLETE | 6/6 performance checks passed in three Build 40 cycles |
| UI-40 | Five-zone desktop, Setup/Write/Engrave/Play/Publish modes, Start Centre and Composition Hub | VERIFIED COMPLETE | Build 40 source tests; 46/46 browser checks; visual screenshots |
| E2E-40 | Automated SATB, piano, ensemble and Tonic Sol-fa end-to-end scenarios | VERIFIED COMPLETE | Build 40 tests 326-329 |
| CLEAN-DEP | Clean dependency restore from lockfile | IMPLEMENTED BUT NOT VERIFIED | Lockfile and package metadata consistent; Offline npm cache lacks yocto-queue; npm ci --offline failed with ENOTCACHED |
| WIN-PACK | Windows x64 NSIS and Portable production packaging | BLOCKED BY USER-SUPPLIED ACCESS OR INFORMATION | electron-builder workflow and artifact names configured; GitHub embargo prevents Windows Actions; Local Linux environment has no Wine, NSIS or electron-builder installation |
| WIN-RUN | Windows install, launch, upgrade, association and uninstall validation | BLOCKED BY USER-SUPPLIED ACCESS OR INFORMATION | No Windows executable exists for Build 40; No Windows runner authorized during embargo |
| HW-MIDI | Physical MIDI and audio-device verification | IMPLEMENTED BUT NOT VERIFIED | Automated MIDI/audio semantics pass; No physical MIDI/audio device was used |
| HW-PRINT | Physical printer and Windows print-driver verification | IMPLEMENTED BUT NOT VERIFIED | PDF generation and rendered-page check pass; No physical printer or Windows print driver was used |
