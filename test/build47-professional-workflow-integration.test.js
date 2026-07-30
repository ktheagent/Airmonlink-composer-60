'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../src/core/score-model');
const playback = require('../src/core/playback');
const parts = require('../src/core/parts-engraving-service');
const { createEngine } = require('../src/composer3/engine-api');

test('Build 47 workspace modes retain one score, selection, cursor, viewport, parts and dirty state', () => {
  const engine = createEngine({ template: 'lead', measures: 4, autoFillRests: false });
  const note = engine.addNote({ midi: 60, start: 5, duration: 1 });
  engine.selectEvent(note.id);
  engine.seek(5);
  const scoreIdentity = engine.score.id;
  const partIds = engine.score.parts.map(part => part.id);
  for (const mode of ['setup', 'write', 'engrave', 'play', 'publish']) {
    engine.setSettings({
      workspaceMode: mode,
      viewportSession: {
        staff: { pageIndex: 1, zoom: 1.2, scrollX: 10, scrollY: 120 },
        solfa: { pageIndex: 0, zoom: .9, scrollX: 0, scrollY: 40 }
      }
    });
    assert.equal(engine.score.id, scoreIdentity);
    assert.deepEqual(engine.score.parts.map(part => part.id), partIds);
    assert.equal(engine.selectedEntries()[0].event.id, note.id);
    assert.equal(engine.cursor, 5);
    assert.equal(model.measureIndexAt(engine.score, engine.cursor), 1);
    assert.equal(engine.dirty, true);
  }
});

test('Build 47 passage workflow copies, transposes, changes voice, beams and undoes/redoes every edit', () => {
  const engine = createEngine({ template: 'lead', measures: 4, autoFillRests: false });
  const notes = [60, 62, 64, 65].map((midi, index) => engine.addNote({ midi, start: index * .5, duration: .5 }));
  engine.selectEvents(notes.map(note => note.id));
  engine.copySelection();
  const pasted = engine.pasteSelection({ atBeat: 4 });
  engine.selectEvents(pasted.map(entry => entry.event.id));
  engine.transposeSelection(2);
  engine.copySelectionToLayer(2);
  engine.autoBeamSelection();
  engine.setArticulation('accent', true);
  const edited = engine.selectedEntries().map(({ event }) => ({ id: event.id, midi: event.midi, voice: event.voice, articulations: event.articulations }));
  assert.ok(edited.every(event => event.voice === 2 && event.articulations.includes('accent')));
  for (let count = 0; count < 4; count += 1) assert.equal(engine.undo(), true);
  for (let count = 0; count < 4; count += 1) assert.equal(engine.redo(), true);
  const redoneIds = new Set(engine.score.parts.flatMap(part => part.events).map(event => event.id));
  assert.ok(edited.every(event => redoneIds.has(event.id)));
});

test('Build 47 SATB workflow synchronizes four voices, lyrics, Sol-fa, practice playback and reopen', () => {
  const engine = createEngine({ score: model.createScore({ template: 'satb', measures: 4, autoFillRests: false, key: 'C' }) });
  const created = [];
  engine.score.parts.forEach((part, partIndex) => {
    engine.setActivePart(part.id);
    [0, 1, 2, 3].forEach((start, index) => {
      created.push(engine.addNote({ midi: 72 - partIndex * 5 + index, start, duration: 1, voice: 1 }));
    });
  });
  const soprano = engine.score.parts[0];
  engine.setActivePart(soprano.id);
  engine.selectEvents(soprano.events.filter(event => event.type === 'note').map(event => event.id));
  engine.applyLyricsWorkflow('Sing-ing now _', { partIds: [soprano.id], voice: 1, verse: 1 });
  engine.addSlur();
  engine.addDynamic('mf');
  assert.deepEqual(engine.verifySolfa(), []);
  assert.ok(playback.buildPerformanceSchedule(engine.score).length >= created.length);
  const reopened = createEngine();
  reopened.openAirscore(engine.serializeAirscore());
  assert.deepEqual(reopened.verifySolfa(), []);
  assert.equal(reopened.score.parts.length, 4);
  assert.match(reopened.exportMusicXml(), /<lyric number="1"[^>]*>/);
});

test('Build 47 ensemble parts workflow preserves transposition, cues, part layout and batch export', () => {
  const engine = createEngine({ score: model.createScore({ template: 'orchestra', measures: 4, autoFillRests: false }) });
  const source = engine.score.parts[0];
  const target = engine.score.parts[1];
  engine.setActivePart(source.id);
  const note = engine.addNote({ midi: 72, start: 0, duration: 1 });
  source.transpose = -2;
  const linked = engine.generateLinkedParts();
  const targetLinked = linked.find(item => item.sourcePartIds?.[0] === target.id);
  engine.updateLinkedPart(targetLinked.id, { layout: { pageSize: 'Letter', orientation: 'landscape', staffSize: .85 } });
  engine.setActivePart(target.id);
  const cue = engine.createCue({ sourcePartId: source.id, targetPartId: target.id, start: 0, end: 2, label: source.name });
  assert.equal(cue[0].cueSourceEventId, note.id);
  const plan = engine.batchPartExportPlan({ version: '1.2.7', build: 47, format: 'pdf' });
  assert.equal(new Set(plan.map(item => item.filename)).size, plan.length);
  const reopened = createEngine();
  reopened.openAirscore(engine.serializeAirscore());
  assert.equal(reopened.score.parts.find(part => part.id === source.id).transpose, -2);
  assert.equal(reopened.score.linkedParts.find(item => item.id === targetLinked.id).layout.pageSize, 'Letter');
  assert.ok(reopened.score.parts.find(part => part.id === target.id).events.some(event => event.cueSourceEventId === note.id));
  assert.equal(parts.rangeReport(reopened.score).parts.length, reopened.score.parts.length);
});
