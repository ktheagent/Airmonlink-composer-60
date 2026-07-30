(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AirmonPalette = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const symbol = (id, label, kind, contexts, keywords = []) => Object.freeze({
    id, label, kind, contexts: Object.freeze(contexts), keywords: Object.freeze(keywords)
  });
  const SYMBOLS = Object.freeze([
    ...'CDEFGAB'.split('').map(letter => symbol(`pitch-${letter.toLowerCase()}`, letter, 'pitch', ['staff'], ['note', 'pitch'])),
    symbol('rest', 'Rest', 'rest', ['staff'], ['silence']),
    symbol('staccato', 'Staccato', 'articulation', ['note'], ['dot', 'short']),
    symbol('accent', 'Accent', 'articulation', ['note'], ['emphasis']),
    symbol('tenuto', 'Tenuto', 'articulation', ['note'], ['sustain']),
    symbol('fermata', 'Fermata', 'fermata', ['note'], ['hold']),
    symbol('tie', 'Tie', 'tie', ['note-selection'], ['connect']),
    symbol('slur', 'Slur', 'slur', ['note-selection'], ['phrase']),
    symbol('beam', 'Beam', 'beam', ['note-selection'], ['rhythm'])
  ]);
  const BY_ID = Object.freeze(Object.fromEntries(SYMBOLS.map(item => [item.id, item])));

  function normalizeState(value = {}) {
    return Object.freeze({
      query: String(value.query || ''),
      favorites: Object.freeze([...new Set((value.favorites || []).filter(id => BY_ID[id]))]),
      recent: Object.freeze([...new Set((value.recent || []).filter(id => BY_ID[id]))].slice(0, 12))
    });
  }

  function updateState(value, action = {}) {
    const state = normalizeState(value);
    const next = { query: state.query, favorites: [...state.favorites], recent: [...state.recent] };
    if (action.type === 'search') next.query = String(action.query || '');
    if (action.type === 'favorite' && BY_ID[action.symbolId]) {
      next.favorites = next.favorites.includes(action.symbolId)
        ? next.favorites.filter(id => id !== action.symbolId)
        : [...next.favorites, action.symbolId];
    }
    if (action.type === 'used' && BY_ID[action.symbolId]) {
      next.recent = [action.symbolId, ...next.recent.filter(id => id !== action.symbolId)].slice(0, 12);
    }
    return normalizeState(next);
  }

  function contextFor(entries = [], hasStaffTarget = false) {
    const notes = entries.filter(({ event }) => event.type === 'note');
    return Object.freeze({
      staff: Boolean(hasStaffTarget),
      note: notes.length === 1,
      noteSelection: notes.length >= 2,
      selectedCount: entries.length
    });
  }

  function availability(itemOrId, context = {}) {
    const item = typeof itemOrId === 'string' ? BY_ID[itemOrId] : itemOrId;
    if (!item) return Object.freeze({ enabled: false, reason: 'Unknown palette symbol.' });
    const enabled = item.contexts.some(required =>
      required === 'staff' ? context.staff :
        required === 'note' ? context.note :
          required === 'note-selection' ? context.noteSelection : false
    );
    return Object.freeze({
      enabled: Boolean(enabled),
      reason: enabled ? '' : item.contexts.includes('staff')
        ? 'Drop on a staff position.'
        : item.contexts.includes('note-selection')
          ? 'Select at least two notes.'
          : 'Select one note.'
    });
  }

  function search(stateValue, context = {}) {
    const state = normalizeState(stateValue);
    const query = state.query.trim().toLowerCase();
    return Object.freeze(SYMBOLS
      .map(item => {
        const haystack = [item.label, item.kind, ...item.keywords].join(' ').toLowerCase();
        const score = (state.favorites.includes(item.id) ? 4 : 0) + (state.recent.includes(item.id) ? 2 : 0) +
          (query && item.label.toLowerCase().startsWith(query) ? 8 : query && haystack.includes(query) ? 3 : 0);
        return Object.freeze({ ...item, ...availability(item, context), favorite: state.favorites.includes(item.id), score });
      })
      .filter(item => !query || [item.label, item.kind, ...item.keywords].join(' ').toLowerCase().includes(query))
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)));
  }

  function dragPayload(symbolId) {
    if (!BY_ID[symbolId]) throw new Error('Unknown palette symbol.');
    return JSON.stringify({ type: 'airmonlink-palette-symbol', symbolId });
  }

  function parseDragPayload(text) {
    let value;
    try { value = JSON.parse(String(text || '')); } catch (_) { return null; }
    return value?.type === 'airmonlink-palette-symbol' && BY_ID[value.symbolId] ? Object.freeze({ symbolId: value.symbolId }) : null;
  }

  return Object.freeze({ SYMBOLS, BY_ID, normalizeState, updateState, contextFor, availability, search, dragPayload, parseDragPayload });
});
