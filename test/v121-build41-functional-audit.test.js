'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const registry = require('../src/composer3/functional-command-registry');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src/composer3/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/composer3/app.js'), 'utf8');
const commands = [...new Set([...html.matchAll(/data-command="([^"]+)"/g)].map(match => match[1]))];

function fakeEngine(patch = {}) {
  const state = {
    score: { parts: [{ id: 'part-1' }] },
    activePartId: 'part-1',
    selectedEvents: [],
    canUndo: false,
    canRedo: false,
    playing: false,
    transport: { paused: false },
    midi: { deviceId: null, outputDeviceId: null },
    ...patch
  };
  return {
    clipboard: patch.clipboard || null,
    state: () => state
  };
}

test('Build 43 preserves registration for every production data-command control', () => {
  assert.ok(commands.length >= 109);
  const audit = registry.audit(commands);
  assert.deepEqual(audit.missing, []);
  assert.equal(audit.registered, commands.length);
  for (const id of commands) {
    const entry = registry.COMMANDS[id];
    assert.equal(entry.id, id);
    assert.ok(entry.label);
    assert.ok(entry.group);
    assert.ok(entry.panel);
    assert.ok(entry.status);
    assert.ok(Array.isArray(entry.requiredContext));
    assert.ok(entry.requiredContext.length > 0);
    assert.ok(entry.reason);
    assert.ok(Number(entry.scheduledBuild) >= 41);
  }
});

test('Build 50 promotes all commands only after functional evidence', () => {
  const counts = Object.values(registry.COMMANDS).reduce((result, command) => {
    result[command.status] = (result[command.status] || 0) + 1;
    return result;
  }, {});
  assert.deepEqual(counts, {
    'VERIFIED FUNCTIONAL': Object.keys(registry.COMMANDS).length
  });
  for (const id of ['addNote', 'addRest', 'addChordTone', 'addThird', 'addFifth', 'dotSelected']) {
    assert.equal(registry.COMMANDS[id].status, registry.STATUS.VERIFIED);
    assert.equal(registry.COMMANDS[id].scheduledBuild, 42);
  }
  for (const id of [
    'tripletSelected', 'beamSelected', 'beamAuto', 'removeBeams',
    'tie', 'slur', 'staccato', 'tenuto', 'accent', 'marcato',
    'fermata', 'trill', 'turn', 'applyTechnique', 'removeSpanners'
  ]) {
    assert.equal(registry.COMMANDS[id].status, registry.STATUS.VERIFIED, id);
    assert.equal(registry.COMMANDS[id].scheduledBuild, 43, id);
  }
  assert.equal(registry.COMMANDS.print.status, registry.STATUS.VERIFIED);
});

test('Build 43 never exposes partial, broken or hardware-blocked controls as production commands', () => {
  const engine = fakeEngine({ canUndo: true, canRedo: true });
  for (const command of Object.values(registry.COMMANDS)) {
    const result = registry.evaluate(command.id, engine);
    if (command.status === registry.STATUS.VERIFIED) continue;
    assert.equal(result.visible, false, command.id);
    assert.equal(result.enabled, false, command.id);
    assert.ok(result.reason, command.id);
  }
});

test('Build 43 verified controls respect real context instead of throwing avoidable engine errors', () => {
  assert.equal(registry.evaluate('undo', fakeEngine()).enabled, false);
  assert.deepEqual(registry.evaluate('undo', fakeEngine()).missing, ['undo-history']);
  assert.equal(registry.evaluate('undo', fakeEngine({ canUndo: true })).enabled, true);

  assert.equal(registry.evaluate('redo', fakeEngine()).enabled, false);
  assert.equal(registry.evaluate('redo', fakeEngine({ canRedo: true })).enabled, true);

  assert.equal(registry.evaluate('appendMeasure', fakeEngine({ activePartId: null })).enabled, false);
  assert.equal(registry.evaluate('appendMeasure', fakeEngine()).enabled, true);
  assert.equal(registry.evaluate('addChordTone', fakeEngine()).enabled, false);
  assert.equal(registry.evaluate('addChordTone', fakeEngine({
    lastEntry: { type: 'note', eventIds: ['note-1'] }
  })).enabled, true);
});

test('Build 50 exposes verified workspace modes and Composition Hub without legacy beam controls', () => {
  assert.doesNotMatch(html, /id="beamValue"/);
  assert.match(html, /data-command="beamSelected"/);
  assert.match(html, /data-command="beamAuto"/);
  assert.match(html, /data-command="removeBeams"/);
  assert.match(html, /composition-launcher"[^>]*data-functional-stage="verified-build50"/);
  assert.doesNotMatch(html, /composition-launcher"[^>]*hidden/);
  for (const mode of ['engrave', 'play', 'publish']) {
    assert.match(html, new RegExp(`data-workspace-mode="${mode}"[^>]*data-functional-stage="verified-build50"`));
    assert.doesNotMatch(html, new RegExp(`data-workspace-mode="${mode}"[^>]*hidden`));
  }
  assert.match(html, /functional-command-registry\.js/);
  assert.ok(html.indexOf('functional-command-registry.js') < html.indexOf('app.js'));
});

test('Build 43 renderer applies the registry to buttons, groups, tabs and command palette', () => {
  assert.match(app, /function refreshFunctionalCommandState/);
  assert.match(app, /control\.hidden = !result\.visible/);
  assert.match(app, /control\.disabled = !result\.enabled/);
  assert.match(app, /group\.hidden = !group\.querySelector/);
  assert.match(app, /control\.hidden \|\| control\.disabled/);
  assert.match(app, /refreshFunctionalCommandState\(state\)/);
});

test('Build 41 creates the mandatory audit records', () => {
  for (const relative of [
    'docs/BUILD40-FUNCTIONAL-AUDIT.md',
    'docs/CONTROL-ENGINE-TRACEABILITY.csv',
    'docs/DECORATIVE-CONTROLS-REMOVAL-LIST.md',
    'docs/PROFESSIONAL-WORKFLOW-GAPS.md',
    'docs/BUILD41-REQUIREMENTS-STATUS.md'
  ]) {
    const file = path.join(root, relative);
    assert.equal(fs.existsSync(file), true, relative);
    assert.ok(fs.statSync(file).size > 200, relative);
  }
  const csv = fs.readFileSync(path.join(root, 'docs/CONTROL-ENGINE-TRACEABILITY.csv'), 'utf8');
  assert.equal(csv.split(/\r?\n/).filter(Boolean).length, Object.keys(registry.COMMANDS).length + 1);
  assert.match(csv, /data-command:addNote/);
  assert.match(csv, /VERIFIED FUNCTIONAL/);
});
