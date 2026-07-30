'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'release-metadata.json'), 'utf8'));
const mode = process.argv[2];
const configs = {
  browser: {
    script: path.join(__dirname, 'browser-smoke.js'),
    report: path.join(root, 'validation', 'browser-smoke.json')
  },
  viewport: {
    script: path.join(__dirname, 'viewport-matrix.js'),
    report: path.join(root, 'validation', 'viewport-matrix.json')
  }
};

if (!configs[mode]) {
  console.error('Usage: node scripts/browser-validation.js <browser|viewport>');
  process.exit(2);
}

const timeoutMs = Number(process.env.AIRMON_BROWSER_TIMEOUT_MS || 14 * 60 * 1000);
const config = configs[mode];

function terminate(child, signal) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  try {
    if (process.platform === 'win32') child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (_) {
    try { child.kill(signal); } catch (_) {}
  }
}

function validateReport() {
  if (!fs.existsSync(config.report)) throw new Error(`${mode} validation did not create ${path.relative(root, config.report)}.`);
  const report = JSON.parse(fs.readFileSync(config.report, 'utf8'));
  if (report.status !== 'PASS') throw new Error(`${mode} validation report did not pass: ${JSON.stringify(report)}`);
  if (mode === 'browser') {
    if (!Array.isArray(report.checks) || report.checks.length < 60 || report.checks.some(check => check.status !== 'PASS')) {
      throw new Error('Browser report does not contain the complete passing interaction check set.');
    }
  } else if (!Array.isArray(report.scenarios) || report.scenarios.length !== 4 || report.passed !== report.checks) {
    throw new Error('Viewport report does not contain four fully passing scenarios.');
  }
  return report;
}

async function main() {
  fs.rmSync(config.report, { force: true });
  const child = spawn(process.execPath, [config.script], {
    cwd: root,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      AIRMON_BUILD_NUMBER: String(metadata.buildNumber),
      AIRMON_VIEWPORT_REPORT: config.report
    }
  });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    terminate(child, 'SIGTERM');
    setTimeout(() => terminate(child, 'SIGKILL'), 2500).unref();
  }, timeoutMs);
  const result = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(timer);
  if (timedOut) throw new Error(`${mode} validation exceeded ${timeoutMs} ms.`);
  if (result.code !== 0) throw new Error(`${mode} validation exited with code ${result.code}${result.signal ? ` (${result.signal})` : ''}.`);
  const report = validateReport();
  console.log(`Build ${metadata.buildNumber} ${mode} supervisor confirmed PASS (${mode === 'browser' ? report.checks.length : report.passed} checks).`);
}

main().catch(error => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
