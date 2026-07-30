# Build 42 Known Limitations

Build 42 is a focused staff-input correction, not a complete notation release.

## Hidden until later corrective builds

- tuplets and nested tuplets;
- beaming controls;
- ties and slurs as general editing tools;
- articulations, ornaments and advanced notation palettes;
- complete inspector and Composition Hub;
- advanced playback, parts and publishing workflows.

These functions may exist in engine modules, but remain hidden because the
complete control-to-engine, undo, persistence, layout and user evidence is not
yet sufficient.

## Remaining staff and page limitations

- Engraving is not yet professional publication quality.
- Rhythmic spacing and collision avoidance require Build 43–45 reconstruction.
- Pointer pitch placement uses the chosen keypad pitch; vertical staff position
  does not yet infer pitch.
- Range selection is event-based and needs full measure/system selection behavior.
- Cross-staff notation, nested tuplets, advanced voices and complete keypad symbol
  pages are not yet production-enabled.
- Staff and Tonic Sol-fa still require later end-to-end publishing verification.
- Print cancellation and full Windows printing behavior require Windows testing.

## Production gates not run

- clean dependency restore from the public npm registry;
- Windows x64 Setup and Portable generation;
- installer, upgrade, association and uninstall tests;
- executable metadata/signing checks;
- physical audio, MIDI and printer testing;
- human Windows visual and usability review.
