(function(root,factory){
  const deps={
    model:root.AirmonScoreModel||(typeof require==='function'?require('./score-model'):null),
    formats:root.AirmonFormats||(typeof require==='function'?require('./formats'):null),
    airscore:root.AirmonAirscore||(typeof require==='function'?require('./airscore'):null),
    reliability:root.AirmonProductivityReliability||(typeof require==='function'?require('./productivity-reliability-service'):null)
  };
  const api=factory(deps);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.AirmonReleaseQuality=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(deps){
  'use strict';
  for(const [name,value] of Object.entries(deps))if(!value)throw new Error(`Build 59 dependency ${name} is unavailable.`);

  function events(score){
    return (score.parts||[]).flatMap(part=>(part.events||[]).filter(event=>event.generatedBy!=='gap-fill'));
  }
  function scoreFingerprint(score){
    const authored=events(score);
    return Object.freeze({
      parts:(score.parts||[]).length,
      measures:(score.measures||[]).length,
      events:authored.length,
      notes:authored.filter(event=>event.type==='note').length,
      rests:authored.filter(event=>event.type==='rest').length,
      lyrics:authored.reduce((sum,event)=>sum+(event.lyrics||[]).length,0),
      title:String(score.title||score.metadata?.title||''),
      composer:String(score.composer||score.metadata?.composer||'')
    });
  }
  function interchangeAudit(score){
    const source=scoreFingerprint(score);
    const airscoreText=deps.airscore.serialize(score);
    const airscoreScore=deps.airscore.deserialize(airscoreText);
    const musicXml=deps.formats.exportMusicXML(score);
    const musicXmlScore=deps.formats.parseMusicXML(musicXml);
    const midi=deps.formats.exportMidi(score);
    const midiScore=deps.formats.parseMidi(midi);
    const restored={
      airscore:scoreFingerprint(airscoreScore),
      musicXml:scoreFingerprint(musicXmlScore),
      midi:scoreFingerprint(midiScore)
    };
    const checks=Object.freeze([
      Object.freeze({name:'Airscore score persistence',passed:restored.airscore.events===source.events&&restored.airscore.parts===source.parts}),
      Object.freeze({name:'MusicXML note interchange',passed:restored.musicXml.notes===source.notes&&/<score-partwise/.test(musicXml)}),
      Object.freeze({name:'MIDI note interchange',passed:restored.midi.notes===source.notes&&String.fromCharCode(...midi.slice(0,4))==='MThd'}),
      Object.freeze({name:'Airscore metadata persistence',passed:restored.airscore.title===source.title&&restored.airscore.composer===source.composer})
    ]);
    return Object.freeze({
      status:checks.every(item=>item.passed)?'PASS':'FAIL',
      source,restored:Object.freeze(restored),checks,
      sizes:Object.freeze({airscore:new TextEncoder().encode(airscoreText).length,musicXml:new TextEncoder().encode(musicXml).length,midi:midi.length})
    });
  }
  function sourceAccessibilityAudit(sources={}){
    const html=String(sources.html||'');
    const css=String(sources.css||'');
    const checks=[
      ['Application landmark',/<main\b/.test(html)],
      ['Live status feedback',/aria-live=/.test(html)],
      ['Dialog labelling',/<dialog[^>]+aria-labelledby=/.test(html)],
      ['Keyboard focus styling',/:focus-visible/.test(css)],
      ['High contrast support',/high-contrast|highContrast/i.test(html+css)],
      ['Reduced motion support',/prefers-reduced-motion/.test(css)],
      ['Score image description',/aria-label="Editable staff notation/.test(html)],
      ['No positive tabindex',!/tabindex="[1-9]/.test(html)]
    ].map(([name,passed])=>Object.freeze({name,passed:Boolean(passed)}));
    return Object.freeze({status:checks.every(item=>item.passed)?'PASS':'FAIL',checks:Object.freeze(checks)});
  }
  function interfaceAccessibilityAudit(documentLike){
    const base=deps.reliability.accessibilityAudit(documentLike);
    const controls=[...(documentLike?.querySelectorAll?.('button,input,select,textarea,[role="button"]')||[])].filter(node=>!node.disabled&&!node.hidden);
    const commandControls=controls.filter(node=>node.dataset?.command);
    const noOps=commandControls.filter(node=>!String(node.dataset.command||'').trim());
    return Object.freeze({
      status:base.passed&&!noOps.length?'PASS':'FAIL',
      controls:base.controls,
      named:base.controls-base.issues.filter(item=>item.code==='MISSING_NAME').length,
      commandControls:commandControls.length,
      noOps:Object.freeze(noOps.map(node=>node.id||node.dataset.command||node.textContent?.trim()||'unnamed')),
      issues:base.issues
    });
  }
  function performanceAudit(samples,budgets){
    const report=deps.reliability.performanceReport(samples,budgets);
    return Object.freeze({...report,status:report.passed?'PASS':'FAIL'});
  }
  function failureRecovery(error,context={}){
    const classification=deps.reliability.classifyFailure(error,context);
    const actions=classification.actions||classification.recoveryActions||[];
    return Object.freeze({
      status:'RECOVERABLE',
      category:classification.category||classification.kind||'operation',
      userMessage:classification.userMessage||classification.message||'The operation could not be completed.',
      actions:Object.freeze([...actions]),
      preservesScore:true,
      retrySafe:classification.retrySafe!==false
    });
  }
  function correctionRegister(issues=[]){
    const rows=issues.map((issue,index)=>Object.freeze({
      id:String(issue.id||`correction-${index+1}`),
      description:String(issue.description||issue.message||'Observed usability issue'),
      evidence:String(issue.evidence||''),
      remedy:String(issue.remedy||''),
      regressionTest:String(issue.regressionTest||''),
      status:issue.status==='VERIFIED COMPLETE'?'VERIFIED COMPLETE':'OPEN'
    }));
    return Object.freeze({
      rows:Object.freeze(rows),
      open:rows.filter(row=>row.status!=='VERIFIED COMPLETE').length,
      verified:rows.filter(row=>row.status==='VERIFIED COMPLETE').length,
      status:rows.every(row=>row.status==='VERIFIED COMPLETE')?'PASS':'REQUIRES_CORRECTION'
    });
  }
  function securityBoundaryAudit(sources={}){
    const main=String(sources.main||'');
    const preload=String(sources.preload||'');
    const checks=[
      ['Context isolation enabled',/contextIsolation\s*:\s*true/.test(main)],
      ['Renderer sandbox enabled',/sandbox\s*:\s*true/.test(main)],
      ['Node integration disabled',/nodeIntegration\s*:\s*false/.test(main)],
      ['Narrow context bridge',/contextBridge\.exposeInMainWorld/.test(preload)],
      ['No remote module',!/\brequire\(['"]electron\/remote/.test(main+preload)]
    ].map(([name,passed])=>Object.freeze({name,passed:Boolean(passed)}));
    return Object.freeze({status:checks.every(item=>item.passed)?'PASS':'FAIL',checks:Object.freeze(checks)});
  }
  function qualityReport(score,input={}){
    const interchange=interchangeAudit(score);
    const sourceAccessibility=sourceAccessibilityAudit(input.sources||{});
    const performance=performanceAudit(input.samples||{},input.budgets);
    const security=securityBoundaryAudit(input.sources||{});
    const corrections=correctionRegister(input.corrections||[]);
    const statuses=[interchange.status,sourceAccessibility.status,performance.status,security.status,corrections.status];
    return Object.freeze({
      status:statuses.every(value=>value==='PASS')?'PASS':'FAIL',
      interchange,sourceAccessibility,performance,security,corrections
    });
  }
  return Object.freeze({
    scoreFingerprint,interchangeAudit,sourceAccessibilityAudit,interfaceAccessibilityAudit,
    performanceAudit,failureRecovery,correctionRegister,securityBoundaryAudit,qualityReport
  });
});
