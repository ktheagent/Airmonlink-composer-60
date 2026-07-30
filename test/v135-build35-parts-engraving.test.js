'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../src/core/score-model');
const parts = require('../src/core/parts-engraving-service');

function orchestra() {
  return model.createScore({ template: 'orchestra', measures: 4, autoFillRests: false });
}

test('Build 35 exposes professional ensemble templates', () => {
  assert.ok(parts.templateDefinition('orchestra').instruments.includes('violin'));
  assert.ok(parts.templateDefinition('concertBand').instruments.includes('clarinet'));
  assert.deepEqual(parts.templateDefinition('bad').instruments, ['violin']);
});

test('Build 35 normalizes standard, percussion, tablature and linked staves', () => {
  assert.equal(parts.normalizeStaff({ type: 'percussion-1' }).lines, 1);
  assert.equal(parts.normalizeStaff({ type: 'tablature-6' }).lines, 6);
  assert.equal(parts.normalizeStaff({ type: 'standard-5', linkedTo: 'staff-a' }).linkedTo, 'staff-a');
});

test('Build 35 linked part descriptors reference authoritative source parts without copying events', () => {
  const document = orchestra();
  const source = document.parts[0];
  model.addNote(document, source.id, { midi: 72, start: 0, duration: 1 });
  const descriptors = parts.linkedPartDescriptors(document);
  const linked = descriptors.find(item => item.sourcePartIds[0] === source.id);
  assert.ok(linked);
  assert.equal(Object.prototype.hasOwnProperty.call(linked, 'events'), false);
  assert.equal(source.events.filter(event => event.generatedBy !== 'gap-fill').length, 1);
});

test('Build 35 updates part-specific page layout without mutating score events', () => {
  const document = orchestra();
  const source = document.parts[0];
  const note = model.addNote(document, source.id, { midi: 72, start: 0, duration: 1 });
  const linked = parts.linkedPartDescriptors(document).find(item => item.sourcePartIds[0] === source.id);
  parts.updateLinkedPart(document, linked.id, {
    name: 'Flute 1',
    layout: { pageSize: 'Letter', orientation: 'landscape', staffSize: .9 }
  });
  assert.equal(document.linkedParts.find(item => item.id === linked.id).name, 'Flute 1');
  assert.equal(note.start, 0);
  assert.equal(note.midi, 72);
});

test('Build 35 cue notes preserve source identity and are muted in playback semantics', () => {
  const document = orchestra();
  const source = document.parts[0];
  const target = document.parts[1];
  const original = model.addNote(document, source.id, { midi: 72, start: 2, duration: 1 });
  const cues = parts.createCue(document, target.id, source.id, { start: 0, end: 4, label: 'Flute' });
  assert.equal(cues.length, 1);
  const cue = target.events.find(event => event.id === cues[0].id);
  assert.equal(cue.cueSourceEventId, original.id);
  assert.equal(cue.cueSourcePartId, source.id);
  assert.equal(cue.mutedInPlayback, true);
  assert.equal(cue.generatedBy, 'cue');
});

test('Build 35 manual engraving overrides never alter pitch, onset or duration', () => {
  const document = orchestra();
  const part = document.parts[0];
  const note = model.addNote(document, part.id, { midi: 72, start: 1, duration: 2 });
  const result = parts.manualOverride(document, part.id, note.id, {
    offsetX: 4, offsetY: -2, stemLength: 28
  });
  assert.deepEqual(result.timing, { start: 1, duration: 2, midi: 72 });
  assert.equal(note.visualOverride.offsetX, 4);
  assert.equal(note.start, 1);
  assert.equal(note.duration, 2);
  assert.equal(note.midi, 72);
  assert.equal(parts.resetManualOverride(document, part.id, note.id), true);
  assert.deepEqual(note.visualOverride, {});
});

test('Build 35 range report identifies instrument-specific violations', () => {
  const document = model.createScore({ template: 'piano', measures: 2, autoFillRests: false });
  const piano = document.parts[0];
  model.addNote(document, piano.id, { midi: 1, start: 0, duration: 1 });
  const report = parts.rangeReport(document);
  assert.equal(report.valid, false);
  assert.equal(report.parts[0].violations.length, 1);
});

test('Build 35 engraving audit reports lyric width warnings without corrupting score', () => {
  const document = orchestra();
  const part = document.parts[0];
  const note = model.addNote(document, part.id, {
    midi: 72, start: 0, duration: 1, lyric: 'This-is-a-very-long-lyric-syllable'
  });
  const report = parts.engravingAudit(document);
  assert.equal(report.valid, true);
  assert.ok(report.issues.some(issue => issue.type === 'lyric-width'));
  assert.equal(note.midi, 72);
});

test('Build 35 batch export plan produces deterministic score and part filenames', () => {
  const document = orchestra();
  parts.linkedPartDescriptors(document, { scoreName: 'Full Score' });
  const plan = parts.batchExportPlan(document, { version: '1.1.15', build: 35, format: 'pdf' });
  assert.equal(plan[0].filename, 'Airmonlink-Composer-1.1.15-Build35-Full-Score.pdf');
  assert.ok(plan.slice(1).every(item => item.filename.endsWith('.pdf')));
  assert.equal(new Set(plan.map(item => item.filename)).size, plan.length);
});

test('Build 35 reorders instruments while preserving the same part objects and events', () => {
  const document = orchestra();
  const first = document.parts[0];
  const second = document.parts[1];
  const note = model.addNote(document, first.id, { midi: 72, start: 0, duration: 1 });
  parts.reorderParts(document, [second.id, first.id]);
  assert.equal(document.parts[0], second);
  assert.equal(document.parts[1], first);
  assert.equal(document.parts[1].events.find(event => event.id === note.id), note);
});
