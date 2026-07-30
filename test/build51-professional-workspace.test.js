'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const workspace = require('../src/core/professional-workspace-service');

const html = fs.readFileSync('src/composer3/index.html', 'utf8');
const app = fs.readFileSync('src/composer3/app.js', 'utf8');
const css = fs.readFileSync('src/composer3/styles.css', 'utf8');
const controller = fs.readFileSync('src/composer3/build51-workspace-controller.js', 'utf8');

test('Build 51 uses the score area available at 1366x768 without panel obstruction', () => {
  const state = workspace.defaults({ width: 1366, height: 768 });
  const layout = workspace.computeLayout(state, { width: 1366, height: 768 });
  assert.equal(layout.requiresOverlay, false);
  assert.ok(layout.scoreWidth >= 560);
  assert.equal(layout.leftPixels, 250);
  assert.equal(layout.rightPixels, 284);
});

test('Build 51 left and right panels collapse, resize and dock transactionally', () => {
  let state = workspace.defaults({ width: 1600, height: 900 });
  state = workspace.resizePanel(state, 'left', 332, { width: 1600, height: 900 }, true);
  state = workspace.resizePanel(state, 'right', 360, { width: 1600, height: 900 }, true);
  assert.equal(state.left.width, 332);
  assert.equal(state.right.width, 360);
  state = workspace.togglePanel(state, 'left', { width: 1600, height: 900 });
  assert.equal(state.left.collapsed, true);
  state = workspace.dockPanel(state, 'right', 'left', { width: 1600, height: 900 });
  assert.equal(state.right.dock, 'left');
});

test('Build 51 panel opening reflows the score rather than covering it', () => {
  const viewport = { width: 1440, height: 900 };
  let state = workspace.defaults(viewport);
  const open = workspace.computeLayout(state, viewport);
  state = workspace.togglePanel(state, 'right', viewport);
  const closed = workspace.computeLayout(state, viewport);
  assert.ok(closed.scoreWidth > open.scoreWidth);
  assert.equal(closed.rightPixels, 0);
});

test('Build 51 focus and distraction-free modes remove obstruction', () => {
  const viewport = { width: 1366, height: 768 };
  const focus = workspace.setFocusMode(workspace.defaults(viewport), true, viewport);
  assert.equal(focus.focusMode, true);
  assert.equal(focus.left.collapsed, true);
  assert.equal(focus.right.collapsed, true);
  const distraction = workspace.setDistractionFree(workspace.defaults(viewport), true, viewport);
  assert.equal(distraction.distractionFree, true);
  assert.equal(distraction.ribbon.collapsed, true);
});

test('Build 51 supports Fit Page, Width, Selection and System', () => {
  const page = { width: 794, height: 1123 };
  const viewport = { width: 1000, height: 700 };
  const pageZoom = workspace.fitZoom('page', page, viewport);
  const widthZoom = workspace.fitZoom('width', page, viewport);
  const selectionZoom = workspace.fitZoom('selection', page, viewport, { width: 120, height: 80 });
  const systemZoom = workspace.fitZoom('system', page, viewport, { width: 720, height: 180 });
  assert.ok(pageZoom < widthZoom);
  assert.ok(selectionZoom > pageZoom);
  assert.ok(systemZoom > pageZoom);
});

test('Build 51 exact professional zoom presets are enforced', () => {
  assert.equal(workspace.presetZoom(1), 1);
  assert.equal(workspace.presetZoom(1.25), 1.25);
  assert.equal(workspace.presetZoom(1.5), 1.5);
  assert.throws(() => workspace.presetZoom(1.1), /100%, 125% or 150%/);
});

test('Build 51 keeps the caret or selection inside the visible score viewport', () => {
  const result = workspace.ensureVisible(
    { left: 0, top: 0 },
    { width: 600, height: 400 },
    { left: 820, top: 510, width: 24, height: 36 }
  );
  assert.equal(result.changed, true);
  assert.ok(result.left > 0);
  assert.ok(result.top > 0);
  const stable = workspace.ensureVisible(
    { left: result.left, top: result.top },
    { width: 600, height: 400 },
    { left: 820, top: 510, width: 24, height: 36 }
  );
  assert.equal(stable.changed, false);
});

test('Build 51 restores normal and maximized windows inside the work area', () => {
  const restored = workspace.restoreWindowState(
    { x: -200, y: 2000, width: 1366, height: 768, maximized: false },
    { width: 1920, height: 1080 }
  );
  assert.equal(restored.x, 0);
  assert.equal(restored.y, 312);
  assert.equal(restored.width, 1366);
  assert.equal(restored.height, 768);
  const maximized = workspace.restoreWindowState({ maximized: true }, { width: 1920, height: 1080 });
  assert.equal(maximized.maximized, true);
});

test('Build 51 interface exposes compact ribbon and unobstructed workspace controls', () => {
  for (const token of [
    'fitSelection', 'fitSystem', 'zoom125', 'zoom150',
    'professional-workspace-service.js', 'build51-workspace-controller.js'
  ]) assert.ok(html.includes(token), token);
  for (const token of ["case 'fitSelection'", "case 'fitSystem'", "case 'zoom125'", "case 'zoom150'"]) {
    assert.ok(app.includes(token), token);
  }
  for (const token of ['ribbon-compact', 'ribbon-collapsed', 'focus-mode', 'distraction-free']) {
    assert.ok(css.includes(token), token);
  }
  assert.ok(controller.includes('keepEditingTargetVisible'));
  assert.ok(controller.includes('data-workspace-size'));
});
