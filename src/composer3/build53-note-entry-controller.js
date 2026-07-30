(() => {
  'use strict';
  const entry=window.AirmonProfessionalNoteEntry;
  if(!entry) throw new Error('Build 53 professional note-entry service is unavailable.');
  const state=entry.session({enabled:false,mode:'insert',kind:'note',duration:1,voice:1});
  state.octave=4; state.midiMode='step'; state.showGuide=false; state.showPiano=false;

  const notationPanel=document.querySelector('#panel-notation');
  const scorePages=document.querySelector('#staffPages');
  if(!notationPanel||!scorePages) throw new Error('Build 53 requires the canonical notation workspace.');

  const group=document.createElement('div');
  group.className='group direct-note-entry-controls';
  group.dataset.group='DIRECT PROFESSIONAL ENTRY';
  group.innerHTML=`
    <span>Direct professional entry</span>
    <button type="button" data-entry-action="toggle" aria-pressed="false">Direct entry: Off</button>
    <label>Mode<select data-entry-field="mode"><option value="insert">Insert</option><option value="overwrite">Overwrite</option><option value="chord">Chord</option></select></label>
    <label>Type<select data-entry-field="kind"><option value="note">Note</option><option value="rest">Rest</option></select></label>
    <label>Dots<select data-entry-field="dots"><option value="0">None</option><option value="1">Dot</option><option value="2">Double dot</option></select></label>
    <label>Accidental<select data-entry-field="accidental"><option value="">Key signature</option><option value="#">Sharp</option><option value="b">Flat</option><option value="n">Natural</option></select></label>
    <label>Octave<input data-entry-field="octave" type="number" min="0" max="8" value="4"></label>
    <label>MIDI mode<select data-entry-field="midiMode"><option value="step">Step time</option><option value="realtime">Real time</option></select></label>
    <button type="button" data-entry-action="guide" aria-expanded="false">Shortcuts</button>
    <button type="button" data-entry-action="piano" aria-expanded="false">Virtual piano</button>`;
  const first=notationPanel.querySelector('.group');
  if(first) first.after(group); else notationPanel.appendChild(group);

  const guide=document.createElement('aside');
  guide.id='entryShortcutGuide';guide.className='entry-shortcut-guide';guide.hidden=true;
  guide.setAttribute('aria-label','Direct note-entry shortcut guide');
  guide.innerHTML=`<strong>Entry shortcuts</strong><dl>${entry.shortcutGuide().map(item=>`<div><dt>${item.keys}</dt><dd>${item.action}</dd></div>`).join('')}</dl>`;
  document.querySelector('.workspace')?.appendChild(guide);

  const piano=document.createElement('section');
  piano.id='build53VirtualPiano';piano.className='build53-virtual-piano';piano.hidden=true;
  piano.setAttribute('aria-label','Dockable virtual piano');
  piano.innerHTML=`<header><strong>Virtual piano</strong><span>Uses active voice and cursor</span><button type="button" data-entry-action="piano-close" aria-label="Close virtual piano">×</button></header><div class="virtual-piano-keys">${Array.from({length:25},(_,index)=>{
    const midi=48+index;const black=[1,3,6,8,10].includes(midi%12);
    return `<button type="button" class="${black?'black':'white'}" data-piano-midi="${midi}" aria-label="MIDI note ${midi}">${black?'':'♪'}</button>`;
  }).join('')}</div>`;
  document.querySelector('.app-shell')?.appendChild(piano);

  let ghost=null;
  function composer(){return window.AirmonComposer3;}
  function applyUi(){
    group.querySelector('[data-entry-action="toggle"]').textContent=`Direct entry: ${state.enabled?'On':'Off'}`;
    group.querySelector('[data-entry-action="toggle"]').setAttribute('aria-pressed',String(state.enabled));
    document.body.classList.toggle('direct-note-entry-active',state.enabled);
    guide.hidden=!state.showGuide; piano.hidden=!state.showPiano;
    group.querySelector('[data-entry-action="guide"]').setAttribute('aria-expanded',String(state.showGuide));
    group.querySelector('[data-entry-action="piano"]').setAttribute('aria-expanded',String(state.showPiano));
    for(const node of group.querySelectorAll('[data-entry-field]')) if(node.dataset.entryField in state) node.value=String(state[node.dataset.entryField]);
  }
  function removeGhost(){ghost?.remove();ghost=null;}
  function geometry(event,hit){
    const svg=hit.closest('svg');if(!svg?.createSVGPoint||!svg.getScreenCTM()) return null;
    const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;
    const local=point.matrixTransform(svg.getScreenCTM().inverse());
    return {svg,x:local.x,y:local.y,left:Number(hit.dataset.staffLeft),right:Number(hit.dataset.staffRight),
      top:Number(hit.dataset.staffTop),lineSpacing:12,systemStart:Number(hit.dataset.systemStart),
      systemEnd:Number(hit.dataset.systemEnd),clef:hit.dataset.staffClef||'treble',
      partId:hit.dataset.partId,staff:hit.dataset.staffId||null};
  }
  function planFor(event,hit){
    const c=composer();if(!c?.engine)return null;
    const geo=geometry(event,hit);if(!geo)return null;
    const duration=Number(document.querySelector('#duration')?.value)||state.duration;
    return {geo,proof:entry.ghost(c.engine.score,{...geo,...state,duration,voice:c.engine.activeVoice})};
  }
  scorePages.addEventListener('pointermove',event=>{
    if(!state.enabled)return removeGhost();
    const hit=event.target.closest('[data-staff-hit-target]');if(!hit)return removeGhost();
    const plan=planFor(event,hit);if(!plan)return;
    removeGhost();
    const ns='http://www.w3.org/2000/svg';
    ghost=document.createElementNS(ns,'g');ghost.classList.add('direct-entry-ghost',`voice-${plan.proof.voice}`);
    ghost.dataset.voice=String(plan.proof.voice);ghost.setAttribute('pointer-events','none');
    const y=plan.geo.y;const x=plan.geo.x;
    if(plan.proof.kind==='rest'){
      const rect=document.createElementNS(ns,'rect');rect.setAttribute('x',String(x-6));rect.setAttribute('y',String(y-4));rect.setAttribute('width','12');rect.setAttribute('height','8');ghost.appendChild(rect);
    }else{
      const ellipse=document.createElementNS(ns,'ellipse');ellipse.setAttribute('cx',String(x));ellipse.setAttribute('cy',String(y));ellipse.setAttribute('rx','7');ellipse.setAttribute('ry','5');ghost.appendChild(ellipse);
    }
    const title=document.createElementNS(ns,'title');title.textContent=plan.proof.label;ghost.appendChild(title);
    plan.geo.svg.appendChild(ghost);
  });
  scorePages.addEventListener('pointerleave',removeGhost);
  scorePages.addEventListener('click',event=>{
    if(!state.enabled)return;
    const hit=event.target.closest('[data-staff-hit-target]');if(!hit)return;
    const plan=planFor(event,hit);if(!plan)return;
    event.preventDefault();event.stopImmediatePropagation();
    try{
      const c=composer();const duration=Number(document.querySelector('#duration')?.value)||state.duration;
      c.engine.setActivePart(plan.geo.partId);
      entry.apply(c.engine,{point:plan.geo,...state,duration,voice:c.engine.activeVoice});
      c.command('fitSelection');window.AirmonWorkspaceController?.keepEditingTargetVisible();
    }catch(error){window.AirmonRhythmicSafetyUi?.notify(error);}
  },true);

  group.addEventListener('change',event=>{
    const field=event.target.dataset.entryField;if(!field)return;
    state[field]=['dots','octave'].includes(field)?Number(event.target.value):event.target.value;
    if(field==='mode'&&state.mode==='chord')state.kind='note';
    applyUi();
  });
  document.addEventListener('click',event=>{
    const action=event.target.closest('[data-entry-action]')?.dataset.entryAction;
    if(!action)return;
    if(action==='toggle')state.enabled=!state.enabled;
    else if(action==='guide')state.showGuide=!state.showGuide;
    else if(action==='piano')state.showPiano=!state.showPiano;
    else if(action==='piano-close')state.showPiano=false;
    applyUi();
  });
  piano.addEventListener('click',event=>{
    const key=event.target.closest('[data-piano-midi]');if(!key)return;
    try{const c=composer();entry.apply(c.engine,{...state,midi:Number(key.dataset.pianoMidi),start:c.engine.cursor,voice:c.engine.activeVoice,inputSource:'virtual-piano'});}
    catch(error){window.AirmonRhythmicSafetyUi?.notify(error);}
  });
  document.addEventListener('keydown',event=>{
    if(!state.enabled||event.target.matches('input,textarea,select,[contenteditable="true"]'))return;
    const action=entry.keyboardAction(event.key,state);if(!action)return;
    if(action.type==='duration'){state.duration=action.value;const duration=document.querySelector('#duration');if(duration)duration.value=String(action.value);}
    else if(action.type==='voice'){state.voice=action.value;composer()?.engine.setActiveVoice(action.value);}
    else if(action.type==='dots')state.dots=action.value;
    else if(action.type==='kind')state.kind=action.value;
    else if(action.type==='cancel'){state.enabled=false;removeGhost();}
    else if(action.type==='pitch'){
      const accidental=state.accidental==='n'?'':state.accidental;
      try{entry.apply(composer().engine,{...state,pitch:`${action.letter}${accidental}${state.octave}`,start:composer().engine.cursor,voice:composer().engine.activeVoice,inputSource:'keyboard-entry'});}
      catch(error){window.AirmonRhythmicSafetyUi?.notify(error);}
    }
    event.preventDefault();applyUi();
  });
  window.addEventListener('airmonlink-workspace-reflow',()=>window.AirmonWorkspaceController?.keepEditingTargetVisible());
  applyUi();
  window.AirmonDirectNoteEntry=Object.freeze({state:()=>JSON.parse(JSON.stringify(state)),enable(value=true){state.enabled=Boolean(value);applyUi();},service:entry});
})();