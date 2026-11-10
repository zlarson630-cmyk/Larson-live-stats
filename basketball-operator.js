/* One game, one invited account, and team comparison controls only. */
(async()=>{
 const get=id=>document.getElementById(id);
 const login=get('operatorLogin'),switchAccount=get('operatorSwitch'),controls=get('operatorControls'),status=get('operatorStatus');
 const game=new URLSearchParams(location.search).get('game')?.trim().toUpperCase();
 let invite=new URLSearchParams(location.hash.slice(1)).get('invite'),account,epoch=0,stopWatching=null;
 let refreshInFlight=null,taking=false;
 if(!game||!(/^[A-Z0-9]{6}$/).test(game)||!Live.client){
  status.textContent='This graphics operator link is unavailable.';
  return;
 }
 get('operatorOverlay').href='overlay.html?game='+encodeURIComponent(game);
 const auth=Live.client.auth;
 function refresh(){
  if(refreshInFlight)return refreshInFlight;
  const generation=epoch;
  const task=(async()=>{
   try{
    const {data,error}=await Live.client.rpc('basketball_operator_comparison',{game_code:game});
    if(generation!==epoch)return;
    if(error)throw error;
    const permitted=Array.isArray(data)&&data.length===2;
    controls.hidden=!permitted;
    if(permitted)get('operatorMatch').textContent=data.map(team=>team.name+' '+team.values[0]).join(' · ');
    else status.textContent='Operator access is unavailable. Ask the scorer for a new invite.';
   }catch{
    if(generation===epoch)status.textContent='Could not refresh the game. Reconnect and try again.';
   }
  })();
  refreshInFlight=task;
  task.finally(()=>{if(refreshInFlight===task)refreshInFlight=null;});
  return task;
 }
 async function open(session){
  const next=session?.user?.id||null;
  if(next===account)return;
  account=next;
  const generation=++epoch;
  refreshInFlight=null;
  stopWatching?.();
  stopWatching=null;
  controls.hidden=true;
  login.hidden=!!next;
  switchAccount.hidden=!next;
  status.textContent=next?'Connecting to the game…':'Sign in to join as the comparison operator.';
  if(!next)return;
  if(invite){
   const {data,error}=await Live.client.rpc('claim_basketball_operator_invite',{game_code:game,code:invite});
   if(generation!==epoch)return;
   if(error||!data){
    status.textContent='This invite is unavailable or already claimed. Switch accounts or ask the scorer for a new link.';
    return;
   }
   invite=null;
   history.replaceState({},'',location.pathname+location.search);
  }
  await refresh();
  if(generation!==epoch)return;
  if(!controls.hidden)status.textContent='Ready to put the comparison on air.';
  stopWatching=Live.watch(game,refresh,()=>{});
 }
 async function take(show){
  if(controls.hidden||taking)return;
  const generation=epoch;
  taking=true;
  try{
   const {data,error}=await Live.client.rpc('take_basketball_operator_comparison',{game_code:game,show_graphic:show});
   if(generation!==epoch)return;
   if(error)throw error;
   if(!data){
    controls.hidden=true;
    status.textContent='Operator access has ended. Ask the scorer for a new invite.';
    return;
   }
   status.textContent=show?'Team comparison sent for 12 seconds.':'Team comparison cleared.';
  }catch{
   if(generation===epoch)status.textContent='Could not update the comparison. Reconnect and try again.';
  }finally{taking=false;}
 }
 get('operatorShow').onclick=()=>take(true);
 get('operatorClear').onclick=()=>take(false);
 login.addEventListener('submit',async event=>{
  event.preventDefault();
  const button=login.querySelector('button'),password=login.elements.password;
  button.disabled=true;
  try{
   const {data,error}=await auth.signInWithPassword({email:login.elements.email.value.trim(),password:password.value});
   if(error)throw error;
   await open(data.session);
  }catch(error){status.textContent=error.message;}
  finally{password.value='';button.disabled=false;}
 });
 switchAccount.onclick=async()=>{
  const {error}=await auth.signOut({scope:'local'});
  if(error)status.textContent=error.message;
  else await open(null);
 };
 auth.onAuthStateChange((_event,session)=>setTimeout(()=>{
  open(session).catch(()=>{status.textContent='Could not connect the graphics operator.';});
 },0));
})();
