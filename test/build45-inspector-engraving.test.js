'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../src/core/score-model');
const inspector = require('../src/core/inspector-service');
const parts = require('../src/core/parts-engraving-service');
const palette = require('../src/core/palette-service');
const { createEngine } = require('../src/composer3/engine-api');

function selectedScore() {
  const score = model.createScore({ template: 'lead', measures: 4, autoFillRests: false });
  const part = score.parts[0];
  const notes = [
    model.addNote(score, part.id, { midi: 60, start: 0, duration: 1, voice: 1 }),
    model.addNote(score, part.id, { midi: 64, start: 1, duration: 1, voice: 1 })
  ];
  return { score, part, notes, entries: notes.map(event => ({ part, event })) };
}

test('Build 45 inspector exposes selected-object musical, visual, playback and Sol-fa properties', () => {
  const { entries } = selectedScore();
  const snapshot = inspector.editableSnapshot(entries);
  assert.equal(snapshot.length, 2);
  assert.deepEqual(
    ['pitch', 'duration', 'voice', 'staff', 'visible', 'placement', 'alignment', 'stem', 'beam',
      'notehead', 'tied', 'slurred', 'articulations', 'playback', 'text', 'font', 'colour',
      'partVisible', 'solfa'].filter(key => !(key in snapshot[0])),
    []
  );
});

test('Build 45 inspector applies validated properties and rejects invalid batches before mutation', () => {
  const { score, notes, entries } = selectedScore();
  inspector.applyPatch(score, entries, {
    duration: .5,
    voice: 2,
    placement: 'above',
    alignment: 'center',
    stem: 'down',
    notehead: 'diamond',
    articulations: ['accent', 'staccato'],
    playback: { velocity: 96, muted: true },
    colour: '#224488',
    solfa: { manualSyllable: 'm' }
  });
  assert.ok(notes.every(note => note.duration === .5 && note.voice === 2));
  assert.ok(notes.every(note => note.notehead === 'diamond' && note.velocity === 96));
  const before = JSON.stringify(score);
  assert.throws(() => inspector.applyPatch(score, entries, { voice: 5, colour: 'navy' }), /Voice/);
  assert.equal(JSON.stringify(score), before);
});

test('Build 45 engine inspector edit is undoable and persists through airscore reopen', () => {
  const engine = createEngine({ template: 'lead', measures: 2, autoFillRests: false });
  const note = engine.addNote({ midi: 60, start: 0, duration: 1 });
  engine.selectEvent(note.id);
  engine.updateInspector({ pitch: 67, voice: 3, playback: { velocity: 88 }, colour: '#123456' });
  assert.equal(engine.selectedEntries()[0].event.midi, 67);
  assert.equal(engine.selectedEntries()[0].event.voice, 3);
  engine.undo();
  const restored = model.findEvent(engine.score, note.id).event;
  assert.equal(restored.midi, 60);
  engine.redo();
  const serialized = engine.serializeAirscore();
  const reopened = createEngine({ template: 'lead', measures: 1 });
  reopened.openAirscore(serialized);
  const reopenedNote = model.findEvent(reopened.score, note.id).event;
  assert.equal(reopenedNote.midi, 67);
  assert.equal(reopenedNote.velocity, 88);
  assert.equal(reopenedNote.colour, '#123456');
});

test('Build 45 manual layout overrides and reset never alter musical timing', () => {
  const { score, part, notes } = selectedScore();
  const timing = notes.map(note => [note.start, note.duration, note.midi]);
  notes.forEach(note => parts.manualOverride(score, part.id, note.id, {
    offsetX: 5, offsetY: -3, stemLength: 31, beamSlope: .15
  }));
  assert.deepEqual(notes.map(note => [note.start, note.duration, note.midi]), timing);
  notes.forEach(note => parts.resetManualOverride(score, part.id, note.id));
  assert.ok(notes.every(note => Object.keys(note.visualOverride).length === 0));
  assert.deepEqual(notes.map(note => [note.start, note.duration, note.midi]), timing);
});

test('Build 45 production UI contains a connected selected-object inspector', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/composer3/index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../src/composer3/app.js'), 'utf8');
  assert.match(html, /id="objectInspector"/);
  assert.match(html, /data-inspector-field="pitch"/);
  assert.match(html, /data-inspector-field="notehead"/);
  assert.match(html, /id="resetInspectorPosition"/);
  assert.match(app, /engine\.updateInspector\(patch\)/);
  assert.match(app, /engine\.resetSelectedStyle\(\)/);
});

test('Build 45 palette supports search, favorites, recent symbols and context disablement', () => {
  let state = palette.normalizeState();
  state = palette.updateState(state, { type: 'favorite', symbolId: 'accent' });
  state = palette.updateState(state, { type: 'used', symbolId: 'accent' });
  state = palette.updateState(state, { type: 'search', query: 'accent' });
  const result = palette.search(state, { note: true, staff: false, noteSelection: false });
  assert.equal(result[0].id, 'accent');
  assert.equal(result[0].enabled, true);
  assert.equal(result[0].favorite, true);
  assert.deepEqual(state.recent, ['accent']);
  assert.equal(palette.availability('tie', { note: true, noteSelection: false }).enabled, false);
});

test('Build 45 palette drag payload is typed and invalid payloads cannot become score commands', () => {
  const payload = palette.dragPayload('pitch-c');
  assert.deepEqual(palette.parseDragPayload(payload), { symbolId: 'pitch-c' });
  assert.equal(palette.parseDragPayload('{"type":"airmonlink-palette-symbol","symbolId":"unknown"}'), null);
  assert.equal(palette.parseDragPayload('not json'), null);
});

test('Build 45 engine palette click/drop route creates notation and applies marks', () => {
  const engine = createEngine({ template: 'lead', measures: 2, autoFillRests: false });
  const first = engine.applyPaletteSymbol('pitch-c', { start: 0, octave: 4, duration: .5 });
  const second = engine.applyPaletteSymbol('pitch-d', { start: .5, octave: 4, duration: .5 });
  assert.equal(first.midi, 60);
  assert.equal(second.midi, 62);
  engine.selectEvent(first.id);
  engine.applyPaletteSymbol('accent');
  assert.ok(model.findEvent(engine.score, first.id).event.articulations.includes('accent'));
  engine.selectEvents([first.id, second.id]);
  engine.applyPaletteSymbol('slur');
  assert.ok(engine.score.spanners.some(item => item.type === 'slur'));
});

test('Build 45 production palette wires click, drag, valid staff drops, search and favorites', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/composer3/index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../src/composer3/app.js'), 'utf8');
  assert.match(html, /id="symbolPaletteSearch"/);
  assert.match(html, /id="symbolPaletteResults"/);
  assert.match(app, /addEventListener\('dragstart'/);
  assert.match(app, /addEventListener\('drop'/);
  assert.match(app, /paletteApi\.availability/);
  assert.match(app, /type: 'favorite'/);
  assert.match(app, /engine\.applyPaletteSymbol/);
});

test('Build 45 behavior remains packaged in a later continuation build', () => {
  const packageJson = require('../package.json');
  const html = fs.readFileSync(path.join(__dirname, '../src/composer3/index.html'), 'utf8');
  assert.ok(Number(packageJson.buildNumber) >= 47);
  assert.match(packageJson.buildVersion, new RegExp(`\\.${packageJson.buildNumber}$`));
  assert.match(packageJson.build.nsis.artifactName, new RegExp(`Build${packageJson.buildNumber}-Setup`));
  assert.match(packageJson.build.portable.artifactName, new RegExp(`Build${packageJson.buildNumber}-Portable`));
  assert.ok(html.includes(`${packageJson.version} · Build ${packageJson.buildNumber}`));
});
