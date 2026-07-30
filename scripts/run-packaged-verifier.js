'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const script = path.join(__dirname, 'verify-packaged-build.js');
const result = spawnSync(process.execPath, [script], {
  cwd: path.resolve(__dirname, '..'),
  env: process.env,
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.error) {
  console.error(`::error title=Packaged Build 60 verifier failed::${String(result.error.message).replace(/\r?\n/g, ' %0A')}`);
  process.exit(1);
}

if (result.status !== 0) {
  const output = `${result.stderr || result.stdout || 'Packaged payload verification failed without output.'}`.trim();
  const summary = output.split(/\r/\n/).slice(-6).join(' | ').replace(/%/g, '%25').replace(/\r/\n/g, '%00');
  console.error(`::error title=Packaged Build 60 verifier failed::${summary}`);
  process.exit(result.status || 1);
}
