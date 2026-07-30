(function (root, factory) {
  const dependencies = {
    theory: root.AirmonMusicTheory || (typeof require === 'function' ? require('../core/music-theory') : null),
    model: root.AirmonScoreModel || (typeof require === 'function' ? require('../core/score-model') : null),
    airscore: root.AirmonAirscore || (typeof require === 'function' ? require('../core/airscore') : null),
    history: root.AirmonHistory || (typeof require === 'function' ? require('../core/history') : null),
    selection: root.AirmonSelection || (typeof require === 'function' ? require('../core/selection') : null),
    editing: root.AirmonEditing || (typeof require === 'function' ? require('../core/editing') : null),
    lyrics: root.AirmonLyrics || (typeof require === 'function' ? require('../core/lyrics') : null),
    solfa: root.AirmonSolfa || (typeof require === 'function' ? require('../core/solfa') : null),
    layout: root.AirmonLayoutEngine || (typeof require === 'function' ? require('../core/layout-engine') : null),
    solfaLayout: root.AirmonSolfaLayout || (typeof require === 'function' ? require('../core/solfa-layout') : null),
    formats: root.AirmonFormats || (typeof require === 'function' ? require('../core/formats') : null),
    playback: root.AirmonPlayback || (typeof require === 'function' ? require('../core/playback') : null),
    notations: root.AirmonNotations || (typeof require === 'function' ? require('../core/notations') : null),
    midiInput: root.AirmonMidiInput || (typeof require === 'function' ? require('../core/midi-input') : null),
    harmony: root.AirmonHarmony || (typeof require === 'function' ? require('../core/harmony') : null),
    professionalEditing: root.AirmonProfessionalEditing || (typeof require === 'function' ? require('../core/professional-editing') : null),
    notationSystem: root.AirmonNotationSystem || (typeof require === 'function' ? require('../core/notation-system-service') : null),
    choirSolfa: root.AirmonChoirSolfa || (typeof require === 'function' ? require('../core/choir-solfa-service') : null),
    partsEngraving: root.AirmonPartsEngraving || (typeof require === 'function' ? require('../core/parts-engraving-service') : null),
    inspector: root.AirmonInspector || (typeof require === 'function' ? require('../core/inspector-service') : null),
    palette: root.AirmonPalette || (typeof require === 'function' ? require('../core/palette-service') : null),
    practiceAudio: root.AirmonPracticeAudio || (typeof require === 'function' ? require('../core/practice-audio-service') : null),
    compositionHub: root.AirmonCompositionHub || (typeof require === 'function' ? require('../core/composition-hub-service') : null),
    filePublishing: root.AirmonFilePublishing || (typeof require === 'function' ? require('../core/file-publishing-service') : null),
    productivity: root.AirmonProductivityReliability || (typeof require === 'function' ? require('../core/productivity-reliability-service') : null),
    releaseAudit: root.AirmonReleaseAudit || (typeof require === 'function' ? require('../core/release-audit-service') : null),
    staffInput: root.AirmonStaffInput || (typeof require === 'function' ? require('./staff-input-service') : null),
    rhythmicNotation: root.AirmonRhythmicNotation || (typeof require === 'function' ? require('../core/rhythmic-notation-service') : null)
  };
  const api = factory(dependencies);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AirmonComposer3Engine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';

  const REQUIRED = ['model', 'airscore', 'history', 'selection', 'editing', 'lyrics', 'solfa', 'layout', 'solfaLayout', 'formats', 'staffInput', 'rhythmicNotation'];
  for (const key of REQUIRED) {
    if (!deps[key]) throw new Error(`Composer 3 engine dependency is unavailable: ${key}`);
  }

  const clone = value => JSON.parse(JSON.stringify(value));
  const clampVoice = value => Math.max(1, Math.min(4, Number(value) || 1));
  const asBytes = value => value instanceof Uint8Array ? value : new Uint8Array(value || []);
  const defaultLayerMix = () => ({
    1: { muted: false, solo: false, volume: 1 },
    2: { muted: false, solo: false, volume: 1 },
    3: { muted: false, solo: false, volume: 1 },
    4: { muted: false, solo: false, volume: 1 }
  });
  const normalizeLayerMix = value => {
    const result = defaultLayerMix();
    for (let voice = 1; voice <= 4; voice += 1) {
      const input = value?.[voice] || value?.[String(voice)] || {};
      result[voice] = {
        muted: Boolean(input.muted),
        solo: Boolean(input.solo),
        volume: Math.max(0, Math.min(1, Number(input.volume ?? 1)))
      };
    }
    return result;
  };


  const COMMAND_GROUPS = Object.freeze([
    ['FILE AND PROJECT', ['newScore', 'open', 'save', 'saveAs', 'exit']],
    ['SELECTION AND CLIPBOARD', ['undo', 'redo', 'copy', 'paste', 'replaceSelection', 'deleteSelection']],
    ['NOTE ENTRY', ['addNote', 'addRest', 'addChordTone', 'pianoChord', 'dotSelected', 'tripletSelected']],
    ['PITCH AND TONALITY', ['pitchDown', 'pitchUp', 'octaveDown', 'octaveUp', 'applyMeasureAttributes']],
    ['RHYTHM AND MEASURES', ['appendMeasure', 'insertMeasure', 'removeMeasure', 'repeatStart', 'repeatEnd']],
    ['VOICES AND LAYERS', ['copyToLayer', 'setActiveVoice', 'applyPart']],
    ['ARTICULATIONS AND EXPRESSION', ['staccato', 'accent', 'tenuto', 'marcato', 'trill', 'turn', 'fermata', 'applyTechnique', 'beamSelected', 'beamAuto', 'removeBeams', 'applyDynamic']],
    ['TIES SLURS AND SPANNERS', ['tie', 'slur', 'removeSpanners']],
    ['LYRICS AND TEXT', ['applyLyric', 'applyLyricsParagraph', 'copyLyricVerse', 'deleteLyricVerse', 'replaceLyrics', 'applyLyricOffset', 'resetLyricOffset', 'addTextAnnotation', 'applyPublication', 'applyPublicationLayout', 'resetPublicationLayout', 'addPageText']],
    ['HARMONY AND CHORDS', ['addChordTone', 'addThird', 'addFifth', 'addChordSymbol']],
    ['STAFF AND INSTRUMENTS', ['addPart', 'removePart', 'applyPart', 'applyScoreSetup']],
    ['TONIC SOLFA', ['showSolfa', 'showSolfaOverlay', 'applySolfaSyllable', 'applySolfaPassage', 'verifySolfa']],
    ['LAYOUT AND PAGES', ['systemBreak', 'pageBreak', 'fitWidth', 'fitPage']],
    ['PLAYBACK', ['rewind', 'play', 'pause', 'resume', 'stop', 'jumpMeasure', 'applyLoop', 'resetLayerMix', 'enableMidi', 'enableMidiOutput', 'playMidiOutput', 'stopMidiOutput', 'startMidiRecord', 'stopMidiRecord', 'disconnectMidi']],
    ['IMPORT AND EXPORT', ['open', 'exportMusicXml', 'exportMxl', 'exportMidi', 'printPreview', 'exportPdf', 'exportPng', 'print']],
    ['ACCESSIBILITY AND VIEW', ['showStaff', 'showSolfa', 'togglePianoPanel', 'collapsePianoPanel', 'zoomOut', 'zoomReset', 'zoomIn', 'selectPrevious', 'selectNext']]
  ]);

  class Composer3Engine {
    constructor(options = {}) {
      this.listeners = new Set();
      this.errorListeners = new Set();
      this.history = new deps.history.HistoryManager(250);
      this.selection = new deps.selection.SelectionModel();
      this.clipboard = null;
      this.playback = null;
      this.transport = {
        loop: false,
        loopStart: 0,
        loopEnd: null,
        metronome: false,
        countInMeasures: 0,
        paused: false,
        layerMix: defaultLayerMix()
      };
      this.midi = {
        mode: 'step',
        status: 'disabled',
        deviceId: null,
        input: null,
        recording: false,
        messagesReceived: 0,
        notesEntered: 0,
        lastError: null
      };
      this.filePath = null;
      this.documentId = options.documentId || `score-${Date.now().toString(36)}`;
      this.dirty = false;
      this.cursor = 0;
      this.duration = 1;
      this.activeVoice = 1;
      this.activeStaff = null;
      this.lastEntry = null;
      this.score = options.score
        ? deps.model.normalizeScore(deps.model.cloneScore(options.score))
        : deps.model.createScore({
          title: options.title || 'Untitled Score',
          composer: options.composer || '',
          template: options.template || 'lead',
          measures: Number(options.measures) || 8,
          key: options.key || 'C',
          timeSignature: options.timeSignature || '4/4',
          autoFillRests: options.autoFillRests !== false
        });
      this.activePartId = options.activePartId && this.score.parts.some(part => part.id === options.activePartId)
        ? options.activePartId
        : this.score.parts[0]?.id || null;
      this.history.reset(this.score);
      this.assertCanonical();
    }

    onChange(listener) {
      if (typeof listener !== 'function') return () => {};
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    onError(listener) {
      if (typeof listener !== 'function') return () => {};
      this.errorListeners.add(listener);
      return () => this.errorListeners.delete(listener);
    }

    emit(label = 'Updated') {
      const state = this.state();
      for (const listener of this.listeners) {
        try { listener(state, label); } catch (_) {}
      }
      return state;
    }

    emitError(error, context = 'Composer operation') {
      const normalized = error instanceof Error ? error : new Error(String(error));
      for (const listener of this.errorListeners) {
        try { listener(normalized, context); } catch (_) {}
      }
      return normalized;
    }

    activePart() {
      return this.score.parts.find(part => part.id === this.activePartId) || this.score.parts[0] || null;
    }

    selectedEntries() {
      return this.selection.eventEntries(this.score);
    }

    inspectorSelection() {
      if (!deps.inspector) throw new Error('Selected-object inspector is unavailable.');
      return deps.inspector.editableSnapshot(this.selectedEntries());
    }

    updateInspector(patch = {}) {
      if (!deps.inspector) throw new Error('Selected-object inspector is unavailable.');
      return this.commit('Edit selected properties', () =>
        deps.inspector.applyPatch(this.score, this.selectedEntries(), patch)
      );
    }

    paletteContext(options = {}) {
      if (!deps.palette) throw new Error('Notation palette is unavailable.');
      return deps.palette.contextFor(this.selectedEntries(), Boolean(options.staffTarget));
    }

    applyPaletteSymbol(symbolId, options = {}) {
      if (!deps.palette) throw new Error('Notation palette is unavailable.');
      const item = deps.palette.BY_ID[symbolId];
      if (!item) throw new Error('Unknown palette symbol.');
      const context = this.paletteContext({ staffTarget: options.start != null });
      const available = deps.palette.availability(item, context);
      if (!available.enabled) throw new Error(available.reason);
      if (item.kind === 'pitch') return this.addNote({
        pitch: `${item.label}${Math.max(0, Math.min(9, Number(options.octave) || 4))}`,
        start: Number(options.start),
        duration: options.duration ?? this.duration,
        staff: options.staff ?? this.activeStaff,
        inputSource: 'composer3-palette'
      });
      if (item.kind === 'rest') return this.addRest({
        start: Number(options.start),
        duration: options.duration ?? this.duration,
        staff: options.staff ?? this.activeStaff,
        inputSource: 'composer3-palette'
      });
      if (item.kind === 'articulation') return this.setArticulation(item.id, true);
      if (item.kind === 'fermata') return this.setFermata(true);
      if (item.kind === 'tie') return this.addTie();
      if (item.kind === 'slur') return this.addSlur();
      if (item.kind === 'beam') return this.beamSelection();
      throw new Error('This palette symbol has no engine operation.');
    }

    state() {
      return {
        score: this.score,
        selection: this.selection.snapshot(),
        selectedEvents: this.selectedEntries().map(({ part, event }) => ({ partId: part.id, event })),
        activePartId: this.activePartId,
        activeVoice: this.activeVoice,
        activeStaff: this.activeStaff,
        cursor: this.cursor,
        duration: this.duration,
        lastEntry: this.lastEntry ? clone(this.lastEntry) : null,
        filePath: this.filePath,
        documentId: this.documentId,
        dirty: this.dirty,
        canUndo: this.history.canUndo,
        canRedo: this.history.canRedo,
        playing: Boolean(this.playback?.playing),
        playbackBeat: Number(this.playback?.currentBeat) || 0,
        transport: this.playbackState(),
        midi: this.midiState(),
        mixer: deps.practiceAudio ? deps.practiceAudio.normalizeMixer(this.score) : null
      };
    }

    assertCanonical() {
      if (!this.score || !Array.isArray(this.score.parts) || !Array.isArray(this.score.measures)) {
        throw new Error('The authoritative score model is incomplete.');
      }
      for (const part of this.score.parts) {
        part.voiceLayers = [1, 2, 3, 4];
        for (const event of part.events || []) event.voice = clampVoice(event.voice);
      }
      const issues = deps.model.validateScore(this.score) || [];
      const structural = issues.filter(issue => issue?.severity === 'error');
      if (structural.length) throw new Error(structural.map(issue => issue.message).join('\n'));
      return true;
    }

    commit(label, operation, options = {}) {
      const before = {
        score: clone(this.score),
        activePartId: this.activePartId,
        activeVoice: this.activeVoice,
        activeStaff: this.activeStaff,
        cursor: this.cursor,
        duration: this.duration,
        lastEntry: this.lastEntry ? clone(this.lastEntry) : null,
        selection: this.selection.snapshot().eventIds || []
      };
      try {
        const result = operation();
        this.assertCanonical();
        this.history.snapshot(this.score, label);
        if (options.dirty !== false) this.dirty = true;
        this.emit(label);
        return result;
      } catch (error) {
        this.score = before.score;
        this.activePartId = before.activePartId;
        this.activeVoice = before.activeVoice;
        this.activeStaff = before.activeStaff;
        this.cursor = before.cursor;
        this.duration = before.duration;
        this.lastEntry = before.lastEntry;
        this.selection.clear();
        if (before.selection.length) this.selection.selectEvents(before.selection);
        throw this.emitError(error, label);
      }
    }

    replaceScore(score, label = 'Open score', options = {}) {
      this.score = deps.model.normalizeScore(clone(score));
      this.activePartId = this.score.parts[0]?.id || null;
      this.activeVoice = 1;
      this.activeStaff = null;
      this.cursor = 0;
      this.lastEntry = null;
      this.selection.clear();
      this.clipboard = null;
      this.history.reset(this.score);
      this.filePath = options.filePath || null;
      this.documentId = options.documentId || this.documentId || `score-${Date.now().toString(36)}`;
      this.dirty = Boolean(options.dirty);
      this.assertCanonical();
      return this.emit(label);
    }

    newScore(options = {}) {
      const score = deps.model.createScore({
        title: options.title || 'Untitled Score',
        composer: options.composer || '',
        template: options.template || 'lead',
        measures: Number(options.measures) || 8,
        key: options.key || 'C',
        timeSignature: options.timeSignature || '4/4',
        autoFillRests: options.autoFillRests !== false
      });
      this.documentId = `score-${Date.now().toString(36)}`;
      return this.replaceScore(score, 'New score', { dirty: false, filePath: null, documentId: this.documentId });
    }

    setMetadata(patch = {}) {
      return this.commit('Edit score information', () => {
        const allowed = ['title', 'subtitle', 'dedication', 'composer', 'lyricist', 'arranger', 'compositionDate', 'copyright', 'source', 'supportingText', 'dateText', 'movementTitle', 'description'];
        for (const key of allowed) if (Object.prototype.hasOwnProperty.call(patch, key)) this.score.metadata[key] = String(patch[key] ?? '');
        if (Object.prototype.hasOwnProperty.call(patch, 'title')) this.score.title = String(patch.title || 'Untitled Score');
        if (Object.prototype.hasOwnProperty.call(patch, 'composer')) this.score.composer = String(patch.composer || '');
        deps.model.touch(this.score);
        return this.score.metadata;
      });
    }

    setSettings(patch = {}) {
      return this.commit('Edit score settings', () => {
        Object.assign(this.score.settings, patch);
        if (patch.tempo != null) this.score.settings.tempo = Math.max(20, Math.min(400, Number(patch.tempo) || 120));
        if (patch.pageSize != null) {
          const allowed = ['A4', 'A3', 'A5', 'Letter', 'Legal'];
          this.score.settings.pageSize = allowed.includes(String(patch.pageSize)) ? String(patch.pageSize) : 'A4';
        }
        if (patch.orientation != null || patch.pageOrientation != null) {
          const value = String(patch.orientation ?? patch.pageOrientation);
          this.score.settings.orientation = value === 'landscape' ? 'landscape' : 'portrait';
          this.score.settings.pageOrientation = this.score.settings.orientation;
        }
        for (const [key, minimum, maximum] of [
          ['margins', 5, 50], ['staffSize', 50, 180], ['staffGap', 24, 140],
          ['partGap', 24, 160], ['systemGap', 24, 180], ['solfaFontSize', 6, 28],
          ['solfaVerticalSpacing', 6, 40]
        ]) {
          if (patch[key] != null) this.score.settings[key] = Math.max(minimum, Math.min(maximum, Number(patch[key]) || minimum));
        }
        deps.model.touch(this.score);
        return this.score.settings;
      });
    }

    setPublicationLayout(field, patch = {}) {
      const raw = String(field || '').trim();
      if (!raw) throw new Error('Choose a publication text field first.');
      const key = /^(staff|solfa):/.test(raw) ? raw : `staff:${raw}`;
      return this.commit('Edit publication text layout', () => clone(deps.model.updatePublicationTextLayout(this.score, key, {
        offsetX: Number.isFinite(Number(patch.offsetX ?? patch.x)) ? Number(patch.offsetX ?? patch.x) : undefined,
        offsetY: Number.isFinite(Number(patch.offsetY ?? patch.y)) ? Number(patch.offsetY ?? patch.y) : undefined,
        alignment: patch.alignment,
        fontFamily: patch.fontFamily,
        fontSize: patch.fontSize,
        fontStyle: patch.fontStyle,
        fontWeight: patch.fontWeight,
        visible: patch.visible
      })));
    }

    setAnnotationLayout(annotationId, patch = {}) {
      const id = String(annotationId || '').trim();
      if (!id) throw new Error('Choose a text annotation first.');
      return this.commit('Edit text annotation layout', () => {
        const updated = deps.model.updateAnnotation(this.score, id, {
          offsetX: Number.isFinite(Number(patch.offsetX ?? patch.x)) ? Number(patch.offsetX ?? patch.x) : 0,
          offsetY: Number.isFinite(Number(patch.offsetY ?? patch.y)) ? Number(patch.offsetY ?? patch.y) : 0
        });
        if (!updated) throw new Error('The selected text annotation no longer exists.');
        return clone(updated);
      });
    }


    setActivePart(partId) {
      const part = this.score.parts.find(item => item.id === partId);
      if (!part) throw new Error('The selected score part does not exist.');
      this.activePartId = part.id;
      this.activeStaff = deps.model.defaultStaff(part);
      this.lastEntry = null;
      this.emit('Active part changed');
      return part;
    }

    setActiveVoice(voice) {
      this.activeVoice = clampVoice(voice);
      this.lastEntry = null;
      const part = this.activePart();
      if (part) deps.model.activateVoice(part, this.activeVoice);
      this.emit('Active voice changed');
      return this.activeVoice;
    }

    setActiveStaff(staff) {
      this.activeStaff = staff || null;
      this.emit('Active staff changed');
      return this.activeStaff;
    }

    setDuration(duration) {
      const value = Number(duration);
      if (!Number.isFinite(value) || value <= 0) throw new Error('Duration must be a positive musical value.');
      this.duration = value;
      this.emit('Duration changed');
      return value;
    }

    seek(beat) {
      this.cursor = Math.max(0, Math.min(deps.model.totalBeats(this.score), Number(beat) || 0));
      this.lastEntry = null;
      if (this.playback) {
        this.playback.seek(
          this.score,
          this.cursor,
          this.transport.loop,
          this.loopRange(),
          { metronome: this.transport.metronome, layerMix: this.transport.layerMix }
        );
      }
      this.emit('Cursor moved');
      return this.cursor;
    }

    loopRange() {
      const total = deps.model.totalBeats(this.score);
      const start = Math.max(0, Math.min(total, Number(this.transport.loopStart) || 0));
      const endValue = this.transport.loopEnd == null ? total : Number(this.transport.loopEnd);
      const end = Math.max(start, Math.min(total, Number.isFinite(endValue) ? endValue : total));
      return end > start + 1e-8 ? { start, end } : null;
    }

    playbackState() {
      return {
        loop: Boolean(this.transport.loop),
        loopStart: Number(this.transport.loopStart) || 0,
        loopEnd: this.transport.loopEnd == null ? null : Number(this.transport.loopEnd),
        metronome: Boolean(this.transport.metronome),
        countInMeasures: Math.max(0, Math.min(4, Number(this.transport.countInMeasures) || 0)),
        paused: Boolean(this.transport.paused),
        layerMix: clone(this.transport.layerMix),
        playing: Boolean(this.playback?.playing),
        beat: Number(this.playback?.currentBeat ?? this.cursor) || 0
      };
    }

    setPlaybackOptions(patch = {}) {
      const total = deps.model.totalBeats(this.score);
      if (Object.prototype.hasOwnProperty.call(patch, 'loop')) this.transport.loop = Boolean(patch.loop);
      if (Object.prototype.hasOwnProperty.call(patch, 'metronome')) this.transport.metronome = Boolean(patch.metronome);
      if (Object.prototype.hasOwnProperty.call(patch, 'countInMeasures')) {
        this.transport.countInMeasures = Math.max(0, Math.min(4, Math.round(Number(patch.countInMeasures) || 0)));
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'loopStart')) {
        this.transport.loopStart = Math.max(0, Math.min(total, Number(patch.loopStart) || 0));
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'loopEnd')) {
        const value = patch.loopEnd == null || patch.loopEnd === '' ? null : Number(patch.loopEnd);
        this.transport.loopEnd = value == null || !Number.isFinite(value) ? null : Math.max(0, Math.min(total, value));
      }
      if (this.transport.loopEnd != null && this.transport.loopEnd <= this.transport.loopStart) {
        throw new Error('Loop end must be later than loop start.');
      }
      this.emit('Playback options changed');
      return this.playbackState();
    }

    setLayerPlayback(voice, patch = {}) {
      const layer = clampVoice(voice);
      const current = this.transport.layerMix[layer] || { muted: false, solo: false, volume: 1 };
      this.transport.layerMix[layer] = {
        muted: Object.prototype.hasOwnProperty.call(patch, 'muted') ? Boolean(patch.muted) : current.muted,
        solo: Object.prototype.hasOwnProperty.call(patch, 'solo') ? Boolean(patch.solo) : current.solo,
        volume: Object.prototype.hasOwnProperty.call(patch, 'volume')
          ? Math.max(0, Math.min(1, Number(patch.volume)))
          : current.volume
      };
      this.emit(`Voice ${layer} playback changed`);
      return clone(this.transport.layerMix[layer]);
    }

    resetLayerPlayback() {
      this.transport.layerMix = defaultLayerMix();
      this.emit('Voice playback reset');
      return clone(this.transport.layerMix);
    }

    selectEvent(eventId, options = {}) {
      this.selection.selectEvent(eventId, options);
      const entry = this.selectedEntries().at(-1);
      if (entry) {
        this.activePartId = entry.part.id;
        this.activeVoice = clampVoice(entry.event.voice);
        this.activeStaff = entry.event.staff || null;
        this.cursor = Number(entry.event.start) || 0;
      }
      this.emit('Selection changed');
      return entry || null;
    }

    selectEvents(eventIds, options = {}) {
      this.selection.selectEvents(eventIds, options);
      this.emit('Selection changed');
      return this.selectedEntries();
    }

    clearSelection() {
      this.selection.clear();
      this.emit('Selection cleared');
    }

    addNote(input = {}) {
      const part = this.activePart();
      if (!part) throw new Error('Create or select a score part before entering a note.');
      const duration = deps.staffInput.normalizeDuration(input.duration ?? this.duration);
      const start = Math.max(0, Number(input.start ?? this.cursor) || 0);
      const pitchInput = input.pitch != null
        ? { pitch: String(input.pitch) }
        : { midi: Math.max(0, Math.min(127, Math.round(Number(input.midi ?? 60)))) };
      const voice = clampVoice(input.voice ?? this.activeVoice);
      const staff = input.staff ?? this.activeStaff;
      return this.commit('Enter note', () => {
        deps.staffInput.ensureCapacity(deps.model, this.score, start + duration);
        const segments = deps.staffInput.planSegments(deps.model, this.score, start, duration);
        for (const segment of segments) {
          const candidate = {
            type: 'note',
            ...pitchInput,
            start: segment.start,
            duration: segment.duration,
            voice,
            staff,
            allowChord: input.allowChord === true
          };
          const placement = deps.model.canPlaceEvent(this.score, part.id, candidate);
          if (!placement.ok) {
            const error = new Error(placement.reason || 'That rhythmic position is already occupied.');
            error.code = 'STAFF_INPUT_CONFLICT';
            error.recoverable = true;
            throw error;
          }
        }

        const created = segments.map((segment, index) => deps.model.addNote(this.score, part.id, {
          ...pitchInput,
          start: segment.start,
          duration: segment.duration,
          voice,
          staff,
          velocity: Number(input.velocity) || 88,
          allowChord: input.allowChord === true,
          inputSource: input.inputSource || 'composer3-staff-input',
          tieStop: index > 0,
          tieStart: index < segments.length - 1
        }));
        for (let index = 1; index < created.length; index += 1) {
          deps.model.addTie(this.score, created[index - 1].id, created[index].id, {
            generatedBy: 'safe-measure-continuation'
          });
        }
        this.selection.selectEvents(created.map(event => event.id));
        if (input.advance !== false) this.cursor = start + duration;
        this.lastEntry = {
          type: 'note',
          partId: part.id,
          eventIds: created.map(event => event.id),
          start,
          duration,
          voice,
          staff,
          pitch: created[0]?.pitch || pitchInput.pitch || null,
          midi: created[0]?.midi ?? pitchInput.midi ?? null
        };
        return created[0];
      });
    }

    addPianoChord(midis, input = {}) {
      const part = this.activePart();
      if (!part) throw new Error('Create or select a score part before entering piano notes.');
      const pitches = Array.from(new Set((Array.isArray(midis) ? midis : [midis])
        .map(value => Math.max(0, Math.min(127, Math.round(Number(value)))))
        .filter(Number.isFinite))).sort((a, b) => a - b);
      if (!pitches.length) throw new Error('Choose at least one piano key.');
      const duration = Number(input.duration ?? this.duration) || 1;
      const start = Number(input.start ?? this.cursor) || 0;
      const voice = clampVoice(input.voice ?? this.activeVoice);
      const staff = input.staff ?? this.activeStaff;
      return this.commit(pitches.length > 1 ? 'Enter piano chord' : 'Enter piano note', () => {
        let created;
        if (deps.professionalEditing?.chordInput) {
          const chord = deps.professionalEditing.chordInput(this.score, part.id, pitches, {
            ...input,
            start,
            duration,
            voice,
            staff,
            inputSource: input.inputSource || 'piano-panel'
          });
          created = chord.eventIds
            .map(id => deps.model.findEvent(this.score, id)?.event)
            .filter(Boolean);
        } else {
          created = pitches.map(midi => deps.model.addNote(this.score, part.id, {
            midi, start, duration, voice, staff,
            velocity: Math.max(1, Math.min(127, Number(input.velocity) || 88)),
            allowChord: true,
            inputSource: input.inputSource || 'piano-panel'
          }));
        }
        this.selection.clear();
        for (const event of created) this.selection.selectEvent(event.id, { additive: true, preserveAnchor: true });
        if (input.advance !== false) this.cursor = start + duration;
        return created;
      });
    }

    addChordTone(input = {}) {
      const selected = this.selectedEntries().find(({ event }) => event.type === 'note');
      const part = selected?.part || this.activePart();
      if (!part) throw new Error('Create or select a score part before entering a chord tone.');

      let anchorStart;
      let anchorDuration;
      let voice;
      let staff;
      let anchorIds = [];
      const selectedBelongsToLastEntry = Boolean(
        selected &&
        this.lastEntry?.type === 'note' &&
        this.lastEntry.partId === selected.part.id &&
        (this.lastEntry.eventIds || []).map(String).includes(String(selected.event.id))
      );
      if ((!selected || selectedBelongsToLastEntry) && this.lastEntry?.type === 'note' && this.lastEntry.partId === part.id) {
        anchorStart = Number(this.lastEntry.start) || 0;
        anchorDuration = deps.staffInput.normalizeDuration(this.lastEntry.duration || this.duration);
        voice = clampVoice(this.lastEntry.voice);
        staff = this.lastEntry.staff || null;
        anchorIds = [...(this.lastEntry.eventIds || [])];
      } else if (selected) {
        anchorStart = Number(selected.event.start) || 0;
        anchorDuration = Number(selected.event.duration) || this.duration;
        voice = clampVoice(selected.event.voice);
        staff = selected.event.staff || null;
        anchorIds = this.selectedEntries()
          .filter(entry => entry.part.id === selected.part.id && entry.event.type === 'note')
          .map(entry => String(entry.event.id));
      } else {
        const error = new Error('Enter or select a note first, then add the chord tone at that same rhythmic position.');
        error.code = 'STAFF_INPUT_CONTEXT';
        error.recoverable = true;
        throw error;
      }

      const pitchInput = input.pitch != null
        ? { pitch: String(input.pitch) }
        : { midi: Math.max(0, Math.min(127, Math.round(Number(input.midi ?? 64)))) };

      return this.commit('Add chord tone', () => {
        deps.staffInput.ensureCapacity(deps.model, this.score, anchorStart + anchorDuration);
        const segments = deps.staffInput.planSegments(deps.model, this.score, anchorStart, anchorDuration);
        const existingIds = new Set((part.events || []).map(event => String(event.id)));
        const created = [];
        for (const segment of segments) {
          const candidate = {
            type: 'note',
            ...pitchInput,
            start: segment.start,
            duration: segment.duration,
            voice,
            staff,
            allowChord: true
          };
          const placement = deps.model.canPlaceEvent(this.score, part.id, candidate);
          if (!placement.ok) {
            const error = new Error(placement.reason || 'The chord tone cannot be placed at this onset.');
            error.code = 'STAFF_INPUT_CONFLICT';
            error.recoverable = true;
            throw error;
          }
          const event = deps.model.addNote(this.score, part.id, {
            ...pitchInput,
            start: segment.start,
            duration: segment.duration,
            voice,
            staff,
            velocity: Number(input.velocity) || 88,
            allowChord: true,
            inputSource: input.inputSource || 'composer3-chord-input',
            tieStop: created.length > 0,
            tieStart: segment.continues
          });
          if (existingIds.has(String(event.id))) {
            const error = new Error('That pitch is already present in the selected chord.');
            error.code = 'STAFF_INPUT_DUPLICATE';
            error.recoverable = true;
            throw error;
          }
          created.push(event);
        }
        for (let index = 1; index < created.length; index += 1) {
          deps.model.addTie(this.score, created[index - 1].id, created[index].id, {
            generatedBy: 'safe-measure-continuation'
          });
        }
        this.selection.clear();
        for (const eventId of [...anchorIds, ...created.map(event => event.id)]) {
          this.selection.selectEvent(eventId, { additive: true, preserveAnchor: true });
        }
        this.cursor = anchorStart + anchorDuration;
        this.lastEntry = {
          type: 'note',
          partId: part.id,
          eventIds: created.map(event => event.id),
          start: anchorStart,
          duration: anchorDuration,
          voice,
          staff,
          pitch: created[0]?.pitch || pitchInput.pitch || null,
          midi: created[0]?.midi ?? pitchInput.midi ?? null,
          chord: true
        };
        return created[0];
      });
    }

    addRest(input = {}) {
      const part = this.activePart();
      if (!part) throw new Error('Create or select a score part before entering a rest.');
      const duration = deps.staffInput.normalizeDuration(input.duration ?? this.duration);
      const start = Math.max(0, Number(input.start ?? this.cursor) || 0);
      const voice = clampVoice(input.voice ?? this.activeVoice);
      const staff = input.staff ?? this.activeStaff;
      return this.commit('Enter rest', () => {
        deps.staffInput.ensureCapacity(deps.model, this.score, start + duration);
        const segments = deps.staffInput.planSegments(deps.model, this.score, start, duration);
        for (const segment of segments) {
          const placement = deps.model.canPlaceEvent(this.score, part.id, {
            type: 'rest',
            start: segment.start,
            duration: segment.duration,
            voice,
            staff
          });
          if (!placement.ok) {
            const error = new Error(placement.reason || 'That rhythmic position is already occupied.');
            error.code = 'STAFF_INPUT_CONFLICT';
            error.recoverable = true;
            throw error;
          }
        }
        const created = segments.map(segment => deps.model.addRest(this.score, part.id, {
          start: segment.start,
          duration: segment.duration,
          voice,
          staff,
          inputSource: input.inputSource || 'composer3-staff-input'
        }));
        this.selection.selectEvents(created.map(event => event.id));
        if (input.advance !== false) this.cursor = start + duration;
        this.lastEntry = {
          type: 'rest',
          partId: part.id,
          eventIds: created.map(event => event.id),
          start,
          duration,
          voice,
          staff
        };
        return created[0];
      });
    }

    deleteSelection() {
      if (this.selection.isEmpty) return 0;
      return this.commit('Delete selection', () => {
        const count = deps.editing.deleteSelection(this.score, this.selection);
        this.selection.clear();
        return count;
      });
    }

    copySelection() {
      this.clipboard = deps.editing.makeClipboard(this.score, this.selection);
      this.emit(this.clipboard ? 'Selection copied' : 'Nothing selected');
      return this.clipboard ? clone(this.clipboard) : null;
    }

    pasteSelection(options = {}) {
      if (!this.clipboard) throw new Error('Copy musical material before pasting.');
      return this.commit('Paste selection', () => {
        const entries = deps.editing.pasteClipboard(this.score, this.clipboard, {
          start: Number(options.start ?? this.cursor) || 0,
          partId: options.partId || this.activePartId,
          voice: clampVoice(options.voice ?? this.activeVoice),
          staff: options.staff ?? this.activeStaff,
          conflictMode: options.conflictMode || 'replace-conflicts'
        });
        this.selection.selectEvents(entries.map(entry => entry.event.id));
        return entries;
      });
    }

    transposeSelection(semitones) {
      if (this.selection.isEmpty) return 0;
      return this.commit('Transpose selection', () => deps.editing.transposeSelection(this.score, this.selection, Number(semitones) || 0));
    }

    moveSelection(deltaBeats) {
      if (this.selection.isEmpty) return 0;
      return this.commit('Move selection', () => deps.editing.moveSelection(this.score, this.selection, { startDelta: Number(deltaBeats) || 0 }));
    }

    setSelectedDuration(duration) {
      const entries = this.selectedEntries().filter(({ event }) => ['note', 'rest'].includes(event.type));
      if (!entries.length) return 0;
      return this.commit('Change duration', () => {
        const value = Number(duration);
        for (const { part, event } of entries) deps.model.updateEvent(this.score, part.id, event.id, { duration: value });
        return entries.length;
      });
    }


    toggleDot() {
      const entries = this.selectedEntries().filter(({ event }) => ['note', 'rest'].includes(event.type));
      if (!entries.length) {
        const dottedValues = new Map([[6, 4], [3, 2], [1.5, 1], [0.75, 0.5], [0.375, 0.25], [0.1875, 0.125], [0.09375, 0.0625]]);
        const current = Number(this.duration) || 1;
        const next = dottedValues.has(current) ? dottedValues.get(current) : current * 1.5;
        this.setDuration(next);
        return next;
      }

      return this.commit('Toggle augmentation dot', () => {
        const selectedIds = new Set(entries.map(({ event }) => String(event.id)));
        const plans = entries.map(({ part, event }) => {
          const base = Number(event.duration) || 1;
          const dotted = Boolean(event.augmentationDots);
          const duration = dotted ? base / 1.5 : base * 1.5;
          const bounds = deps.model.measureBounds(this.score, deps.model.measureIndexAt(this.score, event.start));
          if (Number(event.start) + duration > bounds.end + deps.staffInput.EPSILON) {
            const error = new Error(`The ${deps.staffInput.durationName(duration)} value does not fit before the end of bar ${bounds.measureIndex + 1}.`);
            error.code = 'STAFF_INPUT_CONFLICT';
            error.recoverable = true;
            throw error;
          }
          const collision = (part.events || []).find(other => {
            if (selectedIds.has(String(other.id)) || other.generatedBy === 'gap-fill') return false;
            if (Number(other.voice || 1) !== Number(event.voice || 1)) return false;
            if ((other.staff || null) !== (event.staff || null)) return false;
            return Number(event.start) < Number(other.start) + Number(other.duration) - deps.staffInput.EPSILON &&
              Number(event.start) + duration > Number(other.start) + deps.staffInput.EPSILON;
          });
          if (collision) {
            const error = new Error('The dotted value would overlap the next event. Shorten the value, move the following music, or select the complete passage first.');
            error.code = 'STAFF_INPUT_CONFLICT';
            error.recoverable = true;
            throw error;
          }
          return { part, event, duration, dots: dotted ? 0 : 1 };
        });

        for (const plan of plans) {
          deps.model.updateEvent(this.score, plan.part.id, plan.event.id, {
            duration: plan.duration,
            augmentationDots: plan.dots
          });
        }
        return plans.length;
      });
    }

    setTuplet(actual = 3, normal = 2) {
      const entries = this.selectedEntries().filter(({ event }) => ['note', 'rest'].includes(event.type));
      return this.commit('Apply rhythmic tuplet', () =>
        deps.rhythmicNotation.applyTuplet(this.score, entries, actual, normal)
      );
    }

    beamSelection() {
      const entries = this.selectedEntries().filter(({ event }) => event.type === 'note');
      return this.commit('Beam selected notes', () =>
        deps.rhythmicNotation.applyManualBeam(this.score, entries)
      );
    }

    autoBeamSelection() {
      const entries = this.selectedEntries().filter(({ event }) => event.type === 'note');
      return this.commit('Apply automatic beaming', () =>
        deps.rhythmicNotation.applyAutomaticBeams(this.score, entries)
      );
    }

    clearSelectionBeams() {
      const entries = this.selectedEntries().filter(({ event }) => event.type === 'note');
      return this.commit('Remove selected beams', () =>
        deps.rhythmicNotation.clearBeams(this.score, entries)
      );
    }

    addIntervalToChord(semitones) {
      const selected = this.selectedEntries().find(({ event }) => event.type === 'note');
      if (!selected) throw new Error('Select a note before adding an interval to its chord.');
      return this.commit('Add chord interval', () => {
        const event = deps.model.addIntervalToChord(
          this.score,
          selected.part.id,
          selected.event.id,
          Number(semitones) || 0,
          { inputSource: 'composer3-interval' }
        );
        this.selection.selectEvent(event.id, { additive: true, preserveAnchor: true });
        return event;
      });
    }

    copySelectionToLayer(targetVoice, options = {}) {
      if (this.selection.isEmpty) throw new Error('Select music before copying it to another layer.');
      return this.commit('Copy selection to layer', () => {
        const entries = deps.editing.copySelectionToLayer(this.score, this.selection, clampVoice(targetVoice), {
          partId: options.partId || this.activePartId,
          staff: options.staff ?? this.activeStaff,
          conflictMode: options.conflictMode || 'replace-conflicts',
          includeLyrics: options.includeLyrics !== false,
          includeMarkings: options.includeMarkings !== false
        });
        this.selection.selectEvents(entries.map(entry => entry.event.id));
        this.activeVoice = clampVoice(targetVoice);
        return entries;
      });
    }

    replaceSelectionFromClipboard(contentMode = 'all') {
      if (!this.clipboard) throw new Error('Copy musical material before replacing a selection.');
      if (this.selection.isEmpty) throw new Error('Select destination music before replacing it.');
      return this.commit('Replace selected music', () => {
        const entries = deps.editing.replaceRange(this.score, this.selection, this.clipboard, {
          contentMode,
          partId: this.activePartId,
          voice: this.activeVoice,
          staff: this.activeStaff
        });
        this.selection.selectEvents(entries.map(entry => entry.event.id));
        return entries;
      });
    }

    applyNotation(patch = {}) {
      if (!deps.notationSystem) throw new Error('Professional notation service is unavailable.');
      const entries = this.selectedEntries();
      if (!entries.length) throw new Error('Select one or more notes or rests before applying notation.');
      return this.commit('Apply notation properties', () => entries.map(({ part, event }) =>
        deps.notationSystem.applyEventNotation(this.score, part.id, event.id, patch)
      ));
    }

    attachMark(mark = {}) {
      if (!deps.notationSystem) throw new Error('Professional notation service is unavailable.');
      const entries = this.selectedEntries().filter(({ event }) => event.type === 'note');
      if (!entries.length) throw new Error('Select one or more notes before applying a mark.');
      return this.commit(`Apply ${mark.type || 'notation'} mark`, () => entries.map(({ part, event }) =>
        deps.notationSystem.attachMark(this.score, part.id, event.id, mark)
      ));
    }

    setMeasureNavigation(index, patch = {}) {
      if (!deps.notationSystem) throw new Error('Professional notation service is unavailable.');
      return this.commit('Edit measure navigation', () =>
        deps.notationSystem.setMeasureNavigation(this.score, index, patch)
      );
    }

    applySolfaPassage(text, options = {}) {
      if (!deps.choirSolfa) throw new Error('Choir and Tonic Sol-fa service is unavailable.');
      const partId = options.partId || this.activePartId;
      if (!partId) throw new Error('Choose a destination part before applying Tonic Sol-fa.');
      return this.commit('Apply Tonic Sol-fa passage', () => {
        const result = deps.choirSolfa.applyVoicePassage(this.score, partId, text, {
          ...options,
          voice: options.voice || this.activeVoice,
          staff: options.staff ?? this.activeStaff
        });
        this.selection.clear();
        for (const id of result.createdIds) this.selection.selectEvent(id, { additive: true, preserveAnchor: true });
        return result;
      });
    }

    applySolfaVoicePassages(passages, options = {}) {
      const part = this.activePart();
      if (!part) throw new Error('Create or select a score part before importing tonic sol-fa.');
      const requested = Object.entries(passages || {})
        .map(([voice, text]) => ({
          voice: clampVoice(voice),
          text: String(text || '').trim()
        }))
        .filter(item => item.text);
      if (!requested.length) throw new Error('Enter tonic sol-fa for at least one voice.');
      const voices = new Set(requested.map(item => item.voice));
      if (voices.size !== requested.length) throw new Error('Each tonic sol-fa voice may be supplied only once.');
      const previewScore = deps.model.cloneScore(this.score);
      const previews = requested.map(item => ({
        ...item,
        preview: deps.solfa.previewSolfaToStaff(previewScore, item.text, {
          convention: options.convention || this.score.settings.solfaConvention,
          voice: item.voice,
          staff: options.staff ?? this.activeStaff,
          startBeat: Number(options.startBeat ?? this.cursor) || 0,
          allowIncompleteMeasures: options.allowIncompleteMeasures === true,
          validateFinalMeasure: options.validateFinalMeasure !== false
        })
      }));
      const invalid = previews.find(item => !item.preview.valid);
      if (invalid) {
        const error = new Error(`Correct voice ${invalid.voice} tonic sol-fa before replacing staff notation.`);
        error.code = 'INVALID_SOLFA_VOICE';
        error.voice = invalid.voice;
        error.diagnostics = invalid.preview.diagnostics;
        throw error;
      }
      return this.commit('Apply four-voice tonic sol-fa', () => {
        const results = previews.map(item => ({
          voice: item.voice,
          result: deps.solfa.applySolfaPassage(this.score, part.id, item.text, {
            convention: options.convention || this.score.settings.solfaConvention,
            voice: item.voice,
            staff: options.staff ?? this.activeStaff,
            startBeat: Number(options.startBeat ?? this.cursor) || 0,
            allowIncompleteMeasures: options.allowIncompleteMeasures === true,
            validateFinalMeasure: options.validateFinalMeasure !== false
          })
        }));
        this.score.settings.solfaConvention = options.convention || this.score.settings.solfaConvention;
        deps.model.touch(this.score);
        return results.map(item => ({
          voice: item.voice,
          createdIds: item.result.created.map(event => event.id),
          diagnostics: item.result.diagnostics
        }));
      });
    }

    applyLyricsWorkflow(text, options = {}) {
      if (!deps.choirSolfa) throw new Error('Choir and Tonic Sol-fa service is unavailable.');
      return this.commit('Apply lyric passage', () => deps.choirSolfa.applyLyrics(this.score, text, {
        ...options,
        partIds: options.partIds || [this.activePartId].filter(Boolean),
        voice: options.voice || this.activeVoice
      }));
    }

    choirRangeReport(options = {}) {
      if (!deps.choirSolfa) throw new Error('Choir and Tonic Sol-fa service is unavailable.');
      return deps.choirSolfa.satbRangeReport(this.score, options);
    }

    solfaSynchronizationReport() {
      if (!deps.choirSolfa) throw new Error('Choir and Tonic Sol-fa service is unavailable.');
      return deps.choirSolfa.verifySynchronization(this.score);
    }

    setMixer(patch = {}) {
      if (!deps.practiceAudio) throw new Error('Practice and audio service is unavailable.');
      return this.commit('Edit mixer settings', () => deps.practiceAudio.normalizeMixer(this.score, patch));
    }

    practicePreset(options = {}) {
      if (!deps.practiceAudio) throw new Error('Practice and audio service is unavailable.');
      return deps.practiceAudio.practicePreset(this.score, options);
    }

    audioExportPlan(options = {}) {
      if (!deps.practiceAudio) throw new Error('Practice and audio service is unavailable.');
      return deps.practiceAudio.audioExportPlan(this.score, options);
    }

    renderWav(options = {}) {
      if (!deps.practiceAudio) throw new Error('Practice and audio service is unavailable.');
      return deps.practiceAudio.renderWav(this.score, options);
    }

    quantizeMidiEvents(events, options = {}) {
      if (!deps.practiceAudio) throw new Error('Practice and audio service is unavailable.');
      return deps.practiceAudio.quantizeRecordedEvents(events, options);
    }


    compositionContext() {
      if (!deps.compositionHub) throw new Error('Composition Hub service is unavailable.');
      return deps.compositionHub.selectionContext(this.score, this.selectedEntries());
    }

    compositionTools(state = null) {
      if (!deps.compositionHub) throw new Error('Composition Hub service is unavailable.');
      const saved = this.score.settings?.compositionHub || {};
      return deps.compositionHub.toolsForContext(this.compositionContext(), deps.compositionHub.normalizeState(state || saved));
    }

    setCompositionHubState(action = {}) {
      if (!deps.compositionHub) throw new Error('Composition Hub service is unavailable.');
      return this.commit('Update Composition Hub', () => {
        this.score.settings = this.score.settings || {};
        const current = deps.compositionHub.normalizeState(this.score.settings.compositionHub || {});
        const next = deps.compositionHub.updateState(current, action);
        this.score.settings.compositionHub = clone(next);
        deps.model.touch(this.score);
        return next;
      }, { dirty: action.type !== 'open' && action.type !== 'close' && action.type !== 'toggle' });
    }

    compositionPreview(toolId, values = {}) {
      if (!deps.compositionHub) throw new Error('Composition Hub service is unavailable.');
      const context = this.compositionContext();
      if (['detect-key', 'identify-chords', 'chord-suggestions', 'generate-chord-symbols', 'parallel-motion', 'voice-leading-repair', 'rhythm-complexity'].includes(toolId)) {
        return deps.compositionHub.analysisPreview(this.score, toolId, context, values);
      }
      if (toolId === 'harmonise-melody') return deps.compositionHub.harmonyPreview(this.score, context, values);
      return deps.compositionHub.compositionPreview(this.score, toolId, context, values);
    }

    applyCompositionPreview(preview, options = {}) {
      if (!deps.compositionHub) throw new Error('Composition Hub service is unavailable.');
      return this.commit(`Apply ${preview?.toolId || 'composition'} suggestion`, () => {
        const result = deps.compositionHub.applyPreview(this.score, preview, options);
        if (result?.createdIds?.length) this.selection.setEvents(result.createdIds);
        this.score.settings = this.score.settings || {};
        const state = deps.compositionHub.normalizeState(this.score.settings.compositionHub || {});
        this.score.settings.compositionHub = clone(deps.compositionHub.updateState(state, { type: 'used', toolId: preview.toolId }));
        return result;
      });
    }


    projectEnvelope(options = {}) {
      if (!deps.filePublishing) throw new Error('File and publishing service is unavailable.');
      return deps.filePublishing.projectEnvelope(this.score, { ...options, viewState: options.viewState || this.score.settings?.viewportSession });
    }

    validateProjectEnvelope(envelope, options = {}) {
      if (!deps.filePublishing) throw new Error('File and publishing service is unavailable.');
      return deps.filePublishing.validateEnvelope(envelope, options);
    }

    migrationPlan(envelope) {
      if (!deps.filePublishing) throw new Error('File and publishing service is unavailable.');
      return deps.filePublishing.migrationPlan(envelope);
    }

    autosavePlan(options = {}) {
      if (!deps.filePublishing) throw new Error('File and publishing service is unavailable.');
      return deps.filePublishing.autosavePlan(this.score, this.documentId, options);
    }

    publishingPlan(options = {}) {
      if (!deps.filePublishing) throw new Error('File and publishing service is unavailable.');
      return deps.filePublishing.publishingPlan(this.score, options);
    }

    applyHouseStyle(style, options = {}) {
      if (!deps.filePublishing) throw new Error('File and publishing service is unavailable.');
      return this.commit('Apply house style', () => {
        this.score = deps.model.normalizeScore(deps.filePublishing.applyHouseStyle(this.score, style, options));
        return this.score.settings.houseStyle;
      });
    }

    recognitionReview(kind, source, candidates = [], options = {}) {
      if (!deps.filePublishing) throw new Error('File and publishing service is unavailable.');
      return deps.filePublishing.recognitionReview(kind, source, candidates, options);
    }

    createPluginHost(manifest, handlers = {}, options = {}) {
      if (!deps.filePublishing) throw new Error('File and publishing service is unavailable.');
      return deps.filePublishing.createPluginHost(manifest, {
        readScore: () => clone(this.score),
        readSelection: () => this.selectedEntries().map(({ part, event }) => ({ partId: part.id, event: clone(event) })),
        mutate: command => this.command(command.name, command.payload || {}),
        analyse: request => this.compositionPreview(request.toolId, request.values || {}),
        ...handlers
      }, options);
    }


    findInScore(query = {}) {
      if (!deps.productivity) throw new Error('Productivity service is unavailable.');
      return deps.productivity.findInScore(this.score, { ...query, measureAt: beat => deps.model.measureIndexAt(this.score, beat) });
    }

    navigatorModel(layoutPages = []) {
      if (!deps.productivity) throw new Error('Productivity service is unavailable.');
      return deps.productivity.navigatorModel(this.score, layoutPages);
    }

    selectionFilter(filter = {}) {
      if (!deps.productivity) throw new Error('Productivity service is unavailable.');
      return deps.productivity.applySelectionFilter(this.selectedEntries(), filter);
    }

    batchOperation(operation, options = {}) {
      if (!deps.productivity) throw new Error('Productivity service is unavailable.');
      const plan = deps.productivity.batchPlan(this.selectedEntries(), operation, options);
      return this.commit(`Batch ${operation}`, () => {
        if (operation === 'transpose') return deps.editing.transposeSelection(this.score, plan.eventIds, Number(options.semitones) || 0);
        if (operation === 'duration') return deps.editing.setDuration(this.score, plan.eventIds, Number(options.duration) || this.duration);
        if (operation === 'velocity') {
          plan.eventIds.forEach(id => {
            const entry = deps.model.findEvent(this.score, id);
            if (entry) deps.model.updateEvent(this.score, entry.part.id, id, { velocity: Math.max(1, Math.min(127, Number(options.velocity) || 88)) });
          });
          return plan.eventIds.length;
        }
        if (operation === 'voice') {
          const voice = clampVoice(options.voice);
          plan.eventIds.forEach(id => {
            const entry = deps.model.findEvent(this.score, id);
            if (entry) deps.model.updateEvent(this.score, entry.part.id, id, { voice });
          });
          return plan.eventIds.length;
        }
        if (operation === 'articulation') {
          plan.eventIds.forEach(id => {
            const entry = deps.model.findEvent(this.score, id);
            if (entry) deps.model.updateEvent(this.score, entry.part.id, id, { articulations: [...new Set([...(entry.event.articulations || []), options.name || 'accent'])] });
          });
          return plan.eventIds.length;
        }
        if (operation === 'delete') return deps.editing.deleteSelection(this.score, plan.eventIds);
        throw new Error(`Unsupported batch operation: ${operation}`);
      });
    }

    reliabilityFailure(error, context = {}) {
      if (!deps.productivity) throw new Error('Productivity service is unavailable.');
      return deps.productivity.classifyFailure(error, context);
    }

    performanceReport(samples = {}, budgets) {
      if (!deps.productivity) throw new Error('Productivity service is unavailable.');
      return deps.productivity.performanceReport(samples, budgets);
    }


    releaseAudit(input = {}) {
      if (!deps.releaseAudit) throw new Error('Release audit service is unavailable.');
      return deps.releaseAudit.auditCycle(input);
    }

    releaseDecision(input = {}) {
      if (!deps.releaseAudit) throw new Error('Release audit service is unavailable.');
      return deps.releaseAudit.releaseDecision(input);
    }

    generateLinkedParts(options = {}) {
      if (!deps.partsEngraving) throw new Error('Parts and engraving service is unavailable.');
      return this.commit('Generate linked score parts', () => deps.partsEngraving.linkedPartDescriptors(this.score, options));
    }

    updateLinkedPart(partId, patch = {}) {
      if (!deps.partsEngraving) throw new Error('Parts and engraving service is unavailable.');
      return this.commit('Edit linked part layout', () => deps.partsEngraving.updateLinkedPart(this.score, partId, patch));
    }

    createCue(options = {}) {
      if (!deps.partsEngraving) throw new Error('Parts and engraving service is unavailable.');
      return this.commit('Create cue notes', () => deps.partsEngraving.createCue(
        this.score,
        options.targetPartId || this.activePartId,
        options.sourcePartId,
        options
      ));
    }

    engravingAudit(options = {}) {
      if (!deps.partsEngraving) throw new Error('Parts and engraving service is unavailable.');
      return deps.partsEngraving.engravingAudit(this.score, options);
    }

    setSelectedVisualOverride(patch = {}) {
      if (!deps.partsEngraving) throw new Error('Parts and engraving service is unavailable.');
      const entries = this.selectedEntries();
      if (!entries.length) throw new Error('Select one or more score objects before positioning them.');
      return this.commit('Position selected objects', () => entries.map(({ part, event }) =>
        deps.partsEngraving.manualOverride(this.score, part.id, event.id, patch)
      ));
    }

    resetSelectedStyle() {
      if (!deps.partsEngraving) throw new Error('Parts and engraving service is unavailable.');
      const entries = this.selectedEntries();
      if (!entries.length) throw new Error('Select one or more score objects before resetting their style.');
      return this.commit('Reset selected position and style', () => entries.reduce((count, { part, event }) =>
        count + Number(deps.partsEngraving.resetManualOverride(this.score, part.id, event.id)), 0
      ));
    }

    batchPartExportPlan(options = {}) {
      if (!deps.partsEngraving) throw new Error('Parts and engraving service is unavailable.');
      return deps.partsEngraving.batchExportPlan(this.score, options);
    }

    addPart(instrumentKey = 'piano', overrides = {}) {
      return this.commit('Add score part', () => {
        const instrument = deps.model.INSTRUMENTS[instrumentKey] ? instrumentKey : 'piano';
        const part = deps.model.createPart(instrument, {
          ...overrides,
          voiceLayers: [1, 2, 3, 4],
          activeVoice: 1
        });
        this.score.parts.push(part);
        this.activePartId = part.id;
        this.activeVoice = 1;
        this.activeStaff = deps.model.defaultStaff(part);
        deps.model.touch(this.score);
        return part;
      });
    }

    removeActivePart() {
      if (this.score.parts.length <= 1) throw new Error('A score must retain at least one part.');
      const part = this.activePart();
      if (!part) throw new Error('Select a score part before removing it.');
      return this.commit('Remove score part', () => {
        const removedId = part.id;
        this.score.parts = this.score.parts.filter(item => item.id !== removedId);
        this.score.chordSymbols = (this.score.chordSymbols || []).filter(item => item.partId !== removedId);
        this.score.annotations = (this.score.annotations || []).filter(item => item.partId !== removedId);
        deps.model.removeDanglingSpanners(this.score);
        this.selection.clear();
        this.activePartId = this.score.parts[0].id;
        this.activeVoice = 1;
        this.activeStaff = deps.model.defaultStaff(this.score.parts[0]);
        deps.model.touch(this.score);
        return removedId;
      });
    }

    updateActivePart(patch = {}) {
      const part = this.activePart();
      if (!part) throw new Error('Select a score part before editing it.');
      return this.commit('Edit score part', () => {
        const allowed = ['name', 'shortName', 'clef', 'midiProgram', 'transpose', 'minPitch', 'maxPitch', 'volume', 'pan', 'muted', 'solo'];
        for (const key of allowed) if (Object.prototype.hasOwnProperty.call(patch, key)) part[key] = patch[key];
        if (patch.instrumentKey && deps.model.INSTRUMENTS[patch.instrumentKey]) {
          const profile = deps.model.INSTRUMENTS[patch.instrumentKey];
          part.instrumentKey = patch.instrumentKey;
          if (!Object.prototype.hasOwnProperty.call(patch, 'name')) part.name = profile.name;
          if (!Object.prototype.hasOwnProperty.call(patch, 'shortName')) part.shortName = profile.shortName;
          if (!Object.prototype.hasOwnProperty.call(patch, 'clef')) part.clef = profile.clef;
          part.minPitch = profile.min;
          part.maxPitch = profile.max;
          part.midiProgram = profile.program || 0;
          part.transpose = profile.transpose || 0;
        }
        part.voiceLayers = [1, 2, 3, 4];
        deps.model.touch(this.score);
        return part;
      });
    }

    configurePickup(beats) {
      return this.commit('Configure pickup measure', () => deps.model.configurePickupMeasure(this.score, Math.max(0, Number(beats) || 0)));
    }

    addAnnotation(type, text, options = {}) {
      const value = String(text || '').trim();
      if (!value) throw new Error('Enter annotation text first.');
      const part = this.activePart();
      return this.commit('Add score text', () => deps.model.addAnnotation(this.score, {
        type: type || 'staff-text',
        text: value,
        scope: options.scope || 'segment',
        partId: options.partId === null ? null : (options.partId || part?.id || null),
        staff: options.staff ?? this.activeStaff,
        start: Number(options.start ?? this.cursor) || 0,
        measureIndex: deps.model.measureIndexAt(this.score, Number(options.start ?? this.cursor) || 0),
        placement: options.placement || 'above',
        sourceData: options.sourceData || null
      }));
    }

    addDynamic(value) {
      const dynamic = String(value || '').trim();
      if (!/^(ppp|pp|p|mp|mf|f|ff|fff|sfz|fp)$/.test(dynamic)) throw new Error('Choose a supported dynamic marking.');
      return this.addAnnotation('dynamics', dynamic, { placement: 'below' });
    }

    addChordSymbol(symbol, options = {}) {
      const value = String(symbol || '').trim();
      if (!value) throw new Error('Enter a chord symbol first.');
      const part = this.activePart();
      return this.commit('Add chord symbol', () => {
        const item = {
          id: deps.model.uid('chord'),
          symbol: value,
          start: Number(options.start ?? this.cursor) || 0,
          partId: options.partId || part?.id || null,
          staff: options.staff ?? this.activeStaff,
          placement: options.placement || 'above'
        };
        this.score.chordSymbols = Array.isArray(this.score.chordSymbols) ? this.score.chordSymbols : [];
        this.score.chordSymbols.push(item);
        deps.model.touch(this.score);
        return item;
      });
    }

    removeSelectedSpanners(type = null) {
      if (this.selection.isEmpty) return 0;
      return this.commit('Remove spanners', () => deps.notations.removeSpanners(this.score, this.selectedEntries(), type));
    }

    selectAdjacent(direction = 1) {
      const part = this.activePart();
      const events = (part?.events || []).filter(event => event.generatedBy !== 'gap-fill')
        .sort((a, b) => a.start - b.start || (a.voice || 1) - (b.voice || 1) || String(a.id).localeCompare(String(b.id)));
      if (!events.length) return null;
      const selectedId = this.selectedEntries().at(-1)?.event?.id;
      const current = Math.max(0, events.findIndex(event => event.id === selectedId));
      const next = events[(current + (Number(direction) < 0 ? -1 : 1) + events.length) % events.length];
      return this.selectEvent(next.id);
    }

    setLyric(text, options = {}) {
      const entries = this.selectedEntries().filter(({ event }) => event.type === 'note');
      if (!entries.length) throw new Error('Select at least one note before entering lyrics.');
      return this.commit('Edit lyric', () => {
        const verse = Math.max(1, Math.min(24, Number(options.verse) || 1));
        for (const { part, event } of entries) {
          deps.model.setLyric(this.score, part.id, event.id, String(text ?? ''), {
            verse,
            syllabic: options.syllabic || 'single',
            lineType: options.lineType || 'lyric'
          });
        }
        return entries.length;
      });
    }

    setLyricAndAdvance(text, options = {}) {
      const entries = this.selectedEntries().filter(({ event }) => event.type === 'note');
      if (entries.length !== 1) throw new Error('Select exactly one note for rapid lyric entry.');
      const current = entries[0];
      const verse = Math.max(1, Math.min(24, Number(options.verse) || 1));
      const normalized = deps.lyrics.normalizeDirectEntry(text, options);
      const result = this.commit('Enter lyric syllable', () => {
        deps.model.setLyric(this.score, current.part.id, current.event.id, normalized.text, {
          verse,
          syllabic: normalized.syllabic,
          lineType: options.lineType || 'verse',
          melisma: normalized.melisma,
          extensionState: normalized.extensionState,
          extendType: normalized.melisma ? 'start' : null,
          elision: normalized.elision,
          placement: options.placement || 'below',
          visibleInParts: options.visibleInParts !== false
        });
        return { partId: current.part.id, eventId: current.event.id, lyric: normalized };
      });
      if (normalized.advance !== 'none') {
        const next = deps.lyrics.nextEligibleNote(this.score, current.part.id, current.event.id, {
          voice: current.event.voice || this.activeVoice,
          staff: current.event.staff || this.activeStaff
        });
        if (next) {
          this.selectEvent(next.event.id);
          this.cursor = next.event.start;
          result.nextEventId = next.event.id;
        }
      }
      return result;
    }

    navigateLyric(direction = 1) {
      const entries = this.selectedEntries().filter(({ event }) => event.type === 'note');
      if (entries.length !== 1) throw new Error('Select exactly one note to navigate lyrics.');
      const current = entries[0];
      const target = Number(direction) < 0
        ? deps.lyrics.previousEligibleNote(this.score, current.part.id, current.event.id, {
            voice: current.event.voice || this.activeVoice,
            staff: current.event.staff || this.activeStaff
          })
        : deps.lyrics.nextEligibleNote(this.score, current.part.id, current.event.id, {
            voice: current.event.voice || this.activeVoice,
            staff: current.event.staff || this.activeStaff
          });
      if (!target) return null;
      this.selectEvent(target.event.id);
      this.cursor = target.event.start;
      this.emit('Lyric caret moved');
      return { partId: target.part.id, eventId: target.event.id, start: target.event.start };
    }

    applyLyricsParagraph(text, options = {}) {
      const part = this.activePart();
      if (!part) throw new Error('Select a score part before applying lyrics.');
      return this.commit('Apply lyric paragraph', () => {
        const verse = Math.max(1, Math.min(24, Number(options.verse) || 1));
        const preview = deps.lyrics.previewAssignments(this.score, String(text || ''), {
          partIds: [part.id],
          voice: clampVoice(options.voice ?? this.activeVoice),
          staff: options.staff ?? this.activeStaff,
          start: Number(options.startBeat ?? this.cursor) || 0
        });
        return deps.lyrics.applyAssignments(this.score, preview, { verse, lineType: options.lineType || 'verse' });
      });
    }

    searchReplaceLyrics(search, replacement, options = {}) {
      return this.commit('Replace lyrics', () => deps.lyrics.searchReplace(this.score, search, replacement, options));
    }

    copyLyricVerse(sourceVerse, targetVerse, options = {}) {
      const source = Math.max(1, Math.min(24, Number(sourceVerse) || 1));
      const target = Math.max(1, Math.min(24, Number(targetVerse) || 1));
      if (source === target) throw new Error('Choose a different target lyric verse.');
      return this.commit('Copy lyric verse', () => deps.lyrics.copyVerse(this.score, source, target, options));
    }

    deleteLyricVerse(verse, options = {}) {
      const target = Math.max(1, Math.min(24, Number(verse) || 1));
      return this.commit('Delete lyric verse', () => {
        let removed = 0;
        for (const part of this.score.parts) {
          if (options.partId && part.id !== options.partId) continue;
          for (const event of part.events || []) {
            if (event.type !== 'note' || !Array.isArray(event.lyrics)) continue;
            const before = event.lyrics.length;
            event.lyrics = event.lyrics.filter(lyric => Number(lyric.verse) !== target);
            removed += before - event.lyrics.length;
            if (before !== event.lyrics.length) deps.model.normalizeEventLyrics(event, part);
          }
        }
        deps.model.touch(this.score);
        return removed;
      });
    }

    setLyricOffset(offsetX, offsetY, options = {}) {
      const verse = options.verse == null ? null : Math.max(1, Math.min(24, Number(options.verse) || 1));
      const entries = this.selectedEntries().filter(({ event }) => event.type === 'note');
      if (!entries.length) throw new Error('Select at least one note before positioning lyrics.');
      return this.commit('Position lyrics', () => {
        let updated = 0;
        for (const { part, event } of entries) {
          event.lyrics = (event.lyrics || []).map(lyric => {
            if (verse != null && Number(lyric.verse) !== verse) return lyric;
            updated += 1;
            return { ...lyric, offsetX: Number(offsetX) || 0, offsetY: Number(offsetY) || 0 };
          });
          deps.model.normalizeEventLyrics(event, part);
        }
        deps.model.touch(this.score);
        return updated;
      });
    }

    resetLyricOffset(options = {}) {
      const verse = options.verse == null ? null : Math.max(1, Math.min(24, Number(options.verse) || 1));
      const entries = this.selectedEntries().filter(({ event }) => event.type === 'note');
      if (!entries.length) throw new Error('Select at least one note before resetting lyrics.');
      return this.commit('Reset lyric position', () => {
        let updated = 0;
        for (const { part, event } of entries) {
          if (deps.lyrics.resetPosition(this.score, part.id, event.id, verse)) updated += 1;
        }
        return updated;
      });
    }

    lyricVerseSummary() {
      const summary = {};
      for (const part of this.score.parts) {
        for (const event of part.events || []) {
          for (const lyric of event.lyrics || []) {
            const verse = Math.max(1, Math.min(24, Number(lyric.verse) || 1));
            summary[verse] = (summary[verse] || 0) + 1;
          }
        }
      }
      return summary;
    }

    appendMeasures(count = 1) {
      return this.commit('Append measures', () => deps.model.appendMeasures(this.score, Math.max(1, Number(count) || 1)));
    }

    insertMeasures(index, count = 1) {
      return this.commit('Insert measures', () => deps.model.insertMeasures(this.score, Math.max(0, Number(index) || 0), Math.max(1, Number(count) || 1)));
    }

    removeMeasure(index = this.score.measures.length - 1) {
      if (this.score.measures.length <= 1) throw new Error('A score must retain at least one measure.');
      return this.commit('Remove measure', () => deps.model.removeMeasure(this.score, Math.max(0, Number(index) || 0)));
    }

    setMeasureAttributes(index, patch = {}) {
      return this.commit('Edit measure attributes', () => deps.model.setMeasureAttributes(this.score, Number(index) || 0, patch));
    }

    addTie() {
      const entries = this.selectedEntries().filter(({ event }) => event.type === 'note');
      return this.commit('Create adjacent-note tie', () =>
        deps.rhythmicNotation.createTie(this.score, entries)
      );
    }

    addSlur() {
      const entries = this.selectedEntries().filter(({ event }) => event.type === 'note');
      return this.commit('Create phrase slur', () =>
        deps.rhythmicNotation.createSlur(this.score, entries)
      );
    }

    setArticulation(name, enabled = true) {
      return this.commit('Edit articulation', () => deps.notations.setArticulation(this.score, this.selectedEntries(), name, enabled));
    }

    setOrnament(name, enabled = true) {
      return this.commit('Edit ornament', () => deps.notations.setOrnament(this.score, this.selectedEntries(), name, enabled));
    }

    setTechnique(type, value = '', enabled = true) {
      return this.commit('Edit technique', () => deps.notations.setTechnical(this.score, this.selectedEntries(), type, value, enabled));
    }

    setBeam(value = 'auto', number = 1) {
      return this.commit('Edit beam', () => deps.notations.setBeam(this.score, this.selectedEntries(), value, number));
    }

    setFermata(enabled = true) {
      return this.commit('Edit fermata', () => {
        let count = 0;
        for (const { part, event } of this.selectedEntries()) {
          if (event.type !== 'note') continue;
          if (Boolean(event.fermata) === Boolean(enabled)) continue;
          deps.model.updateEvent(this.score, part.id, event.id, { fermata: Boolean(enabled) });
          count += 1;
        }
        return count;
      });
    }

    undo() {
      if (!this.history.canUndo) return false;
      this.score = deps.model.normalizeScore(this.history.undo(this.score));
      this.selection.clear();
      this.dirty = true;
      this.assertCanonical();
      this.emit('Undo');
      return true;
    }

    redo() {
      if (!this.history.canRedo) return false;
      this.score = deps.model.normalizeScore(this.history.redo(this.score));
      this.selection.clear();
      this.dirty = true;
      this.assertCanonical();
      this.emit('Redo');
      return true;
    }

    serializeAirscore() {
      return deps.airscore.serialize(this.score);
    }

    openAirscore(text, options = {}) {
      const score = deps.airscore.deserialize(text);
      return this.replaceScore(score, 'Open .airscore', {
        dirty: false,
        filePath: options.filePath || null,
        documentId: options.documentId || this.documentId
      });
    }

    exportMusicXml() {
      return deps.formats.exportMusicXML(this.score);
    }

    importMusicXml(text, options = {}) {
      return this.replaceScore(deps.formats.parseMusicXML(text), 'Import MusicXML', {
        dirty: true,
        filePath: options.filePath || null
      });
    }

    async exportMxl() {
      return asBytes(await deps.formats.createMxl(this.score));
    }

    async importMxl(bytes, options = {}) {
      const score = await deps.formats.parseMxl(asBytes(bytes));
      return this.replaceScore(score, 'Import MXL', { dirty: true, filePath: options.filePath || null });
    }

    exportMidi() {
      return asBytes(deps.formats.exportMidi(this.score));
    }

    importMidi(bytes, options = {}) {
      return this.replaceScore(deps.formats.parseMidi(asBytes(bytes)), 'Import MIDI', {
        dirty: true,
        filePath: options.filePath || null
      });
    }

    updateSelectedFromSolfa(syllable, options = {}) {
      const entry = this.selectedEntries().find(({ event }) => event.type === 'note');
      if (!entry) throw new Error('Select a note before editing tonic sol-fa.');
      return this.commit('Edit note from tonic sol-fa', () => {
        const pitch = deps.solfa.updateEventFromSolfa(this.score, entry.part.id, entry.event.id, syllable, options);
        this.selection.selectEvent(entry.event.id);
        return { partId: entry.part.id, eventId: entry.event.id, pitch };
      });
    }

    previewSolfaPassage(text, options = {}) {
      return deps.solfa.previewSolfaToStaff(this.score, String(text || ''), {
        partId: options.partId || this.activePartId,
        voice: clampVoice(options.voice ?? this.activeVoice),
        staff: options.staff ?? this.activeStaff,
        ...options
      });
    }

    applySolfaPassage(text, options = {}) {
      const part = this.activePart();
      if (!part) throw new Error('Create or select a score part before importing tonic sol-fa.');
      const voice = clampVoice(options.voice ?? this.activeVoice);
      const staff = options.staff ?? this.activeStaff;
      return this.commit('Apply tonic sol-fa passage', () => {
        const result = deps.solfa.applySolfaPassage(this.score, part.id, String(text || ''), {
          ...options,
          voice,
          staff
        });
        this.selection.clear();
        for (const event of result.created || []) {
          this.selection.selectEvent(event.id, { additive: true, preserveAnchor: true });
        }
        if (result.created?.length) {
          this.cursor = Math.max(...result.created.map(event => Number(event.start) + Number(event.duration)));
        }
        return result;
      });
    }

    verifySolfa() {
      return deps.solfa.verifyScoreSolfa(this.score);
    }

    solfaText(options = {}) {
      return deps.solfa.scoreToSolfaText(this.score, options);
    }

    solfaPages(options = {}) {
      return deps.solfaLayout.paginate(this.score, options);
    }

    layoutPlan(options = {}) {
      return deps.layout.buildSystemPlan(this.score, options);
    }

    midiState() {
      return {
        mode: this.midi.mode,
        status: this.midi.status,
        deviceId: this.midi.deviceId,
        recording: Boolean(this.midi.recording),
        messagesReceived: Number(this.midi.messagesReceived) || 0,
        notesEntered: Number(this.midi.notesEntered) || 0,
        lastError: this.midi.lastError
      };
    }

    configureMidi(options = {}) {
      const mode = options.mode === 'realtime' ? 'realtime' : 'step';
      this.midi.mode = mode;
      if (Object.prototype.hasOwnProperty.call(options, 'deviceId')) this.midi.deviceId = options.deviceId || null;
      if (Object.prototype.hasOwnProperty.call(options, 'status')) this.midi.status = String(options.status || 'disabled');
      this.midi.lastError = null;
      this.midi.input = null;
      this.midi.recording = false;
      this.emit(`MIDI ${mode} mode`);
      return this.midiState();
    }

    createMidiInput() {
      if (!deps.midiInput) throw new Error('MIDI input support is unavailable.');
      const common = {
        score: this.score,
        partId: this.activePartId,
        voice: this.activeVoice,
        staff: this.activeStaff
      };
      if (this.midi.mode === 'realtime') {
        if (!deps.midiInput.RealTimeMidiInput) throw new Error('Real-time MIDI input is unavailable.');
        this.midi.input = new deps.midiInput.RealTimeMidiInput(this.score, {
          ...common,
          tempo: this.score.settings.tempo,
          startBeat: this.cursor,
          onEntered: entered => {
            this.midi.notesEntered += entered.length;
          }
        });
      } else {
        if (!deps.midiInput.StepTimeMidiInput) throw new Error('Step-time MIDI input is unavailable.');
        this.midi.input = new deps.midiInput.StepTimeMidiInput(this.score, {
          ...common,
          duration: this.duration,
          cursor: this.cursor,
          onEntered: entered => {
            this.midi.notesEntered += entered.length;
          }
        });
      }
      return this.midi.input;
    }

    syncMidiInput() {
      const input = this.midi.input || this.createMidiInput();
      input.configure({
        score: this.score,
        partId: this.activePartId,
        voice: this.activeVoice,
        staff: this.activeStaff,
        duration: this.duration,
        cursor: this.cursor,
        tempo: this.score.settings.tempo,
        startBeat: this.cursor
      });
      return input;
    }

    handleMidiMessage(data, timestampMs = 0) {
      try {
        const input = this.syncMidiInput();
        this.midi.messagesReceived += 1;
        const result = input.handle(data, timestampMs);
        const entered = Array.isArray(result?.entered) ? result.entered : [];
        if (entered.length) {
          this.selection.selectEvents(entered.map(event => event.id));
          this.assertCanonical();
          this.history.snapshot(this.score, this.midi.mode === 'realtime' ? 'Record MIDI' : 'Enter MIDI note');
          this.dirty = true;
        }
        if (this.midi.mode === 'step') this.cursor = Number(input.cursor) || this.cursor;
        this.midi.status = this.midi.recording || this.midi.mode === 'step' ? 'connected' : this.midi.status;
        this.emit(entered.length ? 'MIDI notes entered' : 'MIDI message received');
        return { ...result, state: this.midiState() };
      } catch (error) {
        this.midi.lastError = error?.message || String(error);
        this.midi.status = 'error';
        this.emitError(error, 'MIDI input');
        this.emit('MIDI input failed');
        throw error;
      }
    }

    startMidiRecording(timestampMs = 0) {
      if (this.midi.mode !== 'realtime') this.configureMidi({ mode: 'realtime', deviceId: this.midi.deviceId, status: this.midi.status });
      const input = this.syncMidiInput();
      input.start(timestampMs);
      this.midi.recording = true;
      this.midi.status = 'recording';
      this.emit('MIDI recording started');
      return this.midiState();
    }

    stopMidiRecording(timestampMs = 0) {
      const input = this.midi.input;
      let entered = [];
      if (input && typeof input.stop === 'function') entered = input.stop(timestampMs) || [];
      if (entered.length) {
        this.selection.selectEvents(entered.map(event => event.id));
        this.assertCanonical();
        this.history.snapshot(this.score, 'Finish MIDI recording');
        this.dirty = true;
        this.midi.notesEntered += entered.length;
      }
      this.midi.recording = false;
      this.midi.status = this.midi.deviceId ? 'connected' : 'ready';
      this.emit('MIDI recording stopped');
      return { entered, state: this.midiState() };
    }

    disconnectMidi() {
      if (this.midi.recording) this.stopMidiRecording();
      this.midi.input = null;
      this.midi.deviceId = null;
      this.midi.status = 'disabled';
      this.midi.lastError = null;
      this.emit('MIDI disconnected');
      return this.midiState();
    }

    startPlayback(options = {}) {
      if (!deps.playback?.PlaybackEngine) throw new Error('Playback is not available in this environment.');
      this.setPlaybackOptions({
        loop: options.loop ?? this.transport.loop,
        metronome: options.metronome ?? this.transport.metronome,
        loopStart: options.loopRange?.start ?? options.loopStart ?? this.transport.loopStart,
        loopEnd: options.loopRange?.end ?? options.loopEnd ?? this.transport.loopEnd
      });
      if (!this.playback) {
        this.playback = new deps.playback.PlaybackEngine();
        this.playback.onPosition = beat => {
          this.cursor = beat;
          this.emit('Playback position');
        };
        this.playback.onStop = () => this.emit('Playback stopped');
      }
      this.transport.paused = false;
      this.playback.play(
        this.score,
        Number(options.startBeat ?? this.cursor) || 0,
        this.transport.loop,
        this.loopRange(),
        {
          metronome: this.transport.metronome,
          layerMix: this.transport.layerMix,
          countInBeats: deps.model.beatsPerMeasure(
            this.score,
            deps.model.measureIndexAt(this.score, Number(options.startBeat ?? this.cursor) || 0)
          ) * Math.max(0, Math.min(4, Number(options.countInMeasures ?? this.transport.countInMeasures) || 0))
        }
      );
      this.emit('Playback started');
      return this.playbackState();
    }

    pausePlayback() {
      if (!this.playback?.playing) return this.playbackState();
      this.cursor = Number(this.playback.currentBeat) || this.cursor;
      this.playback.stop({ notify: false });
      this.transport.paused = true;
      this.emit('Playback paused');
      return this.playbackState();
    }

    resumePlayback(options = {}) {
      if (!this.transport.paused) return this.startPlayback(options);
      return this.startPlayback({ ...options, startBeat: this.cursor });
    }

    stopPlayback(options = {}) {
      if (!this.playback) {
        this.transport.paused = false;
        return false;
      }
      this.playback.stop({ reset: Boolean(options.reset) });
      this.transport.paused = false;
      if (options.reset) this.cursor = 0;
      this.emit('Playback stopped');
      return this.playbackState();
    }

    jumpToMeasure(measureNumber) {
      const requested = Math.round(Number(measureNumber) || 1);
      const index = Math.max(0, Math.min(this.score.measures.length - 1, requested - 1));
      const beat = deps.model.measureStartBeat(this.score, index);
      this.seek(beat);
      this.emit(`Moved to measure ${index + 1}`);
      return { measure: index + 1, beat };
    }

    async shutdown() {
      if (this.midi.recording) this.stopMidiRecording();
      this.midi.input = null;
      if (this.playback) await this.playback.shutdown();
      this.playback = null;
      return true;
    }

    markSaved(filePath = this.filePath) {
      this.filePath = filePath || null;
      this.dirty = false;
      this.emit('Saved');
      return this.state();
    }

    verify() {
      const layerViolations = this.score.parts.filter(part => JSON.stringify(part.voiceLayers) !== JSON.stringify([1, 2, 3, 4]));
      const independentModels = 0;
      return {
        canonicalModel: Boolean(this.score && this.score.format === 'airscore'),
        directApi: true,
        fourVoiceLayers: layerViolations.length === 0,
        independentModels,
        partCount: this.score.parts.length,
        measureCount: this.score.measures.length,
        eventCount: this.score.parts.reduce((sum, part) => sum + part.events.length, 0),
        fourLayerPlayback: Object.keys(this.transport.layerMix).length === 4,
        midiModes: Boolean(deps.midiInput?.StepTimeMidiInput && deps.midiInput?.RealTimeMidiInput)
      };
    }

    async command(name, payload = {}) {
      const commands = {
        newScore: () => this.newScore(payload),
        undo: () => this.undo(),
        redo: () => this.redo(),
        addNote: () => this.addNote(payload),
        addRest: () => this.addRest(payload),
        addChordTone: () => this.addChordTone(payload),
        pianoChord: () => this.addPianoChord(payload.midis ?? payload.midi, payload),
        deleteSelection: () => this.deleteSelection(),
        copy: () => this.copySelection(),
        paste: () => this.pasteSelection(payload),
        transpose: () => this.transposeSelection(payload.semitones),
        move: () => this.moveSelection(payload.beats),
        lyric: () => this.setLyric(payload.text, payload),
        lyricPassage: () => this.applyLyricsWorkflow(payload.text, payload),
        solfaPassage: () => this.applySolfaPassage(payload.text, payload),
        choirRangeReport: () => this.choirRangeReport(payload),
        solfaSynchronization: () => this.solfaSynchronizationReport(),
        lyricCopyVerse: () => this.copyLyricVerse(payload.sourceVerse, payload.targetVerse, payload),
        lyricDeleteVerse: () => this.deleteLyricVerse(payload.verse, payload),
        lyricOffset: () => this.setLyricOffset(payload.x, payload.y, payload),
        lyricResetOffset: () => this.resetLyricOffset(payload),
        appendMeasures: () => this.appendMeasures(payload.count),
        insertMeasures: () => this.insertMeasures(payload.index, payload.count),
        removeMeasure: () => this.removeMeasure(payload.index),
        measureAttributes: () => this.setMeasureAttributes(payload.index, payload.patch),
        tie: () => this.addTie(),
        slur: () => this.addSlur(),
        articulation: () => this.setArticulation(payload.name, payload.enabled),
        notationProperties: () => this.applyNotation(payload),
        notationMark: () => this.attachMark(payload),
        measureNavigation: () => this.setMeasureNavigation(payload.index, payload),
        dot: () => this.toggleDot(),
        tuplet: () => this.setTuplet(payload.actual, payload.normal),
        beamSelection: () => this.beamSelection(),
        autoBeamSelection: () => this.autoBeamSelection(),
        clearSelectionBeams: () => this.clearSelectionBeams(),
        chordInterval: () => this.addIntervalToChord(payload.semitones),
        copyToLayer: () => this.copySelectionToLayer(payload.voice, payload),
        replaceSelection: () => this.replaceSelectionFromClipboard(payload.contentMode),
        addPart: () => this.addPart(payload.instrumentKey, payload.overrides),
        compositionTools: () => this.compositionTools(payload.state),
        compositionHubState: () => this.setCompositionHubState(payload.action || payload),
        compositionPreview: () => this.compositionPreview(payload.toolId, payload.values || payload),
        applyCompositionPreview: () => this.applyCompositionPreview(payload.preview, payload.options || payload),
        projectEnvelope: () => this.projectEnvelope(payload),
        validateProjectEnvelope: () => this.validateProjectEnvelope(payload.envelope, payload),
        autosavePlan: () => this.autosavePlan(payload),
        publishingPlan: () => this.publishingPlan(payload),
        applyHouseStyle: () => this.applyHouseStyle(payload.style, payload),
        recognitionReview: () => this.recognitionReview(payload.kind, payload.source, payload.candidates, payload),
        findInScore: () => this.findInScore(payload),
        navigator: () => this.navigatorModel(payload.pages || []),
        batchOperation: () => this.batchOperation(payload.operation, payload),
        performanceReport: () => this.performanceReport(payload.samples || payload, payload.budgets),
        linkedParts: () => this.generateLinkedParts(payload),
        linkedPartUpdate: () => this.updateLinkedPart(payload.partId, payload),
        createCue: () => this.createCue(payload),
        engravingAudit: () => this.engravingAudit(payload),
        batchPartExportPlan: () => this.batchPartExportPlan(payload),
        removePart: () => this.removeActivePart(),
        updatePart: () => this.updateActivePart(payload),
        pickup: () => this.configurePickup(payload.beats),
        annotation: () => this.addAnnotation(payload.type, payload.text, payload),
        dynamic: () => this.addDynamic(payload.value),
        chordSymbol: () => this.addChordSymbol(payload.symbol, payload),
        removeSpanners: () => this.removeSelectedSpanners(payload.type),
        selectPrevious: () => this.selectAdjacent(-1),
        selectNext: () => this.selectAdjacent(1),
        play: () => this.startPlayback(payload),
        pause: () => this.pausePlayback(),
        resume: () => this.resumePlayback(payload),
        stop: () => this.stopPlayback(payload),
        rewind: () => this.seek(0),
        jumpMeasure: () => this.jumpToMeasure(payload.measure),
        playbackOptions: () => this.setPlaybackOptions(payload),
        mixer: () => this.setMixer(payload),
        practicePreset: () => this.practicePreset(payload),
        audioExportPlan: () => this.audioExportPlan(payload),
        renderWav: () => this.renderWav(payload),
        layerPlayback: () => this.setLayerPlayback(payload.voice, payload),
        midiConfigure: () => this.configureMidi(payload),
        midiMessage: () => this.handleMidiMessage(payload.data, payload.timestampMs),
        midiRecordStart: () => this.startMidiRecording(payload.timestampMs),
        midiRecordStop: () => this.stopMidiRecording(payload.timestampMs),
        midiDisconnect: () => this.disconnectMidi()
      };
      if (!commands[name]) throw new Error(`Unknown Composer 3 command: ${name}`);
      return commands[name]();
    }
  }

  return Object.freeze({
    Composer3Engine,
    createEngine: options => new Composer3Engine(options),
    commandGroups: COMMAND_GROUPS,
    dependencies: Object.freeze({ ...deps })
  });
});
