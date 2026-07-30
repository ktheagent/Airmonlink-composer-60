'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const viewport = require('../src/composer3/viewport-layout-service');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('Build 30 viewport sessions provide independent safe defaults for Staff and Sol-fa', () => {
  const session = viewport.normalizeViewportSession();
  assert.equal(session.schemaVersion, 1);
  assert.equal(session.activeView, 'staff');
  assert.equal(session.views.staff.zoomMode, 'actual');
  assert.equal(session.views.solfa.layoutMode, 'continuous');
  assert.notEqual(session.views.staff, session.views.solfa);
});

test('Build 30 sanitizes persisted viewport state before applying it', () => {
  const session = viewport.normalizeViewportSession({
    activeView: 'invalid',
    views: {
      staff: {
        zoomMode: 'broken',
        zoom: 99,
        layoutMode: 'broken',
        currentPage: -20,
        anchor: { pageIndex: -1, withinX: -5, withinY: 9, viewportX: 2, viewportY: -3 }
      }
    }
  });
  assert.equal(session.activeView, 'staff');
  assert.equal(session.views.staff.zoomMode, 'actual');
  assert.equal(session.views.staff.layoutMode, 'continuous');
  assert.equal(session.views.staff.zoom, 3);
  assert.equal(session.views.staff.currentPage, 0);
  assert.deepEqual(session.views.staff.anchor, {
    pageIndex: 0,
    withinX: 0,
    withinY: 1,
    viewportX: 1,
    viewportY: 0
  });
});

test('centered musical page anchor survives viewport resize and zoom change', () => {
  const page = viewport.pageSpec({ size: 'A4' });
  const beforeViewport = { width: 1000, height: 700 };
  const before = viewport.layoutPages({ count: 6, page, zoom: 0.9, gap: 32, mode: 'continuous' });
  const originalScroll = {
    left: 0,
    top: before.pages[3].y + before.pages[3].height * 0.35 - beforeViewport.height * 0.35
  };
  const anchor = viewport.viewportAnchorForScroll(
    before,
    originalScroll,
    beforeViewport,
    { x: 0.5, y: 0.35 }
  );

  const afterViewport = { width: 760, height: 520 };
  const after = viewport.layoutPages({ count: 6, page, zoom: 0.62, gap: 32, mode: 'continuous' });
  const restored = viewport.scrollForViewportAnchor(after, anchor, afterViewport);
  const recovered = viewport.viewportAnchorForScroll(
    after,
    restored,
    afterViewport,
    { x: 0.5, y: 0.35 }
  );

  assert.equal(recovered.pageIndex, 3);
  assert.ok(Math.abs(recovered.withinY - anchor.withinY) < 0.001);
});

test('spread-mode anchor uses both axes and keeps the same page after resize', () => {
  const page = viewport.pageSpec({ size: 'Letter' });
  const before = viewport.layoutPages({ count: 6, page, zoom: 0.55, gap: 24, mode: 'spread' });
  const target = before.pages[3];
  const beforeViewport = { width: 900, height: 600 };
  const scroll = {
    left: target.x + target.width * 0.5 - beforeViewport.width * 0.5,
    top: target.y + target.height * 0.25 - beforeViewport.height * 0.35
  };
  const anchor = viewport.viewportAnchorForScroll(before, scroll, beforeViewport, { x: 0.5, y: 0.35 });

  const after = viewport.layoutPages({ count: 6, page, zoom: 0.7, gap: 24, mode: 'spread' });
  const afterViewport = { width: 1100, height: 720 };
  const restored = viewport.scrollForViewportAnchor(after, anchor, afterViewport);
  const recovered = viewport.viewportAnchorForScroll(after, restored, afterViewport, { x: 0.5, y: 0.35 });
  assert.equal(recovered.pageIndex, anchor.pageIndex);
});

test('restored scroll positions are clamped to real layout extents', () => {
  const page = viewport.pageSpec({ size: 'A4' });
  const layout = viewport.layoutPages({ count: 2, page, zoom: 0.5, gap: 24, mode: 'continuous' });
  const clamped = viewport.clampScroll(layout, { width: 800, height: 600 }, { left: 999999, top: 999999 });
  assert.equal(clamped.left, Math.max(0, layout.extent.width - 800));
  assert.equal(clamped.top, Math.max(0, layout.extent.height - 600));
});

test('authoritative service preserves a focal page across dock-sized viewport changes', () => {
  const service = new viewport.ViewportLayoutService({
    page: { size: 'A4' },
    zoomMode: 'page',
    mode: 'continuous'
  });
  const first = service.recompute({
    viewport: { width: 1000, height: 700 },
    pageCount: 5
  });
  const scroll = {
    left: 0,
    top: first.layout.pages[2].y + first.layout.pages[2].height * 0.4 - first.viewport.height * 0.35
  };
  const second = service.recompute({
    viewport: { width: 740, height: 520 },
    pageCount: 5,
    previousLayout: first.layout,
    previousViewport: first.viewport,
    scroll,
    focalPoint: { x: 0.5, y: 0.35 }
  });
  const recovered = viewport.viewportAnchorForScroll(
    second.layout,
    second.scroll,
    second.viewport,
    { x: 0.5, y: 0.35 }
  );
  assert.equal(recovered.pageIndex, 2);
});

test('Build 30 renderer persists per-view viewport state and does not reset page on view changes', () => {
  const app = read('src/composer3/app.js');
  assert.match(app, /workspaceViewport/);
  assert.match(app, /rememberActiveViewport/);
  assert.match(app, /loadViewPreference/);
  assert.match(app, /previousViewport:\s*previous\?\.viewport/);
  assert.match(app, /viewportAnchorForScroll/);
  const setView = app.slice(app.indexOf('function setView'), app.indexOf('function fitZoom'));
  assert.doesNotMatch(setView, /currentPageIndex\s*=\s*0/);
});

test('Build 30 disables competing browser scroll anchoring during controlled reflow', () => {
  const css = read('src/composer3/styles.css');
  assert.match(css, /overflow-anchor:none/);
  assert.match(css, /scroll-behavior:auto/);
});

test('current metadata and renderer build identity are consistent', () => {
  const pkg = JSON.parse(read('package.json'));
  const app = read('src/composer3/app.js');
  const main = read('src/composer3/main.js');
  const html = read('src/composer3/index.html');
  assert.equal(pkg.build.buildVersion, `${pkg.version}.${pkg.buildNumber}`);
  assert.match(app, new RegExp(`const BUILD = ${pkg.buildNumber}`));
  assert.match(main, new RegExp(`const BUILD = ${pkg.buildNumber}`));
  assert.ok(html.includes(`${pkg.version} · Build ${pkg.buildNumber}`));
});
