/* Shared account indicator and private profile dashboard. No private cloud data is cached here. */
window.ProfileData=(()=>{
 function game(id,state,source,updated){return {id:String(id),state,source,sport:['soccer','volleyball'].includes(state.sport)?state.sport:'basketball',updated:updated||null}}
 function href(g){if(g.sport==='volleyball')return './?match='+encodeURIComponent(g.id);return (g.sport==='soccer'?'soccer.html':'basketball.html')+'?game='+encodeURIComponent(g.id)}
 function rosterText(value){if(typeof value==='string')return value;return (Array.isArray(value)?value:[]).map(p=>typeof p==='string'?p:[p.number,p.name,p.height,p.year].filter(v=>v!==undefined&&v!=='').join(', ')).join('\n')}
 function rosters(games,library){
  const out=[];
  for(const [key,value] of Object.entries(library)){
   const text=rosterText(value);
   if(!text.trim())continue;
   const parts=key.split('|'),soccer=parts[0]==='soccer';
   out.push({team:parts[soccer?1:0],kind:'Season roster',detail:[soccer?'Soccer':'Basketball',...parts.slice(soccer?2:1)].join(' · '),text});
  }
  for(const g of games)for(const side of ['home','away']){
   const text=rosterText(g.state.rosters?.[side]);
   if(text.trim())out.push({team:g.state[side],kind:'Game roster',detail:g.sport[0].toUpperCase()+g.sport.slice(1)+' · '+g.id,text});
  }
  return out;
 }
 function teams(brands,games,rosters){
  const map=new Map();
  const getTeam=name=>{
   const key=name.trim().toLowerCase();
   if(!map.has(key))map.set(key,{name:name.trim(),rosters:[],gameCount:0});
   return map.get(key);
  };
  for(const brand of brands)getTeam(brand.name).brand=brand;
  for(const g of games){
   const gameTeams=new Set([g.state.home,g.state.away].filter(name=>typeof name==='string'&&name.trim()).map(getTeam));
   for(const team of gameTeams)team.gameCount++;
  }
  for(const roster of rosters)if(typeof roster.team==='string'&&roster.team.trim())getTeam(roster.team).rosters.push(roster);
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
 }
 function score(g){const s=g.state;if(s.scores)return `${s.scores.away??0} – ${s.scores.home??0}`;const goals=t=>(s.events||[]).filter(e=>e.team===t&&['Goal','Own goal'].includes(e.kind)).length;return `${goals('away')} – ${goals('home')}`}
 async function cloud(client,userId){const rows=[];for(let page=0;;page++){const {data,error}=await client.from('live_games').select('id,state,updated_at').eq('owner_id',userId).order('updated_at',{ascending:false}).order('id').range(page*100,page*100+99);if(error)throw error;rows.push(...(data||[]).filter(r=>r.state).map(r=>game(r.id,r.state,'account',r.updated_at)));if(!data||data.length<100)break}return rows}
 function status(game){return game.state.libraryStatus==='trash'?(game.sport==='volleyball'?'unpublished':'trash'):game.state.finished||game.state.libraryStatus==='completed'?'completed':'active'}
 async function setBasketballTrash(client,userId,gameId,trash,stillCurrent){
  for(let attempt=0;attempt<5;attempt++){
   if(!stillCurrent())throw Error('Account changed.');
   const table=client.from('live_games');
   const {data:row,error:readError}=await table.select('state').eq('id',gameId).eq('owner_id',userId).maybeSingle();
   if(readError)throw readError;
   if(!stillCurrent())throw Error('Account changed.');
   if(!row?.state||(row.state.sport||'basketball')!=='basketball')throw Error('Basketball game is no longer available.');
   const old=row.state,isTrashed=old.libraryStatus==='trash';
   if(isTrashed===trash)return old;
   const next={...old,version:Math.max(Date.now(),Math.floor(Number(old.version)||0)+1)};
   if(trash){
    next.statusBeforeTrash=old.finished||old.libraryStatus==='completed'?'completed':'active';
    next.libraryStatus='trash';
    if(next.running&&next.startedAt)next.seconds=Math.max(0,next.seconds-Math.max(0,Math.floor((Date.now()-next.startedAt)/1000)));
    next.running=false;
    next.startedAt=null;
   }else{
    next.libraryStatus=old.statusBeforeTrash==='completed'||old.finalAt||old.finished?'completed':'active';
    delete next.statusBeforeTrash;
   }
   const query=table.update({state:next}).eq('id',gameId).eq('owner_id',userId);
   const guarded=old.version==null?query.is('state->>version',null):query.eq('state->version',JSON.stringify(old.version));
   const {data,error}=await guarded.select('state');
   if(error)throw error;
   if(data?.length)return data[0].state;
  }
  throw Error('Game is being updated. Try again.');
 }
 return {href,rosterText,rosters,teams,score,cloud,status,setBasketballTrash};
})();
(()=>{
 const $=id=>document.getElementById(id),dashboard=document.body.hasAttribute('data-profile-page');
 const chip=document.createElement('a');chip.className='profileChip';chip.href='profile.html';chip.setAttribute('aria-label','My profile and sign-in status');const dot=document.createElement('span'),chipText=document.createElement('span');dot.className='profileDot';dot.setAttribute('aria-hidden','true');chipText.textContent='Checking account…';chip.append(dot,chipText);document.querySelector('header')?.append(chip);
 let user=null,generation=0,cloudGames=[],seasonRosters={},cloudError='';
 const changingGames=new Set();
 if(dashboard){
  const params=new URLSearchParams(window.location?.search),view=params.get('view'),sport=params.get('sport');
  if(['games','teams'].includes(view)){
   document.body.dataset.management=view;
   $('profileHeading').textContent=view==='games'?'My Games':'My Teams';
  }
  if(['basketball','soccer','volleyball'].includes(sport))$('profileSport').value=sport;
 }
 const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e};
 function badge(host,source){host.append(node('span',source==='account'?'Account':'This device','profileBadge '+source))}
 function card(host,title){const e=node('article',undefined,'profileCard');e.append(node('h3',title));host.append(e);return e}
 function link(host,text,href){const a=node('a',text);a.href=href;host.append(a)}
 function empty(host,text){host.append(node('p',text,'profileHint'))}
 function identity(next,error){user=next;chip.dataset.state=error?'unknown':user?'signed-in':'signed-out';chipText.textContent=error?'Account unavailable':user?'Profile · '+(user.email||'Signed in'):'Sign in · My profile';chip.title=user?.email||chipText.textContent;
  if(!dashboard)return;$('profileIdentity').textContent=error?'Unable to verify sign-in. Reconnect and refresh.':user?'Signed in as '+(user.email||'your scorer account'):'Signed out · Sign in to view your cloud library';$('profileAvatar').textContent=user?.email?.slice(0,2).toUpperCase()||'?';$('profileLogin').hidden=!!user;$('profileSignOut').hidden=!user;
 }
 function render(){if(!dashboard)return;const all=cloudGames,q=$('profileSearch').value.trim().toLowerCase(),matches=(...parts)=>parts.join(' ').toLowerCase().includes(q);let brands=[];try{brands=window.TeamBrands?.list()||[]}catch(e){$('profileBrandStatus').textContent=e.message}
 const current=window.TeamBrands?.state?.();if(current?.owner&&current.owner!==user?.id)brands=[];if(current)$('profileBrandStatus').textContent=current.message;else $('profileBrandStatus').textContent='Sign in to view your cloud brands.';
 const rosters=ProfileData.rosters(all,user&&window.CloudLibrary?.state().owner===user.id?seasonRosters:{});
 const teams=ProfileData.teams(brands,all,rosters);
 for(const [name,count] of [['teams',teams.length],['brands',brands.length],['games',all.length]])$(name+'Count').textContent=count;
 for(const name of ['Teams','Brands','Games'])$('profile'+name).textContent='';
 for(const team of teams){
  const teamMatches=matches(team.name,team.brand?.nickname||'');
  const visibleRosters=teamMatches?team.rosters:team.rosters.filter(r=>matches(r.kind,r.detail,r.text));
  if(!teamMatches&&!visibleRosters.length)continue;
  const e=card($('profileTeams'),team.name);
  e.append(node('p',team.gameCount+' saved game'+(team.gameCount===1?'':'s')));
  if(!team.rosters.length)empty(e,'No saved player roster.');
  for(const r of visibleRosters){
   const details=node('details');
   const count=r.text.split('\n').filter(line=>line.trim()).length;
   details.append(node('summary',[r.kind,r.detail,count+' players'].join(' · ')),node('pre',r.text));
   e.append(details);
  }
  if(team.brand)link(e,'View team brand','brands.html?team='+encodeURIComponent(team.brand.id));
 }
 for(const b of brands.filter(b=>matches(b.name,b.nickname,b.shortName))){const e=card($('profileBrands'),b.name);badge(e,'account');const safeLogo=window.TeamBrands?.logo(b.logo);if(safeLogo){const img=node('img');img.className='profileLogo';img.src=safeLogo;img.alt=b.name+' logo';e.append(img)}e.append(node('p',[b.nickname,b.shortName].filter(Boolean).join(' · ')));for(const [name,kit] of Object.entries(b.kits||{})){if(!kit)continue;const row=node('div',undefined,'profileSwatches');for(const color of Object.values(kit)){if(!/^#[0-9a-f]{6}$/i.test(color))continue;const swatch=node('span');swatch.style.background=color;swatch.title=name+' '+color;row.append(swatch)}e.append(node('p',name),row)}link(e,'Edit brand','brands.html?team='+encodeURIComponent(b.id))}
 const sport=$('profileSport').value,status=$('profileGameStatus').value||'saved';
 const descending=$('profileGameSort').value!=='oldest';
 const games=all.filter(g=>{
  const gameStatus=ProfileData.status(g);
  return (sport==='all'||sport===g.sport)&&(status==='saved'?gameStatus!=='trash':status===gameStatus)&&
   matches(g.state.home,g.state.away,g.id,g.sport);
 }).sort((a,b)=>(descending?-1:1)*String(a.updated||a.id).localeCompare(String(b.updated||b.id)));
 for(const g of games){
  const e=card($('profileGames'),g.state.away+' at '+g.state.home),status=ProfileData.status(g);
  badge(e,g.source);
  e.append(node('p',g.sport[0].toUpperCase()+g.sport.slice(1)),
   node('p',ProfileData.score(g)+' · '+(status==='unpublished'?'Unpublished':status==='trash'?'In Trash':status==='completed'?'Final':'Active')),
   node('p','Game '+g.id));
  if(g.updated){const date=new Date(g.updated);if(!isNaN(date))e.append(node('p','Updated '+date.toLocaleString()));}
  const actions=node('div',undefined,'gameActions');
  if(!['trash','unpublished'].includes(status))link(actions,status==='completed'?'Review game':'Open game',ProfileData.href(g));
  if(g.sport==='basketball'){
   const button=node('button',status==='trash'?'Restore':'Move to Trash');
   button.type='button';
   button.disabled=changingGames.has(g.id);
   button.onclick=()=>changeGameTrash(g,status!=='trash',button);
   actions.append(button);
  }
  e.append(actions);
 }
 for(const name of ['Teams','Brands','Games']){const host=$('profile'+name);if(!host.children.length)empty(host,q?'No matching '+name.toLowerCase()+'.':name==='Games'?(!user?'Sign in to see your saved games.':all.length?'No games match these filters.':'No saved games here yet. Create a game in Basketball or Soccer.'):name==='Teams'?'No teams here yet. Save a season roster or score a game.':'No team brands here yet.')}
 }
 async function changeGameTrash(game,trash,button){
  const owner=user?.id,message=$('profileGameActionStatus');
  if(!owner||changingGames.has(game.id))return;
  changingGames.add(game.id);
  button.disabled=true;
  message.textContent=trash?'Moving game to Trash…':'Restoring game…';
  try{
   const state=await ProfileData.setBasketballTrash(Live.client,owner,game.id,trash,()=>user?.id===owner);
   if(user?.id!==owner)return;
   cloudGames=cloudGames.map(g=>g.id===game.id?{...g,state}:g);
   message.textContent=trash?'Moved to Trash. Switch the Status filter to Trash to restore it.':'Game restored. Switch the Status filter to Active + completed to see it.';
  }catch(e){if(user?.id===owner)message.textContent=e.message;}
  finally{changingGames.delete(game.id);render();}
 }
 async function refresh(){const token=++generation;cloudGames=[];cloudError='';if(dashboard){seasonRosters=window.CloudLibrary?.rosters()||{};$('profileStatus').textContent='Checking account and loading saved items…';render()}
  try{if(!window.Live?.client)throw Error('Account service unavailable');const {data,error}=await Live.client.auth.getSession();if(error)throw error;if(token!==generation)return;identity(data?.session?.user||null);if(dashboard&&user){const accountId=user.id;const loaded=await ProfileData.cloud(Live.client,accountId);if(token!==generation)return;cloudGames=loaded;await window.CloudLibrary?.ready?.();if(token!==generation)return;seasonRosters=window.CloudLibrary?.rosters()||{}}}
  catch(e){if(token!==generation)return;cloudGames=[];cloudError=e.message;if(!user)identity(null,true)}
  if(token!==generation)return;if(dashboard){render();$('profileStatus').textContent=cloudError?'Account games could not be loaded: '+cloudError+' · Use Refresh to retry.':(user&&window.CloudLibrary?.state().phase==='offline'?window.CloudLibrary.state().message:'Your library is saved in the cloud and available on every device where you sign in.')}
 }
 window.CloudLibrary?.connect?.(window.Live?.client);window.CloudLibrary?.subscribe?.(()=>{seasonRosters=window.CloudLibrary.rosters();render()});window.TeamBrands?.connect?.(window.Live?.client);window.TeamBrands?.subscribe?.(()=>render());
 window.Live?.client?.auth.onAuthStateChange((event,session)=>{generation++;cloudGames=[];identity(session?.user||null);render();setTimeout(refresh,0)});
 if(dashboard){$('profileSearch').addEventListener('input',render);$('profileSport').addEventListener('change',render);$('profileGameStatus').addEventListener('change',render);$('profileGameSort').addEventListener('change',render);$('profileRefresh').onclick=async()=>{await Promise.allSettled([refresh(),window.TeamBrands?.refresh?.(),window.CloudLibrary?.refresh?.()])};$('profileSignIn').onsubmit=async e=>{e.preventDefault();const button=e.submitter||e.target.querySelector('button');button.disabled=true;const password=$('profilePassword').value;$('profilePassword').value='';try{if(!window.Live?.client)throw Error('Account service unavailable. Refresh and retry.');const {error}=await Live.client.auth.signInWithPassword({email:$('profileEmail').value.trim(),password});if(error)throw error;$('profileAuthMessage').textContent='';await refresh()}catch(e){$('profileAuthMessage').textContent='Sign-in failed: '+e.message}finally{button.disabled=false}};
 $('profileSignOut').onclick=async()=>{const button=$('profileSignOut');button.disabled=true;try{const {error}=await Live.client.auth.signOut();if(error)throw error;generation++;cloudGames=[];identity(null);render();await refresh()}catch(e){$('profileStatus').textContent='Sign-out failed: '+e.message}finally{button.disabled=false}};
 window.addEventListener('focus',refresh);window.addEventListener('online',refresh);
 }
 if(window.CloudLibrary&&dashboard){const old=$('legacyImportStatus'),button=$('legacyImportButton');try{const data=CloudLibrary.legacy();const count=data.brands.length+Object.keys(data.rosters).length+data.games.length;$('legacyImport').hidden=!count&&location.hash!=='#legacyImport';old.textContent=count?`${data.brands.length} older brands, ${Object.keys(data.rosters).length} rosters, ${data.games.length} games found in this browser.`:'No older device records found in this browser.';button.hidden=!count}catch(e){$('legacyImport').hidden=false;old.textContent=e.message;button.hidden=true}button.onclick=async()=>{button.disabled=true;try{await CloudLibrary.ready();const result=await CloudLibrary.importLegacy();old.textContent=`Saved to cloud: ${result.brands} brands, ${result.rosters} rosters, ${result.games} games. Existing account records were kept.`;await refresh()}catch(e){old.textContent='Import did not finish: '+e.message+' You can retry; already imported records will not duplicate.'}finally{button.disabled=false}}}
 // Update saved roster previews while preserving game-day drafts.
 if(window.CloudLibrary&&document.body.dataset.sport==='basketball'){
  let lastOwner=null;
  CloudLibrary.subscribe(current=>{
   if(lastOwner!==current.owner){
    if(lastOwner!==null){resetGameRosterDrafts();resetManagedRoster();$('seasonTeam').value=''}
    lastOwner=current.owner;
   }
   for(const side of ['home','away'])loadSeason(side);
   listSeasonTeams();
  });
  window.TeamBrands?.subscribe(listSeasonTeams);
 }
 refresh();
})();
