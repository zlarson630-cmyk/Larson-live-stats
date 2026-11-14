/* The primary scorer creates and revokes links through the normal game writer. */
(() => {
 const setup=el('basketballTagSetup'),mode=el('basketballTagMode'),share=el('basketballTagShare');
 const stop=el('basketballTagStop'),status=el('basketballTagStatus'),link=el('basketballTagLink');
 let shownGame,shownHash,saving=false;
 window.renderBasketballTagTeam=()=>{
  // This is a cloud-only feature. Practice games stay local.
  setup.hidden=!cloudMode||!canWrite()||gameLocked(state);
  const active=state?.tagTeam;
  if(shownGame!==id||shownHash!==active?.keyHash){
   link.value='';
   status.textContent='';
   shownGame=id;
   shownHash=active?.keyHash;
  }
  el('basketballTagLinkLabel').hidden=!link.value;
  if(active)mode.value=active.mode;
  mode.disabled=saving||!!active;
  stop.hidden=!active;
  stop.disabled=saving;
  share.disabled=saving;
  share.textContent=active?'Replace second-device link':'Create second-device link';
 };
 async function change(enabled){
  if(saving||!cloudMode||!canWrite()||gameLocked(state))return;
  if(wfDraft||wfBusy||wfSubmitting){
   status.textContent='Finish the current play before changing Tag Team.';
   return;
  }
  const gameCode=id,selected=state.tagTeam?.mode||mode.value;
  const currentHash=state.tagTeam?.keyHash;
  const token=enabled?crypto.randomUUID():null;
  saving=true;
  window.renderBasketballTagTeam();
  try{
   const hash=enabled?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),
    byte=>byte.toString(16).padStart(2,'0')).join(''):null;
   if(id!==gameCode)return;
   const saved=await write(game=>{
    if(game.tagTeam?.keyHash!==currentHash)throw Error('Tag Team changed on another device. Try again.');
    if(!enabled){delete game.tagTeam;return;}
    if(!wfIsFull(wfMode(game))){
     if(game.events.length||game.running||remaining(game)<basketballPeriodSeconds(game)||game.period>1)game.statCoveragePartial=true;
     game.minuteBaseline=wfElapsed(game);
     game.minuteLineups=Object.fromEntries(['home','away'].map(team=>[team,[...(basketballOnCourt(game,team)||[])]]));
    }
    game.scoringMode='full';
    game.shotChartEnabled=selected==='chart';
    game.tagTeam={mode:selected,keyHash:hash};
   });
   if(id!==gameCode)return;
   if(saved&&enabled){
    const url=new URL('basketball-tag-team.html',location.href);
    url.searchParams.set('game',gameCode);
    url.hash=token;
    link.value=url.href;
    status.textContent='Copy this link to the second device.';
    link.focus();
    link.select();
   }else status.textContent=saved?'Tag Team is off.':'Could not change Tag Team. Try again.';
  }catch{
   if(id===gameCode)status.textContent='Could not create the link. Reload and try again.';
  }finally{
   saving=false;
   if(id===gameCode)window.renderBasketballTagTeam();
  }
 }
 link.addEventListener('click',()=>link.select());
 share.addEventListener('click',()=>change(true));
 stop.addEventListener('click',()=>change(false));
})();
