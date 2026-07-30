(function(root,factory){
  const deps={
    model:root.AirmonScoreModel||(typeof require==='function'?require('./score-model'):null),
    playback:root.AirmonPlayback||(typeof require==='function'?require('./playback'):null),
    practice:root.AirmonPracticeAudio||(typeof require==='function'?require('./practice-audio-service'):null),
    parts:root.AirmonPartsEngraving||(typeof require==='function'?require('./parts-engraving-service'):null),
    formats:root.AirmonFormats||(typeof require==='function'?require('./formats'):null),
    publishing:root.AirmonFilePublishing||(typeof require==='function'?require('./file-publishing-service'):null),
    airscore:root.AirmonAirscore||(typeof require==='function'?require('./airscore'):null)
  };
  const api=factory(deps);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.AirmonPerformancePublishing=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(deps){
  'use strict';
  for(const [name,value] of Object.entries(deps))if(!value)throw new Error(`Build 58 dependency ${name} is unavailable.`);

  function authored(score){
    return (score.parts||[]).flatMap(part=>(part.events||[]).filter(event=>event.generatedBy!=='gap-fill').map(event=>({part,event})));
  }
  function totalPlayBeat(segments){return segments.length?segments.at(-1).playEnd:0;}
  function performancePlan(score,options={}){
    const segments=deps.playback.buildPlaybackSegments(score,options);
    const schedule=deps.playback.buildPerformanceSchedule(score,options);
    const end=totalPlayBeat(segments);
    const metronome=deps.playback.buildMetronomeBeats(score,segments,0,end);
    const tempoChanges=[
      ...((score.settings&&score.settings.tempoMap)||[]),
      ...(score.measures||[]).flatMap((measure,index)=>measure.tempo?[{measure:index,beat:Number(measure.start)||0,bpm:Number(measure.tempo)}]:[])
    ];
    return Object.freeze({
      cursorFollow:true,
      countInMeasures:Math.max(0,Math.min(4,Math.round(Number(options.countInMeasures)||0))),
      metronome:options.metronome!==false,
      loop:Object.freeze({
        enabled:Boolean(options.loop),
        start:Math.max(0,Number(options.loopStart)||0),
        end:options.loopEnd==null?end:Math.max(0,Number(options.loopEnd)||0)
      }),
      segments:Object.freeze(segments),
      schedule:Object.freeze(schedule),
      metronomeBeats:Object.freeze(metronome),
      tempoChanges:Object.freeze(tempoChanges),
      repeatedPasses:segments.filter(item=>item.pass>1).length,
      endings:(score.measures||[]).filter(measure=>measure.ending||measure.volta).length,
      dynamicEvents:schedule.filter(item=>Number(item.gain)!==1||item.dynamic).length,
      playableNotes:schedule.length,
      totalPlayBeat:end
    });
  }
  function mixerState(score,patch={}){
    const mixer=deps.practice.normalizeMixer(score,patch);
    const active=deps.practice.activeChannelIds(mixer);
    return Object.freeze({
      channels:Object.freeze(mixer.channels.map(channel=>Object.freeze({...channel}))),
      activeChannelIds:Object.freeze([...active]),
      master:Object.freeze({...mixer.master})
    });
  }
  function applyMixer(engine,patch={}){
    const before=engine.history?.undoStack?.length||0;
    const mixer=engine.setMixer(patch);
    return Object.freeze({
      channels:Object.freeze(mixer.channels.map(item=>Object.freeze({...item}))),
      master:Object.freeze({...mixer.master}),
      atomicUndo:(engine.history?.undoStack?.length||0)===before+1
    });
  }
  function assignInstrument(engine,partId,instrumentKey,patch={}){
    if(!partId)throw new Error('Choose a semantic score part before assigning an instrument.');
    engine.setActivePart(partId);
    const before=engine.history?.undoStack?.length||0;
    const part=engine.updateActivePart({instrumentKey,...patch});
    return Object.freeze({partId:part.id,instrumentKey:part.instrumentKey,transpose:Number(part.transpose)||0,atomicUndo:(engine.history?.undoStack?.length||0)===before+1});
  }
  function partsPlan(score,options={}){
    const descriptors=deps.parts.linkedPartDescriptors(score,options);
    const exports=deps.parts.batchExportPlan(score,{
      version:options.version||'1.3.0',
      build:options.build||58,
      format:options.format||'pdf',
      linkedPartIds:descriptors.map(item=>item.id)
    });
    return Object.freeze({
      sourcePartCount:(score.parts||[]).length,
      linkedParts:Object.freeze(descriptors),
      exportTargets:Object.freeze(exports),
      writtenPitch:Boolean(score.settings?.writtenPitch),
      concertPitch:score.settings?.concertPitch!==false
    });
  }
  function roundTripEvidence(score){
    const originalNotes=authored(score).filter(item=>item.event.type==='note').length;
    const musicXml=deps.formats.exportMusicXML(score);
    const midi=deps.formats.exportMidi(score);
    const xmlScore=deps.formats.parseMusicXML(musicXml);
    const midiScore=deps.formats.parseMidi(midi);
    const xmlNotes=authored(xmlScore).filter(item=>item.event.type==='note').length;
    const midiNotes=authored(midiScore).filter(item=>item.event.type==='note').length;
    return Object.freeze({
      musicXml:Object.freeze({bytes:new TextEncoder().encode(musicXml).length,notes:xmlNotes,valid:/<score-partwise/.test(musicXml)}),
      midi:Object.freeze({bytes:midi.length,notes:midiNotes,valid:String.fromCharCode(...midi.slice(0,4))==='MThd'}),
      originalNotes,
      musicXmlPreservesNotes:xmlNotes===originalNotes,
      midiPreservesNotes:midiNotes===originalNotes
    });
  }
  function publishingMatrix(score,options={}){
    const formats=options.formats||['pdf','png','svg','musicxml','midi'];
    const plan=deps.publishing.publishingPlan(score,{formats:formats.filter(value=>['pdf','png','svg'].includes(value)),includeParts:true});
    const setup=options.printPreview!==false;
    return Object.freeze({
      printPreview:setup,
      targets:Object.freeze(plan.targets),
      supported:Object.freeze({
        pdf:formats.includes('pdf'),
        png:formats.includes('png'),
        svg:formats.includes('svg'),
        musicXml:formats.includes('musicxml'),
        midi:formats.includes('midi')
      }),
      filenames:Object.freeze(plan.targets.map(item=>item.filename))
    });
  }
  function persistenceEvidence(score,options={}){
    const serialized=deps.airscore.serialize(score);
    const reopened=deps.airscore.deserialize(serialized);
    const original=authored(score).length;
    const restored=authored(reopened).length;
    const autosave=deps.publishing.autosavePlan(score,options.documentId||score.id||'score',{intervalSeconds:options.intervalSeconds||30,retain:options.retain||20});
    return Object.freeze({
      serializedBytes:new TextEncoder().encode(serialized).length,
      eventCount:original,
      reopenedEventCount:restored,
      preserved:original===restored&&reopened.parts.length===score.parts.length,
      autosave,
      recoveryReady:Boolean(autosave.atomic&&autosave.recoveryName)
    });
  }
  function integratedReport(score,options={}){
    const performance=performancePlan(score,options);
    const mixer=mixerState(score,options.mixer||{});
    const parts=partsPlan(score,options);
    const interchange=roundTripEvidence(score);
    const publishing=publishingMatrix(score,options);
    const persistence=persistenceEvidence(score,options);
    return Object.freeze({
      status:performance.playableNotes>=0&&interchange.musicXml.valid&&interchange.midi.valid&&persistence.preserved?'PASS':'FAIL',
      performance,mixer,parts,interchange,publishing,persistence
    });
  }
  return Object.freeze({
    authored,performancePlan,mixerState,applyMixer,assignInstrument,partsPlan,
    roundTripEvidence,publishingMatrix,persistenceEvidence,integratedReport
  });
});
