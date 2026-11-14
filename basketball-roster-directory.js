(() => {
 const form=el('seasonRosterPublic');
 const request={},loading={};
 const selection=side=>side==='season'
  ?{team:el('seasonTeam').value,season:el('seasonYear').value,program:el('seasonProgram').value,level:rosterLevel('season')}
  :{team:el(side).value,season:el(side+'Season').value,program:el(side+'Program').value,level:rosterLevel(side)};
 const signature=value=>JSON.stringify(value);
 let editingRequest=0,loadedKey='',staff=false;
 async function refreshEditor(){
  const token=++editingRequest,selected=selection('season'),owner=CloudLibrary.state().owner;
  loadedKey='';
  form.checked=false;
  form.disabled=true;
  el('seasonRosterPublicStatus').textContent='';
  if(!owner||!selected.team.trim()||!selected.season)return;
  try{
   const row=await SchoolDirectory.own(selected,owner);
   if(token!==editingRequest||owner!==CloudLibrary.state().owner)return;
   form.checked=!!row?.published;
   loadedKey=signature(selected);
   form.disabled=false;
   if(row?.official&&row.published)el('seasonRosterPublicStatus').textContent='Official · Verified by LLS';
  }catch{
   if(token===editingRequest)el('seasonRosterPublicStatus').textContent='Could not load sharing settings.';
  }
 }
 function isCurrent(key){return loadedKey===signature(selection('season'))&&key===rosterKeyFromSelection(selection('season'));}
 async function publishSaved({selected,published},players,owner){
  const roster=players.map(player=>[player.number,player.name,player.height,player.year].join(', ')).join('\n');
  const row=await SchoolDirectory.publish(selected,roster,published,owner);
  return published?' Published in the public roster directory.':row?' Removed from the public roster directory.':'';
 }
 async function suggest(side,force=false,search=false){
  const selected=selection(side),key=signature(selected);
  if(!force&&loading[side]===key)return;
  loading[side]=key;
  const token=(request[side]||0)+1;
  request[side]=token;
  const host=el(side+'SharedRosters');
  host.replaceChildren();
  host.hidden=true;
  if(!selected.team.trim()||!selected.season)return;
  try{
   let rows=await SchoolDirectory.browse(selected);
   if(!rows.length&&search)rows=await SchoolDirectory.browse(selected,{partial:true});
   if(token!==request[side]||key!==signature(selection(side)))return;
   if(!rows.length){
    if(force){host.textContent='No public roster found for this team, season, program and level.';host.hidden=false;}
    return;
   }
   const select=document.createElement('select');
   select.setAttribute('aria-label','Shared '+(side==='home'?'home':'visitor')+' roster');
   const date=new Intl.DateTimeFormat('en-US',{dateStyle:'medium'});
   for(const row of rows){
    const updated=new Date(row.updated_at);
    select.append(new Option((row.official?'Official':'Public')+' · '+row.team+' · '+row.player_count+' players'+
     (Number.isFinite(updated.getTime())?' · '+date.format(updated):''),row.id));
   }
   const use=document.createElement('button');
   use.type='button';
   const verify=document.createElement('button');
   verify.type='button';
   const status=document.createElement('p');
   status.className='small';
   status.setAttribute('role','status');
   const row=()=>rows.find(item=>item.id===select.value);
   function label(){
    use.textContent=row()?.official?'Use official roster':'Use public roster';
    verify.textContent=row()?.official?'Remove official badge':'Verify as official';
    verify.hidden=!staff;
   }
   select.onchange=label;
   select.value=rows[0].id;
   label();
   use.onclick=()=>{
    const roster=row();
    if(!roster||token!==request[side]||signature(selected)!==signature(selection(side)))return;
    const field=el(side+'Roster');
    if(field.value.trim()&&field.value!==roster.roster&&!confirm('Replace the roster for this game?'))return;
    field.value=roster.roster;
    startingLineupDrafts[side]=[];
    editGameRoster(side);
    gameRosterDrafts[side].sharedRosterId=roster.id;
    status.textContent=(roster.official?'Official':'Public')+' roster copied into this game.';
   };
   verify.onclick=async()=>{
    const roster=row();
    if(!roster)return;
    verify.disabled=true;
    try{await SchoolDirectory.verify('roster',roster.id,!roster.official);await suggest(side,true,search);}
    catch(error){status.textContent=error.message;verify.disabled=false;}
   };
   host.append(select,use,verify,status);
   host.hidden=false;
  }catch{
   if(token===request[side]){
    delete loading[side];
    if(force){host.textContent='Public roster lookup unavailable. Try again.';host.hidden=false;}
   }
  }
 }
 for(const field of ['seasonTeam','seasonProgram','seasonYear','seasonLevel'])el(field).addEventListener('change',refreshEditor);
 for(const side of ['home','away']){
  el(side+'FindRoster').onclick=()=>suggest(side,true,true);
 }
 CloudLibrary.subscribe(current=>{
  if(!rosterSaving||!current.owner)refreshEditor();
 });
 SchoolDirectory.isStaff().then(value=>{staff=value;for(const side of ['home','away'])suggest(side,true);});
 Live.client?.auth.onAuthStateChange(()=>setTimeout(async()=>{
  staff=await SchoolDirectory.isStaff();
  for(const side of ['home','away'])suggest(side,true);
 },0));
 window.BasketballRosterDirectory={
  refreshEditor,suggest,publishSaved,
  requested:key=>isCurrent(key)&&!form.disabled?{selected:selection('season'),published:form.checked}:null,
 };
})();
