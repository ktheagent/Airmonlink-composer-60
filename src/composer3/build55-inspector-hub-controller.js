(() => {
  'use strict';
  const api = window.AirmonProfessionalInspectorHub;
  if (!api) throw new Error('Build 55 professional inspector/hub service is unavailable.');

  const preferenceKey = 'airmonlink.composer.voiceAppearance.v1';
  const paletteKey = 'airmonlink.composer.customPalettes.v1';
  let preferences;
  let paletteLibrary;
  try { preferences = api.voicePreferences(JSON.parse(localStorage.getItem(preferenceKey) || '{}')); }
  catch (_) { preferences = api.voicePreferences(); }
  try { paletteLibrary = api.paletteLibrary(JSON.parse(localStorage.getItem(paletteKey) || '{}')); }
  catch (_) { paletteLibrary = api.paletteLibrary(); }

  function composer() {
    const instance = window.AirmonComposer3;
    if (!instance?.engine) throw new Error('Composer engine is not ready.');
    return instance;
  }
  function persist() {
    localStorage.setItem(preferenceKey, JSON.stringify(preferences));
    localStorage.setItem(paletteKey, JSON.stringify(paletteLibrary));
  }
  function activeVoice() {
    try { return Math.max(1, Math.min(4, Number(composer().engine.activeVoice) || 1)); }
    catch (_) { return 1; }
  }
  function applyVoiceUi() {
    const root = document.documentElement;
    for (let voice=1; voice<=4; voice+=1) root.style.setProperty(`--voice-${voice}`, preferences.colors[voice]);
    root.style.setProperty('--inactive-voice-opacity', String(preferences.inactiveOpacity));
    root.style.setProperty('--voice-halo-opacity', String(preferences.haloOpacity));
    document.body.dataset.activeVoice = String(activeVoice());
    document.body.classList.toggle('export-editing-colors', preferences.exportEditingColors);
    document.querySelectorAll('[data-voice]').forEach(node => {
      const appearance = api.voiceAppearance(preferences, node.dataset.voice, activeVoice());
      node.style.setProperty('--event-voice-color', appearance.color);
      node.dataset.voiceLabel = appearance.label;
      node.setAttribute('aria-label', `${appearance.label}, ${appearance.active ? 'active' : 'inactive'} voice`);
    });
  }
  function installVoiceControls() {
    const inspector = document.querySelector('.inspector');
    if (!inspector || inspector.querySelector('#voiceAppearanceCard')) return;
    const card = document.createElement('section');
    card.id = 'voiceAppearanceCard';
    card.className = 'inspector-card voice-appearance-card';
    card.setAttribute('aria-labelledby','voiceAppearanceTitle');
    card.innerHTML = `<strong id="voiceAppearanceTitle">Voice appearance</strong>
      <div class="voice-colour-grid">${[1,2,3,4].map(voice=>`<label>V${voice}<input type="color" data-voice-colour="${voice}" value="${preferences.colors[voice]}" aria-label="Voice ${voice} editing colour"></label>`).join('')}</div>
      <label>Inactive voice visibility <input id="inactiveVoiceOpacity" type="range" min="0.58" max="0.88" step="0.01" value="${preferences.inactiveOpacity}"></label>
      <label><input id="exportEditingColors" type="checkbox"${preferences.exportEditingColors?' checked':''}> Export editing colours</label>
      <button type="button" id="restoreVoiceColors">Restore default colours</button>`;
    inspector.appendChild(card);
    card.addEventListener('input', event => {
      const voice = event.target.dataset.voiceColour;
      if (voice) preferences = api.setVoiceColor(preferences, voice, event.target.value);
      else if (event.target.id === 'inactiveVoiceOpacity') preferences = api.voicePreferences({...preferences,inactiveOpacity:Number(event.target.value)});
      else if (event.target.id === 'exportEditingColors') preferences = api.voicePreferences({...preferences,exportEditingColors:event.target.checked});
      persist(); applyVoiceUi();
    });
    card.querySelector('#restoreVoiceColors').addEventListener('click', () => {
      preferences = api.resetVoiceColors(preferences);
      card.querySelectorAll('[data-voice-colour]').forEach(input => { input.value=preferences.colors[input.dataset.voiceColour]; });
      persist(); applyVoiceUi();
    });
  }
  function installPaletteControls() {
    const search = document.querySelector('#symbolPaletteSearch');
    const results = document.querySelector('#symbolPaletteResults');
    if (!search || !results || document.querySelector('#customPaletteCard')) return;
    const card = document.createElement('section');
    card.id='customPaletteCard'; card.className='custom-palette-card';
    card.innerHTML=`<strong>Custom palette</strong><div class="custom-palette-actions"><input id="customPaletteName" placeholder="Palette name" aria-label="Custom palette name"><button type="button" id="saveCustomPalette">Save current symbols</button></div><div id="customPaletteList" aria-live="polite"></div>`;
    results.parentElement.appendChild(card);
    const render = () => {
      card.querySelector('#customPaletteList').textContent = paletteLibrary.custom.length
        ? paletteLibrary.custom.map(item=>`${item.name} (${item.symbolIds.length})`).join(' · ')
        : 'No custom palettes yet.';
    };
    card.querySelector('#saveCustomPalette').addEventListener('click', () => {
      const symbols = [...results.querySelectorAll('[data-symbol-id]')].map(node=>node.dataset.symbolId).filter(Boolean);
      try {
        paletteLibrary=api.saveCustomPalette(paletteLibrary,card.querySelector('#customPaletteName').value,symbols);
        persist(); render();
      } catch(error) { card.querySelector('#customPaletteList').textContent=error.message; }
    });
    render();
  }
  function updateInspector() {
    let instance;
    try { instance=composer(); } catch (_) { return; }
    document.body.dataset.activeVoice=String(activeVoice());
    const ids=(instance.engine.state?.().selection||instance.engine.selection?.ids||instance.engine.selectedIds||[]).map?.(String)||[];
    const model=api.inspectorModel(instance.engine.score,ids);
    const fieldset=document.querySelector('#objectInspector');
    if (fieldset) {
      fieldset.dataset.selectionType=model.type;
      fieldset.disabled=model.count===0;
      let status=fieldset.querySelector('.contextual-inspector-status');
      if(!status){status=document.createElement('span');status.className='contextual-inspector-status';fieldset.prepend(status);}
      status.textContent=model.count?`${model.count} ${model.type} object${model.count===1?'':'s'} selected${model.mixed?' · mixed values':''}`:'Select a score object to inspect.';
      fieldset.querySelectorAll('[data-inspector-field]').forEach(control=>{
        const key=control.dataset.inspectorField;
        const descriptor=model.controls[key]||model.controls[key==='velocity'?'playback':key]||null;
        const label=control.closest('label');
        if(label) label.hidden=descriptor ? !descriptor.visible : false;
        control.disabled=descriptor ? !descriptor.enabled : fieldset.disabled;
        control.dataset.mixed=String(Boolean(descriptor?.kind==='mixed'));
        if(descriptor?.kind==='mixed') control.setAttribute('aria-label',`${key}, mixed values`);
      });
    }
  }
  function auditVisibleCommands() {
    const ids=[...document.querySelectorAll('[data-command]')].filter(node=>!node.hidden&&!node.disabled).map(node=>node.dataset.command);
    const audit=api.enabledControlAudit(ids);
    document.documentElement.dataset.build55CommandAudit=audit.pass?'pass':'fail';
    return audit;
  }
  window.addEventListener('load',()=>{
    installVoiceControls();installPaletteControls();applyVoiceUi();
    const wait=()=>{if(window.AirmonComposer3?.engine){window.AirmonComposer3.engine.onChange(()=>{applyVoiceUi();updateInspector();});updateInspector();auditVisibleCommands();}else setTimeout(wait,20);};wait();
  },{once:true});
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-input-control="voice"]')) requestAnimationFrame(()=>{applyVoiceUi();updateInspector();});
  });
  window.AirmonInspectorHubController=Object.freeze({
    preferences:()=>JSON.parse(JSON.stringify(preferences)),
    paletteLibrary:()=>JSON.parse(JSON.stringify(paletteLibrary)),
    applyInspector(patch){return api.applyInspector(composer().engine,patch);},
    inspector:()=>api.inspectorModel(composer().engine.score,(composer().engine.state().selection||[])),
    hubCategories:context=>api.hubCategories(context),
    auditVisibleCommands
  });
})();