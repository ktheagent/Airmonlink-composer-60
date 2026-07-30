(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.AirmonIntegratedReleaseCandidate=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const REQUIRED_FIELDS=Object.freeze([
    'requirementId','requirementDescription','assignedBuild','implementationStatus',
    'exactSourceFiles','exactCommandHandler','semanticEngineMutation','automatedTests',
    'undoRedoEvidence','persistenceEvidence','playbackExportEvidence','interfaceEvidence',
    'checkpointCommit','remainingDefect'
  ]);
  const MINIMUM_REQUIREMENTS=164;

  function freezeRows(rows){
    return Object.freeze(rows.map(row=>Object.freeze({...row})));
  }

  function requirementsAudit(rows=[],options={}){
    const issues=[];
    const ids=new Set();
    const expectedIds=new Set(options.expectedIds||[]);
    rows.forEach((row,index)=>{
      for(const field of REQUIRED_FIELDS){
        const value=row?.[field];
        if(value===null||value===undefined||String(value).trim()===''){
          issues.push({index,requirementId:row?.requirementId||'',field,issue:'missing'});
        }
      }
      const id=String(row?.requirementId||'');
      if(ids.has(id))issues.push({index,requirementId:id,field:'requirementId',issue:'duplicate'});
      ids.add(id);
      if(row?.implementationStatus!=='VERIFIED COMPLETE'){
        issues.push({index,requirementId:id,field:'implementationStatus',issue:row?.implementationStatus||'missing'});
      }
      const build=Number(row?.assignedBuild);
      if(!Number.isInteger(build)||build<51||build>60){
        issues.push({index,requirementId:id,field:'assignedBuild',issue:'outside Build 51–60'});
      }
    });
    if(rows.length<MINIMUM_REQUIREMENTS){
      issues.push({field:'rows',issue:`expected at least ${MINIMUM_REQUIREMENTS}, found ${rows.length}`});
    }
    if(expectedIds.size){
      for(const id of expectedIds)if(!ids.has(id))issues.push({requirementId:id,field:'requirementId',issue:'omitted'});
      for(const id of ids)if(!expectedIds.has(id))issues.push({requirementId:id,field:'requirementId',issue:'unexpected'});
    }
    return Object.freeze({
      status:!issues.length?'PASS':'FAIL',
      rows:rows.length,
      uniqueIds:ids.size,
      minimumRows:MINIMUM_REQUIREMENTS,
      issues:freezeRows(issues)
    });
  }

  function buildChainAudit(validations=[]){
    const byBuild=new Map(validations.map(item=>[Number(item.build),item]));
    const issues=[];
    for(let build=51;build<=60;build+=1){
      const value=byBuild.get(build);
      if(!value)issues.push({build,issue:'missing validation report'});
      else if(value.status!=='PASS')issues.push({build,issue:`validation ${value.status||'missing'}`});
      else if(value.manifestIntegrity===false||value.manifestVerified===false){
        issues.push({build,issue:'checkpoint manifest did not verify'});
      }
    }
    return Object.freeze({
      status:!issues.length?'PASS':'FAIL',
      builds:Object.freeze([...byBuild.keys()].sort((a,b)=>a-b)),
      issues:freezeRows(issues)
    });
  }

  function identityAudit(input={}){
    const metadata=input.metadata||{};
    const packageJson=input.packageJson||{};
    const activeSources=Object.values(input.activeSources||{}).join('\n');
    const setup='Airmonlink-Composer-1.3.0-Build60-Setup.exe';
    const portable='Airmonlink-Composer-1.3.0-Build60-Portable.exe';
    const staleActive=/Build43|build43|BUILD43|1\.2\.3\.43|Airmonlink-Composer-1\.2\.3-Build43|AirmonlinkComposerBuild43/;
    const checks=[
      ['metadata version',metadata.appVersion==='1.3.0'],
      ['metadata build',Number(metadata.buildNumber)===60],
      ['metadata build version',metadata.buildVersion==='1.3.0.60'],
      ['package version',packageJson.version==='1.3.0'],
      ['package build',Number(packageJson.buildNumber)===60],
      ['package build version',packageJson.buildVersion==='1.3.0.60'],
      ['packaging build version',packageJson.build?.buildVersion==='1.3.0.60'],
      ['setup filename',metadata.setupFile===setup],
      ['portable filename',metadata.portableFile===portable],
      ['NSIS filename',String(packageJson.build?.nsis?.artifactName||'').includes('Build60-Setup')],
      ['portable packaging filename',String(packageJson.build?.portable?.artifactName||'').includes('Build60-Portable')],
      ['no stale active Build 43 identity',!staleActive.test(activeSources)]
    ].map(([name,passed])=>Object.freeze({name,passed:Boolean(passed)}));
    return Object.freeze({status:checks.every(item=>item.passed)?'PASS':'FAIL',checks:Object.freeze(checks)});
  }

  function controlAudit(value={}){
    const registered=Number(value.registered)||0;
    const enabled=Number(value.productionEnabled)||0;
    const hidden=Number(value.centrallyHidden)||0;
    const missing=Array.isArray(value.missing)?value.missing:[];
    const noOp=Array.isArray(value.noOp)?value.noOp:[];
    return Object.freeze({
      status:registered>0&&enabled===registered&&hidden===0&&!missing.length&&!noOp.length?'PASS':'FAIL',
      registered,productionEnabled:enabled,centrallyHidden:hidden,
      missing:Object.freeze([...missing]),noOp:Object.freeze([...noOp])
    });
  }

  function servicesAudit(globals={}){
    const required=[
      'workspace','templates','noteEntry','rhythmicSafety','inspectorHub',
      'engraving','staffSolfaLyrics','performancePublishing','releaseQuality'
    ];
    const missing=required.filter(name=>!globals[name]);
    return Object.freeze({status:missing.length?'FAIL':'PASS',required:Object.freeze(required),missing:Object.freeze(missing)});
  }

  function auditCyclesAudit(cycles=[]){
    const normalized=cycles.map((cycle,index)=>Object.freeze({
      cycle:Number(cycle.cycle)||index+1,
      status:cycle.status,
      commands:Array.isArray(cycle.commands)?cycle.commands.length:0
    }));
    const consecutive=normalized.length>=3&&normalized.slice(-3).every(cycle=>cycle.status==='PASS');
    return Object.freeze({status:consecutive?'PASS':'FAIL',required:3,cycles:Object.freeze(normalized)});
  }

  function restoreAudit(value={}){
    const checks=[
      ['checkpoint checksum verified',value.checksumVerified===true],
      ['source manifest verified',value.manifestVerified===true],
      ['clean extraction used',value.cleanExtraction===true],
      ['complete validation passed',value.status==='PASS']
    ].map(([name,passed])=>Object.freeze({name,passed:Boolean(passed)}));
    return Object.freeze({status:checks.every(item=>item.passed)?'PASS':'FAIL',checks:Object.freeze(checks)});
  }

  function finalSoftwareGate(input={}){
    const requirements=requirementsAudit(input.requirements||[],{expectedIds:input.expectedRequirementIds||[]});
    const buildChain=buildChainAudit(input.validations||[]);
    const identity=identityAudit(input);
    const controls=controlAudit(input.controlAudit||{});
    const services=servicesAudit(input.services||{});
    const auditCycles=auditCyclesAudit(input.auditCycles||[]);
    const restore=restoreAudit(input.restoreVerification||{});
    const checks={requirements,buildChain,identity,controls,services,auditCycles,restore};
    return Object.freeze({
      status:Object.values(checks).every(item=>item.status==='PASS')?'PASS':'FAIL',
      checks:Object.freeze(checks),
      externalReleaseEvidence:Object.freeze([...(input.externalReleaseEvidence||[])])
    });
  }

  return Object.freeze({
    REQUIRED_FIELDS,MINIMUM_REQUIREMENTS,requirementsAudit,buildChainAudit,identityAudit,
    controlAudit,servicesAudit,auditCyclesAudit,restoreAudit,finalSoftwareGate
  });
});
