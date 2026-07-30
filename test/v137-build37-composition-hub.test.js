'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../src/core/score-model');
const hub = require('../src/core/composition-hub-service');

function melodyScore() {
  const score = model.createScore({ template: 'lead', measures: 8, autoFillRests: false, key: 'C' });
  const part = score.parts[0];
  const notes = [60, 62, 64, 65].map((midi, index) =>
    model.addNote(score, part.id, { midi, start: index, duration: 1, voice: 1 }));
  const context = hub.selectionContext(score, notes.map(event => ({ part, event })));
  return { score, part, notes, context };
}

test('Build 37 Composition Hub defines all eight professional groups', () => {
  assert.deepEqual(hub.GROUPS, [
    'Create', 'Harmony', 'Arrange', 'Transform', 'Analyse',
    'Lyrics and Choir', 'Playback and Practice', 'Publish'
  ]);
  assert.ok(hub.TOOLS.length >= 35);
  assert.equal(new Set(hub.TOOLS.map(tool => tool.id)).size, hub.TOOLS.length);
});

test('Build 37 Hub state persists pin, docking, resizing, favourites and recent tools', () => {
  let state = hub.normalizeState({ open: true, pinned: true, dock: 'right', width: 999 });
  assert.equal(state.width, 560);
  assert.equal(state.dock, 'right');
  state = hub.updateState(state, { type: 'favorite', toolId: 'continue-melody' });
  state = hub.updateState(state, { type: 'used', toolId: 'continue-melody' });
  assert.deepEqual(state.favorites, ['continue-melody']);
  assert.deepEqual(state.recent, ['continue-melody']);
  state = hub.updateState(state, { type: 'dock', value: 'left' });
  assert.equal(state.dock, 'left');
});

test('Build 37 Hub search and context prioritise real applicable tools', () => {
  const { score, context } = melodyScore();
  const state = hub.normalizeState({ query: 'harmony' });
  const tools = hub.toolsForContext(context, state);
  assert.ok(tools.length);
  assert.ok(tools.every(tool => [tool.label, tool.group, tool.description, ...tool.keywords].join(' ').toLowerCase().includes('harmony')));
  assert.equal(tools.find(tool => tool.id === 'harmonise-melody').enabled, true);
  const empty = hub.selectionContext(score, []);
  assert.equal(hub.toolAvailability(empty, hub.TOOL_BY_ID['continue-melody']).enabled, false);
});

test('Build 37 guided plans preserve selection and expose advanced choices', () => {
  const { context } = melodyScore();
  const plan = hub.guidedPlan('countermelody', { voice: 2, destinationPartId: 'part-x' }, context);
  assert.equal(plan.toolId, 'countermelody');
  assert.equal(plan.canPreview, true);
  assert.deepEqual(plan.selection.eventIds, context.eventIds);
  assert.ok(plan.inputs.find(input => input.id === 'destinationPartId').advanced);
});

test('Build 37 detects a likely C major key from diatonic evidence', () => {
  const { score, context } = melodyScore();
  [67, 69, 71, 72].forEach((midi, index) => model.addNote(score, score.parts[0].id, {
    midi, start: index + 4, duration: 1, voice: 1
  }));
  const result = hub.detectKey(score, hub.selectionContext(score, score.parts[0].events
    .filter(event => event.type === 'note').map(event => ({ part: score.parts[0], event }))));
  assert.equal(result.detected.key, 'C');
  assert.equal(result.detected.mode, 'major');
});

test('Build 37 identifies chord names, Roman numerals and Nashville numbers', () => {
  const score = model.createScore({ template: 'lead', measures: 2, autoFillRests: false, key: 'C' });
  const part = score.parts[0];
  const events = [60, 64, 67].map(midi => model.addNote(score, part.id, {
    midi, start: 0, duration: 1, allowChord: true
  }));
  const result = hub.identifyChords(score, hub.selectionContext(score, events.map(event => ({ part, event }))));
  assert.equal(result[0].name, 'C');
  assert.equal(result[0].roman, 'I');
  assert.equal(result[0].nashville, '1');
});

test('Build 37 detects parallel fifths between independent lines', () => {
  const score = model.createScore({ template: 'satb', measures: 2, autoFillRests: false });
  const one = score.parts[0];
  const two = score.parts[1];
  const events = [
    model.addNote(score, one.id, { midi: 60, start: 0, duration: 1 }),
    model.addNote(score, one.id, { midi: 62, start: 1, duration: 1 }),
    model.addNote(score, two.id, { midi: 53, start: 0, duration: 1 }),
    model.addNote(score, two.id, { midi: 55, start: 1, duration: 1 })
  ];
  const entries = events.map(event => {
    const part = score.parts.find(item => item.events.includes(event));
    return { part, event };
  });
  const warnings = hub.parallelMotion(score, hub.selectionContext(score, entries));
  assert.ok(warnings.some(item => item.type === 'parallel-fifth'));
});

test('Build 37 rhythm complexity reports tuplets and syncopation', () => {
  const score = model.createScore({ template: 'lead', measures: 2, autoFillRests: false });
  const part = score.parts[0];
  const events = [
    model.addNote(score, part.id, { midi: 60, start: .5, duration: .5, tuplet: { actual: 3, normal: 2 } }),
    model.addNote(score, part.id, { midi: 62, start: 1, duration: .25 }),
    model.addNote(score, part.id, { midi: 64, start: 1.25, duration: .75 })
  ];
  const result = hub.rhythmComplexity(score, hub.selectionContext(score, events.map(event => ({ part, event }))));
  assert.equal(result.tuplets, 1);
  assert.ok(result.durationVariety >= 2);
  assert.ok(['simple', 'moderate', 'complex'].includes(result.level));
});

test('Build 37 previews and applies melody continuation without changing the source', () => {
  const { score, part, notes, context } = melodyScore();
  const sourceSnapshot = notes.map(event => ({ id: event.id, midi: event.midi, start: event.start, duration: event.duration }));
  const preview = hub.compositionPreview(score, 'continue-melody', context, { length: 4 });
  assert.equal(preview.events.length, 4);
  assert.ok(preview.events[0].event.start >= 4);
  assert.deepEqual(notes.map(event => ({ id: event.id, midi: event.midi, start: event.start, duration: event.duration })), sourceSnapshot);
  const applied = hub.applyPreview(score, preview, { appliedAt: '2026-01-01T00:00:00Z' });
  assert.equal(applied.count, 4);
  const created = part.events.filter(event => applied.createdIds.includes(event.id));
  assert.ok(created.every(event => event.generatedBy === 'composition-assistant'));
  assert.ok(created.every(event => event.assistance.previewId === preview.id));
});

test('Build 37 harmony preview creates at least three analysable alternatives', () => {
  const { score, context } = melodyScore();
  const preview = hub.harmonyPreview(score, context, {
    sourcePartId: score.parts[0].id,
    style: 'hymn',
    destination: 'satb-parts'
  });
  assert.ok(preview.alternatives.length >= 3);
  assert.ok(preview.alternatives.every(alternative => alternative.eventsByVoice));
  const result = hub.applyPreview(score, preview, { alternativeIndex: 1, destination: 'satb-parts' });
  assert.equal(result.style, preview.alternatives[1].style);
  assert.ok(score.arrangement.activeVariantId);
});
