const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../src/core/score-model');
const airscore = require('../src/core/airscore');
const formats = require('../src/core/formats');
const lyrics = require('../src/core/lyrics');
const solfa = require('../src/core/solfa');
const playback = require('../src/core/playback');
const { createEngine } = require('../src/composer3/engine-api');

function scoreWithNotes() {
  const score = model.createScore({ title: 'Build 44 lyric synchronization' });
  const part = score.parts[0];
  model.addNote(score, part.id, { pitch: 'C4', start: 0, duration: 1, voice: 1, staff: 'treble' });
  model.addNote(score, part.id, { pitch: 'D4', start: 1, duration: 1, voice: 1, staff: 'treble' });
  model.addNote(score, part.id, { pitch: 'E4', start: 2, duration: 1, voice: 1, staff: 'treble' });
  return score;
}

test('Build 44 direct lyric entry advances within the authoritative voice', () => {
  const engine = createEngine({ score: scoreWithNotes() });
  const notes = engine.score.parts[0].events.filter(event => event.type === 'note');
  engine.selectEvent(notes[0].id);
  const first = engine.setLyricAndAdvance('A', { verse: 2, advance: 'hyphen' });
  assert.equal(first.nextEventId, notes[1].id);
  assert.equal(notes[0].lyrics[0].text, 'A');
  assert.equal(notes[0].lyrics[0].verse, 2);
  assert.equal(notes[0].lyrics[0].syllabic, 'begin');
  assert.equal(engine.state().selectedEvents[0].event.id, notes[1].id);
});

test('Build 44 melisma and elision remain semantic metadata through reopen and MusicXML', () => {
  const engine = createEngine({ score: scoreWithNotes() });
  const note = engine.score.parts[0].events.find(event => event.type === 'note');
  engine.selectEvent(note.id);
  engine.setLyricAndAdvance('glo‿ry', { verse: 1, advance: 'melisma' });
  const reopened = airscore.deserialize(airscore.serialize(engine.score));
  const lyric = reopened.parts[0].events.find(event => event.id === note.id).lyrics[0];
  assert.equal(lyric.text, 'glo‿ry');
  assert.equal(lyric.elision, true);
  assert.equal(lyric.melisma, true);
  const xml = formats.exportMusicXML(reopened);
  assert.match(xml, /<elision>‿<\/elision>/);
  assert.match(xml, /<extend type="start"\/>/);
});

test('Build 44 renderer exposes every lyric verse and semantic continuations', () => {
  const app = fs.readFileSync(path.join(__dirname, '../src/composer3/app.js'), 'utf8');
  assert.equal(app.includes('lyrics.forEach((lyric, lyricIndex)'), true);
  assert.equal(app.includes("'data-verse': verse"), true);
  assert.equal(app.includes("class: 'lyric-hyphen'"), true);
  assert.equal(app.includes("class: 'lyric-extender'"), true);
  assert.equal(app.includes('const lyric = eventLyric(event, 1)'), false);
});

test('Build 44 direct lyric normalizer never inserts verse numbers into text', () => {
  const result = lyrics.normalizeDirectEntry('Praise', { verse: 12, advance: 'space' });
  assert.equal(result.text, 'Praise');
  assert.equal(result.text.includes('12'), false);
});

test('Build 44 chorus and part visibility persist while lyric navigation stays in one lane', () => {
  const engine = createEngine({ score: scoreWithNotes() });
  const notes = engine.score.parts[0].events.filter(event => event.type === 'note');
  engine.selectEvent(notes[1].id);
  engine.setLyricAndAdvance('Refrain', {
    verse: 3,
    lineType: 'chorus',
    visibleInParts: false,
    advance: 'none'
  });
  const movedBack = engine.navigateLyric(-1);
  assert.equal(movedBack.eventId, notes[0].id);
  engine.undo();
  engine.redo();
  const reopened = airscore.deserialize(airscore.serialize(engine.score));
  const lyric = reopened.parts[0].events.find(event => event.id === notes[1].id).lyrics[0];
  assert.equal(lyric.lineType, 'chorus');
  assert.equal(lyric.visibleInParts, false);
  assert.equal(lyric.text, 'Refrain');
});

test('Build 44 validates every supplied Sol-fa voice before one atomic mutation', () => {
  const score = model.createScore({ title: 'Four voice Sol-fa' });
  const engine = createEngine({ score });
  const before = JSON.stringify(engine.score);
  assert.throws(() => engine.applySolfaVoicePassages({
    1: 'd r m f |',
    2: 'd not-a-syllable m f |'
  }), error => error.code === 'INVALID_SOLFA_VOICE' && error.voice === 2);
  assert.equal(JSON.stringify(engine.score), before);

  const applied = engine.applySolfaVoicePassages({
    1: 'd r m f |',
    2: 'm f s l |',
    3: "s l t d' |",
    4: 'd, r, m, f, |'
  });
  assert.deepEqual(applied.map(item => item.voice), [1, 2, 3, 4]);
  const authored = engine.score.parts[0].events.filter(event => event.type === 'note' && event.generatedBy !== 'gap-fill');
  assert.deepEqual([...new Set(authored.map(event => event.voice))], [1, 2, 3, 4]);
  assert.equal(engine.solfaSynchronizationReport().valid, true);
});

test('Build 44 Staff and Sol-fa share pitch, timing, playback, reopen and export state', () => {
  const score = model.createScore({ title: 'One authoritative score' });
  const engine = createEngine({ score });
  engine.applySolfaVoicePassages({ 1: 'd r m f |' });
  const part = engine.score.parts[0];
  const notes = part.events.filter(event => event.type === 'note' && event.generatedBy !== 'gap-fill');
  const firstId = notes[0].id;
  const beforePitch = notes[0].pitch;
  engine.selectEvent(firstId);
  engine.updateSelectedFromSolfa('di');
  const changed = part.events.find(event => event.id === firstId);
  assert.notEqual(changed.pitch, beforePitch);
  assert.match(solfa.scoreToSolfaText(engine.score), /di/i);
  const playbackEvent = playback.buildPlaybackNotes(engine.score).find(item => item.event.id === firstId);
  assert.equal(playbackEvent.event.midi, changed.midi);
  engine.undo();
  assert.equal(engine.score.parts[0].events.find(event => event.id === firstId).pitch, beforePitch);
  engine.redo();
  const reopened = airscore.deserialize(airscore.serialize(engine.score));
  const reopenedNote = reopened.parts[0].events.find(event => event.id === firstId);
  assert.equal(reopenedNote.midi, changed.midi);
  const xml = formats.exportMusicXML(reopened);
  assert.match(xml, new RegExp(`<step>${reopenedNote.pitch[0]}</step>`));
});

test('Build 44 exact punctuation audit distinguishes comma dot dash underscore and bar', () => {
  const score = model.createScore({ title: 'Sol-fa punctuation' });
  const audit = require('../src/core/choir-solfa-service').punctuationAudit(
    score,
    'd, r. m - _ |',
    { allowIncompleteMeasures: true, validateFinalMeasure: false }
  );
  assert.equal(audit.counts[','] > 0, true);
  assert.equal(audit.counts['.'] > 0, true);
  assert.equal(audit.counts['-'] > 0, true);
  assert.equal(audit.counts['_'] > 0, true);
  assert.equal(audit.counts['|'] > 0, true);
  assert.equal(audit.interpretation.dash, 'continue previous sounding event without retrigger');
  assert.equal(audit.interpretation.underscore, 'melisma continuation without new pitch');
});

test('Build 44 publication exposes pickup, repeats, tonic changes, chords and tuplets from score semantics', () => {
  const score = model.createScore({ title: 'Advanced Sol-fa publication', pickupBeats: 1, measures: 3 });
  const part = score.parts[0];
  score.measures[0].repeatStart = true;
  score.measures[0].repeatEnd = true;
  score.measures[0].repeatTimes = 3;
  score.measures[1].key = 'G';
  const chordId = 'build44-chord';
  const chord = ['C4', 'E4', 'G4'].map(pitch => model.addNote(score, part.id, {
    pitch,
    start: 0,
    duration: 1 / 3,
    voice: 1,
    allowChord: true,
    chordId,
    tuplet: { id: 'triplet-build44', actual: 3, normal: 2 }
  }));
  chord.forEach(event => {
    event.chordId = chordId;
    event.tuplet = { id: 'triplet-build44', actual: 3, normal: 2 };
  });
  model.addNote(score, part.id, { pitch: 'G4', start: 1, duration: 1, voice: 1 });
  const text = solfa.scoreToSolfaText(score);
  assert.match(text, /Pickup: 1 quarter beat/);
  assert.match(text, /\|:/);
  assert.match(text, /:\|3/);
  assert.match(text, /\[Tonic: G\]/);
  assert.match(text, /\{3:2\}\[/);
  assert.equal(chord.every(event => text.includes(solfa.eventToSolfa(event, score, part).syllable)), true);
});

test('Build 44 bracketed Sol-fa chord input creates one semantic staff chord and survives export', () => {
  const score = model.createScore({ title: 'Sol-fa chord input' });
  const engine = createEngine({ score });
  const result = engine.applySolfaPassage('[d m s] r m f |');
  const onset = result.created.filter(event => event.type === 'note' && Math.abs(event.start) < 1e-8);
  assert.equal(onset.length, 3);
  assert.equal(new Set(onset.map(event => event.chordId)).size, 1);
  assert.equal(onset.every(event => event.chordId), true);
  const text = engine.solfaText();
  assert.match(text, /\[[^\]]+\]/);
  const reopened = airscore.deserialize(engine.serializeAirscore());
  const reopenedOnset = reopened.parts[0].events.filter(event => event.type === 'note' && Math.abs(event.start) < 1e-8);
  assert.equal(new Set(reopenedOnset.map(event => event.chordId)).size, 1);
  assert.match(formats.exportMusicXML(reopened), /<chord\/>/);
});

test('Build 44 behavior remains packaged in a later continuation build', () => {
  const packageJson = require('../package.json');
  const html = fs.readFileSync(path.join(__dirname, '../src/composer3/index.html'), 'utf8');
  assert.ok(Number(packageJson.buildNumber) >= 47);
  assert.match(packageJson.buildVersion, new RegExp(`\\.${packageJson.buildNumber}$`));
  assert.match(packageJson.build.nsis.artifactName, new RegExp(`Build${packageJson.buildNumber}-Setup`));
  assert.match(packageJson.build.portable.artifactName, new RegExp(`Build${packageJson.buildNumber}-Portable`));
  assert.ok(html.includes(`${packageJson.version} · Build ${packageJson.buildNumber}`));
});
