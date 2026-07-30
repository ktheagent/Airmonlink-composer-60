(function (root, factory) {
  const model = root.AirmonScoreModel || (typeof require === 'function' ? require('./score-model') : null);
  const api = factory(model);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AirmonTemplateGallery = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (model) {
  'use strict';
  if (!model) throw new Error('Template gallery requires the canonical score model.');

  const definitions = [
    { id: 'piano', name: 'Piano', category: 'Keyboard', template: 'piano', instruments: ['piano'], preview: 'Grand staff for solo keyboard.' },
    { id: 'satb-two-staff', name: 'SATB Choir — Two Staff', category: 'Choir', template: 'custom', instruments: ['soprano','bass'], names: ['Soprano / Alto','Tenor / Bass'], clefs: ['treble','bass'], roles: ['upper-choir','lower-choir'], preview: 'Condensed choir score with four semantic voices across two staves.' },
    { id: 'satb-four-staff', name: 'SATB Choir — Four Staff', category: 'Choir', template: 'satb', preview: 'Independent Soprano, Alto, Tenor and Bass parts.' },
    { id: 'hymn-chorale', name: 'Hymn / Chorale', category: 'Choir', template: 'hymn', preview: 'Four-part hymn writing with lyrics and chord symbols.' },
    { id: 'lead-sheet', name: 'Lead Sheet', category: 'Popular', template: 'lead', preview: 'Melody, chord symbols and lyrics.' },
    { id: 'melody-lyrics', name: 'Melody with Lyrics', category: 'Voice', template: 'solo', preview: 'Single vocal melody with multiple lyric verses.' },
    { id: 'tonic-solfa', name: 'Tonic Sol-fa', category: 'Sol-fa', template: 'lead', showSolfa: true, staffView: 'solfa', preview: 'Movable-do Sol-fa score with rhythm and octave marks.' },
    { id: 'staff-solfa', name: 'Staff + Synchronized Sol-fa', category: 'Sol-fa', template: 'lead', showSolfa: true, staffView: 'split', preview: 'Linked staff and movable-do Sol-fa editing.' },
    { id: 'string-quartet', name: 'String Quartet', category: 'Ensemble', template: 'string-quartet', preview: 'Violin I, Violin II, Viola and Cello.' },
    { id: 'orchestra', name: 'Orchestra', category: 'Ensemble', template: 'orchestra', preview: 'Orchestral families with bracketed semantic parts.' },
    { id: 'concert-band', name: 'Concert Band', category: 'Band', template: 'concert-band', preview: 'Woodwinds, brass and percussion.' },
    { id: 'brass-band', name: 'Brass Band', category: 'Band', template: 'brass-band', preview: 'Cornets, horns, low brass and percussion.' },
    { id: 'guitar-tab', name: 'Guitar / Tablature', category: 'Guitar', template: 'custom', instruments: ['guitar'], tab: true, preview: 'Linked standard notation and six-string tablature.' },
    { id: 'percussion', name: 'Percussion', category: 'Percussion', template: 'custom', instruments: ['percussion'], preview: 'Unpitched percussion staff with drum-map metadata.' },
    { id: 'custom-ensemble', name: 'Custom Ensemble', category: 'Custom', template: 'custom', instruments: ['soprano','piano'], preview: 'User-defined instruments, staves, transposition and layout.' },
    { id: 'voice-piano', name: 'Voice and Piano', category: 'Voice', template: 'voice-piano', preview: 'Solo voice with grand-staff accompaniment.' },
    { id: 'worship-band', name: 'Worship Band', category: 'Band', template: 'worship-band', preview: 'Voice, keyboards, guitars, bass and drums.' },
    { id: 'african-percussion', name: 'African Percussion Ensemble', category: 'Percussion', template: 'african-percussion', preview: 'Master drum, supporting drum, bell and shaker.' }
  ].map(item => Object.freeze(item));

  const byId = new Map(definitions.map(item => [item.id, item]));
  const clone = value => JSON.parse(JSON.stringify(value));

  function catalogue() { return definitions.map(clone); }

  function search(query = '', options = {}) {
    const needle = String(query).trim().toLowerCase();
    const category = String(options.category || '').trim().toLowerCase();
    const favorites = new Set(options.favorites || []);
    const recents = Array.isArray(options.recents) ? options.recents : [];
    return definitions
      .filter(item => !category || item.category.toLowerCase() === category)
      .filter(item => !needle || [item.name, item.category, item.preview, item.id].join(' ').toLowerCase().includes(needle))
      .map(item => ({ ...clone(item), favorite: favorites.has(item.id), recentRank: recents.indexOf(item.id) }))
      .sort((a,b) => Number(b.favorite)-Number(a.favorite) || (a.recentRank < 0 ? 999 : a.recentRank) - (b.recentRank < 0 ? 999 : b.recentRank) || a.name.localeCompare(b.name));
  }

  function preview(templateId) {
    const item = byId.get(String(templateId));
    if (!item) throw new Error(`Unknown template: ${templateId}`);
    return {
      id: item.id, name: item.name, category: item.category, description: item.preview,
      instruments: item.instruments || null, semantic: true,
      capabilities: {
        lyrics: /Choir|Voice|Popular|Sol-fa/.test(item.category),
        solfa: Boolean(item.showSolfa),
        parts: !['lead-sheet','melody-lyrics','tonic-solfa','staff-solfa'].includes(item.id),
        tablature: Boolean(item.tab)
      }
    };
  }

  function validateSetup(input = {}) {
    const templateId = String(input.templateId || 'lead-sheet');
    const base = byId.get(templateId) || (input.userTemplate && input.userTemplate.id ? input.userTemplate : null);
    if (!base) throw new Error(`Unknown template: ${templateId}`);
    const setup = {
      templateId,
      title: String(input.title || 'Untitled Score').trim() || 'Untitled Score',
      subtitle: String(input.subtitle || ''),
      dedication: String(input.dedication || ''),
      composer: String(input.composer || ''),
      arranger: String(input.arranger || ''),
      lyricist: String(input.lyricist || ''),
      key: String(input.key || 'C'),
      timeSignature: String(input.timeSignature || '4/4'),
      tempo: Math.max(20, Math.min(400, Number(input.tempo) || 96)),
      pickupBeats: Math.max(0, Number(input.pickupBeats) || 0),
      measures: Math.max(1, Math.min(2000, Number(input.measures) || 8)),
      pageSize: ['A5','A4','A3','Letter','Legal'].includes(String(input.pageSize)) ? String(input.pageSize) : 'A4',
      orientation: String(input.orientation) === 'landscape' ? 'landscape' : 'portrait',
      staffSize: Math.max(60, Math.min(180, Number(input.staffSize) || 100)),
      margins: Math.max(5, Math.min(40, Number(input.margins) || 15)),
      instruments: Array.isArray(input.instruments) && input.instruments.length ? input.instruments.map(String) : (base.instruments || null),
      instrumentNames: Array.isArray(input.instrumentNames) ? input.instrumentNames.map(String) : (base.names || null),
      transpositions: Array.isArray(input.transpositions) ? input.transpositions.map(value => Number(value) || 0) : [],
      clefs: Array.isArray(input.clefs) ? input.clefs.map(String) : (base.clefs || []),
      showSolfa: input.showSolfa === true || base.showSolfa === true,
      staffView: String(input.staffView || base.staffView || 'staff'),
      tablature: input.tablature === true || base.tab === true
    };
    model.timeSignatureInfo(setup.timeSignature);
    const capacity = model.timeSignatureInfo(setup.timeSignature).measureQuarterBeats;
    if (setup.pickupBeats >= capacity) throw new Error('Pickup duration must be shorter than a full measure.');
    return { base, setup };
  }

  function createSemanticScore(input = {}) {
    const { base, setup } = validateSetup(input);
    const score = model.createScore({
      title: setup.title, subtitle: setup.subtitle, composer: setup.composer,
      template: base.template || 'custom', measures: setup.measures, key: setup.key,
      timeSignature: setup.timeSignature, tempo: setup.tempo, pickupBeats: setup.pickupBeats,
      pageSize: setup.pageSize, orientation: setup.orientation, staffSize: setup.staffSize,
      margins: setup.margins, showSolfa: setup.showSolfa,
      instrumentKeys: setup.instruments || undefined,
      instrumentNames: setup.instrumentNames || undefined,
      staffCount: setup.instruments?.length || undefined
    });
    Object.assign(score.metadata, {
      subtitle: setup.subtitle, dedication: setup.dedication, composer: setup.composer,
      arranger: setup.arranger, lyricist: setup.lyricist
    });
    Object.assign(score.settings, {
      templateId: setup.templateId, staffView: setup.staffView, showSolfa: setup.showSolfa,
      tablature: setup.tablature, pageSize: setup.pageSize, orientation: setup.orientation,
      staffSize: setup.staffSize, margins: setup.margins, pickupBeats: setup.pickupBeats,
      tempo: setup.tempo
    });
    score.parts.forEach((part,index) => {
      if (setup.instrumentNames?.[index]) part.name = setup.instrumentNames[index];
      if (setup.clefs?.[index]) part.clef = setup.clefs[index];
      if (setup.transpositions?.[index] != null) part.transpose = setup.transpositions[index];
      if (base.roles?.[index]) part.harmonyRole = base.roles[index];
      if (setup.tablature && index === 0) part.tablature = { strings: [64,59,55,50,45,40], linked: true };
    });
    score.templateProvenance = {
      id: setup.templateId, name: base.name, category: base.category,
      createdAt: new Date().toISOString(), semantic: true
    };
    return model.normalizeScore(score);
  }

  function createLibrary(value = {}) {
    const favorites = [...new Set((value.favorites || []).filter(id => byId.has(id)))];
    const recents = [...new Set((value.recents || []).filter(id => byId.has(id)))].slice(0, 12);
    const userTemplates = Array.isArray(value.userTemplates) ? value.userTemplates.map(item => ({
      id: String(item.id || `user-${Date.now()}`), name: String(item.name || 'User template'),
      category: 'User', setup: clone(item.setup || {}), preview: String(item.preview || 'Saved user ensemble')
    })) : [];
    return { favorites, recents, userTemplates };
  }
  function toggleFavorite(library, id) {
    const next = createLibrary(library); const key = String(id);
    if (!byId.has(key)) throw new Error(`Unknown template: ${key}`);
    next.favorites = next.favorites.includes(key) ? next.favorites.filter(item => item !== key) : [key, ...next.favorites];
    return next;
  }
  function recordRecent(library, id) {
    const next = createLibrary(library); const key = String(id);
    if (!byId.has(key) && !next.userTemplates.some(item => item.id === key)) throw new Error(`Unknown template: ${key}`);
    next.recents = [key, ...next.recents.filter(item => item !== key)].slice(0, 12);
    return next;
  }
  function saveUserTemplate(library, name, setup) {
    const next = createLibrary(library);
    const id = `user-${String(name || 'template').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || Date.now()}`;
    const record = { id, name: String(name || 'User template'), category: 'User', setup: validateSetup(setup).setup, preview: `Saved ensemble: ${String(name || 'User template')}` };
    next.userTemplates = [record, ...next.userTemplates.filter(item => item.id !== id)];
    return { library: next, template: clone(record) };
  }

  return Object.freeze({ catalogue, search, preview, validateSetup, createSemanticScore, createLibrary, toggleFavorite, recordRecent, saveUserTemplate });
});
