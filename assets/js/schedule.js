'use strict';
(function(){'use strict';const key='lls-schedule-drafts-v1',el=id=>document.getElementById(id),cloud=window.Live?.client;let user=null,cloudRows=[],accountGeneration=0;
function scorerLink(game){
 if(game.sport==='volleyball')return 'volleyball.html?'+new URLSearchParams({home:game.home,away:game.away});
 if(game.sport==='soccer')return 'soccer.html';
 if(game.sport==='basketball')return 'basketball-home.html';
 return null;
}
let games=[];try{const value=JSON.parse(localStorage.getItem(key));if(Array.isArray(value))games=value.filter(g=>g&&typeof g==='object').slice(0,500);}catch(e){}function save(){try{localStorage.setItem(key,JSON.stringify(games));return true;}catch(e){el('message').textContent='Unable to save in this browser.';return false;}}function render(){const target=el('games');target.replaceChildren();if(!games.length){const p=document.createElement('p');p.textContent='No scheduled games in this browser yet.';target.append(p);return;}games.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach(g=>{const div=document.createElement('div');div.className='game';const sport=document.createElement('small');sport.textContent=g.sport.toUpperCase()+' · '+(g.level||'Unspecified level');const name=document.createElement('strong');name.textContent=g.home+' vs. '+g.away;const details=document.createElement('small');const d=new Date(g.date);details.textContent=(Number.isNaN(d.getTime())?g.date:d.toLocaleString())+(g.venue?' · '+g.venue:'');const actions=document.createElement('div');actions.className='actions';const scorer=scorerLink(g);if(scorer){const start=document.createElement('button');start.textContent='Open scorer';start.addEventListener('click',()=>{location.href=scorer;});actions.append(start);}const remove=document.createElement('button');remove.className='secondary';remove.textContent='Delete draft';remove.addEventListener('click',()=>{if(!confirm('Delete this scheduled game draft?'))return;games=games.filter(x=>x.id!==g.id);save();render();});actions.append(remove);div.append(sport,name,details,actions);target.append(div);});}async function loadCloud(){if(!cloud||!user){el('cloudStatus').textContent='Sign in to load your private cloud schedule.';return;}const token=accountGeneration,owner=user.id;el('cloudStatus').textContent='Loading private cloud schedule…';const {data,error}=await cloud.from('scheduled_games').select('id,sport,home,away,level,venue,scheduled_at').eq('owner_id',owner).order('scheduled_at',{ascending:true}).limit(500);if(token!==accountGeneration)return;if(error){el('cloudStatus').textContent='Cloud load failed: '+error.message;return;}cloudRows=data||[];renderCloud();el('cloudStatus').textContent='Loaded '+cloudRows.length+' private cloud games.';}
function renderCloud(){const target=el('cloudGames');target.replaceChildren();for(const g of cloudRows){const item=document.createElement('div');item.className='game';const name=document.createElement('strong');name.textContent=g.home+' vs. '+g.away;const meta=document.createElement('small');meta.textContent=g.sport+' · '+(g.level||'Unspecified level')+' · '+new Date(g.scheduled_at).toLocaleString()+(g.venue?' · '+g.venue:'');const actions=document.createElement('div');actions.className='actions';const scorer=scorerLink(g);if(scorer){const open=document.createElement('button');open.textContent='Open scorer';open.addEventListener('click',()=>{location.href=scorer;});actions.append(open);}const del=document.createElement('button');del.className='secondary';del.textContent='Delete cloud game';del.addEventListener('click',async()=>{if(!confirm('Delete this private cloud schedule entry?'))return;const {error}=await cloud.from('scheduled_games').delete().eq('id',g.id);if(error)el('cloudStatus').textContent='Delete failed: '+error.message;else await loadCloud();});actions.append(del);item.append(name,meta,actions);target.append(item);}if(!cloudRows.length){const p=document.createElement('p');p.textContent='No cloud schedule entries yet.';target.append(p);}}
function setUser(next){
 if(user?.id!==next?.id){
  accountGeneration++;
  cloudRows=[];
  el('cloudGames').replaceChildren();
 }
 user=next;
 el('cloudStatus').textContent=user?'Signed in as '+user.email:'Not signed in · local drafts still work';
}
async function updateUser(){
 if(!cloud)return;
 const token=accountGeneration;
 const {data,error}=await cloud.auth.getUser();
 if(token!==accountGeneration)return;
 setUser(error?null:data.user);
 if(user)await loadCloud();
}
el('signIn').addEventListener('click',async()=>{if(!cloud){el('cloudStatus').textContent='Cloud unavailable';return;}const email=el('email').value.trim(),password=el('password').value;if(!email||!password){el('cloudStatus').textContent='Enter email and password.';return;}el('cloudStatus').textContent='Signing in…';const {error}=await cloud.auth.signInWithPassword({email,password});el('password').value='';if(error)el('cloudStatus').textContent='Sign-in failed: '+error.message;else await updateUser();});
el('signOut').addEventListener('click',async()=>{if(!cloud)return;const {error}=await cloud.auth.signOut();if(error){el('cloudStatus').textContent='Sign-out failed: '+error.message;return;}setUser(null);});
el('sync').addEventListener('click',loadCloud);
el('upload').addEventListener('click',async()=>{
 if(!cloud||!user){el('cloudStatus').textContent='Sign in before uploading local drafts.';return;}
 const token=accountGeneration,owner=user.id;
 // Refresh before comparison: another device may have added a game since the last load.
 const {data:latest,error:readError}=await cloud.from('scheduled_games')
   .select('id,sport,home,away,level,venue,scheduled_at').eq('owner_id',owner).order('scheduled_at',{ascending:true}).limit(500);
 if(token!==accountGeneration)return;
 if(readError){el('cloudStatus').textContent='Cannot verify cloud duplicates: '+readError.message;return;}
 if(latest.length===500){el('cloudStatus').textContent='Cloud schedule has reached the 500-game review limit. Upload paused.';return;}
 cloudRows=latest;
 const known=cloudRows.map(g=>({...g,date:g.scheduled_at}));
 const pending=[];
 let skipped=0;
 for(const g of games){
   try{
     if(!['basketball','soccer','volleyball','baseball','softball','football','flag-football'].includes(g.sport)||
       typeof g.home!=='string'||typeof g.away!=='string'||g.home.trim().length<1||g.away.trim().length<1||
       g.home.length>60||g.away.length>60||String(g.level||'').length>40||String(g.venue||'').length>100||
       !Number.isFinite(new Date(g.date).getTime())||
       window.LarsonGameIdentity.candidates(g,known).length){skipped++;continue;}
     pending.push(g);
     known.push(g); // Catch duplicates within the local batch, too.
   }catch(e){skipped++;}
 }
 if(!pending.length){el('cloudStatus').textContent='No new valid local drafts to upload ('+skipped+' skipped).';return;}
 if(!confirm('Upload '+pending.length+' local drafts to your private cloud account? '+skipped+' invalid or possible duplicate drafts will be skipped.'))return;
 let added=0;
 for(const g of pending){
   if(token!==accountGeneration)return;
   const {error}=await cloud.from('scheduled_games').insert({
     owner_id:owner,sport:g.sport,home:g.home.trim(),away:g.away.trim(),
     level:String(g.level||''),venue:String(g.venue||''),scheduled_at:new Date(g.date).toISOString()
   });
   if(token!==accountGeneration)return;
   if(error){await loadCloud();el('cloudStatus').textContent='Uploaded '+added+' games, then stopped: '+error.message;return;}
   added++;
 }
 await loadCloud();
 el('cloudStatus').textContent='Uploaded '+added+' private schedule entries; skipped '+skipped+'. Local drafts kept.';
});
if(cloud){
 cloud.auth.onAuthStateChange((event,session)=>{
  const next=session?.user||null;
  if(next?.id===user?.id)return;
  setUser(next);
  const token=accountGeneration;
  if(next)setTimeout(()=>{if(token===accountGeneration)void loadCloud();},0);
 });
 updateUser();
}else el('cloudStatus').textContent='Cloud library unavailable; local drafts still work.';
el('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({format:'larson-schedule-v1',games},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='larson-schedule.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);el('message').textContent='Schedule exported.';});el('importButton').addEventListener('click',()=>el('importFile').click());el('importFile').addEventListener('change',async()=>{const file=el('importFile').files?.[0];if(!file)return;try{if(file.size>1000000)throw Error('File is too large');const payload=JSON.parse(await file.text());if(payload.format!=='larson-schedule-v1'||!Array.isArray(payload.games))throw Error('Not a Larson schedule export');let added=0,skipped=0;for(const entry of payload.games.slice(0,500)){if(!entry||typeof entry!=='object'||!['basketball','soccer','volleyball','baseball','softball','football','flag-football'].includes(entry.sport)||typeof entry.home!=='string'||typeof entry.away!=='string'||typeof entry.date!=='string'||!entry.home.trim()||!entry.away.trim()||!Number.isFinite(new Date(entry.date).getTime())||entry.home.length>60||entry.away.length>60||String(entry.level||'').length>40||String(entry.venue||'').length>100){skipped++;continue;}if(games.length>=500){skipped++;continue;}let matches=[];try{matches=window.LarsonGameIdentity.candidates(entry,games);}catch(e){skipped++;continue;}if(matches.length){skipped++;continue;}games.push({id:String(Date.now())+'-'+Math.random().toString(36).slice(2),sport:entry.sport,home:entry.home.trim(),away:entry.away.trim(),date:entry.date,level:String(entry.level||''),venue:String(entry.venue||'')});added++;}save();render();el('message').textContent='Imported '+added+' games; skipped '+skipped+' invalid or possible duplicates.';}catch(e){el('message').textContent='Import failed: '+e.message;}finally{el('importFile').value='';}});el('form').addEventListener('submit',e=>{e.preventDefault();const g={id:String(Date.now())+'-'+Math.random().toString(36).slice(2),sport:el('sport').value,level:el('level').value.trim(),home:el('home').value.trim(),away:el('away').value.trim(),date:el('date').value,venue:el('venue').value.trim()};if(!g.home||!g.away||!g.date)return;if(games.length>=500){el('message').textContent='Draft limit reached; remove older games.';return;}const matches=window.LarsonGameIdentity?.candidates(g,games)||[];if(matches.length){const summary=matches.map(x=>x.status==='possible-match'?'similar matchup':'possible conflict').join(', ');if(!confirm('A '+summary+' already exists in this browser. Save another scheduled game anyway?')){el('message').textContent='Duplicate review: no new game created.';return;}}games.push(g);if(save()){el('form').reset();el('message').textContent='Scheduled game saved on this device.';render();}});render();})();
