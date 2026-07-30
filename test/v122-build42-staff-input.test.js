'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const model = require('../src/core/score-model');
const staffInput = require('../src/composer3/staff-input-service');
const { createEngine } = require('../src/composer3/engine-api');

function authored(engine, type = null) {
  return engine.activePart().events
    .filter(event => event.generatedBy !== 'gap-fill')
    .filter(event => !type || event.type === type)
    .sort((a, b) => Number(a.start) - Number(b.start) || String(a.id).localeCompare(String(b.id)));
}

test('Build 42 duration service maps keypad values and dotted state deterministically', () => {
  assert.equal(staffInput.durationFromDenominator(1), 4);
  assert.equal(staffInput.durationFromDenominator(4), 1);
  assert.equal(staffInput.durationFromDenominator(16), 0.25);
  assert.equal(staffInput.applyDurationModifier(1, { dotted: true }), 1.5);
  assert.equal(staffInput.pitchFromLetter('g', 5), 'G5');
});

test('Build 42 plans safe segments at physical measure boundaries', () => {
  const score = model.createScore({ measures: 8, autoFillRests: false, timeSignature: '4/4' });
  const plan = staffInput.planSegments(model, score, 3, 2);
  assert.deepEqual(plan.map(segment => [segment.start, segment.duration]), [[3, 1], [4, 1]]);
});

test('Build 42 note entry crosses a barline by creating tied semantic segments', () => {
  const engine = createEngine({ score: model.createScore({ measures: 8, autoFillRests: false, timeSignature: '4/4' }) });
  engine.addNote({ pitch: 'C4', start: 3, duration: 2 });
  const notes = authored(engine, 'note');
  assert.equal(notes.length, 2);
  assert.deepEqual(notes.map(note => [note.start, note.duration]), [[3, 1], [4, 1]]);
  assert.equal(notes[0].tieStart, true);
  assert.equal(notes[1].tieStop, true);
  assert.ok(engine.score.spanners.some(item =>
    item.type === 'tie' &&
    item.startEventId === notes[0].id &&
    item.endEventId === notes[1].id
  ));
  assert.equal(engine.cursor, 5);
  assert.deepEqual(model.validateScore(engine.score), []);
  assert.equal(engine.undo(), true);
  assert.equal(authored(engine, 'note').length, 0);
  assert.equal(engine.redo(), true);
  assert.equal(authored(engine, 'note').length, 2);
});

test('Build 42 rest entry crosses a barline without inventing a tie', () => {
  const engine = createEngine({ score: model.createScore({ measures: 8, autoFillRests: false, timeSignature: '4/4' }) });
  engine.addRest({ start: 3.5, duration: 1 });
  const rests = authored(engine, 'rest');
  assert.deepEqual(rests.map(rest => [rest.start, rest.duration]), [[3.5, 0.5], [4, 0.5]]);
  assert.equal(engine.score.spanners.some(item => item.type === 'tie'), false);
  assert.equal(engine.cursor, 4.5);
  assert.deepEqual(model.validateScore(engine.score), []);
});

test('Build 42 chord input uses the last entered onset and rejects duplicate pitches atomically', () => {
  const engine = createEngine({ score: model.createScore({ measures: 8, autoFillRests: false }) });
  engine.addNote({ pitch: 'C4', start: 0, duration: 1 });
  engine.addChordTone({ pitch: 'E4' });
  const chord = authored(engine, 'note').filter(note => note.start === 0);
  assert.equal(chord.length, 2);
  assert.deepEqual(new Set(chord.map(note => note.pitch)), new Set(['C4', 'E4']));
  const before = structuredClone(engine.score);
  assert.throws(() => engine.addChordTone({ pitch: 'C4' }), /already|duplicate/i);
  assert.deepEqual(engine.score, before);
  assert.deepEqual(model.validateScore(engine.score), []);
});

test('Build 42 dot editing preflights overlap and preserves the score on failure', () => {
  const engine = createEngine({ score: model.createScore({ measures: 8, autoFillRests: false }) });
  const first = engine.addNote({ pitch: 'C4', start: 0, duration: 1 });
  engine.addNote({ pitch: 'D4', start: 1, duration: 1 });
  engine.selectEvent(first.id);
  const before = structuredClone(engine.score);
  assert.throws(() => engine.toggleDot(), /overlap/i);
  assert.deepEqual(engine.score, before);
  assert.deepEqual(model.validateScore(engine.score), []);
});

test('Build 42 dot editing updates a selected duration as one undoable semantic change', () => {
  const engine = createEngine({ score: model.createScore({ measures: 8, autoFillRests: false }) });
  const note = engine.addNote({ pitch: 'C4', start: 0, duration: 1 });
  engine.selectEvent(note.id);
  engine.toggleDot();
  let updated = authored(engine, 'note').find(event => event.id === note.id);
  assert.equal(updated.duration, 1.5);
  assert.equal(updated.augmentationDots, 1);
  assert.equal(engine.undo(), true);
  updated = authored(engine, 'note').find(event => event.id === note.id);
  assert.equal(updated.duration, 1);
});

test('Build 42 range helper returns ordered staff events between anchor and target', () => {
  const score = {
    parts: [{
      id: 'part-1',
      events: [
        { id: 'a', start: 0, duration: 1, voice: 1, staff: 'staff-1', type: 'note' },
        { id: 'b', start: 1, duration: 1, voice: 1, staff: 'staff-1', type: 'note' },
        { id: 'c', start: 2, duration: 1, voice: 1, staff: 'staff-1', type: 'rest' },
        { id: 'x', start: 1, duration: 1, voice: 2, staff: 'staff-1', type: 'note' }
      ]
    }]
  };
  assert.deepEqual(staffInput.rangeEventIds(score, 'a', 'c'), ['a', 'b', 'c']);
});

test('Build 42 production source exposes one persistent keypad, visible caret and direct input shortcuts', () => {
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'src/composer3/index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'src/composer3/app.js'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'src/composer3/styles.css'), 'utf8');
  const viewportScript = fs.readFileSync(path.join(root, 'scripts/viewport-matrix.js'), 'utf8');
  assert.match(html, /id="notationKeypad"/);
  assert.match(html, /staff-input-service\.js/);
  assert.match(app, /class: 'insertion-caret'/);
  assert.match(app, /enterStaffPitch/);
  assert.match(app, /enterStaffRest/);
  assert.match(app, /event\.key\.toUpperCase\(\)/);
  assert.match(styles, /\.notation-keypad/);
  assert.doesNotMatch(app, /engine\.addNote\(\{ pitch: 'C4' \}\)/);
  assert.doesNotMatch(app, /engine\.addChordTone\(\{ midi: 64 \}\)/);
  assert.match(viewportScript, /viewport-matrix\.json/);
  assert.doesNotMatch(viewportScript, /build30-/);
});
