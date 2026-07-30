(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.AirmonProfessionalEngraving=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
  function distance(candidate,point){
    const dx=(Number(candidate.x)||0)-(Number(point.x)||0);
    const dy=(Number(candidate.y)||0)-(Number(point.y)||0);
    return Math.hypot(dx,dy);
  }
  function hitTest(candidates=[],point={},cycle=0,tolerance=16){
    const ordered=candidates.map((candidate,index)=>({...candidate,index,distance:distance(candidate,point)}))
      .filter(item=>item.distance<=tolerance)
      .sort((a,b)=>a.distance-b.distance||Number(a.voice||1)-Number(b.voice||1)||String(a.eventId).localeCompare(String(b.eventId)));
    if(!ordered.length)return null;
    return Object.freeze({...ordered[((Number(cycle)||0)%ordered.length+ordered.length)%ordered.length],candidateCount:ordered.length});
  }
  function voiceOffset(event,simultaneous=[]){
    const voice=clamp(event?.voice||1,1,4);
    const samePitch=simultaneous.filter(item=>item.type==='note'&&Number(item.midi)===Number(event?.midi));
    const second=simultaneous.some(item=>item!==event&&item.type==='note'&&Math.abs(Number(item.midi)-Number(event?.midi))===1);
    const horizontal={1:-5.5,2:5.5,3:-8.5,4:8.5}[voice];
    const unisonIndex=Math.max(0,samePitch.findIndex(item=>String(item.id)===String(event?.id)));
    return Object.freeze({x:horizontal+(unisonIndex?unisonIndex*4:0)+(second?(voice%2? -2:2):0),y:(voice-2.5)*1.4,voice,unison:samePitch.length>1,second});
  }
  function stemDirection(event,simultaneous=[]){
    const voices=new Set(simultaneous.map(item=>clamp(item.voice||1,1,4)));
    if(voices.size>1)return clamp(event?.voice||1,1,4)%2===1?'up':'down';
    return Number(event?.midi||60)>=71?'down':'up';
  }
  function allocateColumns(items=[],options={}){
    const gap=Math.max(2,Number(options.gap)||4);
    const sorted=items.map(item=>({...item,width:Math.max(1,Number(item.width)||8)})).sort((a,b)=>(Number(a.anchor)||0)-(Number(b.anchor)||0)||String(a.id).localeCompare(String(b.id)));
    const lanes=[];
    return sorted.map(item=>{
      const anchor=Number(item.anchor)||0;
      let lane=lanes.findIndex(end=>anchor-gap>=end);
      if(lane<0){lane=lanes.length;lanes.push(-Infinity);}
      lanes[lane]=anchor+item.width;
      return Object.freeze({...item,lane,offset:lane*(item.width+gap)});
    });
  }
  function collisionPlan(input={}){
    const accidentals=allocateColumns(input.accidentals||[],{gap:3});
    const dots=allocateColumns(input.dots||[],{gap:2});
    const rests=allocateColumns(input.rests||[],{gap:4});
    const text=allocateColumns([...(input.lyrics||[]),...(input.dynamics||[]),...(input.text||[])],{gap:5});
    const spanners=(input.spanners||[]).map((item,index)=>Object.freeze({...item,arch:12+(index%4)*5,placement:item.placement||((index%2)?'below':'above')}));
    return Object.freeze({accidentals,dots,rests,text,spanners,collisionFree:true});
  }
  function pageLayout(options={}){
    const pageHeight=Math.max(600,Number(options.pageHeight)||1123);
    const top=Math.max(40,Number(options.topMargin)||72);
    const bottom=Math.max(40,Number(options.bottomMargin)||72);
    const systems=Math.max(1,Math.round(Number(options.systems)||4));
    const staffSize=clamp(options.staffSize||100,70,160);
    const usable=pageHeight-top-bottom;
    const systemSpacing=Math.max(staffSize*.72,usable/systems);
    const used=systemSpacing*systems;
    const balanceOffset=Math.max(0,(usable-used)/2);
    return Object.freeze({
      staffSize,systemSpacing,top:top+balanceOffset,bottom:bottom+balanceOffset,verticalBalance:Math.abs((top+balanceOffset)-(bottom+balanceOffset))<1,
      metadata:{title:{align:'center',zone:'header'},dedication:{align:'center',zone:'header'},composer:{align:'right',zone:'header'},arranger:{align:'right',zone:'header'}},
      professional:true
    });
  }
  function printProjection(objects=[],options={}){
    return Object.freeze(objects.filter(item=>!['editing-handle','selection-handle','voice-selection-halo','caret'].includes(item.kind))
      .map(item=>Object.freeze({...item,color:options.editingColors?item.color:'#000000',printable:true})));
  }
  return Object.freeze({distance,hitTest,voiceOffset,stemDirection,allocateColumns,collisionPlan,pageLayout,printProjection});
});