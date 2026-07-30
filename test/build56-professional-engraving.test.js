'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const engraving=require('../src/core/professional-engraving-service');
const engineApi=require('../src/composer3/engine-api');
const model=require('../src/core/score-model');
const airscore=require('../src/core/airscore');

test('Build 56 dense chord hit testing is deterministic and cycles coincident notes individually',()=>{
 const candidates=[
  {eventId:'v1',voice:1,x:100,y:100},{eventId:'v2',voice:2,x:100,y:100},{eventId:'near',voice:3,x:105,y:103}
 ];
 assert.equal(engraving.hitTest(candidates,{x:100,y:100},0).eventId,'v1');
 assert.equal(engraving.hitTest(candidates,{x:100,y:100},1).eventId,'v2');
 assert.equal(engraving.hitTest(candidates,{x:100,y:100},2).eventId,'near');
 assert.equal(engraving.hitTest(candidates,{x:200,y:200},0),null);
});

test('Build 56 voices, unisons and seconds receive predictable horizontal offsets and stem directions',()=>{
 const events=[
  {id:'a',type:'note',midi:60,voice:1},{id:'b',type:'note',midi:60,voice:2},
  {id:'c',type:'note',midi:61,voice:3},{id:'d',type:'note',midi:67,voice:4}
 ];
 const offsets=events.map(event=>engraving.voiceOffset(event,events));
 assert.equal(new Set(offsets.map(item=>item.x)).size,4);
 assert.equal(offsets[0].unison,true);assert.equal(offsets[2].second,true);
 assert.equal(engraving.stemDirection(events[0],events),'up');
 assert.equal(engraving.stemDirection(events[1],events),'down');
});

test('Build 56 collision planning separates accidentals, dots, rests, text and spanners',()=>{
 const plan=engraving.collisionPlan({
  accidentals:[{id:'a',anchor:10,width:8},{id:'b',anchor:12,width:8}],
  dots:[{id:'d1',anchor:20,width:4},{id:'d2',anchor:21,width:4}],
  rests:[{id:'r1',anchor:30,width:10},{id:'r2',anchor:32,width:10}],
  lyrics:[{id:'l',anchor:40,width:30}],dynamics:[{id:'dyn',anchor:42,width:18}],text:[{id:'t',anchor:44,width:25}],
  spanners:[{id:'tie'},{id:'slur'}]
 });
 assert.equal(plan.collisionFree,true);
 assert.notEqual(plan.accidentals[0].lane,plan.accidentals[1].lane);
 assert.notEqual(plan.dots[0].lane,plan.dots[1].lane);
 assert.notEqual(plan.rests[0].lane,plan.rests[1].lane);
 assert.ok(plan.spanners[1].arch>plan.spanners[0].arch);
});

test('Build 56 page layout balances systems and positions title, dedication, composer and arranger professionally',()=>{
 const plan=engraving.pageLayout({pageHeight:1123,topMargin:72,bottomMargin:72,systems:5,staffSize:100});
 assert.equal(plan.professional,true);assert.equal(plan.verticalBalance,true);
 assert.equal(plan.metadata.title.align,'center');assert.equal(plan.metadata.dedication.zone,'header');
 assert.equal(plan.metadata.composer.align,'right');assert.equal(plan.metadata.arranger.align,'right');
 assert.ok(plan.systemSpacing>=72);
});

test('Build 56 editing overrides are semantic, atomic, undoable and survive reopen without changing note data',()=>{
 const e=engineApi.createEngine({template:'lead',measures:2,autoFillRests:false});
 const note=e.addNote({midi:64,start:0,duration:1,voice:2});
 e.selectEvent(note.id);
 const before=e.history.undoStack.length;
 e.setSelectedVisualOverride({offsetX:12,offsetY:-8,visible:true});
 let event=model.findEvent(e.score,note.id).event;
 assert.equal(event.midi,64);assert.equal(event.start,0);assert.equal(event.duration,1);
 assert.equal(event.visualOverride.offsetX,12);assert.equal(e.history.undoStack.length,before+1);
 e.undo();event=model.findEvent(e.score,note.id).event;assert.equal(event.visualOverride,undefined);
 e.redo();event=model.findEvent(e.score,note.id).event;assert.equal(event.visualOverride.offsetY,-8);
 const reopened=airscore.deserialize(airscore.serialize(e.score));
 event=model.findEvent(reopened,note.id).event;assert.equal(event.visualOverride.offsetX,12);assert.equal(event.midi,64);
});

test('Build 56 print projection removes editing handles and keeps professional black output',()=>{
 const output=engraving.printProjection([
  {kind:'note',color:'#1768d5'},{kind:'selection-handle'},{kind:'voice-selection-halo'},{kind:'lyric',color:'#334455'}
 ]);
 assert.deepEqual(output.map(item=>item.kind),['note','lyric']);
 assert.ok(output.every(item=>item.color==='#000000'&&item.printable));
});

test('Build 56 interface connects collision-aware rendering, dense hit cycling and print sanitisation',()=>{
 const root=path.resolve(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'src/composer3/index.html'),'utf8');
 const app=fs.readFileSync(path.join(root,'src/composer3/app.js'),'utf8');
 const controller=fs.readFileSync(path.join(root,'src/composer3/build56-engraving-controller.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'src/composer3/styles.css'),'utf8');
 assert.ok(html.includes('professional-engraving-service.js'));assert.ok(html.includes('build56-engraving-controller.js'));
 for(const token of ['voiceOffset(event, simultaneous)','elementsFromPoint','candidateCount','beforeprint','professional-print-projection'])assert.ok(`${app}${controller}${css}`.includes(token),token);
 assert.match(css,/voice-selection-halo[\s\S]*display:none!important/);
});
