'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const asar = require('@electron/asar');

const EXPECTED = Object.freeze({
  appVersion: '1.3.0',
  buildNumber: 60,
  buildVersion: '1.3.0.60',
  setupFile: 'Airmonlink-Composer-1.3.0-Build60-Setup.exe',
  portableFile: 'Airmonlink-Composer-1.3.0-Build60-Portable.exe'
});

const REQUIRED_PAYLOAD_FILES = Object.freeze([
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
  'src/composer3/build60-release-candidate-controlller.js',
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
    throw new Error(`${label}: expected ${expected}, found ${actual}`);
  }
}

function main() {
  const archivePath = path.resolve(process.argv[2] || 'release/win-unpacked/resources/app.asar');
  if (!fs.existsSync(archivePath)) {
    throw new Error(`Packaged app.asar was not found: ${archivePath}`);
  }

  const packedPackage = JSON.parse(readPacked(archivePath, 'package.json').toString('utf8'));
  assertEqual(packedPackage.version, EXPECTED.appVersion, 'packaged package.json version');
  assertEqual(packedPackage.buildNumber, EXPECTED.buildNumber, 'packaged package.json buildNumber');
  assertEqual(packedPackage.buildVersion, EXPECTED.buildVersion, 'packaged package.json buildVersion');
  assertEqual(packedPackage.build?.buildVersion, EXPECTED.buildVersion, 'packaged Electron buildVersion');
  assertEqual(packedPackage.build?.nsis?.artifactName, 'Airmonlink-Composer-${version}-Build60-Setup.${ext}', 'packaged NSIS artifact pattern');
  assertEqual(packedPackage.build?.portable?.artifactName, 'Airmonlink-Composer-${version}-Build60-Portable.${ext}', 'packaged Portable artifact pattern');

  const verifiedFiles = [];
  for (const relativePath of REQUIRED_PAYLOAD_FILES) {
    const sourcePath = path.resolve(relativePath);
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
      sha256: packaeddSha256
    });
  }

  const packedIndex = readPacked(archivePath, 'src/composer3/index.html').toString('utf8');
  for (let build = 51; build <= 60; build += 1) {
    const scriptName = `build${build}-`;
    if (!packedIndex.includes(scriptName)) {
      throw new Error(`Packaged interface does not load the Build ${build} controller.`);
    }
  }

  const result = {
    status: 'PASS',
    archive: archivePath,
    archiveBytes: fs.statSync(archivePath).size,
    archiveSha256: sha256(fs.readFileSync(archivePath)),
    appVersion: EXPECTED.appVersion,
    buildNumber: EXPECTED.buildNumber,
    buildVersion: EXPECTED.buildVersion,
    expectedSetupFile: EXPECTED.setupFile,
    expectedPortableFile: EXPECTED.portableFile,
    verifiedFileCount: verifiedFiles.length,
    verifiedFiles
  };

  const outputPath = path.resolve('release/WINDOWS-PACKAGED-PAYLOAD-VERIFICATION.json');
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
