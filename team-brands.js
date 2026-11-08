/* Private cloud brand library. Browser data is read only for explicit legacy import. */
window.TeamBrands=(()=>{
 const key='lls-team-brands-v1',hex=(v,f)=>/^#[0-9a-f]{6}$/i.test(v||'')?v:f;
 function logo(v){v=String(v||'').trim();if(v.length>400000)return '';if(/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(v))return v;try{const u=new URL(v);return u.protocol==='https:'?u.href:''}catch{return ''}}
 function normalize(v){if(!v||typeof v!=='object'||!String(v.name||'').trim())throw Error('Enter a team name.');const kit=(k,f)=>({jersey:hex(k?.jersey,f.jersey),ink:hex(k?.ink,f.ink),accent:hex(k?.accent,f.accent),nickname:String(k?.nickname||'').trim().slice(0,60)});return {id:String(v.id||'team-'+Date.now()+'-'+Math.random().toString(36).slice(2,9)).slice(0,90),name:String(v.name).trim().slice(0,100),nickname:String(v.nickname||'').trim().slice(0,60),shortName:String(v.shortName||'').trim().slice(0,30),conference:String(v.conference??window.Affiliations?.defaults(v.name).conference??'').trim().slice(0,80),association:String(v.association??window.Affiliations?.defaults(v.name).association??'').trim().slice(0,80),logo:logo(v.logo),kits:{whites:kit(v.kits?.whites,{jersey:'#ffffff',ink:'#252b34',accent:'#d71936'}),primary:kit(v.kits?.primary,{jersey:'#d71936',ink:'#ffffff',accent:'#252b34'}),alternate:v.kits?.alternate?kit(v.kits.alternate,{jersey:'#252b34',ink:'#ffffff',accent:'#d71936'}):null}}}
 let client=null,owner=null,email='',phase='signed-out',message='Sign in to view and save your cloud brands.',teams=[],revision=null,generation=0,queue=Promise.resolve(),started=false;
 const listeners=new Set();
 function decode(raw){if(!raw)return [];const d=JSON.parse(raw);if(d.version!==1||!Array.isArray(d.teams))throw Error('Team library could not be read. Export a backup before making changes.');return d.teams.map(normalize)}
 function localTeams(){return decode(localStorage.getItem(key))}
 function list(){return owner?JSON.parse(JSON.stringify(teams)):[]}
 function state(){return {owner,email,phase,message,canWrite:!!owner&&phase==='ready',canImportLocal:!!owner&&phase==='ready'}}
 function notify(){for(const fn of listeners)fn(state())}
 function subscribe(fn){listeners.add(fn);fn(state());return ()=>listeners.delete(fn)}
 async function refresh(){if(!owner||!client)return;const token=generation,id=owner;try{const {data,error}=await client.from('team_brand_libraries').select('teams,version').eq('owner_id',id).maybeSingle();if(error)throw error;if(token!==generation||id!==owner)return;if(revision!==null&&Number(data?.version??0)<Number(revision))return;teams=(data?.teams||[]).map(normalize);revision=data?.version??null;phase='ready';message='Account library synced. Available on any device where you sign in.';notify()}catch(e){if(token!==generation||id!==owner)return;phase='offline';message='Cloud library unavailable. Reconnect before saving. '+e.message;notify();throw e}}
 async function changeAccount(user){if(owner===(user?.id||null)&&phase==='ready')return;generation++;owner=user?.id||null;email=user?.email||'';teams=[];revision=null;for(const t of ['home','away'])delete selections[t];if(!owner){phase='signed-out';message='Sign in to view and save your cloud brands.';notify();mount();return}phase='loading';message='Loading account library…';notify();try{await refresh()}finally{mount()}}
 async function connect(next){if(started)return;if(!next)return;started=true;client=next;client.auth.onAuthStateChange((event,session)=>{setTimeout(()=>{changeAccount(session?.user).catch(()=>{})},0)});try{const {data,error}=await client.auth.getSession();if(error)throw error;await changeAccount(data?.session?.user)}catch(e){if(!owner){phase='offline';message='Sign-in status unavailable. Reconnect before editing brands.';notify()}}}
 function write(change){if(!owner)throw Error('Sign in before saving a brand.');if(phase!=='ready')throw Error('Account library not ready. Refresh before editing.');const id=owner,token=generation;const task=queue.catch(()=>{}).then(async()=>{if(id!==owner||token!==generation)throw Error('Account changed before the save completed.');const next=change(list());if(next.length>100)throw Error('A library can contain up to 100 teams.');const nextVersion=Number(revision||0)+1,table=client.from('team_brand_libraries');const query=revision===null?table.insert({owner_id:id,teams:next,version:nextVersion}):table.update({teams:next,version:nextVersion}).eq('owner_id',id).eq('version',revision);const {data,error}=await query.select('teams,version');if(id!==owner||token!==generation)throw Error('Account changed before the save completed.');if(error?.code==='23505'||(!error&&!data?.length)){await refresh();throw Error('Library changed on another device. Review the refreshed library and try again.')}if(error)throw error;teams=data[0].teams.map(normalize);revision=data[0].version;notify();return teams});queue=task;return task}
 function save(value){const team=normalize(value);return write(next=>{const i=next.findIndex(t=>t.id===team.id);if(i<0)next.push(team);else next[i]=team;return next}).then(()=>team)}
 function remove(id){return write(next=>next.filter(t=>t.id!==id))}
 function importData(raw){const data=typeof raw==='string'?JSON.parse(raw):raw;if(data.version!==1||!Array.isArray(data.teams)||data.teams.length>100)throw Error('Choose a valid Team Brands export (up to 100 teams).');const incoming=data.teams.map(normalize);return write(merged=>{for(const team of incoming){const i=merged.findIndex(t=>t.id===team.id);if(i<0)merged.push(team);else merged[i]=team}return merged}).then(()=>incoming.length)}
 async function importLocal(){if(!owner||phase!=='ready')throw Error('Sign in and refresh first.');const local=localTeams();let count=0;if(local.length)await write(merged=>{for(const team of local)if(!merged.some(x=>x.id===team.id)){merged.push(team);count++}return merged});return count}
 async function signIn(email,password){if(!client)throw Error('Account service unavailable. Refresh and try again.');const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;await changeAccount(data.user);return state()}
 async function signOut(){if(!client)return;const {error}=await client.auth.signOut();if(error)throw error;await changeAccount(null)}
 function exportData(){return JSON.stringify({version:1,teams:list()},null,2)}
 const selections={};
 function snapshot(){const result={};for(const t of ['home','away']){const selected=selections[t];if(!selected)continue;const name=document.getElementById(t),color=document.getElementById(document.body.dataset.sport==='soccer'?(t==='home'?'hc':'ac'):t+'Color');if(name?.value===selected.name&&color?.value.toLowerCase()===selected.scheme.jersey.toLowerCase())result[t]=JSON.parse(JSON.stringify(selected))}return result}
 function mount(){const host=document.getElementById('teamBrandPicker');if(!host)return;host.innerHTML='';let teams;try{teams=list()}catch(e){host.textContent=e.message;return}
  for(const t of ['home','away']){const group=document.createElement('div'),label=document.createElement('label'),select=document.createElement('select'),kitLabel=document.createElement('label'),kit=document.createElement('select');label.textContent=(t==='home'?'Home':'Visitor')+' saved team';select.id=t+'Brand';const manual=document.createElement('option');manual.value='';manual.textContent='Enter team manually';select.append(manual);for(const team of teams){const o=document.createElement('option');o.value=team.id;o.textContent=team.name+(team.nickname?' · '+team.nickname:'');select.append(o)}kitLabel.textContent='Uniform';kit.id=t+'BrandKit';
   function apply(){
    const team=teams.find(x=>x.id===select.value);
    const previousKit=kit.value;
    kit.innerHTML='';
    for(const [value,label] of [['primary','Primary colors'],['whites','Whites'],['alternate','Alternate colors']]){
     const scheme=team?.kits[value];
     if(value==='alternate'&&!scheme)continue;
     const option=document.createElement('option');
     option.value=value;
     option.textContent=scheme?.nickname||label;
     kit.append(option);
    }
    kit.disabled=!team;
    if(!team){delete selections[t];return}
    kit.value=team.kits[previousKit]?previousKit:'primary';
    const scheme=team.kits[kit.value],selected={...team,kit:kit.value,scheme:{...scheme}};
    if(kit.value==='alternate'&&scheme.nickname){
     selected.displayName=scheme.nickname;
     // The public scoreboard already projects the game's short name.
     selected.shortName=selected.displayName;
    }
    const name=document.getElementById(t),teamChanged=name.value!==team.name;
    selections[t]=selected;
    name.value=team.name;
    const soccer=document.body.dataset.sport==='soccer';
    document.getElementById(soccer?(t==='home'?'hc':'ac'):t+'Color').value=scheme.jersey;
    if(soccer){document.getElementById(t+'Logo').value=team.logo;if(teamChanged)window.loadSoccerRosters?.(t)}
    else if(teamChanged&&typeof window.loadSeason==='function')window.loadSeason(t);
   }
   apply();select.onchange=apply;kit.onchange=apply;label.append(select);kitLabel.append(kit);group.append(label,kitLabel);host.append(group);
  }
  if(document.body.dataset.sport==='basketball')window.syncBasketballTeams?.();
 }
 document.addEventListener('DOMContentLoaded',mount);
 return {list,save,remove,normalize,logo,importData,importLocal,exportData,snapshot,mount,state,subscribe,connect,refresh,signIn,signOut};
})();
