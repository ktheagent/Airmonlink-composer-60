(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AirmonReleaseAudit = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STATUSES = Object.freeze([
    'VERIFIED COMPLETE',
    'IMPLEMENTED BUT NOT VERIFIED',
    'PARTIALLY IMPLEMENTED',
    'NOT IMPLEMENTED',
    'BLOCKED BY USER-SUPPLIED ACCESS OR INFORMATION'
  ]);
  const REQUIRED_ZONES = Object.freeze(['topbar', 'command-deck', 'workspace', 'piano-panel', 'statusbar']);
  const REQUIRED_MODES = Object.freeze(['setup', 'write', 'engrave', 'play', 'publish']);
  const REQUIRED_SCENARIOS = Object.freeze(['satb', 'piano', 'ensemble', 'tonic-solfa']);
  const clone = value => JSON.parse(JSON.stringify(value));

  function requirement(id, title, status, evidence = [], blockers = []) {
    if (!STATUSES.includes(status)) throw new Error(`Invalid completion status: ${status}.`);
    return Object.freeze({
      id: String(id), title: String(title), status,
      evidence: Object.freeze([...evidence].map(String)),
      blockers: Object.freeze([...blockers].map(String)),
      complete: status === 'VERIFIED COMPLETE'
    });
  }

  function requirementsRegister(entries = []) {
    const list = entries.map(item => requirement(item.id, item.title, item.status, item.evidence, item.blockers));
    const counts = Object.fromEntries(STATUSES.map(status => [status, list.filter(item => item.status === status).length]));
    return Object.freeze({
      entries: Object.freeze(list),
      counts: Object.freeze(counts),
      verified: list.every(item => item.complete)
    });
  }

  function sourceArchitectureAudit(source = {}) {
    const issues = [];
    const html = String(source.html || '');
    const app = String(source.app || '');
    const engine = String(source.engine || '');
    const main = String(source.main || '');
    const preload = String(source.preload || '');
    REQUIRED_ZONES.forEach(zone => {
      const token = zone === 'piano-panel' ? 'piano-panel' : zone;
      if (!html.includes(token)) issues.push({ severity: 'error', code: 'MISSING_ZONE', zone });
    });
    REQUIRED_MODES.forEach(mode => {
      if (!html.includes(`data-workspace-mode="${mode}"`)) issues.push({ severity: 'error', code: 'MISSING_MODE', mode });
    });
    if (!html.includes('compositionHub')) issues.push({ severity: 'error', code: 'MISSING_COMPOSITION_HUB' });
    if (!html.includes('commandPalette')) issues.push({ severity: 'error', code: 'MISSING_COMMAND_PALETTE' });
    if (/window\.airmonlinkBridge|hidden legacy|composer2/i.test(app + engine)) issues.push({ severity: 'warning', code: 'LEGACY_REFERENCE' });
    if (!/contextIsolation:\s*true/.test(main) || !/nodeIntegration:\s*false/.test(main)) issues.push({ severity: 'error', code: 'UNRESTRICTED_RENDERER' });
    if (!/contextBridge\.exposeInMainWorld/.test(preload)) issues.push({ severity: 'error', code: 'MISSING_PRELOAD_BRIDGE' });
    if (/require\s*:\s*require|process\s*:\s*process/.test(preload)) issues.push({ severity: 'error', code: 'OVEREXPOSED_PRELOAD' });
    if (!/Content-Security-Policy/.test(html)) issues.push({ severity: 'error', code: 'MISSING_CSP' });
    return Object.freeze({
      passed: !issues.some(issue => issue.severity === 'error'),
      issues: Object.freeze(issues.map(Object.freeze)),
      zones: REQUIRED_ZONES,
      modes: REQUIRED_MODES
    });
  }

  function scenarioResult(name, steps = []) {
    if (!REQUIRED_SCENARIOS.includes(name)) throw new Error(`Unknown release scenario: ${name}.`);
    const normalized = steps.map((step, index) => Object.freeze({
      index: index + 1,
      label: String(step.label || `Step ${index + 1}`),
      passed: step.passed === true,
      evidence: String(step.evidence || ''),
      error: step.error ? String(step.error) : null
    }));
    return Object.freeze({
      name,
      steps: Object.freeze(normalized),
      passed: normalized.length > 0 && normalized.every(step => step.passed)
    });
  }

  function auditCycle(input = {}) {
    const suites = input.suites || {};
    const scenarios = (input.scenarios || []).map(item => scenarioResult(item.name, item.steps));
    const requiredSuiteNames = ['unit', 'syntax', 'browser', 'viewport', 'performance', 'security', 'accessibility', 'recovery'];
    const suiteResults = requiredSuiteNames.map(name => Object.freeze({
      name,
      available: suites[name] != null,
      passed: suites[name]?.passed === true,
      evidence: String(suites[name]?.evidence || '')
    }));
    const packageResult = Object.freeze({
      available: input.windowsPackaging?.available === true,
      passed: input.windowsPackaging?.passed === true,
      evidence: String(input.windowsPackaging?.evidence || ''),
      blocker: input.windowsPackaging?.blocker ? String(input.windowsPackaging.blocker) : null
    });
    const blockers = [];
    suiteResults.filter(item => !item.passed).forEach(item => blockers.push(`${item.name} validation did not pass.`));
    REQUIRED_SCENARIOS.filter(name => !scenarios.some(item => item.name === name && item.passed))
      .forEach(name => blockers.push(`${name} end-to-end scenario did not pass.`));
    if (!input.architecture?.passed) blockers.push('Source architecture audit did not pass.');
    if (!packageResult.passed) blockers.push(packageResult.blocker || 'Windows production packaging did not pass.');
    if ((input.highSeverityDefects || []).length) blockers.push(`${input.highSeverityDefects.length} high-severity defects remain.`);
    return Object.freeze({
      cycle: Number(input.cycle) || 1,
      at: input.at || new Date().toISOString(),
      suites: Object.freeze(suiteResults),
      scenarios: Object.freeze(scenarios),
      architecture: input.architecture || Object.freeze({ passed: false }),
      windowsPackaging: packageResult,
      highSeverityDefects: Object.freeze([...(input.highSeverityDefects || [])].map(String)),
      passed: blockers.length === 0,
      blockers: Object.freeze(blockers)
    });
  }

  function threeCycleGate(cycles = []) {
    const sorted = [...cycles].sort((a, b) => Number(a.cycle) - Number(b.cycle));
    const last = sorted.slice(-3);
    const materiallyStable = last.length === 3
      && last.every(item => item.passed)
      && new Set(last.map(item => JSON.stringify(item.highSeverityDefects || []))).size === 1;
    return Object.freeze({
      passed: materiallyStable,
      cycleCount: sorted.length,
      considered: Object.freeze(last.map(item => item.cycle)),
      reason: materiallyStable ? 'Three consecutive whole-system cycles passed with no new material defect.'
        : last.length < 3 ? 'Three completed audit cycles are required.'
          : 'One or more of the last three cycles failed or exposed a material defect.'
    });
  }

  function releaseDecision(input = {}) {
    const register = requirementsRegister(input.requirements || []);
    const gate = threeCycleGate(input.cycles || []);
    const blockers = [];
    if (!register.verified) blockers.push(`${register.entries.filter(item => !item.complete).length} mandatory requirements are not VERIFIED COMPLETE.`);
    if (!gate.passed) blockers.push(gate.reason);
    if (!input.artifacts?.installer) blockers.push('Windows x64 installer is not confirmed.');
    if (input.artifacts?.portableSupported && !input.artifacts?.portable) blockers.push('Windows portable artifact is not confirmed.');
    if (!input.restoreVerification?.passed) blockers.push('Restored checkpoint verification did not pass.');
    return Object.freeze({
      releaseReady: blockers.length === 0,
      status: blockers.length === 0 ? 'VERIFIED COMPLETE' : 'IMPLEMENTED BUT NOT VERIFIED',
      blockers: Object.freeze(blockers),
      register,
      gate,
      artifacts: Object.freeze(clone(input.artifacts || {})),
      restoreVerification: Object.freeze(clone(input.restoreVerification || {}))
    });
  }

  function designTokenAudit(tokens = {}) {
    const required = ['navy', 'royalBlue', 'white', 'gold', 'violetAccent', 'focus', 'danger', 'success'];
    const missing = required.filter(key => !tokens[key]);
    const duplicate = Object.entries(tokens).filter(([key, value], index, entries) =>
      entries.findIndex(([otherKey, otherValue]) => otherValue === value && otherKey !== key) < index
    ).map(([key]) => key);
    return Object.freeze({ passed: !missing.length, missing: Object.freeze(missing), duplicate: Object.freeze(duplicate) });
  }

  function commandCoverage(controls = [], commands = []) {
    const registered = new Set(commands.map(String));
    const missing = controls.filter(control => !registered.has(String(control.command))).map(control => control.command);
    return Object.freeze({
      passed: !missing.length,
      controls: controls.length,
      registered: registered.size,
      missing: Object.freeze([...new Set(missing)])
    });
  }

  return Object.freeze({
    STATUSES, REQUIRED_ZONES, REQUIRED_MODES, REQUIRED_SCENARIOS,
    requirement, requirementsRegister, sourceArchitectureAudit, scenarioResult,
    auditCycle, threeCycleGate, releaseDecision, designTokenAudit, commandCoverage
  });
});
