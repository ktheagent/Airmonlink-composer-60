(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AirmonFunctionalCommands = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STATUS = Object.freeze({
    VERIFIED: 'VERIFIED FUNCTIONAL',
    PARTIAL: 'PARTIALLY FUNCTIONAL',
    DECORATIVE: 'DECORATIVE/NO-OP',
    BROKEN: 'BROKEN',
    BLOCKED: 'BLOCKED'
  });

  const COMMANDS = Object.freeze({
  "accent": {
    "id": "accent",
    "label": "Accent",
    "group": "ARTICULATIONS AND EXPRESSION",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selected-note"
    ],
    "scheduledBuild": 43,
    "reason": "Build 43 connects this control to the authoritative score model with undo, persistence, staff rendering and automated regression evidence; Windows/manual usability evidence remains required."
  },
  "addChordSymbol": {
    "id": "addChordSymbol",
    "label": "Add symbol",
    "group": "HARMONY AND CHORDS",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selection"
    ],
    "scheduledBuild": 43,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "addChordTone": {
    "id": "addChordTone",
    "label": "Add chord tone",
    "group": "NOTE ENTRY",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "note-entry-anchor"
    ],
    "scheduledBuild": 42,
    "reason": "Chord tones use the selected note or last note-entry anchor, preserve the onset and duration, reject duplicates, and continue safely across barlines."
  },
  "addFifth": {
    "id": "addFifth",
    "label": "Add fifth",
    "group": "NOTE ENTRY",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selected-note"
    ],
    "scheduledBuild": 42,
    "reason": "Adds a real fifth to the selected semantic chord and preserves selection, save, playback, and undo behavior."
  },
  "addNote": {
    "id": "addNote",
    "label": "Add note",
    "group": "NOTE ENTRY",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "active-part"
    ],
    "scheduledBuild": 42,
    "reason": "Direct staff, keypad, and computer-keyboard pitch entry uses the authoritative score model, one undo transaction, visible caret advancement, and automatic tied continuation across barlines."
  },
  "addPageText": {
    "id": "addPageText",
    "label": "Add page text",
    "group": "LAYOUT AND PAGES",
    "panel": "publish",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "addPart": {
    "id": "addPart",
    "label": "Add part",
    "group": "STAFF AND INSTRUMENTS",
    "panel": "compose",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 47,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "addRest": {
    "id": "addRest",
    "label": "Add rest",
    "group": "NOTE ENTRY",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "active-part"
    ],
    "scheduledBuild": 42,
    "reason": "Rest entry uses the active caret and duration, splits safely at barlines, advances predictably, and remains undoable."
  },
  "addTextAnnotation": {
    "id": "addTextAnnotation",
    "label": "Add text",
    "group": "LYRICS AND TEXT",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selection"
    ],
    "scheduledBuild": 44,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "addThird": {
    "id": "addThird",
    "label": "Add third",
    "group": "NOTE ENTRY",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selected-note"
    ],
    "scheduledBuild": 42,
    "reason": "Adds a real third to the selected semantic chord and preserves selection, save, playback, and undo behavior."
  },
  "appendMeasure": {
    "id": "appendMeasure",
    "label": "Add measure",
    "group": "RHYTHM AND MEASURES",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "active-part"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "applyDynamic": {
    "id": "applyDynamic",
    "label": "Apply",
    "group": "ARTICULATIONS AND EXPRESSION",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selection"
    ],
    "scheduledBuild": 43,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "applyLoop": {
    "id": "applyLoop",
    "label": "Apply loop",
    "group": "PLAYBACK",
    "panel": "playback",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "applyLyric": {
    "id": "applyLyric",
    "label": "Apply",
    "group": "LYRICS AND TEXT",
    "panel": "lyrics",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selection"
    ],
    "scheduledBuild": 44,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "applyLyricOffset": {
    "id": "applyLyricOffset",
    "label": "Apply offset",
    "group": "LYRICS AND TEXT",
    "panel": "lyrics",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selection"
    ],
    "scheduledBuild": 44,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "applyLyricsParagraph": {
    "id": "applyLyricsParagraph",
    "label": "Apply from cursor",
    "group": "LYRICS AND TEXT",
    "panel": "lyrics",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 44,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "applyPageSettings": {
    "id": "applyPageSettings",
    "label": "Apply page",
    "group": "LAYOUT AND PAGES",
    "panel": "publish",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "applyPart": {
    "id": "applyPart",
    "label": "Apply part",
    "group": "STAFF AND INSTRUMENTS",
    "panel": "compose",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 47,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "applyPublication": {
    "id": "applyPublication",
    "label": "Apply metadata",
    "group": "LYRICS AND TEXT",
    "panel": "publish",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "applyPublicationLayout": {
    "id": "applyPublicationLayout",
    "label": "Apply position",
    "group": "LYRICS AND TEXT",
    "panel": "publish",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "applyScoreSetup": {
    "id": "applyScoreSetup",
    "label": "New from setup",
    "group": "STAFF AND INSTRUMENTS",
    "panel": "compose",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 47,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "applySolfaPassage": {
    "id": "applySolfaPassage",
    "label": "Apply passage",
    "group": "TONIC SOLFA",
    "panel": "view",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 44,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "applySolfaSyllable": {
    "id": "applySolfaSyllable",
    "label": "Apply syllable",
    "group": "TONIC SOLFA",
    "panel": "view",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selection"
    ],
    "scheduledBuild": 44,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "applyTechnique": {
    "id": "applyTechnique",
    "label": "Apply technique",
    "group": "ARTICULATIONS AND EXPRESSION",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selected-note"
    ],
    "scheduledBuild": 43,
    "reason": "Build 43 connects this control to the authoritative score model with undo, persistence, staff rendering and automated regression evidence; Windows/manual usability evidence remains required."
  },
  "beamSelected": {
    "id": "beamSelected",
    "label": "Beam selected",
    "group": "ARTICULATIONS AND EXPRESSION",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selected-note"
    ],
    "scheduledBuild": 43,
    "reason": "Build 43 connects this control to the authoritative score model with undo, persistence, staff rendering and automated regression evidence; Windows/manual usability evidence remains required."
  },
  "beamAuto": {
    "id": "beamAuto",
    "label": "Automatic beam",
    "group": "ARTICULATIONS AND EXPRESSION",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selected-note"
    ],
    "scheduledBuild": 43,
    "reason": "Build 43 connects this control to the authoritative score model with undo, persistence, staff rendering and automated regression evidence; Windows/manual usability evidence remains required."
  },
  "collapsePianoPanel": {
    "id": "collapsePianoPanel",
    "label": "Hide piano panel",
    "group": "Workspace",
    "panel": "workspace",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "copy": {
    "id": "copy",
    "label": "Copy selected music",
    "group": "SELECTION AND CLIPBOARD",
    "panel": "compose",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selection"
    ],
    "scheduledBuild": 42,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "copyLyricVerse": {
    "id": "copyLyricVerse",
    "label": "Copy verse",
    "group": "LYRICS AND TEXT",
    "panel": "lyrics",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 44,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "copyToLayer": {
    "id": "copyToLayer",
    "label": "Copy to voice",
    "group": "VOICES AND LAYERS",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selection"
    ],
    "scheduledBuild": 43,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "deleteLyricVerse": {
    "id": "deleteLyricVerse",
    "label": "Delete target",
    "group": "LYRICS AND TEXT",
    "panel": "lyrics",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 44,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "deleteSelection": {
    "id": "deleteSelection",
    "label": "Delete",
    "group": "NOTE ENTRY",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selection"
    ],
    "scheduledBuild": 42,
    "reason": "Deletes the real selected score events, repairs dependent data through the engine, and supports undo."
  },
  "disconnectMidi": {
    "id": "disconnectMidi",
    "label": "Disconnect",
    "group": "PLAYBACK",
    "panel": "playback",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "midi-input-device"
    ],
    "scheduledBuild": 46,
    "reason": "Build 50 completion audit verifies permission failure, mock device discovery, input recording, output scheduling, stop and disconnect behavior; physical Windows MIDI hardware remains an external manual verification boundary."
  },
  "dotSelected": {
    "id": "dotSelected",
    "label": "Dot",
    "group": "NOTE ENTRY",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "active-part"
    ],
    "scheduledBuild": 42,
    "reason": "The dot control updates the pending note value or a valid selected duration, preflights barline and overlap conflicts, and rolls back rejected edits."
  },
  "enableMidi": {
    "id": "enableMidi",
    "label": "Enable MIDI",
    "group": "PLAYBACK",
    "panel": "playback",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 46,
    "reason": "Build 50 completion audit verifies permission failure, mock device discovery, input recording, output scheduling, stop and disconnect behavior; physical Windows MIDI hardware remains an external manual verification boundary."
  },
  "enableMidiOutput": {
    "id": "enableMidiOutput",
    "label": "Enable output",
    "group": "PLAYBACK",
    "panel": "playback",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 46,
    "reason": "Build 50 completion audit verifies permission failure, mock device discovery, input recording, output scheduling, stop and disconnect behavior; physical Windows MIDI hardware remains an external manual verification boundary."
  },
  "exit": {
    "id": "exit",
    "label": "Close Airmonlink Composer",
    "group": "FILE AND PROJECT",
    "panel": "compose",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "exportMidi": {
    "id": "exportMidi",
    "label": "MIDI",
    "group": "IMPORT AND EXPORT",
    "panel": "publish",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "exportMusicXml": {
    "id": "exportMusicXml",
    "label": "MusicXML",
    "group": "IMPORT AND EXPORT",
    "panel": "publish",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "exportMxl": {
    "id": "exportMxl",
    "label": "Compressed MXL",
    "group": "IMPORT AND EXPORT",
    "panel": "publish",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "exportPdf": {
    "id": "exportPdf",
    "label": "Export PDF",
    "group": "IMPORT AND EXPORT",
    "panel": "publish",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "exportPng": {
    "id": "exportPng",
    "label": "Export PNG",
    "group": "IMPORT AND EXPORT",
    "panel": "publish",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 46,
    "reason": "Build 50 completion audit exports a genuine PNG payload with the correct signature through the desktop save service and verifies the visible staff-page workflow."
  },
  "fermata": {
    "id": "fermata",
    "label": "Fermata",
    "group": "ARTICULATIONS AND EXPRESSION",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selected-note"
    ],
    "scheduledBuild": 43,
    "reason": "Build 43 connects this control to the authoritative score model with undo, persistence, staff rendering and automated regression evidence; Windows/manual usability evidence remains required."
  },
  "fitPage": {
    "id": "fitPage",
    "label": "Fit page",
    "group": "LAYOUT AND PAGES",
    "panel": "view",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "fitSelection": {
    "id": "fitSelection",
    "label": "Fit selection",
    "group": "LAYOUT AND PAGES",
    "panel": "view",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selection"
    ],
    "scheduledBuild": 51,
    "reason": "Build 51 computes a bounded zoom from the selected engraved object, reflows the page and keeps the selection visible."
  },
  "fitSystem": {
    "id": "fitSystem",
    "label": "Fit system",
    "group": "LAYOUT AND PAGES",
    "panel": "view",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 51,
    "reason": "Build 51 computes a bounded zoom for the active engraved system and preserves the viewport anchor."
  },
  "fitWidth": {
    "id": "fitWidth",
    "label": "Fit width",
    "group": "LAYOUT AND PAGES",
    "panel": "view",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "focusScore": {
    "id": "focusScore",
    "label": "Focus score",
    "group": "ACCESSIBILITY AND VIEW",
    "panel": "view",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "insertMeasure": {
    "id": "insertMeasure",
    "label": "Insert measure",
    "group": "RHYTHM AND MEASURES",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "active-part"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "jumpMeasure": {
    "id": "jumpMeasure",
    "label": "Go",
    "group": "PLAYBACK",
    "panel": "playback",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "marcato": {
    "id": "marcato",
    "label": "Marcato",
    "group": "ARTICULATIONS AND EXPRESSION",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selected-note"
    ],
    "scheduledBuild": 43,
    "reason": "Build 43 connects this control to the authoritative score model with undo, persistence, staff rendering and automated regression evidence; Windows/manual usability evidence remains required."
  },
  "newScore": {
    "id": "newScore",
    "label": "Create a new score",
    "group": "FILE AND PROJECT",
    "panel": "compose",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "nextPage": {
    "id": "nextPage",
    "label": "Next page",
    "group": "LAYOUT AND PAGES",
    "panel": "view",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "octaveDown": {
    "id": "octaveDown",
    "label": "Octave −",
    "group": "PITCH AND TONALITY",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selection"
    ],
    "scheduledBuild": 42,
    "reason": "Transposes the selected semantic notes down one octave with immediate staff redraw and undo."
  },
  "octaveUp": {
    "id": "octaveUp",
    "label": "Octave +",
    "group": "PITCH AND TONALITY",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selection"
    ],
    "scheduledBuild": 42,
    "reason": "Transposes the selected semantic notes up one octave with immediate staff redraw and undo."
  },
  "open": {
    "id": "open",
    "label": "Open an Airmonlink, MusicXML, MXL, or MIDI file",
    "group": "FILE AND PROJECT",
    "panel": "compose",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "pageBreak": {
    "id": "pageBreak",
    "label": "Page break",
    "group": "RHYTHM AND MEASURES",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 43,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "paste": {
    "id": "paste",
    "label": "Paste at cursor",
    "group": "SELECTION AND CLIPBOARD",
    "panel": "compose",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "clipboard"
    ],
    "scheduledBuild": 42,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "pause": {
    "id": "pause",
    "label": "Pause and preserve the current beat",
    "group": "PLAYBACK",
    "panel": "playback",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "playback-active"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "pitchDown": {
    "id": "pitchDown",
    "label": "Transpose selected notes down a semitone",
    "group": "PITCH AND TONALITY",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selection"
    ],
    "scheduledBuild": 42,
    "reason": "Transposes the selected semantic notes down one semitone with immediate staff redraw and undo."
  },
  "pitchUp": {
    "id": "pitchUp",
    "label": "Transpose selected notes up a semitone",
    "group": "PITCH AND TONALITY",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selection"
    ],
    "scheduledBuild": 42,
    "reason": "Transposes the selected semantic notes up one semitone with immediate staff redraw and undo."
  },
  "play": {
    "id": "play",
    "label": "Play from the current beat",
    "group": "PLAYBACK",
    "panel": "playback",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 46,
    "reason": "Build 50 completion audit starts and stops playback from the authoritative score model in the browser runtime and verifies transport state without runtime exceptions."
  },
  "playMidiOutput": {
    "id": "playMidiOutput",
    "label": "Play score to MIDI",
    "group": "PLAYBACK",
    "panel": "playback",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "midi-output-device"
    ],
    "scheduledBuild": 46,
    "reason": "Build 50 completion audit verifies permission failure, mock device discovery, input recording, output scheduling, stop and disconnect behavior; physical Windows MIDI hardware remains an external manual verification boundary."
  },
  "previousPage": {
    "id": "previousPage",
    "label": "Previous page",
    "group": "LAYOUT AND PAGES",
    "panel": "view",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "print": {
    "id": "print",
    "label": "Print",
    "group": "IMPORT AND EXPORT",
    "panel": "publish",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 46,
    "reason": "Build 50 completion audit separates user cancellation from genuine print failure, preserves the desktop print path, and verifies both outcomes without hiding errors."
  },
  "printPreview": {
    "id": "printPreview",
    "label": "Print preview",
    "group": "IMPORT AND EXPORT",
    "panel": "publish",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "redo": {
    "id": "redo",
    "label": "Redo",
    "group": "SELECTION AND CLIPBOARD",
    "panel": "compose",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "redo-history"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "removeBeams": {
    "id": "removeBeams",
    "label": "Remove beams",
    "group": "ARTICULATIONS AND EXPRESSION",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selected-note"
    ],
    "scheduledBuild": 43,
    "reason": "Build 43 connects this control to the authoritative score model with undo, persistence, staff rendering and automated regression evidence; Windows/manual usability evidence remains required."
  },
  "removeMeasure": {
    "id": "removeMeasure",
    "label": "Remove measure",
    "group": "RHYTHM AND MEASURES",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "active-part"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "removePart": {
    "id": "removePart",
    "label": "Remove part",
    "group": "STAFF AND INSTRUMENTS",
    "panel": "compose",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 47,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "removeSpanners": {
    "id": "removeSpanners",
    "label": "Remove",
    "group": "TIES SLURS AND SPANNERS",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selected-note"
    ],
    "scheduledBuild": 43,
    "reason": "Build 43 connects this control to the authoritative score model with undo, persistence, staff rendering and automated regression evidence; Windows/manual usability evidence remains required."
  },
  "repeatEnd": {
    "id": "repeatEnd",
    "label": "Repeat end",
    "group": "RHYTHM AND MEASURES",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 43,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "repeatStart": {
    "id": "repeatStart",
    "label": "Repeat start",
    "group": "RHYTHM AND MEASURES",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 43,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "replaceLyrics": {
    "id": "replaceLyrics",
    "label": "Replace in verse",
    "group": "LYRICS AND TEXT",
    "panel": "lyrics",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 44,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "replaceSelection": {
    "id": "replaceSelection",
    "label": "Replace selection",
    "group": "VOICES AND LAYERS",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selection",
      "clipboard"
    ],
    "scheduledBuild": 43,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "resetLayerMix": {
    "id": "resetLayerMix",
    "label": "Reset mix",
    "group": "PLAYBACK",
    "panel": "playback",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "resetLyricOffset": {
    "id": "resetLyricOffset",
    "label": "Reset",
    "group": "LYRICS AND TEXT",
    "panel": "lyrics",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selection"
    ],
    "scheduledBuild": 44,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "resetPublicationLayout": {
    "id": "resetPublicationLayout",
    "label": "Reset position",
    "group": "LYRICS AND TEXT",
    "panel": "publish",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "resume": {
    "id": "resume",
    "label": "Resume from the paused beat",
    "group": "PLAYBACK",
    "panel": "playback",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "playback-paused"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "rewind": {
    "id": "rewind",
    "label": "Return to the start",
    "group": "PLAYBACK",
    "panel": "playback",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "save": {
    "id": "save",
    "label": "Save score",
    "group": "FILE AND PROJECT",
    "panel": "compose",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "saveAs": {
    "id": "saveAs",
    "label": "Save a copy",
    "group": "FILE AND PROJECT",
    "panel": "compose",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "selectNext": {
    "id": "selectNext",
    "label": "Select next event (Right arrow)",
    "group": "SELECTION AND CLIPBOARD",
    "panel": "compose",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 42,
    "reason": "Moves the real staff selection to the next authored event and synchronizes the caret and active voice."
  },
  "selectPrevious": {
    "id": "selectPrevious",
    "label": "Select previous event (Left arrow)",
    "group": "SELECTION AND CLIPBOARD",
    "panel": "compose",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 42,
    "reason": "Moves the real staff selection to the previous authored event and synchronizes the caret and active voice."
  },
  "showRecent": {
    "id": "showRecent",
    "label": "Recent files",
    "group": "FILE AND PROJECT",
    "panel": "compose",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "showRecovery": {
    "id": "showRecovery",
    "label": "Recover work",
    "group": "FILE AND PROJECT",
    "panel": "compose",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "showSettings": {
    "id": "showSettings",
    "label": "Settings",
    "group": "FILE AND PROJECT",
    "panel": "compose",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "showSolfa": {
    "id": "showSolfa",
    "label": "Tonic Sol-fa page",
    "group": "TONIC SOLFA",
    "panel": "view",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "showStaff": {
    "id": "showStaff",
    "label": "Staff page",
    "group": "TONIC SOLFA",
    "panel": "view",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "slur": {
    "id": "slur",
    "label": "Slur",
    "group": "TIES SLURS AND SPANNERS",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "two-notes"
    ],
    "scheduledBuild": 43,
    "reason": "Build 43 connects this control to the authoritative score model with undo, persistence, staff rendering and automated regression evidence; Windows/manual usability evidence remains required."
  },
  "staccato": {
    "id": "staccato",
    "label": "Staccato",
    "group": "ARTICULATIONS AND EXPRESSION",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selected-note"
    ],
    "scheduledBuild": 43,
    "reason": "Build 43 connects this control to the authoritative score model with undo, persistence, staff rendering and automated regression evidence; Windows/manual usability evidence remains required."
  },
  "startMidiRecord": {
    "id": "startMidiRecord",
    "label": "Record",
    "group": "PLAYBACK",
    "panel": "playback",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "midi-input-device"
    ],
    "scheduledBuild": 46,
    "reason": "Build 50 completion audit verifies permission failure, mock device discovery, input recording, output scheduling, stop and disconnect behavior; physical Windows MIDI hardware remains an external manual verification boundary."
  },
  "stop": {
    "id": "stop",
    "label": "Stop playback",
    "group": "PLAYBACK",
    "panel": "playback",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "playback-active"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "stopMidiOutput": {
    "id": "stopMidiOutput",
    "label": "Stop MIDI output",
    "group": "PLAYBACK",
    "panel": "playback",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "midi-output-device"
    ],
    "scheduledBuild": 46,
    "reason": "Build 50 completion audit verifies permission failure, mock device discovery, input recording, output scheduling, stop and disconnect behavior; physical Windows MIDI hardware remains an external manual verification boundary."
  },
  "stopMidiRecord": {
    "id": "stopMidiRecord",
    "label": "Stop recording",
    "group": "PLAYBACK",
    "panel": "playback",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "midi-input-device"
    ],
    "scheduledBuild": 46,
    "reason": "Build 50 completion audit verifies permission failure, mock device discovery, input recording, output scheduling, stop and disconnect behavior; physical Windows MIDI hardware remains an external manual verification boundary."
  },
  "systemBreak": {
    "id": "systemBreak",
    "label": "System break",
    "group": "RHYTHM AND MEASURES",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 43,
    "reason": "Build 50 completion audit verifies the visible control, authoritative engine mutation, context handling, persistence or export behavior, and browser interaction path."
  },
  "tenuto": {
    "id": "tenuto",
    "label": "Tenuto",
    "group": "ARTICULATIONS AND EXPRESSION",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selected-note"
    ],
    "scheduledBuild": 43,
    "reason": "Build 43 connects this control to the authoritative score model with undo, persistence, staff rendering and automated regression evidence; Windows/manual usability evidence remains required."
  },
  "tie": {
    "id": "tie",
    "label": "Tie",
    "group": "TIES SLURS AND SPANNERS",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "two-notes"
    ],
    "scheduledBuild": 43,
    "reason": "Build 43 connects this control to the authoritative score model with undo, persistence, staff rendering and automated regression evidence; Windows/manual usability evidence remains required."
  },
  "togglePianoPanel": {
    "id": "togglePianoPanel",
    "label": "Show piano",
    "group": "ACCESSIBILITY AND VIEW",
    "panel": "view",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "trill": {
    "id": "trill",
    "label": "Trill",
    "group": "ARTICULATIONS AND EXPRESSION",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selected-note"
    ],
    "scheduledBuild": 43,
    "reason": "Build 43 connects this control to the authoritative score model with undo, persistence, staff rendering and automated regression evidence; Windows/manual usability evidence remains required."
  },
  "tripletSelected": {
    "id": "tripletSelected",
    "label": "Triplet",
    "group": "NOTE ENTRY",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selection"
    ],
    "scheduledBuild": 43,
    "reason": "Build 43 connects this control to the authoritative score model with undo, persistence, staff rendering and automated regression evidence; Windows/manual usability evidence remains required."
  },
  "turn": {
    "id": "turn",
    "label": "Turn",
    "group": "ARTICULATIONS AND EXPRESSION",
    "panel": "notation",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "selected-note"
    ],
    "scheduledBuild": 43,
    "reason": "Build 43 connects this control to the authoritative score model with undo, persistence, staff rendering and automated regression evidence; Windows/manual usability evidence remains required."
  },
  "undo": {
    "id": "undo",
    "label": "Undo",
    "group": "SELECTION AND CLIPBOARD",
    "panel": "compose",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "undo-history"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "verifySolfa": {
    "id": "verifySolfa",
    "label": "Verify synchronization",
    "group": "TONIC SOLFA",
    "panel": "view",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "zoomIn": {
    "id": "zoomIn",
    "label": "+",
    "group": "LAYOUT AND PAGES",
    "panel": "view",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "zoomOut": {
    "id": "zoomOut",
    "label": "−",
    "group": "LAYOUT AND PAGES",
    "panel": "view",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  },
  "zoom125": {
    "id": "zoom125",
    "label": "125%",
    "group": "LAYOUT AND PAGES",
    "panel": "view",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": ["score"],
    "scheduledBuild": 51,
    "reason": "Build 51 applies the exact 125% professional zoom preset through the viewport service."
  },
  "zoom150": {
    "id": "zoom150",
    "label": "150%",
    "group": "LAYOUT AND PAGES",
    "panel": "view",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": ["score"],
    "scheduledBuild": 51,
    "reason": "Build 51 applies the exact 150% professional zoom preset through the viewport service."
  },
  "zoomReset": {
    "id": "zoomReset",
    "label": "100%",
    "group": "LAYOUT AND PAGES",
    "panel": "view",
    "status": "VERIFIED FUNCTIONAL",
    "requiredContext": [
      "score"
    ],
    "scheduledBuild": 41,
    "reason": "Direct renderer or engine path has automated evidence; final Windows/manual usability evidence is still required."
  }
});

  function context(engine) {
    const state = engine && typeof engine.state === 'function' ? engine.state() : {};
    const selected = Array.isArray(state.selectedEvents) ? state.selectedEvents : [];
    const selectedNotes = selected.filter(item => item && item.event && item.event.type === 'note');
    return Object.freeze({
      score: Boolean(state.score),
      activePart: Boolean(state.activePartId),
      selectionCount: selected.length,
      selectedNoteCount: selectedNotes.length,
      hasNoteEntryAnchor: Boolean(state.lastEntry && state.lastEntry.type === 'note'),
      hasClipboard: Boolean(engine && engine.clipboard),
      canUndo: Boolean(state.canUndo),
      canRedo: Boolean(state.canRedo),
      playing: Boolean(state.playing),
      paused: Boolean(state.transport && state.transport.paused),
      midiInput: Boolean(state.midi && state.midi.deviceId),
      midiOutput: Boolean(state.midi && state.midi.outputDeviceId)
    });
  }

  function requirementSatisfied(requirement, value) {
    if (requirement === 'score') return value.score;
    if (requirement === 'active-part') return value.activePart;
    if (requirement === 'selection') return value.selectionCount > 0;
    if (requirement === 'selected-note') return value.selectedNoteCount > 0;
    if (requirement === 'note-entry-anchor') return value.selectedNoteCount > 0 || value.hasNoteEntryAnchor;
    if (requirement === 'two-notes') return value.selectedNoteCount >= 2;
    if (requirement === 'clipboard') return value.hasClipboard;
    if (requirement === 'undo-history') return value.canUndo;
    if (requirement === 'redo-history') return value.canRedo;
    if (requirement === 'playback-active') return value.playing;
    if (requirement === 'playback-paused') return value.paused;
    if (requirement === 'midi-input-device') return value.midiInput;
    if (requirement === 'midi-output-device') return value.midiOutput;
    return false;
  }

  function evaluate(commandId, engine) {
    const command = COMMANDS[commandId];
    if (!command) return Object.freeze({ visible: false, enabled: false, reason: 'Unregistered production command.' });
    const value = context(engine);
    const verified = command.status === STATUS.VERIFIED;
    const missing = command.requiredContext.filter(item => !requirementSatisfied(item, value));
    return Object.freeze({
      visible: verified,
      enabled: verified && missing.length === 0,
      status: command.status,
      missing: Object.freeze(missing),
      reason: !verified ? command.reason : missing.length ? `Requires ${missing.join(', ')}.` : ''
    });
  }

  function audit(commandIds) {
    const ids = Array.from(new Set(commandIds || []));
    const missing = ids.filter(id => !COMMANDS[id]);
    const nonProduction = ids.filter(id => COMMANDS[id] && COMMANDS[id].status !== STATUS.VERIFIED);
    return Object.freeze({
      registered: ids.length - missing.length,
      total: ids.length,
      missing: Object.freeze(missing),
      nonProduction: Object.freeze(nonProduction)
    });
  }

  return Object.freeze({ STATUS, COMMANDS, context, evaluate, audit });
});
