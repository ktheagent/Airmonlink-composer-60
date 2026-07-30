'use strict';

const fs = require('node:fs');
const path = require('node:path');
const registry = require('../src/composer3/functional-command-registry');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src/composer3/index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/composer3/app.js'), 'utf8');
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'release-metadata.json'), 'utf8'));
const traceabilityPath = path.join(root, 'docs/CONTROL-ENGINE-TRACEABILITY.csv');
const reportPath = path.join(root, 'docs/RELEASE-CONTROL-AUDIT.json');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some(cell => cell.length)) rows.push(row);
      row = [];
      value = '';
    } else value += character;
  }
  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function readReport(relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) return { available: false, passed: false, evidence: `${relative} is missing` };
  try {
    const report = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { available: true, passed: report.status === 'PASS', evidence: relative, report };
  } catch (error) {
    return { available: true, passed: false, evidence: `${relative}: ${error.message}` };
  }
}

const commandIds = [...new Set([...html.matchAll(/data-command="([^"]+)"/g)].map(match => match[1]))];
const executeCases = new Set([...app.matchAll(/case '([^']+)'/g)].map(match => match[1]));
const missingRegistry = commandIds.filter(id => !registry.COMMANDS[id]);
const missingExecution = commandIds.filter(id => !executeCases.has(id));
const enabled = commandIds.filter(id => registry.COMMANDS[id]?.status === registry.STATUS.VERIFIED);
const deferred = commandIds.filter(id => registry.COMMANDS[id]?.status !== registry.STATUS.VERIFIED);
const exposedIncomplete = deferred.filter(id => {
  const result = registry.evaluate(id, { state: () => ({ score: {}, activePartId: 'part-1', selectedEvents: [] }) });
  return result.visible || result.enabled;
});

const traceability = parseCsv(fs.readFileSync(traceabilityPath, 'utf8'));
const headers = [
  'Current status',
  'Production visibility',
  'Execution path',
  'Automated evidence',
  'Release evidence'
];
const existingStart = traceability[0].indexOf(headers[0]);
if (existingStart >= 0) traceability.forEach(row => row.splice(existingStart, headers.length));
traceability[0].push(...headers);

for (const row of traceability.slice(1)) {
  const id = String(row[0] || '').replace(/^data-command:/, '');
  const command = registry.COMMANDS[id];
  if (!command) {
    row.push('UNREGISTERED', 'HIDDEN', 'MISSING', 'scripts/release-control-audit.js', `Fails Build ${metadata.buildNumber} control gate`);
    continue;
  }
  const production = command.status === registry.STATUS.VERIFIED;
  row.push(
    command.status,
    production ? 'VISIBLE WHEN CONTEXT SATISFIED' : 'HIDDEN',
    executeCases.has(id) ? `execute('${id}')` : 'MISSING',
    `test/build${metadata.buildNumber}-*.test.js; validation/browser-smoke.json; scripts/release-control-audit.js`,
    production ? 'Source, semantic mutation, context gating and browser control wiring verified; external hardware evidence is recorded separately' : command.reason
  );
}

const browser = readReport('validation/browser-smoke.json');
const viewport = readReport('validation/viewport-matrix.json');
const setupPath = path.join(root, 'release', metadata.setupFile);
const portablePath = path.join(root, 'release', metadata.portableFile);
const windowsPackaging = {
  setupFile: metadata.setupFile,
  portableFile: metadata.portableFile,
  installerCreatedLocally: fs.existsSync(setupPath),
  portableCreatedLocally: fs.existsSync(portablePath),
  locallyVerified: false,
  evidence: fs.existsSync(setupPath) && fs.existsSync(portablePath)
    ? 'Files exist locally but PE/install/startup verification must be performed on Windows.'
    : 'This local continuation checkpoint has not been packaged on a Windows runner.'
};

const cyclePath = path.join(root, 'docs', 'development', `BUILD${metadata.buildNumber}-AUDIT-CYCLES.json`);
let passedCycles = 0;
if (fs.existsSync(cyclePath)) {
  try {
    const cycles = JSON.parse(fs.readFileSync(cyclePath, 'utf8'));
    passedCycles = (cycles.cycles || []).filter(cycle => cycle.status === 'PASS').length;
  } catch (_) {}
}

const report = {
  schemaVersion: 3,
  buildNumber: metadata.buildNumber,
  version: metadata.appVersion,
  buildVersion: metadata.buildVersion,
  generatedAt: new Date().toISOString(),
  totals: {
    controls: commandIds.length,
    registered: commandIds.length - missingRegistry.length,
    productionEnabled: enabled.length,
    centrallyHidden: deferred.length
  },
  gates: {
    everyControlRegistered: missingRegistry.length === 0,
    everyControlHasExecutionPath: missingExecution.length === 0,
    noIncompleteControlExposed: exposedIncomplete.length === 0
  },
  missingRegistry,
  missingExecution,
  exposedIncomplete,
  productionCommands: enabled,
  deferredCommands: deferred.map(id => ({ id, status: registry.COMMANDS[id].status, reason: registry.COMMANDS[id].reason })),
  browserValidation: { available: browser.available, passed: browser.passed, evidence: browser.evidence },
  viewportValidation: { available: viewport.available, passed: viewport.passed, evidence: viewport.evidence },
  windowsPackaging,
  passedWholeSystemCycles: passedCycles
};

if (!Object.values(report.gates).every(Boolean)) {
  throw new Error(`Build ${metadata.buildNumber} control audit failed: ${JSON.stringify(report.gates)}`);
}

fs.writeFileSync(traceabilityPath, `${traceability.map(row => row.map(csvCell).join(',')).join('\n')}\n`);
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report.totals)}\n`);
