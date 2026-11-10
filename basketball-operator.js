/* The invited account operates graphics for one game. */
(async()=>{
 const get=id=>document.getElementById(id);
 const login=get('operatorLogin'),switchAccount=get('operatorSwitch'),controls=get('operatorControls'),status=get('operatorStatus');
 const params=new URLSearchParams(location.search),game=params.get('game')?.trim().toUpperCase();
 const demo=params.get('demo'),practice=/^(1|[a-f0-9-]{36})$/i.test(demo||'');
 let invite=new URLSearchParams(location.hash.slice(1)).get('invite'),account,epoch=0,stopWatching=null;
 let refreshInFlight=null,taking=false;
 if(!game||!(/^[A-Z0-9]{6}$/).test(game)||!Live.client){
  status.textContent='This graphics operator link is unavailable.';
  return;
 }
 get('operatorOverlay').href='overlay.html?'+(practice?'demo='+demo:'game='+encodeURIComponent(game));
 const auth=Live.client?.auth;
 const editor=get('featureEditor'),kindInput=get('featureKind'),rowsInput=get('featureRows');
 const preview=get('featurePreview'),notice=get('featureNotice');
 const drafts={upcoming:'',standings:''};
 let score,kind='intro',initialized=false;
 function previewFeature(){
  const fields={rows:rowsInput.value};
  for(const key of ['conference','logo','away','home','awayRecord','homeRecord'])fields[key]=editor.elements[key].value;
  try{
   const payload=BasketballFeature.create(kind,fields);
   BasketballFeature.render(preview,kind,payload,score);
   notice.textContent='';
   return payload;
  }catch(error){
   preview.replaceChildren();
   notice.textContent=error.message;
   return null;
  }
 }
 function changeFeature(){
  if(kind!=='intro')drafts[kind]=rowsInput.value;
  kind=kindInput.value;
  get('featureMatchup').hidden=kind!=='intro';
  get('featureTable').hidden=kind==='intro';
  get('featureSchedule').hidden=kind!=='upcoming'||practice;
  get('featureRowsLabel').textContent=kind==='standings'?'Standings in display order':'Upcoming games';
  get('featureFormat').textContent=kind==='standings'?'One line per team: Team | Conference record | Overall record':'One line per game: Matchup | Tip-off (include time zone)';
  rowsInput.value=drafts[kind]||'';
  previewFeature();
 }
 async function identifyMatch(){
  if(initialized)return;
  initialized=true;
  const generation=epoch;
  let teams;
  try{teams=(await Live.read(Live.viewer,'game_center_games',game))?.teams;}catch{}
  if(generation!==epoch)return;
  for(const side of ['away','home']){
   const input=editor.elements[side];
   if(!input.value)input.value=teams?.[side]?.name||score?.[side]||'';
  }
  const home=editor.elements.home.value;
  if(!editor.elements.conference.value)editor.elements.conference.value=teams?.home?.conference||Affiliations.defaults(home).conference||'';
  previewFeature();
 }
 editor.addEventListener('input',event=>{if(event.target!==kindInput)previewFeature();});
 kindInput.onchange=changeFeature;
 get('featureSchedule').onclick=async()=>{
  const button=get('featureSchedule'),before=rowsInput.value,conference=editor.elements.conference.value;
  button.disabled=true;
  try{
   const rows=await BasketballFeature.upcoming(Live.viewer,conference,game);
   if(kind!=='upcoming'||before!==rowsInput.value||conference!==editor.elements.conference.value)return;
   if(rows){rowsInput.value=rows;previewFeature();notice.textContent='Public schedule loaded. Check the program and tip-off times before airing.';}
   else notice.textContent='No upcoming public games for this conference. You can enter games above.';
  }catch(error){if(kind==='upcoming')notice.textContent=error.message;}
  finally{button.disabled=false;}
 };
 editor.onsubmit=event=>{
  event.preventDefault();
  const payload=previewFeature();
  if(payload)take(kind,payload);
 };
 changeFeature();
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
    if(permitted){
    get('operatorMatch').textContent=data.map(team=>team.name+' '+team.values[0]).join(' · ');
    identifyMatch();
   }
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
  initialized=false;
  const generation=++epoch;
  refreshInFlight=null;
  stopWatching?.();
  stopWatching=null;
  controls.hidden=true;
  login.hidden=!!next;
  switchAccount.hidden=!next;
  status.textContent=next?'Connecting to the game…':'Sign in to join as the broadcast operator.';
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
  if(!controls.hidden)status.textContent='Ready to send graphics to OBS.';
  stopWatching=Live.watch(game,row=>{
   if(row){
    const next={...Live.publicState(row),logos:row.logos};
    if(JSON.stringify([score?.logos,score?.colors])!==JSON.stringify([next.logos,next.colors])){score=next;previewFeature();}
    else score=next;
   }
   refresh();
  },()=>{});
 }
 async function take(screen,payload=null){
  if(controls.hidden||taking)return;
  const generation=epoch;
  taking=true;
  try{
   let data,error;
   if(practice){
    const graphic=screen==='comparison'?basketballGraphicChoices(score).comparison:{comparison:payload?[payload]:null};
    localStorage.setItem(basketballDemoStorage('graphic'),JSON.stringify({...graphic,kind:screen,position:'above',expires_at:new Date(Date.now()+12000).toISOString()}));
    data=true;
   }else if(screen==='comparison'){
    ({data,error}=await Live.client.rpc('take_basketball_operator_comparison',{game_code:game,show_graphic:true}));
   }else{
    ({data,error}=await Live.client.rpc('take_basketball_operator_screen',{game_code:game,screen_kind:screen,screen_data:payload}));
   }
   if(generation!==epoch)return;
   if(error)throw error;
   if(!data){
    controls.hidden=true;
    status.textContent='Operator access has ended. Ask the scorer for a new invite.';
    return;
   }
   const name=screen==='comparison'?'Team comparison':BasketballFeature.titles[screen];
   status.textContent=name?name+' sent for 12 seconds.':'Scorebug restored.';
  }catch{
   if(generation===epoch)status.textContent='Could not update the overlay. Reconnect and try again.';
  }finally{taking=false;}
 }
 get('operatorShow').onclick=()=>take('comparison');
 get('operatorClear').onclick=()=>take(null);
 if(practice){
  basketballDemoSession=demo;
  score=basketballDemoRead('game')||createBasketballDemo();
  controls.hidden=false;
  get('operatorMatch').textContent=score.away+' at '+score.home;
  editor.elements.away.value=score.away;
  editor.elements.home.value=score.home;
  editor.elements.conference.value='NIC-10 · Sample';
  editor.elements.awayRecord.value='11–5 overall · 6–2 conference';
  editor.elements.homeRecord.value='12–4 overall · 7–1 conference';
  drafts.upcoming='Guilford at Auburn | Friday · 7:00 PM CT\nJefferson at Harlem | Saturday · 6:30 PM CT';
  drafts.standings='Jefferson | 7–1 | 12–4\nGuilford | 6–2 | 11–5\nAuburn | 5–3 | 10–6';
  status.textContent='Test Game · Open the OBS preview in this browser.';
  window.addEventListener('storage',event=>{
   if(event.key!==basketballDemoStorage('game'))return;
   score=basketballDemoRead('game')||createBasketballDemo();
   previewFeature();
  });
  previewFeature();
  return;
 }
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

