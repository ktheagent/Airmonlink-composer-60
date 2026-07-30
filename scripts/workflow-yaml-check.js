'use strict';

const fs = require('node:fs');
const workflow = fs.readFileSync('.github/workflows/windows-build.yml', 'utf8');
const errors = [];
const required = [
  'name: Build Windows Release',
  'validate:',
  'build-windows:',
  'Version consistency gate',
  'Validate workflow YAML',
  'Run release command/control audit',
  'Build Setup and Portable executables',
  'Verify Windows release files',
  'Silent install and bounded startup smoke',
  'Generate SHA-256 checksums',
  'Upload Windows validation evidence',
  'Upload Windows release',
  'if-no-files-found: error'
];
for (const token of required) if (!workflow.includes(token)) errors.push(`missing ${token}`);
if (/continue-on-error:\s*true/i.test(workflow)) errors.push('continue-on-error is forbidden');
if (/Airmonlink-Composer-1\.2\.3-Build43|AirmonlinkComposerBuild43|1\.2\.3\.43/i.test(workflow)) {
  errors.push('active Build 43 release identity remains');
}
const uses = [...workflow.matchAll(/uses:\s*([^\s]+)/g)].map(match => match[1]);
for (const use of uses) {
  if (!/@v4$/.test(use)) errors.push(`unpinned or unexpected action major: ${use}`);
}
if (errors.length) {
  console.error(`Workflow validation FAILED:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Workflow validation PASS (${uses.length} action references checked).`);
