'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const files = require('../src/core/file-publishing-service');
const model = require('../src/core/score-model');

function score() {
  const value = model.createScore({ title: 'Premium Test', template: 'satb', measures: 4 });
  value.composer = 'Airmonlink';
  return value;
}

test('Build 38 project envelope preserves authoritative score and detects corruption', () => {
  const source = score();
  source.settings.mixer = { channels: [{ partId: source.parts[0].id, gain: 1 }] };
  source.pluginData = { example: { enabled: true } };
  const envelope = files.projectEnvelope(source, { savedAt: '2026-01-01T00:00:00.000Z' });
  assert.equal(files.validateEnvelope(envelope).valid, true);
  assert.deepEqual(envelope.score.parts.map(part => part.id), source.parts.map(part => part.id));
  const damaged = JSON.parse(JSON.stringify(envelope));
  damaged.score.title = 'Changed after checksum';
  assert.equal(files.validateEnvelope(damaged).valid, false);
  assert.equal(files.validateEnvelope(damaged).issues[0].code, 'CHECKSUM_MISMATCH');
});

test('Build 38 future projects open read-only and older projects require backup migration', () => {
  const future = files.projectEnvelope(score());
  const futureCopy = { ...future, schemaVersion: files.CURRENT_SCHEMA + 1 };
  delete futureCopy.checksum;
  const validation = files.validateEnvelope(futureCopy, { requireChecksum: false });
  assert.equal(validation.readOnly, true);
  const old = { schemaVersion: 9, score: score() };
  const plan = files.migrationPlan(old);
  assert.equal(plan.allowed, true);
  assert.equal(plan.backupRequired, true);
  assert.equal(plan.steps.length, files.CURRENT_SCHEMA - 9);
});

test('Build 38 atomic saving stages, verifies and rolls back before replacing', () => {
  const plan = files.atomicSavePlan('/scores/example.airscore', Buffer.from('score'), { now: 10 });
  assert.match(plan.tempPath, /\.tmp$/);
  assert.equal(plan.verifyBeforeReplace, true);
  assert.equal(plan.replaceAtomically, true);
  assert.equal(plan.rollbackOnFailure, true);
});

test('Build 38 autosave creates deterministic recoverable plans', () => {
  const plan = files.autosavePlan(score(), 'doc-1', { intervalSeconds: 2, retain: 100 });
  assert.equal(plan.intervalSeconds, 10);
  assert.equal(plan.retain, 50);
  assert.match(plan.recoveryName, /\.recovery\.airscore$/);
  assert.equal(plan.atomic, true);
});

test('Build 38 publishing plan creates deterministic score and part filenames', () => {
  const source = score();
  const plan = files.publishingPlan(source, { formats: ['pdf', 'png'], includeParts: true, watermark: 'DRAFT' });
  assert.equal(plan.targets.length, (source.parts.length + 1) * 2);
  assert.equal(new Set(plan.targets.map(item => item.filename)).size, plan.targets.length);
  assert.equal(plan.watermark, 'DRAFT');
  assert.equal(plan.pdfMetadata.author, 'Airmonlink');
});

test('Build 38 publishing transaction commits all files or cleans every staged file', async () => {
  const plan = files.publishingPlan(score(), { formats: ['pdf'] });
  const removed = [];
  const success = await files.executeExportTransaction(plan, {
    render: async () => Buffer.from('pdf'),
    writeTemp: async name => `${name}.tmp`,
    commit: async (_, name) => name,
    remove: async name => removed.push(name)
  });
  assert.equal(success.status, 'completed');
  const failed = await files.executeExportTransaction(plan, {
    render: async () => { throw new Error('renderer failed'); },
    writeTemp: async name => `${name}.tmp`,
    commit: async (_, name) => name,
    remove: async name => removed.push(name)
  });
  assert.equal(failed.status, 'rolled-back');
  assert.deepEqual(failed.files, []);
});

test('Build 38 templates and house styles validate without changing musical events', () => {
  assert.equal(files.BUILTIN_TEMPLATES.length >= 4, true);
  assert.equal(files.validateTemplate(files.BUILTIN_TEMPLATES[0]).valid, true);
  const source = score();
  const before = JSON.stringify(source.parts.map(part => part.events));
  const styled = files.applyHouseStyle(source, 'choral');
  assert.equal(JSON.stringify(styled.parts.map(part => part.events)), before);
  assert.equal(styled.settings.houseStyle, 'choral');
});

test('Build 38 plugin manifests reject undeclared and incompatible permissions', () => {
  const invalid = files.validatePluginManifest({ id: 'x', version: '1', apiVersion: '9', permissions: ['system.shell'] });
  assert.equal(invalid.valid, false);
  const valid = files.validatePluginManifest({
    id: 'example.analysis',
    version: '1.0.0',
    apiVersion: files.PLUGIN_API_VERSION,
    permissions: ['score.read', 'analysis.run']
  });
  assert.equal(valid.valid, true);
});

test('Build 38 plugin host exposes only declared capabilities and isolates failures', () => {
  const host = files.createPluginHost({
    id: 'example.analysis',
    version: '1.0.0',
    apiVersion: files.PLUGIN_API_VERSION,
    permissions: ['score.read', 'analysis.run']
  }, {
    readScore: () => ({ title: 'Protected copy' }),
    analyse: request => ({ request }),
    execute: command => { if (command === 'crash') throw new Error('plugin boom'); return command; }
  });
  const copy = host.api.readScore();
  copy.title = 'mutated';
  assert.equal(host.api.readScore().title, 'Protected copy');
  assert.throws(() => host.api.mutate({ name: 'edit' }), /lacks permission/);
  assert.equal(host.run('crash').status, 'isolated-error');
  host.disable();
  assert.equal(host.run('anything').status, 'disabled');
});

test('Build 38 safe uninstall disables plugin and removes private settings', () => {
  const host = files.createPluginHost({
    id: 'example.settings',
    version: '1.0.0',
    apiVersion: files.PLUGIN_API_VERSION,
    permissions: ['settings.read', 'settings.write']
  });
  host.api.setSetting('mode', 'safe');
  assert.equal(host.api.getSetting('mode'), 'safe');
  assert.equal(host.uninstall().removed, true);
  assert.deepEqual(host.status().settings, {});
});

test('Build 38 OMR review never mutates score and flags low-confidence events', () => {
  const review = files.recognitionReview('omr', 'page-image', [
    { midi: 60, start: 0, duration: 1, confidence: .98 },
    { midi: 62, start: 1, duration: 1, confidence: .42 }
  ]);
  assert.equal(review.mutatesScore, false);
  assert.equal(review.requiresHumanReview, true);
  assert.equal(review.lowConfidenceCount, 1);
});

test('Build 38 audio transcription review enforces input limits and confidence review', () => {
  const review = files.recognitionReview('audio-transcription', 'audio-digest', [{ midi: 64, confidence: .8 }], { autoReviewThreshold: .85 });
  assert.equal(review.lowConfidenceCount, 1);
  assert.throws(() => files.recognitionReview('audio-transcription', 'audio', Array.from({ length: 3 }, () => ({})), { maximumCandidates: 2 }), /safety limit/);
});
