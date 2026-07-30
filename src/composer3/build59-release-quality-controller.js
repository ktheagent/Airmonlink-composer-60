(() => {
  'use strict';
  const api=window.AirmonReleaseQuality;
  if(!api)throw new Error('Build 59 release quality service is unavailable.');
  function composer(){return window.AirmonComposer3;}
  function interfaceReport(){return api.interfaceAccessibilityAudit(document);}
  function interchangeReport(){return api.interchangeAudit(composer().engine.score);}
  function render(){
    const accessibility=interfaceReport();
    const interchange=interchangeReport();
    const output=document.querySelector('#build59QualityStatus');
    if(output)output.textContent=`Accessibility ${accessibility.status} · Airscore/MusicXML/MIDI ${interchange.status} · ${accessibility.controls} controls audited`;
    return {accessibility,interchange};
  }
  function install(){
    const panel=document.querySelector('#panel-view');
    if(!panel||document.querySelector('#build59QualityGroup'))return;
    const group=document.createElement('div');
    group.id='build59QualityGroup';
    group.className='group build59-quality-group';
    group.dataset.group='ACCESSIBILITY PERFORMANCE AND USER CORRECTION';
    group.innerHTML='<span>Release quality</span><button type="button" id="build59AuditAccessibility">Audit accessibility</button><button type="button" id="build59AuditInterchange">Audit import/export</button><button type="button" id="build59FocusScore">Focus score workspace</button><output id="build59QualityStatus" aria-live="polite">Preparing release-quality audit…</output>';
    panel.appendChild(group);
    group.querySelector('#build59AuditAccessibility').addEventListener('click',render);
    group.querySelector('#build59AuditInterchange').addEventListener('click',render);
    group.querySelector('#build59FocusScore').addEventListener('click',()=>composer().command('focusScore'));
  }
  window.addEventListener('load',()=>{install();const wait=()=>composer()?.engine?(composer().engine.onChange(render),render()):setTimeout(wait,20);wait();},{once:true});
  window.AirmonReleaseQualityController=Object.freeze({render,interfaceReport,interchangeReport});
})();
