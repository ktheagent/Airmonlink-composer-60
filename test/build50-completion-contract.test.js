'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const metadata = require('../release-metadata.json');
const pkg = require('../package.json');
const lock = require('../package-lock.json');
const model = require('../src/core/score-model');
const formats = require('../src/core/formats');
const registry = require('../src/composer3/functional-command-registry');
const { classifyPrintResult, completePrint } = require('../src/desktop/print-result');

test('Current continuation build metadata agrees across package, lock and packaging configuration', () => {
  assert.equal(metadata.appVersion, '1.3.0');
  assert.ok(metadata.buildNumber >= 51 && metadata.buildNumber <= 60);
  assert.equal(metadata.buildVersion, `${metadata.appVersion}.${metadata.buildNumber}`);
  assert.equal(pkg.version, metadata.appVersion);
  assert.equal(pkg.buildNumber, metadata.buildNumber);
  assert.equal(pkg.buildVersion, metadata.buildVersion);
  assert.equal(pkg.build.buildVersion, metadata.buildVersion);
  assert.equal(lock.version, metadata.appVersion);
  assert.equal(lock.packages[''].version, metadata.appVersion);
  assert.equal(metadata.setupFile, `Airmonlink-Composer-${metadata.appVersion}-Build${metadata.buildNumber}-Setup.exe`);
  assert.equal(metadata.portableFile, `Airmonlink-Composer-${metadata.appVersion}-Build${metadata.buildNumber}-Portable.exe`);
  assert.match(pkg.build.nsis.artifactName, new RegExp(`Build${metadata.buildNumber}-Setup`));
  assert.match(pkg.build.portable.artifactName, new RegExp(`Build${metadata.buildNumber}-Portable`));
});

test('Build 50 active workflow derives identities and contains no Build 43 release path', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/windows-build.yml'), 'utf8');
  for (const value of ['APP_VERSION', 'BUILD_NUMBER', 'BUILD_VERSION', 'SETUP_FILE', 'PORTABLE_FILE', 'INSTALL_DIRECTORY']) {
    assert.match(workflow, new RegExp(value));
  }
  assert.doesNotMatch(workflow, /Airmonlink-Composer-1\.2\.3-Build43|AirmonlinkComposerBuild43|1\.2\.3\.43/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
  assert.match(workflow, /if-no-files-found:\s*error/);
});

test('Build 50 exposes all verified workspace modes and the Composition Hub', () => {
  const html = fs.readFileSync(path.join(root, 'src/composer3/index.html'), 'utf8');
  for (const mode of ['setup', 'write', 'engrave', 'play', 'publish']) {
    const tag = html.match(new RegExp(`<button[^>]*data-workspace-mode="${mode}"[^>]*>`))?.[0] || '';
    assert.ok(tag, mode);
    assert.doesNotMatch(tag, /\shidden(?:\s|>)/, mode);
  }
  const launcher = html.match(/<nav class="composition-launcher"[^>]*>/)?.[0] || '';
  assert.ok(launcher);
  assert.doesNotMatch(launcher, /\shidden(?:\s|>)/);
});

test('Build 50 print result separates cancellation from genuine failure', async () => {
  assert.deepEqual(classifyPrintResult(true, ''), { success: true, canceled: false, reason: '' });
  assert.deepEqual(classifyPrintResult(false, 'User cancelled print dialog'), {
    success: false,
    canceled: true,
    reason: 'User cancelled print dialog'
  });
  assert.equal(classifyPrintResult(false, 'Spooler unavailable').canceled, false);

  const cancelled = await new Promise((resolve, reject) => completePrint(resolve, reject, false, 'Print job was canceled'));
  assert.equal(cancelled.canceled, true);
  await assert.rejects(
    new Promise((resolve, reject) => completePrint(resolve, reject, false, 'Spooler unavailable')),
    /Spooler unavailable/
  );
});

test('Build 50 MusicXML round-trip works through the bundled XML fallback', () => {
  const score = model.createScore({ title: 'Build 50 XML', measures: 2, autoFillRests: false });
  model.addNote(score, score.parts[0].id, {
    beat: 0,
    duration: 1,
    pitch: 60,
    voice: 1,
    staff: 1,
    lyrics: [{ verse: 1, text: 'Home' }]
  });
  const xml = formats.exportMusicXML(score);
  assert.match(xml, /score-partwise/);
  assert.match(xml, /<lyric/);
  const reopened = formats.parseMusicXML(xml);
  assert.equal(reopened.metadata.title, 'Build 50 XML');
  assert.equal(reopened.parts[0].events.filter(event => event.type === 'note').length, 1);
  assert.equal(reopened.parts[0].events.find(event => event.type === 'note').lyrics[0].text, 'Home');
});

test('Build 50 Chromium validation uses supported headless multiprocess flags', () => {
  for (const relative of ['scripts/browser-smoke.js', 'scripts/viewport-matrix.js']) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.match(source, /--headless=new/);
    assert.match(source, /--remote-debugging-address=127\.0\.0\.1/);
    assert.doesNotMatch(source, /--single-process/);
    assert.doesNotMatch(source, /--no-zygote/);
    assert.match(source, /--disable-gpu-sandbox/);
  }
});

test('Build 50 renderer retains the pickup and playback-page regression fixes', () => {
  const source = fs.readFileSync(path.join(root, 'src/composer3/app.js'), 'utf8');
  assert.match(source, /const setup = \{[\s\S]*pickupBeats:/);
  assert.match(source, /engine\.newScore\(setup\);[\s\S]*engine\.configurePickup\(setup\.pickupBeats\)/);
  assert.match(source, /manualHoldUntil:\s*manualPageHoldUntil/);
  assert.match(source, /score\.metadata\?\.title \|\| score\.title/);
  assert.match(source, /score\.metadata\?\.composer \|\| score\.composer/);
  assert.doesNotMatch(source, /manualHoldUntil:\s*manualHoldUntil/);
});

test('Build 50 production command registry has complete verified coverage', () => {
  const commands = Object.values(registry.COMMANDS);
  assert.ok(commands.length >= 109);
  assert.equal(commands.filter(command => command.status === registry.STATUS.VERIFIED).length, commands.length);
  assert.equal(commands.filter(command => command.status !== registry.STATUS.VERIFIED).length, 0);
});
