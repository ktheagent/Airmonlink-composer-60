'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const flow = require('../src/composer3/page-flow-service');

function bounds(index) {
  return { start: index * 4, end: (index + 1) * 4 };
}

const events = [
  { id: 'a', start: 0 },
  { id: 'b', start: 3.5 },
  { id: 'c', start: 4 },
  { id: 'd', start: 11.75 },
  { id: 'e', start: 12 }
];

test('Build 31 creates deterministic page ranges from measure pages', () => {
  const ranges = flow.createPageRanges({
    pages: [
      { measureIndices: [0, 1] },
      { measureIndices: [2, 3] }
    ],
    measureBounds: bounds,
    events
  });
  assert.equal(ranges.length, 2);
  assert.deepEqual(ranges[0].eventIds, ['a', 'b', 'c']);
  assert.equal(ranges[1].startBeat, 8);
  assert.equal(ranges[1].endBeat, 16);
});

test('Build 31 maps beats to page boundaries without off-by-one errors', () => {
  const ranges = flow.normalizePageRanges([
    { startBeat: 0, endBeat: 8, firstMeasure: 0, lastMeasure: 2 },
    { startBeat: 8, endBeat: 16, firstMeasure: 2, lastMeasure: 4 }
  ]);
  assert.equal(flow.pageForBeat(ranges, 0), 0);
  assert.equal(flow.pageForBeat(ranges, 7.999), 0);
  assert.equal(flow.pageForBeat(ranges, 8), 1);
  assert.equal(flow.pageForBeat(ranges, 99), 1);
});

test('Build 31 maps selected events to their owning physical page', () => {
  const ranges = flow.createPageRanges({
    pages: [{ firstMeasure: 0, lastMeasure: 2 }, { firstMeasure: 2, lastMeasure: 4 }],
    measureBounds: bounds,
    events
  });
  assert.equal(flow.pageForEvent(ranges, 'd', 0), 1);
  assert.equal(flow.pageForEvent(ranges, 'missing', 1), 1);
});

test('Build 31 keeps the current page when a multi-page selection is already visible', () => {
  const ranges = flow.normalizePageRanges([
    { startBeat: 0, endBeat: 8, firstMeasure: 0, lastMeasure: 2, eventIds: ['a'] },
    { startBeat: 8, endBeat: 16, firstMeasure: 2, lastMeasure: 4, eventIds: ['b'] }
  ]);
  assert.equal(flow.pageForSelection(ranges, ['a', 'b'], 1), 1);
  assert.equal(flow.pageForSelection(ranges, ['a', 'b'], 1, 'a'), 0);
});

test('Build 31 preserves selection identity and removes unavailable events', () => {
  assert.deepEqual(flow.preserveSelection(['b', 'a', 'b', 'gone'], ['a', 'b']), ['b', 'a']);
});

test('Build 31 clamps previous and next page navigation', () => {
  assert.equal(flow.navigationTarget(0, 4, 'previous'), 0);
  assert.equal(flow.navigationTarget(0, 4, 'next'), 1);
  assert.equal(flow.navigationTarget(3, 4, 'next'), 3);
  assert.equal(flow.navigationTarget(2, 4, 'first'), 0);
  assert.equal(flow.navigationTarget(1, 4, 'last'), 3);
});

test('Build 31 follows playback only when the page changes', () => {
  assert.deepEqual(
    flow.followDecision({ playing: true, currentPage: 0, targetPage: 1, now: 1000, manualHoldUntil: 0 }),
    { follow: true, reason: 'page-change', targetPage: 1 }
  );
  assert.equal(flow.followDecision({ playing: true, currentPage: 1, targetPage: 1 }).reason, 'already-visible');
  assert.equal(flow.followDecision({ playing: false, currentPage: 0, targetPage: 1 }).reason, 'inactive');
});

test('Build 31 respects a temporary manual navigation hold during playback', () => {
  const decision = flow.followDecision({
    playing: true,
    currentPage: 0,
    targetPage: 1,
    now: 1000,
    manualHoldUntil: 2000
  });
  assert.equal(decision.follow, false);
  assert.equal(decision.reason, 'manual-hold');
});

test('Build 31 calculates a stable manual hold deadline', () => {
  assert.equal(flow.manualHoldUntil(1000, 1800), 2800);
  assert.equal(flow.manualHoldUntil(1000, -1), 1000);
});

test('Build 31 publication profiles include physical-page and measure-range identity', () => {
  const profile = flow.publicationProfile({
    view: 'staff',
    pageSize: 'A4',
    orientation: 'portrait',
    margins: 15,
    ranges: [
      { startBeat: 0, endBeat: 8, firstMeasure: 0, lastMeasure: 2 },
      { startBeat: 8, endBeat: 16, firstMeasure: 2, lastMeasure: 4 }
    ]
  });
  assert.equal(profile.pageCount, 2);
  assert.deepEqual(profile.measureRanges, [[0, 2], [2, 4]]);
  assert.match(profile.signature, /^staff\|A4\|portrait\|15\|2\|/);
});

test('Build 31 detects output pagination mismatches', () => {
  const reference = flow.publicationProfile({
    view: 'staff',
    pageSize: 'A4',
    orientation: 'portrait',
    margins: 15,
    ranges: [{ firstMeasure: 0, lastMeasure: 2 }]
  });
  const candidate = flow.publicationProfile({
    view: 'staff',
    pageSize: 'Letter',
    orientation: 'portrait',
    margins: 15,
    ranges: [{ firstMeasure: 0, lastMeasure: 3 }]
  });
  const comparison = flow.comparePublicationProfiles(reference, candidate);
  assert.equal(comparison.equal, false);
  assert.deepEqual(comparison.differences.map(item => item.field), ['pageSize', 'measureRanges']);
});

test('Build 31 treats equivalent output profiles as equal', () => {
  const profile = flow.publicationProfile({
    view: 'solfa',
    pageSize: 'Letter',
    orientation: 'landscape',
    margins: 12,
    ranges: [{ firstMeasure: 0, lastMeasure: 4 }]
  });
  assert.deepEqual(flow.comparePublicationProfiles(profile, profile), { equal: true, differences: [] });
});


const fs = require('node:fs');
const path = require('node:path');
const { createEngine } = require('../src/composer3/engine-api');
const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Build 31 keeps semantic note and lyric identity across a physical-page boundary', () => {
  const engine = createEngine({ measures: 6, timeSignature: '4/4', autoFillRests: false });
  const left = engine.addNote({ pitch: 'C4', start: 7.5, duration: .5, advance: false });
  const right = engine.addNote({ pitch: 'D4', start: 8, duration: 1, advance: false });
  engine.selectEvents([left.id, right.id]);
  engine.setLyric('Boundary', { verse: 1 });

  const ranges = flow.createPageRanges({
    pages: [{ firstMeasure: 0, lastMeasure: 2 }, { firstMeasure: 2, lastMeasure: 6 }],
    measureBounds: index => require('../src/core/score-model').measureBounds(engine.score, index),
    events: engine.score.parts.flatMap(part => part.events)
  });
  assert.equal(flow.pageForEvent(ranges, left.id), 0);
  assert.equal(flow.pageForEvent(ranges, right.id), 1);
  assert.equal(flow.pageForSelection(ranges, [left.id, right.id], 1), 1);
  for (const event of engine.state().selectedEvents.map(item => item.event)) {
    assert.equal(event.lyrics[0].text, 'Boundary');
  }
});

test('Build 31 undo and redo retain cross-page event identifiers', () => {
  const engine = createEngine({ measures: 6, autoFillRests: false });
  const first = engine.addNote({ pitch: 'E4', start: 7.5, duration: .5, advance: false });
  const second = engine.addNote({ pitch: 'F4', start: 8, duration: 1, advance: false });
  engine.selectEvents([first.id, second.id]);
  assert.equal(engine.deleteSelection(), 2);
  assert.equal(engine.score.parts.flatMap(part => part.events).some(event => event.id === first.id), false);
  assert.equal(engine.undo(), true);
  const restoredIds = engine.score.parts.flatMap(part => part.events).map(event => event.id);
  assert.ok(restoredIds.includes(first.id));
  assert.ok(restoredIds.includes(second.id));
  assert.equal(engine.redo(), true);
  assert.equal(engine.score.parts.flatMap(part => part.events).some(event => event.id === second.id), false);
});

test('Build 31 remaps the same selection after pagination reflow', () => {
  const scoreEvents = [{ id: 'late', start: 12 }];
  const before = flow.createPageRanges({
    pages: [{ firstMeasure: 0, lastMeasure: 2 }, { firstMeasure: 2, lastMeasure: 4 }],
    measureBounds: bounds,
    events: scoreEvents
  });
  const after = flow.createPageRanges({
    pages: [{ firstMeasure: 0, lastMeasure: 4 }],
    measureBounds: bounds,
    events: scoreEvents
  });
  assert.equal(flow.pageForSelection(before, ['late'], 0), 1);
  assert.equal(flow.pageForSelection(after, ['late'], 1), 0);
});

test('Build 31 renderer connects selection reveal, playback following and manual hold', () => {
  const app = read('src/composer3/app.js');
  assert.match(app, /function revealSelectionPage/);
  assert.match(app, /function followPlaybackPage/);
  assert.match(app, /label === 'Playback position'/);
  assert.match(app, /manualPageHoldUntil/);
  assert.match(app, /markManualPageInteraction/);
  assert.match(app, /playback-current/);
});

test('Build 31 uses one publication profile for preview, PDF, PNG and native print', () => {
  const app = read('src/composer3/app.js');
  const preload = read('src/composer3/preload.js');
  const main = read('src/composer3/main.js');
  assert.match(app, /function publicationRequestOptions/);
  assert.match(app, /printPreview\(publicationRequestOptions\(\)\)/);
  assert.match(app, /exportPdf\(\{\s*\.\.\.publicationRequestOptions\(\)/);
  assert.match(app, /print\(publicationRequestOptions\(\)\)/);
  assert.match(app, /viewportApi\.pageSpec\(physicalPageOptions\(\)\)/);
  assert.match(preload, /print: payload => ipcRenderer\.invoke\('app:print', payload\)/);
  assert.match(main, /landscape: orientation === 'landscape'/);
  assert.match(main, /preferCSSPageSize: true/);
});
