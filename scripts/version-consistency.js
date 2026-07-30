'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const readText = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const readJson = relative => JSON.parse(readText(relative));
const metadata = readJson('release-metadata.json');
const pkg = readJson('package.json');
const lock = readJson('package-lock.json');
const workflow = readText('.github/workflows/windows-build.yml');
const indexHtml = readText('src/composer3/index.html');
const appJs = readText('src/composer3/app.js');
const mainJs = readText('src/composer3/main.js');

const expected = Object.freeze({
  appVersion: String(metadata.appVersion),
  buildNumber: Math.round(Number(metadata.buildNumber)),
  buildVersion: `${metadata.appVersion}.${Math.round(Number(metadata.buildNumber))}`,
  productSlug: 'Airmonlink-Composer'
});
const setupFile = `${expected.productSlug}-${expected.appVersion}-Build${expected.buildNumber}-Setup.exe`;
const portableFile = `${expected.productSlug}-${expected.appVersion}-Build${expected.buildNumber}-Portable.exe`;
const errors = [];

function equal(actual, wanted, label) {
  if (actual !== wanted) errors.push(`${label}: expected ${JSON.stringify(wanted)}, found ${JSON.stringify(actual)}`);
}
function contains(text, token, label) {
  if (!text.includes(token)) errors.push(`${label}: missing ${JSON.stringify(token)}`);
}
function currentBuildOnly(relative, text) {
  const matches = [...text.matchAll(/\bBuild\s?(\d+)\b/g)].map(match => Number(match[1]));
  const stale = matches.filter(value => value >= 43 && value !== expected.buildNumber);
  if (stale.length) errors.push(`${relative}: active build identities disagree (${[...new Set(stale)].join(', ')})`);
}

if (!Number.isInteger(expected.buildNumber) || expected.buildNumber < 51 || expected.buildNumber > 60) {
  errors.push(`release-metadata buildNumber must be within the Build 51–60 continuation, found ${metadata.buildNumber}`);
}
equal(metadata.buildVersion, expected.buildVersion, 'release-metadata buildVersion');
equal(metadata.productSlug, expected.productSlug, 'release-metadata productSlug');
equal(metadata.setupFile, setupFile, 'release-metadata setupFile');
equal(metadata.portableFile, portableFile, 'release-metadata portableFile');
equal(metadata.installDirectory, `AirmonlinkComposerBuild${expected.buildNumber}`, 'release-metadata installDirectory');

equal(pkg.version, expected.appVersion, 'package.json version');
equal(pkg.buildNumber, expected.buildNumber, 'package.json buildNumber');
equal(pkg.buildVersion, expected.buildVersion, 'package.json buildVersion');
equal(pkg.build?.buildVersion, expected.buildVersion, 'electron-builder buildVersion');
equal(lock.version, expected.appVersion, 'package-lock root version');
equal(lock.packages?.['']?.version, expected.appVersion, 'package-lock package version');

contains(pkg.build?.nsis?.artifactName || '', `Build${expected.buildNumber}-Setup`, 'NSIS artifactName');
contains(pkg.build?.portable?.artifactName || '', `Build${expected.buildNumber}-Portable`, 'portable artifactName');
contains(indexHtml, `${expected.appVersion} · Build ${expected.buildNumber}`, 'application-visible version');
contains(appJs, `const BUILD = ${expected.buildNumber}`, 'renderer runtime build number');
contains(mainJs, `const BUILD = ${expected.buildNumber}`, 'Electron runtime build number');

for (const token of [
  'scripts/release-env.js',
  'APP_VERSION',
  'BUILD_NUMBER',
  'BUILD_VERSION',
  'SETUP_FILE',
  'PORTABLE_FILE',
  'INSTALL_DIRECTORY',
  'steps.metadata.outputs.SETUP_FILE',
  'steps.metadata.outputs.PORTABLE_FILE',
  'if-no-files-found: error',
  'npm run audit:release'
]) contains(workflow, token, 'Windows workflow');

const activeFiles = [
  'package.json',
  'release-metadata.json',
  'scripts/release-env.js',
  '.github/workflows/windows-build.yml',
  'scripts/browser-validation.js',
  'scripts/release-control-audit.js',
  'src/composer3/index.html',
  'src/composer3/app.js',
  'src/composer3/main.js'
];
const build43Identity = /Airmonlink-Composer-1\.2\.3-Build43-(?:Setup|Portable)\.exe|AirmonlinkComposerBuild43|1\.2\.3\.43|Airmonlink-Composer-Build43-(?:Windows|Linux)/i;
for (const relative of activeFiles) {
  const text = readText(relative);
  if (build43Identity.test(text)) errors.push(`active stale Build 43 release identity in ${relative}`);
  if (!relative.endsWith('version-consistency.js')) currentBuildOnly(relative, text);
}

if (/continue-on-error:\s*true/i.test(workflow)) errors.push('Windows workflow may not hide failures with continue-on-error.');
if (!/name:\s*Version consistency gate/i.test(workflow)) errors.push('Windows workflow is missing the fail-fast version-consistency step.');
if (!/name:\s*Build Setup and Portable executables/i.test(workflow)) errors.push('Windows workflow is missing Windows packaging.');
if (!/name:\s*Silent install and bounded startup smoke/i.test(workflow)) errors.push('Windows workflow is missing installer/portable startup verification.');

if (errors.length) {
  console.error(`Build ${expected.buildNumber} version-consistency gate FAILED:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(JSON.stringify({
  status: 'PASS',
  appVersion: expected.appVersion,
  buildNumber: expected.buildNumber,
  buildVersion: expected.buildVersion,
  setupFile,
  portableFile,
  activeFilesAudited: activeFiles.length
}, null, 2));
