(() => {
  'use strict';
  const api=window.AirmonStaffSolfaLyrics;
  if(!api)throw new Error('Build 57 Staff/Sol-fa/lyrics service is unavailable.');
  let mode='staff';
  function composer(){return window.AirmonComposer3;}
  function install(){
    const host=document.querySelector('#panel-notation .groups')||document.querySelector('#panel-notation');
    if(!host||document.querySelector('#staffSolfaSyncControls'))return;
    const group=document.createElement('div');group.id='staffSolfaSyncControls';group.className='group staff-solfa-sync-controls';group.dataset.group='STAFF AND SOL-FA SYNCHRONIZATION';
    group.innerHTML=`<span>Staff / Tonic Sol-fa</span><div role="group" aria-label="Synchronized notation view">${api.VIEW_MODES.map(value=>`<button type="button" data-sync-view="${value}" aria-pressed="${value==='staff'}">${value==='staff'?'Staff only':value==='solfa'?'Sol-fa only':'Split synchronized'}</button>`).join('')}</div><output id="staffSolfaSyncStatus" aria-live="polite">Shared semantic score</output>`;
    host.appendChild(group);
    group.addEventListener('click',event=>{const value=event.target.dataset.syncView;if(value)setMode(value);});
  }
  function setMode(value){
    mode=api.viewMode(value);document.body.dataset.staffSolfaView=mode;
    document.querySelectorAll('[data-sync-view]').forEach(node=>node.setAttribute('aria-pressed',String(node.dataset.syncView===mode)));
    if(mode==='staff')composer()?.command('showStaff');
    else if(mode==='solfa')composer()?.command('showSolfa');
    else{
      document.querySelector('#staffPage')?.removeAttribute('hidden');
      document.querySelector('#solfaPage')?.removeAttribute('hidden');
      document.querySelector('#scoreArea')?.classList.add('synchronized-split-view');
    }
    if(mode!=='split')document.querySelector('#scoreArea')?.classList.remove('synchronized-split-view');
    const report=composer()?.engine?api.synchronization(composer().engine.score,{viewMode:mode}):null;
    const status=document.querySelector('#staffSolfaSyncStatus');if(status)status.textContent=report?.valid?'Staff, Sol-fa and lyrics synchronized':'Synchronization needs review';
  }
  window.addEventListener('load',()=>{install();const wait=()=>window.AirmonComposer3?.engine?(window.AirmonComposer3.engine.onChange(()=>setMode(mode)),setMode(mode)):setTimeout(wait,20);wait();},{once:true});
  window.AirmonStaffSolfaController=Object.freeze({mode:()=>mode,setMode,report:()=>api.synchronization(composer().engine.score,{viewMode:mode}),editSolfa:(id,text,options)=>api.editSolfa(composer().engine,id,text,options),editStaffPitch:(id,midi)=>api.editStaffPitch(composer().engine,id,midi),applyLyrics:(ids,verses)=>api.applyLyricVerses(composer().engine,ids,verses)});
})();