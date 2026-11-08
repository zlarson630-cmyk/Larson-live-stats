let cloudMode=false,owner=false,ownerId=null,stopWatch=null,sessionEpoch=0,writeQueue=Promise.resolve(),pendingWrites=0;
const localHome=goHome,baseRender=render;
function syncStatus(message){const node=el('sync');if(!node)return;const text=String(message||'');const routine=/^(Connecting…|Signed in|Signed out|View publicly|Scorer · saved|Scorer · Live|Read only · Live)/.test(text);const alert=!routine&&!!text&&!/^(Scorer · |Read only · )?(Live · |Reconnecting)/.test(text);node.textContent=alert?text:'';node.classList.toggle('hide',!alert);if(alert&&id&&typeof scorerToast==='function')scorerToast(text,true);}
function canWrite(){return cloudMode&&owner;}
function gameLocked(game){return game?.libraryStatus==='completed'||game?.libraryStatus==='trash';}
function tickBasketballClock(){
 if(!state?.running)return;
 const value=stamp(state), broadcast=el('bc-clock');
 el('clock').textContent=value;
 if(broadcast)broadcast.textContent=value;
}
function updateAccess(){
  document.querySelectorAll('#score button,#events button,#clockButton,#bcClockButton,.gameTools button').forEach(b=>b.disabled=!canWrite()||gameLocked(state));
  if(!canWrite()||gameLocked(state))closePicker();
}
render=function(){baseRender();updateAccess();if(cloudMode)el('overlay').href='overlay.html?game='+id;else el('overlay').href='overlay.html?game='+id+'&local=1';};
function stopCloud(){sessionEpoch++;stopWatch?.();stopWatch=null;cloudMode=false;owner=false;ownerId=null;}
async function signIn(){
 try{if(!Live.client)throw Error('Cloud library unavailable');const {error}=await Live.client.auth.signInWithPassword({email:el('email').value.trim(),password:el('password').value});el('password').value='';if(error)throw error;syncStatus('Signed in');if(id&&cloudMode)await joinGame(id);}
 catch(e){syncStatus(e.message);}
}
async function signOut(){if(!Live.client)return;if(pendingWrites){alert('Wait for the current save to finish.');return;}await Live.client.auth.signOut();owner=false;closePicker();if(cloudMode&&id)await joinGame(id);syncStatus('Signed out · public viewing');}
joinGame=async function(code){
 if(pendingWrites){alert('Wait for the current save to finish.');return;}
 const next=String(code||'').trim().toUpperCase();
 if(!/^[A-Z0-9]{6}$/.test(next)){syncStatus('Enter a six-character game ID');return;}
 stopCloud();
 cloudMode=true; const epoch=sessionEpoch;syncStatus('Connecting…');
 try{
  let privateRow=null;
  if(Live.client){const {data,error}=await Live.client.auth.getSession();if(error)throw error;if(data.session)privateRow=await Live.read(Live.client,'live_games',next);}
  const row=await Live.read(Live.client,'live_scoreboards',next);
  if(epoch!==sessionEpoch)return;
  if(!row)throw Error('Game not found in your cloud account.');
  if(channel){channel.close();channel=null;}if(clockTimer)clearInterval(clockTimer);
  id=next;owner=!!privateRow;ownerId=privateRow?.owner_id||null;state=privateRow?.state||Live.publicState(row);
  history.replaceState({},'',location.pathname+'?game='+id);
  el('lobby').classList.add('hide');el('app').classList.remove('hide');render();
  clockTimer=setInterval(tickBasketballClock,250);
  stopWatch=Live.watch(id,async publicRow=>{
   if(epoch!==sessionEpoch||!publicRow||pendingWrites)return;
   if(owner){
    const before=state;
    try{
     const fresh=await Live.read(Live.client,'live_games',next);
     if(epoch!==sessionEpoch||pendingWrites||!owner||state!==before)return;
     if(fresh){
      if(fresh.state.version!=null&&fresh.state.version===state?.version)return;
      state=fresh.state;
     }else{owner=false;state=Live.publicState(publicRow);}
     render();
    }catch(e){if(epoch===sessionEpoch)syncStatus('Scorer refresh failed · retrying');}
   }
   else{state=Live.publicState(publicRow);render();}
  },message=>{if(epoch===sessionEpoch)syncStatus((owner?'Scorer · ':'Read only · ')+message);});
 }catch(e){if(epoch===sessionEpoch){owner=false;syncStatus(e.message);updateAccess();}}
};
goHome=function(event){if(pendingWrites){event?.preventDefault();alert('Wait for the current save to finish.');return false;}stopCloud();return localHome(event);};
reload=function(){};
write=function(fn){
 if(!cloudMode){syncStatus('Open a cloud game before scoring.');return Promise.resolve(false);}
 if(!owner){syncStatus('Read only · sign in as the game owner to score');return Promise.resolve(false);}if(gameLocked(state)){syncStatus('Game is final or trashed · move it to Active to edit');return Promise.resolve(false);}
 const game=id,epoch=sessionEpoch;pendingWrites++;
 const task=writeQueue.then(async()=>{
  if(epoch!==sessionEpoch) return false;
  try{
   for(let attempt=0;attempt<5;attempt++){
    const row=await Live.read(Live.client,'live_games',game);if(!row)throw Error('Scorer access expired. Sign in again.');
    if(gameLocked(row.state)){
     if(epoch===sessionEpoch){state=row.state;render();}
     syncStatus('Game is final or trashed · move it to Active to edit');
     return false;
    }
    const previousVersion=row.state.version;
    const next=structuredClone(row.state);fn(next);
    next.version=Math.max(Date.now(),Math.floor(Number(previousVersion)||0)+1);
    // Compare only the revision so rosters, logos and plays stay out of the URL.
    const update=Live.client.from('live_games').update({state:next}).eq('id',game);
    const guarded=previousVersion==null
      ?update.is('state->>version',null)
      :update.eq('state->version',JSON.stringify(previousVersion));
    const {data,error}=await guarded.select('state');
    if(error)throw error;
    if(data?.length){if(epoch===sessionEpoch){state=data[0].state;render();syncStatus('Scorer · saved');}return true;}
   }
   throw Error('Another scorer is busy. Try the action again.');
  }catch(e){syncStatus('Not saved: '+e.message+' · retry the action');return false;}
 }).finally(()=>pendingWrites--);
 writeQueue=task.catch(()=>{});return task;
};
// Session changes immediately remove scorer controls; RLS remains authoritative.
Live.client?.auth.onAuthStateChange((event,session)=>{el('authStatus').textContent=session?'Signed in as '+session.user.email:'View publicly or sign in to score';if(!session||(ownerId&&session.user.id!==ownerId)){owner=false;ownerId=null;if(cloudMode&&state){state={...state,events:[],rosters:{}};render();}updateAccess();}});
(async()=>{if(Live.client){const {data}=await Live.client.auth.getSession();el('authStatus').textContent=data.session?'Signed in as '+data.session.user.email:'View publicly or sign in to score';}const params=new URLSearchParams(location.search);el('localMode').checked=false;if(params.get('local')==='1')syncStatus('Older device game: use My Profile to import it to your account.');else if(params.get('game'))joinGame(params.get('game'));})();
