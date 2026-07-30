(function (root, factory) {
  const dependencies = {
    model: root.AirmonScoreModel || (typeof require === 'function' ? require('./score-model') : null),
    editing: root.AirmonEditing || (typeof require === 'function' ? require('./editing') : null),
    theory: root.AirmonMusicTheory || (typeof require === 'function' ? require('./music-theory') : null)
  };
  const api = factory(dependencies);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AirmonProfessionalEditing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';

  if (!deps.model || !deps.editing || !deps.theory) throw new Error('Professional editing dependencies are unavailable.');

  const INPUT_MODES = Object.freeze([
    'duration-before-pitch', 'pitch-before-duration', 'rhythm-first', 'repitch'
  ]);
  const WRITE_MODES = Object.freeze(['insert', 'overwrite']);
  const ACCIDENTALS = Object.freeze(['auto', 'natural', 'sharp', 'flat', 'double-sharp', 'double-flat']);
  const DURATIONS = Object.freeze([8, 6, 4, 3, 2, 1.5, 1, .75, .5, .375, .25, .1875, .125, .0625]);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const uniqueNumbers = values => [...new Set((Array.isArray(values) ? values : [values])
    .map(Number).filter(Number.isFinite).map(value => Math.round(value)))];

  function nearestDuration(value) {
    const requested = Math.max(.0625, Number(value) || 1);
    return DURATIONS.reduce((best, candidate) =>
      Math.abs(candidate - requested) < Math.abs(best - requested) ? candidate : best, DURATIONS[0]);
  }

  function normalizeInputState(value = {}) {
    const mode = INPUT_MODES.includes(value.mode) ? value.mode : 'duration-before-pitch';
    const writeMode = WRITE_MODES.includes(value.writeMode) ? value.writeMode : 'insert';
    const accidental = ACCIDENTALS.includes(value.accidental) ? value.accidental : 'auto';
    return Object.freeze({
      active: Boolean(value.active),
      mode,
      writeMode,
      voice: Math.round(clamp(value.voice || 1, 1, 4)),
      duration: nearestDuration(value.duration),
      dots: Math.round(clamp(value.dots, 0, 2)),
      accidental,
      articulation: String(value.articulation || ''),
      partId: value.partId || null,
      staff: value.staff || null,
      rest: Boolean(value.rest),
      grace: Boolean(value.grace),
      cue: Boolean(value.cue),
      tuplet: value.tuplet && Number(value.tuplet.actual) > 1
        ? Object.freeze({
            actual: Math.round(clamp(value.tuplet.actual, 2, 32)),
            normal: Math.round(clamp(value.tuplet.normal || 2, 1, 32)),
            level: Math.round(clamp(value.tuplet.level || 1, 1, 8))
          })
        : null
    });
  }

  function dottedDuration(base, dots = 0) {
    const value = Math.max(.0625, Number(base) || 1);
    let total = value;
    let add = value / 2;
    for (let index = 0; index < Math.max(0, Math.min(2, Number(dots) || 0)); index += 1) {
      total += add;
      add /= 2;
    }
    return total;
  }

  function chordInput(score, partId, midis, options = {}) {
    const pitches = uniqueNumbers(midis).filter(value => value >= 0 && value <= 127).sort((a, b) => a - b);
    if (!pitches.length) throw new Error('At least one MIDI pitch is required.');
    const state = normalizeInputState(options);
    const start = Math.max(0, Number(options.start) || 0);
    const duration = dottedDuration(state.duration, state.dots);
    const common = {
      start,
      duration,
      voice: state.voice,
      staff: state.staff,
      grace: state.grace,
      cue: state.cue,
      tuplet: state.tuplet,
      velocity: clamp(options.velocity || 88, 1, 127),
      allowChord: true,
      inputSource: options.inputSource || 'professional-input'
    };
    const anchor = deps.model.addNote(score, partId, { ...common, midi: pitches[0], deferNormalize: true });
    const events = [anchor];
    for (const midi of pitches.slice(1)) {
      const event = deps.model.addChordTone(score, partId, anchor.id, midi, { ...common, deferNormalize: true });
      if (event && !events.some(item => item.id === event.id)) events.push(event);
    }
    const part = score.parts.find(item => item.id === partId);
    deps.model.normalizeEvents(part);
    deps.model.normalizeChordIds(part);
    deps.model.touch(score);
    const members = deps.model.chordMembers(score, anchor.id);
    return Object.freeze({
      chordId: anchor.chordId || members[0]?.chordId || null,
      anchorId: anchor.id,
      eventIds: Object.freeze(members.map(item => item.id)),
      pitches: Object.freeze(members.map(item => item.midi).sort((a, b) => a - b)),
      start,
      duration,
      voice: state.voice,
      staff: state.staff
    });
  }

  function transposeEntries(score, entries, semitones = 0, options = {}) {
    const delta = Math.round(Number(semitones) || 0);
    const changed = [];
    const diatonic = Boolean(options.diatonic);
    for (const entry of entries || []) {
      const part = entry.part || score.parts.find(item => item.id === entry.partId);
      const event = entry.event || part?.events.find(item => item.id === entry.eventId);
      if (!part || !event || event.type !== 'note') continue;
      const nextMidi = clamp(event.midi + delta, 0, 127);
      const patch = { midi: nextMidi };
      if (diatonic && event.pitch) {
        const parsed = deps.theory.parsePitch(event.pitch);
        const stepDelta = Math.sign(delta);
        const letters = deps.theory.LETTERS || ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        const index = letters.indexOf(parsed.letter);
        const nextLetter = letters[(index + stepDelta + 7) % 7];
        patch.pitch = deps.theory.spellMidiForKey(nextMidi, options.key || score.settings.key || 'C', nextLetter);
      }
      deps.model.updateEvent(score, part.id, event.id, patch);
      changed.push(event.id);
    }
    return changed;
  }

  function moveEntriesToStaff(score, entries, staff, options = {}) {
    const destination = String(staff || '').trim();
    if (!destination) throw new Error('A destination staff is required.');
    const ids = [];
    for (const entry of entries || []) {
      const part = entry.part || score.parts.find(item => item.id === entry.partId);
      const event = entry.event || part?.events.find(item => item.id === entry.eventId);
      if (!part || !event) continue;
      const patch = { staff: destination };
      if (options.voice != null) patch.voice = Math.round(clamp(options.voice, 1, 4));
      deps.model.updateEvent(score, part.id, event.id, patch);
      ids.push(event.id);
    }
    return ids;
  }

  function exchangeVoices(score, entries, voiceA = 1, voiceB = 2) {
    const a = Math.round(clamp(voiceA, 1, 4));
    const b = Math.round(clamp(voiceB, 1, 4));
    if (a === b) return [];
    const changed = [];
    for (const entry of entries || []) {
      const part = entry.part || score.parts.find(item => item.id === entry.partId);
      const event = entry.event || part?.events.find(item => item.id === entry.eventId);
      if (!part || !event || ![a, b].includes(Number(event.voice || 1))) continue;
      deps.model.updateEvent(score, part.id, event.id, { voice: Number(event.voice || 1) === a ? b : a });
      changed.push(event.id);
    }
    return changed;
  }

  function fillRangeWithRests(score, partId, options = {}) {
    const voice = Math.round(clamp(options.voice || 1, 1, 4));
    const staff = options.staff || null;
    const start = Math.max(0, Number(options.start) || 0);
    const end = Math.max(start, Number(options.end) || start);
    const part = score.parts.find(item => item.id === partId);
    if (!part) throw new Error('Part not found');
    const authored = part.events
      .filter(event => event.generatedBy !== 'gap-fill' && (event.voice || 1) === voice && (!staff || event.staff === staff))
      .map(event => ({ start: event.start, end: event.start + event.duration }))
      .sort((a, b) => a.start - b.start);
    const gaps = [];
    let cursor = start;
    for (const occupied of authored) {
      if (occupied.end <= start || occupied.start >= end) continue;
      if (occupied.start > cursor) gaps.push([cursor, Math.min(occupied.start, end)]);
      cursor = Math.max(cursor, occupied.end);
      if (cursor >= end) break;
    }
    if (cursor < end) gaps.push([cursor, end]);
    const rests = [];
    for (const [gapStart, gapEnd] of gaps) {
      let position = gapStart;
      for (const duration of deps.model.decomposeDuration(gapEnd - gapStart)) {
        rests.push(deps.model.addRest(score, partId, {
          start: position, duration, voice, staff, generated: false
        }));
        position += duration;
      }
    }
    return rests;
  }

  function selectionSummary(entries = []) {
    const normalized = (entries || []).filter(entry => entry?.event);
    const eventIds = normalized.map(entry => entry.event.id);
    const starts = normalized.map(entry => Number(entry.event.start) || 0);
    const ends = normalized.map(entry => (Number(entry.event.start) || 0) + (Number(entry.event.duration) || 0));
    return Object.freeze({
      count: eventIds.length,
      eventIds: Object.freeze(eventIds),
      partIds: Object.freeze([...new Set(normalized.map(entry => entry.part.id))]),
      voices: Object.freeze([...new Set(normalized.map(entry => Number(entry.event.voice) || 1))].sort()),
      staves: Object.freeze([...new Set(normalized.map(entry => entry.event.staff || null))]),
      start: starts.length ? Math.min(...starts) : null,
      end: ends.length ? Math.max(...ends) : null,
      containsChord: normalized.some(entry => Boolean(entry.event.chordId)),
      containsLyrics: normalized.some(entry => Array.isArray(entry.event.lyrics) && entry.event.lyrics.length)
    });
  }

  function escapeTransition(context = {}) {
    if (context.textEditing) return Object.freeze({ action: 'exit-text-edit', clearSelection: false, stopPlayback: false });
    if (context.inputActive || context.unfinishedInput) return Object.freeze({ action: 'cancel-input', clearSelection: false, stopPlayback: false });
    if (context.selectionCount > 0) return Object.freeze({ action: 'clear-selection', clearSelection: true, stopPlayback: false });
    return Object.freeze({ action: 'neutral', clearSelection: false, stopPlayback: false });
  }

  return Object.freeze({
    INPUT_MODES,
    WRITE_MODES,
    ACCIDENTALS,
    DURATIONS,
    nearestDuration,
    normalizeInputState,
    dottedDuration,
    chordInput,
    transposeEntries,
    moveEntriesToStaff,
    exchangeVoices,
    fillRangeWithRests,
    selectionSummary,
    escapeTransition
  });
});
