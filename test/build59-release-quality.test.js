'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const quality=require('../src/core/release-quality-service');
const engineApi=require('../src/composer3/engine-api');

function create(){
  const engine=engineApi.createEngine({template:'lead',title:'Build 59 quality',composer:'Airmonlink',measures:3,autoFillRests:false});
  const note=engine.addNote({midi:60,start:0,duration:1,voice:1});
  engine.selectEvent(note.id);
  engine.setLyric('Quality',{verse:1});
  return engine;
}

test('Build 59 Airscore, MusicXML and MIDI interchange preserve semantic score evidence',()=>{
  const report=quality.interchangeAudit(create().score);
  assert.equal(report.status,'PASS');
  assert.ok(report.checks.every(item=>item.passed));
  assert.equal(report.restored.airscore.events,report.source.events);
  assert.equal(report.restored.musicXml.notes,report.source.notes);
  assert.equal(report.restored.midi.notes,report.source.notes);
});

test('Build 59 source accessibility audit checks landmarks, names, focus, contrast and reduced motion',()=>{
  const root=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'src/composer3/index.html'),'utf8');
  const css=fs.readFileSync(path.join(root,'src/composer3/styles.css'),'utf8');
  const report=quality.sourceAccessibilityAudit({html,css});
  assert.equal(report.status,'PASS');
  assert.equal(report.checks.length,8);
});

test('Build 59 interface accessibility audit rejects unnamed controls and positive tabindex',()=>{
  const controls=[
    {disabled:false,hidden:false,dataset:{command:'save'},getAttribute:name=>name==='aria-label'?'Save':name==='tabindex'?'0':null,textContent:'',labels:[]},
    {disabled:false,hidden:false,dataset:{},getAttribute:name=>name==='tabindex'?'2':null,textContent:'',labels:[]}
  ];
  const documentLike={querySelectorAll:()=>controls};
  const report=quality.interfaceAccessibilityAudit(documentLike);
  assert.equal(report.status,'FAIL');
  assert.ok(report.issues.some(item=>item.code==='MISSING_NAME'));
  assert.ok(report.issues.some(item=>item.code==='POSITIVE_TABINDEX'));
});

test('Build 59 performance budgets fail missing or excessive samples and pass valid evidence',()=>{
  const budgets={startupMs:3000,interactionMs:100};
  assert.equal(quality.performanceAudit({startupMs:1000,interactionMs:40},budgets).status,'PASS');
  assert.equal(quality.performanceAudit({startupMs:5000},budgets).status,'FAIL');
});

test('Build 59 failures yield humane recovery without score mutation',()=>{
  const report=quality.failureRecovery(new Error('network unavailable'),{operation:'export'});
  assert.equal(report.status,'RECOVERABLE');
  assert.equal(report.preservesScore,true);
  assert.ok(report.userMessage.length>0);
});

test('Build 59 correction register cannot pass with open real-user defects',()=>{
  const open=quality.correctionRegister([{id:'U1',description:'Caret hidden',status:'OPEN'}]);
  assert.equal(open.status,'REQUIRES_CORRECTION');
  const fixed=quality.correctionRegister([{id:'U1',description:'Caret hidden',evidence:'browser test',remedy:'reflow',regressionTest:'viewport',status:'VERIFIED COMPLETE'}]);
  assert.equal(fixed.status,'PASS');
});

test('Build 59 Electron security boundary remains isolated and sandboxed',()=>{
  const root=path.resolve(__dirname,'..');
  const main=fs.readFileSync(path.join(root,'src/composer3/main.js'),'utf8');
  const preload=fs.readFileSync(path.join(root,'src/composer3/preload.js'),'utf8');
  const report=quality.securityBoundaryAudit({main,preload});
  assert.equal(report.status,'PASS');
  assert.ok(report.checks.every(item=>item.passed));
});

test('Build 59 interface exposes functional accessibility and user-correction controls',()=>{
  const root=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'src/composer3/index.html'),'utf8');
  const controller=fs.readFileSync(path.join(root,'src/composer3/build59-release-quality-controller.js'),'utf8');
  for(const token of ['release-quality-service.js','build59-release-quality-controller.js'])assert.ok(html.includes(token),token);
  for(const token of ['ACCESSIBILITY PERFORMANCE AND USER CORRECTION','build59AuditAccessibility','build59AuditInterchange','build59FocusScore','addEventListener'])assert.ok(controller.includes(token),token);
});
