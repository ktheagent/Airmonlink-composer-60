(function (root, factory) {
  const dependencies = {
    model: root.AirmonScoreModel || (typeof require === 'function' ? require('./score-model') : null),
    solfa: root.AirmonSolfa || (typeof require === 'function' ? require('./solfa') : null),
    parser: root.AirmonSolfaParser || (typeof require === 'function' ? require('./solfa-parser') : null),
    lyrics: root.AirmonLyrics || (typeof require === 'function' ? require('./lyrics') : null)
  };
  const api = factory(dependencies);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AirmonChoirSolfa = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';

  if (!deps.model || !deps.solfa || !deps.parser || !deps.lyrics) {
    throw new Error('Choir and Tonic Sol-fa dependencies are unavailable.');
  }

  const VIEW_MODES = Object.freeze(['staff', 'solfa', 'staff-solfa', 'split']);
  const SATB_RANGES = Object.freeze({
    soprano: Object.freeze({ low: 60, high: 81 }),
    alto: Object.freeze({ low: 53, high: 74 }),
    tenor: Object.freeze({ low: 48, high: 69 }),
    bass: Object.freeze({ low: 40, high: 64 })
  });
  const PUBLICATION_FIELDS = Object.freeze([
    'title', 'subtitle', 'dedication', 'composer', 'lyricist', 'arranger',
    'translator', 'compositionDate', 'copyright', 'source', 'publisher', 'credits'
  ]);

  function normalizeViewMode(value) {
    const mode = String(value || 'staff').toLowerCase();
    return VIEW_MODES.includes(mode) ? mode : 'staff';
  }

  function grammarModel(convention = 'airmonlink-traditional-v1') {
    const symbols = deps.parser.symbolTable(convention);
    const bySymbol = Object.freeze(Object.fromEntries(symbols.map(item => [item.symbol, Object.freeze({ ...item })])));
    return Object.freeze({
      convention,
      syllables: Object.freeze(['d', 'r', 'm', 'f', 's', 'l', 't']),
      chromatic: Object.freeze(['di', 'ra', 'me', 'fi', 'se', 'le', 'te']),
      punctuation: Object.freeze([',', '.', '-', '_', '|', ':']),
      symbols: Object.freeze(symbols.map(item => Object.freeze({ ...item }))),
      bySymbol
    });
  }

  function parsePassage(score, text, options = {}) {
    const result = deps.solfa.previewSolfaToStaff(score, text, options);
    const timeline = result.events.map(event => Object.freeze({
      type: event.rest ? 'rest' : 'note',
      syllable: event.syllable || '',
      measure: event.measure,
      beat: event.beat,
      start: event.start,
      duration: event.duration,
      voice: event.voice,
      staff: event.staff,
      pitch: event.pitch || null,
      midi: event.midi ?? null,
      tieStart: Boolean(event.tieStart),
      tieStop: Boolean(event.tieStop),
      slurStart: Boolean(event.slurStart),
      slurStop: Boolean(event.slurStop),
      melisma: Boolean(event.melisma),
      continuations: Object.freeze([...(event.continuations || [])])
    }));
    return Object.freeze({
      valid: result.valid,
      convention: result.convention,
      tokens: Object.freeze(result.tokens.map(token => Object.freeze({ ...token }))),
      timeline: Object.freeze(timeline),
      measures: Object.freeze(result.measures.map(measure => Object.freeze({ ...measure }))),
      diagnostics: Object.freeze(result.diagnostics.map(item => Object.freeze({ ...item })))
    });
  }

  function punctuationAudit(score, text, options = {}) {
    const parsed = parsePassage(score, text, options);
    const tokenCounts = parsed.tokens.reduce((output, token) => {
      const raw = String(token.raw || token.value || '');
      for (const symbol of [',', '.', '-', '_', '|', ':']) {
        if (raw.includes(symbol) || token.type === ({
          '-': 'continuation', '_': 'melisma', '|': 'measure-boundary'
        }[symbol])) output[symbol] = (output[symbol] || 0) + 1;
      }
      return output;
    }, { ',': 0, '.': 0, '-': 0, '_': 0, '|': 0, ':': 0 });
    const duration = parsed.timeline.reduce((max, event) => Math.max(max, event.start + event.duration), 0);
    return Object.freeze({
      valid: parsed.valid,
      counts: Object.freeze(tokenCounts),
      totalDuration: duration,
      measureCount: parsed.measures.length,
      diagnostics: parsed.diagnostics,
      interpretation: Object.freeze({
        comma: 'lower-octave or subdivision according to token position',
        dot: 'half-pulse subdivision or duration suffix',
        dash: 'continue previous sounding event without retrigger',
        underscore: 'melisma continuation without new pitch',
        bar: 'close current measure and begin the next',
        colon: 'advance to the next pulse grid'
      })
    });
  }

  function applyVoicePassage(score, partId, text, options = {}) {
    const voice = Math.max(1, Math.min(4, Math.round(Number(options.voice) || 1)));
    const result = deps.solfa.applySolfaPassage(score, partId, text, { ...options, voice });
    return Object.freeze({
      voice,
      partId,
      createdIds: Object.freeze(result.created.map(event => event.id)),
      diagnostics: Object.freeze(result.diagnostics.map(item => Object.freeze({ ...item }))),
      convention: result.convention,
      valid: result.valid
    });
  }

  function lyricVerseMatrix(score, options = {}) {
    const requestedParts = options.partIds ? new Set(options.partIds) : null;
    const requestedVoices = options.voices ? new Set(options.voices.map(Number)) : null;
    const rows = [];
    score.parts.forEach(part => {
      if (requestedParts && !requestedParts.has(part.id)) return;
      part.events.filter(event => event.type === 'note' && event.generatedBy !== 'gap-fill')
        .sort((a, b) => a.start - b.start || (a.voice || 1) - (b.voice || 1))
        .forEach(event => {
          if (requestedVoices && !requestedVoices.has(Number(event.voice) || 1)) return;
          const lyrics = (event.lyrics || []).map(item => Object.freeze({
            id: item.id,
            verse: Number(item.verse) || 1,
            text: String(item.text || ''),
            syllabic: item.syllabic || 'single',
            melisma: Boolean(item.melisma),
            extensionState: item.extensionState || 'none',
            lineType: item.lineType || 'verse',
            offsetX: Number(item.offsetX) || 0,
            offsetY: Number(item.offsetY) || 0
          }));
          rows.push(Object.freeze({
            eventId: event.id,
            partId: part.id,
            partName: part.name,
            staff: event.staff || null,
            voice: Number(event.voice) || 1,
            start: Number(event.start) || 0,
            lyrics: Object.freeze(lyrics)
          }));
        });
    });
    return Object.freeze(rows);
  }

  function applyLyrics(score, text, options = {}) {
    const preview = deps.lyrics.previewAssignments(score, text, options);
    const applied = deps.lyrics.applyAssignments(score, preview, {
      verse: Math.max(1, Math.min(24, Number(options.verse) || 1)),
      lineType: options.lineType || 'verse'
    });
    return Object.freeze({
      applied,
      overflow: preview.overflow,
      consumedNotes: preview.consumedNotes,
      availableNotes: preview.availableNotes,
      assignments: Object.freeze(preview.assignments.map(item => Object.freeze({
        partId: item.partId,
        noteId: item.noteId,
        valid: item.valid,
        text: item.token.text,
        syllabic: item.token.syllabic,
        melisma: item.token.melisma
      })))
    });
  }

  function publicationMetadata(score, patch = null) {
    if (patch && typeof patch === 'object') {
      score.metadata ||= {};
      PUBLICATION_FIELDS.forEach(field => {
        if (Object.prototype.hasOwnProperty.call(patch, field)) score.metadata[field] = String(patch[field] ?? '');
      });
      if (Object.prototype.hasOwnProperty.call(patch, 'title')) score.title = score.metadata.title || 'Untitled Score';
      if (Object.prototype.hasOwnProperty.call(patch, 'composer')) score.composer = score.metadata.composer || '';
      deps.model.touch(score);
    }
    const metadata = score.metadata || {};
    return Object.freeze(Object.fromEntries(PUBLICATION_FIELDS.map(field => [field, String(metadata[field] || '')])));
  }

  function satbRangeReport(score, options = {}) {
    const assignments = options.assignments || {
      soprano: score.parts[0]?.id,
      alto: score.parts[1]?.id,
      tenor: score.parts[2]?.id,
      bass: score.parts[3]?.id
    };
    const voices = Object.entries(assignments).map(([role, partId]) => {
      const part = score.parts.find(item => item.id === partId);
      const range = SATB_RANGES[role] || { low: 0, high: 127 };
      const notes = (part?.events || []).filter(event => event.type === 'note' && event.generatedBy !== 'gap-fill');
      const violations = notes.filter(event => event.midi < range.low || event.midi > range.high).map(event => Object.freeze({
        eventId: event.id,
        midi: event.midi,
        direction: event.midi < range.low ? 'low' : 'high',
        limit: event.midi < range.low ? range.low : range.high
      }));
      return Object.freeze({
        role,
        partId: part?.id || null,
        partName: part?.name || '',
        range: Object.freeze({ ...range }),
        noteCount: notes.length,
        violations: Object.freeze(violations),
        valid: Boolean(part) && violations.length === 0
      });
    });
    return Object.freeze({
      voices: Object.freeze(voices),
      valid: voices.every(item => item.valid),
      violationCount: voices.reduce((sum, item) => sum + item.violations.length, 0)
    });
  }

  function verifySynchronization(score) {
    const solfaIssues = deps.solfa.verifyScoreSolfa(score);
    const lyricRows = lyricVerseMatrix(score);
    const lyricIssues = [];
    lyricRows.forEach(row => row.lyrics.forEach(lyric => {
      if (/\d+$/.test(lyric.text) && lyric.text.endsWith(String(lyric.verse))) {
        lyricIssues.push(Object.freeze({
          severity: 'error',
          code: 'verse-number-in-text',
          eventId: row.eventId,
          verse: lyric.verse
        }));
      }
    }));
    return Object.freeze({
      valid: solfaIssues.length === 0 && lyricIssues.length === 0,
      solfaIssues: Object.freeze(solfaIssues.map(item => Object.freeze({ ...item }))),
      lyricIssues: Object.freeze(lyricIssues)
    });
  }

  return Object.freeze({
    VIEW_MODES,
    SATB_RANGES,
    PUBLICATION_FIELDS,
    normalizeViewMode,
    grammarModel,
    parsePassage,
    punctuationAudit,
    applyVoicePassage,
    lyricVerseMatrix,
    applyLyrics,
    publicationMetadata,
    satbRangeReport,
    verifySynchronization
  });
});
