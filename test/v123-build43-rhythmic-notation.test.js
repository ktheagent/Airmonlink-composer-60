'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const model = require('../src/core/score-model');
const rhythmic = require('../src/core/rhythmic-notation-service');
const { createEngine } = require('../src/composer3/engine-api');

const EPSILON = 1e-8;
const close = (actual, expected, message = '') =>
  assert.ok(Math.abs(Number(actual) - Number(expected)) < EPSILON, `${message} expected ${expected}, received ${actual}`);

function score(options = {}) {
  return model.createScore({
    measures: 8,
    autoFillRests: false,
    timeSignature: '4/4',
    ...options
  });
}

function authored(engine, type = null) {
  return engine.activePart().events
    .filter(event => event.generatedBy !== 'gap-fill')
    .filter(event => !type || event.type === type)
    .sort((a, b) => Number(a.start) - Number(b.start) || Number(a.midi || 0) - Number(b.midi || 0));
}

function addRun(engine, starts, duration = 0.5, voice = 1, pitches = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4']) {
  return starts.map((start, index) => engine.addNote({
    pitch: pitches[index % pitches.length],
    start,
    duration,
    voice,
    advance: false
  }));
}

test('Build 43 converts three written eighth-note positions into one real 3:2 triplet transaction', () => {
  const engine = createEngine({ score: score() });
  const notes = addRun(engine, [0, 0.5, 1], 0.5);
  engine.selectEvents(notes.map(note => note.id));
  const plan = engine.setTuplet(3, 2);

  assert.equal(plan.actual, 3);
  assert.equal(plan.normal, 2);
  const after = authored(engine, 'note');
  close(after[0].start, 0);
  close(after[1].start, 1 / 3);
  close(after[2].start, 2 / 3);
  after.forEach(note => {
    close(note.duration, 1 / 3);
    assert.equal(note.tuplet.actual, 3);
    assert.equal(note.tuplet.normal, 2);
    assert.ok(note.tuplet.id);
    assert.ok(note.beam.some(mark => mark.number === 1));
  });
  assert.deepEqual(model.validateScore(engine.score), []);

  assert.equal(engine.undo(), true);
  const undone = authored(engine, 'note');
  assert.deepEqual(undone.map(note => note.start), [0, 0.5, 1]);
  assert.deepEqual(undone.map(note => note.duration), [0.5, 0.5, 0.5]);
  assert.ok(undone.every(note => !note.tuplet));

  assert.equal(engine.redo(), true);
  assert.ok(authored(engine, 'note').every(note => note.tuplet?.actual === 3));
});

test('Build 43 counts chord tones at one onset as one tuplet position', () => {
  const engine = createEngine({ score: score({ template: 'piano' }) });
  const chords = [
    engine.addPianoChord([60, 64, 67], { start: 0, duration: 0.5, staff: 'treble' }),
    engine.addPianoChord([62, 65, 69], { start: 0.5, duration: 0.5, staff: 'treble' }),
    engine.addPianoChord([64, 67, 71], { start: 1, duration: 0.5, staff: 'treble' })
  ];
  engine.selectEvents(chords.flat().map(note => note.id));
  engine.setTuplet(3, 2);
  const notes = authored(engine, 'note');
  assert.equal(notes.length, 9);
  assert.deepEqual([...new Set(notes.map(note => note.start))], [0, 1 / 3, 2 / 3]);
  assert.equal(new Set(notes.map(note => note.tuplet.id)).size, 1);
  assert.deepEqual(model.validateScore(engine.score), []);
});

test('Build 43 rejects incomplete, mixed-lane and colliding tuplets atomically', () => {
  {
    const engine = createEngine({ score: score() });
    const notes = addRun(engine, [0, 0.5], 0.5);
    engine.selectEvents(notes.map(note => note.id));
    const before = structuredClone(engine.score);
    assert.throws(() => engine.setTuplet(3, 2), /exactly 3 rhythmic positions/i);
    assert.deepEqual(engine.score, before);
  }

  {
    const engine = createEngine({ score: score() });
    const first = engine.addNote({ pitch: 'C4', start: 0, duration: 0.5, voice: 1, advance: false });
    const second = engine.addNote({ pitch: 'D4', start: 0.5, duration: 0.5, voice: 2, advance: false });
    const third = engine.addNote({ pitch: 'E4', start: 1, duration: 0.5, voice: 1, advance: false });
    engine.selectEvents([first.id, second.id, third.id]);
    const before = structuredClone(engine.score);
    assert.throws(() => engine.setTuplet(3, 2), /one part, one staff and one voice/i);
    assert.deepEqual(engine.score, before);
  }

  {
    const engine = createEngine({ score: score() });
    const notes = addRun(engine, [0, 1, 2], 0.25);
    engine.addNote({ pitch: 'G4', start: 0.42, duration: 0.125, voice: 1, advance: false });
    engine.selectEvents(notes.map(note => note.id));
    const before = structuredClone(engine.score);
    assert.throws(() => engine.setTuplet(3, 2), /overlap music/i);
    assert.deepEqual(engine.score, before);
  }
});

test('Build 43 manual beaming creates nested levels and removal is one undoable transaction', () => {
  const engine = createEngine({ score: score() });
  const notes = addRun(engine, [0, 0.25, 0.5, 0.75], 0.25);
  engine.selectEvents(notes.map(note => note.id));
  engine.beamSelection();

  const beamed = authored(engine, 'note');
  assert.deepEqual(beamed.map(note => note.beam.find(mark => mark.number === 1)?.value), ['begin', 'continue', 'continue', 'end']);
  assert.deepEqual(beamed.map(note => note.beam.find(mark => mark.number === 2)?.value), ['begin', 'continue', 'continue', 'end']);

  engine.clearSelectionBeams();
  assert.ok(authored(engine, 'note').every(note => note.beam.length === 0));
  assert.equal(engine.undo(), true);
  assert.ok(authored(engine, 'note').every(note => note.beam.length === 2));
});

test('Build 43 automatic beaming follows simple and compound meter groups', () => {
  {
    const engine = createEngine({ score: score({ timeSignature: '4/4' }) });
    const notes = addRun(engine, [0, 0.5, 1, 1.5], 0.5);
    engine.selectEvents(notes.map(note => note.id));
    engine.autoBeamSelection();
    assert.deepEqual(
      authored(engine, 'note').map(note => note.beam[0]?.value),
      ['begin', 'end', 'begin', 'end']
    );
  }

  {
    const engine = createEngine({ score: score({ timeSignature: '6/8' }) });
    const notes = addRun(engine, [0, 0.5, 1, 1.5, 2, 2.5], 0.5);
    engine.selectEvents(notes.map(note => note.id));
    engine.autoBeamSelection();
    assert.deepEqual(
      authored(engine, 'note').map(note => note.beam[0]?.value),
      ['begin', 'continue', 'end', 'begin', 'continue', 'end']
    );
  }
});

test('Build 43 ties require adjacent equal pitches in one voice and reject invalid pairs without mutation', () => {
  const engine = createEngine({ score: score() });
  const first = engine.addNote({ pitch: 'C4', start: 0, duration: 1, advance: false });
  const second = engine.addNote({ pitch: 'C4', start: 1, duration: 1, advance: false });
  engine.selectEvents([first.id, second.id]);
  const tie = engine.addTie();
  assert.equal(tie.type, 'tie');
  assert.equal(tie.startEventId, first.id);
  assert.equal(tie.endEventId, second.id);
  assert.equal(engine.score.spanners.filter(item => item.type === 'tie').length, 1);

  const different = engine.addNote({ pitch: 'D4', start: 2, duration: 1, advance: false });
  engine.selectEvents([second.id, different.id]);
  const before = structuredClone(engine.score);
  assert.throws(() => engine.addTie(), /same pitch/i);
  assert.deepEqual(engine.score, before);
});

test('Build 43 phrase slurs span ordered positions and survive undo, redo and airscore reopen', () => {
  const engine = createEngine({ score: score() });
  const notes = addRun(engine, [0, 1, 2], 1);
  engine.selectEvents(notes.map(note => note.id));
  const slur = engine.addSlur();
  assert.equal(slur.type, 'slur');
  assert.equal(slur.startEventId, notes[0].id);
  assert.equal(slur.endEventId, notes[2].id);

  assert.equal(engine.undo(), true);
  assert.equal(engine.score.spanners.some(item => item.type === 'slur'), false);
  assert.equal(engine.redo(), true);
  assert.equal(engine.score.spanners.some(item => item.type === 'slur'), true);

  const reopened = createEngine();
  reopened.openAirscore(engine.serializeAirscore());
  assert.deepEqual(
    reopened.score.spanners.filter(item => item.type === 'slur').map(item => [item.startEventId, item.endEventId]),
    [[notes[0].id, notes[2].id]]
  );
});

test('Build 43 four-voice stem policy is deterministic and colour independent', () => {
  const lane = [
    { start: 0, voice: 1, midi: 72 },
    { start: 0, voice: 2, midi: 60 },
    { start: 0, voice: 3, midi: 67 },
    { start: 0, voice: 4, midi: 55 }
  ];
  assert.equal(rhythmic.stemDirection(lane[0], lane), 'up');
  assert.equal(rhythmic.stemDirection(lane[1], lane), 'down');
  assert.equal(rhythmic.stemDirection(lane[2], lane), 'up');
  assert.equal(rhythmic.stemDirection(lane[3], lane), 'down');
  assert.equal(rhythmic.stemDirection({ start: 1, voice: 1, midi: 76 }, []), 'down');
  assert.equal(rhythmic.stemDirection({ start: 1, voice: 1, midi: 55 }, []), 'up');
});

test('Build 43 exports real tuplets, beams, ties and slurs to MusicXML', () => {
  const engine = createEngine({ score: score() });
  const triplet = addRun(engine, [0, 0.5, 1], 0.5);
  engine.selectEvents(triplet.map(note => note.id));
  engine.setTuplet(3, 2);

  const tieA = engine.addNote({ pitch: 'G4', start: 2, duration: 1, advance: false });
  const tieB = engine.addNote({ pitch: 'G4', start: 3, duration: 1, advance: false });
  engine.selectEvents([tieA.id, tieB.id]);
  engine.addTie();

  const slurNotes = [
    engine.addNote({ pitch: 'A4', start: 4, duration: 1, advance: false }),
    engine.addNote({ pitch: 'B4', start: 5, duration: 1, advance: false }),
    engine.addNote({ pitch: 'C5', start: 6, duration: 1, advance: false })
  ];
  engine.selectEvents(slurNotes.map(note => note.id));
  engine.addSlur();

  const xml = engine.exportMusicXml();
  assert.match(xml, /<time-modification><actual-notes>3<\/actual-notes><normal-notes>2<\/normal-notes><\/time-modification>/);
  assert.match(xml, /<beam number="1">begin<\/beam>/);
  assert.match(xml, /<tie type="start"\/>/);
  assert.match(xml, /<tied type="stop"\/>/);
  assert.match(xml, /<slur type="start"/);
  assert.match(xml, /<slur type="stop"/);
});

test('Build 43 production renderer exposes one real rhythm keypad and grouped engraving paths', () => {
  const projectRoot = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(projectRoot, 'src/composer3/index.html'), 'utf8');
  const app = fs.readFileSync(path.join(projectRoot, 'src/composer3/app.js'), 'utf8');
  const css = fs.readFileSync(path.join(projectRoot, 'src/composer3/styles.css'), 'utf8');
  const engine = fs.readFileSync(path.join(projectRoot, 'src/composer3/engine-api.js'), 'utf8');

  assert.match(html, /rhythmic-notation-service\.js/);
  assert.match(html, /data-input-control="triplet"/);
  assert.match(html, /data-input-control="beam-selected"/);
  assert.match(html, /data-input-control="beam-auto"/);
  assert.match(html, /data-input-control="remove-beams"/);
  assert.match(html, /data-input-control="tie"/);
  assert.match(html, /data-input-control="slur"/);
  assert.doesNotMatch(html, /data-command="beamBegin"/);
  assert.doesNotMatch(html, /data-command="beamContinue"/);
  assert.doesNotMatch(html, /data-command="beamEnd"/);

  assert.match(app, /class: `rhythmic-beam beam-level-\$\{beamNumber\}`/);
  assert.match(app, /class: `spanner-path \$\{spanner\.type\}`/);
  assert.match(app, /class: 'tuplet-bracket'/);
  assert.match(app, /ctrl && event\.key === '3'/);
  assert.match(app, /ctrl && event\.key\.toLowerCase\(\) === 'b'/);
  assert.match(css, /\.rhythmic-beam/);
  assert.match(css, /\.spanner-path/);
  assert.match(css, /\.tuplet-bracket/);
  assert.match(engine, /rhythmicNotation\.applyTuplet/);
  assert.match(engine, /rhythmicNotation\.applyAutomaticBeams/);
});

test('Build 43 rhythmic behavior remains packaged in a later continuation build', () => {
  const packageJson = require('../package.json');
  assert.ok(Number(packageJson.buildNumber) >= 47);
  assert.equal(packageJson.buildVersion, packageJson.build.buildVersion);
  assert.match(packageJson.buildVersion, new RegExp(`\\.${packageJson.buildNumber}$`));
  assert.match(packageJson.build.nsis.artifactName, new RegExp(`\\$\\{version\\}-Build${packageJson.buildNumber}-Setup`));
  assert.match(packageJson.build.portable.artifactName, new RegExp(`\\$\\{version\\}-Build${packageJson.buildNumber}-Portable`));
});
