/* Shared soccer clock math for scorer, broadcaster, OBS and reports. */
window.SoccerClock=(()=>{
 const mode=s=>s.clockMode==='down'?'down':'up';
 const duration=s=>Number.isInteger(s.halfSeconds)&&s.halfSeconds>0?s.halfSeconds:2400;
 function seconds(s,now=Date.now()){
  const elapsed=s.running&&s.startedAt!=null?Math.max(0,Math.floor((now-s.startedAt)/1000)):0;
  return Math.max(0,Math.floor(Number(s.seconds)||0)+(mode(s)==='down'?-elapsed:elapsed));
 }
 const elapsed=s=>mode(s)==='down'?Math.max(0,duration(s)-seconds(s)):seconds(s);
 function eventElapsed(e,s){return Number.isFinite(e.elapsedTime)?e.elapsedTime:(e.clockMode||mode(s))==='down'?Math.max(0,(e.halfSeconds||duration(s))-e.time):e.time}
 const order=(events,s)=>events.slice().sort((a,b)=>a.period-b.period||eventElapsed(a,s)-eventElapsed(b,s));
 const timeLabel=(e,fmt)=>fmt(e.time)+(e.clockMode==='down'?' left':'');
 return {mode,duration,seconds,elapsed,eventElapsed,order,timeLabel};
})();
