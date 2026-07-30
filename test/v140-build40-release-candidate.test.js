'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const model = require('../src/core/score-model');
const choir = require('../src/core/choir-solfa-service');
const hub = require('../src/core/composition-hub-service');
const parts = require('../src/core/parts-engraving-service');
const practice = require('../src/core/practice-audio-service');
const formats = require('../src/core/formats');
const airscore = require('../src/core/airscore');
const audit = require('../src/core/release-audit-service');
const { createEngine } = require('../src/composer3/engine-api');

const authored = score => score.parts.flatMap(part => (part.events || []).filter(event => event.generatedBy !== 'gap-fill').map(event => ({ part, event })));

test('Build 40 five-zone desktop exposes all workspace modes and premium navigation', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/composer3/index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../src/composer3/app.js'), 'utf8');
  for (const zone of ['topbar', 'command-deck', 'workspace', 'piano-panel', 'statusbar']) assert.match(html, new RegExp(zone));
  for (const mode of audit.REQUIRED_MODES) assert.match(html, new RegExp(`data-workspace-mode="${mode}"`));
  assert.match(html, /id="startCentre"/);
  assert.match(html, /id="compositionHub"/);
  assert.match(html, /id="commandPalette"/);
  assert.match(app, /activateWorkspaceMode/);
  assert.match(app, /WORKSPACE_MODE_TABS/);
});

test('Build 40 design tokens preserve official premium palette and semantic states', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/composer3/styles.css'), 'utf8');
  const report = audit.designTokenAudit({
    navy: '#071b36', royalBlue: '#1749a0', white: '#ffffff', gold: '#d8b14d',
    violetAccent: '#6657b8', focus: '#f4ca63', danger: '#a52135', success: '#17734a'
  });
  assert.equal(report.passed, true);
  for (const token of ['--airmon-navy', '--airmon-royal', '--airmon-gold', '--airmon-focus', '--airmon-danger', '--airmon-success']) assert.match(css, new RegExp(token));
});

test('Build 40 SATB workflow harmonises, applies lyrics, converts Sol-fa, renders practice audio and reopens', () => {
  const score = model.createScore({ template: 'satb', measures: 8, autoFillRests: false, key: 'C' });
  const soprano = score.parts[0];
  const melody = [60, 62, 64, 65, 67, 65, 64, 62].map((midi, index) =>
    model.addNote(score, soprano.id, { midi, start: index, duration: 1, voice: 1 }));
  choir.applyLyrics(score, 'Sing-ing praise to-geth-er now', { partIds: [soprano.id], voice: 1, verse: 1 });
  choir.applyLyrics(score, 'Glo-ry rise and fill our song', { partIds: [soprano.id], voice: 1, verse: 2 });
  const context = hub.selectionContext(score, melody.map(event => ({ part: soprano, event })));
  const preview = hub.harmonyPreview(score, context, { style: 'hymn', destination: 'satb-parts' });
  assert.equal(preview.alternatives.length >= 3, true);
  const applied = hub.applyPreview(score, preview, { alternativeIndex: 0, destination: 'satb-parts' });
  assert.ok(applied);
  assert.equal(choir.verifySynchronization(score).valid, true);
  const solfaText = require('../src/core/solfa').scoreToSolfaText(score, { partIds: [soprano.id] });
  assert.match(solfaText, /\bd\b/i);
  const wav = practice.renderWav(score, { sampleRate: 8000, channels: 1 });
  assert.equal(Buffer.from(wav.bytes).subarray(0, 4).toString(), 'RIFF');
  const saved = airscore.serialize(score);
  const reopened = airscore.deserialize(saved);
  assert.equal(reopened.parts.length, score.parts.length);
  assert.equal(authored(reopened).filter(item => item.event.type === 'note').length, authored(score).filter(item => item.event.type === 'note').length);
  assert.match(formats.exportMusicXML(reopened), /<score-partwise/);
  assert.equal(Buffer.from(formats.exportMidi(reopened)).subarray(0, 4).toString(), 'MThd');
});

test('Build 43 piano workflow preserves real chord tuplets, marks, pedal and layout through reopen', () => {
  const engine = createEngine({ score: model.createScore({ template: 'piano', measures: 4, autoFillRests: false }) });
  const piano = engine.score.parts[0];
  engine.setActivePart(piano.id);
  const chords = [
    engine.addPianoChord([60, 64, 67], { start: 0, duration: 0.5, staff: 'treble' }),
    engine.addPianoChord([62, 65, 69], { start: 0.5, duration: 0.5, staff: 'treble' }),
    engine.addPianoChord([64, 67, 71], { start: 1, duration: 0.5, staff: 'treble' })
  ];
  engine.selectEvents(chords.flat().map(event => event.id));
  engine.setTuplet(3, 2);
  engine.setArticulation('staccato', true);
  engine.addDynamic('mf');
  engine.addAnnotation('pedal', 'Ped.');
  engine.setSettings({ concertPitch: true, pageSize: 'A4' });
  const before = engine.state().score.parts[0].events.filter(event => event.type === 'note');
  assert.equal(before.length, 9);
  assert.deepEqual([...new Set(before.map(event => event.start))], [0, 1 / 3, 2 / 3]);
  assert.ok(before.every(event => event.tuplet?.actual === 3 && event.tuplet?.normal === 2));
  const reopened = createEngine();
  reopened.openAirscore(engine.serializeAirscore());
  const after = reopened.state().score.parts[0].events.filter(event => event.type === 'note');
  assert.deepEqual(
    after.map(event => [event.id, event.midi, event.start, event.duration, event.tuplet?.actual, event.tuplet?.normal]),
    before.map(event => [event.id, event.midi, event.start, event.duration, event.tuplet?.actual, event.tuplet?.normal])
  );
  assert.ok(reopened.layoutPlan({ width: 1000 }).systems.length >= 1);
  assert.match(reopened.exportMusicXml(), /<score-partwise/);
});

test('Build 40 ensemble workflow preserves transposition, linked parts, cues and deterministic output', () => {
  const score = model.createScore({ template: 'orchestra', measures: 8, autoFillRests: false });
  const source = score.parts[0];
  const target = score.parts[1];
  source.transpose = -2;
  const note = model.addNote(score, source.id, { midi: 72, start: 0, duration: 1 });
  const linked = parts.linkedPartDescriptors(score);
  assert.ok(linked.some(item => item.sourcePartIds.includes(source.id)));
  const cues = parts.createCue(score, target.id, source.id, { start: 0, end: 4, label: source.name });
  assert.equal(cues.length, 1);
  assert.equal(cues[0].cueSourceEventId, note.id);
  assert.equal(cues[0].mutedInPlayback, true);
  const plan = parts.batchExportPlan(score, { version: '1.2.0', build: 40, format: 'pdf' });
  assert.equal(new Set(plan.map(item => item.filename)).size, plan.length);
  const reopened = airscore.deserialize(airscore.serialize(score));
  assert.equal(reopened.parts.find(part => part.id === source.id).transpose, -2);
  assert.equal(reopened.parts.find(part => part.id === target.id).events.some(event => event.cueSourceEventId === note.id), true);
});

test('Build 40 Tonic Sol-fa workflow preserves punctuation, shared events, playback and multi-page publication', () => {
  const engine = createEngine({ score: model.createScore({ template: 'satb', measures: 8, autoFillRests: false, key: 'C' }) });
  engine.setActivePart(engine.score.parts[0].id);
  const result = engine.applySolfaPassage("d, r. m - _ | f s l t d' | d' t l s | f m r d |", {
    voice: 1, replace: true, allowIncompleteMeasures: true
  });
  assert.equal(result.valid, true);
  assert.deepEqual(engine.verifySolfa(), []);
  const notes = engine.score.parts[0].events.filter(event => event.type === 'note');
  engine.selectEvent(notes[0].id);
  engine.updateSelectedFromSolfa('m');
  assert.equal(engine.score.parts[0].events.find(event => event.id === notes[0].id).midi, 64);
  const playback = require('../src/core/playback').buildPlaybackNotes(engine.score);
  assert.ok(playback.length > 0);
  const pages = engine.solfaPages({ pageHeight: 500, contentHeight: 360, systemGap: 40 });
  assert.ok(pages.pages.length >= 1);
  const reopened = createEngine();
  reopened.openAirscore(engine.serializeAirscore());
  assert.deepEqual(reopened.verifySolfa(), []);
});

test('Build 40 source architecture has no hidden legacy dependency and retains restricted Electron boundaries', () => {
  const source = {
    html: fs.readFileSync(path.join(__dirname, '../src/composer3/index.html'), 'utf8'),
    app: fs.readFileSync(path.join(__dirname, '../src/composer3/app.js'), 'utf8'),
    engine: fs.readFileSync(path.join(__dirname, '../src/composer3/engine-api.js'), 'utf8'),
    main: fs.readFileSync(path.join(__dirname, '../src/composer3/main.js'), 'utf8'),
    preload: fs.readFileSync(path.join(__dirname, '../src/composer3/preload.js'), 'utf8')
  };
  const result = audit.sourceArchitectureAudit(source);
  assert.equal(result.passed, true, JSON.stringify(result.issues));
  assert.equal(result.issues.some(issue => issue.code === 'LEGACY_REFERENCE'), false);
});

test('Build 40 release audit refuses completion without Windows artifacts and manual evidence', () => {
  const architecture = { passed: true };
  const suiteNames = ['unit', 'syntax', 'browser', 'viewport', 'performance', 'security', 'accessibility', 'recovery'];
  const suites = Object.fromEntries(suiteNames.map(name => [name, { passed: true, evidence: `${name} passed` }]));
  const scenarios = audit.REQUIRED_SCENARIOS.map(name => ({ name, steps: [{ label: 'automated scenario', passed: true, evidence: 'test' }] }));
  const cycles = [1, 2, 3].map(cycle => audit.auditCycle({
    cycle, architecture, suites, scenarios,
    windowsPackaging: { available: false, passed: false, blocker: 'GitHub embargo and Linux-only environment prevent Windows packaging.' }
  }));
  assert.ok(cycles.every(cycle => cycle.passed === false));
  assert.equal(audit.threeCycleGate(cycles).passed, false);
  const decision = audit.releaseDecision({
    requirements: [{ id: 'windows-package', title: 'Windows packaging', status: 'IMPLEMENTED BUT NOT VERIFIED', blockers: ['No Windows runner'] }],
    cycles,
    artifacts: { installer: null, portableSupported: true, portable: null },
    restoreVerification: { passed: true }
  });
  assert.equal(decision.releaseReady, false);
  assert.match(decision.blockers.join(' '), /installer|requirements|audit/i);
});

test('current metadata and workflow names identify the active Build 51–60 continuation checkpoint', () => {
  const packageJson = require('../package.json');
  const main = fs.readFileSync(path.join(__dirname, '../src/composer3/main.js'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../src/composer3/app.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../src/composer3/index.html'), 'utf8');
  const build = Number(packageJson.buildNumber);
  assert.equal(packageJson.version, '1.3.0');
  assert.ok(build >= 51 && build <= 60);
  assert.equal(packageJson.build.buildVersion, `1.3.0.${build}`);
  assert.match(packageJson.build.nsis.artifactName, new RegExp(`Build${build}-Setup`));
  assert.match(packageJson.build.portable.artifactName, new RegExp(`Build${build}-Portable`));
  assert.match(main, new RegExp(`const BUILD = ${build}`));
  assert.match(app, new RegExp(`const BUILD = ${build}`));
  assert.match(html, new RegExp(`1\\.3\\.0 · Build ${build}`));
});
