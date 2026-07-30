'use strict';

(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AirmonPageFlow = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createPageFlowModule() {
  const DEFAULT_MANUAL_HOLD_MS = 1800;

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function uniqueStrings(values) {
    const output = [];
    const seen = new Set();
    for (const value of values || []) {
      const text = String(value ?? '');
      if (!text || seen.has(text)) continue;
      seen.add(text);
      output.push(text);
    }
    return output;
  }

  function normalizePageRanges(ranges = []) {
    const normalized = (Array.isArray(ranges) ? ranges : []).map((range, index) => {
      const startBeat = Math.max(0, finite(range?.startBeat, 0));
      const endBeat = Math.max(startBeat, finite(range?.endBeat, startBeat));
      const firstMeasure = Math.max(0, Math.floor(finite(range?.firstMeasure, 0)));
      const lastMeasure = Math.max(firstMeasure + 1, Math.ceil(finite(range?.lastMeasure, firstMeasure + 1)));
      return Object.freeze({
        pageIndex: index,
        startBeat,
        endBeat,
        firstMeasure,
        lastMeasure,
        eventIds: Object.freeze(uniqueStrings(range?.eventIds))
      });
    });
    return Object.freeze(normalized);
  }

  function createPageRanges({ pages = [], measureBounds, events = [] } = {}) {
    if (typeof measureBounds !== 'function') throw new TypeError('measureBounds must be a function.');
    const safeEvents = Array.isArray(events) ? events : [];
    const ranges = (Array.isArray(pages) ? pages : []).map((page, index) => {
      let indices = Array.isArray(page?.measureIndices)
        ? page.measureIndices.map(value => Math.max(0, Math.floor(finite(value, 0))))
        : [];
      if (!indices.length) {
        const first = Math.max(0, Math.floor(finite(page?.firstMeasure, index)));
        const last = Math.max(first + 1, Math.ceil(finite(page?.lastMeasure, first + 1)));
        indices = Array.from({ length: last - first }, (_, offset) => first + offset);
      }
      indices = [...new Set(indices)].sort((a, b) => a - b);
      const firstMeasure = indices[0] ?? 0;
      const lastMeasure = (indices[indices.length - 1] ?? firstMeasure) + 1;
      const firstBounds = measureBounds(firstMeasure) || { start: 0, end: 0 };
      const lastBounds = measureBounds(lastMeasure - 1) || firstBounds;
      const startBeat = Math.max(0, finite(firstBounds.start, 0));
      const endBeat = Math.max(startBeat, finite(lastBounds.end, startBeat));
      const eventIds = safeEvents
        .filter(event => {
          const start = finite(event?.start, -1);
          return start >= startBeat - 1e-8 && start < endBeat - 1e-8;
        })
        .map(event => event.id);
      return { pageIndex: index, startBeat, endBeat, firstMeasure, lastMeasure, eventIds };
    });
    return normalizePageRanges(ranges);
  }

  function pageForBeat(ranges, beat, fallback = 0) {
    const pages = normalizePageRanges(ranges);
    if (!pages.length) return 0;
    const value = Math.max(0, finite(beat, 0));
    const exact = pages.find(page => value >= page.startBeat - 1e-8 && value < page.endBeat - 1e-8);
    if (exact) return exact.pageIndex;
    if (value >= pages[pages.length - 1].endBeat - 1e-8) return pages.length - 1;
    let best = clamp(Math.floor(finite(fallback, 0)), 0, pages.length - 1);
    let distance = Infinity;
    for (const page of pages) {
      const current = value < page.startBeat ? page.startBeat - value : value - page.endBeat;
      if (current < distance) {
        distance = current;
        best = page.pageIndex;
      }
    }
    return best;
  }

  function pageForEvent(ranges, eventId, fallback = 0) {
    const pages = normalizePageRanges(ranges);
    const id = String(eventId ?? '');
    if (!id) return clamp(Math.floor(finite(fallback, 0)), 0, Math.max(0, pages.length - 1));
    const match = pages.find(page => page.eventIds.includes(id));
    return match ? match.pageIndex : clamp(Math.floor(finite(fallback, 0)), 0, Math.max(0, pages.length - 1));
  }

  function pageForSelection(ranges, eventIds, currentPage = 0, anchorId = null) {
    const pages = normalizePageRanges(ranges);
    if (!pages.length) return 0;
    const selected = uniqueStrings(eventIds);
    if (!selected.length) return clamp(Math.floor(finite(currentPage, 0)), 0, pages.length - 1);
    if (anchorId && selected.includes(String(anchorId))) return pageForEvent(pages, anchorId, currentPage);
    const current = clamp(Math.floor(finite(currentPage, 0)), 0, pages.length - 1);
    if (pages[current].eventIds.some(id => selected.includes(id))) return current;
    for (const id of selected) {
      const page = pages.find(item => item.eventIds.includes(id));
      if (page) return page.pageIndex;
    }
    return current;
  }

  function preserveSelection(eventIds, availableEventIds) {
    const available = new Set(uniqueStrings(availableEventIds));
    return Object.freeze(uniqueStrings(eventIds).filter(id => available.has(id)));
  }

  function navigationTarget(currentPage, totalPages, direction) {
    const total = Math.max(1, Math.floor(finite(totalPages, 1)));
    const current = clamp(Math.floor(finite(currentPage, 0)), 0, total - 1);
    if (direction === 'first') return 0;
    if (direction === 'last') return total - 1;
    if (direction === 'previous' || finite(direction, 0) < 0) return Math.max(0, current - 1);
    if (direction === 'next' || finite(direction, 0) > 0) return Math.min(total - 1, current + 1);
    return current;
  }

  function followDecision({
    playing = false,
    currentPage = 0,
    targetPage = 0,
    manualHoldUntil = 0,
    now = Date.now(),
    enabled = true
  } = {}) {
    const current = Math.max(0, Math.floor(finite(currentPage, 0)));
    const target = Math.max(0, Math.floor(finite(targetPage, current)));
    if (!enabled || !playing) return Object.freeze({ follow: false, reason: 'inactive', targetPage: target });
    if (target === current) return Object.freeze({ follow: false, reason: 'already-visible', targetPage: target });
    if (finite(now, 0) < finite(manualHoldUntil, 0)) {
      return Object.freeze({ follow: false, reason: 'manual-hold', targetPage: target });
    }
    return Object.freeze({ follow: true, reason: 'page-change', targetPage: target });
  }

  function manualHoldUntil(now = Date.now(), duration = DEFAULT_MANUAL_HOLD_MS) {
    return finite(now, Date.now()) + Math.max(0, finite(duration, DEFAULT_MANUAL_HOLD_MS));
  }

  function publicationProfile({
    view = 'staff',
    pageSize = 'A4',
    orientation = 'portrait',
    margins = 15,
    ranges = []
  } = {}) {
    const pages = normalizePageRanges(ranges);
    const profile = {
      view: view === 'solfa' ? 'solfa' : 'staff',
      pageSize: String(pageSize || 'A4'),
      orientation: orientation === 'landscape' ? 'landscape' : 'portrait',
      margins: Math.max(0, finite(margins, 15)),
      pageCount: Math.max(1, pages.length),
      measureRanges: pages.map(page => [page.firstMeasure, page.lastMeasure])
    };
    profile.signature = [
      profile.view,
      profile.pageSize,
      profile.orientation,
      profile.margins,
      profile.pageCount,
      profile.measureRanges.map(range => range.join('-')).join(',')
    ].join('|');
    return Object.freeze({ ...profile, measureRanges: Object.freeze(profile.measureRanges.map(range => Object.freeze(range))) });
  }

  function comparePublicationProfiles(reference, candidate) {
    const fields = ['view', 'pageSize', 'orientation', 'margins', 'pageCount'];
    const differences = [];
    for (const field of fields) {
      if (reference?.[field] !== candidate?.[field]) {
        differences.push(Object.freeze({ field, expected: reference?.[field], actual: candidate?.[field] }));
      }
    }
    const expectedRanges = JSON.stringify(reference?.measureRanges || []);
    const actualRanges = JSON.stringify(candidate?.measureRanges || []);
    if (expectedRanges !== actualRanges) {
      differences.push(Object.freeze({ field: 'measureRanges', expected: reference?.measureRanges || [], actual: candidate?.measureRanges || [] }));
    }
    return Object.freeze({ equal: differences.length === 0, differences: Object.freeze(differences) });
  }

  return Object.freeze({
    DEFAULT_MANUAL_HOLD_MS,
    normalizePageRanges,
    createPageRanges,
    pageForBeat,
    pageForEvent,
    pageForSelection,
    preserveSelection,
    navigationTarget,
    followDecision,
    manualHoldUntil,
    publicationProfile,
    comparePublicationProfiles
  });
});
