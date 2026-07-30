(function (root, factory) {
  const dependencies = {
    model: root.AirmonScoreModel || (typeof require === 'function' ? require('./score-model') : null),
    layout: root.AirmonLayoutEngine || (typeof require === 'function' ? require('./layout-engine') : null)
  };
  const api = factory(dependencies);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AirmonPartsEngraving = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';

  if (!deps.model || !deps.layout) throw new Error('Parts and engraving dependencies are unavailable.');

  const STAFF_TYPES = Object.freeze([
    'standard-5', 'grand', 'percussion-1', 'percussion-5', 'tablature-6', 'tablature-4', 'ossia'
  ]);
  const BRACKETS = Object.freeze(['none', 'bracket', 'brace', 'square']);
  const TEMPLATES = Object.freeze({
    solo: Object.freeze(['violin']),
    piano: Object.freeze(['piano']),
    choir: Object.freeze(['soprano', 'alto', 'tenor', 'bass']),
    lead: Object.freeze(['soprano', 'piano']),
    chamber: Object.freeze(['violin', 'viola', 'cello', 'piano']),
    concertBand: Object.freeze(['flute', 'oboe', 'clarinet', 'saxophone', 'trumpet', 'horn', 'trombone', 'tuba', 'percussion']),
    brassBand: Object.freeze(['trumpet', 'horn', 'trombone', 'tuba', 'percussion']),
    orchestra: Object.freeze(['flute', 'oboe', 'clarinet', 'bassoon', 'horn', 'trumpet', 'trombone', 'tuba', 'percussion', 'violin', 'viola', 'cello', 'contrabass']),
    percussionEnsemble: Object.freeze(['percussion', 'percussion', 'percussion', 'percussion'])
  });
  const PAGE_SIZES = Object.freeze({
    A4: Object.freeze({ widthMm: 210, heightMm: 297 }),
    Letter: Object.freeze({ widthMm: 215.9, heightMm: 279.4 }),
    A3: Object.freeze({ widthMm: 297, heightMm: 420 }),
    A5: Object.freeze({ widthMm: 148, heightMm: 210 })
  });

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const slug = value => String(value || 'Part').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'Part';

  function templateDefinition(name = 'solo') {
    const key = Object.prototype.hasOwnProperty.call(TEMPLATES, name) ? name : 'solo';
    return Object.freeze({ name: key, instruments: Object.freeze([...TEMPLATES[key]]) });
  }

  function normalizeStaff(value = {}) {
    const type = STAFF_TYPES.includes(value.type) ? value.type : 'standard-5';
    return Object.freeze({
      id: String(value.id || `staff-${Math.random().toString(36).slice(2, 10)}`),
      type,
      lines: type === 'percussion-1' ? 1 : type.startsWith('tablature') ? Number(type.split('-')[1]) : 5,
      clef: String(value.clef || (type.startsWith('percussion') ? 'percussion' : type.startsWith('tablature') ? 'tab' : 'treble')),
      linkedTo: value.linkedTo || null,
      label: String(value.label || ''),
      abbreviation: String(value.abbreviation || ''),
      visible: value.visible !== false,
      cueSize: Boolean(value.cueSize),
      transposition: Math.round(clamp(value.transposition || 0, -36, 36))
    });
  }

  function normalizeInstrumentPart(part = {}) {
    const staves = Array.isArray(part.staves) && part.staves.length
      ? part.staves.map(normalizeStaff)
      : [normalizeStaff({ type: part.instrumentKey === 'piano' ? 'grand' : 'standard-5' })];
    return Object.freeze({
      id: String(part.id || ''),
      instrumentKey: String(part.instrumentKey || part.instrument || 'piano'),
      name: String(part.name || 'Instrument'),
      abbreviation: String(part.abbreviation || part.shortName || ''),
      family: String(part.family || 'other'),
      transposition: Math.round(clamp(part.transposition ?? part.transpose ?? 0, -36, 36)),
      writtenRange: Object.freeze({
        low: Math.round(clamp(part.writtenRange?.low ?? part.minPitch ?? 0, 0, 127)),
        high: Math.round(clamp(part.writtenRange?.high ?? part.maxPitch ?? 127, 0, 127))
      }),
      soundingRange: Object.freeze({
        low: Math.round(clamp(part.soundingRange?.low ?? ((part.minPitch ?? 0) + (part.transpose ?? 0)), 0, 127)),
        high: Math.round(clamp(part.soundingRange?.high ?? ((part.maxPitch ?? 127) + (part.transpose ?? 0)), 0, 127))
      }),
      bracket: BRACKETS.includes(part.bracket) ? part.bracket : 'none',
      group: String(part.group || ''),
      staves: Object.freeze(staves),
      voiceLayers: Object.freeze([1, 2, 3, 4])
    });
  }

  function applyTemplate(score, name, options = {}) {
    const definition = templateDefinition(name);
    const parts = definition.instruments.map((instrumentKey, index) => deps.model.createPart(instrumentKey, {
      name: options.names?.[index],
      voiceLayers: [1, 2, 3, 4]
    }));
    score.parts = parts;
    score.ensemble = {
      template: definition.name,
      appliedAt: options.appliedAt || new Date().toISOString(),
      custom: false
    };
    deps.model.normalizeScore(score);
    deps.model.touch(score);
    return Object.freeze(parts.map(part => normalizeInstrumentPart(part)));
  }

  function reorderParts(score, orderedIds = []) {
    const rank = new Map(orderedIds.map((id, index) => [id, index]));
    const original = new Map(score.parts.map((part, index) => [part.id, index]));
    score.parts.sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : orderedIds.length + original.get(a.id)) -
      (rank.has(b.id) ? rank.get(b.id) : orderedIds.length + original.get(b.id)));
    deps.model.touch(score);
    return Object.freeze(score.parts.map(part => part.id));
  }

  function linkedPartDescriptors(score, options = {}) {
    score.linkedParts ||= [];
    const includeScore = options.includeScore !== false;
    const descriptors = score.parts.map(part => {
      const existing = score.linkedParts.find(item => item.sourcePartIds?.length === 1 && item.sourcePartIds[0] === part.id);
      return {
        id: existing?.id || `linked-${part.id}`,
        name: existing?.name || part.name,
        sourcePartIds: [part.id],
        transposition: Number(part.transposition) || 0,
        layout: {
          pageSize: existing?.layout?.pageSize || options.pageSize || 'A4',
          orientation: existing?.layout?.orientation || 'portrait',
          marginsMm: existing?.layout?.marginsMm || { top: 15, right: 15, bottom: 15, left: 15 },
          staffSize: existing?.layout?.staffSize || 1,
          multiMeasureRests: existing?.layout?.multiMeasureRests !== false
        },
        overrides: existing?.overrides || {},
        generated: false
      };
    });
    if (includeScore) descriptors.unshift({
      id: 'conductor-score',
      name: options.scoreName || 'Conductor Score',
      sourcePartIds: score.parts.map(part => part.id),
      transposition: 0,
      layout: {
        pageSize: options.scorePageSize || 'A4',
        orientation: options.scoreOrientation || 'portrait',
        marginsMm: { top: 12, right: 12, bottom: 12, left: 12 },
        staffSize: .8,
        multiMeasureRests: false
      },
      overrides: {},
      generated: false
    });
    score.linkedParts = descriptors;
    deps.model.touch(score);
    return Object.freeze(descriptors.map(item => Object.freeze(JSON.parse(JSON.stringify(item)))));
  }

  function updateLinkedPart(score, linkedPartId, patch = {}) {
    const descriptor = (score.linkedParts || []).find(item => item.id === linkedPartId);
    if (!descriptor) throw new Error('Linked part not found.');
    if (patch.name != null) descriptor.name = String(patch.name || descriptor.name);
    if (patch.layout) descriptor.layout = {
      ...descriptor.layout,
      ...patch.layout,
      marginsMm: { ...(descriptor.layout?.marginsMm || {}), ...(patch.layout.marginsMm || {}) }
    };
    if (patch.overrides) descriptor.overrides = { ...(descriptor.overrides || {}), ...patch.overrides };
    deps.model.touch(score);
    return Object.freeze(JSON.parse(JSON.stringify(descriptor)));
  }

  function createCue(score, targetPartId, sourcePartId, options = {}) {
    const target = score.parts.find(part => part.id === targetPartId);
    const source = score.parts.find(part => part.id === sourcePartId);
    if (!target || !source) throw new Error('Cue source and destination parts are required.');
    const start = Math.max(0, Number(options.start) || 0);
    const end = Math.max(start, Number(options.end) || start + 4);
    const sourceEvents = source.events.filter(event => event.type === 'note' && event.generatedBy !== 'gap-fill' &&
      event.start >= start - 1e-8 && event.start < end - 1e-8);
    const created = sourceEvents.map(event => {
      const cue = deps.model.addNote(score, target.id, {
        midi: event.midi,
        start: event.start,
        duration: event.duration,
        voice: Math.max(1, Math.min(4, Number(options.voice) || 4)),
        staff: options.staff || target.staves?.[0]?.id || null,
        velocity: 1,
        generated: true,
        generatedBy: 'cue',
        inputSource: 'linked-part-cue'
      });
      deps.model.updateEvent(score, target.id, cue.id, {
        cue: true,
        mutedInPlayback: true,
        cueSourcePartId: source.id,
        cueSourceEventId: event.id,
        cueLabel: String(options.label || source.name)
      });
      return cue;
    });
    deps.model.touch(score);
    return Object.freeze(created.map(event => Object.freeze({ ...event })));
  }

  function rangeReport(score) {
    const parts = score.parts.map(part => {
      const definition = deps.model.INSTRUMENTS[part.instrumentKey] || {};
      const low = Number(part.writtenRange?.low ?? part.minPitch ?? definition.minPitch ?? 0);
      const high = Number(part.writtenRange?.high ?? part.maxPitch ?? definition.maxPitch ?? 127);
      const notes = part.events.filter(event => event.type === 'note' && event.generatedBy !== 'gap-fill' && !event.cue);
      const violations = notes.filter(event => event.midi < low || event.midi > high).map(event => ({
        eventId: event.id, midi: event.midi, low, high
      }));
      return Object.freeze({
        partId: part.id,
        name: part.name,
        low,
        high,
        noteCount: notes.length,
        violations: Object.freeze(violations),
        valid: violations.length === 0
      });
    });
    return Object.freeze({ parts: Object.freeze(parts), valid: parts.every(part => part.valid) });
  }

  function manualOverride(score, partId, eventId, patch = {}) {
    const ref = deps.model.findEvent(score, eventId);
    if (!ref || ref.part.id !== partId) throw new Error('Layout target was not found.');
    const timing = { start: ref.event.start, duration: ref.event.duration, midi: ref.event.midi };
    const allowed = ['offsetX', 'offsetY', 'stemLength', 'beamSlope', 'noteheadOffsetX', 'noteheadOffsetY', 'visible', 'scale'];
    const visual = { ...(ref.event.visualOverride || {}) };
    allowed.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        visual[key] = key === 'visible' ? Boolean(patch[key]) : Number(patch[key]);
      }
    });
    deps.model.updateEvent(score, partId, eventId, { visualOverride: visual });
    if (ref.event.start !== timing.start || ref.event.duration !== timing.duration || ref.event.midi !== timing.midi) {
      throw new Error('A visual override altered musical timing or pitch.');
    }
    return Object.freeze({ eventId, visualOverride: Object.freeze({ ...visual }), timing: Object.freeze(timing) });
  }

  function resetManualOverride(score, partId, eventId) {
    const ref = deps.model.findEvent(score, eventId);
    if (!ref || ref.part.id !== partId) return false;
    deps.model.updateEvent(score, partId, eventId, { visualOverride: {} });
    return true;
  }

  function engravingAudit(score, options = {}) {
    const issues = [];
    const parts = score.parts.map(part => {
      const authored = part.events.filter(event => event.generatedBy !== 'gap-fill');
      const collisions = [];
      const byOnset = new Map();
      authored.forEach(event => {
        const key = `${event.staff || ''}|${event.voice || 1}|${Number(event.start).toFixed(6)}`;
        if (!byOnset.has(key)) byOnset.set(key, []);
        byOnset.get(key).push(event);
      });
      for (const events of byOnset.values()) {
        const notes = events.filter(event => event.type === 'note').sort((a, b) => a.midi - b.midi);
        if (notes.length > 1) {
          const offsets = deps.layout.chordNoteheadOffsets(notes.map(event => event.midi));
          if (offsets.length !== notes.length) collisions.push({ type: 'notehead', eventIds: notes.map(event => event.id) });
        }
      }
      const lyricCollisions = authored.filter(event => (event.lyrics || []).some(lyric => String(lyric.text || '').length > 18))
        .map(event => ({ type: 'lyric-width', eventId: event.id }));
      collisions.push(...lyricCollisions);
      issues.push(...collisions.map(issue => ({ ...issue, partId: part.id, severity: 'warning' })));
      return Object.freeze({
        partId: part.id,
        eventCount: authored.length,
        collisionWarnings: collisions.length,
        manualOverrides: authored.filter(event => Object.keys(event.visualOverride || {}).length).length
      });
    });
    return Object.freeze({
      valid: !issues.some(issue => issue.severity === 'error'),
      parts: Object.freeze(parts),
      issues: Object.freeze(issues),
      settings: Object.freeze({
        pageSize: options.pageSize || score.settings.pageSize || 'A4',
        staffSize: Number(options.staffSize || score.settings.staffSize || 1),
        opticalCentering: options.opticalCentering !== false
      })
    });
  }

  function batchExportPlan(score, options = {}) {
    const version = String(options.version || '1.0.0');
    const build = Math.max(1, Math.round(Number(options.build) || 1));
    const format = String(options.format || 'pdf').toLowerCase();
    const descriptors = options.linkedPartIds
      ? (score.linkedParts || []).filter(part => options.linkedPartIds.includes(part.id))
      : (score.linkedParts || linkedPartDescriptors(score));
    return Object.freeze(descriptors.map((part, index) => Object.freeze({
      order: index,
      linkedPartId: part.id,
      sourcePartIds: Object.freeze([...(part.sourcePartIds || [])]),
      filename: `Airmonlink-Composer-${version}-Build${build}-${slug(part.name)}.${format}`,
      format,
      layout: Object.freeze(JSON.parse(JSON.stringify(part.layout || {})))
    })));
  }

  return Object.freeze({
    STAFF_TYPES,
    BRACKETS,
    TEMPLATES,
    PAGE_SIZES,
    templateDefinition,
    normalizeStaff,
    normalizeInstrumentPart,
    applyTemplate,
    reorderParts,
    linkedPartDescriptors,
    updateLinkedPart,
    createCue,
    rangeReport,
    manualOverride,
    resetManualOverride,
    engravingAudit,
    batchExportPlan
  });
});
