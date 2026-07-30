(() => {
  'use strict';
  const safety=window.AirmonRhythmicSafety;
  if(!safety)throw new Error('Build 54 rhythmic safety service is unavailable.');
  const coalescer=new safety.ErrorCoalescer(2500);
  const host=document.createElement('section');
  host.id='rhythmicSafetyStatus';host.className='rhythmic-safety-status';host.hidden=true;
  host.setAttribute('aria-label','Rhythmic operation status');
  host.innerHTML=`<div id="rhythmicTargetPreview" role="status" aria-live="polite"></div><div id="rhythmicErrorNotice" role="alert" aria-live="assertive"></div><button type="button" data-safety-dismiss>Dismiss</button>`;
  document.querySelector('.app-shell')?.appendChild(host);

  function clearHighlights(){document.querySelectorAll('.rhythmic-target-highlight,.rhythmic-duplicate-highlight').forEach(node=>node.classList.remove('rhythmic-target-highlight','rhythmic-duplicate-highlight'));}
  function highlight(ids=[],duplicateId=null){
    clearHighlights();
    for(const id of ids){const node=document.querySelector(`[data-event-id="${CSS.escape(String(id))}"]`);if(node)node.classList.add(String(id)===String(duplicateId)?'rhythmic-duplicate-highlight':'rhythmic-target-highlight');}
  }
  function notify(error){
    const model=safety.notificationModel(error,coalescer);
    host.hidden=false;host.dataset.kind='error';
    host.querySelector('#rhythmicErrorNotice').textContent=model.message;
    host.querySelector('#rhythmicTargetPreview').textContent='';
    if(Array.isArray(error?.targets))highlight(error.targets,error.code==='DUPLICATE_CHORD_PITCH'?error.targets[0]:null);
    const old=document.querySelector('#errorBanner');if(old)old.hidden=true;
    return model;
  }
  function preview(kind,input={}){
    const composer=window.AirmonComposer3;if(!composer?.engine)return null;
    const proof=safety.targetPreview(kind,composer.engine.score,[...composer.engine.selection.selectedIds||[]],input);
    host.hidden=false;host.dataset.kind='preview';host.querySelector('#rhythmicErrorNotice').textContent='';
    host.querySelector('#rhythmicTargetPreview').textContent=`${proof.kind||kind}: ${proof.scope||proof.description||''}${proof.change?` — ${proof.change}`:''}`;
    highlight(proof.highlightIds||proof.targetIds||[],proof.duplicateId);
    return proof;
  }
  function clear(){host.hidden=true;host.dataset.kind='';host.querySelector('#rhythmicErrorNotice').textContent='';host.querySelector('#rhythmicTargetPreview').textContent='';clearHighlights();}
  host.querySelector('[data-safety-dismiss]').addEventListener('click',clear);

  let attempts=0;
  const attach=()=>{
    const composer=window.AirmonComposer3;
    if(composer?.engine){composer.engine.onError(error=>notify(error));return;}
    if(attempts++<200)setTimeout(attach,25);
  };
  attach();
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('#rhythmicSafetyStatus'))clearHighlights();});
  window.AirmonRhythmicSafetyUi=Object.freeze({notify,preview,clear,coalescer});
})();