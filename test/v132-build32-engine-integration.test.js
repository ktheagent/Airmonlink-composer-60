'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const engineApi = require('../src/composer3/engine-api');

test('Build 32 engine enters and undoes a chord as one transaction', () => {
  const engine = engineApi.createEngine({ template: 'piano', measures: 2 });
  const before = engine.state().score.parts[0].events.filter(event => event.generatedBy !== 'gap-fill').length;
  const created = engine.addPianoChord([60, 64, 67, 64], { start: 0, duration: 1, staff: 'treble', advance: false });
  assert.equal(created.length, 3);
  assert.equal(new Set(created.map(event => event.chordId)).size, 1);
  const after = engine.state().score.parts[0].events.filter(event => event.generatedBy !== 'gap-fill').length;
  assert.equal(after - before, 3);
  engine.undo();
  const undone = engine.state().score.parts[0].events.filter(event => event.generatedBy !== 'gap-fill').length;
  assert.equal(undone, before);
});

test('Build 32 browser source loads professional editing before the engine', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '../src/composer3/index.html'), 'utf8');
  assert.ok(html.indexOf('../core/professional-editing.js') < html.indexOf('engine-api.js'));
});
