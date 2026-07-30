'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const registry = require('../src/composer3/functional-command-registry');
const releaseAudit = require('../src/core/release-audit-service');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src/composer3/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/composer3/app.js'), 'utf8');
const commandIds = [...new Set([...html.matchAll(/data-command="([^"]+)"/g)].map(match => match[1]))];
const executionCases = new Set([...app.matchAll(/case '([^']+)'/g)].map(match => match[1]));

function broadContext() {
  return {
    clipboard: { entries: [{}] },
    state: () => ({
      score: { parts: [{ id: 'part-1' }] },
      activePartId: 'part-1',
      selectedEvents: [
        { event: { id: 'note-1', type: 'note' } },
        { event: { id: 'note-2', type: 'note' } }
      ],
      lastEntry: { type: 'note' },
      canUndo: true,
      canRedo: true,
      playing: true,
      transport: { paused: true },
      midi: { deviceId: 'input-1', outputDeviceId: 'output-1' }
    })
  };
}

test('Build 50 audits every production command and exposes no decorative enabled control', () => {
  assert.ok(commandIds.length >= 109);
  assert.deepEqual(registry.audit(commandIds).missing, []);
  for (const id of commandIds) assert.equal(executionCases.has(id), true, `${id} has no renderer execution path`);

  const production = commandIds.filter(id => registry.COMMANDS[id].status === registry.STATUS.VERIFIED);
  const deferred = commandIds.filter(id => registry.COMMANDS[id].status !== registry.STATUS.VERIFIED);
  assert.equal(production.length, commandIds.length);
  assert.equal(deferred.length, 0);
  for (const id of production) assert.equal(registry.evaluate(id, broadContext()).visible, true, id);
  for (const id of deferred) {
    const state = registry.evaluate(id, broadContext());
    assert.equal(state.visible, false, id);
    assert.equal(state.enabled, false, id);
  }
});

test('Build 50 canonical traceability records every control and current release evidence', () => {
  const csv = fs.readFileSync(path.join(root, 'docs/CONTROL-ENGINE-TRACEABILITY.csv'), 'utf8');
  const report = JSON.parse(fs.readFileSync(path.join(root, 'docs/RELEASE-CONTROL-AUDIT.json'), 'utf8'));
  assert.equal(csv.split(/\r?\n/).filter(Boolean).length, commandIds.length + 1);
  assert.match(csv.split(/\r?\n/, 1)[0], /Current status/);
  assert.equal(report.totals.controls, commandIds.length);
  assert.equal(report.totals.productionEnabled, commandIds.length);
  assert.equal(report.totals.centrallyHidden, 0);
  assert.equal(report.gates.everyControlRegistered, true);
  assert.equal(report.gates.everyControlHasExecutionPath, true);
  assert.equal(report.gates.noIncompleteControlExposed, true);
});

test('Build 50 release service truthfully refuses the final gate with unavailable external evidence', () => {
  const cycle = releaseAudit.auditCycle({
    cycle: 1,
    architecture: { passed: true },
    suites: {
      unit: { passed: true, evidence: '397 automated tests before Build 50 additions' },
      syntax: { passed: true, evidence: 'lint passed' },
      browser: { passed: true, evidence: 'Build 50 Chromium interaction report passed' },
      viewport: { passed: true, evidence: 'Four-scenario Build 50 viewport matrix passed' },
      performance: { passed: true, evidence: 'performance budgets passed' },
      security: { passed: true, evidence: 'security tests and dependency audit passed' },
      accessibility: { passed: true, evidence: 'automated accessibility assertions passed' },
      recovery: { passed: true, evidence: 'automated recovery assertions passed' }
    },
    scenarios: releaseAudit.REQUIRED_SCENARIOS.map(name => ({
      name,
      steps: [{ label: 'automated workflow', passed: true, evidence: 'Node integration test' }]
    })),
    windowsPackaging: {
      available: false,
      passed: false,
      blocker: 'Windows installer and portable verification unavailable in this environment.'
    }
  });
  const decision = releaseAudit.releaseDecision({
    requirements: [{
      id: 'external-release-evidence',
      title: 'External release evidence',
      status: 'IMPLEMENTED BUT NOT VERIFIED',
      blockers: cycle.blockers
    }],
    cycles: [cycle],
    artifacts: { installer: null, portableSupported: true, portable: null },
    restoreVerification: { passed: true }
  });
  assert.equal(cycle.passed, false);
  assert.equal(decision.releaseReady, false);
  assert.equal(decision.status, 'IMPLEMENTED BUT NOT VERIFIED');
});
