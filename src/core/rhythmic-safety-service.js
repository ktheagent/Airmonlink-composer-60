(function(root,factory){
  const deps={
    model:root.AirmonScoreModel||(typeof require==='function'?require('./score-model'):null),
    staffInput:root.AirmonStaffInput||(typeof require==='function'?require('../composer3/staff-input-service'):null),
    theory:root.AirmonMusicTheory||(typeof require==='function'?require('./music-theory'):null)
  };
  const api=factory(deps);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.AirmonRhythmicSafety=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(deps){
  'use strict';
  if(!deps.model||!deps.staffInput)throw new Error('Rhythmic safety requires the canonical score and staff-input services.');
  const EPS=1e-8;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const stable=value=>JSON.stringify(value,(key,item)=>['modifiedAt','revision'].includes(key)?undefined:item);
  const clampVoice=value=>Math.max(1,Math.min(4,Number(value)||1));

  function authored(part){return(part?.events||[]).filter(event=>event.generatedBy!=='gap-fill'&&!event.hidden);}
  function laneKey(event,part){return`${clampVoice(event.voice)}:${part.clef==='grand'||part.clef==='multi'?(event.staff||'treble'):'single'}`;}
  function overlap(a,b){return a.start < b.start+b.duration-EPS && b.start < a.start+a.duration-EPS;}
  function laneConflicts(score){
    const conflicts=[];
    for(const part of score.parts||[]){
      const lanes=new Map();
      for(const event of authored(part)){
        const key=laneKey(event,part);if(!lanes.has(key))lanes.set(key,[]);lanes.get(key).push(event);
      }
      for(const [lane,events] of lanes){
        events.sort((a,b)=>a.start-b.start||a.duration-b.duration||String(a.id).localeCompare(String(b.id)));
        const active=[];
        for(const event of events){
          for(let i=active.length-1;i>=0;i-=1)if(active[i].start+active[i].duration<=event.start+EPS)active.splice(i,1);
          for(const prior of active){
            const sameChord=prior.type==='note'&&event.type==='note'&&Math.abs(prior.start-event.start)<EPS&&Math.abs(prior.duration-event.duration)<EPS;
            if(!sameChord&&overlap(prior,event))conflicts.push({partId:part.id,lane,eventId:event.id,otherId:prior.id,start:event.start,message:`${part.name}: overlapping events in voice ${event.voice||1}`});
          }
          active.push(event);
        }
      }
    }
    return conflicts;
  }
  function validateDraft(score){
    const modelIssues=deps.model.validateScore(score);
    const overlaps=laneConflicts(score).map(item=>({severity:'error',message:item.message,...item}));
    const issues=[...modelIssues,...overlaps];
    const errors=issues.filter(issue=>issue.severity==='error');
    if(errors.length){
      const error=new Error(humanize(errors[0].message));error.code='RHYTHMIC_INTEGRITY';error.issues=errors;throw error;
    }
    return issues;
  }
  function commit(engine,label,operation){
    if(!engine?.score||typeof engine.commit!=='function')throw new Error('Composer engine is unavailable.');
    const before=stable(engine.score);
    const draft=clone(engine.score);
    let result;
    try{result=operation(draft);deps.model.normalizeScore(draft);validateDraft(draft);}
    catch(error){
      if(stable(engine.score)!==before)throw new Error('A failed operation changed the live score.');
      error.userMessage=humanize(error);throw error;
    }
    return engine.commit(label,()=>{
      for(const key of Object.keys(engine.score))delete engine.score[key];
      Object.assign(engine.score,draft);
      const ids=Array.isArray(result?.eventIds)?result.eventIds:[result?.id].filter(Boolean);
      if(ids.length)engine.selection.selectEvents(ids);
      if(Number.isFinite(result?.cursor))engine.cursor=result.cursor;
      return result;
    });
  }
  function dottedDuration(base,dots=0){
    const duration=deps.staffInput.normalizeDuration(base);const count=Math.max(0,Math.min(2,Math.round(Number(dots)||0)));
    return count===0?duration:count===1?duration*1.5:duration*1.75;
  }
  function safeEntry(engine,input={}){
    const partId=String(input.partId||engine.activePartId||'');if(!partId)throw new Error('Choose an instrument before entering music.');
    const voice=clampVoice(input.voice||engine.activeVoice);const start=Math.max(0,Number(input.start??engine.cursor)||0);
    const duration=dottedDuration(input.duration||engine.duration,input.dots);const kind=input.kind==='rest'?'rest':'note';
    const mode=['insert','overwrite','chord'].includes(input.mode)?input.mode:'insert';const staff=input.staff??engine.activeStaff??null;
    return commit(engine,`${mode} ${kind}`,draft=>{
      deps.staffInput.ensureCapacity(deps.model,draft,start+duration);
      const part=draft.parts.find(item=>item.id===partId);if(!part)throw new Error('The selected instrument is unavailable.');
      const plan={type:kind,start,duration,voice,staff,midi:input.midi,pitch:input.pitch};
      const conflicts=authored(part).filter(event=>laneKey(event,part)===laneKey(plan,part)&&overlap(event,plan));
      if(mode==='insert'&&conflicts.length){
        const error=new Error('That rhythmic position is already occupied in this voice.');error.code='STAFF_INPUT_CONFLICT';error.targets=conflicts.map(e=>e.id);throw error;
      }
      if(mode==='chord'){
        if(kind==='rest')throw new Error('A rest cannot be added to a chord.');
        const target=conflicts.find(event=>event.type==='note'&&Math.abs(event.start-start)<EPS&&Math.abs(event.duration-duration)<EPS);
        if(!target)throw new Error('Chord mode needs an existing note at the same rhythmic position.');
        const duplicate=conflicts.find(event=>event.type==='note'&&(input.midi!=null?Number(event.midi)===Number(input.midi):String(event.pitch)===String(input.pitch)));
        if(duplicate){const error=new Error('That pitch already exists in the chord.');error.code='DUPLICATE_CHORD_PITCH';error.targets=[duplicate.id];throw error;}
      }else if(mode==='overwrite'&&conflicts.length){
        part.events=part.events.filter(event=>!conflicts.some(item=>item.id===event.id)&&event.generatedBy!=='gap-fill');
      }
      deps.model.regenerateAutoRests(draft,part);
      const segments=deps.staffInput.planSegments(deps.model,draft,start,duration);
      const created=[];
      for(let index=0;index<segments.length;index+=1){
        const segment=segments[index];const common={start:segment.start,duration:segment.duration,voice,staff,inputSource:input.inputSource||'rhythmic-safety',allowChord:mode==='chord'};
        const event=kind==='rest'?deps.model.addRest(draft,partId,common):deps.model.addNote(draft,partId,{...common,midi:input.midi,pitch:input.pitch,tieStop:index>0,tieStart:index<segments.length-1});
        created.push(event);
      }
      if(kind==='note')for(let i=1;i<created.length;i+=1)deps.model.addTie(draft,created[i-1].id,created[i].id,{generatedBy:'safe-cross-barline'});
      deps.model.regenerateAutoRests(draft,part);
      return{eventIds:created.map(e=>e.id),events:created,cursor:input.advance===false?start:start+duration,segments:segments.length,removedEventIds:conflicts.map(e=>e.id)};
    });
  }
  function setDottedDuration(engine,eventIds,base,dots){
    const ids=[...new Set((Array.isArray(eventIds)?eventIds:[eventIds]).map(String))];const duration=dottedDuration(base,dots);
    return commit(engine,'Set dotted duration',draft=>{
      const updated=[];
      for(const id of ids){
        const found=deps.model.findEvent(draft,id);if(!found)throw new Error('The selected note or rest no longer exists.');
        deps.model.updateEvent(draft,found.part.id,id,{duration});updated.push(id);
      }
      return{eventIds:updated,duration,cursor:engine.cursor};
    });
  }
  function chordPreview(score,partId,start,voice,midi){
    const part=score.parts.find(item=>item.id===partId);if(!part)return{valid:false,reason:'Choose an instrument.'};
    const targets=authored(part).filter(e=>e.type==='note'&&clampVoice(e.voice)===clampVoice(voice)&&Math.abs(e.start-Number(start))<EPS);
    const duplicate=targets.find(e=>Number(e.midi)===Number(midi));
    return{valid:targets.length>0&&!duplicate,targetIds:targets.map(e=>e.id),duplicateId:duplicate?.id||null,highlightIds:duplicate?[duplicate.id]:targets.map(e=>e.id),description:duplicate?'Pitch already in chord':targets.length?`Add to ${targets.length}-note target`:'No chord target at caret'};
  }
  function tiePreview(score,fromId,toId){
    const from=deps.model.findEvent(score,fromId);const to=deps.model.findEvent(score,toId);
    if(!from||!to)return{valid:false,reason:'Select two notes.'};
    if(from.part.id!==to.part.id)return{valid:false,reason:'Ties must stay in the same instrument.'};
    if(from.event.type!=='note'||to.event.type!=='note')return{valid:false,reason:'Ties connect notes, not rests.'};
    if(Number(from.event.midi)!==Number(to.event.midi))return{valid:false,reason:'A tie must connect the same sounding pitch.'};
    if(clampVoice(from.event.voice)!==clampVoice(to.event.voice))return{valid:false,reason:'A tie must remain in the same voice.'};
    if(Math.abs(from.event.start+from.event.duration-to.event.start)>EPS)return{valid:false,reason:'The destination note must immediately follow the source.'};
    return{valid:true,fromId:from.event.id,toId:to.event.id,description:`Tie ${from.event.pitch||from.event.midi} across the boundary`};
  }
  function targetPreview(kind,score,selection,input={}){
    const ids=(selection||[]).map(String);const found=ids.map(id=>deps.model.findEvent(score,id)).filter(Boolean);
    if(kind==='interval')return{kind,valid:found.some(x=>x.event.type==='note'),scope:`${found.filter(x=>x.event.type==='note').length} selected note(s)`,change:`Add ${Number(input.semitones)||0} semitones`,targetIds:ids};
    if(kind==='transpose')return{kind,valid:found.some(x=>x.event.type==='note'),scope:input.scope||'selection',change:`Transpose ${Number(input.semitones)||0} semitones`,targetIds:ids};
    if(kind==='chord')return chordPreview(score,input.partId,input.start,input.voice,input.midi);
    return{kind,valid:false,scope:'none',change:'No operation selected',targetIds:ids};
  }
  function humanize(value){
    const raw=String(value?.message||value||'The operation could not be completed.');
    const mappings=[
      [/overlapping events|already occupied/i,'That beat is already used in the active voice. Choose another beat, voice, or overwrite mode.'],
      [/duplicate.*chord|already exists in the chord/i,'That pitch is already present in the chord. The existing note is highlighted.'],
      [/outside the score|enough measures/i,'The note extends beyond the score. Add measures or choose a shorter duration.'],
      [/same sounding pitch|same pitch/i,'A tie can connect only adjacent notes with the same sounding pitch and voice.'],
      [/invariant|canonical|assert/i,'The edit was cancelled to protect the score. No music was changed.']
    ];
    for(const[pattern,message]of mappings)if(pattern.test(raw))return message;
    return raw.replace(/\b(?:invariant|canonical model)\b/gi,'score integrity').replace(/\s+/g,' ').trim();
  }
  class ErrorCoalescer{
    constructor(windowMs=2500){this.windowMs=Math.max(250,Number(windowMs)||2500);this.last=new Map();}
    record(error,now=Date.now()){
      const message=humanize(error);const key=String(error?.code||'ERROR')+'|'+message;const previous=this.last.get(key);
      const count=previous&&now-previous.at<=this.windowMs?previous.count+1:1;const record={key,message,count,at:now,announcement:count===1?message:`${message} (repeated ${count} times)`};
      this.last.set(key,record);return record;
    }
    clear(){this.last.clear();}
  }
  function notificationModel(error,coalescer=new ErrorCoalescer()){
    const item=coalescer.record(error);return{role:'alert',ariaLive:'assertive',placement:'bottom-status-area',coversScore:false,message:item.announcement,count:item.count,dismissible:true};
  }
  return Object.freeze({EPS,authored,laneKey,laneConflicts,validateDraft,commit,dottedDuration,safeEntry,setDottedDuration,chordPreview,tiePreview,targetPreview,humanize,ErrorCoalescer,notificationModel});
});