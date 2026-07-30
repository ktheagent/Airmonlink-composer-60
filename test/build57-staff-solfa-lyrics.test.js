'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sync=require('../src/core/staff-solfa-lyrics-service');
const engineApi=require('../src/composer3/engine-api');
const model=require('../src/core/score-model');
const airscore=require('../src/core/airscore');

const create=()=>engineApi.createEngine({template:'lead',title:'Build 57 song',composer:'Composer',measures:4,key:'C',timeSignature:'4/4',autoFillRests:false});

test('Build 57 exposes staff-only, Sol-fa-only and split synchronized view modes',()=>{
 assert.deepEqual(sync.VIEW_MODES,['staff','solfa','split']);
 assert.equal(sync.viewMode('staff'),'staff');assert.equal(sync.viewMode('solfa'),'solfa');assert.equal(sync.viewMode('split'),'split');
 assert.equal(sync.viewMode('unknown'),'staff');
});

test('Build 57 Staff edits immediately update movable-do Sol-fa and preserve undo/redo/persistence',()=>{
 const e=create();const note=e.addNote({midi:60,start:0,duration:1,voice:1});
 let row=sync.staffProjection(e.score).find(item=>item.eventId===note.id);
 assert.match(row.solfa,/d/i);assert.equal(row.midi,60);
 sync.editStaffPitch(e,note.id,62);
 row=sync.staffProjection(e.score).find(item=>item.eventId===note.id);
 assert.equal(row.midi,62);assert.match(row.solfa,/r/i);
 e.undo();assert.equal(model.findEvent(e.score,note.id).event.midi,60);
 e.redo();assert.equal(model.findEvent(e.score,note.id).event.midi,62);
 const reopened=airscore.deserialize(airscore.serialize(e.score));
 assert.equal(sync.staffProjection(reopened).find(item=>item.eventId===note.id).midi,62);
});

test('Build 57 Sol-fa edits update the shared staff pitch in both directions',()=>{
 const e=create();const note=e.addNote({midi:60,start:0,duration:1,voice:1});
 sync.editSolfa(e,note.id,'m');
 const event=model.findEvent(e.score,note.id).event;
 assert.equal(event.midi,64);
 const report=sync.synchronization(e.score,{viewMode:'split'});
 assert.equal(report.valid,true);assert.equal(report.viewMode,'split');
 assert.match(report.projection.find(item=>item.eventId===note.id).syllable,/m/i);
});

test('Build 57 key changes, accidentals, octaves and rhythm marks are represented from canonical notes',()=>{
 const e=create();
 const a=e.addNote({pitch:'F#5',start:0,duration:1.5,voice:1});
 const b=e.addNote({pitch:'C3',start:2,duration:.5,voice:1});
 e.score.keySignatures=[{start:0,key:'G'}];
 const rows=sync.staffProjection(e.score);
 const first=rows.find(x=>x.eventId===a.id),second=rows.find(x=>x.eventId===b.id);
 assert.ok(first.syllable);assert.ok(first.rhythm);assert.ok(first.octaveMarks!==undefined);
 assert.ok(second.octaveMarks.length>0);assert.ok(second.rhythm);
});

test('Build 57 multiple lyric verses, hyphens, melismas and extenders persist atomically',()=>{
 const e=create();const a=e.addNote({midi:60,start:0,duration:1,voice:1});const b=e.addNote({midi:62,start:1,duration:1,voice:1});
 const before=e.history.undoStack.length;
 sync.applyLyricVerses(e,[a.id,b.id],[
  {verse:1,text:'Glo',syllabic:'begin',hyphenAfter:true},
  {verse:2,text:'A',syllabic:'single',melisma:true,extend:true}
 ]);
 assert.equal(e.history.undoStack.length,before+1);
 for(const id of [a.id,b.id]){
  const lyrics=model.findEvent(e.score,id).event.lyrics;
  assert.equal(lyrics.length,2);assert.equal(lyrics[0].syllabic,'begin');assert.equal(lyrics[1].extensionState,'extend');
 }
 e.undo();assert.equal(model.findEvent(e.score,a.id).event.lyrics.length,0);
 e.redo();assert.equal(model.findEvent(e.score,a.id).event.lyrics.length,2);
 const reopened=airscore.deserialize(airscore.serialize(e.score));
 assert.equal(model.findEvent(reopened,b.id).event.lyrics[1].melisma,true);
});

test('Build 57 lyrics synchronize with playback timeline and MusicXML/Sol-fa export',()=>{
 const e=create();const a=e.addNote({midi:60,start:0,duration:1,voice:1});const b=e.addNote({midi:62,start:1,duration:1,voice:1});
 sync.applyLyricVerses(e,[a.id],[{verse:1,text:'Sing',syllabic:'begin',hyphenAfter:true}]);
 sync.applyLyricVerses(e,[b.id],[{verse:1,text:'ing',syllabic:'end',extend:true}]);
 const timeline=sync.playbackLyricTimeline(e.score,{verse:1});
 assert.equal(timeline.find(item=>item.eventId===a.id).lyric,'Sing');
 assert.equal(timeline.find(item=>item.eventId===b.id).extend,true);
 const evidence=sync.exportEvidence(e.score);
 assert.equal(evidence.lyricCount,2);assert.equal(evidence.hasLyrics,true);assert.equal(evidence.hasSolfa,true);
 assert.match(evidence.musicXml,/Sing/);assert.match(evidence.solfa,/Verse 1/);
});

test('Build 57 interface provides synchronized view controls and shared-score status',()=>{
 const root=path.resolve(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'src/composer3/index.html'),'utf8');
 const controller=fs.readFileSync(path.join(root,'src/composer3/build57-staff-solfa-lyrics-controller.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'src/composer3/styles.css'),'utf8');
 assert.ok(html.includes('staff-solfa-lyrics-service.js'));assert.ok(html.includes('build57-staff-solfa-lyrics-controller.js'));
 for(const token of ['staffSolfaSyncControls','data-sync-view','Split synchronized','Shared semantic score','synchronized-split-view'])assert.ok(`${controller}${css}`.includes(token),token);
});
