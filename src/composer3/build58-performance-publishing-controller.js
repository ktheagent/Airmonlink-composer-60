(() => {
  'use strict';
  const api=window.AirmonPerformancePublishing;
  if(!api)throw new Error('Build 58 performance and publishing service is unavailable.');
  function composer(){return window.AirmonComposer3;}
  function report(){
    const engine=composer()?.engine;
    return engine?api.integratedReport(engine.score,{build:58,countInMeasures:1,metronome:true}):null;
  }
  function render(){
    const value=report();
    const output=document.querySelector('#build58PerformanceStatus');
    if(output&&value)output.textContent=`${value.performance.playableNotes} notes · ${value.mixer.channels.length} mixer channels · ${value.parts.linkedParts.length} linked parts · ${value.status}`;
    return value;
  }
  function install(){
    const playback=document.querySelector('#panel-playback');
    if(playback&&!document.querySelector('#build58PerformanceGroup')){
      const group=document.createElement('div');
      group.id='build58PerformanceGroup';
      group.className='group build58-performance-group';
      group.dataset.group='PERFORMANCE MIXER PARTS AND PUBLISHING';
      group.innerHTML='<span>Integrated performance</span><button type="button" id="build58RefreshPerformance">Verify transport and mixer</button><button type="button" id="build58GenerateParts">Generate semantic parts</button><button type="button" id="build58VerifyPublishing">Verify import/export</button><output id="build58PerformanceStatus" aria-live="polite">Preparing performance report…</output>';
      playback.appendChild(group);
      group.querySelector('#build58RefreshPerformance').addEventListener('click',render);
      group.querySelector('#build58GenerateParts').addEventListener('click',()=>{composer().engine.generateLinkedParts();render();});
      group.querySelector('#build58VerifyPublishing').addEventListener('click',()=>{const value=api.roundTripEvidence(composer().engine.score);document.querySelector('#build58PerformanceStatus').textContent=`MusicXML ${value.musicXmlPreservesNotes?'PASS':'FAIL'} · MIDI ${value.midiPreservesNotes?'PASS':'FAIL'}`;});
    }
  }
  window.addEventListener('load',()=>{install();const wait=()=>composer()?.engine?(composer().engine.onChange(render),render()):setTimeout(wait,20);wait();},{once:true});
  window.AirmonPerformancePublishingController=Object.freeze({report,render});
})();
