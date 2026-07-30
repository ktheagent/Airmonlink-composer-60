(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AirmonProductivityReliability = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));
  const clone = value => JSON.parse(JSON.stringify(value));
  const DEFAULT_BUDGETS = Object.freeze({
    startupColdMs: 4000, startupWarmMs: 1800, usableScoreMs: 1200,
    noteInputMs: 40, selectionMs: 50, pageRenderMs: 220,
    reflowMs: 180, zoomMs: 120, scrollFrameMs: 16.7,
    playbackStartMs: 180, importMs: 3000, exportMs: 5000,
    pdfMs: 8000, shutdownMs: 1500, largeScoreMemoryMb: 650
  });

  function normalizePreferences(value = {}) {
    return Object.freeze({
      theme: ['system', 'light', 'dark', 'high-contrast'].includes(value.theme) ? value.theme : 'system',
      interfaceScale: clamp(value.interfaceScale || 1, .75, 2),
      reducedMotion: Boolean(value.reducedMotion),
      highContrast: Boolean(value.highContrast),
      largeControls: Boolean(value.largeControls),
      autosaveSeconds: clamp(value.autosaveSeconds || 45, 10, 3600),
      notificationDurationMs: clamp(value.notificationDurationMs || 5000, 1000, 30000),
      workspace: ['setup', 'write', 'engrave', 'play', 'publish'].includes(value.workspace) ? value.workspace : 'write',
      selectionFilter: Object.freeze({
        notes: value.selectionFilter?.notes !== false,
        rests: value.selectionFilter?.rests !== false,
        lyrics: value.selectionFilter?.lyrics !== false,
        text: value.selectionFilter?.text !== false,
        spanners: value.selectionFilter?.spanners !== false,
        voice: [1, 2, 3, 4, 'all'].includes(value.selectionFilter?.voice) ? value.selectionFilter.voice : 'all'
      })
    });
  }

  function commandIndex(commands = []) {
    return Object.freeze(commands.map((command, index) => Object.freeze({
      id: String(command.id || command.command || `command-${index}`),
      label: String(command.label || command.title || command.id || 'Command'),
      description: String(command.description || ''),
      category: String(command.category || command.group || 'General'),
      keywords: Object.freeze([...(command.keywords || [])].map(String)),
      shortcut: command.shortcut ? normalizeShortcut(command.shortcut) : '',
      enabled: command.enabled !== false,
      context: Object.freeze([...(command.context || ['score'])])
    })));
  }

  function searchCommands(index, query, context = ['score']) {
    const tokens = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
    return Object.freeze(index.map(item => {
      const haystack = [item.label, item.description, item.category, ...item.keywords, item.shortcut].join(' ').toLowerCase();
      const score = tokens.reduce((sum, token) => sum + (item.label.toLowerCase().includes(token) ? 8 : haystack.includes(token) ? 3 : -100), 0)
        + item.context.reduce((sum, type) => sum + (context.includes(type) ? 2 : 0), 0);
      return { ...item, score };
    }).filter(item => !tokens.length || item.score >= 0).sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).map(Object.freeze));
  }

  function normalizeShortcut(value) {
    const aliases = { cmd: 'Meta', command: 'Meta', control: 'Ctrl', option: 'Alt', escape: 'Esc', return: 'Enter' };
    const order = ['Ctrl', 'Meta', 'Alt', 'Shift'];
    const parts = String(value || '').split('+').map(item => item.trim()).filter(Boolean)
      .map(item => aliases[item.toLowerCase()] || (item.length === 1 ? item.toUpperCase() : item[0].toUpperCase() + item.slice(1)));
    const modifiers = order.filter(item => parts.includes(item));
    const key = parts.find(item => !order.includes(item)) || '';
    return [...modifiers, key].filter(Boolean).join('+');
  }

  function validateShortcutMap(map = {}, reserved = ['Ctrl+R', 'Ctrl+Shift+I', 'F12']) {
    const issues = [];
    const reverse = new Map();
    const normalized = {};
    for (const [command, shortcut] of Object.entries(map)) {
      const value = normalizeShortcut(shortcut);
      normalized[command] = value;
      if (!value) continue;
      if (reserved.includes(value)) issues.push({ code: 'RESERVED', command, shortcut: value });
      if (reverse.has(value)) issues.push({ code: 'CONFLICT', command, other: reverse.get(value), shortcut: value });
      else reverse.set(value, command);
    }
    return Object.freeze({ valid: !issues.length, map: Object.freeze(normalized), issues: Object.freeze(issues.map(Object.freeze)) });
  }

  function findInScore(score, query = {}) {
    const text = String(query.text || '').trim().toLowerCase();
    const eventType = query.eventType || 'all';
    const voice = query.voice === 'all' || query.voice == null ? null : clamp(query.voice, 1, 4);
    const results = [];
    for (const part of score?.parts || []) {
      for (const event of part.events || []) {
        if (eventType !== 'all' && event.type !== eventType) continue;
        if (voice != null && Number(event.voice || 1) !== voice) continue;
        const searchable = [
          event.pitch, event.writtenPitch, event.chordSymbol, event.dynamic,
          ...(event.lyrics || []).map(item => item.text),
          ...(event.articulations || []), ...(event.ornaments || [])
        ].filter(Boolean).join(' ').toLowerCase();
        if (text && !searchable.includes(text)) continue;
        results.push(Object.freeze({
          partId: part.id, eventId: event.id, start: Number(event.start) || 0,
          measure: typeof query.measureAt === 'function' ? query.measureAt(Number(event.start) || 0) + 1 : null,
          type: event.type, pitch: event.pitch || event.writtenPitch || null
        }));
      }
    }
    return Object.freeze(results.sort((a, b) => a.start - b.start || a.partId.localeCompare(b.partId)));
  }

  function navigatorModel(score, layoutPages = []) {
    const totalBeats = Math.max(0, ...(score?.parts || []).flatMap(part => (part.events || []).map(event => Number(event.start) + Number(event.duration || 0))), 0);
    return Object.freeze({
      measures: Object.freeze((score?.measures || []).map((measure, index) => Object.freeze({
        index, number: index + 1, start: Number(measure.start) || 0,
        rehearsal: measure.rehearsalMark || null, key: measure.keySignature || null, time: measure.timeSignature || null
      }))),
      parts: Object.freeze((score?.parts || []).map(part => Object.freeze({ id: part.id, name: part.name, eventCount: (part.events || []).length }))),
      pages: Object.freeze(layoutPages.map((page, index) => Object.freeze({ index, number: index + 1, start: page.startBeat ?? null, end: page.endBeat ?? null }))),
      totalBeats
    });
  }

  function applySelectionFilter(entries, filter = {}) {
    const normalized = normalizePreferences({ selectionFilter: filter }).selectionFilter;
    return Object.freeze((entries || []).filter(entry => {
      const event = entry.event || entry;
      if (event.type === 'note' && !normalized.notes) return false;
      if (event.type === 'rest' && !normalized.rests) return false;
      if ((event.lyrics || []).length && !normalized.lyrics) return false;
      if (['text', 'annotation'].includes(event.type) && !normalized.text) return false;
      if ((event.spanners || []).length && !normalized.spanners) return false;
      if (normalized.voice !== 'all' && Number(event.voice || 1) !== normalized.voice) return false;
      return true;
    }));
  }

  function batchPlan(entries, operation, options = {}) {
    const allowed = ['transpose', 'duration', 'velocity', 'voice', 'articulation', 'delete'];
    if (!allowed.includes(operation)) throw new Error(`Unsupported batch operation: ${operation}.`);
    const ids = [...new Set((entries || []).map(entry => entry.event?.id || entry.id).filter(Boolean))];
    if (!ids.length) throw new Error('Batch operation requires a selection.');
    return Object.freeze({
      id: `batch-${operation}-${ids.length}`,
      operation,
      eventIds: Object.freeze(ids),
      options: Object.freeze(clone(options)),
      singleTransaction: true,
      previewRequired: ['transpose', 'duration', 'delete'].includes(operation)
    });
  }

  class TaskController {
    constructor(options = {}) {
      this.tasks = new Map();
      this.listeners = new Set();
      this.maximum = clamp(options.maximum || 20, 1, 100);
    }
    subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    emit(task) { this.listeners.forEach(listener => { try { listener(Object.freeze(clone(task))); } catch (_) {} }); }
    start(label, options = {}) {
      if (this.tasks.size >= this.maximum) throw new Error('Too many background tasks are active.');
      const id = String(options.id || `task-${Date.now()}-${this.tasks.size + 1}`);
      const controller = typeof AbortController === 'function' ? new AbortController() : { signal: { aborted: false }, abort() { this.signal.aborted = true; } };
      const task = { id, label: String(label), status: 'running', progress: 0, cancellable: options.cancellable !== false, startedAt: Date.now(), controller };
      this.tasks.set(id, task); this.emit(task);
      return Object.freeze({
        id, signal: controller.signal,
        update: (progress, message = '') => this.update(id, progress, message),
        complete: result => this.complete(id, result),
        fail: error => this.fail(id, error),
        cancel: () => this.cancel(id)
      });
    }
    update(id, progress, message = '') {
      const task = this.tasks.get(id); if (!task || task.status !== 'running') return false;
      task.progress = clamp(progress, 0, 1); task.message = String(message).slice(0, 500); this.emit(task); return true;
    }
    complete(id, result) {
      const task = this.tasks.get(id); if (!task) return false;
      task.status = 'completed'; task.progress = 1; task.result = clone(result); task.finishedAt = Date.now(); this.emit(task); return true;
    }
    fail(id, error) {
      const task = this.tasks.get(id); if (!task) return false;
      task.status = 'failed'; task.error = error?.message || String(error); task.finishedAt = Date.now(); this.emit(task); return true;
    }
    cancel(id) {
      const task = this.tasks.get(id); if (!task || !task.cancellable || task.status !== 'running') return false;
      task.controller.abort(); task.status = 'cancelled'; task.finishedAt = Date.now(); this.emit(task); return true;
    }
    snapshot() { return Object.freeze([...this.tasks.values()].map(task => Object.freeze({ ...clone(task), controller: undefined }))); }
    clearFinished() { for (const [id, task] of this.tasks) if (task.status !== 'running') this.tasks.delete(id); }
  }

  function notification(message, options = {}) {
    return Object.freeze({
      id: String(options.id || `notice-${Date.now()}`),
      message: String(message || '').slice(0, 2000),
      kind: ['info', 'success', 'warning', 'error'].includes(options.kind) ? options.kind : 'info',
      assertive: options.kind === 'error',
      actions: Object.freeze((options.actions || []).slice(0, 3).map(action => Object.freeze({ id: String(action.id), label: String(action.label).slice(0, 80) }))),
      timeoutMs: options.persist ? 0 : clamp(options.timeoutMs || 5000, 1000, 30000)
    });
  }

  function classifyFailure(error, context = {}) {
    const code = String(error?.code || context.code || 'UNKNOWN');
    const map = {
      EACCES: ['READ_ONLY', 'The destination is not writable.', 'Choose another folder or adjust permissions.'],
      EPERM: ['READ_ONLY', 'The operation is not permitted.', 'Close other applications or choose another folder.'],
      ENOSPC: ['DISK_FULL', 'The destination drive is full.', 'Free space and retry; the original file was not replaced.'],
      ENOENT: ['MISSING_RESOURCE', 'A required file, font, library or device is unavailable.', 'Locate the resource or choose a replacement.'],
      CORRUPT_PROJECT: ['DAMAGED_PROJECT', 'The project failed integrity validation.', 'Open a backup or recovery copy.'],
      FUTURE_VERSION: ['FUTURE_VERSION', 'This project was created by a newer application version.', 'Open read-only or update the application.'],
      OVERSIZED_INPUT: ['INPUT_LIMIT', 'The input exceeds the configured safety limit.', 'Use a smaller file or split the import.'],
      DEVICE_UNAVAILABLE: ['DEVICE_UNAVAILABLE', 'The selected MIDI or audio device is unavailable.', 'Choose another device and retry.'],
      PLUGIN_FAILURE: ['PLUGIN_FAILURE', 'A plugin failed and was isolated.', 'Disable the plugin or review its log.']
    };
    const [kind, message, recovery] = map[code] || ['UNKNOWN', error?.message || 'An unexpected operation failed.', 'Retry or open diagnostics.'];
    return Object.freeze({ code, kind, message, recovery, retryable: !['DAMAGED_PROJECT', 'FUTURE_VERSION', 'INPUT_LIMIT'].includes(kind), preservesOriginal: true });
  }

  function validatePath(target, options = {}) {
    const value = String(target || '');
    const issues = [];
    if (!value || value.length > (options.maximumLength || 1024)) issues.push('Path is empty or too long.');
    if (value.includes('\0')) issues.push('Path contains a null byte.');
    if (/(^|[\\/])\.\.([\\/]|$)/.test(value) && options.allowParent !== true) issues.push('Parent-directory traversal is not allowed.');
    if (/^(https?|javascript|data):/i.test(value)) issues.push('URL schemes are not valid file paths.');
    return Object.freeze({ valid: !issues.length, normalized: value.replace(/[\\/]+/g, '/'), issues: Object.freeze(issues) });
  }

  function validateExternalUrl(value, allowedProtocols = ['https:']) {
    try {
      const url = new URL(String(value));
      const valid = allowedProtocols.includes(url.protocol) && !url.username && !url.password;
      return Object.freeze({ valid, url: valid ? url.toString() : null, reason: valid ? '' : 'Protocol or embedded credentials are not allowed.' });
    } catch (_) { return Object.freeze({ valid: false, url: null, reason: 'URL is invalid.' }); }
  }

  function accessibilityAudit(documentLike) {
    const issues = [];
    const controls = [...(documentLike?.querySelectorAll?.('button,input,select,textarea,[tabindex]') || [])];
    controls.forEach((control, index) => {
      if (control.disabled || control.hidden) return;
      const name = control.getAttribute?.('aria-label') || control.getAttribute?.('title') || control.textContent?.trim() || control.labels?.[0]?.textContent?.trim();
      if (!name) issues.push({ code: 'MISSING_NAME', index });
      const tabindex = Number(control.getAttribute?.('tabindex'));
      if (Number.isFinite(tabindex) && tabindex > 0) issues.push({ code: 'POSITIVE_TABINDEX', index });
    });
    return Object.freeze({ passed: !issues.length, controls: controls.length, issues: Object.freeze(issues.map(Object.freeze)) });
  }

  function performanceReport(samples = {}, budgets = DEFAULT_BUDGETS) {
    const results = Object.entries(budgets).map(([metric, budget]) => {
      const value = Number(samples[metric]);
      return Object.freeze({ metric, value: Number.isFinite(value) ? value : null, budget, passed: Number.isFinite(value) ? value <= budget : false });
    });
    return Object.freeze({
      budgets: Object.freeze({ ...budgets }),
      results: Object.freeze(results),
      passed: results.every(item => item.passed),
      missing: Object.freeze(results.filter(item => item.value == null).map(item => item.metric))
    });
  }

  function debounce(fn, wait = 50) {
    let timer = null;
    const wrapped = (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => { timer = null; fn(...args); }, clamp(wait, 0, 5000));
    };
    wrapped.cancel = () => { clearTimeout(timer); timer = null; };
    return wrapped;
  }

  return Object.freeze({
    DEFAULT_BUDGETS, normalizePreferences, commandIndex, searchCommands, normalizeShortcut,
    validateShortcutMap, findInScore, navigatorModel, applySelectionFilter, batchPlan,
    TaskController, notification, classifyFailure, validatePath, validateExternalUrl,
    accessibilityAudit, performanceReport, debounce
  });
});
