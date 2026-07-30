(function (root, factory) {
  const dependencies = {
    model: root.AirmonScoreModel || (typeof require === 'function' ? require('./score-model') : null),
    theory: root.AirmonMusicTheory || (typeof require === 'function' ? require('./music-theory') : null),
    staffInput: root.AirmonStaffInput || (typeof require === 'function' ? require('../composer3/staff-input-service') : null)
  };
  const api = factory(dependencies);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AirmonProfessionalNoteEntry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';
  if (!deps.model || !deps.staffInput) throw new Error('Professional note entry requires score and staff-input services.');

  const DIATONIC = Object.freeze(['C','D','E','F','G','A','B']);
  const CLEF_BOTTOM = Object.freeze({
    treble: { letter:'E', octave:4 }, 'treble-8':{letter:'E',octave:3},
    bass:{letter:'G',octave:2}, alto:{letter:'F',octave:3}, tenor:{letter:'D',octave:3},
    percussion:{letter:'C',octave:4}, grand:{letter:'E',octave:4}
  });
  const DURATION_KEYS = Object.freeze({'1':4,'2':2,'3':1,'4':0.5,'5':0.25,'6':0.125,'7':0.0625});
  const clone = value => JSON.parse(JSON.stringify(value));

  function clampVoice(value){ return Math.max(1,Math.min(4,Number(value)||1)); }
  function session(input={}) {
    return {
      enabled: input.enabled !== false,
      mode: ['insert','overwrite','chord'].includes(input.mode) ? input.mode : 'insert',
      kind: input.kind === 'rest' ? 'rest' : 'note',
      duration: deps.staffInput.normalizeDuration(input.duration || 1),
      dots: Math.max(0,Math.min(2,Math.round(Number(input.dots)||0))),
      accidental: ['#','b','n'].includes(input.accidental) ? input.accidental : '',
      voice: clampVoice(input.voice),
      octaveShift: Math.max(-3,Math.min(3,Math.round(Number(input.octaveShift)||0))),
      articulation: String(input.articulation || ''),
      tie: Boolean(input.tie),
      slur: Boolean(input.slur),
      advance: input.advance !== false,
      inputSource: String(input.inputSource || 'direct-staff-entry')
    };
  }
  function effectiveDuration(state) {
    const base=deps.staffInput.normalizeDuration(state.duration);
    if (state.dots===1) return base*1.5;
    if (state.dots===2) return base*1.75;
    return base;
  }
  function diatonicIndex(letter,octave){ return Number(octave)*7+DIATONIC.indexOf(letter); }
  function pitchFromStaffPoint(options={}) {
    const top=Number(options.top)||0;
    const spacing=Math.max(4,Number(options.lineSpacing)||12);
    const y=Number(options.y)||top+spacing*4;
    const clef=String(options.clef||'treble');
    const bottom=CLEF_BOTTOM[clef]||CLEF_BOTTOM.treble;
    const bottomIndex=diatonicIndex(bottom.letter,bottom.octave);
    const steps=Math.round(((top+spacing*4)-y)/(spacing/2));
    const index=Math.max(0,Math.min(62,bottomIndex+steps));
    const letter=DIATONIC[((index%7)+7)%7];
    const octave=Math.floor(index/7);
    const accidental=options.accidental==='n'?'':(['#','b'].includes(options.accidental)?options.accidental:'');
    const pitch=`${letter}${accidental}${octave}`;
    const midi=deps.theory?.midiFromPitch ? deps.theory.midiFromPitch(pitch) : null;
    return {pitch,midi,letter,octave,staffStep:steps,clef};
  }
  function beatFromPointer(score, options={}) {
    const raw=deps.staffInput.beatFromStaffPoint(options);
    return deps.staffInput.snapBeat(deps.model,score,raw,effectiveDuration(session(options)));
  }
  function placement(score, options={}) {
    const state=session(options);
    const pitch=pitchFromStaffPoint({...options,accidental:state.accidental});
    const start=beatFromPointer(score,{...options,duration:effectiveDuration(state)});
    return {
      start,duration:effectiveDuration(state),voice:state.voice,staff:options.staff||null,
      partId:String(options.partId||''),kind:state.kind,mode:state.mode,pitch:pitch.pitch,midi:pitch.midi,
      dots:state.dots,articulation:state.articulation,tie:state.tie,slur:state.slur,advance:state.advance,
      inputSource:state.inputSource
    };
  }
  function ghost(score, options={}) {
    const plan=placement(score,options);
    const measureIndex=deps.model.measureIndexAt(score,plan.start);
    return {...plan,measureIndex,measureNumber:measureIndex+1,valid:true,colorVoice:plan.voice,
      label:plan.kind==='rest'?`Rest ${plan.duration}`:`${plan.pitch} · ${plan.duration} beats · V${plan.voice}`};
  }
  function conflicts(score, partId, plan) {
    const part=score.parts.find(item=>item.id===partId);
    if(!part) return [];
    return (part.events||[]).filter(event=>event.generatedBy!=='gap-fill' && !event.hidden)
      .filter(event=>(Number(event.voice)||1)===plan.voice && (event.staff||null)===(plan.staff||null))
      .filter(event=>event.start < plan.start+plan.duration-1e-8 && event.start+event.duration > plan.start+1e-8);
  }
  function apply(engine, input={}) {
    if(!engine?.score || typeof engine.commit!=='function') throw new Error('Composer engine is unavailable.');
    const state=session(input);
    const plan=input.point ? placement(engine.score,{...input,...input.point,...state}) : {
      start:Math.max(0,Number(input.start??engine.cursor)||0),duration:effectiveDuration(state),
      voice:state.voice,staff:input.staff??engine.activeStaff,partId:String(input.partId||engine.activePartId||''),
      kind:state.kind,mode:state.mode,midi:input.midi==null?null:Math.max(0,Math.min(127,Math.round(Number(input.midi)))),
      pitch:input.pitch?String(input.pitch):null,dots:state.dots,articulation:state.articulation,
      tie:state.tie,slur:state.slur,advance:state.advance,inputSource:state.inputSource
    };
    const partId=plan.partId||engine.activePartId;
    if(!partId) throw new Error('Choose an instrument before entering music.');
    if(engine.activePartId!==partId) engine.setActivePart(partId);
    if(engine.activeVoice!==plan.voice) engine.setActiveVoice(plan.voice);

    if(plan.mode==='insert' && plan.kind==='note') {
      const event=engine.addNote(plan);
      if(plan.articulation) { engine.selectEvent(event.id); engine.setArticulation(plan.articulation,true); }
      return event;
    }
    if(plan.mode==='insert' && plan.kind==='rest') return engine.addRest(plan);
    if(plan.mode==='chord') {
      if(plan.kind==='rest') throw new Error('Chord mode accepts notes, not rests.');
      const same=conflicts(engine.score,partId,plan).filter(event=>event.type==='note' && Math.abs(event.start-plan.start)<1e-8);
      const duplicate=same.find(event=>(plan.midi!=null?Number(event.midi)===plan.midi:String(event.pitch)===plan.pitch));
      if(duplicate) { const error=new Error('That pitch already exists in the chord.');error.code='DUPLICATE_CHORD_PITCH';throw error; }
      if(same.length) {
        engine.selectEvent(same[0].id);
        return engine.addChordTone({...plan,advance:plan.advance});
      }
      return engine.addNote({...plan,allowChord:true});
    }

    return engine.commit(plan.kind==='rest'?'Overwrite with rest':'Overwrite with note',()=>{
      const part=engine.score.parts.find(item=>item.id===partId);
      const removed=conflicts(engine.score,partId,plan);
      part.events=part.events.filter(event=>!removed.some(item=>item.id===event.id) && event.generatedBy!=='gap-fill');
      deps.model.regenerateAutoRests(engine.score,part);
      const segments=deps.staffInput.planSegments(deps.model,engine.score,plan.start,plan.duration);
      const created=segments.map((segment,index)=>plan.kind==='rest'
        ? deps.model.addRest(engine.score,partId,{...plan,start:segment.start,duration:segment.duration})
        : deps.model.addNote(engine.score,partId,{...plan,start:segment.start,duration:segment.duration,allowChord:false,tieStop:index>0,tieStart:index<segments.length-1}));
      if(plan.kind==='note') for(let i=1;i<created.length;i+=1) deps.model.addTie(engine.score,created[i-1].id,created[i].id,{generatedBy:'direct-entry-continuation'});
      engine.selection.selectEvents(created.map(event=>event.id));
      engine.cursor=plan.advance?plan.start+plan.duration:plan.start;
      engine.lastEntry={type:plan.kind,partId,eventIds:created.map(e=>e.id),start:plan.start,duration:plan.duration,voice:plan.voice,staff:plan.staff};
      return created[0];
    });
  }
  function keyboardAction(key, current={}) {
    const value=String(key);
    if(DURATION_KEYS[value]) return {type:'duration',value:DURATION_KEYS[value]};
    if(/^[a-gA-G]$/.test(value)) return {type:'pitch',letter:value.toUpperCase()};
    if(value.toLowerCase()==='r') return {type:'kind',value:'rest'};
    if(value.toLowerCase()==='n') return {type:'kind',value:'note'};
    if(value==='.') return {type:'dots',value:Math.min(2,(Number(current.dots)||0)+1)};
    if(value.toLowerCase()==='v') return {type:'voice',value:(clampVoice(current.voice)%4)+1};
    if(value==='Escape') return {type:'cancel'};
    return null;
  }
  function shortcutGuide() {
    return [
      {keys:'A–G',action:'Enter pitch at caret'}, {keys:'1–7',action:'Whole through sixty-fourth duration'},
      {keys:'R / N',action:'Rest / note'}, {keys:'.',action:'Dot or double-dot'}, {keys:'V',action:'Next voice'},
      {keys:'← →',action:'Move caret'}, {keys:'Enter',action:'Repeat last entry'}, {keys:'Esc',action:'Cancel direct entry'}
    ];
  }
  function midiAction(data,state={}) {
    const bytes=Array.from(data||[]); const status=bytes[0]&0xf0;
    if(status===0x90 && bytes[2]>0) return {type:'noteOn',midi:bytes[1],velocity:bytes[2],mode:state.mode||'step'};
    if(status===0x80 || (status===0x90 && bytes[2]===0)) return {type:'noteOff',midi:bytes[1],velocity:0,mode:state.mode||'step'};
    return {type:'ignored'};
  }
  return Object.freeze({session,effectiveDuration,pitchFromStaffPoint,beatFromPointer,placement,ghost,conflicts,apply,keyboardAction,shortcutGuide,midiAction,DURATION_KEYS});
});
