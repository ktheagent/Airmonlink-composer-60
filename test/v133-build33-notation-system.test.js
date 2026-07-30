'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../src/core/score-model');
const notation = require('../src/core/notation-system-service');

function score() {
  return model.createScore({ template: 'lead', measures: 4, autoFillRests: false });
}

test('Build 33 parses simple, additive and alternating meters', () => {
  assert.equal(notation.parseMeter('4/4').primary.quarterBeats, 4);
  assert.deepEqual(notation.parseMeter('3+2+3/8').primary.groups, [3, 2, 3]);
  assert.equal(notation.parseMeter('3/4,2/4').alternating, true);
});

test('Build 33 rejects invalid meter grammar', () => {
  assert.throws(() => notation.parseMeter('5/x'), /Invalid time signature/);
  assert.throws(() => notation.parseMeter('0/4'), /Unsupported/);
});

test('Build 33 normalizes nested tuplet presentation and ratios', () => {
  assert.deepEqual(notation.normalizeTuplet({ actual: 7, normal: 4, level: 2, bracket: false, number: 'actual' }), {
    id: 'tuplet-7-4-2', actual: 7, normal: 4, level: 2, bracket: false, number: 'actual', placement: 'auto'
  });
});

test('Build 33 normalizes microtonal, courtesy and editorial accidentals', () => {
  assert.deepEqual(notation.normalizeAccidental({
    type: 'quarter-sharp', courtesy: true, editorial: true, parenthesized: true
  }), {
    type: 'quarter-sharp', cents: 50, courtesy: true, editorial: true, parenthesized: true
  });
});

test('Build 33 attaches notehead, stem, accidental and tuplet semantics to one event', () => {
  const document = score();
  const part = document.parts[0];
  const event = model.addNote(document, part.id, { midi: 60, start: 0, duration: .5 });
  notation.applyEventNotation(document, part.id, event.id, {
    notehead: 'diamond',
    stem: 'up',
    accidental: { type: 'quarter-flat', editorial: true },
    tuplet: { actual: 3, normal: 2, level: 1 }
  });
  assert.equal(event.notation.notehead, 'diamond');
  assert.equal(event.notation.stem, 'up');
  assert.equal(event.notation.accidental.cents, -50);
  assert.equal(event.tuplet.actual, 3);
});

test('Build 33 attaches articulations and ornaments to semantic notes', () => {
  const document = score();
  const part = document.parts[0];
  const event = model.addNote(document, part.id, { midi: 60, start: 0, duration: 1 });
  notation.attachMark(document, part.id, event.id, { type: 'articulation', value: 'staccato' });
  notation.attachMark(document, part.id, event.id, { type: 'ornament', value: 'trill' });
  assert.deepEqual(event.articulations, ['staccato']);
  assert.deepEqual(event.ornaments, ['trill']);
});

test('Build 33 stores barlines, repeats, voltas and navigation on measures', () => {
  const document = score();
  const measure = notation.setMeasureNavigation(document, 1, {
    barline: 'repeat-both',
    repeatCount: 3,
    volta: [1, 2],
    navigation: ['segno', 'to-coda', 'bad']
  });
  assert.equal(measure.repeatStart, true);
  assert.equal(measure.repeatEnd, true);
  assert.equal(measure.repeatCount, 3);
  assert.deepEqual(measure.volta, [1, 2]);
  assert.deepEqual(measure.navigation, ['segno', 'to-coda']);
});

test('Build 33 automatic beaming respects additive grouping', () => {
  const events = [
    { id: 'a', type: 'note', start: 0, duration: .5 },
    { id: 'b', type: 'note', start: .5, duration: .5 },
    { id: 'c', type: 'note', start: 1, duration: .5 },
    { id: 'd', type: 'note', start: 1.5, duration: .5 }
  ];
  const groups = notation.automaticBeamGroups(events, '2+2/8');
  assert.equal(groups.length, 4);
  assert.equal(groups[0].beam, 'begin');
  assert.ok(groups.every(item => ['begin', 'continue', 'end'].includes(item.beam)));
});

test('Build 33 detects orphan spanners instead of silently exporting them', () => {
  const document = score();
  document.spanners = [{ id: 's1', type: 'slur', startEventId: 'missing', endEventId: 'also-missing' }];
  const issues = notation.validateAttachments(document);
  assert.equal(issues.length, 2);
  assert.ok(issues.every(issue => issue.severity === 'error'));
});

test('Build 33 navigation order follows authoritative repeat playback order', () => {
  const document = score();
  notation.setMeasureNavigation(document, 0, { barline: 'repeat-start' });
  notation.setMeasureNavigation(document, 1, { barline: 'repeat-end', repeatCount: 2, navigation: ['fine'] });
  const order = notation.navigationOrder(document);
  assert.ok(order.length >= document.measures.length);
  assert.equal(order[0].measureNumber, 1);
});
