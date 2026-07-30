(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AirmonProfessionalWorkspace = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PANEL_SIDES = Object.freeze(['left', 'right']);
  const ZOOM_PRESETS = Object.freeze([1, 1.25, 1.5]);
  const FIT_MODES = Object.freeze(['page', 'width', 'selection', 'system']);

  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, Number(value) || minimum));

  function viewportMetrics(viewport = {}) {
    const width = Math.max(640, Number(viewport.width) || 1366);
    const height = Math.max(480, Number(viewport.height) || 768);
    const compact = width <= 1100 || height <= 700;
    return Object.freeze({
      width,
      height,
      compact,
      leftMinimum: compact ? 180 : 210,
      leftMaximum: Math.min(420, Math.floor(width * 0.34)),
      rightMinimum: compact ? 220 : 250,
      rightMaximum: Math.min(460, Math.floor(width * 0.36)),
      minimumScoreWidth: compact ? 420 : 560,
      ribbonMaximum: compact ? 116 : 176
    });
  }

  function defaults(viewport = {}) {
    const metrics = viewportMetrics(viewport);
    return Object.freeze({
      left: Object.freeze({ visible: true, collapsed: false, width: clamp(250, metrics.leftMinimum, metrics.leftMaximum), dock: 'left' }),
      right: Object.freeze({ visible: true, collapsed: false, width: clamp(284, metrics.rightMinimum, metrics.rightMaximum), dock: 'right' }),
      ribbon: Object.freeze({ compact: metrics.compact, collapsed: false }),
      focusMode: false,
      distractionFree: false,
      zoom: 1,
      zoomMode: 'actual'
    });
  }

  function normalizePanel(value, side, metrics) {
    const source = value && typeof value === 'object' ? value : {};
    const minimum = side === 'left' ? metrics.leftMinimum : metrics.rightMinimum;
    const maximum = side === 'left' ? metrics.leftMaximum : metrics.rightMaximum;
    return Object.freeze({
      visible: source.visible !== false,
      collapsed: Boolean(source.collapsed),
      width: clamp(source.width ?? (side === 'left' ? 250 : 284), minimum, maximum),
      dock: PANEL_SIDES.includes(source.dock) ? source.dock : side
    });
  }

  function sanitize(value = {}, viewport = {}) {
    const metrics = viewportMetrics(viewport);
    const source = value && typeof value === 'object' ? value : {};
    const base = defaults(viewport);
    const result = {
      left: normalizePanel(source.left || base.left, 'left', metrics),
      right: normalizePanel(source.right || base.right, 'right', metrics),
      ribbon: Object.freeze({
        compact: source.ribbon?.compact == null ? base.ribbon.compact : Boolean(source.ribbon.compact),
        collapsed: Boolean(source.ribbon?.collapsed)
      }),
      focusMode: Boolean(source.focusMode),
      distractionFree: Boolean(source.distractionFree),
      zoom: clamp(source.zoom ?? 1, 0.2, 3),
      zoomMode: FIT_MODES.includes(source.zoomMode) || source.zoomMode === 'actual' ? source.zoomMode : 'actual'
    };
    if (result.focusMode || result.distractionFree) {
      result.left = Object.freeze({ ...result.left, collapsed: true });
      result.right = Object.freeze({ ...result.right, collapsed: true });
      result.ribbon = Object.freeze({ ...result.ribbon, compact: true, collapsed: result.distractionFree });
    }
    return Object.freeze(result);
  }

  function panelPixels(panel) {
    if (!panel.visible || panel.collapsed) return 0;
    return panel.width;
  }

  function computeLayout(stateValue = {}, viewport = {}) {
    const state = sanitize(stateValue, viewport);
    const metrics = viewportMetrics(viewport);
    const leftPanels = [state.left, state.right].filter(panel => panel.dock === 'left');
    const rightPanels = [state.left, state.right].filter(panel => panel.dock === 'right');
    const leftPixels = leftPanels.reduce((sum, panel) => sum + panelPixels(panel), 0);
    const rightPixels = rightPanels.reduce((sum, panel) => sum + panelPixels(panel), 0);
    const scoreWidth = Math.max(metrics.minimumScoreWidth, metrics.width - leftPixels - rightPixels);
    const requiresOverlay = leftPixels + rightPixels + metrics.minimumScoreWidth > metrics.width;
    return Object.freeze({
      state,
      metrics,
      leftPixels,
      rightPixels,
      scoreWidth,
      requiresOverlay,
      gridColumns: `${leftPixels ? `${leftPixels}px ` : ''}minmax(${metrics.minimumScoreWidth}px,1fr)${rightPixels ? ` ${rightPixels}px` : ''}`
    });
  }

  function updatePanel(stateValue, panelName, patch, viewport = {}) {
    if (!['left', 'right'].includes(panelName)) throw new Error('Panel must be left or right.');
    const state = sanitize(stateValue, viewport);
    return sanitize({ ...state, [panelName]: { ...state[panelName], ...patch } }, viewport);
  }

  function resizePanel(stateValue, panelName, deltaOrWidth, viewport = {}, absolute = false) {
    const state = sanitize(stateValue, viewport);
    const panel = state[panelName];
    if (!panel) throw new Error('Panel must be left or right.');
    const width = absolute ? Number(deltaOrWidth) : panel.width + Number(deltaOrWidth || 0);
    return updatePanel(state, panelName, { width, collapsed: false, visible: true }, viewport);
  }

  function togglePanel(stateValue, panelName, viewport = {}) {
    const state = sanitize(stateValue, viewport);
    const panel = state[panelName];
    return updatePanel(state, panelName, { collapsed: !panel.collapsed, visible: true }, viewport);
  }

  function dockPanel(stateValue, panelName, side, viewport = {}) {
    if (!PANEL_SIDES.includes(side)) throw new Error('Dock side must be left or right.');
    return updatePanel(stateValue, panelName, { dock: side, visible: true, collapsed: false }, viewport);
  }

  function toggleRibbon(stateValue, mode = 'compact', viewport = {}) {
    const state = sanitize(stateValue, viewport);
    if (mode === 'collapsed') return sanitize({ ...state, ribbon: { ...state.ribbon, collapsed: !state.ribbon.collapsed } }, viewport);
    return sanitize({ ...state, ribbon: { ...state.ribbon, compact: !state.ribbon.compact, collapsed: false } }, viewport);
  }

  function setFocusMode(stateValue, enabled, viewport = {}) {
    const state = sanitize(stateValue, viewport);
    return sanitize({ ...state, focusMode: Boolean(enabled), distractionFree: false }, viewport);
  }

  function setDistractionFree(stateValue, enabled, viewport = {}) {
    const state = sanitize(stateValue, viewport);
    return sanitize({ ...state, distractionFree: Boolean(enabled), focusMode: false }, viewport);
  }

  function fitZoom(mode, pageBox, viewportBox, targetBox = null, options = {}) {
    if (!FIT_MODES.includes(mode)) throw new Error(`Unsupported fit mode: ${mode}`);
    const page = {
      width: Math.max(1, Number(pageBox?.width) || 794),
      height: Math.max(1, Number(pageBox?.height) || 1123)
    };
    const viewport = {
      width: Math.max(1, Number(viewportBox?.width) || 1000),
      height: Math.max(1, Number(viewportBox?.height) || 700)
    };
    const padding = Math.max(0, Number(options.padding) || 24);
    const usableWidth = Math.max(1, viewport.width - padding * 2);
    const usableHeight = Math.max(1, viewport.height - padding * 2);
    let zoom;
    if (mode === 'width') zoom = usableWidth / page.width;
    else if (mode === 'page') zoom = Math.min(usableWidth / page.width, usableHeight / page.height);
    else {
      const target = targetBox || page;
      const targetWidth = Math.max(1, Number(target.width) || page.width);
      const targetHeight = Math.max(1, Number(target.height) || (mode === 'system' ? page.height / 5 : 80));
      zoom = Math.min(usableWidth / targetWidth, usableHeight / targetHeight);
    }
    return clamp(zoom, options.minimumZoom ?? 0.2, options.maximumZoom ?? 3);
  }

  function presetZoom(value) {
    const zoom = Number(value);
    if (!ZOOM_PRESETS.some(item => Math.abs(item - zoom) < 1e-8)) throw new Error('Zoom preset must be 100%, 125% or 150%.');
    return zoom;
  }

  function ensureVisible(scroll, viewport, target, margin = 28) {
    const current = { left: Math.max(0, Number(scroll?.left) || 0), top: Math.max(0, Number(scroll?.top) || 0) };
    const view = { width: Math.max(1, Number(viewport?.width) || 1), height: Math.max(1, Number(viewport?.height) || 1) };
    const box = {
      left: Number(target?.left) || 0,
      top: Number(target?.top) || 0,
      width: Math.max(1, Number(target?.width) || 1),
      height: Math.max(1, Number(target?.height) || 1)
    };
    const right = box.left + box.width;
    const bottom = box.top + box.height;
    let left = current.left;
    let top = current.top;
    if (box.left < left + margin) left = Math.max(0, box.left - margin);
    else if (right > left + view.width - margin) left = Math.max(0, right - view.width + margin);
    if (box.top < top + margin) top = Math.max(0, box.top - margin);
    else if (bottom > top + view.height - margin) top = Math.max(0, bottom - view.height + margin);
    return Object.freeze({ left, top, changed: left !== current.left || top !== current.top });
  }

  function restoreWindowState(value = {}, workArea = {}) {
    const width = clamp(value.width ?? workArea.width ?? 1366, 800, Math.max(800, Number(workArea.width) || 1920));
    const height = clamp(value.height ?? workArea.height ?? 768, 600, Math.max(600, Number(workArea.height) || 1080));
    const xMax = Math.max(0, (Number(workArea.width) || width) - width);
    const yMax = Math.max(0, (Number(workArea.height) || height) - height);
    return Object.freeze({
      width,
      height,
      x: clamp(value.x ?? 0, 0, xMax),
      y: clamp(value.y ?? 0, 0, yMax),
      maximized: Boolean(value.maximized)
    });
  }

  return Object.freeze({
    PANEL_SIDES,
    ZOOM_PRESETS,
    FIT_MODES,
    clamp,
    viewportMetrics,
    defaults,
    sanitize,
    computeLayout,
    updatePanel,
    resizePanel,
    togglePanel,
    dockPanel,
    toggleRibbon,
    setFocusMode,
    setDistractionFree,
    fitZoom,
    presetZoom,
    ensureVisible,
    restoreWindowState
  });
});
