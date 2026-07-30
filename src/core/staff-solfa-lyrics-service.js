(function(root,factory){
  const deps={
    model:root.AirmonScoreModel||(typeof require==='function'?require('./score-model'):null),
    solfa:root.AirmonSolfa||(typeof require==='function'?require('./solfa'):null),
    choir:root.AirmonChoirSolfa||(typeof require==='function'?require('./choir-solfa-service'):null),
    lyrics:root.AirmonLyrics||(typeof require==='function'?require('./lyrics'):null),
    formats:root.AirmonFormats||(typeof require==='function'?require('./formats'):null),
    playback:root.AirmonPlayback||(typeof require==='function'?require('./playback'):null)
  };
  const api=factory(deps);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.AirmonStaffSolfaLyrics=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(deps){
  'use strict';
  if(!deps.model||!deps.solfa||!deps.choir||!deps.lyrics||!deps.formats||!deps.playback)throw new Error('Build 57 Staff/Sol-fa/lyrics dependencies are unavailable.');
  const VIEW_MODES=Object.freeze(['staff','solfa','split']);
  function viewMode(value){const mode=String(value||'staff').toLowerCase();return VIEW_MODES.includes(mode)?mode:'staff';}
  function staffProjection(score,options={}){
    const rows=[];
    for(const part of score.parts)for(const event of part.events||[]){
      if(event.hidden||event.generatedBy==='gap-fill')continue;
      const solfa=deps.solfa.eventToSolfa(event,score,part,options);
      rows.push(Object.freeze({partId:part.id,eventId:event.id,type:event.type,start:event.start,duration:event.duration,voice:event.voice||1,staff:event.staff||null,midi:event.midi??null,solfa:solfa.text,syllable:solfa.syllable,octaveMarks:solfa.octaveMarks,rhythm:deps.solfa.rhythmMark(event.duration),lyrics:Object.freeze([...(event.lyrics||[])]),valid:solfa.valid!==false}));
    }
    return Object.freeze(rows);
  }
  function editSolfa(engine,eventId,syllable,options={}){
    const found=deps.model.findEvent(engine.score,eventId);if(!found)throw new Error('Select an existing note before editing Sol-fa.');
    return engine.commit('Edit synchronized tonic sol-fa',()=>deps.solfa.updateEventFromSolfa(engine.score,found.part.id,eventId,syllable,options));
  }
  function editStaffPitch(engine,eventId,midi){
    const found=deps.model.findEvent(engine.score,eventId);if(!found||found.event.type!=='note')throw new Error('Select an existing note before editing staff pitch.');
    return engine.commit('Edit synchronized staff pitch',()=>deps.model.updateEvent(engine.score,found.part.id,eventId,{midi:Number(midi),writtenPitch:null}));
  }
  function applyLyricVerses(engine,eventIds,verses=[]){
    const ids=[...new Set((eventIds||[]).map(String))];if(!ids.length)throw new Error('Select one or more notes before entering lyrics.');
    return engine.commit('Edit synchronized lyric verses',()=>{
      let changed=0;
      for(const id of ids){
        const found=deps.model.findEvent(engine.score,id);if(!found||found.event.type!=='note')continue;
        for(const verse of verses){
          deps.model.setLyric(engine.score,found.part.id,id,String(verse.text||''),{
            verse:Math.max(1,Number(verse.verse)||1),lineType:verse.lineType||'verse',syllabic:verse.syllabic||'single',
            melisma:Boolean(verse.melisma||verse.extend),extensionState:(verse.extend||verse.melisma)?'extend':'none',
            hyphenState:verse.hyphenAfter?'after':(['begin','middle'].includes(verse.syllabic)?'after':'none')
          });changed+=1;
        }
      }
      return changed;
    });
  }
  function synchronization(score,options={}){
    const projection=staffProjection(score,options);const audit=deps.choir.verifySynchronization(score);
    return Object.freeze({valid:audit.valid&&projection.every(row=>row.valid),viewMode:viewMode(options.viewMode),projection,audit});
  }
  function playbackLyricTimeline(score,options={}){
    const notes=deps.playback.buildPlaybackNotes(score,options);
    return Object.freeze(notes.map(note=>{
      const event=note.event||note;
      const found=deps.model.findEvent(score,event.id);
      const lyric=(found?.event.lyrics||[]).find(item=>Number(item.verse)===(Number(options.verse)||1))||(found?.event.lyrics||[])[0]||null;
      return Object.freeze({eventId:event.id,start:event.start,duration:event.duration,midi:event.midi,lyric:lyric?.text||'',syllabic:lyric?.syllabic||'',extend:Boolean(lyric?.extensionState==='extend'||lyric?.melisma)});
    }));
  }
  function exportEvidence(score){
    const xml=deps.formats.exportMusicXML(score);
    const solfa=deps.solfa.scoreToSolfaText(score);
    const lyricCount=deps.lyrics.lyricCount(score);
    return Object.freeze({musicXml:xml,solfa,lyricCount,hasLyrics:lyricCount>0&&/<lyric\b/.test(xml),hasSolfa:solfa.trim().length>0});
  }
  return Object.freeze({VIEW_MODES,viewMode,staffProjection,editSolfa,editStaffPitch,applyLyricVerses,synchronization,playbackLyricTimeline,exportEvidence});
});