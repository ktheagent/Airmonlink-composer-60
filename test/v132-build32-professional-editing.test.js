'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../src/core/score-model');
const editing = require('../src/core/professional-editing');

function score() {
  return model.createScore({ template: 'piano', measures: 4, autoFillRests: false });
}

test('Build 32 normalizes visible professional input state', () => {
  assert.deepEqual(editing.normalizeInputState({
    active: true, mode: 'pitch-before-duration', writeMode: 'overwrite',
    voice: 9, duration: .51, dots: 3, accidental: 'sharp', staff: 'treble'
  }), {
    active: true, mode: 'pitch-before-duration', writeMode: 'overwrite',
    voice: 4, duration: .5, dots: 2, accidental: 'sharp', articulation: '',
    partId: null, staff: 'treble', rest: false, grace: false, cue: false, tuplet: null
  });
});

test('Build 32 applies single and double dots exactly', () => {
  assert.equal(editing.dottedDuration(1, 1), 1.5);
  assert.equal(editing.dottedDuration(1, 2), 1.75);
});

test('Build 32 chord input creates one semantic chord without duplicate pitches', () => {
  const document = score();
  const part = document.parts[0];
  const result = editing.chordInput(document, part.id, [60, 64, 67, 64], {
    start: 0, duration: 1, voice: 2, staff: 'treble', inputSource: 'test'
  });
  assert.equal(result.eventIds.length, 3);
  assert.deepEqual(result.pitches, [60, 64, 67]);
  const events = part.events.filter(event => result.eventIds.includes(event.id));
  assert.equal(new Set(events.map(event => event.chordId)).size, 1);
  assert.ok(events.every(event => event.voice === 2 && event.staff === 'treble'));
});

test('Build 32 chord input preserves tuplet and grace semantics', () => {
  const document = score();
  const part = document.parts[0];
  const result = editing.chordInput(document, part.id, [72, 76], {
    start: 1, duration: .5, grace: true, tuplet: { actual: 3, normal: 2, level: 1 }
  });
  const events = part.events.filter(event => result.eventIds.includes(event.id));
  assert.ok(events.every(event => event.grace === true));
  assert.ok(events.every(event => event.tuplet.actual === 3));
});

test('Build 32 exchanges exactly two voices without altering pitch or onset', () => {
  const document = score();
  const part = document.parts[0];
  const one = model.addNote(document, part.id, { midi: 60, start: 0, duration: 1, voice: 1 });
  const two = model.addNote(document, part.id, { midi: 65, start: 1, duration: 1, voice: 2 });
  const before = [one, two].map(event => [event.id, event.midi, event.start]);
  editing.exchangeVoices(document, [{ part, event: one }, { part, event: two }], 1, 2);
  assert.equal(one.voice, 2);
  assert.equal(two.voice, 1);
  assert.deepEqual([one, two].map(event => [event.id, event.midi, event.start]), before);
});

test('Build 32 moves selection to another staff and optional voice', () => {
  const document = score();
  const part = document.parts[0];
  const note = model.addNote(document, part.id, { midi: 48, start: 0, duration: 1, voice: 1, staff: 'bass' });
  editing.moveEntriesToStaff(document, [{ part, event: note }], 'treble', { voice: 3 });
  assert.equal(note.staff, 'treble');
  assert.equal(note.voice, 3);
});

test('Build 32 fills only uncovered rhythmic gaps with authored rests', () => {
  const document = score();
  const part = document.parts[0];
  model.addNote(document, part.id, { midi: 60, start: 1, duration: 1, voice: 1, staff: 'treble' });
  const rests = editing.fillRangeWithRests(document, part.id, { start: 0, end: 4, voice: 1, staff: 'treble' });
  assert.equal(rests.reduce((sum, event) => sum + event.duration, 0), 3);
  assert.deepEqual(rests.map(event => event.start), [0, 2]);
  assert.ok(rests.every(event => event.generated !== true));
});

test('Build 32 selection summary preserves semantic identity and range', () => {
  const document = score();
  const part = document.parts[0];
  const note = model.addNote(document, part.id, { midi: 60, start: 2, duration: 2, voice: 1, lyric: 'Sing' });
  const summary = editing.selectionSummary([{ part, event: note }]);
  assert.equal(summary.count, 1);
  assert.equal(summary.start, 2);
  assert.equal(summary.end, 4);
  assert.equal(summary.containsLyrics, true);
});

test('Build 32 Escape exits edit layers without stopping playback', () => {
  assert.deepEqual(editing.escapeTransition({ textEditing: true, selectionCount: 4 }), {
    action: 'exit-text-edit', clearSelection: false, stopPlayback: false
  });
  assert.equal(editing.escapeTransition({ inputActive: true }).action, 'cancel-input');
  assert.equal(editing.escapeTransition({ selectionCount: 2 }).action, 'clear-selection');
  assert.equal(editing.escapeTransition({}).stopPlayback, false);
});
