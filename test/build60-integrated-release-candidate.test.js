'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const gate=require('../src/core/integrated-release-candidate-service');
const engineApi=require('../src/composer3/engine-api');
const workspace=require('../src/core/professional-workspace-service');
const templates=require('../src/core/template-gallery-service');
const noteEntry=require('../src/core/professional-note-entry-service');
const rhythmic=require('../src/core/rhythmic-safety-service');
const inspector=require('../src/core/professional-inspector-hub-service');
const engraving=require('../src/core/professional-engraving-service');
const staffSolfaLyrics=require('../src/core/staff-solfa-lyrics-service');
const performance=require('../src/core/performance-publishing-service');
const quality=require('../src/core/release-quality-service');
const registry=require('../src/composer3/functional-command-registry');

function json(relative){return JSON.parse(fs.readFileSync(path.join(root,relative),'utf8'));}
function text(relative){return fs.readFileSync(path.join(root,relative),'utf8');}
function score(){
  const engine=engineApi.createEngine({template:'lead',title:'Build 60 integrated RC',composer:'Airmonlink',measures:4,autoFillRests:false});
  engine.addNote({midi:60,start:0,duration:1,voice:1,velocity:80});
  engine.addNote({midi:64,start:1,duration:1,voice:1,velocity:96});
  engine.addNote({midi:67,start:2,duration:2,voice:1,velocity:88});
  return engine;
}

test('Build 60 identity, packaging and visible application version are consistent',()=>{
  const metadata=json('release-metadata.json');
  const pkg=json('package.json');
  const activeSources={
    workflow:text('.github/workflows/windows-build.yml'),
    html:text('src/composer3/index.html'),
    app:text('src/composer3/app.js'),
    main:text('src/composer3/main.js')
  };
  const report=gate.identityAudit({metadata,packageJson:pkg,activeSources});
  assert.equal(report.status,'PASS',JSON.stringify(report));
  assert.match(activeSources.html,/1\.3\.0 · Build 60/);
  assert.match(activeSources.html,/integrated-release-candidate-service\.js/);
  assert.match(activeSources.html,/build60-release-candidate-controller\.js/);
});

test('Build 60 register contains every 154 feature row and 10 final-gate row with complete traceability',()=>{
  const register=json('docs/development/BUILD60-REQUIREMENTS-REGISTER.json');
  assert.equal(register.featureRequirementCount,154);
  assert.equal(register.releaseGateRequirementCount,10);
  assert.equal(register.rows.length,164);
  const expectedIds=register.rows.map(row=>row.requirementId);
  const report=gate.requirementsAudit(register.rows,{expectedIds});
  assert.equal(report.status,'PASS',JSON.stringify(report.issues.slice(0,5)));
  assert.equal(report.uniqueIds,164);
});

test('Build 60 requirement audit fails omissions, duplicates and unverified rows',()=>{
  const register=json('docs/development/BUILD60-REQUIREMENTS-REGISTER.json');
  const broken=register.rows.slice(1).map(row=>({...row}));
  broken[0].implementationStatus='IMPLEMENTED BUT NOT VERIFIED';
  broken.push({...broken[0]});
  const report=gate.requirementsAudit(broken,{expectedIds:register.rows.map(row=>row.requirementId)});
  assert.equal(report.status,'FAIL');
  assert.ok(report.issues.some(item=>item.issue==='omitted'));
  assert.ok(report.issues.some(item=>item.issue==='duplicate'));
  assert.ok(report.issues.some(item=>item.field==='implementationStatus'));
});

test('Build 60 integrates workspace, templates, note entry, safety, inspector, engraving, Staff/Sol-fa, playback and quality',()=>{
  const layout=workspace.computeLayout(workspace.defaults(),{width:1366,height:768});
  assert.ok(layout.scoreWidth>700);

  const semantic=templates.createSemanticScore('lead-sheet',{title:'Integrated',measures:4});
  assert.ok(semantic.parts.length>0);

  const engine=score();
  const session=noteEntry.session({voice:2,duration:1,mode:'insert',cursorBeat:3});
  const plan=noteEntry.placement(engine.score,{...session,midi:69,partId:engine.score.parts[0].id,start:3});
  const inserted=noteEntry.apply(engine,plan);
  assert.equal(inserted.voice,2);

  const preview=rhythmic.targetPreview('transpose',engine.score,[inserted.id],{semitones:2,scope:'selection'});
  assert.equal(preview.valid,true);

  const prefs=inspector.voicePreferences();
  assert.equal(Object.keys(prefs.colors).length,4);
  assert.equal(inspector.publicationAppearance({}).editingColorsIncluded,false);

  const collisions=engraving.collisionPlan({accidentals:[{id:'a',anchor:10,width:5}],dots:[{id:'d',anchor:10,width:2}]});
  assert.equal(collisions.collisionFree,true);

  const sync=staffSolfaLyrics.synchronization(engine.score,{viewMode:'split'});
  assert.equal(sync.valid,true);

  const integrated=performance.integratedReport(engine.score,{build:60,countInMeasures:1});
  assert.equal(integrated.status,'PASS');
  assert.equal(integrated.interchange.musicXmlPreservesNotes,true);
  assert.equal(integrated.interchange.midiPreservesNotes,true);

  const interchange=quality.interchangeAudit(engine.score);
  assert.equal(interchange.status,'PASS');
});

test('Build 60 final software gate requires Builds 51-60, controls, services, cycles and clean restore',()=>{
  const register=json('docs/development/BUILD60-REQUIREMENTS-REGISTER.json');
  const chain=json('docs/development/BUILD51-59-VALIDATION-CHAIN.json').validations;
  const metadata=json('release-metadata.json');
  const pkg=json('package.json');
  const html=text('src/composer3/index.html');
  const app=text('src/composer3/app.js');
  const ids=[...new Set([...html.matchAll(/data-command="([^"]+)"/g)].map(match=>match[1]))];
  const control=registry.audit(ids);
  const result=gate.finalSoftwareGate({
    requirements:register.rows,
    expectedRequirementIds:register.rows.map(row=>row.requirementId),
    validations:[...chain,{build:60,status:'PASS',manifestIntegrity:true}],
    metadata,
    packageJson:pkg,
    activeSources:{html,app,main:text('src/composer3/main.js'),workflow:text('.github/workflows/windows-build.yml')},
    controlAudit:{
      registered:ids.length-control.missing.length,
      productionEnabled:ids.length-control.missing.length-control.nonProduction.length,
      centrallyHidden:0,
      missing:control.missing,
      noOp:[]
    },
    services:{
      workspace,templates,noteEntry,rhythmicSafety:rhythmic,inspectorHub:inspector,
      engraving,staffSolfaLyrics,performancePublishing:performance,releaseQuality:quality
    },
    auditCycles:[1,2,3].map(cycle=>({cycle,status:'PASS',commands:['validate:full']})),
    restoreVerification:{checksumVerified:true,manifestVerified:true,cleanExtraction:true,status:'PASS'},
    externalReleaseEvidence:['Windows installation','physical printer','physical MIDI/audio hardware','code signing','independent assistive-technology and user acceptance']
  });
  assert.equal(result.status,'PASS',JSON.stringify(result.checks));
  assert.equal(result.externalReleaseEvidence.length,5);
});

test('Build 60 interface exposes functional integrated gate controls without replacing earlier build controllers',()=>{
  const html=text('src/composer3/index.html');
  const controller=text('src/composer3/build60-release-candidate-controller.js');
  for(let build=51;build<=60;build+=1)assert.ok(html.includes(`build${build}-`),`Build ${build} controller missing`);
  for(const token of [
    'build60RunSoftwareGate','build60VerifyControls','build60VerifyPersistence',
    'controlSurfaceAudit','persistenceAudit','addEventListener'
  ])assert.ok(controller.includes(token),token);
});
