'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const gallery = require('../src/core/template-gallery-service');
const model = require('../src/core/score-model');
const airscore = require('../src/core/airscore');

test('Build 52 searchable gallery contains every mandatory professional template', () => {
  const ids = new Set(gallery.catalogue().map(item => item.id));
  for (const id of ['piano','satb-two-staff','satb-four-staff','hymn-chorale','lead-sheet','melody-lyrics','tonic-solfa','staff-solfa','string-quartet','orchestra','concert-band','brass-band','guitar-tab','percussion','custom-ensemble']) {
    assert.ok(ids.has(id), `missing ${id}`);
  }
  assert.ok(gallery.search('choir').length >= 2);
  assert.equal(gallery.preview('staff-solfa').semantic, true);
});

test('Build 52 every built-in template creates a canonical semantic score', () => {
  for (const item of gallery.catalogue()) {
    const score = gallery.createSemanticScore({templateId:item.id,title:`Proof ${item.name}`,measures:4});
    assert.equal(score.format,'airscore');
    assert.equal(score.metadata.title,`Proof ${item.name}`);
    assert.equal(score.templateProvenance.semantic,true);
    assert.ok(score.parts.length > 0);
    assert.equal(model.validateScore(score).filter(issue=>issue.severity==='error').length,0,item.id);
  }
});

test('Build 52 setup applies metadata, key, meter, tempo, pickup and page layout', () => {
  const score=gallery.createSemanticScore({
    templateId:'staff-solfa',title:'Complete setup',subtitle:'Movement I',dedication:'For the choir',
    composer:'A. Composer',arranger:'B. Arranger',lyricist:'C. Writer',key:'Eb',
    timeSignature:'6/8',tempo:84,pickupBeats:1.5,measures:16,pageSize:'Letter',
    orientation:'landscape',staffSize:112,margins:18
  });
  assert.deepEqual(
    [score.metadata.title,score.metadata.subtitle,score.metadata.dedication,score.metadata.composer,score.metadata.arranger,score.metadata.lyricist],
    ['Complete setup','Movement I','For the choir','A. Composer','B. Arranger','C. Writer']
  );
  assert.equal(score.settings.key,'Eb'); assert.equal(score.settings.timeSignature,'6/8');
  assert.equal(score.settings.tempo,84); assert.equal(score.settings.pickupBeats,1.5);
  assert.equal(score.measures.length,16); assert.equal(score.settings.staffView,'split');
  assert.equal(score.settings.showSolfa,true); assert.equal(score.settings.orientation,'landscape');
});

test('Build 52 custom ensemble applies instruments, clefs, transposition and tablature semantically', () => {
  const score=gallery.createSemanticScore({
    templateId:'custom-ensemble',instruments:['clarinet','horn','guitar'],
    instrumentNames:['Clarinet in Bb','Horn in F','Guitar'],clefs:['treble','treble','treble-8'],
    transpositions:[2,7,0],tablature:true
  });
  assert.equal(score.parts.length,3);
  assert.deepEqual(score.parts.map(p=>p.transpose),[2,7,0]);
  assert.deepEqual(score.parts.map(p=>p.clef),['treble','treble','treble-8']);
  assert.equal(score.parts[0].tablature.linked,true);
});

test('Build 52 favourites, recents and user templates persist deterministically', () => {
  let library=gallery.createLibrary();
  library=gallery.toggleFavorite(library,'piano');
  library=gallery.recordRecent(library,'piano');
  const saved=gallery.saveUserTemplate(library,'My Winds',{templateId:'custom-ensemble',instruments:['flute','clarinet'],title:'Wind Duo'});
  library=gallery.createLibrary(JSON.parse(JSON.stringify(saved.library)));
  assert.deepEqual(library.favorites,['piano']);
  assert.deepEqual(library.recents,['piano']);
  assert.equal(library.userTemplates[0].name,'My Winds');
  const filtered=gallery.search('',{favorites:library.favorites,recents:library.recents});
  assert.equal(filtered[0].id,'piano');
});

test('Build 52 semantic template score survives save close and reopen', () => {
  const score=gallery.createSemanticScore({templateId:'string-quartet',title:'Persistent quartet',key:'D',timeSignature:'3/4'});
  const bytes=airscore.serialize(score);
  const reopened=airscore.deserialize(bytes);
  assert.equal(reopened.metadata.title,'Persistent quartet');
  assert.equal(reopened.parts.length,4);
  assert.equal(reopened.settings.key,'D');
  assert.equal(reopened.templateProvenance.id,'string-quartet');
  assert.equal(model.validateScore(reopened).filter(issue=>issue.severity==='error').length,0);
});

test('Build 52 interface contains a complete searchable New Score wizard', () => {
  const root=path.resolve(__dirname,'..');
  const html=fs.readFileSync(path.join(root,'src/composer3/index.html'),'utf8');
  const controller=fs.readFileSync(path.join(root,'src/composer3/build52-template-controller.js'),'utf8');
  for (const token of ['template-gallery-service.js','build52-template-controller.js']) assert.ok(html.includes(token));
  for (const token of ['templateGallerySearch','templateGalleryGrid','wizardTitle','wizardKey','wizardMeter','wizardTempo','wizardPickup','wizardInstruments','wizardTranspositions','wizardCreateScore','wizardSaveTemplate']) assert.ok(controller.includes(token),token);
  assert.ok(controller.includes("engine.replaceScore(score"));
});
