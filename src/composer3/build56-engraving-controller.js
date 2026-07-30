(() => {
  'use strict';
  const api=window.AirmonProfessionalEngraving;
  if(!api)throw new Error('Build 56 professional engraving service is unavailable.');
  let lastPoint='';let cycle=0;
  function composer(){return window.AirmonComposer3;}
  function candidate(node){
    const box=node.getBoundingClientRect();
    return{eventId:node.dataset.eventId,voice:Number(node.dataset.eventVoice)||1,x:box.left+box.width/2,y:box.top+box.height/2,node};
  }
  document.addEventListener('click',event=>{
    const score=event.target.closest('#scoreArea');
    if(!score)return;
    const nodes=[...document.elementsFromPoint(event.clientX,event.clientY)].filter(node=>node.matches?.('.note-event,.rest-event'));
    if(nodes.length<2)return;
    const pointKey=`${Math.round(event.clientX/4)}:${Math.round(event.clientY/4)}`;
    cycle=pointKey===lastPoint?cycle+1:0;lastPoint=pointKey;
    const hit=api.hitTest(nodes.map(candidate),{x:event.clientX,y:event.clientY},cycle,24);
    if(!hit)return;
    event.preventDefault();event.stopImmediatePropagation();
    composer()?.engine?.selectEvent(hit.eventId,{additive:event.ctrlKey||event.metaKey});
    hit.node.focus({preventScroll:true});
    document.querySelector('#status').textContent=`Selected voice ${hit.voice} object ${cycle%hit.candidateCount+1} of ${hit.candidateCount}`;
  },true);
  window.addEventListener('beforeprint',()=>{
    document.body.classList.add('professional-print-projection');
    document.querySelectorAll('.editing-handle,.selection-handle,.voice-selection-halo').forEach(node=>node.setAttribute('aria-hidden','true'));
  });
  window.addEventListener('afterprint',()=>document.body.classList.remove('professional-print-projection'));
  window.AirmonEngravingController=Object.freeze({hitTest:api.hitTest,pageLayout:api.pageLayout,printProjection:api.printProjection});
})();