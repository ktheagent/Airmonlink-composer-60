(() => {
  'use strict';

  const api = window.AirmonProfessionalWorkspace;
  if (!api) throw new Error('Professional workspace service is unavailable.');

  const storageKey = 'airmonlink.composer.professionalWorkspace.v1';
  const workspace = document.querySelector('.workspace');
  const inspector = document.querySelector('.inspector');
  const keypad = document.querySelector('#notationKeypad');
  const commandDeck = document.querySelector('.command-deck');
  const scoreArea = document.querySelector('#scoreArea');
  const viewPanel = document.querySelector('#panel-view');
  if (!workspace || !inspector || !keypad || !commandDeck || !scoreArea || !viewPanel) {
    throw new Error('Professional workspace requires the canonical five-zone interface.');
  }

  let state;
  let applying = false;
  try {
    state = api.sanitize(JSON.parse(localStorage.getItem(storageKey) || '{}'), viewport());
  } catch (_) {
    state = api.defaults(viewport());
  }

  function viewport() {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  function button(label, command, title = '') {
    const node = document.createElement('button');
    node.type = 'button';
    node.textContent = label;
    node.dataset.workspaceCommand = command;
    if (title) node.title = title;
    return node;
  }

  function range(label, side, value, minimum, maximum) {
    const node = document.createElement('label');
    node.className = 'workspace-size-control';
    node.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(minimum);
    input.max = String(maximum);
    input.step = '4';
    input.value = String(value);
    input.dataset.workspaceSize = side;
    input.setAttribute('aria-label', `${label} width`);
    node.appendChild(input);
    return node;
  }

  function installControls() {
    if (document.querySelector('[data-group="PROFESSIONAL WORKSPACE"]')) return;
    const metrics = api.viewportMetrics(viewport());
    const group = document.createElement('div');
    group.className = 'group professional-workspace-controls';
    group.dataset.group = 'PROFESSIONAL WORKSPACE';
    const title = document.createElement('span');
    title.textContent = 'Professional workspace';
    group.append(
      title,
      button('Left panel', 'toggle-left', 'Collapse or restore the inspector'),
      range('Left', 'left', state.left.width, metrics.leftMinimum, metrics.leftMaximum),
      button('Dock left ↔', 'dock-left', 'Move the inspector between the left and right dock'),
      button('Right panel', 'toggle-right', 'Collapse or restore note input'),
      range('Right', 'right', state.right.width, metrics.rightMinimum, metrics.rightMaximum),
      button('Dock right ↔', 'dock-right', 'Move note input between the right and left dock'),
      button('Compact ribbon', 'compact-ribbon'),
      button('Collapse ribbon', 'collapse-ribbon'),
      button('Focus', 'focus'),
      button('Distraction free', 'distraction')
    );
    viewPanel.appendChild(group);
  }

  function persist() {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  function panelPlacement(panelName, panel, node) {
    node.dataset.dock = panel.dock;
    node.classList.toggle('workspace-panel-collapsed', panel.collapsed || !panel.visible);
    node.style.setProperty('--professional-panel-width', `${panel.width}px`);
    if (panelName === 'left') {
      node.setAttribute('aria-hidden', String(panel.collapsed || !panel.visible));
      node.inert = panel.collapsed || !panel.visible;
    }
  }

  function apply({ save = true } = {}) {
    if (applying) return;
    applying = true;
    state = api.sanitize(state, viewport());
    const layout = api.computeLayout(state, viewport());
    workspace.classList.add('professional-workspace');
    workspace.dataset.leftDock = state.left.dock;
    workspace.dataset.rightDock = state.right.dock;
    const leftDockPanel = state.left.dock === 'left' ? state.left : state.right;
    const rightDockPanel = state.left.dock === 'right' ? state.left : state.right;
    workspace.style.setProperty('--dock-left-width', `${leftDockPanel.collapsed || !leftDockPanel.visible ? 0 : leftDockPanel.width}px`);
    workspace.style.setProperty('--dock-right-width', `${rightDockPanel.collapsed || !rightDockPanel.visible ? 0 : rightDockPanel.width}px`);
    workspace.style.setProperty('--workspace-score-minimum', `${layout.metrics.minimumScoreWidth}px`);
    document.body.classList.toggle('ribbon-compact', state.ribbon.compact);
    document.body.classList.toggle('ribbon-collapsed', state.ribbon.collapsed);
    document.body.classList.toggle('focus-mode', state.focusMode);
    document.body.classList.toggle('distraction-free', state.distractionFree);
    panelPlacement('left', state.left, inspector);
    panelPlacement('right', state.right, keypad);
    const leftRange = document.querySelector('[data-workspace-size="left"]');
    const rightRange = document.querySelector('[data-workspace-size="right"]');
    if (leftRange) leftRange.value = String(state.left.width);
    if (rightRange) rightRange.value = String(state.right.width);
    document.querySelectorAll('[data-workspace-command="focus"]').forEach(node => node.setAttribute('aria-pressed', String(state.focusMode)));
    document.querySelectorAll('[data-workspace-command="distraction"]').forEach(node => node.setAttribute('aria-pressed', String(state.distractionFree)));
    if (save) persist();
    window.dispatchEvent(new CustomEvent('airmonlink-workspace-reflow', { detail: layout }));
    applying = false;
  }

  function handleCommand(command) {
    if (command === 'toggle-left') state = api.togglePanel(state, 'left', viewport());
    else if (command === 'toggle-right') state = api.togglePanel(state, 'right', viewport());
    else if (command === 'dock-left') {
      const side = state.left.dock === 'left' ? 'right' : 'left';
      state = api.dockPanel(state, 'left', side, viewport());
      if (state.right.dock === side) state = api.dockPanel(state, 'right', side === 'left' ? 'right' : 'left', viewport());
    } else if (command === 'dock-right') {
      const side = state.right.dock === 'right' ? 'left' : 'right';
      state = api.dockPanel(state, 'right', side, viewport());
      if (state.left.dock === side) state = api.dockPanel(state, 'left', side === 'left' ? 'right' : 'left', viewport());
    }
    else if (command === 'compact-ribbon') state = api.toggleRibbon(state, 'compact', viewport());
    else if (command === 'collapse-ribbon') state = api.toggleRibbon(state, 'collapsed', viewport());
    else if (command === 'focus') state = api.setFocusMode(state, !state.focusMode, viewport());
    else if (command === 'distraction') state = api.setDistractionFree(state, !state.distractionFree, viewport());
    else return;
    apply();
  }

  function keepEditingTargetVisible() {
    const selected = scoreArea.querySelector('.note-event.selected,.rest-event.selected,[data-caret="true"],.notation-caret');
    if (!selected) return;
    const areaRect = scoreArea.getBoundingClientRect();
    const targetRect = selected.getBoundingClientRect();
    const target = {
      left: scoreArea.scrollLeft + targetRect.left - areaRect.left,
      top: scoreArea.scrollTop + targetRect.top - areaRect.top,
      width: targetRect.width,
      height: targetRect.height
    };
    const next = api.ensureVisible(
      { left: scoreArea.scrollLeft, top: scoreArea.scrollTop },
      { width: areaRect.width, height: areaRect.height },
      target
    );
    if (next.changed) scoreArea.scrollTo({ left: next.left, top: next.top, behavior: 'smooth' });
  }

  installControls();
  viewPanel.addEventListener('click', event => {
    const target = event.target.closest('[data-workspace-command]');
    if (target) handleCommand(target.dataset.workspaceCommand);
  });
  viewPanel.addEventListener('input', event => {
    const side = event.target.dataset.workspaceSize;
    if (!side) return;
    state = api.resizePanel(state, side, Number(event.target.value), viewport(), true);
    apply();
  });
  window.addEventListener('resize', () => {
    state = api.sanitize(state, viewport());
    apply({ save: false });
  });
  scoreArea.addEventListener('focusin', keepEditingTargetVisible);
  scoreArea.addEventListener('click', () => requestAnimationFrame(keepEditingTargetVisible));
  document.addEventListener('keydown', event => {
    if (event.key === 'F11') {
      event.preventDefault();
      handleCommand('distraction');
    } else if (event.key.toLowerCase() === 'f' && event.ctrlKey && event.shiftKey) {
      event.preventDefault();
      handleCommand('focus');
    }
  });

  apply({ save: false });
  window.AirmonWorkspaceController = Object.freeze({
    state: () => JSON.parse(JSON.stringify(state)),
    applyState(value) {
      state = api.sanitize(value, viewport());
      apply();
      return this.state();
    },
    keepEditingTargetVisible
  });
})();
