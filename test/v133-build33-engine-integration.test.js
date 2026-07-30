'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const engineApi = require('../src/composer3/engine-api');

test('Build 33 engine applies notation properties to selected events with undo', () => {
  const engine = engineApi.createEngine({ template: 'lead', measures: 2 });
  const note = engine.addNote({ midi: 60, start: 0, duration: .5, advance: false });
  engine.selectEvent(note.id);
  engine.applyNotation({ notehead: 'diamond', stem: 'up', accidental: { type: 'quarter-sharp' } });
  assert.equal(engine.selectedEntries()[0].event.notation.notehead, 'diamond');
  engine.undo();
  assert.equal(engine.state().score.parts[0].events.find(event => event.id === note.id).notation, undefined);
});

test('Build 33 engine stores repeat navigation as a score transaction', () => {
  const engine = engineApi.createEngine({ template: 'lead', measures: 2 });
  engine.setMeasureNavigation(0, { barline: 'repeat-start', navigation: ['segno'] });
  assert.equal(engine.state().score.measures[0].repeatStart, true);
  assert.deepEqual(engine.state().score.measures[0].navigation, ['segno']);
});
