'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/core/productivity-reliability-service');
const model = require('../src/core/score-model');

function score() {
  const value = model.createScore({ title: 'Build 39', template: 'lead', measures: 8 });
  const part = value.parts[0];
  model.addNote(value, part.id, { midi: 60, start: 0, duration: 1, voice: 1 });
  const second = model.addNote(value, part.id, { midi: 64, start: 1, duration: 1, voice: 2 });
  model.setLyric(value, part.id, second.id, 'Amen', { verse: 1 });
  return value;
}

test('Build 39 preferences clamp interface, autosave and exactly four voices', () => {
  const preferences = service.normalizePreferences({ interfaceScale: 9, autosaveSeconds: 1, workspace: 'engrave', selectionFilter: { voice: 9 } });
  assert.equal(preferences.interfaceScale, 2);
  assert.equal(preferences.autosaveSeconds, 10);
  assert.equal(preferences.workspace, 'engrave');
  assert.equal(preferences.selectionFilter.voice, 'all');
});

test('Build 39 command palette ranks labels, keywords and context', () => {
  const index = service.commandIndex([
    { id: 'save', label: 'Save score', category: 'File', keywords: ['project'], context: ['score'] },
    { id: 'harmony', label: 'Generate harmony', category: 'Compose', keywords: ['satb'], context: ['notes'] }
  ]);
  const results = service.searchCommands(index, 'harmony', ['notes']);
  assert.equal(results[0].id, 'harmony');
  assert.equal(results[0].enabled, true);
});

test('Build 39 shortcut editor detects reserved and duplicate shortcuts', () => {
  const report = service.validateShortcutMap({ save: 'control+s', duplicate: 'Ctrl+S', reload: 'Ctrl+R' });
  assert.equal(report.valid, false);
  assert.equal(report.issues.some(issue => issue.code === 'CONFLICT'), true);
  assert.equal(report.issues.some(issue => issue.code === 'RESERVED'), true);
});

test('Build 39 find and Go To searches authoritative notes and lyrics', () => {
  const source = score();
  const results = service.findInScore(source, { text: 'amen', eventType: 'note', measureAt: beat => Math.floor(beat / 4) });
  assert.equal(results.length, 1);
  assert.equal(results[0].measure, 1);
  assert.equal(results[0].partId, source.parts[0].id);
});

test('Build 39 navigator exposes measures, parts, pages and musical extent', () => {
  const source = score();
  const nav = service.navigatorModel(source, [{ startBeat: 0, endBeat: 4 }, { startBeat: 4, endBeat: 8 }]);
  assert.equal(nav.measures.length, 8);
  assert.equal(nav.parts.length, 1);
  assert.equal(nav.pages.length, 2);
  assert.equal(nav.totalBeats, model.totalBeats(source));
});

test('Build 39 selection filters are colour-independent and voice-aware', () => {
  const entries = score().parts[0].events.map(event => ({ event }));
  const filtered = service.applySelectionFilter(entries, { notes: true, rests: false, lyrics: true, voice: 2 });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].event.voice, 2);
});

test('Build 39 batch operation requires selection and one undo transaction', () => {
  const entries = score().parts[0].events.filter(event => event.type === 'note').map(event => ({ event }));
  const plan = service.batchPlan(entries, 'transpose', { semitones: 2 });
  assert.equal(plan.singleTransaction, true);
  assert.equal(plan.previewRequired, true);
  assert.equal(plan.eventIds.length, 2);
  assert.throws(() => service.batchPlan([], 'delete'), /requires a selection/);
});

test('Build 39 background tasks report progress and support cancellation', () => {
  const controller = new service.TaskController({ maximum: 2 });
  const updates = [];
  controller.subscribe(task => updates.push(task.status));
  const task = controller.start('Export score');
  task.update(.5, 'Rendering');
  assert.equal(task.cancel(), true);
  assert.deepEqual(updates, ['running', 'running', 'cancelled']);
  assert.equal(task.signal.aborted, true);
});

test('Build 39 notifications expose accessible assertive errors and actions', () => {
  const notice = service.notification('Export failed', { kind: 'error', actions: [{ id: 'retry', label: 'Retry' }] });
  assert.equal(notice.assertive, true);
  assert.equal(notice.actions[0].label, 'Retry');
});

test('Build 39 failure classifier gives recovery without claiming overwrite', () => {
  const full = service.classifyFailure({ code: 'ENOSPC' });
  assert.equal(full.kind, 'DISK_FULL');
  assert.equal(full.preservesOriginal, true);
  assert.match(full.recovery, /Free space/);
  const future = service.classifyFailure({ code: 'FUTURE_VERSION' });
  assert.equal(future.retryable, false);
});

test('Build 39 path and URL validation blocks traversal, scripts and credentials', () => {
  assert.equal(service.validatePath('../secret').valid, false);
  assert.equal(service.validatePath('/safe/score.airscore').valid, true);
  assert.equal(service.validateExternalUrl('javascript:alert(1)').valid, false);
  assert.equal(service.validateExternalUrl('https://user:pass@example.com').valid, false);
  assert.equal(service.validateExternalUrl('https://example.com/help').valid, true);
});

test('Build 39 performance report enforces every declared budget', () => {
  const samples = Object.fromEntries(Object.entries(service.DEFAULT_BUDGETS).map(([key, budget]) => [key, budget * .8]));
  const report = service.performanceReport(samples);
  assert.equal(report.passed, true);
  const failed = service.performanceReport({ ...samples, noteInputMs: 100 });
  assert.equal(failed.passed, false);
  assert.equal(failed.results.find(item => item.metric === 'noteInputMs').passed, false);
});

test('Build 39 Electron source retains restricted renderer and narrow preload bridge', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const main = fs.readFileSync(path.join(__dirname, '../src/composer3/main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(__dirname, '../src/composer3/preload.js'), 'utf8');
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.doesNotMatch(preload, /require\s*:\s*require|process\s*:\s*process/);
  assert.match(preload, /contextBridge\.exposeInMainWorld/);
});

test('Build 39 Composition Hub and project dialogs include accessible labels and live regions', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '../src/composer3/index.html'), 'utf8');
  assert.match(html, /aria-label="Premium Composition Hub"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-controls="compositionHub"/);
  assert.match(html, /role="status"/);
});
