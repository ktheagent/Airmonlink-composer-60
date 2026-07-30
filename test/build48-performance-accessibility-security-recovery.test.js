'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const model = require('../src/core/score-model');
const layout = require('../src/core/layout-engine');
const productivity = require('../src/core/productivity-reliability-service');
const security = require('../src/desktop/security-service');
const { createEngine } = require('../src/composer3/engine-api');

test('Build 48 measured semantic entry, selection and reflow stay within declared local budgets', () => {
  const engine = createEngine({ template: 'lead', measures: 128, autoFillRests: false });
  let started = performance.now();
  const notes = Array.from({ length: 100 }, (_, index) =>
    engine.addNote({ midi: 60 + index % 12, start: index * .25, duration: .25, voice: index % 4 + 1, advance: false }));
  const entryPerNoteMs = (performance.now() - started) / notes.length;
  started = performance.now();
  engine.selectEvents(notes.map(note => note.id));
  const selectionMs = performance.now() - started;
  started = performance.now();
  const plan = layout.buildSystemPlan(engine.score, { availableWidth: 950, maxMeasures: 8 });
  const reflowMs = performance.now() - started;
  const report = productivity.performanceReport({
    noteInputMs: entryPerNoteMs,
    selectionMs,
    reflowMs,
    pageRenderMs: reflowMs,
    zoomMs: 0,
    startupColdMs: 0,
    startupWarmMs: 0,
    usableScoreMs: 0,
    scrollFrameMs: 0,
    playbackStartMs: 0,
    importMs: 0,
    exportMs: 0,
    pdfMs: 0,
    shutdownMs: 0,
    largeScoreMemoryMb: process.memoryUsage().heapUsed / 1024 / 1024
  });
  assert.ok(plan.systems.length > 0);
  assert.equal(report.passed, true, JSON.stringify(report.results.filter(item => !item.passed)));
});

test('Build 48 accessibility source has keyboard focus, live errors, scalable controls, contrast and reduced motion', () => {
  const html = fs.readFileSync(path.join(__dirname, '../src/composer3/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../src/composer3/styles.css'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../src/composer3/app.js'), 'utf8');
  assert.match(html, /role="alert"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-label="Score inspector"/);
  assert.match(html, /aria-label="Searchable notation palette"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /body\.high-contrast/);
  assert.match(css, /body\.large-controls/);
  assert.match(app, /event\.key === 'Enter' \|\| event\.key === ' '/);
});

test('Build 48 external URL policy blocks scripts, credentials, localhost and malformed links', () => {
  assert.equal(security.safeExternalUrl('https://example.com/help'), 'https://example.com/help');
  assert.throws(() => security.safeExternalUrl('javascript:alert(1)'), /HTTP/);
  assert.throws(() => security.safeExternalUrl('https://user:secret@example.com'), /credentials/);
  assert.throws(() => security.safeExternalUrl('http://localhost:3000'), /Localhost/);
  assert.throws(() => security.safeExternalUrl('not a url'), /malformed/);
});

test('Build 48 path and input policies reject traversal-like type confusion and oversized imports', () => {
  assert.match(security.safeUserFilePath('/scores/work.airscore', { extensions: ['airscore'] }), /work\.airscore$/);
  assert.throws(() => security.safeUserFilePath('/scores/work.exe', { extensions: ['airscore'] }), /not allowed/);
  assert.equal(security.enforceInputSize('1234', 4), 4);
  assert.throws(() => security.enforceInputSize('12345', 4, 'MusicXML'), error => error.code === 'OVERSIZED_INPUT');
});

test('Build 48 Electron boundary remains isolated and validates every external URL in the main process', () => {
  const main = fs.readFileSync(path.join(__dirname, '../src/composer3/main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(__dirname, '../src/composer3/preload.js'), 'utf8');
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
  assert.match(main, /shell\.openExternal\(safeExternalUrl\(url\)\)/);
  assert.doesNotMatch(preload, /require\(['"](?:fs|child_process|net|http|https)['"]\)/);
});

test('Build 48 recovery guidance covers disk, permissions, corruption, devices and plugin isolation', () => {
  const cases = {
    ENOSPC: 'DISK_FULL',
    EACCES: 'READ_ONLY',
    CORRUPT_PROJECT: 'DAMAGED_PROJECT',
    DEVICE_UNAVAILABLE: 'DEVICE_UNAVAILABLE',
    PLUGIN_FAILURE: 'PLUGIN_FAILURE',
    ENOENT: 'MISSING_RESOURCE'
  };
  Object.entries(cases).forEach(([code, kind]) => {
    const result = productivity.classifyFailure(Object.assign(new Error(code), { code }));
    assert.equal(result.kind, kind);
    assert.ok(result.recovery.length > 10);
  });
});
