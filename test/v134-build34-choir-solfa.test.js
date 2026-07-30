'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../src/core/score-model');
const choir = require('../src/core/choir-solfa-service');

function satb() {
  return model.createScore({ template: 'satb', measures: 4, autoFillRests: false });
}

test('Build 34 exposes one documented Tonic Sol-fa grammar model', () => {
  const grammar = choir.grammarModel();
  assert.deepEqual(grammar.syllables, ['d', 'r', 'm', 'f', 's', 'l', 't']);
  assert.deepEqual(grammar.punctuation, [',', '.', '-', '_', '|', ':']);
  assert.match(grammar.bySymbol['- / —'].meaning, /Extend/i);
});

test('Build 34 normalizes all supported staff and Sol-fa view modes', () => {
  assert.equal(choir.normalizeViewMode('staff-solfa'), 'staff-solfa');
  assert.equal(choir.normalizeViewMode('split'), 'split');
  assert.equal(choir.normalizeViewMode('invalid'), 'staff');
});

test('Build 34 interprets comma, dot, dash, underscore and bar semantically', () => {
  const document = satb();
  const audit = choir.punctuationAudit(document, 'd, r. m - _ | f s |', {
    partId: document.parts[0].id,
    allowIncompleteMeasures: true
  });
  assert.equal(audit.valid, true);
  assert.ok(audit.counts[','] >= 1);
  assert.ok(audit.counts['.'] >= 1);
  assert.ok(audit.counts['-'] >= 1);
  assert.ok(audit.counts['_'] >= 1);
  assert.ok(audit.counts['|'] >= 1);
  assert.match(audit.interpretation.dash, /without retrigger/);
  assert.match(audit.interpretation.underscore, /without new pitch/);
});

test('Build 34 converts Sol-fa passage into authoritative staff events', () => {
  const document = satb();
  const result = choir.applyVoicePassage(document, document.parts[0].id, "d r m f | s l t d' |", {
    voice: 1,
    allowIncompleteMeasures: true
  });
  assert.equal(result.valid, true);
  assert.equal(result.createdIds.length, 8);
  const events = document.parts[0].events.filter(event => result.createdIds.includes(event.id));
  assert.deepEqual(events.map(event => event.midi), [60, 62, 64, 65, 67, 69, 71, 72]);
});

test('Build 34 lyric assignment preserves verse metadata and syllabic structure', () => {
  const document = satb();
  const part = document.parts[0];
  for (let index = 0; index < 4; index += 1) {
    model.addNote(document, part.id, { midi: 60 + index, start: index, duration: 1, voice: 1 });
  }
  const applied = choir.applyLyrics(document, 'Glo-ri-a Sing', {
    partIds: [part.id], voice: 1, verse: 2, lineType: 'verse'
  });
  assert.equal(applied.applied, 4);
  const rows = choir.lyricVerseMatrix(document, { partIds: [part.id], voices: [1] });
  assert.equal(rows.length, 4);
  assert.ok(rows.every(row => row.lyrics[0].verse === 2));
  assert.equal(rows[0].lyrics[0].text, 'Glo');
  assert.doesNotMatch(rows[0].lyrics[0].text, /2$/);
});

test('Build 34 supports chorus and translation line types without contaminating text', () => {
  const document = satb();
  const part = document.parts[0];
  model.addNote(document, part.id, { midi: 60, start: 0, duration: 1 });
  choir.applyLyrics(document, 'Amen', { partIds: [part.id], verse: 1, lineType: 'chorus' });
  const row = choir.lyricVerseMatrix(document, { partIds: [part.id] })[0];
  assert.equal(row.lyrics[0].lineType, 'chorus');
  assert.equal(row.lyrics[0].text, 'Amen');
});

test('Build 34 publication metadata uses semantic fields and title aliases', () => {
  const document = satb();
  const metadata = choir.publicationMetadata(document, {
    title: 'Gloria',
    dedication: 'For the choir',
    composer: 'A. Composer',
    translator: 'T. Translator',
    publisher: 'Airmonlink'
  });
  assert.equal(metadata.title, 'Gloria');
  assert.equal(metadata.dedication, 'For the choir');
  assert.equal(metadata.translator, 'T. Translator');
  assert.equal(document.title, 'Gloria');
  assert.equal(document.composer, 'A. Composer');
});

test('Build 34 SATB range report identifies exact out-of-range events', () => {
  const document = satb();
  const [soprano, alto, tenor, bass] = document.parts;
  model.addNote(document, soprano.id, { midi: 82, start: 0, duration: 1 });
  model.addNote(document, alto.id, { midi: 60, start: 0, duration: 1 });
  model.addNote(document, tenor.id, { midi: 55, start: 0, duration: 1 });
  model.addNote(document, bass.id, { midi: 45, start: 0, duration: 1 });
  const report = choir.satbRangeReport(document);
  assert.equal(report.valid, false);
  assert.equal(report.violationCount, 1);
  assert.equal(report.voices[0].violations[0].direction, 'high');
});

test('Build 34 verifies Staff, playback pitch, Sol-fa and lyric metadata together', () => {
  const document = satb();
  const part = document.parts[0];
  const note = model.addNote(document, part.id, { midi: 60, start: 0, duration: 1 });
  model.setLyric(document, part.id, note.id, 'Sing', { verse: 1 });
  const report = choir.verifySynchronization(document);
  assert.equal(report.valid, true);
  assert.equal(report.solfaIssues.length, 0);
  assert.equal(report.lyricIssues.length, 0);
});
