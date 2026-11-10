'use strict';

(function(){'use strict';const v=window.LarsonVolleyball;const key='lls-volleyball-beta-v1';const el=id=>document.getElementById(id);let data={events:[],home:'Home',away:'Away',bestOf:5,firstServer:'home'};try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&Array.isArray(saved.events)&&saved.events.length<100000&&[3,5].includes(saved.bestOf)&&['home','away'].includes(saved.firstServer))data={...data,...saved};}catch(e){}
const query=new URLSearchParams(location.search);if(!data.events.length){for(const side of ['home','away']){const value=query.get(side);if(value&&value.trim())data[side]=value.trim().slice(0,60);}}let serial=0;const newId=()=>String(Date.now())+'-'+String(++serial)+'-'+Math.random().toString(36).slice(2,7);
function config(){return {rules:{bestOf:Number(data.bestOf)},firstServer:data.firstServer};}
function state(){return v.replay(data.events,config());}
function save(){try{localStorage.setItem(key,JSON.stringify(data));}catch(e){el('feedback').textContent='Could not save locally. Storage may be full or disabled.';}}
let publishing = false;
let queuedPublication = false;
let lastPublished = '';
const publicStatus = message => { el('publishStatus').textContent = message; };

function publicationControls() {
 const share = data.publicShare;
 el('publishScore').disabled = publishing;
 el('withdrawScore').disabled = publishing;
 el('withdrawScore').hidden = !share;
 el('publicStart').disabled = !!share || publishing;
 el('publicScoreLink').hidden = !share?.published;
 if(share)el('publicScoreLink').href = './?match='+encodeURIComponent(share.id);
}

async function publishScore({withdraw=false}={}) {
 if(publishing){queuedPublication=true;return;}
 const s = state();
 const share = data.publicShare;
 const snapshot = {
  sport:'volleyball', home:data.home, away:data.away, scores:s.setsWon,
  period:s.completed?s.sets.length:s.sets.length+1,
  liveStarted:!!share?.liveStarted||data.events.some(event=>event.type==='rally'),
  finished:s.completed, scheduledAt:share?.scheduledAt ||
   (el('publicStart').value?new Date(el('publicStart').value).toISOString():null)
 };
 if(withdraw)snapshot.libraryStatus='trash';
 if(!withdraw&&!snapshot.scheduledAt&&!snapshot.liveStarted){
  publicStatus('Set a start time or score the first rally before publishing.');return;
 }
 const fingerprint = JSON.stringify(snapshot);
 if(share?.published&&fingerprint===lastPublished)return;
 publishing=true;
 publicationControls();
 try {
  const client=window.Live?.client;
  if(!client)throw Error('Cloud service unavailable.');
  const {data:auth,error:authError}=await client.auth.getUser();
  if(authError||!auth?.user)throw Error('Sign in to publish this scoreboard.');
  if(share&&share.owner!==auth.user.id)throw Error('Sign in as the account that published this match.');
  const active=share||{id:Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>(n%36).toString(36)).join('').toUpperCase(),owner:auth.user.id,scheduledAt:snapshot.scheduledAt,token:crypto.randomUUID()};
  if(!share){data.publicShare=active;save();}
  const old=await Live.read(client,'live_games',active.id);
  if(old&&old.state?.publicationToken!==active.token)throw Error('This match code is already in use.');
  if(old&&active.version!==undefined&&old.state.version!==active.version&&old.state.version!==active.pendingVersion)throw Error('This scoreboard changed in another tab. Reopen the scorer to load the latest publication.');
  const version=crypto.randomUUID();
  const row={...snapshot,publicationToken:active.token,version};
  active.pendingVersion=version;save();
  const table=client.from('live_games');
  const query=old?table.update({state:row}).eq('id',active.id).eq('state->>version',old.state.version):
   table.insert({id:active.id,owner_id:active.owner,state:row});
  const {data:rows,error}=await query.select('id');
  if(error||!rows?.length)throw error||Error('The public score changed during this save. Reopen the scorer and retry.');
  lastPublished=fingerprint;
  if(withdraw){delete data.publicShare;el('publicStart').value='';}
  else Object.assign(active,{published:true,version,pendingVersion:null,liveStarted:snapshot.liveStarted,finished:snapshot.finished});
  save();
  publicStatus(withdraw?'Scoreboard unpublished.':'Public scoreboard is up to date.');
 } catch(error){publicStatus('Public scoreboard update failed. '+error.message);}
 finally{
  publishing=false;
  publicationControls();
  if(queuedPublication){queuedPublication=false;if(data.publicShare?.published)void publishScore();}
 }
}

function canReplaceMatch() {
 if(publishing){publicStatus('Wait for the public scoreboard to finish saving.');return false;}
 if(data.publicShare&&(!state().completed||!data.publicShare.finished)){
  publicStatus('Unpublish the current scoreboard before replacing this match.');return false;
 }
 return true;
}
el('publishScore').onclick=()=>publishScore();
el('withdrawScore').onclick=()=>publishScore({withdraw:true});
window.addEventListener('online',()=>{if(data.publicShare?.published)void publishScore();});

function display(){let s;try{s=state();}catch(e){el('feedback').textContent='Saved event history could not be replayed: '+e.message;return;}
el('homeLabel').textContent=data.home||'Home';el('awayLabel').textContent=data.away||'Away';const shown=s.completed?s.sets[s.sets.length-1]:s.points;el('homeScore').textContent=shown.home;el('awayScore').textContent=shown.away;el('homeSets').textContent=s.setsWon.home;el('awaySets').textContent=s.setsWon.away;el('homeServe').textContent=s.serving==='home'?'● Serving':'';el('awayServe').textContent=s.serving==='away'?'● Serving':'';
el('phase').textContent=s.completed?'MATCH FINAL · '+(s.setsWon.home>s.setsWon.away?data.home:data.away)+' wins':'Set '+(s.sets.length+1);el('setHistory').textContent=s.sets.length?'Completed sets: '+s.sets.map((x,i)=>(i+1)+': '+x.home+'–'+x.away).join(' · '):'No completed sets';el('homePoint').disabled=s.completed;el('awayPoint').disabled=s.completed;el('addStat').disabled=s.completed;el('undo').disabled=!data.events.length;el('homeTimeout').disabled=s.completed;el('awayTimeout').disabled=s.completed;el('timeouts').textContent='Timeouts recorded: '+data.home+' '+(s.timeouts?.home||0)+' · '+data.away+' '+(s.timeouts?.away||0);
el('homePoint').textContent='+1 '+(data.home||'Home')+' rally';el('awayPoint').textContent='+1 '+(data.away||'Away')+' rally';el('statSummary').textContent=['home','away'].map(t=>{const entries=Object.entries(s.stats[t]).map(([id,stats])=>'#'+id+' '+Object.entries(stats).map(([k,n])=>k+': '+n).join(', '));return (t==='home'?data.home:data.away)+': '+(entries.join(' | ')||'No stats yet');}).join(' • ');
const list=el('history');list.replaceChildren();data.events.slice(-12).reverse().forEach(e=>{const li=document.createElement('li');li.dataset.team=e.team;li.textContent=(e.team==='home'?data.home:data.away)+' · '+(e.type==='rally'?'Rally point':e.type==='stat'?'#'+e.playerId+' '+e.stat:e.type==='timeout'?'Timeout':e.type);list.append(li);});publicationControls();if(data.publicShare?.published)void publishScore();}
function commit(event){try{const next=[...data.events,{...event,id:newId()}];v.replay(next,config());data.events=next;save();el('feedback').textContent='Saved to this browser.';display();}catch(e){el('feedback').textContent=e.message;}}
['home','away'].forEach(t=>{el(t+'Point').addEventListener('click',()=>commit({type:'rally',team:t}));el(t+'Timeout').addEventListener('click',()=>commit({type:'timeout',team:t}));});
el('addStat').addEventListener('click',()=>{const id=el('player').value.trim();if(!id){el('feedback').textContent='Enter a player number or ID.';return;}commit({type:'stat',team:el('statTeam').value,playerId:id,stat:el('statType').value});});
el('export').addEventListener('click',()=>{const payload={format:'larson-volleyball-beta-v1',exportedAt:new Date().toISOString(),home:data.home,away:data.away,bestOf:data.bestOf,firstServer:data.firstServer,events:data.events};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='larson-volleyball-match.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);el('feedback').textContent='Match event history exported.';});
el('import').addEventListener('click',()=>el('importFile').click());el('importFile').addEventListener('change',async()=>{const file=el('importFile').files?.[0];if(!file)return;try{if(file.size>2000000)throw Error('File exceeds 2 MB');const payload=JSON.parse(await file.text());if(payload.format!=='larson-volleyball-beta-v1'||!Array.isArray(payload.events)||payload.events.length>100000||!['home','away'].includes(payload.firstServer)||![3,5].includes(payload.bestOf)||typeof payload.home!=='string'||typeof payload.away!=='string'||payload.home.length>60||payload.away.length>60)throw Error('Invalid volleyball match export');const candidate={events:payload.events,home:payload.home,away:payload.away,bestOf:payload.bestOf,firstServer:payload.firstServer};v.replay(candidate.events,{rules:{bestOf:candidate.bestOf},firstServer:candidate.firstServer});if(!canReplaceMatch()||!confirm('Replace the current volleyball match with the imported match? Export your current match first if needed.'))return;data=candidate;lastPublished='';el('publicStart').value='';publicStatus('');el('homeName').value=data.home;el('awayName').value=data.away;el('format').value=String(data.bestOf);el('firstServer').value=data.firstServer;save();display();el('feedback').textContent='Match imported and validated.';}catch(e){el('feedback').textContent='Import rejected: '+e.message;}finally{el('importFile').value='';}});
el('undo').addEventListener('click',()=>{if(!data.events.length)return;data.events.pop();save();el('feedback').textContent='Last event removed.';display();});
el('reset').addEventListener('click',()=>{if(!canReplaceMatch()||!confirm('Erase this browser’s volleyball match and start over?'))return;delete data.publicShare;lastPublished='';el('publicStart').value='';publicStatus('');data.events=[];save();el('feedback').textContent='New match ready.';display();});
['home','away'].forEach(t=>{el(t+'Name').value=data[t];el(t+'Name').addEventListener('change',()=>{data[t]=el(t+'Name').value.trim().slice(0,60)|| (t==='home'?'Home':'Away');save();display();});});
el('format').value=String(data.bestOf);el('firstServer').value=data.firstServer;
function setupChanged(){if(data.events.length){el('format').value=String(data.bestOf);el('firstServer').value=data.firstServer;el('feedback').textContent='Reset the match before changing rules or first server.';return;}data.bestOf=Number(el('format').value);data.firstServer=el('firstServer').value;save();display();}
el('format').addEventListener('change',setupChanged);el('firstServer').addEventListener('change',setupChanged);display();
})();
