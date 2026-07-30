(() => {
  'use strict';
  const gallery = window.AirmonTemplateGallery;
  if (!gallery) throw new Error('Build 52 template gallery service is unavailable.');
  const storageKey = 'airmonlink.composer.templateLibrary.v2';
  let library;
  try { library = gallery.createLibrary(JSON.parse(localStorage.getItem(storageKey) || '{}')); }
  catch (_) { library = gallery.createLibrary(); }

  const dialog = document.createElement('dialog');
  dialog.id = 'newScoreWizard';
  dialog.className = 'new-score-wizard';
  dialog.setAttribute('aria-labelledby', 'newScoreWizardTitle');
  dialog.innerHTML = `
    <form method="dialog" class="new-score-wizard-shell">
      <header><div><h2 id="newScoreWizardTitle">New Score</h2><p>Create a complete semantic score from a professional template.</p></div><button value="cancel" aria-label="Close New Score wizard">×</button></header>
      <div class="new-score-wizard-body">
        <section class="template-browser" aria-label="Template gallery">
          <label>Search templates<input id="templateGallerySearch" type="search" autocomplete="off" placeholder="Choir, piano, Sol-fa, band…"></label>
          <div class="template-filter-row"><button type="button" data-template-filter="">All</button><button type="button" data-template-filter="favorites">Favourites</button><button type="button" data-template-filter="recent">Recent</button><button type="button" data-template-filter="User">My templates</button></div>
          <div id="templateGalleryGrid" class="template-gallery-grid" role="listbox" aria-label="Available score templates"></div>
        </section>
        <section class="template-setup" aria-label="Score setup">
          <div id="templatePreview" class="template-preview" role="status" aria-live="polite"></div>
          <div class="wizard-field-grid">
            <label>Title<input id="wizardTitle" value="Untitled Score" required></label>
            <label>Subtitle<input id="wizardSubtitle"></label>
            <label>Composer<input id="wizardComposer"></label>
            <label>Arranger<input id="wizardArranger"></label>
            <label>Lyricist<input id="wizardLyricist"></label>
            <label>Dedication<input id="wizardDedication"></label>
            <label>Key<select id="wizardKey">${['C','G','D','A','E','B','F#','C#','F','Bb','Eb','Ab','Db','Gb','Cb','Am','Em','Bm','F#m','C#m','G#m','Dm','Gm','Cm','Fm'].map(v=>`<option>${v}</option>`).join('')}</select></label>
            <label>Meter<input id="wizardMeter" value="4/4" pattern="\\d{1,2}/\\d{1,2}" required></label>
            <label>Tempo<input id="wizardTempo" type="number" min="20" max="400" value="96"></label>
            <label>Pickup beats<input id="wizardPickup" type="number" min="0" max="16" step="0.25" value="0"></label>
            <label>Measures<input id="wizardMeasures" type="number" min="1" max="2000" value="8"></label>
            <label>Page size<select id="wizardPageSize"><option>A4</option><option>A3</option><option>A5</option><option>Letter</option><option>Legal</option></select></label>
            <label>Orientation<select id="wizardOrientation"><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
            <label>Staff size<input id="wizardStaffSize" type="number" min="60" max="180" value="100"></label>
            <label>Instruments (comma separated)<input id="wizardInstruments" placeholder="soprano, alto, tenor, bass"></label>
            <label>Transpositions (semitones)<input id="wizardTranspositions" placeholder="0, 0, 0, 0"></label>
          </div>
          <div class="wizard-actions">
            <button type="button" id="wizardFavorite">☆ Favourite</button>
            <button type="button" id="wizardSaveTemplate">Save as user template</button>
            <button type="button" id="wizardCreateScore" class="primary">Create semantic score</button>
          </div>
          <div id="wizardStatus" role="status" aria-live="polite"></div>
        </section>
      </div>
    </form>`;
  document.body.appendChild(dialog);

  const $ = selector => dialog.querySelector(selector);
  let selectedId = 'lead-sheet';
  let filter = '';

  function persist() { localStorage.setItem(storageKey, JSON.stringify(library)); }
  function allTemplates() {
    return [...gallery.catalogue(), ...library.userTemplates.map(item => ({ id:item.id, name:item.name, category:'User', preview:item.preview, user:true }))];
  }
  function matchingTemplates() {
    const query = $('#templateGallerySearch').value.trim().toLowerCase();
    let items = allTemplates().filter(item => !query || [item.name,item.category,item.preview,item.id].join(' ').toLowerCase().includes(query));
    if (filter === 'favorites') items = items.filter(item => library.favorites.includes(item.id));
    else if (filter === 'recent') items = items.filter(item => library.recents.includes(item.id)).sort((a,b)=>library.recents.indexOf(a.id)-library.recents.indexOf(b.id));
    else if (filter) items = items.filter(item => item.category === filter);
    return items;
  }
  function render() {
    const grid = $('#templateGalleryGrid'); grid.textContent = '';
    for (const item of matchingTemplates()) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.templateId = item.id;
      button.setAttribute('role','option'); button.setAttribute('aria-selected',String(item.id===selectedId));
      button.className = item.id === selectedId ? 'selected' : '';
      button.innerHTML = `<strong>${item.name}</strong><span>${item.category}</span><small>${item.preview}</small><b aria-label="${library.favorites.includes(item.id)?'Favourite':''}">${library.favorites.includes(item.id)?'★':''}</b>`;
      grid.appendChild(button);
    }
    const item = allTemplates().find(entry => entry.id === selectedId) || allTemplates()[0];
    if (!item) return;
    const proof = item.user ? { name:item.name, category:'User', description:item.preview, semantic:true, capabilities:{} } : gallery.preview(item.id);
    $('#templatePreview').innerHTML = `<strong>${proof.name}</strong><p>${proof.description}</p><small>${proof.semantic?'Semantic score template':'Unavailable'}</small>`;
    $('#wizardFavorite').textContent = `${library.favorites.includes(item.id)?'★':'☆'} Favourite`;
    if (!item.user && item.instruments) $('#wizardInstruments').value = item.instruments.join(', ');
  }
  function selectedSetup() {
    const item = allTemplates().find(entry => entry.id === selectedId);
    const userSetup = item?.user ? item.setup : null;
    return {
      ...(userSetup || {}),
      templateId: item?.user ? (userSetup?.templateId || 'custom-ensemble') : selectedId,
      title: $('#wizardTitle').value, subtitle: $('#wizardSubtitle').value,
      composer: $('#wizardComposer').value, arranger: $('#wizardArranger').value,
      lyricist: $('#wizardLyricist').value, dedication: $('#wizardDedication').value,
      key: $('#wizardKey').value, timeSignature: $('#wizardMeter').value,
      tempo: $('#wizardTempo').value, pickupBeats: $('#wizardPickup').value,
      measures: $('#wizardMeasures').value, pageSize: $('#wizardPageSize').value,
      orientation: $('#wizardOrientation').value, staffSize: $('#wizardStaffSize').value,
      instruments: $('#wizardInstruments').value.split(',').map(v=>v.trim()).filter(Boolean),
      transpositions: $('#wizardTranspositions').value.split(',').map(v=>Number(v.trim())||0)
    };
  }
  function open(templateId='lead-sheet') {
    selectedId = allTemplates().some(item=>item.id===templateId) ? templateId : 'lead-sheet';
    filter = ''; $('#templateGallerySearch').value=''; render();
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open','');
    $('#templateGallerySearch').focus();
  }

  dialog.addEventListener('click', event => {
    const template = event.target.closest('[data-template-id]');
    if (template) { selectedId=template.dataset.templateId; render(); return; }
    const filterButton = event.target.closest('[data-template-filter]');
    if (filterButton) { filter=filterButton.dataset.templateFilter; render(); return; }
  });
  $('#templateGallerySearch').addEventListener('input', render);
  $('#wizardFavorite').addEventListener('click', () => {
    if (!library.userTemplates.some(item=>item.id===selectedId)) library=gallery.toggleFavorite(library,selectedId);
    persist(); render();
  });
  $('#wizardSaveTemplate').addEventListener('click', () => {
    try {
      const name = `${$('#wizardTitle').value || 'Untitled'} ensemble`;
      const saved = gallery.saveUserTemplate(library,name,selectedSetup());
      library=saved.library; selectedId=saved.template.id; persist(); render();
      $('#wizardStatus').textContent=`Saved user template “${saved.template.name}”.`;
    } catch(error) { $('#wizardStatus').textContent=error.message; }
  });
  $('#wizardCreateScore').addEventListener('click', () => {
    try {
      const item=library.userTemplates.find(entry=>entry.id===selectedId);
      const score=gallery.createSemanticScore(item ? {...item.setup,...selectedSetup()} : selectedSetup());
      const composer=window.AirmonComposer3;
      if (!composer?.engine) throw new Error('Composer engine is not ready.');
      composer.engine.replaceScore(score,'Create score from professional template',{dirty:false,filePath:null});
      const recentId=item ? (item.setup.templateId || 'custom-ensemble') : selectedId;
      library=gallery.recordRecent(library,recentId); persist();
      dialog.close(); composer.command('fitPage');
    } catch(error) { $('#wizardStatus').textContent=error.message; }
  });
  document.addEventListener('click', event => {
    const command=event.target.closest('[data-command="newScore"]');
    if (command) { event.preventDefault(); event.stopImmediatePropagation(); open(); return; }
    const starter=event.target.closest('[data-start-template]');
    if (starter) { event.preventDefault(); event.stopImmediatePropagation(); open(starter.dataset.startTemplate==='lead'?'lead-sheet':starter.dataset.startTemplate); }
  }, true);
  window.AirmonNewScoreWizard=Object.freeze({open, library:()=>JSON.parse(JSON.stringify(library)), selectedSetup});
  render();
})();