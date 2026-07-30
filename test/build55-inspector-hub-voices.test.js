'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const service=require('../src/core/professional-inspector-hub-service');
const engineApi=require('../src/composer3/engine-api');
const model=require('../src/core/score-model');
const airscore=require('../src/core/airscore');

const create=()=>engineApi.createEngine({template:'lead',measures:4,autoFillRests:true});

test('Build 55 voice colours have professional defaults, labels, safe fading and reset/customisation',()=>{
  const prefs=service.voicePreferences();
  assert.deepEqual(prefs.colors,{1:'#1768d5',2:'#008f83',3:'#df7218',4:'#a83ac8'});
  for(let voice=1;voice<=4;voice+=1){
    const active=service.voiceAppearance(prefs,voice,voice,{selected:true});
    assert.equal(active.label,`V${voice}`);assert.equal(active.opacity,1);assert.equal(active.colorIsOnlyIndicator,false);
    assert.match(active.halo,/^#[0-9a-f]{8}$/i);
  }
  const custom=service.setVoiceColor(prefs,2,'#123abc');
  assert.equal(custom.colors[2],'#123abc');
  assert.ok(service.voiceAppearance(custom,1,2).opacity>=.58);
  assert.deepEqual(service.resetVoiceColors(custom).colors,prefs.colors);
});

test('Build 55 publication defaults to black and only includes editing colours by explicit choice',()=>{
  const prefs=service.voicePreferences();
  const normal=service.publicationAppearance(prefs);
  assert.equal(normal.professionalBlack,true);assert.equal(normal.noteColor,'#000000');assert.equal(normal.handlesVisible,false);
  const explicit=service.publicationAppearance(prefs,{editingColors:true});
  assert.equal(explicit.editingColorsIncluded,true);assert.equal(explicit.noteColor,'voice');
});

test('Build 55 contextual inspector exposes selection type, mixed values and semantic controls',()=>{
  const engine=create();
  const a=engine.addNote({midi:60,start:0,duration:1,voice:1});
  const b=engine.addNote({midi:64,start:1,duration:.5,voice:2});
  engine.selectEvent(a.id);
  let view=service.inspectorModel(engine.score,[a.id]);
  assert.equal(view.type,'note');assert.equal(view.controls.pitch.visible,true);assert.equal(view.controls.voice.value,1);
  view=service.inspectorModel(engine.score,[a.id,b.id]);
  assert.equal(view.type,'note');assert.equal(view.mixed,true);assert.equal(view.controls.duration.kind,'mixed');
  assert.equal(view.controls.pitch.enabled,true);
});

test('Build 55 inspector changes are semantic, atomic, undoable and persistent',()=>{
  const engine=create();
  const note=engine.addNote({midi:60,start:0,duration:1,voice:1});
  engine.selectEvent(note.id);
  const before=engine.history.undoStack.length;
  service.applyInspector(engine,{pitch:67,voice:3,placement:'above',playback:{velocity:93}});
  let event=model.findEvent(engine.score,note.id).event;
  assert.equal(event.midi,67);assert.equal(event.voice,3);assert.equal(event.placement,'above');assert.equal(event.velocity,93);
  assert.equal(engine.history.undoStack.length,before+1);
  engine.undo();event=model.findEvent(engine.score,note.id).event;assert.equal(event.midi,60);
  engine.redo();event=model.findEvent(engine.score,note.id).event;assert.equal(event.midi,67);
  const reopened=airscore.deserialize(airscore.serialize(engine.score));
  event=model.findEvent(reopened,note.id).event;assert.equal(event.voice,3);assert.equal(event.velocity,93);
  engine.selectEvent(note.id);
  const snapshot=JSON.stringify(engine.score);
  assert.throws(()=>service.applyInspector(engine,{pitch:200}),/Pitch/);
  assert.equal(JSON.stringify(engine.score),snapshot);
});

test('Build 55 palette supports search, favourites, recents and user custom palettes',()=>{
  let library=service.paletteLibrary({favorites:['staccato'],recent:['tie']});
  const results=service.paletteResults(library,'stac',{note:true});
  assert.equal(results[0].id,'staccato');assert.equal(results[0].favorite,true);
  library=service.saveCustomPalette(library,'Choir marks',['staccato','accent','fermata']);
  assert.equal(library.custom[0].name,'Choir marks');assert.deepEqual(library.custom[0].symbolIds,['staccato','accent','fermata']);
  assert.throws(()=>service.saveCustomPalette(library,'Empty',[]),/at least one/);
});

test('Build 55 Composition Hub categories and shared command registry are functional',()=>{
  const categories=service.hubCategories({score:true,staff:true,notes:true,melody:true,chords:true,lyrics:true});
  assert.deepEqual(categories.map(x=>x.name),['Create','Harmony','Arrange','Transform','Analyse','Lyrics and Choir','Playback and Practice','Publish']);
  assert.ok(categories.some(category=>category.tools.length>0));
  const commands=categories.flatMap(category=>category.tools.map(tool=>tool.command));
  const parity=service.registryParity({hubCommands:commands,menuCommands:['addNote'],shortcutCommands:['transpose'],paletteCommands:['accent']});
  assert.equal(parity.consistent,true);assert.equal(parity.sharedRegistry,true);
  const audit=service.enabledControlAudit(['addNote','printPreview','accent']);
  assert.equal(audit.pass,true);assert.deepEqual(audit.decorative,[]);assert.deepEqual(audit.noOp,[]);
});

test('Build 55 interface renders voice identity, contextual inspector, custom palettes and non-printing editing marks',()=>{
  const root=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'src/composer3/index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'src/composer3/app.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'src/composer3/styles.css'),'utf8');
  const controller=fs.readFileSync(path.join(root,'src/composer3/build55-inspector-hub-controller.js'),'utf8');
  for(const token of ['professional-inspector-hub-service.js','build55-inspector-hub-controller.js'])assert.ok(html.includes(token));
  for(const token of ['voice-selection-halo','data-active-voice','customPaletteCard','contextual-inspector-status','restoreVoiceColors'])assert.ok(`${app}${css}${controller}`.includes(token),token);
  for(const color of ['#1768d5','#008f83','#df7218','#a83ac8'])assert.ok(`${css}${controller}`.includes(color),color);
  assert.match(css,/body:not\(\.export-editing-colors\)[\s\S]*#000!important/);
  assert.match(css,/voice-selection-halo[\s\S]*display:none!important/);
});
