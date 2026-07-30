(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AirmonStaffInput = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const EPSILON = 1e-8;
  const DURATION_BY_DENOMINATOR = Object.freeze({
    1: 4,
    2: 2,
    4: 1,
    8: 0.5,
    16: 0.25,
    32: 0.125,
    64: 0.0625
  });

  function clampVoice(value) {
    return Math.max(1, Math.min(4, Number(value) || 1));
  }

  function normalizeDuration(value) {
    const duration = Number(value);
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error('Choose a valid note value before entering music.');
    }
    return Math.max(0.0625, duration);
  }

  function durationFromDenominator(value) {
    return DURATION_BY_DENOMINATOR[Number(value)] || 1;
  }

  function durationName(value) {
    const duration = normalizeDuration(value);
    const names = new Map([
      [4, 'whole'], [3, 'dotted half'], [2, 'half'], [1.5, 'dotted quarter'],
      [1, 'quarter'], [0.75, 'dotted eighth'], [0.5, 'eighth'],
      [0.375, 'dotted sixteenth'], [0.25, 'sixteenth'], [0.125, 'thirty-second'],
      [0.0625, 'sixty-fourth']
    ]);
    return names.get(duration) || `${duration} beat`;
  }

  function applyDurationModifier(baseDuration, options = {}) {
    let duration = normalizeDuration(baseDuration);
    if (options.dotted) duration *= 1.5;
    if (options.triplet) duration *= 2 / 3;
    return Math.max(0.0625, duration);
  }

  function pitchFromLetter(letter, octave = 4, accidental = '') {
    const normalizedLetter = String(letter || '').trim().toUpperCase();
    if (!/^[A-G]$/.test(normalizedLetter)) {
      throw new Error('Choose a pitch from A through G.');
    }
    const safeOctave = Math.max(0, Math.min(8, Math.round(Number(octave) || 4)));
    const safeAccidental = accidental === '#' || accidental === 'b' ? accidental : '';
    return `${normalizedLetter}${safeAccidental}${safeOctave}`;
  }

  function ensureCapacity(model, score, endBeat) {
    if (!model?.totalBeats || !model?.appendMeasures) {
      throw new Error('The score timeline service is unavailable.');
    }
    const target = Math.max(0, Number(endBeat) || 0);
    let added = 0;
    while (model.totalBeats(score) < target - EPSILON) {
      model.appendMeasures(score, 1);
      added += 1;
      if (added > 512) throw new Error('The requested entry is too long for automatic measure creation.');
    }
    return added;
  }

  function planSegments(model, score, startBeat, duration) {
    if (!model?.measureIndexAt || !model?.measureBounds || !model?.totalBeats) {
      throw new Error('The score measure service is unavailable.');
    }
    const start = Math.max(0, Number(startBeat) || 0);
    const totalDuration = normalizeDuration(duration);
    if (start + totalDuration > model.totalBeats(score) + EPSILON) {
      throw new Error('Add enough measures before planning this entry.');
    }

    const segments = [];
    let cursor = start;
    let remaining = totalDuration;
    let guard = 0;
    while (remaining > EPSILON) {
      if (guard++ > 1024) throw new Error('Unable to resolve the entry across measure boundaries.');
      const measureIndex = model.measureIndexAt(score, Math.min(cursor, Math.max(0, model.totalBeats(score) - EPSILON)));
      const bounds = model.measureBounds(score, measureIndex);
      const available = Math.max(0, bounds.end - cursor);
      if (available <= EPSILON) {
        cursor = bounds.end;
        continue;
      }
      const segmentDuration = Math.min(remaining, available);
      segments.push({
        index: segments.length,
        measureIndex,
        start: cursor,
        duration: segmentDuration,
        continuation: segments.length > 0,
        continues: remaining - segmentDuration > EPSILON
      });
      cursor += segmentDuration;
      remaining -= segmentDuration;
    }
    return segments;
  }

  function snapBeat(model, score, rawBeat, duration = 1) {
    if (!model?.snapBeat) return Math.max(0, Number(rawBeat) || 0);
    return Math.max(0, model.snapBeat(score, rawBeat, normalizeDuration(duration)));
  }

  function beatFromStaffPoint(options = {}) {
    const left = Number(options.left) || 0;
    const right = Number(options.right) || 1;
    const x = Math.max(left, Math.min(right, Number(options.x) || left));
    const start = Math.max(0, Number(options.systemStart) || 0);
    const end = Math.max(start, Number(options.systemEnd) || start);
    const ratio = right <= left ? 0 : (x - left) / (right - left);
    return start + ratio * (end - start);
  }

  function authoredEvents(score, partId = null) {
    const result = [];
    for (const part of score?.parts || []) {
      if (partId && part.id !== partId) continue;
      for (const event of part.events || []) {
        if (event.generatedBy === 'gap-fill' || event.hidden) continue;
        result.push({ part, event });
      }
    }
    return result.sort((a, b) =>
      Number(a.event.start) - Number(b.event.start) ||
      Number(a.event.voice || 1) - Number(b.event.voice || 1) ||
      String(a.event.id).localeCompare(String(b.event.id))
    );
  }

  function rangeEventIds(score, anchorId, targetId, options = {}) {
    const anchor = String(anchorId || '');
    const target = String(targetId || '');
    if (!anchor || !target) return target ? [target] : [];
    const entries = authoredEvents(score, options.partId || null);
    const anchorEntry = entries.find(item => String(item.event.id) === anchor);
    const targetEntry = entries.find(item => String(item.event.id) === target);
    if (!anchorEntry || !targetEntry || anchorEntry.part.id !== targetEntry.part.id) return [target];
    const voice = options.sameVoice === false ? null : Number(anchorEntry.event.voice) || 1;
    const staff = options.sameStaff === false ? undefined : (anchorEntry.event.staff || null);
    const start = Math.min(Number(anchorEntry.event.start), Number(targetEntry.event.start));
    const end = Math.max(
      Number(anchorEntry.event.start) + Number(anchorEntry.event.duration || 0),
      Number(targetEntry.event.start) + Number(targetEntry.event.duration || 0)
    );
    return entries
      .filter(item => item.part.id === anchorEntry.part.id)
      .filter(item => voice == null || Number(item.event.voice || 1) === voice)
      .filter(item => staff === undefined || (item.event.staff || null) === staff)
      .filter(item => Number(item.event.start) < end - EPSILON &&
        Number(item.event.start) + Number(item.event.duration || 0) > start + EPSILON)
      .map(item => String(item.event.id));
  }

  function contextSummary(model, score, cursor, voice = 1) {
    const measureIndex = model.measureIndexAt(score, cursor);
    const bounds = model.measureBounds(score, measureIndex);
    const beat = Math.max(0, Number(cursor) - bounds.start);
    return {
      measureIndex,
      measureNumber: measureIndex + 1,
      beat,
      beatLabel: Number.isInteger(beat) ? String(beat + 1) : (beat + 1).toFixed(2).replace(/0+$/, '').replace(/\.$/, ''),
      voice: clampVoice(voice),
      timeSignature: bounds.timeSignature
    };
  }

  return Object.freeze({
    EPSILON,
    DURATION_BY_DENOMINATOR,
    clampVoice,
    normalizeDuration,
    durationFromDenominator,
    durationName,
    applyDurationModifier,
    pitchFromLetter,
    ensureCapacity,
    planSegments,
    snapBeat,
    beatFromStaffPoint,
    authoredEvents,
    rangeEventIds,
    contextSummary
  });
});
