(function (root, factory) {
  const dependencies = {
    model: root.AirmonScoreModel || (typeof require === 'function' ? require('./score-model') : null),
    theory: root.AirmonMusicTheory || (typeof require === 'function' ? require('./music-theory') : null),
    harmony: root.AirmonHarmony || (typeof require === 'function' ? require('./harmony') : null),
    solfa: root.AirmonSolfa || (typeof require === 'function' ? require('./solfa') : null),
    parts: root.AirmonPartsEngraving || (typeof require === 'function' ? require('./parts-engraving-service') : null),
    practice: root.AirmonPracticeAudio || (typeof require === 'function' ? require('./practice-audio-service') : null)
  };
  const api = factory(dependencies);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AirmonCompositionHub = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';

  if (!deps.model || !deps.theory || !deps.harmony || !deps.solfa) {
    throw new Error('Composition Hub dependencies are unavailable.');
  }

  const GROUPS = Object.freeze([
    'Create', 'Harmony', 'Arrange', 'Transform', 'Analyse',
    'Lyrics and Choir', 'Playback and Practice', 'Publish'
  ]);

  const tool = (id, group, label, command, contexts, description, keywords = [], guided = []) =>
    Object.freeze({
      id, group, label, command,
      contexts: Object.freeze(contexts),
      description,
      keywords: Object.freeze(keywords),
      guided: Object.freeze(guided)
    });

  const TOOLS = Object.freeze([
    tool('continue-melody', 'Create', 'Continue melody', 'compositionPreview', ['melody', 'notes'], 'Extend the selected melodic idea using its intervals and rhythm.', ['phrase', 'extend'], ['selection', 'length', 'direction']),
    tool('motif-variation', 'Create', 'Motif variation', 'compositionPreview', ['melody', 'notes'], 'Create a transposed or rhythmically varied motif.', ['variation', 'transpose'], ['selection', 'interval', 'rhythmFactor']),
    tool('rhythm-variation', 'Create', 'Rhythm variation', 'compositionPreview', ['melody', 'notes'], 'Retain pitch identity while changing rhythmic proportions.', ['augment', 'diminish'], ['selection', 'rhythmFactor']),
    tool('countermelody', 'Create', 'Countermelody', 'compositionPreview', ['melody', 'notes'], 'Generate contrary-motion material for another voice or staff.', ['counterpoint'], ['selection', 'destinationPartId', 'voice']),
    tool('bass-line', 'Create', 'Bass line', 'compositionPreview', ['melody', 'chords', 'staff'], 'Create a bass line from harmonic roots and strong beats.', ['bass'], ['selection', 'destinationPartId']),
    tool('harmonise-melody', 'Harmony', 'Harmonise melody', 'harmonyPreview', ['melody', 'notes'], 'Generate three editable harmony alternatives.', ['satb', 'keyboard'], ['selection', 'style', 'destination']),
    tool('satb-harmony', 'Harmony', 'SATB harmony', 'harmonyPreview', ['melody', 'notes', 'staff'], 'Generate and inspect Soprano, Alto, Tenor and Bass alternatives.', ['choir', 'voice-leading'], ['selection', 'style', 'range']),
    tool('chord-suggestions', 'Harmony', 'Chord suggestions', 'analysisPreview', ['melody', 'notes', 'chords'], 'Identify likely chords at each onset.', ['harmony', 'analysis'], ['selection', 'key']),
    tool('voice-leading-repair', 'Harmony', 'Voice-leading repair', 'analysisPreview', ['chords', 'staff'], 'Find crossings, wide spacing and parallel motion.', ['parallel fifths', 'octaves'], ['selection']),
    tool('generate-chord-symbols', 'Harmony', 'Generate chord symbols', 'analysisPreview', ['notes', 'chords', 'staff'], 'Generate chord names from simultaneous notes.', ['lead sheet'], ['selection', 'key']),
    tool('create-practice-parts', 'Arrange', 'Create practice parts', 'practicePreset', ['score', 'staff', 'notes'], 'Prepare voice-emphasised and accompaniment-only practice mixes.', ['satb', 'practice'], ['role', 'tempoScale']),
    tool('double-at-interval', 'Arrange', 'Double at interval', 'compositionPreview', ['notes', 'melody', 'chords'], 'Copy selected notes at a chosen interval.', ['orchestration'], ['selection', 'interval', 'destinationPartId']),
    tool('revoice-chords', 'Arrange', 'Revoice chords', 'compositionPreview', ['chords', 'notes'], 'Redistribute chord tones while retaining harmony.', ['voicing'], ['selection', 'spread']),
    tool('reduce-to-piano', 'Arrange', 'Reduce to piano', 'compositionPreview', ['score', 'staff', 'notes'], 'Create a two-staff playable reduction.', ['piano reduction'], ['selection']),
    tool('expand-to-ensemble', 'Arrange', 'Expand to ensemble', 'compositionPreview', ['score', 'staff', 'notes'], 'Distribute material across selected instruments.', ['orchestrate'], ['selection', 'ensemble']),
    tool('transpose', 'Transform', 'Transpose', 'transpose', ['notes', 'melody', 'chords', 'staff'], 'Transpose selection by interval.', ['key', 'interval'], ['selection', 'semitones']),
    tool('augment-rhythm', 'Transform', 'Augment rhythm', 'compositionPreview', ['notes', 'melody'], 'Double or scale durations and spacing.', ['rhythm'], ['selection', 'factor']),
    tool('diminish-rhythm', 'Transform', 'Diminish rhythm', 'compositionPreview', ['notes', 'melody'], 'Shorten durations and spacing.', ['rhythm'], ['selection', 'factor']),
    tool('invert', 'Transform', 'Invert melody', 'compositionPreview', ['notes', 'melody'], 'Invert intervals around the first selected pitch.', ['mirror'], ['selection']),
    tool('retrograde', 'Transform', 'Retrograde', 'compositionPreview', ['notes', 'melody'], 'Reverse event order while preserving total duration.', ['reverse'], ['selection']),
    tool('staff-solfa', 'Transform', 'Staff ↔ Tonic Sol-fa', 'solfaSynchronization', ['score', 'notes', 'staff'], 'Verify and convert the shared semantic score.', ['solfa', 'convert'], ['selection']),
    tool('detect-key', 'Analyse', 'Detect key', 'analysisPreview', ['score', 'notes', 'melody', 'chords'], 'Rank likely major and minor keys from pitch evidence.', ['tonality'], ['selection']),
    tool('identify-chords', 'Analyse', 'Identify chords', 'analysisPreview', ['notes', 'melody', 'chords'], 'Identify triads and seventh sonorities by onset.', ['roman', 'nashville'], ['selection', 'key']),
    tool('parallel-motion', 'Analyse', 'Parallel fifth/octave check', 'analysisPreview', ['staff', 'chords', 'notes'], 'Detect similar-motion perfect fifths and octaves.', ['voice leading'], ['selection']),
    tool('range-check', 'Analyse', 'Range and playability', 'engravingAudit', ['score', 'staff', 'notes'], 'Check instrument and choir ranges.', ['playability'], ['selection']),
    tool('rhythm-complexity', 'Analyse', 'Rhythm complexity', 'analysisPreview', ['score', 'notes', 'melody'], 'Measure syncopation, tuplets and duration diversity.', ['density'], ['selection']),
    tool('solfa-diagnostics', 'Analyse', 'Sol-fa diagnostics', 'solfaSynchronization', ['score', 'notes', 'staff'], 'Check staff pitch, sounding pitch and Sol-fa consistency.', ['choir'], ['selection']),
    tool('enter-lyrics', 'Lyrics and Choir', 'Enter lyrics', 'lyricPassage', ['notes', 'melody', 'lyrics'], 'Attach syllables to consecutive notes.', ['verse'], ['selection', 'verse', 'text']),
    tool('add-verse', 'Lyrics and Choir', 'Add verse', 'lyricPassage', ['notes', 'melody', 'lyrics'], 'Add another independent lyric verse.', ['chorus', 'translation'], ['selection', 'verse', 'text']),
    tool('create-satb', 'Lyrics and Choir', 'Create SATB', 'harmonyPreview', ['melody', 'notes', 'score'], 'Create three choir harmony alternatives.', ['choir'], ['selection', 'style']),
    tool('choir-range', 'Lyrics and Choir', 'Choir range check', 'choirRangeReport', ['score', 'staff', 'notes'], 'Check Soprano, Alto, Tenor and Bass ranges.', ['satb'], ['selection']),
    tool('display-solfa', 'Lyrics and Choir', 'Display Sol-fa', 'solfaSynchronization', ['score', 'notes', 'staff'], 'Open synchronized Tonic Sol-fa workflows.', ['tonic'], ['selection']),
    tool('play-selection', 'Playback and Practice', 'Play selection', 'play', ['notes', 'melody', 'chords'], 'Play from the selected musical position.', ['audition'], ['selection']),
    tool('loop-measures', 'Playback and Practice', 'Loop measures', 'playbackOptions', ['measure', 'notes', 'staff'], 'Loop the selected range with optional count-in.', ['practice'], ['selection', 'countInMeasures']),
    tool('tempo-trainer', 'Playback and Practice', 'Tempo trainer', 'practicePreset', ['score', 'notes', 'staff'], 'Create a slower or progressive practice preset.', ['metronome'], ['tempoScale']),
    tool('solo-voice', 'Playback and Practice', 'Solo or emphasise voice', 'practicePreset', ['score', 'notes', 'staff'], 'Emphasise a choir voice without rewriting the score.', ['satb'], ['role', 'emphasis']),
    tool('export-practice', 'Playback and Practice', 'Export practice track', 'audioExportPlan', ['score', 'notes', 'staff'], 'Prepare deterministic WAV practice-track output.', ['audio'], ['role', 'kind']),
    tool('format-parts', 'Publish', 'Format parts', 'linkedParts', ['score', 'staff'], 'Generate linked part descriptors and page settings.', ['parts'], ['pageSize']),
    tool('print-preview', 'Publish', 'Print preview', 'printPreview', ['score', 'staff', 'notes'], 'Open the authoritative publication preview.', ['print'], ['range']),
    tool('export-pdf', 'Publish', 'Export PDF', 'exportPdf', ['score', 'staff', 'notes'], 'Export score or parts with the publication profile.', ['publish'], ['range']),
    tool('export-images', 'Publish', 'Export images', 'exportPng', ['score', 'staff', 'notes'], 'Export deterministic page images.', ['png'], ['range']),
    tool('export-musicxml', 'Publish', 'Export MusicXML/MXL', 'exportMusicXml', ['score', 'staff', 'notes'], 'Export open interchange data.', ['mxl'], ['selection']),
    tool('export-audio', 'Publish', 'Export audio', 'audioExportPlan', ['score', 'staff', 'notes'], 'Export WAV full mix, parts or stems.', ['wav'], ['kind'])
  ]);

  const TOOL_BY_ID = Object.freeze(Object.fromEntries(TOOLS.map(item => [item.id, item])));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const clone = value => JSON.parse(JSON.stringify(value));

  function normalizeState(value = {}) {
    const favorites = [...new Set((value.favorites || []).filter(id => TOOL_BY_ID[id]))];
    const recent = [...new Set((value.recent || []).filter(id => TOOL_BY_ID[id]))].slice(0, 12);
    const presets = Array.isArray(value.presets)
      ? value.presets.filter(item => item && TOOL_BY_ID[item.toolId]).map(item => Object.freeze({
          id: String(item.id || `preset-${item.toolId}`),
          name: String(item.name || TOOL_BY_ID[item.toolId].label),
          toolId: item.toolId,
          values: Object.freeze(clone(item.values || {}))
        }))
      : [];
    return Object.freeze({
      open: Boolean(value.open),
      pinned: Boolean(value.pinned),
      dock: value.dock === 'right' ? 'right' : 'left',
      width: Math.round(clamp(value.width || 360, 280, 560)),
      activeGroup: GROUPS.includes(value.activeGroup) ? value.activeGroup : 'Create',
      query: String(value.query || ''),
      favorites: Object.freeze(favorites),
      recent: Object.freeze(recent),
      presets: Object.freeze(presets),
      reducedMotion: Boolean(value.reducedMotion)
    });
  }

  function selectionContext(score, entries = []) {
    const list = (entries || []).filter(entry => entry?.event);
    const notes = list.filter(entry => entry.event.type === 'note');
    const lyrics = notes.flatMap(entry => entry.event.lyrics || []);
    const onsetCounts = new Map();
    notes.forEach(entry => {
      const key = `${entry.part.id}|${entry.event.staff || ''}|${Number(entry.event.start).toFixed(6)}`;
      onsetCounts.set(key, (onsetCounts.get(key) || 0) + 1);
    });
    const chord = [...onsetCounts.values()].some(count => count > 1) || notes.some(entry => entry.event.chordId);
    const melodic = notes.length > 1 && new Set(notes.map(entry => entry.event.start)).size > 1;
    const types = new Set();
    if (!list.length) types.add('score');
    if (list.length) types.add('notes');
    if (melodic) types.add('melody');
    if (chord) types.add('chords');
    if (lyrics.length) types.add('lyrics');
    if (list.length && new Set(list.map(entry => entry.part.id)).size === 1) types.add('staff');
    if (list.length && list.some(entry => entry.event.type === 'rest')) types.add('measure');
    return Object.freeze({
      selectionCount: list.length,
      noteCount: notes.length,
      partIds: Object.freeze([...new Set(list.map(entry => entry.part.id))]),
      eventIds: Object.freeze(list.map(entry => entry.event.id)),
      types: Object.freeze([...types]),
      key: deps.model.effectiveKey(score, list[0]?.event ? deps.model.measureIndexAt(score, list[0].event.start) : 0),
      start: list.length ? Math.min(...list.map(entry => Number(entry.event.start) || 0)) : 0,
      end: list.length ? Math.max(...list.map(entry => (Number(entry.event.start) || 0) + (Number(entry.event.duration) || 0))) : deps.model.totalBeats(score)
    });
  }

  function toolAvailability(context, item) {
    const matches = item.contexts.some(type => context.types.includes(type));
    if (matches) return Object.freeze({ enabled: true, reason: '' });
    const expected = item.contexts.filter(type => type !== 'score').join(', ');
    return Object.freeze({
      enabled: false,
      reason: expected ? `Select ${expected} before using ${item.label}.` : `${item.label} is unavailable in this context.`
    });
  }

  function toolsForContext(context, state = normalizeState()) {
    const query = String(state.query || '').trim().toLowerCase();
    return Object.freeze(TOOLS.map(item => {
      const availability = toolAvailability(context, item);
      const score = item.contexts.reduce((sum, type) => sum + (context.types.includes(type) ? 5 : 0), 0)
        + (state.favorites.includes(item.id) ? 3 : 0)
        + (state.recent.includes(item.id) ? 1 : 0);
      return Object.freeze({ ...item, ...availability, score });
    }).filter(item => {
      if (!query) return true;
      const haystack = [item.label, item.group, item.description, ...item.keywords].join(' ').toLowerCase();
      return query.split(/\s+/).every(token => haystack.includes(token));
    }).sort((a, b) => b.score - a.score || GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) || a.label.localeCompare(b.label)));
  }

  function updateState(state, action = {}) {
    const current = normalizeState(state);
    const next = clone(current);
    switch (action.type) {
      case 'open': next.open = true; break;
      case 'close': next.open = false; break;
      case 'toggle': next.open = !current.open; break;
      case 'pin': next.pinned = Boolean(action.value); break;
      case 'dock': next.dock = action.value === 'right' ? 'right' : 'left'; break;
      case 'resize': next.width = action.width; break;
      case 'group': next.activeGroup = action.group; break;
      case 'search': next.query = action.query; break;
      case 'favorite':
        next.favorites = current.favorites.includes(action.toolId)
          ? current.favorites.filter(id => id !== action.toolId)
          : [...current.favorites, action.toolId];
        break;
      case 'used':
        next.recent = [action.toolId, ...current.recent.filter(id => id !== action.toolId)].slice(0, 12);
        break;
      case 'preset':
        next.presets = [...current.presets.filter(item => item.id !== action.preset.id), action.preset];
        break;
      case 'reset':
        return normalizeState({ reducedMotion: current.reducedMotion });
      default: break;
    }
    return normalizeState(next);
  }

  function guidedPlan(toolId, values = {}, context = {}) {
    const item = TOOL_BY_ID[toolId];
    if (!item) throw new Error(`Unknown Composition Hub tool: ${toolId}`);
    const availability = toolAvailability(context, item);
    if (!availability.enabled) throw new Error(availability.reason);
    const inputs = Object.freeze(item.guided.map(id => Object.freeze({
      id,
      value: values[id] ?? null,
      advanced: ['range', 'destinationPartId', 'ensemble', 'spread'].includes(id)
    })));
    return Object.freeze({
      id: `plan-${toolId}-${Date.now().toString(36)}`,
      toolId,
      command: item.command,
      group: item.group,
      label: item.label,
      selection: Object.freeze({
        eventIds: Object.freeze([...(context.eventIds || [])]),
        partIds: Object.freeze([...(context.partIds || [])]),
        start: context.start ?? 0,
        end: context.end ?? 0
      }),
      values: Object.freeze(clone(values)),
      inputs,
      canPreview: ['compositionPreview', 'harmonyPreview', 'analysisPreview'].includes(item.command),
      canApply: true
    });
  }

  function selectedEntries(score, context) {
    const ids = new Set(context.eventIds || []);
    return score.parts.flatMap(part => part.events
      .filter(event => ids.has(event.id))
      .map(event => ({ part, event })))
      .sort((a, b) => a.event.start - b.event.start || a.event.midi - b.event.midi);
  }

  function noteEvents(score, context) {
    const selected = selectedEntries(score, context).filter(entry => entry.event.type === 'note');
    if (selected.length) return selected;
    return score.parts.flatMap(part => part.events
      .filter(event => event.type === 'note' && event.generatedBy !== 'gap-fill')
      .map(event => ({ part, event })))
      .sort((a, b) => a.event.start - b.event.start || a.event.midi - b.event.midi);
  }

  function detectKey(score, context = {}) {
    const notes = noteEvents(score, context);
    const histogram = Array(12).fill(0);
    notes.forEach(({ event }) => { histogram[event.midi % 12] += Math.max(.125, Number(event.duration) || 1); });
    const major = [0, 2, 4, 5, 7, 9, 11];
    const minor = [0, 2, 3, 5, 7, 8, 10];
    const candidates = [];
    for (let rootPc = 0; rootPc < 12; rootPc += 1) {
      for (const [mode, scale] of [['major', major], ['minor', minor]]) {
        const allowed = new Set(scale.map(pc => (pc + rootPc) % 12));
        let scoreValue = 0;
        histogram.forEach((weight, pc) => { scoreValue += allowed.has(pc) ? weight : -weight * 1.5; });
        scoreValue += histogram[rootPc] * .75;
        candidates.push({
          key: `${deps.theory.PITCH_CLASSES_SHARP[rootPc]}${mode === 'minor' ? 'm' : ''}`,
          mode,
          rootPc,
          score: scoreValue
        });
      }
    }
    candidates.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
    return Object.freeze({
      noteCount: notes.length,
      detected: candidates[0] ? Object.freeze({ ...candidates[0] }) : null,
      alternatives: Object.freeze(candidates.slice(0, 5).map(item => Object.freeze({ ...item })))
    });
  }

  function chordName(midis = [], key = 'C') {
    const pcs = [...new Set(midis.map(midi => ((Number(midi) % 12) + 12) % 12))].sort((a, b) => a - b);
    if (!pcs.length) return null;
    const forms = [
      { intervals: [0, 4, 7], suffix: '' },
      { intervals: [0, 3, 7], suffix: 'm' },
      { intervals: [0, 3, 6], suffix: 'dim' },
      { intervals: [0, 4, 8], suffix: 'aug' },
      { intervals: [0, 4, 7, 10], suffix: '7' },
      { intervals: [0, 4, 7, 11], suffix: 'maj7' },
      { intervals: [0, 3, 7, 10], suffix: 'm7' }
    ];
    for (const rootPc of pcs) {
      const relative = pcs.map(pc => (pc - rootPc + 12) % 12).sort((a, b) => a - b);
      const form = forms.find(item => item.intervals.length === relative.length &&
        item.intervals.every((value, index) => value === relative[index]));
      if (form) return `${deps.theory.PITCH_CLASSES_SHARP[rootPc]}${form.suffix}`;
    }
    const bass = pcs[0];
    return `${deps.theory.PITCH_CLASSES_SHARP[bass]}(add)`;
  }

  function identifyChords(score, context = {}) {
    const notes = noteEvents(score, context);
    const byOnset = new Map();
    notes.forEach(({ part, event }) => {
      const key = Number(event.start).toFixed(6);
      if (!byOnset.has(key)) byOnset.set(key, []);
      byOnset.get(key).push({ partId: part.id, event });
    });
    const key = context.key || deps.model.effectiveKey(score, 0);
    return Object.freeze([...byOnset.entries()].map(([start, entries]) => {
      const midis = entries.map(entry => entry.event.midi);
      const name = chordName(midis, key);
      const rootPc = name ? deps.theory.keyRootPc(name.replace(/m|dim|aug|maj7|7|\(add\).*/, '')) : null;
      const tonicPc = deps.theory.keyRootPc(key);
      const degree = rootPc == null ? null : ((rootPc - tonicPc + 12) % 12);
      const romanBySemitone = { 0: 'I', 2: 'ii', 4: 'iii', 5: 'IV', 7: 'V', 9: 'vi', 11: 'vii°' };
      const nashvilleBySemitone = { 0: '1', 2: '2m', 4: '3m', 5: '4', 7: '5', 9: '6m', 11: '7°' };
      return Object.freeze({
        start: Number(start),
        eventIds: Object.freeze(entries.map(entry => entry.event.id)),
        midis: Object.freeze(midis.sort((a, b) => a - b)),
        name,
        roman: romanBySemitone[degree] || '?',
        nashville: nashvilleBySemitone[degree] || '?'
      });
    }).filter(item => item.midis.length >= 2));
  }

  function parallelMotion(score, context = {}) {
    const notes = noteEvents(score, context);
    const voices = new Map();
    notes.forEach(({ part, event }) => {
      const key = `${part.id}|${event.staff || ''}|${event.voice || 1}`;
      if (!voices.has(key)) voices.set(key, []);
      voices.get(key).push(event);
    });
    const lines = [...voices.entries()].map(([id, events]) => ({
      id,
      events: events.sort((a, b) => a.start - b.start)
    }));
    const warnings = [];
    for (let a = 0; a < lines.length; a += 1) for (let b = a + 1; b < lines.length; b += 1) {
      const one = lines[a].events;
      const two = lines[b].events;
      const common = one.map(event => event.start).filter(start => two.some(event => Math.abs(event.start - start) < 1e-8));
      for (let index = 1; index < common.length; index += 1) {
        const previousStart = common[index - 1];
        const currentStart = common[index];
        const previousA = one.find(event => Math.abs(event.start - previousStart) < 1e-8);
        const previousB = two.find(event => Math.abs(event.start - previousStart) < 1e-8);
        const currentA = one.find(event => Math.abs(event.start - currentStart) < 1e-8);
        const currentB = two.find(event => Math.abs(event.start - currentStart) < 1e-8);
        const oldInterval = Math.abs(previousA.midi - previousB.midi) % 12;
        const newInterval = Math.abs(currentA.midi - currentB.midi) % 12;
        const moveA = Math.sign(currentA.midi - previousA.midi);
        const moveB = Math.sign(currentB.midi - previousB.midi);
        if (moveA && moveA === moveB && [0, 7].includes(oldInterval) && oldInterval === newInterval) {
          warnings.push(Object.freeze({
            type: oldInterval === 7 ? 'parallel-fifth' : 'parallel-octave',
            at: currentStart,
            voices: Object.freeze([lines[a].id, lines[b].id]),
            eventIds: Object.freeze([currentA.id, currentB.id])
          }));
        }
      }
    }
    return Object.freeze(warnings);
  }

  function rhythmComplexity(score, context = {}) {
    const notes = noteEvents(score, context);
    const durations = new Set(notes.map(({ event }) => Number(event.duration).toFixed(6)));
    const tuplets = notes.filter(({ event }) => event.tuplet).length;
    const offBeat = notes.filter(({ event }) => Math.abs(event.start - Math.round(event.start)) > 1e-8).length;
    const syncopation = notes.filter(({ event }) => {
      const startFraction = Math.abs(event.start - Math.round(event.start));
      const end = event.start + event.duration;
      return startFraction > 1e-8 && Math.abs(end - Math.round(end)) < 1e-8;
    }).length;
    const scoreValue = notes.length
      ? Math.min(100, Math.round((durations.size * 8 + tuplets * 12 + offBeat * 4 + syncopation * 8) / notes.length * 4))
      : 0;
    return Object.freeze({
      eventCount: notes.length,
      durationVariety: durations.size,
      tuplets,
      offBeat,
      syncopation,
      score: scoreValue,
      level: scoreValue < 25 ? 'simple' : scoreValue < 55 ? 'moderate' : 'complex'
    });
  }

  function analysisPreview(score, toolId, context, values = {}) {
    if (toolId === 'detect-key') return Object.freeze({ type: 'analysis', toolId, result: detectKey(score, context) });
    if (['identify-chords', 'chord-suggestions', 'generate-chord-symbols'].includes(toolId)) {
      return Object.freeze({ type: 'analysis', toolId, result: identifyChords(score, { ...context, key: values.key || context.key }) });
    }
    if (['parallel-motion', 'voice-leading-repair'].includes(toolId)) {
      return Object.freeze({ type: 'analysis', toolId, result: parallelMotion(score, context) });
    }
    if (toolId === 'rhythm-complexity') return Object.freeze({ type: 'analysis', toolId, result: rhythmComplexity(score, context) });
    throw new Error(`No analysis preview is available for ${toolId}.`);
  }

  function transformedEvents(score, toolId, context, values = {}) {
    const entries = noteEvents(score, context);
    if (!entries.length) throw new Error('Select notes before creating a transformation preview.');
    const source = entries.map(({ part, event }) => ({ partId: part.id, event: clone(event) }));
    const firstStart = Math.min(...source.map(item => item.event.start));
    const end = Math.max(...source.map(item => item.event.start + item.event.duration));
    const firstMidi = source[0].event.midi;
    const factor = toolId === 'augment-rhythm' ? clamp(values.factor || 2, .25, 8)
      : toolId === 'diminish-rhythm' ? clamp(values.factor || .5, .125, 4)
        : clamp(values.rhythmFactor || 1, .125, 8);
    let events;
    if (toolId === 'continue-melody') {
      const length = Math.max(1, Math.min(32, Math.round(Number(values.length) || source.length)));
      const intervals = source.slice(1).map((item, index) => item.event.midi - source[index].event.midi);
      const durations = source.map(item => item.event.duration);
      let midi = source.at(-1).event.midi;
      let cursor = end;
      events = Array.from({ length }, (_, index) => {
        midi = clamp(midi + (intervals[index % Math.max(1, intervals.length)] || 0), 0, 127);
        const duration = durations[index % durations.length] || 1;
        const template = source[index % source.length].event;
        const event = { ...template, id: null, midi, pitch: deps.theory.spellMidiForKey(midi, context.key), start: cursor, duration };
        cursor += duration;
        return { partId: values.destinationPartId || source[0].partId, event };
      });
    } else if (toolId === 'countermelody') {
      const center = Number(values.centerMidi) || firstMidi;
      events = source.map(item => ({
        partId: values.destinationPartId || item.partId,
        event: {
          ...item.event,
          id: null,
          midi: clamp(center - (item.event.midi - center), 0, 127),
          pitch: deps.theory.spellMidiForKey(clamp(center - (item.event.midi - center), 0, 127), context.key),
          voice: Math.max(1, Math.min(4, Number(values.voice) || 2))
        }
      }));
    } else if (toolId === 'bass-line') {
      const byStart = new Map();
      source.forEach(item => {
        const key = item.event.start.toFixed(6);
        const current = byStart.get(key);
        if (!current || item.event.midi < current.event.midi) byStart.set(key, item);
      });
      events = [...byStart.values()].map(item => {
        let midi = item.event.midi;
        while (midi > 52) midi -= 12;
        return {
          partId: values.destinationPartId || item.partId,
          event: { ...item.event, id: null, midi, pitch: deps.theory.spellMidiForKey(midi, context.key), voice: Math.max(1, Math.min(4, Number(values.voice) || 4)) }
        };
      });
    } else if (toolId === 'double-at-interval') {
      const interval = Math.round(Number(values.interval) || 12);
      events = source.map(item => {
        const midi = clamp(item.event.midi + interval, 0, 127);
        return { partId: values.destinationPartId || item.partId, event: { ...item.event, id: null, midi, pitch: deps.theory.spellMidiForKey(midi, context.key) } };
      });
    } else if (toolId === 'invert') {
      events = source.map(item => {
        const midi = clamp(firstMidi - (item.event.midi - firstMidi), 0, 127);
        return { partId: item.partId, event: { ...item.event, id: null, midi, pitch: deps.theory.spellMidiForKey(midi, context.key) } };
      });
    } else if (toolId === 'retrograde') {
      events = source.map(item => ({
        partId: item.partId,
        event: { ...item.event, id: null, start: firstStart + (end - (item.event.start + item.event.duration)) }
      })).sort((a, b) => a.event.start - b.event.start);
    } else if (['augment-rhythm', 'diminish-rhythm', 'rhythm-variation', 'motif-variation'].includes(toolId)) {
      const interval = toolId === 'motif-variation' ? Math.round(Number(values.interval) || 2) : 0;
      events = source.map(item => {
        const midi = clamp(item.event.midi + interval, 0, 127);
        return {
          partId: values.destinationPartId || item.partId,
          event: {
            ...item.event,
            id: null,
            midi,
            pitch: deps.theory.spellMidiForKey(midi, context.key),
            start: firstStart + (item.event.start - firstStart) * factor,
            duration: Math.max(.0625, item.event.duration * factor)
          }
        };
      });
    } else if (toolId === 'revoice-chords') {
      const spread = Math.round(clamp(values.spread || 12, 0, 24));
      events = source.map((item, index) => {
        const octave = index % 2 ? spread : 0;
        const midi = clamp(item.event.midi + octave, 0, 127);
        return { partId: item.partId, event: { ...item.event, id: null, midi, pitch: deps.theory.spellMidiForKey(midi, context.key) } };
      });
    } else {
      throw new Error(`No composition preview is available for ${toolId}.`);
    }
    return Object.freeze(events.map(item => Object.freeze({ partId: item.partId, event: Object.freeze(item.event) })));
  }

  function compositionPreview(score, toolId, context, values = {}) {
    const events = transformedEvents(score, toolId, context, values);
    return Object.freeze({
      id: `preview-${toolId}-${Date.now().toString(36)}`,
      type: 'events',
      toolId,
      sourceEventIds: Object.freeze([...(context.eventIds || [])]),
      events,
      summary: `${events.length} preview event${events.length === 1 ? '' : 's'}`,
      warnings: Object.freeze([])
    });
  }

  function harmonyPreview(score, context, values = {}) {
    const alternatives = deps.harmony.generateAlternatives(score, {
      sourcePartId: values.sourcePartId || context.partIds?.[0],
      sourceVoice: values.sourceVoice || 1,
      style: values.style || 'hymn',
      destination: values.destination || 'satb-parts',
      startBeat: context.start,
      endBeat: context.end
    });
    return Object.freeze({
      id: `preview-harmony-${Date.now().toString(36)}`,
      type: 'harmony',
      toolId: 'harmonise-melody',
      alternatives: Object.freeze(alternatives.map(item => Object.freeze(clone(item)))),
      summary: `${alternatives.length} harmony alternatives`,
      warnings: Object.freeze(alternatives.flatMap(item => item.issues || []).map(item => Object.freeze({ ...item })))
    });
  }

  function applyPreview(score, preview, options = {}) {
    if (!preview || !['events', 'harmony'].includes(preview.type)) throw new Error('A valid preview is required.');
    if (preview.type === 'harmony') {
      const index = Math.max(0, Math.min(preview.alternatives.length - 1, Math.round(Number(options.alternativeIndex) || 0)));
      return deps.harmony.applyVariant(score, clone(preview.alternatives[index]), {
        destination: options.destination || preview.alternatives[index].destination
      });
    }
    const created = [];
    for (const item of preview.events) {
      const part = score.parts.find(candidate => candidate.id === (options.destinationPartId || item.partId));
      if (!part) throw new Error(`Preview destination part not found: ${item.partId}`);
      const source = item.event;
      const event = deps.model.addNote(score, part.id, {
        midi: source.midi,
        start: source.start,
        duration: source.duration,
        voice: source.voice,
        staff: source.staff,
        velocity: source.velocity,
        grace: source.grace,
        tuplet: source.tuplet,
        articulations: source.articulations,
        ornaments: source.ornaments,
        technical: source.technical,
        generated: true,
        generatedBy: 'composition-assistant',
        generationGroupId: preview.id,
        inputSource: `composition-hub:${preview.toolId}`,
        allowChord: true
      });
      deps.model.updateEvent(score, part.id, event.id, {
        assistance: {
          toolId: preview.toolId,
          previewId: preview.id,
          appliedAt: options.appliedAt || new Date().toISOString()
        }
      });
      created.push({ partId: part.id, event });
    }
    deps.model.touch(score);
    return Object.freeze({
      groupId: preview.id,
      toolId: preview.toolId,
      createdIds: Object.freeze(created.map(item => item.event.id)),
      count: created.length
    });
  }

  return Object.freeze({
    GROUPS,
    TOOLS,
    TOOL_BY_ID,
    normalizeState,
    selectionContext,
    toolAvailability,
    toolsForContext,
    updateState,
    guidedPlan,
    detectKey,
    chordName,
    identifyChords,
    parallelMotion,
    rhythmComplexity,
    analysisPreview,
    compositionPreview,
    harmonyPreview,
    applyPreview
  });
});
