'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const asar = require('@electron/asar');

const EXPECTED = Object.freeze({
  productName: 'Airmonlink Composer',
  productSlug: 'Airmonlink-Composer',
  appVersion: '1.3.0',
  buildNumber: 60,
  buildVersion: '1.3.0.60',
  setupFile: 'Airmonlink-Composer-1.3.0-Build60-Setup.exe',
  portableFile: 'Airmonlink-Composer-1.3.0-Build60-Portable.exe',
  installDirectory: 'AirmonlinkComposerBuild60'
});

const REQUIRED_PAYLOAD_FILES = Object.freeze([
  'release-metadata.json',
  'src/composer3/index.html',
  'src/composer3/app.js',
  'src/composer3/main.js',
  'src/composer3/build51-workspace-controller.js',
  'src/composer3/build52-template-controller.js',
  'src/composer3/build53-note-entry-controller.js',
  'src/composer3/build54-rhythmic-safety-controller.js',
  'src/composer3/build55-inspector-hub-controller.js',
  'src/composer3/build56-engraving-controller.js',
  'src/composer3/build57-staff-solfa-lyrics-controller.js',
  'src/composer3/build58-performance-publishing-controller.js',
  'src/composer3/build59-release-quality-controller.js',
  'src/composer3/build60-release-candidate-controller.js',
  'src/core/integrated-release-candidate-service.js'
]);

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readPacked(archivePath, relativePath) {
  try {
    return asar.extractFile(archivePath, relativePath);
  } catch (error) {
    throw new Error(`Missing packaged payload file ${relativePath}: ${error.message}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, found ${JSON.stringify(actual)}`);
  }
}

function assertIdentity(metadata, label) {
  for (const [key, expected] of Object.entries(EXPECTED)) {
    assertEqual(metadata[key], expected, `${label}.${key}`);
  }
}

function main() {
  const root = path.resolve(__dirname, '..');
  const archivePath = path.resolve(process.argv[2] || path.join(root, 'release/win-unpacked/resources/app.asar'));
  if (!fs.existsSync(archivePath)) {
    throw new Error(`Packaged app.asar was not found: ${archivePath}`);
  }

  const sourceMetadata = JSON.parse(fs.readFileSync(path.join(root, 'release-metadata.json'), 'utf8'));
  const packedMetadata = JSON.parse(readPacked(archivePath, 'release-metadata.json').toString('utf8'));
  const packedPackage = JSON.parse(readPacked(archivePath, 'package.json').toString('utf8'));

  assertIdentity(sourceMetadata, 'source release metadata');
  assertIdentity(packedMetadata, 'packaged release metadata');
  assertEqual(packedPackage.name, 'airmonlink-composer', 'packaged package.json name');
  assertEqual(packedPackage.version, EXPECTED.appVersion, 'packaged package.json version');
  assertEqual(packedPackage.main, 'src/composer3/main.js', 'packaged package.json main');

  const verifiedFiles = [];
  for (const relativePath of REQUIRED_PAYLOAD_FILES) {
    const sourcePath = path.join(root, relativePath);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Checked-out source file is missing: ${relativePath}`);
    }

    const sourceBuffer = fs.readFileSync(sourcePath);
    const packedBuffer = readPacked(archivePath, relativePath);
    const sourceSha256 = sha256(sourceBuffer);
    const packedSha256 = sha256(packedBuffer);
    assertEqual(packedSha256, sourceSha256, `packaged hash for ${relativePath}`);

    verifiedFiles.push({
      path: relativePath,
      bytes: packedBuffer.length,
      sha256: packedSha256
    });
  }

  const packedIndex = readPacked(archivePath, 'src/composer3/index.html').toString('utf8');
  assertEqual(
    packedIndex.includes(`${EXPECTED.appVersion} · Build ${EXPECTED.buildNumber}`),
    true,
    'packaged interface visible Build 60 identity'
  );

  const controllerFiles = REQUIRED_PAYLOAD_FILES
    .filter(relativePath => /build(?:5[1-9]|60)-.+-controller\.js$/.test(relativePath))
    .map(relativePath => path.basename(relativePath));

  for (const controllerFile of controllerFiles) {
    if (!packedIndex.includes(controllerFile)) {
      throw new Error(`Packaged interface does not load ${controllerFile}.`);
    }
  }

  const result = {
    status: 'PASS',
    sourceCommit: process.env.GITHUB_SHA || null,
    archive: archivePath,
    archiveBytes: fs.statSync(archivePath).size,
    archiveSha256: sha256(fs.readFileSync(archivePath)),
    identity: packedMetadata,
    packagedPackage: {
      name: packedPackage.name,
      version: packedPackage.version,
      main: packedPackage.main
    },
    verifiedFileCount: verifiefFiles.length,
    verifiedFiles
  };

  const outputPath = path.join(root, 'release/WINDOWS-PACKAGED-PAYLOAD-VERIFICATION.json');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  console.error(`Packaged Build 60 payload verification FAILED: ${error.stack || error.message}`);
  process.exit(1);
}
