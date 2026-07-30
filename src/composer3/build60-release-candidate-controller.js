(() => {
  'use strict';

  const api=window.AirmonIntegratedReleaseCandidate;
  if(!api)throw new Error('Build 60 integrated release-candidate service is unavailable.');

  const OWN_CONTROLS=Object.freeze([
    'build60RunSoftwareGate','build60VerifyControls','build60VerifyPersistence'
  ]);

  function composer(){
    const value=window.AirmonComposer3;
    if(!value?.engine)throw new Error('A score must be open before running the Build 60 software gate.');
    return value;
  }

  function services(){
    return Object.freeze({
      workspace:Boolean(window.AirmonProfessionalWorkspace),
      templates:Boolean(window.AirmonTemplateGallery),
      noteEntry:Boolean(window.AirmonProfessionalNoteEntry),
      rhythmicSafety:Boolean(window.AirmonRhythmicSafety),
      inspectorHub:Boolean(window.AirmonProfessionalInspectorHub),
      engraving:Boolean(window.AirmonProfessionalEngraving),
      staffSolfaLyrics:Boolean(window.AirmonStaffSolfaLyrics),
      performancePublishing:Boolean(window.AirmonPerformancePublishing),
      releaseQuality:Boolean(window.AirmonReleaseQuality)
    });
  }

  function controlSurfaceAudit(){
    const commandButtons=[...document.querySelectorAll('button[data-command]:not([disabled])')];
    const commandIds=[...new Set(commandButtons.map(button=>button.dataset.command).filter(Boolean))];
    const registryAudit=window.AirmonProfessionalInspectorHub.enabledControlAudit(commandIds);
    const ownMissing=OWN_CONTROLS.filter(id=>!document.getElementById(id));
    return Object.freeze({
      status:registryAudit.pass&&!ownMissing.length?'PASS':'FAIL',
      commandButtons:commandButtons.length,
      uniqueCommands:commandIds.length,
      registryAudit,
      controllerControls:Object.freeze([...OWN_CONTROLS]),
      ownMissing:Object.freeze(ownMissing)
    });
  }

  function persistenceAudit(){
    const {engine}=composer();
    const value=window.AirmonPerformancePublishing.persistenceEvidence(engine.score,{
      documentId:engine.score.id||'build60',
      intervalSeconds:30,
      retain:20
    });
    return Object.freeze({
      status:value.preserved&&value.recoveryReady?'PASS':'FAIL',
      ...value
    });
  }

  function report(){
    const serviceReport=api.servicesAudit(services());
    const quality=window.AirmonReleaseQualityController?.render?.();
    const performance=window.AirmonPerformancePublishingController?.report?.();
    const controls=controlSurfaceAudit();
    const persistence=persistenceAudit();
    return Object.freeze({
      status:[
        serviceReport.status,
        quality?.accessibility?.status,
        quality?.interchange?.status,
        performance?.status,
        controls.status,
        persistence.status
      ].every(value=>value==='PASS')?'PASS':'FAIL',
      services:serviceReport,
      quality,
      performance,
      controls,
      persistence
    });
  }

  function show(message){
    const output=document.querySelector('#build60ReleaseStatus');
    if(output)output.textContent=message;
  }

  function render(){
    const value=report();
    show(`Build 60 integrated software gate ${value.status} · ${value.services.required.length} services · ${value.controls.uniqueCommands} commands`);
    return value;
  }

  function install(){
    const panel=document.querySelector('#panel-publish');
    if(!panel||document.querySelector('#build60ReleaseGroup'))return;
    const group=document.createElement('div');
    group.id='build60ReleaseGroup';
    group.className='group build60-release-group';
    group.dataset.group='BUILD 60 INTEGRATED SOFTWARE GATE';
    group.innerHTML=[
      '<span>Integrated release candidate</span>',
      '<button type="button" id="build60RunSoftwareGate">Run software gate</button>',
      '<button type="button" id="build60VerifyControls">Verify enabled controls</button>',
      '<button type="button" id="build60VerifyPersistence">Verify save and recovery</button>',
      '<output id="build60ReleaseStatus" aria-live="polite">Preparing integrated gate…</output>'
    ].join('');

    panel.appendChild(group);
    group.querySelector('#build60RunSoftwareGate').addEventListener('click',render);
    group.querySelector('#build60VerifyControls').addEventListener('click',()=>{
      const value=controlSurfaceAudit();
      show(`Command/control audit ${value.status} · ${value.uniqueCommands} unique commands · ${value.ownMissing.length} missing gate controls`);
    });
    group.querySelector('#build60VerifyPersistence').addEventListener('click',()=>{
      const value=persistenceAudit();
      show(`Save/reopen ${value.preserved?'PASS':'FAIL'} · autosave/recovery ${value.recoveryReady?'PASS':'FAIL'}`);
    });
  }

  window.addEventListener('load',()=>{
    install();
    const wait=()=>{
      if(window.AirmonComposer3?.engine){
        window.AirmonComposer3.engine.onChange(render);
        render();
      }else setTimeout(wait,20);
    };
    wait();
  },{once:true});

  window.AirmonBuild60Controller=Object.freeze({
    services,controlSurfaceAudit,persistenceAudit,report,render,install
  });
})();
