'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'release-metadata.json'), 'utf8'));
const values = Object.freeze({
  APP_VERSION: metadata.appVersion,
  BUILD_NUMBER: String(metadata.buildNumber),
  BUILD_VERSION: metadata.buildVersion,
  PRODUCT_SLUG: metadata.productSlug,
  SETUP_FILE: metadata.setupFile,
  PORTABLE_FILE: metadata.portableFile,
  INSTALL_DIRECTORY: metadata.installDirectory,
  VALIDATION_ARTIFACT: `${metadata.productSlug}-Build${metadata.buildNumber}-Windows-Validation`,
  RELEASE_ARTIFACT: `${metadata.productSlug}-Build${metadata.buildNumber}-Windows`
});

function appendEnvironment(file) {
  const payload = Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
  fs.appendFileSync(file, payload, 'utf8');
}

if (process.argv.includes('--github-env')) {
  if (!process.env.GITHUB_ENV) throw new Error('GITHUB_ENV is unavailable.');
  appendEnvironment(process.env.GITHUB_ENV);
}

if (process.argv.includes('--github-output')) {
  if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is unavailable.');
  appendEnvironment(process.env.GITHUB_OUTPUT);
}

if (!process.argv.includes('--quiet')) {
  process.stdout.write(JSON.stringify(values, null, 2) + '\n');
}

module.exports = { metadata, values, appendEnvironment };
