'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const engineApi=require('../src/composer3/engine-api');
const service=require('../src/core/performance-publishing-service');
const airscore=require('../src/core/airscore');

function create(){
  const engine=engineApi.createEngine({template:'lead',title:'Build 58 performance',measures:4,autoFillRests:false});
  engine.addNote({midi:60,start:0,duration:1,voice:1,velocity:72});
  engine.addNote({midi:64,start:1,duration:1,voice:1,velocity:104});
  engine.addNote({midi:67,start:2,duration:2,voice:1,velocity:88});
  return engine;
}

test('Build 58 performance plan exposes cursor, count-in, metronome, loop, tempo, repeats and dynamics',()=>{
  const engine=create();
  engine.score.measures[0].repeatStart=true;
  engine.score.measures[1].repeatEnd=true;
  engine.score.measures[2].ending=1;
  engine.score.measures[3].tempo=96;
  const plan=service.performancePlan(engine.score,{countInMeasures:1,metronome:true,loop:true,loopStart:0,loopEnd:4});
  assert.equal(plan.cursorFollow,true);
  assert.equal(plan.countInMeasures,1);
  assert.equal(plan.metronome,true);
  assert.equal(plan.loop.enabled,true);
  assert.ok(plan.schedule.length>=3);
  assert.ok(plan.metronomeBeats.length>0);
  assert.ok(plan.tempoChanges.some(item=>item.bpm===96));
  assert.ok(plan.segments.length>=4);
});

test('Build 58 mixer mutations are atomic, undoable, redoable and persistent',()=>{
  const engine=create();
  const part=engine.score.parts[0];
  const before=engine.history.undoStack.length;
  const result=service.applyMixer(engine,{channels:[{partId:part.id,volume:.7,pan:-.25,muted:false,solo:true}]});
  assert.equal(result.atomicUndo,true);
  assert.equal(engine.history.undoStack.length,before+1);
  assert.equal(engine.score.mixer.channels[0].volume,.7);
  engine.undo();assert.notEqual(engine.score.mixer?.channels?.[0]?.volume,.7);
  engine.redo();assert.equal(engine.score.mixer.channels[0].volume,.7);
  const reopened=airscore.deserialize(airscore.serialize(engine.score));
  assert.equal(reopened.mixer.channels[0].solo,true);
});

test('Build 58 instrument assignment and semantic linked parts preserve source events',()=>{
  const engine=create();
  const part=engine.score.parts[0];
  const eventCount=part.events.filter(event=>event.generatedBy!=='gap-fill').length;
  const assigned=service.assignInstrument(engine,part.id,'violin');
  assert.equal(assigned.instrumentKey,'violin');
  assert.equal(assigned.atomicUndo,true);
  const parts=service.partsPlan(engine.score,{build:58});
  assert.equal(parts.sourcePartCount,engine.score.parts.length);
  assert.ok(parts.linkedParts.length>=engine.score.parts.length);
  assert.equal(engine.score.parts[0].events.filter(event=>event.generatedBy!=='gap-fill').length,eventCount);
  assert.match(parts.exportTargets[0].filename,/Build58/);
});

test('Build 58 MusicXML and MIDI round trips preserve authored notes',()=>{
  const evidence=service.roundTripEvidence(create().score);
  assert.equal(evidence.musicXml.valid,true);
  assert.equal(evidence.midi.valid,true);
  assert.equal(evidence.musicXmlPreservesNotes,true);
  assert.equal(evidence.midiPreservesNotes,true);
});

test('Build 58 publishing, print preview, save/reopen, autosave and recovery are represented by executable plans',()=>{
  const engine=create();
  const publication=service.publishingMatrix(engine.score,{formats:['pdf','png','svg','musicxml','midi']});
  assert.equal(publication.printPreview,true);
  assert.equal(publication.supported.pdf,true);
  assert.equal(publication.supported.musicXml,true);
  assert.ok(publication.targets.some(item=>item.format==='pdf'));
  const persistence=service.persistenceEvidence(engine.score,{documentId:'build58'});
  assert.equal(persistence.preserved,true);
  assert.equal(persistence.recoveryReady,true);
  assert.match(persistence.autosave.recoveryName,/recovery\.airscore$/);
});

test('Build 58 integrated report covers playback, mixer, instruments, parts and publishing',()=>{
  const report=service.integratedReport(create().score,{build:58,countInMeasures:1});
  assert.equal(report.status,'PASS');
  assert.ok(report.performance.playableNotes>0);
  assert.ok(report.mixer.channels.length>0);
  assert.equal(report.interchange.musicXmlPreservesNotes,true);
  assert.equal(report.persistence.preserved,true);
});

test('Build 58 interface exposes functional integrated performance controls',()=>{
  const root=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'src/composer3/index.html'),'utf8');
  const controller=fs.readFileSync(path.join(root,'src/composer3/build58-performance-publishing-controller.js'),'utf8');
  for(const token of ['performance-publishing-service.js','build58-performance-publishing-controller.js'])assert.ok(html.includes(token),token);
  for(const token of ['PERFORMANCE MIXER PARTS AND PUBLISHING','build58RefreshPerformance','build58GenerateParts','build58VerifyPublishing','addEventListener'])assert.ok(controller.includes(token),token);
});
