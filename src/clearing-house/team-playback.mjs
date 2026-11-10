export const HANDOFF_DURATION=6800;

/** Presentation time is deliberately separate from financial/event time. */
export function createTeamPlayback({length=0,duration=HANDOFF_DURATION}={}){
 let time=0,playing=false,direction=1,last=null;
 const max=()=>Math.max(0,length*duration);
 const snapshot=()=>({time,playing,direction,length,duration,finished:time>=max(),...teamPlaybackPose(time,length,duration)});
 return {
  read:snapshot,
  suspend(){last=null;return snapshot();},
  configure(next){length=next.length??length;time=Math.min(time,max());last=null;return snapshot();},
  play(value=1){direction=value<0?-1:1;if(direction>0&&time>=max())time=0;if(direction<0&&time<=0){playing=false;last=null;return snapshot();}playing=length>0;last=null;return snapshot();},
  pause(){playing=false;last=null;return snapshot();},
  seek(value){time=Math.max(0,Math.min(max(),value));last=null;return snapshot();},
  reset(nextLength=length){length=nextLength;time=0;playing=false;direction=1;last=null;return snapshot();},
  tick(now,visible=true){if(!playing||!visible){last=null;return snapshot();}if(last!==null){time=Math.max(0,Math.min(max(),time+Math.max(0,Math.min(100,now-last))*direction));if(time===0&&direction<0||time===max()&&direction>0)playing=false;}last=now;return snapshot();},
 };
}

export function teamPlaybackPose(time,length,duration=HANDOFF_DURATION){
 if(!length)return {index:0,progress:0,completed:0};
 const bounded=Math.max(0,Math.min(length*duration,time));
 return {index:Math.min(length-1,Math.floor(bounded/duration)),progress:bounded===length*duration?1:(bounded%duration)/duration,completed:Math.min(length,Math.floor(bounded/duration))};
}
