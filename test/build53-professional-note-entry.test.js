'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const entry=require('../src/core/professional-note-entry-service');
const engineApi=require('../src/composer3/engine-api');
const model=require('../src/core/score-model');
const airscore=require('../src/core/airscore');
const formats=require('../src/core/formats');
const playback=require('../src/core/playback');

function engine(options={}){return engineApi.createEngine({template:'lead',measures:4,autoFillRests:true,...options});}
function authored(part){return part.events.filter(e=>e.generatedBy!=='gap-fill'&&!e.hidden);}

test('Build 53 maps staff position and pointer position to pitch and snapped rhythmic location',()=>{
 const score=model.createScore({template:'lead',measures:4});
 const topE=entry.pitchFromStaffPoint({y:48,top:0,lineSpacing:12,clef:'treble'});
 const topF=entry.pitchFromStaffPoint({y:42,top:0,lineSpacing:12,clef:'treble'});
 assert.equal(topE.pitch,'E4');assert.equal(topF.pitch,'F4');
 const beat=entry.beatFromPointer(score,{x:150,left:50,right:450,systemStart:0,systemEnd:16,duration:1});
 assert.equal(beat,4);
 const ghost=entry.ghost(score,{x:150,y:42,left:50,right:450,top:0,lineSpacing:12,systemStart:0,systemEnd:16,clef:'treble',partId:score.parts[0].id,voice:2,duration:1});
 assert.equal(ghost.pitch,'F4');assert.equal(ghost.start,4);assert.equal(ghost.colorVoice,2);
});

test('Build 53 direct mouse-style insertion creates semantic note and advances caret',()=>{
 const e=engine();const part=e.activePart();
 const result=entry.apply(e,{point:{x:100,y:42,left:0,right:400,top:0,lineSpacing:12,systemStart:0,systemEnd:16,clef:'treble',partId:part.id},mode:'insert',duration:1,voice:1});
 assert.equal(result.type,'note');assert.equal(result.pitch,'F4');assert.equal(e.cursor,5);
 assert.equal(e.selectedEntries().some(item=>item.event.id===result.id),true);
});

test('Build 53 keyboard-only and virtual-piano input use active cursor, duration and voice',()=>{
 const e=engine();e.setActiveVoice(3);e.seek(0);e.setDuration(.5);
 const action=entry.keyboardAction('C',{voice:3,dots:0});assert.deepEqual(action,{type:'pitch',letter:'C'});
 const note=entry.apply(e,{pitch:'C5',start:e.cursor,duration:.5,voice:3,inputSource:'keyboard-entry'});
 const piano=entry.apply(e,{midi:67,start:e.cursor,duration:.5,voice:3,inputSource:'virtual-piano'});
 assert.equal(note.voice,3);assert.equal(piano.voice,3);assert.equal(note.inputSource,'keyboard-entry');assert.equal(piano.inputSource,'virtual-piano');
 assert.equal(e.cursor,1);
});

test('Build 53 insert, overwrite and chord modes are semantic and atomically undoable',()=>{
 const e=engine();const part=e.activePart();
 const first=entry.apply(e,{pitch:'C4',start:0,duration:1,voice:1,mode:'insert'});
 const historyAfterInsert=e.history.undoStack.length;
 const replacement=entry.apply(e,{pitch:'D4',start:0,duration:1,voice:1,mode:'overwrite'});
 assert.equal(authored(part).some(x=>x.id===first.id),false);assert.equal(replacement.pitch,'D4');
 assert.equal(e.history.undoStack.length,historyAfterInsert+1);
 e.undo();assert.equal(authored(e.activePart()).some(x=>x.pitch==='C4'),true);
 e.redo();assert.equal(authored(e.activePart()).some(x=>x.pitch==='D4'),true);
 const chord=entry.apply(e,{pitch:'F4',start:0,duration:1,voice:1,mode:'chord'});
 assert.equal(chord.start,0);
 assert.throws(()=>entry.apply(e,{pitch:'F4',start:0,duration:1,voice:1,mode:'chord'}),/already exists/i);
});

test('Build 53 dots, double dots, rests, articulations, ties and slurs use genuine score semantics',()=>{
 const e=engine({timeSignature:'4/4'});
 assert.equal(entry.effectiveDuration(entry.session({duration:1,dots:1})),1.5);
 assert.equal(entry.effectiveDuration(entry.session({duration:1,dots:2})),1.75);
 const rest=entry.apply(e,{kind:'rest',start:0,duration:1,dots:1,voice:2,mode:'insert'});
 assert.equal(rest.duration,1.5);assert.equal(rest.type,'rest');
 const note=entry.apply(e,{pitch:'G4',start:3.5,duration:1,voice:1,mode:'insert',articulation:'staccato'});
 const created=authored(e.activePart()).filter(x=>x.type==='note');
 assert.equal(created.length,2);assert.ok(e.score.spanners.some(x=>x.type==='tie'));
 assert.equal(created[0].articulations?.includes('staccato'),true);
 e.selectEvents(created.map(x=>x.id));e.addSlur();
 assert.ok(e.score.spanners.some(x=>x.type==='slur'));
});

test('Build 53 voices 1-4, automatic advance and MIDI step/real-time decoding are explicit',()=>{
 const e=engine();
 for(let voice=1;voice<=4;voice+=1) entry.apply(e,{pitch:`C${voice+2}`,start:voice-1,duration:.5,voice,mode:'insert'});
 assert.deepEqual(new Set(authored(e.activePart()).map(x=>x.voice)),new Set([1,2,3,4]));
 assert.deepEqual(entry.midiAction([0x90,64,100],{mode:'step'}),{type:'noteOn',midi:64,velocity:100,mode:'step'});
 assert.deepEqual(entry.midiAction([0x80,64,0],{mode:'realtime'}),{type:'noteOff',midi:64,velocity:0,mode:'realtime'});
 assert.equal(e.cursor,3.5);
});

test('Build 53 note entry survives save/reopen and appears in playback and export',()=>{
 const e=engine();entry.apply(e,{pitch:'E4',start:0,duration:1,voice:1});entry.apply(e,{pitch:'G4',start:1,duration:1,voice:1});
 const reopened=airscore.deserialize(airscore.serialize(e.score));
 const e2=engineApi.createEngine({score:reopened});
 assert.equal(authored(e2.activePart()).length,2);
 const schedule=playback.buildPerformanceSchedule(reopened);assert.ok(schedule.some(item=>item.midi===64));
 const xml=formats.exportMusicXML(reopened);assert.match(xml,/<pitch>/);assert.match(xml,/<step>E<\/step>/);
});

test('Build 53 interface exposes direct entry, modes, ghost, compact guide and docked virtual piano',()=>{
 const root=path.resolve(__dirname,'..');const html=fs.readFileSync(path.join(root,'src/composer3/index.html'),'utf8');
 const controller=fs.readFileSync(path.join(root,'src/composer3/build53-note-entry-controller.js'),'utf8');
 const app=fs.readFileSync(path.join(root,'src/composer3/app.js'),'utf8');const css=fs.readFileSync(path.join(root,'src/composer3/styles.css'),'utf8');
 for(const token of ['professional-note-entry-service.js','build53-note-entry-controller.js'])assert.ok(html.includes(token));
 for(const token of ['DIRECT PROFESSIONAL ENTRY','insert','overwrite','chord','entryShortcutGuide','build53VirtualPiano','data-piano-midi','direct-entry-ghost'])assert.ok(controller.includes(token),token);
 for(const token of ["'data-staff-top'","'data-staff-clef'"])assert.ok(app.includes(token));
 assert.match(css,/build53-virtual-piano/);assert.match(css,/direct-entry-ghost\.voice-4/);
 assert.doesNotMatch(controller,/Windows on-screen keyboard/i);
});
