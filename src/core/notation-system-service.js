(function (root, factory) {
  const dependencies = {
    model: root.AirmonScoreModel || (typeof require === 'function' ? require('./score-model') : null),
    notations: root.AirmonNotations || (typeof require === 'function' ? require('./notations') : null)
  };
  const api = factory(dependencies);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AirmonNotationSystem = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';

  if (!deps.model || !deps.notations) throw new Error('Notation system dependencies are unavailable.');

  const BARLINES = Object.freeze(['single', 'double', 'final', 'dashed', 'dotted', 'repeat-start', 'repeat-end', 'repeat-both']);
  const NAVIGATION = Object.freeze(['segno', 'coda', 'fine', 'dc', 'ds', 'to-coda']);
  const NOTEHEADS = Object.freeze(['normal', 'cross', 'diamond', 'triangle', 'slash', 'x-circle', 'harmonic', 'cue']);
  const STEMS = Object.freeze(['auto', 'up', 'down', 'none']);
  const ACCIDENTALS = Object.freeze([
    'auto', 'natural', 'sharp', 'flat', 'double-sharp', 'double-flat',
    'quarter-sharp', 'quarter-flat', 'three-quarter-sharp', 'three-quarter-flat'
  ]);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

  function parseMeter(value = '4/4') {
    const raw = String(value || '4/4').trim();
    const alternating = raw.split(/\s*(?:,|\|)\s*/).filter(Boolean);
    const meters = alternating.map(token => {
      const match = token.match(/^(\d+(?:\+\d+)*)\/(\d+)$/);
      if (!match) throw new Error(`Invalid time signature: ${token}`);
      const groups = match[1].split('+').map(Number);
      const denominator = Number(match[2]);
      if (!groups.every(group => group > 0) || ![1, 2, 4, 8, 16, 32, 64].includes(denominator)) {
        throw new Error(`Unsupported time signature: ${token}`);
      }
      return Object.freeze({
        text: token,
        groups: Object.freeze(groups),
        numerator: groups.reduce((sum, group) => sum + group, 0),
        denominator,
        quarterBeats: groups.reduce((sum, group) => sum + group, 0) * 4 / denominator,
        additive: groups.length > 1
      });
    });
    return Object.freeze({
      text: raw,
      meters: Object.freeze(meters),
      alternating: meters.length > 1,
      primary: meters[0]
    });
  }

  function normalizeTuplet(value = {}) {
    const actual = Math.round(clamp(value.actual || 3, 2, 32));
    const normal = Math.round(clamp(value.normal || 2, 1, 32));
    const level = Math.round(clamp(value.level || 1, 1, 8));
    return Object.freeze({
      id: String(value.id || `tuplet-${actual}-${normal}-${level}`),
      actual,
      normal,
      level,
      bracket: value.bracket !== false,
      number: ['ratio', 'actual', 'none'].includes(value.number) ? value.number : 'ratio',
      placement: ['auto', 'above', 'below'].includes(value.placement) ? value.placement : 'auto'
    });
  }

  function normalizeAccidental(value = {}) {
    const type = ACCIDENTALS.includes(value.type) ? value.type : 'auto';
    const centsByType = {
      auto: 0, natural: 0, sharp: 100, flat: -100, 'double-sharp': 200, 'double-flat': -200,
      'quarter-sharp': 50, 'quarter-flat': -50, 'three-quarter-sharp': 150, 'three-quarter-flat': -150
    };
    return Object.freeze({
      type,
      cents: Number.isFinite(Number(value.cents)) ? clamp(value.cents, -200, 200) : centsByType[type],
      courtesy: Boolean(value.courtesy),
      editorial: Boolean(value.editorial),
      parenthesized: Boolean(value.parenthesized)
    });
  }

  function normalizeNotationPatch(value = {}) {
    return Object.freeze({
      notehead: NOTEHEADS.includes(value.notehead) ? value.notehead : 'normal',
      stem: STEMS.includes(value.stem) ? value.stem : 'auto',
      stemLength: value.stemLength == null ? null : clamp(value.stemLength, 0, 64),
      accidental: normalizeAccidental(value.accidental || {}),
      cue: Boolean(value.cue),
      grace: Boolean(value.grace),
      beam: ['auto', 'begin', 'continue', 'end', 'break'].includes(value.beam) ? value.beam : 'auto',
      tremolo: Math.round(clamp(value.tremolo || 0, 0, 4)),
      tuplet: value.tuplet ? normalizeTuplet(value.tuplet) : null
    });
  }

  function applyEventNotation(score, partId, eventId, patch = {}) {
    const ref = deps.model.findEvent(score, eventId);
    if (!ref || ref.part.id !== partId) throw new Error('Notation target was not found.');
    if (!['note', 'rest'].includes(ref.event.type)) throw new Error('Notation can only attach to a note or rest.');
    const notation = { ...(ref.event.notation || {}), ...normalizeNotationPatch(patch) };
    deps.model.updateEvent(score, partId, eventId, {
      notation,
      grace: patch.grace ?? ref.event.grace,
      tuplet: patch.tuplet ? normalizeTuplet(patch.tuplet) : ref.event.tuplet
    });
    return ref.event;
  }

  function attachMark(score, partId, eventId, mark = {}) {
    const ref = deps.model.findEvent(score, eventId);
    if (!ref || ref.part.id !== partId || ref.event.type !== 'note') throw new Error('Select a note before attaching a mark.');
    const type = String(mark.type || '').trim();
    const value = String(mark.value || '').trim();
    if (!type || !value) throw new Error('A mark type and value are required.');
    if (type === 'articulation') deps.notations.setArticulation(score, [eventId], value, mark.enabled !== false);
    else if (type === 'ornament') deps.notations.setOrnament(score, [eventId], value, mark.enabled !== false);
    else if (type === 'technical') deps.notations.setTechnical(score, [eventId], value, mark.enabled !== false);
    else if (type === 'fermata') deps.model.updateEvent(score, partId, eventId, { fermata: mark.enabled !== false });
    else throw new Error(`Unsupported mark type: ${type}`);
    return ref.event;
  }

  function setMeasureNavigation(score, measureIndex, value = {}) {
    const index = Math.max(0, Math.min(score.measures.length - 1, Math.round(Number(measureIndex) || 0)));
    const measure = score.measures[index];
    const barline = BARLINES.includes(value.barline) ? value.barline : (measure.barline || 'single');
    const navigation = Array.isArray(value.navigation)
      ? [...new Set(value.navigation.filter(item => NAVIGATION.includes(item)))]
      : [];
    measure.barline = barline;
    measure.repeatStart = ['repeat-start', 'repeat-both'].includes(barline) || Boolean(value.repeatStart);
    measure.repeatEnd = ['repeat-end', 'repeat-both'].includes(barline) || Boolean(value.repeatEnd);
    measure.repeatCount = Math.round(clamp(value.repeatCount || measure.repeatCount || measure.repeatTimes || 2, 2, 16));
    measure.repeatTimes = measure.repeatCount;
    measure.navigation = navigation;
    if (value.volta != null) {
      const endings = Array.isArray(value.volta) ? value.volta : [value.volta];
      measure.volta = [...new Set(endings.map(Number).filter(number => Number.isInteger(number) && number > 0 && number <= 16))];
    }
    deps.model.touch(score);
    return measure;
  }

  function automaticBeamGroups(events = [], meter = '4/4') {
    const parsed = parseMeter(meter).primary;
    const beatUnit = 4 / parsed.denominator;
    const boundaries = [];
    let cursor = 0;
    for (const group of parsed.groups) {
      cursor += group * beatUnit;
      boundaries.push(cursor);
    }
    const notes = events.filter(event => event.type === 'note' && event.duration < 1).sort((a, b) => a.start - b.start);
    return notes.map((event, index) => {
      const local = ((event.start % parsed.quarterBeats) + parsed.quarterBeats) % parsed.quarterBeats;
      const boundary = boundaries.some(value => Math.abs(local - value) < 1e-8);
      const next = notes[index + 1];
      const sameMeasureGroup = next && !boundaries.some(value => value > local && value <= ((next.start % parsed.quarterBeats) + parsed.quarterBeats) % parsed.quarterBeats);
      const value = boundary || index === 0 ? 'begin' : sameMeasureGroup ? 'continue' : 'end';
      return Object.freeze({ eventId: event.id, beam: value });
    });
  }

  function validateAttachments(score) {
    const eventIds = new Set(score.parts.flatMap(part => part.events.map(event => event.id)));
    const issues = [];
    for (const spanner of score.spanners || []) {
      if (!eventIds.has(spanner.startEventId)) issues.push({ severity: 'error', code: 'orphan-spanner-start', id: spanner.id });
      if (!eventIds.has(spanner.endEventId)) issues.push({ severity: 'error', code: 'orphan-spanner-end', id: spanner.id });
    }
    score.parts.forEach(part => part.events.forEach(event => {
      if (event.tuplet && (!event.tuplet.actual || !event.tuplet.normal)) {
        issues.push({ severity: 'error', code: 'invalid-tuplet', id: event.id });
      }
      if (event.notation?.accidental && !ACCIDENTALS.includes(event.notation.accidental.type)) {
        issues.push({ severity: 'error', code: 'invalid-accidental', id: event.id });
      }
    }));
    return Object.freeze(issues);
  }

  function navigationOrder(score) {
    const order = deps.model.playbackMeasureOrder(score);
    return Object.freeze(order.map((entry, playbackIndex) => {
      const measureIndex = typeof entry === 'number' ? entry : Number(entry?.measureIndex) || 0;
      return Object.freeze({
        playbackIndex,
        measureIndex,
        measureNumber: measureIndex + 1,
        pass: typeof entry === 'object' ? Number(entry.pass) || 1 : 1,
        marks: Object.freeze([...(score.measures[measureIndex]?.navigation || [])])
      });
    }));
  }

  return Object.freeze({
    BARLINES,
    NAVIGATION,
    NOTEHEADS,
    STEMS,
    ACCIDENTALS,
    parseMeter,
    normalizeTuplet,
    normalizeAccidental,
    normalizeNotationPatch,
    applyEventNotation,
    attachMark,
    setMeasureNavigation,
    automaticBeamGroups,
    validateAttachments,
    navigationOrder
  });
});
