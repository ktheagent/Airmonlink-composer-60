(function (root, factory) {
  const dependencies = {
    model: root.AirmonScoreModel || (typeof require === 'function' ? require('./score-model') : null)
  };
  const api = factory(dependencies);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AirmonInspector = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';

  if (!deps.model) throw new Error('Inspector model dependency is unavailable.');

  const PLACEMENTS = Object.freeze(['auto', 'above', 'below']);
  const ALIGNMENTS = Object.freeze(['auto', 'left', 'center', 'right']);
  const STEMS = Object.freeze(['auto', 'up', 'down', 'none']);
  const NOTEHEADS = Object.freeze(['normal', 'cross', 'diamond', 'triangle', 'slash', 'cue']);
  const HEX_COLOUR = /^#[0-9a-f]{6}$/i;
  const finite = (value, label) => {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error(`${label} must be a finite number.`);
    return number;
  };
  const choice = (value, choices, label) => {
    const normalized = String(value || '').toLowerCase();
    if (!choices.includes(normalized)) throw new Error(`${label} must be one of: ${choices.join(', ')}.`);
    return normalized;
  };

  function editableSnapshot(entries = []) {
    return Object.freeze(entries.map(({ part, event }) => Object.freeze({
      partId: part.id,
      eventId: event.id,
      type: event.type,
      pitch: event.type === 'note' ? Number(event.midi) : null,
      duration: Number(event.duration),
      voice: Number(event.voice) || 1,
      staff: event.staff || null,
      visible: event.visible !== false && event.visualOverride?.visible !== false,
      placement: event.placement || 'auto',
      alignment: event.alignment || 'auto',
      stem: event.stemDirection || 'auto',
      beam: event.beam || event.beams?.[0]?.value || 'auto',
      notehead: event.notehead || 'normal',
      tied: Boolean(event.tieStart || event.tieStop),
      slurred: Boolean(event.slurStart || event.slurStop),
      articulations: Object.freeze([...(event.articulations || [])]),
      playback: Object.freeze({
        velocity: Number(event.velocity ?? 80),
        muted: Boolean(event.mutedInPlayback)
      }),
      text: event.text == null ? '' : String(event.text),
      font: Object.freeze({ ...(event.font || {}) }),
      colour: event.colour || '#10213f',
      partVisible: part.visible !== false,
      solfa: Object.freeze({ ...(event.solfa || {}) })
    })));
  }

  function normalizePatch(score, entries, patch = {}) {
    if (!entries.length) throw new Error('Select one or more score objects to edit.');
    const normalized = {};
    if ('pitch' in patch) normalized.midi = Math.round(finite(patch.pitch, 'Pitch'));
    if ('duration' in patch) normalized.duration = finite(patch.duration, 'Duration');
    if ('voice' in patch) normalized.voice = Math.round(finite(patch.voice, 'Voice'));
    if ('staff' in patch) normalized.staff = patch.staff == null || patch.staff === '' ? null : String(patch.staff);
    if ('visible' in patch) normalized.visible = Boolean(patch.visible);
    if ('placement' in patch) normalized.placement = choice(patch.placement, PLACEMENTS, 'Placement');
    if ('alignment' in patch) normalized.alignment = choice(patch.alignment, ALIGNMENTS, 'Alignment');
    if ('stem' in patch) normalized.stemDirection = choice(patch.stem, STEMS, 'Stem');
    if ('beam' in patch) normalized.beam = String(patch.beam || 'auto');
    if ('notehead' in patch) normalized.notehead = choice(patch.notehead, NOTEHEADS, 'Notehead');
    if ('articulations' in patch) normalized.articulations = [...new Set((Array.isArray(patch.articulations) ? patch.articulations : String(patch.articulations || '').split(',')).map(value => String(value).trim()).filter(Boolean))];
    if ('playback' in patch) {
      const playback = patch.playback || {};
      if ('velocity' in playback) normalized.velocity = Math.round(finite(playback.velocity, 'Playback velocity'));
      if ('muted' in playback) normalized.mutedInPlayback = Boolean(playback.muted);
    }
    if ('text' in patch) normalized.text = String(patch.text ?? '');
    if ('font' in patch) normalized.font = { ...(patch.font || {}) };
    if ('colour' in patch) normalized.colour = String(patch.colour || '');
    if ('solfa' in patch) normalized.solfa = { ...(patch.solfa || {}) };

    if ('midi' in normalized && (normalized.midi < 0 || normalized.midi > 127)) throw new Error('Pitch must be between MIDI 0 and 127.');
    if ('duration' in normalized && normalized.duration <= 0) throw new Error('Duration must be greater than zero.');
    if ('voice' in normalized && (normalized.voice < 1 || normalized.voice > 4)) throw new Error('Voice must be between 1 and 4.');
    if ('velocity' in normalized && (normalized.velocity < 0 || normalized.velocity > 127)) throw new Error('Playback velocity must be between 0 and 127.');
    if ('colour' in normalized && !HEX_COLOUR.test(normalized.colour)) throw new Error('Colour must be a six-digit hexadecimal colour.');
    if ('font' in normalized) {
      if (normalized.font.size != null) {
        normalized.font.size = finite(normalized.font.size, 'Font size');
        if (normalized.font.size < 6 || normalized.font.size > 144) throw new Error('Font size must be between 6 and 144 points.');
      }
      if (normalized.font.family != null) normalized.font.family = String(normalized.font.family).trim();
    }
    for (const { part, event } of entries) {
      if ('midi' in normalized && event.type !== 'note') throw new Error('Pitch can only be edited on notes.');
      if ('staff' in normalized && normalized.staff && !(part.staves || []).some(staff => staff.id === normalized.staff)) {
        throw new Error(`Staff ${normalized.staff} does not belong to ${part.name}.`);
      }
      if ('duration' in normalized) {
        const measure = deps.model.measureBounds(score, deps.model.measureIndexAt(score, event.start));
        if (Number(event.start) + normalized.duration > measure.end + 1e-8) {
          throw new Error('The duration crosses a measure boundary; use rhythmic entry to create the required tied value.');
        }
      }
    }
    return Object.freeze({ event: Object.freeze(normalized), partVisible: 'partVisible' in patch ? Boolean(patch.partVisible) : null });
  }

  function applyPatch(score, entries, patch = {}) {
    const plan = normalizePatch(score, entries, patch);
    const partIds = new Set();
    for (const { part, event } of entries) {
      deps.model.updateEvent(score, part.id, event.id, plan.event);
      partIds.add(part.id);
    }
    if (plan.partVisible != null) {
      for (const partId of partIds) {
        const part = score.parts.find(item => item.id === partId);
        if (part) part.visible = plan.partVisible;
      }
      deps.model.touch(score);
    }
    return editableSnapshot(entries);
  }

  return Object.freeze({
    PLACEMENTS,
    ALIGNMENTS,
    STEMS,
    NOTEHEADS,
    editableSnapshot,
    normalizePatch,
    applyPatch
  });
});
