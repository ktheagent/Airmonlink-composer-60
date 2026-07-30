'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../src/core/score-model');
const playback = require('../src/core/playback');
const formats = require('../src/core/formats');
const airscore = require('../src/core/airscore');
const publishing = require('../src/core/file-publishing-service');
const parts = require('../src/core/parts-engraving-service');

function performanceScore() {
  const score = model.createScore({ template: 'piano', measures: 2, autoFillRests: false, tempo: 96 });
  const part = score.parts[0];
  const notes = [
    model.addNote(score, part.id, { midi: 60, start: 0, duration: 1, velocity: 80 }),
    model.addNote(score, part.id, { midi: 62, start: 1, duration: 1, velocity: 80 }),
    model.addNote(score, part.id, { midi: 64, start: 2, duration: 1, velocity: 80, grace: true }),
    model.addNote(score, part.id, { midi: 65, start: 3, duration: 1, velocity: 80 })
  ];
  notes[0].articulations = ['staccato', 'accent'];
  notes[1].fermata = true;
  score.annotations.push(
    { id: 'dyn-p', type: 'dynamics', text: 'p', start: 0, partId: part.id },
    { id: 'hairpin', type: 'hairpin', wedgeType: 'crescendo', start: 1, duration: 2, partId: part.id },
    { id: 'pedal-on', type: 'pedal', pedalType: 'start', start: 2.5, partId: part.id }
  );
  return { score, part, notes };
}

test('Build 46 playback schedule reflects articulations, dynamics, hairpins, fermatas, grace and pedal', () => {
  const { score, part, notes } = performanceScore();
  const staccato = playback.performanceForEvent(score, part, notes[0]);
  const fermata = playback.performanceForEvent(score, part, notes[1]);
  const grace = playback.performanceForEvent(score, part, notes[2]);
  const pedal = playback.performanceForEvent(score, part, notes[3]);
  assert.ok(staccato.durationBeats < notes[0].duration);
  assert.ok(staccato.velocity > notes[0].velocity);
  assert.ok(fermata.durationBeats > notes[1].duration);
  assert.equal(grace.grace, true);
  assert.ok(grace.durationBeats <= .25);
  assert.equal(pedal.pedal, true);
  assert.ok(playback.dynamicGainAt(score, 2.5, part.id) > playback.dynamicGainAt(score, 1, part.id));
});

test('Build 46 performance schedule repeats authoritative measures and retains sounding MIDI', () => {
  const { score, notes } = performanceScore();
  score.measures[0].repeatStart = true;
  score.measures[0].repeatEnd = true;
  score.measures[0].repeatTimes = 2;
  const schedule = playback.buildPerformanceSchedule(score);
  const occurrences = schedule.filter(item => item.eventId === notes[0].id);
  assert.equal(occurrences.length, 2);
  assert.deepEqual(occurrences.map(item => item.pass), [1, 2]);
  assert.ok(occurrences.every(item => item.midi === notes[0].midi));
});

test('Build 46 airscore preserves playback, parts, layout, lyrics and notation semantics', () => {
  const { score, part, notes } = performanceScore();
  notes[0].lyrics = [{ verse: 1, text: 'Sing', syllabic: 'single' }];
  notes[0].solfa = { manualSyllable: 'd' };
  parts.linkedPartDescriptors(score);
  const linked = score.linkedParts.find(item => item.sourcePartIds?.[0] === part.id);
  parts.updateLinkedPart(score, linked.id, { layout: { pageSize: 'Letter', staffSize: .9 } });
  parts.manualOverride(score, part.id, notes[0].id, { offsetX: 4, offsetY: -2 });
  const reopened = airscore.deserialize(airscore.serialize(score));
  const reopenedNote = model.findEvent(reopened, notes[0].id).event;
  assert.equal(reopenedNote.articulations[0], 'staccato');
  assert.equal(reopenedNote.lyrics[0].text, 'Sing');
  assert.equal(reopenedNote.solfa.manualSyllable, 'd');
  assert.equal(reopenedNote.visualOverride.offsetX, 4);
  assert.equal(reopened.linkedParts.find(item => item.id === linked.id).layout.pageSize, 'Letter');
});

test('Build 46 MusicXML round trip preserves measures, notes, voices, lyrics and repeats', () => {
  const { score, notes } = performanceScore();
  notes[0].lyrics = [{ verse: 1, text: 'Round', syllabic: 'single' }];
  score.measures[0].repeatStart = true;
  score.measures[1].repeatEnd = true;
  score.measures[1].repeatTimes = 3;
  const reopened = formats.parseMusicXML(formats.exportMusicXML(score));
  const authored = reopened.parts.flatMap(part => part.events).filter(event => event.type === 'note' && event.generatedBy !== 'gap-fill');
  assert.equal(reopened.measures.length, score.measures.length);
  assert.equal(authored.length, notes.length);
  assert.equal(authored[0].lyrics[0].text, 'Round');
  assert.equal(reopened.measures[0].repeatStart, true);
  assert.equal(reopened.measures[1].repeatEnd, true);
  assert.equal(reopened.measures[1].repeatTimes, 3);
});

test('Build 46 score-and-parts publication is transactional and format-complete', () => {
  const { score } = performanceScore();
  const plan = publishing.publishingPlan(score, {
    formats: ['airscore', 'musicxml', 'mxl', 'midi', 'pdf', 'png', 'wav'],
    includeScore: true,
    includeParts: true
  });
  assert.equal(plan.transactional, true);
  assert.equal(plan.rollbackOnFailure, true);
  assert.deepEqual(new Set(plan.targets.map(item => item.format)), new Set(['airscore', 'musicxml', 'mxl', 'midi', 'pdf', 'png', 'wav']));
  assert.equal(plan.targets.filter(item => item.kind === 'part').length, score.parts.length * 7);
});

test('Build 46 atomic save, autosave, migration and corruption gates remain explicit', () => {
  const { score } = performanceScore();
  const envelope = publishing.projectEnvelope(score, { applicationVersion: '1.2.6', build: 46 });
  assert.equal(publishing.validateEnvelope(envelope).valid, true);
  const corrupt = JSON.parse(JSON.stringify(envelope));
  corrupt.score.title = 'tampered';
  assert.equal(publishing.validateEnvelope(corrupt).valid, false);
  const atomic = publishing.atomicSavePlan('/scores/work.airscore', Buffer.from('score'));
  assert.equal(atomic.fsync && atomic.verifyBeforeReplace && atomic.replaceAtomically && atomic.rollbackOnFailure, true);
  assert.equal(publishing.autosavePlan(score, 'document-46').atomic, true);
  assert.equal(publishing.migrationPlan({ schemaVersion: 10, score }).backupRequired, true);
});

test('Build 46 behavior remains packaged in a later continuation build', () => {
  const packageJson = require('../package.json');
  const html = fs.readFileSync(path.join(__dirname, '../src/composer3/index.html'), 'utf8');
  assert.ok(Number(packageJson.buildNumber) >= 47);
  assert.match(packageJson.buildVersion, new RegExp(`\\.${packageJson.buildNumber}$`));
  assert.match(packageJson.build.nsis.artifactName, new RegExp(`Build${packageJson.buildNumber}-Setup`));
  assert.match(packageJson.build.portable.artifactName, new RegExp(`Build${packageJson.buildNumber}-Portable`));
  assert.ok(html.includes(`${packageJson.version} · Build ${packageJson.buildNumber}`));
});
