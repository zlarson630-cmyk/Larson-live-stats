/* Overlay controls share a selected graphic with the OBS browser source. */
function basketballGraphicChoices(game){
 const scores=(game.events||[]).filter(e=>e.kind==='score'&&['home','away'].includes(e.team)&&Number(e.points)>0);
 const current=scores[0];
 let points=0,boundary;
 for(const e of scores){
  if(e.team!==current.team){boundary=e;break;}
  points+=Number(e.points);
 }
 const at=boundary?.period===game.period?boundary:(!boundary?scores.at(-1):null);
 const seconds=at?.period===game.period?at.time?.match(/^(\d+):([0-5]\d)$/):null;
 const elapsed=seconds?Number(seconds[1])*60+Number(seconds[2])-remaining(game):null;
 const duration=elapsed>0?Math.floor(elapsed/60)+':'+String(elapsed%60).padStart(2,'0'):null;
 const run=current&&{headline:points+'–0 scoring run',detail:SoccerBrand.name(game,current.team)+(duration?' · Last '+duration:'')};
 const {totals}=basketballBoxScore(game);
 const leaders=['home','away'].flatMap(t=>Object.entries(totals[t]).filter(([n,p])=>n!=='Unassigned'&&p.pts>0)
  .map(([n,p])=>({t,n,points:p.pts,name:(game.rosters?.[t]||[]).find(player=>String(player.number)===n)?.name})))
  .sort((a,b)=>b.points-a.points);
 const top=leaders[0];
 const leader=top&&{headline:(top.name?'#'+top.n+' '+top.name:'#'+top.n)+' · '+top.points+' PTS',
  detail:(leaders[1]?.points===top.points?'Co-leading scorer':'Leading scorer')+' · '+SoccerBrand.name(game,top.t)};
 return {run,leader};
}
function renderBasketballGraphics(){
 const panel=el('basketballGraphicControls');
 panel.hidden=!canWrite();
 if(panel.hidden)return;
 const choices=basketballGraphicChoices(state);
 el('basketballGraphicRun').disabled=!choices.run;
 el('basketballGraphicLeader').disabled=!choices.leader;
 el('basketballGraphicRunPreview').textContent=choices.run?[choices.run.headline,choices.run.detail].join(' · '):'No scoring run yet';
 el('basketballGraphicLeaderPreview').textContent=choices.leader?[choices.leader.headline,choices.leader.detail].join(' · '):'Assign a scorer to a made shot';
}
let basketballGraphicSending=false;
async function publishBasketballGraphic(kind){
 if(!state||!canWrite()||basketballGraphicSending)return;
 const selected=kind?basketballGraphicChoices(state)[kind]:null;
 if(kind&&!selected)return;
 const status=el('basketballGraphicStatus'),gameId=id;
 const graphic={game_id:gameId,position:el('basketballGraphicPosition').value,kind:kind||null,
  headline:selected?.headline.slice(0,120)??null,detail:selected?.detail.slice(0,180)??null,
  expires_at:new Date(Date.now()+12000).toISOString()};
 basketballGraphicSending=true;
 status.textContent=kind?'Sending graphic…':'Clearing graphic…';
 try{
  if(state.demo)basketballDemoSave('graphic',graphic);
  else{
   const {error}=await Live.client.from('basketball_broadcast_graphics').upsert(graphic,{onConflict:'game_id'});
   if(error)throw error;
  }
  if(id===gameId)status.textContent=kind?'Sent to the scorebug for 12 seconds.':'Graphic cleared.';
 }catch(error){
  console.error('Basketball broadcast graphic failed',error);
  if(id===gameId)status.textContent='Could not update the scorebug. Try again.';
 }finally{basketballGraphicSending=false;}
}
