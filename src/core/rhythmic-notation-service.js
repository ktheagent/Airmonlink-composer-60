(function (root, factory) {
  const dependencies = {
    model: root.AirmonScoreModel || (typeof require === 'function' ? require('./score-model') : null),
    notationSystem: root.AirmonNotationSystem || (typeof require === 'function' ? require('./notation-system-service') : null),
    notations: root.AirmonNotations || (typeof require === 'function' ? require('./notations') : null)
  };
  const api = factory(dependencies);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AirmonRhythmicNotation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';

  if (!deps.model || !deps.notations) throw new Error('Rhythmic notation dependencies are unavailable.');

  const EPSILON = 1e-8;
  const clampVoice = value => Math.max(1, Math.min(4, Number(value) || 1));

  function recoverable(message, code = 'RHYTHMIC_NOTATION_CONTEXT') {
    const error = new Error(message);
    error.code = code;
    error.recoverable = true;
    return error;
  }

  function resolveEntries(score, supplied, types = ['note', 'rest']) {
    const result = [];
    const seen = new Set();
    for (const item of Array.isArray(supplied) ? supplied : []) {
      let ref = null;
      if (item?.part && item?.event) ref = { part: item.part, event: item.event };
      else if (item?.event && item?.partId) {
        const candidate = deps.model.findEvent(score, item.event.id);
        if (candidate?.part?.id === item.partId) ref = candidate;
      } else {
        ref = deps.model.findEvent(score, item?.eventId || item?.id || item);
      }
      if (!ref || !types.includes(ref.event.type) || ref.event.generatedBy === 'gap-fill') continue;
      if (seen.has(String(ref.event.id))) continue;
      seen.add(String(ref.event.id));
      result.push({ part: ref.part, event: ref.event });
    }
    return result.sort((a, b) =>
      Number(a.event.start) - Number(b.event.start) ||
      Number(a.event.voice || 1) - Number(b.event.voice || 1) ||
      Number(a.event.midi || 0) - Number(b.event.midi || 0) ||
      String(a.event.id).localeCompare(String(b.event.id))
    );
  }

  function laneKey(entry) {
    return `${entry.part.id}|${clampVoice(entry.event.voice)}|${entry.event.staff || ''}`;
  }

  function requireSingleLane(entries, purpose) {
    if (!entries.length) throw recoverable(`Select staff events before ${purpose}.`);
    const keys = new Set(entries.map(laneKey));
    if (keys.size !== 1) {
      throw recoverable(`${purpose} requires events from one part, one staff and one voice.`, 'RHYTHMIC_NOTATION_LANE');
    }
    return {
      part: entries[0].part,
      voice: clampVoice(entries[0].event.voice),
      staff: entries[0].event.staff || null
    };
  }

  function onsetGroups(entries) {
    const groups = [];
    for (const entry of entries) {
      const start = Number(entry.event.start) || 0;
      let group = groups.find(item => Math.abs(item.start - start) < EPSILON);
      if (!group) {
        group = { start, entries: [], duration: Number(entry.event.duration) || 1 };
        groups.push(group);
      }
      group.entries.push(entry);
      group.duration = Math.max(group.duration, Number(entry.event.duration) || 1);
    }
    return groups.sort((a, b) => a.start - b.start);
  }

  function writtenDuration(event) {
    const duration = Math.max(EPSILON, Number(event?.duration) || 1);
    const actual = Number(event?.tuplet?.actual);
    const normal = Number(event?.tuplet?.normal);
    return actual > 0 && normal > 0 ? duration * actual / normal : duration;
  }

  function beamLevelCount(event) {
    const duration = writtenDuration(event);
    if (duration <= 0.0625 + EPSILON) return 4;
    if (duration <= 0.125 + EPSILON) return 3;
    if (duration <= 0.25 + EPSILON) return 2;
    if (duration <= 0.5 + EPSILON) return 1;
    return 0;
  }

  function sameStaff(a, b) {
    return (a || null) === (b || null);
  }

  function overlaps(startA, endA, startB, endB) {
    return startA < endB - EPSILON && startB < endA - EPSILON;
  }

  function normalizeTupletRatio(actual = 3, normal = 2) {
    const actualCount = Math.max(2, Math.min(32, Math.round(Number(actual) || 3)));
    const normalCount = Math.max(1, Math.min(32, Math.round(Number(normal) || 2)));
    if (actualCount === normalCount) throw recoverable('Tuplet ratio must change the written duration.');
    return { actual: actualCount, normal: normalCount };
  }

  function preflightTuplet(score, supplied, actual = 3, normal = 2) {
    const entries = resolveEntries(score, supplied);
    const lane = requireSingleLane(entries, 'applying a tuplet');
    const ratio = normalizeTupletRatio(actual, normal);
    const groups = onsetGroups(entries);
    if (groups.length !== ratio.actual) {
      throw recoverable(
        `Select exactly ${ratio.actual} rhythmic positions for a ${ratio.actual}:${ratio.normal} tuplet. Chord tones at one onset count as one position.`,
        'RHYTHMIC_NOTATION_TUPLET_COUNT'
      );
    }

    const baseDuration = writtenDuration(groups[0].entries[0].event);
    if (groups.some(group => group.entries.some(entry => Math.abs(writtenDuration(entry.event) - baseDuration) > EPSILON))) {
      throw recoverable('The selected tuplet positions must use one written note value.', 'RHYTHMIC_NOTATION_TUPLET_VALUE');
    }

    const firstStart = groups[0].start;
    const targetDuration = baseDuration * ratio.normal / ratio.actual;
    const targetEnd = firstStart + targetDuration * ratio.actual;
    const firstMeasure = deps.model.measureIndexAt(score, firstStart);
    const bounds = deps.model.measureBounds(score, firstMeasure);
    if (targetEnd > bounds.end + EPSILON) {
      throw recoverable('A tuplet cannot cross this barline. Select positions contained in one measure.', 'RHYTHMIC_NOTATION_TUPLET_BARLINE');
    }

    const selectedIds = new Set(entries.map(entry => String(entry.event.id)));
    const authored = (lane.part.events || []).filter(event => event.generatedBy !== 'gap-fill' && !selectedIds.has(String(event.id)));
    const updates = [];
    groups.forEach((group, groupIndex) => {
      const start = firstStart + groupIndex * targetDuration;
      for (const [entryIndex, entry] of group.entries.entries()) {
        const collision = authored.find(other => {
          if (clampVoice(other.voice) !== lane.voice || !sameStaff(other.staff, lane.staff)) return false;
          return overlaps(start, start + targetDuration, Number(other.start), Number(other.start) + Number(other.duration));
        });
        if (collision) {
          throw recoverable(
            `The tuplet would overlap music at beat ${Number(collision.start) + 1}. Move or select the conflicting event first.`,
            'RHYTHMIC_NOTATION_TUPLET_COLLISION'
          );
        }
        updates.push({
          entry,
          start,
          duration: targetDuration,
          tuplet: {
            id: `tuplet-${entry.part.id}-${lane.voice}-${Math.round(firstStart * 1000000)}-${ratio.actual}-${ratio.normal}`,
            actual: ratio.actual,
            normal: ratio.normal,
            level: 1,
            number: 1,
            bracket: true,
            placement: 'auto',
            start: groupIndex === 0 && entryIndex === 0,
            stop: groupIndex === groups.length - 1 && entryIndex === 0,
            baseDuration
          }
        });
      }
    });
    return Object.freeze({
      ...ratio,
      lane: Object.freeze({ partId: lane.part.id, voice: lane.voice, staff: lane.staff }),
      firstStart,
      targetEnd,
      baseDuration,
      targetDuration,
      groups: Object.freeze(groups.map(group => Object.freeze({
        start: group.start,
        eventIds: Object.freeze(group.entries.map(entry => String(entry.event.id)))
      }))),
      updates: Object.freeze(updates)
    });
  }

  function applyTuplet(score, supplied, actual = 3, normal = 2) {
    const plan = preflightTuplet(score, supplied, actual, normal);
    const touchedParts = new Set();
    for (const update of plan.updates) {
      update.entry.event.start = update.start;
      update.entry.event.duration = update.duration;
      update.entry.event.tuplet = { ...update.tuplet };
      update.entry.event.beam = [];
      touchedParts.add(update.entry.part);
    }
    for (const part of touchedParts) {
      deps.model.normalizeEvents(part);
      deps.model.normalizeChordIds(part);
    }
    deps.model.touch(score);
    applyManualBeam(score, plan.updates.map(update => update.entry), { preserveTouch: true });
    return plan;
  }

  function meterGroups(timeSignature = '4/4') {
    const raw = String(timeSignature || '4/4').trim();
    const first = raw.split(/\s*(?:,|\|)\s*/)[0];
    const match = first.match(/^(\d+(?:\+\d+)*)\/(\d+)$/);
    if (!match) return [1, 1, 1, 1];
    const denominator = Number(match[2]);
    const explicit = match[1].split('+').map(Number);
    if (explicit.length > 1) return explicit.map(value => value * 4 / denominator);
    const numerator = explicit[0];
    if (denominator === 8 && numerator > 3 && numerator % 3 === 0) {
      return Array.from({ length: numerator / 3 }, () => 1.5);
    }
    return Array.from({ length: numerator }, () => 4 / denominator);
  }

  function groupBoundaryForBeat(bounds, beat) {
    const groups = meterGroups(bounds.timeSignature);
    const local = Math.max(0, Number(beat) - bounds.start);
    let cursor = 0;
    for (let index = 0; index < groups.length; index += 1) {
      const start = cursor;
      cursor += groups[index];
      if (local < cursor - EPSILON || index === groups.length - 1) {
        return { index, start: bounds.start + start, end: bounds.start + cursor };
      }
    }
    return { index: groups.length - 1, start: bounds.start, end: bounds.end };
  }

  function beamAssignmentsForRun(run) {
    const assignments = new Map();
    const maxLevel = Math.max(0, ...run.flatMap(group => group.entries.map(entry => beamLevelCount(entry.event))));
    if (run.length < 2 || maxLevel < 1) return assignments;

    for (let level = 1; level <= maxLevel; level += 1) {
      const qualified = run.map((group, index) => ({
        group,
        index,
        qualifies: group.entries.some(entry => beamLevelCount(entry.event) >= level)
      }));
      let cursor = 0;
      while (cursor < qualified.length) {
        while (cursor < qualified.length && !qualified[cursor].qualifies) cursor += 1;
        if (cursor >= qualified.length) break;
        const start = cursor;
        while (cursor + 1 < qualified.length && qualified[cursor + 1].qualifies) cursor += 1;
        const end = cursor;
        const length = end - start + 1;
        for (let index = start; index <= end; index += 1) {
          let value;
          if (length === 1) value = index === run.length - 1 ? 'backward hook' : 'forward hook';
          else if (index === start) value = 'begin';
          else if (index === end) value = 'end';
          else value = 'continue';
          for (const entry of qualified[index].group.entries) {
            if (beamLevelCount(entry.event) < level) continue;
            if (!assignments.has(String(entry.event.id))) assignments.set(String(entry.event.id), []);
            assignments.get(String(entry.event.id)).push({ number: level, value });
          }
        }
        cursor += 1;
      }
    }
    return assignments;
  }

  function selectedBeamRuns(score, supplied, options = {}) {
    const entries = resolveEntries(score, supplied, ['note']);
    const lane = requireSingleLane(entries, options.automatic ? 'applying automatic beaming' : 'beaming selected notes');
    const groups = onsetGroups(entries);
    if (groups.length < 2) throw recoverable('Select at least two short-note positions to create a beam.', 'RHYTHMIC_NOTATION_BEAM_COUNT');
    if (groups.some(group => group.entries.some(entry => beamLevelCount(entry.event) < 1))) {
      throw recoverable('Only eighth notes and shorter values can be beamed.', 'RHYTHMIC_NOTATION_BEAM_VALUE');
    }

    const runs = [];
    let current = [];
    let previousEnd = null;
    let previousBoundary = null;
    for (const group of groups) {
      const measureIndex = deps.model.measureIndexAt(score, group.start);
      const bounds = deps.model.measureBounds(score, measureIndex);
      const boundary = groupBoundaryForBeat(bounds, group.start);
      const contiguous = previousEnd == null || group.start <= previousEnd + EPSILON;
      const sameBoundary = previousBoundary &&
        previousBoundary.measureIndex === measureIndex &&
        previousBoundary.index === boundary.index;
      const shouldBreak = current.length && (
        (options.automatic && !sameBoundary) ||
        !contiguous ||
        (!options.automatic && previousBoundary?.measureIndex !== measureIndex)
      );
      if (shouldBreak) {
        if (current.length) runs.push(current);
        current = [];
      }
      current.push(group);
      previousEnd = Math.max(...group.entries.map(entry => Number(entry.event.start) + Number(entry.event.duration)));
      previousBoundary = { ...boundary, measureIndex };
    }
    if (current.length) runs.push(current);
    if (!options.automatic && runs.length !== 1) {
      throw recoverable('A manual beam group must be contiguous and remain within one measure.', 'RHYTHMIC_NOTATION_BEAM_RANGE');
    }
    return { entries, lane, groups, runs };
  }

  function applyBeamAssignments(score, entries, assignments, preserveTouch = false) {
    for (const entry of entries) entry.event.beam = assignments.get(String(entry.event.id)) || [];
    if (!preserveTouch) deps.model.touch(score);
    return entries.length;
  }

  function applyManualBeam(score, supplied, options = {}) {
    const context = selectedBeamRuns(score, supplied, { automatic: false });
    const assignments = beamAssignmentsForRun(context.runs[0]);
    if (![...assignments.values()].some(items => items.some(item => item.number === 1 && ['begin', 'continue', 'end'].includes(item.value)))) {
      throw recoverable('The selected notes do not form a complete beam group.', 'RHYTHMIC_NOTATION_BEAM_GROUP');
    }
    applyBeamAssignments(score, context.entries, assignments, options.preserveTouch === true);
    return Object.freeze({ eventIds: Object.freeze(context.entries.map(entry => String(entry.event.id))), assignments });
  }

  function applyAutomaticBeams(score, supplied) {
    const context = selectedBeamRuns(score, supplied, { automatic: true });
    const assignments = new Map();
    for (const run of context.runs) {
      if (run.length < 2) continue;
      for (const [id, values] of beamAssignmentsForRun(run)) assignments.set(id, values);
    }
    applyBeamAssignments(score, context.entries, assignments);
    return Object.freeze({
      eventIds: Object.freeze(context.entries.map(entry => String(entry.event.id))),
      beamedEventIds: Object.freeze([...assignments.keys()]),
      assignments
    });
  }

  function clearBeams(score, supplied) {
    const entries = resolveEntries(score, supplied, ['note']);
    if (!entries.length) throw recoverable('Select beamed notes before removing beams.');
    for (const entry of entries) entry.event.beam = [];
    deps.model.touch(score);
    return entries.length;
  }

  function tiePair(score, supplied) {
    const entries = resolveEntries(score, supplied, ['note']);
    if (entries.length !== 2) throw recoverable('Select exactly two notes to create a tie.');
    requireSingleLane(entries, 'creating a tie');
    const [start, end] = entries;
    if (Number(start.event.midi) !== Number(end.event.midi)) {
      throw recoverable('A tie must connect the same pitch.', 'RHYTHMIC_NOTATION_TIE_PITCH');
    }
    const expected = Number(start.event.start) + Number(start.event.duration);
    if (Math.abs(Number(end.event.start) - expected) > EPSILON) {
      throw recoverable('A tie must connect adjacent notes with no rhythmic gap.', 'RHYTHMIC_NOTATION_TIE_GAP');
    }
    return { start, end };
  }

  function createTie(score, supplied, options = {}) {
    const pair = tiePair(score, supplied);
    return deps.model.addTie(score, pair.start.event.id, pair.end.event.id, {
      direction: options.direction || 'auto',
      generated: Boolean(options.generated)
    });
  }

  function slurRange(score, supplied) {
    const entries = resolveEntries(score, supplied, ['note']);
    if (entries.length < 2) throw recoverable('Select two or more notes to create a slur.');
    requireSingleLane(entries, 'creating a slur');
    const groups = onsetGroups(entries);
    if (groups.length < 2) throw recoverable('A slur must span at least two rhythmic positions.');
    return { entries, start: groups[0].entries[0], end: groups.at(-1).entries[0] };
  }

  function createSlur(score, supplied, options = {}) {
    const range = slurRange(score, supplied);
    return deps.model.addSlur(score, range.start.event.id, range.end.event.id, {
      direction: options.direction || 'auto',
      generated: Boolean(options.generated)
    });
  }

  function stemDirection(event, laneEvents = []) {
    const explicit = event?.notation?.stem;
    if (explicit === 'up' || explicit === 'down' || explicit === 'none') return explicit;
    const voice = clampVoice(event?.voice);
    const simultaneousVoices = new Set((laneEvents || [])
      .filter(other => Math.abs(Number(other.start) - Number(event.start)) < EPSILON)
      .map(other => clampVoice(other.voice)));
    if (simultaneousVoices.size > 1 || voice > 1) return voice % 2 === 1 ? 'up' : 'down';
    return Number(event?.midi ?? 60) < 71 ? 'up' : 'down';
  }

  function spannerDirection(spanner, startEvent, endEvent, laneEvents = []) {
    if (spanner?.direction === 'above' || spanner?.direction === 'below') return spanner.direction;
    const stem = stemDirection(startEvent, laneEvents);
    if (spanner?.type === 'tie') return stem === 'up' ? 'below' : 'above';
    return stem === 'up' ? 'below' : 'above';
  }

  function beamGroups(events = [], beamNumber = 1) {
    const entries = (events || []).filter(event => event?.type === 'note' && Array.isArray(event.beam))
      .sort((a, b) => Number(a.start) - Number(b.start) || Number(a.midi) - Number(b.midi));
    const onset = onsetGroups(entries.map(event => ({ part: { id: '' }, event })));
    const groups = [];
    let current = [];
    for (const group of onset) {
      const anchor = group.entries[0].event;
      const mark = (anchor.beam || []).find(item => Number(item.number) === Number(beamNumber));
      const value = mark?.value || '';
      if (value === 'begin') {
        if (current.length) groups.push(current);
        current = [group.entries.map(entry => entry.event)];
      } else if (value === 'continue' && current.length) {
        current.push(group.entries.map(entry => entry.event));
      } else if (value === 'end' && current.length) {
        current.push(group.entries.map(entry => entry.event));
        groups.push(current);
        current = [];
      }
    }
    if (current.length > 1) groups.push(current);
    return groups;
  }

  function tupletGroups(events = []) {
    const byId = new Map();
    for (const event of events || []) {
      if (!event?.tuplet) continue;
      const id = String(event.tuplet.id || `tuplet-${event.tuplet.actual}-${event.tuplet.normal}-${event.start}`);
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push(event);
    }
    return [...byId.entries()].map(([id, members]) => ({
      id,
      actual: Number(members[0].tuplet.actual) || 3,
      normal: Number(members[0].tuplet.normal) || 2,
      bracket: members[0].tuplet.bracket !== false,
      placement: members[0].tuplet.placement || 'auto',
      members: members.sort((a, b) => Number(a.start) - Number(b.start) || Number(a.midi || 0) - Number(b.midi || 0))
    }));
  }

  return Object.freeze({
    EPSILON,
    resolveEntries,
    onsetGroups,
    writtenDuration,
    beamLevelCount,
    normalizeTupletRatio,
    preflightTuplet,
    applyTuplet,
    meterGroups,
    applyManualBeam,
    applyAutomaticBeams,
    clearBeams,
    tiePair,
    createTie,
    slurRange,
    createSlur,
    stemDirection,
    spannerDirection,
    beamGroups,
    tupletGroups
  });
});
