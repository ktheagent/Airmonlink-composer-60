'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const safety=require('../src/core/rhythmic-safety-service');
const engineApi=require('../src/composer3/engine-api');
const model=require('../src/core/score-model');
const airscore=require('../src/core/airscore');

const create=options=>engineApi.createEngine({template:'lead',measures:4,autoFillRests:true,...options});
const authored=part=>part.events.filter(e=>e.generatedBy!=='gap-fill'&&!e.hidden);

test('Build 54 safe entry prevents overlapping same-voice events and leaves score unchanged on failure',()=>{
 const e=create();safety.safeEntry(e,{pitch:'C4',start:0,duration:1,voice:1});
 const before=JSON.stringify(e.score);
 assert.throws(()=>safety.safeEntry(e,{pitch:'D4',start:.5,duration:1,voice:1,mode:'insert'}),/already used|already occupied/i);
 assert.equal(JSON.stringify(e.score),before);
 assert.deepEqual(safety.laneConflicts(e.score),[]);
});

test('Build 54 dotted and double-dotted duration changes are one transaction with undo/redo',()=>{
 const e=create();const note=safety.safeEntry(e,{pitch:'E4',start:0,duration:1,voice:1}).events[0];
 const beforeHistory=e.history.undoStack.length;
 safety.setDottedDuration(e,note.id,1,2);
 assert.equal(model.findEvent(e.score,note.id).event.duration,1.75);
 assert.equal(e.history.undoStack.length,beforeHistory+1);
 e.undo();assert.equal(model.findEvent(e.score,note.id).event.duration,1);
 e.redo();assert.equal(model.findEvent(e.score,note.id).event.duration,1.75);
});

test('Build 54 cross-barline notes split safely, create semantic ties and rebuild rests',()=>{
 const e=create({timeSignature:'4/4'});const result=safety.safeEntry(e,{pitch:'G4',start:3.5,duration:1.5,voice:1});
 assert.equal(result.segments,2);assert.equal(result.events.length,2);
 assert.equal(result.events[0].tieStart,true);assert.equal(result.events[1].tieStop,true);
 assert.ok(e.score.spanners.some(spanner=>spanner.type==='tie'&&spanner.startEventId===result.events[0].id&&spanner.endEventId===result.events[1].id));
 assert.equal(safety.laneConflicts(e.score).length,0);
 assert.ok(e.activePart().events.some(event=>event.generatedBy==='gap-fill'));
});

test('Build 54 overwrite replaces the target rhythm atomically and reconstructs surrounding rests',()=>{
 const e=create();const first=safety.safeEntry(e,{pitch:'C4',start:1,duration:1,voice:1}).events[0];
 const result=safety.safeEntry(e,{pitch:'D4',start:1,duration:.5,voice:1,mode:'overwrite'});
 assert.deepEqual(result.removedEventIds,[first.id]);
 assert.equal(authored(e.activePart()).some(event=>event.id===first.id),false);
 assert.equal(authored(e.activePart()).some(event=>event.pitch==='D4'&&event.duration===.5),true);
 assert.equal(safety.laneConflicts(e.score).length,0);
});

test('Build 54 chord preview prevents duplicate pitches and exposes the existing target',()=>{
 const e=create();const anchor=safety.safeEntry(e,{midi:60,start:0,duration:1,voice:1}).events[0];
 const preview=safety.chordPreview(e.score,e.activePartId,0,1,64);
 assert.equal(preview.valid,true);assert.deepEqual(preview.targetIds,[anchor.id]);
 safety.safeEntry(e,{midi:64,start:0,duration:1,voice:1,mode:'chord'});
 const duplicate=safety.chordPreview(e.score,e.activePartId,0,1,64);
 assert.equal(duplicate.valid,false);assert.ok(duplicate.duplicateId);
 const before=JSON.stringify(e.score);
 const error=assert.throws(()=>safety.safeEntry(e,{midi:64,start:0,duration:1,voice:1,mode:'chord'}));
 assert.equal(JSON.stringify(e.score),before);
});

test('Build 54 tie destination preview rejects invalid targets and guides valid adjacent pitches',()=>{
 const e=create();const a=safety.safeEntry(e,{midi:60,start:0,duration:1,voice:1}).events[0];
 const b=safety.safeEntry(e,{midi:62,start:1,duration:1,voice:1}).events[0];
 assert.equal(safety.tiePreview(e.score,a.id,b.id).valid,false);
 safety.safeEntry(e,{midi:60,start:1,duration:1,voice:2});
 const sameOtherVoice=authored(e.activePart()).find(x=>x.start===1&&x.voice===2);
 assert.equal(safety.tiePreview(e.score,a.id,sameOtherVoice.id).valid,false);
 const e2=create();const c=safety.safeEntry(e2,{midi:60,start:0,duration:1,voice:1}).events[0];const d=safety.safeEntry(e2,{midi:60,start:1,duration:1,voice:1}).events[0];
 const valid=safety.tiePreview(e2.score,c.id,d.id);assert.equal(valid.valid,true);assert.match(valid.description,/Tie/);
});

test('Build 54 interval, transposition and chord targets are previewed before mutation',()=>{
 const e=create();const a=safety.safeEntry(e,{midi:60,start:0,duration:1,voice:1}).events[0];e.selectEvent(a.id);
 const interval=safety.targetPreview('interval',e.score,[a.id],{semitones:4});
 const transpose=safety.targetPreview('transpose',e.score,[a.id],{semitones:-2,scope:'selection'});
 const chord=safety.targetPreview('chord',e.score,[a.id],{partId:e.activePartId,start:0,voice:1,midi:67});
 assert.equal(interval.valid,true);assert.match(interval.change,/4/);
 assert.equal(transpose.valid,true);assert.equal(transpose.scope,'selection');
 assert.equal(chord.valid,true);assert.deepEqual(chord.targetIds,[a.id]);
});

test('Build 54 repeated errors are coalesced and raw invariant language is hidden',()=>{
 const coalescer=new safety.ErrorCoalescer(3000);
 const first=coalescer.record(Object.assign(new Error('Invariant violation: overlapping events'),{code:'OVERLAP'}),1000);
 const second=coalescer.record(Object.assign(new Error('Invariant violation: overlapping events'),{code:'OVERLAP'}),1200);
 assert.equal(first.count,1);assert.equal(second.count,2);assert.match(second.announcement,/repeated 2 times/);
 assert.doesNotMatch(first.message,/invariant/i);
 const notice=safety.notificationModel(new Error('canonical assertion failed'),coalescer);
 assert.equal(notice.coversScore,false);assert.equal(notice.placement,'bottom-status-area');assert.equal(notice.role,'alert');
});

test('Build 54 safe rhythmic edits survive save close and reopen',()=>{
 const e=create();safety.safeEntry(e,{midi:65,start:3.5,duration:1,voice:1});
 const reopened=airscore.deserialize(airscore.serialize(e.score));
 assert.equal(safety.laneConflicts(reopened).length,0);
 assert.equal(reopened.spanners.filter(x=>x.type==='tie').length,1);
 assert.equal(model.validateScore(reopened).filter(x=>x.severity==='error').length,0);
});

test('Build 54 interface shows non-obstructive target preview and humane error recovery',()=>{
 const root=path.resolve(__dirname,'..');const html=fs.readFileSync(path.join(root,'src/composer3/index.html'),'utf8');
 const controller=fs.readFileSync(path.join(root,'src/composer3/build54-rhythmic-safety-controller.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'src/composer3/styles.css'),'utf8');
 assert.ok(html.includes('rhythmic-safety-service.js'));assert.ok(html.includes('build54-rhythmic-safety-controller.js'));
 for(const token of ['rhythmicSafetyStatus','rhythmicTargetPreview','rhythmicErrorNotice','ErrorCoalescer','bottom-status-area'])assert.ok(controller.includes(token)||require('../src/core/rhythmic-safety-service').notificationModel(new Error()).placement===token,token);
 assert.match(css,/bottom:10px/);assert.match(css,/coversScore|rhythmic-safety-status/);
});
