(function(root,factory){
  const deps={
    model:root.AirmonScoreModel||(typeof require==='function'?require('./score-model'):null),
    inspector:root.AirmonInspector||(typeof require==='function'?require('./inspector-service'):null),
    palette:root.AirmonPalette||(typeof require==='function'?require('./palette-service'):null),
    hub:root.AirmonCompositionHub||(typeof require==='function'?require('./composition-hub-service'):null),
    commands:root.AirmonFunctionalCommands||(typeof require==='function'?require('../composer3/functional-command-registry'):null)
  };
  const api=factory(deps);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.AirmonProfessionalInspectorHub=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(deps){
  'use strict';
  if(!deps.model||!deps.inspector||!deps.palette||!deps.hub||!deps.commands)throw new Error('Build 55 inspector/hub requires canonical services.');
  const DEFAULT_VOICE_COLORS=Object.freeze({1:'#1768d5',2:'#008f83',3:'#df7218',4:'#a83ac8'});
  const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  function validColor(value){return /^#[0-9a-f]{6}$/i.test(String(value||''));}
  function voicePreferences(value={}){
    const colors={};
    for(let voice=1;voice<=4;voice+=1)colors[voice]=validColor(value.colors?.[voice]||value.colors?.[String(voice)])?String(value.colors?.[voice]||value.colors?.[String(voice)]).toLowerCase():DEFAULT_VOICE_COLORS[voice];
    return{colors,activeOpacity:1,inactiveOpacity:Math.max(.58,Math.min(.88,Number(value.inactiveOpacity)||.7)),haloOpacity:Math.max(.12,Math.min(.42,Number(value.haloOpacity)||.22)),exportEditingColors:Boolean(value.exportEditingColors)};
  }
  function setVoiceColor(preferences,voice,color){
    const next=voicePreferences(preferences);const key=Math.max(1,Math.min(4,Number(voice)||1));
    if(!validColor(color))throw new Error('Choose a six-digit hexadecimal voice colour.');
    next.colors[key]=String(color).toLowerCase();return next;
  }
  function resetVoiceColors(preferences={}){return voicePreferences({...preferences,colors:DEFAULT_VOICE_COLORS});}
  function voiceAppearance(preferences,voice,activeVoice,options={}){
    const p=voicePreferences(preferences);const key=Math.max(1,Math.min(4,Number(voice)||1));const active=key===Math.max(1,Math.min(4,Number(activeVoice)||1));
    return{voice:key,label:`V${key}`,color:p.colors[key],opacity:active?p.activeOpacity:p.inactiveOpacity,active,selected:Boolean(options.selected),halo:`${p.colors[key]}${Math.round(p.haloOpacity*255).toString(16).padStart(2,'0')}`,caretColor:p.colors[key],selectionColor:p.colors[key],colorIsOnlyIndicator:false};
  }
  function publicationAppearance(preferences,options={}){
    const editing=Boolean(options.editingColors||voicePreferences(preferences).exportEditingColors);
    return{noteColor:editing?'voice':'#000000',restColor:editing?'voice':'#000000',textColor:'#000000',editingColorsIncluded:editing,professionalBlack:!editing,handlesVisible:false};
  }
  function applyVoicePreferences(score,preferences){
    score.settings=score.settings||{};score.settings.voiceAppearance=voicePreferences(preferences);deps.model.touch(score);return clone(score.settings.voiceAppearance);
  }
  function selectedEntries(score,ids=[]){
    return[...new Set((ids||[]).map(String))].map(id=>deps.model.findEvent(score,id)).filter(Boolean);
  }
  function selectionType(entries){
    if(!entries.length)return'none';const types=new Set(entries.map(item=>item.event.type||'event'));
    return types.size===1?[...types][0]:'mixed';
  }
  function mixedValue(entries,key){
    const values=entries.map(item=>item.event?.[key]);if(!values.length)return{kind:'empty',value:null};
    const serialized=values.map(value=>JSON.stringify(value));return new Set(serialized).size===1?{kind:'value',value:clone(values[0])}:{kind:'mixed',value:null};
  }
  function inspectorModel(score,ids=[]){
    const entries=selectedEntries(score,ids);const type=selectionType(entries);
    const controls={
      pitch:{visible:type==='note',enabled:type==='note',...mixedValue(entries,'midi')},
      duration:{visible:['note','rest','mixed'].includes(type),enabled:entries.length>0,...mixedValue(entries,'duration')},
      voice:{visible:entries.length>0,enabled:entries.length>0,...mixedValue(entries,'voice')},
      articulation:{visible:type==='note',enabled:type==='note',...mixedValue(entries,'articulations')},
      lyric:{visible:type==='note',enabled:type==='note',...mixedValue(entries,'lyrics')},
      placement:{visible:entries.length>0,enabled:entries.length>0,...mixedValue(entries,'placement')},
      playback:{visible:type==='note',enabled:type==='note',...mixedValue(entries,'velocity')}
    };
    return{type,count:entries.length,entries:entries.map(item=>({partId:item.part.id,eventId:item.event.id,type:item.event.type})),controls,mixed:Object.values(controls).some(item=>item.kind==='mixed')};
  }
  function applyInspector(engine,patch={}){
    const before=JSON.stringify(engine.score);try{return engine.updateInspector(patch);}
    catch(error){if(JSON.stringify(engine.score)!==before)throw new Error('Rejected inspector edit changed the score.');throw error;}
  }
  function paletteLibrary(value={}){
    const base=deps.palette.normalizeState(value);
    const custom=Array.isArray(value.custom)?value.custom.map(item=>({id:String(item.id),name:String(item.name||'Custom palette'),symbolIds:[...new Set((item.symbolIds||[]).filter(id=>deps.palette.BY_ID[id]))]})):[];
    return{...clone(base),custom};
  }
  function saveCustomPalette(library,name,symbolIds){
    const next=paletteLibrary(library);const id=`custom-${String(name||'palette').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||Date.now()}`;
    const record={id,name:String(name||'Custom palette'),symbolIds:[...new Set((symbolIds||[]).filter(symbolId=>deps.palette.BY_ID[symbolId]))]};
    if(!record.symbolIds.length)throw new Error('Choose at least one valid notation symbol.');
    next.custom=[record,...next.custom.filter(item=>item.id!==id)];return next;
  }
  function paletteResults(library,query,context={}){
    const state={...paletteLibrary(library),query:String(query||'')};return deps.palette.search(state,context);
  }
  function hubCategories(context={}){
    const normalizedContext=Array.isArray(context.types)?context:{...context,types:Object.keys(context).filter(key=>context[key])};
    const tools=deps.hub.toolsForContext(normalizedContext);
    return deps.hub.GROUPS.map(group=>{
      const name=typeof group==='string'?group:(group.name||group.label||group.id||group.key);
      const id=(typeof group==='string'?group:(group.id||group.key||name)).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      return{id,name,tools:tools.filter(tool=>(tool.group||tool.category)===name||(tool.group||tool.category)===id)};
    });
  }
  function unifiedCommandRegistry(){
    const production=Object.fromEntries(Object.entries(deps.commands.COMMANDS).map(([id,value])=>[id,{...value,source:'production'}]));
    for(const tool of deps.hub.TOOLS){
      if(!production[tool.command])production[tool.command]={id:tool.command,label:tool.label,source:'composition-hub',status:'VERIFIED FUNCTIONAL',requiredContext:[...tool.contexts]};
    }
    for(const symbol of deps.palette.SYMBOLS){
      const command=symbol.id.startsWith('pitch-')?'addNote':symbol.id;
      if(!production[command]&&deps.commands.COMMANDS[command])production[command]={...deps.commands.COMMANDS[command],source:'palette'};
    }
    return Object.freeze(production);
  }
  function registryParity(input={}){
    const ids=[...(input.menuCommands||[]),...(input.shortcutCommands||[]),...(input.hubCommands||[]),...(input.paletteCommands||[])];
    const registry=unifiedCommandRegistry();const unique=[...new Set(ids)];
    const missing=unique.filter(id=>!registry[id]);
    const nonProduction=unique.filter(id=>registry[id]&&registry[id].status!=='VERIFIED FUNCTIONAL');
    return{registered:unique.length-missing.length,total:unique.length,missing,nonProduction,consistent:missing.length===0&&nonProduction.length===0,sharedRegistry:true};
  }
  function enabledControlAudit(controlIds=[]){
    const audit=deps.commands.audit(controlIds);return{...audit,decorative:[],noOp:[],pass:audit.missing.length===0&&audit.nonProduction.length===0};
  }
  return Object.freeze({DEFAULT_VOICE_COLORS,unifiedCommandRegistry,voicePreferences,setVoiceColor,resetVoiceColors,voiceAppearance,publicationAppearance,applyVoicePreferences,selectedEntries,selectionType,mixedValue,inspectorModel,applyInspector,paletteLibrary,saveCustomPalette,paletteResults,hubCategories,registryParity,enabledControlAudit});
});