(function (root, factory) {
  const api = factory(
    typeof require === 'function' ? require('node:crypto') : null
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AirmonFilePublishing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (crypto) {
  'use strict';

  const CURRENT_SCHEMA = 12;
  const PLUGIN_API_VERSION = '1.0';
  const PERMISSIONS = Object.freeze([
    'score.read', 'selection.read', 'score.mutate', 'analysis.run',
    'import.read', 'export.write', 'settings.read', 'settings.write', 'commands.register'
  ]);
  const FORMATS = Object.freeze(['airscore', 'musicxml', 'mxl', 'midi', 'pdf', 'png', 'svg', 'wav']);

  const clone = value => JSON.parse(JSON.stringify(value));
  const slug = value => String(value || 'Untitled Score')
    .normalize('NFKD').replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 96) || 'Untitled-Score';
  const stable = value => {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
    return JSON.stringify(value);
  };
  function digest(value) {
    const text = typeof value === 'string' ? value : stable(value);
    if (crypto?.createHash) return crypto.createHash('sha256').update(text).digest('hex');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  function projectEnvelope(score, options = {}) {
    if (!score || !Array.isArray(score.parts) || !Array.isArray(score.measures)) throw new Error('A complete authoritative score is required.');
    const payload = {
      schemaVersion: CURRENT_SCHEMA,
      application: 'Airmonlink Composer',
      applicationVersion: String(options.applicationVersion || '1.1.18'),
      build: Number(options.build) || 38,
      savedAt: options.savedAt || new Date().toISOString(),
      score: clone(score),
      viewState: clone(options.viewState || score.settings?.viewportSession || {}),
      pluginData: clone(options.pluginData || score.pluginData || {}),
      migration: clone(options.migration || { from: CURRENT_SCHEMA, to: CURRENT_SCHEMA })
    };
    return Object.freeze({ ...payload, checksum: digest(payload) });
  }

  function validateEnvelope(envelope, options = {}) {
    const issues = [];
    if (!envelope || typeof envelope !== 'object') issues.push({ severity: 'error', code: 'INVALID_CONTAINER', message: 'Project container is not an object.' });
    const schema = Number(envelope?.schemaVersion);
    if (!Number.isInteger(schema)) issues.push({ severity: 'error', code: 'MISSING_SCHEMA', message: 'Project schema version is missing.' });
    if (schema > CURRENT_SCHEMA) issues.push({ severity: 'warning', code: 'FUTURE_VERSION', message: `Project schema ${schema} is newer than supported schema ${CURRENT_SCHEMA}.`, readOnly: true });
    if (!envelope?.score?.parts || !envelope?.score?.measures) issues.push({ severity: 'error', code: 'MISSING_SCORE', message: 'Project score content is incomplete.' });
    if (envelope?.checksum) {
      const copy = { ...envelope };
      delete copy.checksum;
      if (digest(copy) !== envelope.checksum) issues.push({ severity: 'error', code: 'CHECKSUM_MISMATCH', message: 'Project checksum does not match its content.' });
    } else if (options.requireChecksum !== false) {
      issues.push({ severity: 'warning', code: 'NO_CHECKSUM', message: 'Legacy project has no integrity checksum.' });
    }
    return Object.freeze({
      valid: !issues.some(issue => issue.severity === 'error'),
      readOnly: issues.some(issue => issue.readOnly),
      schemaVersion: schema || null,
      issues: Object.freeze(issues)
    });
  }

  function migrationPlan(envelope) {
    const validation = validateEnvelope(envelope, { requireChecksum: false });
    if (!validation.valid) return Object.freeze({ allowed: false, validation, steps: Object.freeze([]) });
    const from = Number(envelope.schemaVersion) || 1;
    if (from > CURRENT_SCHEMA) return Object.freeze({ allowed: false, readOnly: true, validation, steps: Object.freeze([]) });
    const steps = [];
    for (let version = from; version < CURRENT_SCHEMA; version += 1) {
      steps.push(Object.freeze({ from: version, to: version + 1, backupRequired: true }));
    }
    return Object.freeze({
      allowed: true,
      backupRequired: steps.length > 0,
      backupName: `${slug(envelope.score?.title)}-schema${from}-backup.airscore`,
      steps: Object.freeze(steps),
      validation
    });
  }

  function atomicSavePlan(targetPath, bytes, options = {}) {
    const clean = String(targetPath || '').trim();
    if (!clean) throw new Error('A target path is required.');
    const token = digest(`${clean}:${bytes?.length || String(bytes).length}:${options.now || Date.now()}`).slice(0, 12);
    return Object.freeze({
      targetPath: clean,
      tempPath: `${clean}.${token}.tmp`,
      backupPath: `${clean}.bak`,
      bytes,
      writeTemp: true,
      fsync: true,
      backupExisting: options.backupExisting !== false,
      verifyBeforeReplace: true,
      replaceAtomically: true,
      rollbackOnFailure: true
    });
  }

  function autosavePlan(score, documentId, options = {}) {
    const seconds = Math.max(10, Math.min(3600, Number(options.intervalSeconds) || 45));
    return Object.freeze({
      documentId: String(documentId || 'untitled'),
      intervalSeconds: seconds,
      recoveryName: `${slug(score?.title)}-${slug(documentId || 'untitled')}.recovery.airscore`,
      checksum: digest(score),
      retain: Math.max(1, Math.min(50, Number(options.retain) || 10)),
      onlyWhenDirty: true,
      atomic: true
    });
  }

  function publishingPlan(score, options = {}) {
    const formats = [...new Set((options.formats || ['pdf']).map(value => String(value).toLowerCase()))]
      .filter(value => FORMATS.includes(value));
    if (!formats.length) throw new Error('Choose at least one supported publishing format.');
    const title = slug(options.baseName || score?.title);
    const includeScore = options.includeScore !== false;
    const partIds = options.partIds || (options.includeParts ? (score?.parts || []).map(part => part.id) : []);
    const targets = [];
    if (includeScore) formats.forEach(format => targets.push({
      kind: 'score', id: 'score', format, filename: `${title}-Score.${format === 'musicxml' ? 'musicxml' : format}`
    }));
    for (const partId of partIds) {
      const part = score.parts.find(item => item.id === partId);
      if (!part) continue;
      const partName = slug(part.name || part.instrument?.name || part.id);
      formats.forEach(format => targets.push({
        kind: 'part', id: partId, format, filename: `${title}-${partName}.${format === 'musicxml' ? 'musicxml' : format}`
      }));
    }
    const pageRange = String(options.pageRange || 'all');
    return Object.freeze({
      preset: options.preset || 'Professional',
      title,
      pageRange,
      copies: Math.max(1, Math.min(999, Number(options.copies) || 1)),
      watermark: options.watermark ? String(options.watermark).slice(0, 160) : '',
      pdfMetadata: Object.freeze({
        title: score?.title || 'Untitled Score',
        author: score?.composer || '',
        subject: options.subject || 'Music score',
        keywords: [...new Set(options.keywords || ['Airmonlink Composer'])]
      }),
      targets: Object.freeze(targets.map(Object.freeze)),
      transactional: true,
      rollbackOnFailure: true,
      checksum: digest(targets)
    });
  }

  async function executeExportTransaction(plan, adapter) {
    if (!plan?.transactional || !Array.isArray(plan.targets)) throw new Error('A transactional publishing plan is required.');
    for (const name of ['render', 'writeTemp', 'commit', 'remove']) {
      if (typeof adapter?.[name] !== 'function') throw new Error(`Export adapter is missing ${name}().`);
    }
    const staged = [];
    const committed = [];
    try {
      for (const target of plan.targets) {
        const bytes = await adapter.render(target, plan);
        if (!bytes || Number(bytes.length) <= 0) throw new Error(`Renderer produced no data for ${target.filename}.`);
        const temp = await adapter.writeTemp(target.filename, bytes);
        staged.push({ target, temp });
      }
      for (const item of staged) {
        const destination = await adapter.commit(item.temp, item.target.filename);
        committed.push(destination || item.target.filename);
      }
      return Object.freeze({ status: 'completed', files: Object.freeze(committed), count: committed.length });
    } catch (error) {
      await Promise.allSettled([...staged.map(item => item.temp), ...committed].map(file => adapter.remove(file)));
      return Object.freeze({ status: 'rolled-back', files: Object.freeze([]), error: error.message, removed: staged.length + committed.length });
    }
  }

  const BUILTIN_TEMPLATES = Object.freeze([
    Object.freeze({ id: 'satb-premium', name: 'SATB Choir', category: 'Choir', parts: ['soprano', 'alto', 'tenor', 'bass'], style: 'choral' }),
    Object.freeze({ id: 'piano-premium', name: 'Piano Grand Staff', category: 'Keyboard', parts: ['piano'], style: 'classical' }),
    Object.freeze({ id: 'lead-premium', name: 'Lead Sheet', category: 'Popular', parts: ['lead'], style: 'compact' }),
    Object.freeze({ id: 'chamber-strings', name: 'String Quartet', category: 'Ensemble', parts: ['violin', 'violin', 'viola', 'cello'], style: 'classical' })
  ]);
  const HOUSE_STYLES = Object.freeze({
    classical: Object.freeze({ pageSize: 'A4', staffSize: 100, systemGap: 48, lyricFontSize: 11, musicFont: 'Bravura' }),
    choral: Object.freeze({ pageSize: 'A4', staffSize: 92, systemGap: 42, lyricFontSize: 10.5, musicFont: 'Bravura' }),
    compact: Object.freeze({ pageSize: 'A4', staffSize: 86, systemGap: 36, lyricFontSize: 10, musicFont: 'Bravura' })
  });

  function validateTemplate(template) {
    const issues = [];
    if (!template?.id || !/^[a-z0-9][a-z0-9-]{1,63}$/i.test(template.id)) issues.push('Template ID is invalid.');
    if (!template?.name) issues.push('Template name is required.');
    if (!Array.isArray(template?.parts) || !template.parts.length) issues.push('Template requires at least one part.');
    return Object.freeze({ valid: !issues.length, issues: Object.freeze(issues) });
  }

  function applyHouseStyle(score, style, options = {}) {
    const value = typeof style === 'string' ? HOUSE_STYLES[style] : style;
    if (!value) throw new Error('Unknown house style.');
    const next = clone(score);
    next.settings = next.settings || {};
    next.settings.page = { ...(next.settings.page || {}), pageSize: value.pageSize, staffSize: value.staffSize, systemGap: value.systemGap };
    next.settings.textStyles = { ...(next.settings.textStyles || {}), lyrics: { fontSize: value.lyricFontSize } };
    next.settings.musicFont = value.musicFont;
    next.settings.houseStyle = options.name || (typeof style === 'string' ? style : 'custom');
    return next;
  }

  function validatePluginManifest(manifest, hostVersion = '1.1.18') {
    const issues = [];
    if (!manifest || typeof manifest !== 'object') issues.push('Manifest is required.');
    if (!/^[a-z0-9][a-z0-9._-]{2,95}$/i.test(String(manifest?.id || ''))) issues.push('Plugin ID is invalid.');
    if (!/^\d+\.\d+\.\d+(?:[-+].*)?$/.test(String(manifest?.version || ''))) issues.push('Plugin version must be semantic.');
    if (manifest?.apiVersion !== PLUGIN_API_VERSION) issues.push(`Plugin API ${manifest?.apiVersion || 'missing'} is incompatible with ${PLUGIN_API_VERSION}.`);
    const permissions = [...new Set(manifest?.permissions || [])];
    const unknown = permissions.filter(permission => !PERMISSIONS.includes(permission));
    if (unknown.length) issues.push(`Unknown permissions: ${unknown.join(', ')}.`);
    if (manifest?.minimumHostVersion && compareVersions(hostVersion, manifest.minimumHostVersion) < 0) issues.push(`Host ${hostVersion} is older than required ${manifest.minimumHostVersion}.`);
    return Object.freeze({ valid: !issues.length, issues: Object.freeze(issues), permissions: Object.freeze(permissions) });
  }

  function compareVersions(left, right) {
    const a = String(left).split(/[.-]/).slice(0, 3).map(Number);
    const b = String(right).split(/[.-]/).slice(0, 3).map(Number);
    for (let index = 0; index < 3; index += 1) {
      const difference = (a[index] || 0) - (b[index] || 0);
      if (difference) return Math.sign(difference);
    }
    return 0;
  }

  function createPluginHost(manifest, handlers = {}, options = {}) {
    const validation = validatePluginManifest(manifest, options.hostVersion);
    if (!validation.valid) throw new Error(validation.issues.join(' '));
    let enabled = options.enabled !== false;
    const logs = [];
    const settings = clone(options.settings || {});
    const has = permission => validation.permissions.includes(permission);
    const requirePermission = permission => {
      if (!enabled) throw new Error(`Plugin ${manifest.id} is disabled.`);
      if (!has(permission)) throw new Error(`Plugin ${manifest.id} lacks permission ${permission}.`);
    };
    const api = Object.freeze({
      manifest: Object.freeze(clone(manifest)),
      readScore() { requirePermission('score.read'); return clone(handlers.readScore?.()); },
      readSelection() { requirePermission('selection.read'); return clone(handlers.readSelection?.()); },
      mutate(command) {
        requirePermission('score.mutate');
        if (!command || typeof command.name !== 'string' || command.name.length > 80) throw new Error('Plugin mutation command is invalid.');
        return handlers.mutate?.(clone(command));
      },
      analyse(request) { requirePermission('analysis.run'); return clone(handlers.analyse?.(clone(request))); },
      getSetting(key) { requirePermission('settings.read'); return clone(settings[key]); },
      setSetting(key, value) { requirePermission('settings.write'); settings[String(key).slice(0, 80)] = clone(value); return true; },
      log(level, message) {
        const entry = Object.freeze({ at: new Date().toISOString(), level: ['debug', 'info', 'warn', 'error'].includes(level) ? level : 'info', message: String(message).slice(0, 2000) });
        logs.push(entry); handlers.log?.(entry); return entry;
      }
    });
    return Object.freeze({
      api,
      run(command, payload) {
        if (!enabled) return Object.freeze({ status: 'disabled' });
        try {
          const result = handlers.execute?.(command, clone(payload), api);
          return Object.freeze({ status: 'completed', result: clone(result) });
        } catch (error) {
          api.log('error', error.message);
          return Object.freeze({ status: 'isolated-error', error: error.message });
        }
      },
      enable() { enabled = true; return true; },
      disable() { enabled = false; return true; },
      uninstall() { enabled = false; Object.keys(settings).forEach(key => delete settings[key]); return Object.freeze({ removed: true, id: manifest.id }); },
      status() { return Object.freeze({ enabled, logs: Object.freeze([...logs]), settings: clone(settings) }); }
    });
  }

  function recognitionReview(kind, source, candidates = [], options = {}) {
    if (!['omr', 'audio-transcription'].includes(kind)) throw new Error('Recognition kind must be omr or audio-transcription.');
    const maximum = Math.max(1, Math.min(100000, Number(options.maximumCandidates) || 10000));
    if (candidates.length > maximum) throw new Error('Recognition result exceeds the configured safety limit.');
    const normalized = candidates.map((item, index) => Object.freeze({
      id: String(item.id || `${kind}-${index + 1}`),
      start: Math.max(0, Number(item.start) || 0),
      duration: Math.max(0.03125, Number(item.duration) || 1),
      midi: Math.max(0, Math.min(127, Math.round(Number(item.midi) || 60))),
      confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)),
      accepted: item.accepted === true,
      sourceRegion: clone(item.sourceRegion || null)
    }));
    const threshold = Math.max(0, Math.min(1, Number(options.autoReviewThreshold) || 0.9));
    return Object.freeze({
      id: `review-${digest(`${kind}:${String(source).slice(0, 1024)}:${stable(normalized)}`).slice(0, 16)}`,
      kind,
      sourceDigest: digest(String(source || '')),
      candidates: Object.freeze(normalized),
      lowConfidenceCount: normalized.filter(item => item.confidence < threshold).length,
      requiresHumanReview: true,
      mutatesScore: false,
      threshold
    });
  }

  return Object.freeze({
    CURRENT_SCHEMA, PLUGIN_API_VERSION, PERMISSIONS, FORMATS, BUILTIN_TEMPLATES, HOUSE_STYLES,
    digest, projectEnvelope, validateEnvelope, migrationPlan, atomicSavePlan, autosavePlan,
    publishingPlan, executeExportTransaction, validateTemplate, applyHouseStyle,
    validatePluginManifest, createPluginHost, recognitionReview
  });
});
