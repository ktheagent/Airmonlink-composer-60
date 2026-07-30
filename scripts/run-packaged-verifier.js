'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const script = path.join(__dirname, 'verify-packaged-build.js');
const result = spawnSync(process.execPath, [script], {
  cwd: root,
  env: process.env,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

function encodeAnnotation(value) {
  return String(value)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
}

if (result.error) {
  console.error(`::error title=Packaged Build 60 verifier failed::${encodeAnnotation(result.error.message)}`);
  process.exit(1);
}

if (result.status !== 0) {
  const output = String(result.stderr || result.stdout || 'Packaged payload verification failed without output.').trim();
  const summary = output.split(/\r?\n/).slice(-12).join(' | ');
  console.error(`::error title=Packaged Build 60 verifier failed::${encodeAnnotation(summary)}`);
  process.exit(result.status || 1);
}
