/* Basketball game setup: cloud-owned team picker and session-aware sign-in. */
(()=>{
const $=id=>document.getElementById(id);
const root=$('lobby');if(!root)return;
const auth=$('authStatus');
const email=$('email');
const password=$('password');
const signIn=email?.closest('label');
const passwordLabel=password?.closest('label');
const signInButton=[...root.querySelectorAll('button')].find(b=>b.getAttribute('onclick')==='signIn()');
const signOutButton=[...root.querySelectorAll('button')].find(b=>b.getAttribute('onclick')==='signOut()');
const authBox=document.createElement('div');authBox.id='basketballAuthBox';
authBox.className='basketball-auth';
if(signIn&&passwordLabel&&signInButton){signIn.parentNode.insertBefore(authBox,signIn);authBox.append(signIn,passwordLabel,signInButton);}
const selector=document.createElement('section');selector.className='teamSetupSelect';selector.innerHTML='<h3>Choose your teams</h3><p class="small">Select from your saved teams or enter a new name. Teams with saved rosters load their season roster automatically.</p><div class="teamSetupGrid"><label>Home team <select id="savedHomeTeam" aria-label="Choose home team"><option value="">Enter a team manually</option></select></label><label>Visitor team <select id="savedAwayTeam" aria-label="Choose visitor team"><option value="">Enter a team manually</option></select></label></div><p class="small" id="teamPickerStatus" role="status">Loading your saved teams…</p>';
const anchor=$('home');anchor.parentNode.insertBefore(selector,anchor);
const style=document.createElement('style');style.textContent=`
.teamSetupSelect{background:#f6f7fa!important;border:1px solid #d2d8df;border-left:5px solid #c91c2b;border-radius:13px;padding:15px;margin:14px 0 10px;color:#252b34!important}.teamSetupSelect h3{margin:0 0 4px;font-size:20px}.teamSetupSelect p{margin:4px 0 12px}.teamSetupGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.teamSetupGrid label{font-weight:750;display:block}.teamSetupGrid select{display:block;margin-top:5px;width:100%;max-width:100%;padding:12px 8px;border-radius:8px;border:1px solid #a6b0bc;background:white;color:#20262e;font:inherit}.basketball-auth[hidden],#basketballSignOut[hidden]{display:none!important}@media(max-width:600px){.teamSetupGrid{grid-template-columns:1fr}.teamSetupSelect{padding:10px}}
`;document.head.append(style);
if(signOutButton){signOutButton.id='basketballSignOut';signOutButton.hidden=true;auth?.after(signOutButton);}
let user=null,teams=[],last=0;
function setSignedIn(isLoggedIn){authBox.hidden=!!isLoggedIn;if(signOutButton)signOutButton.hidden=!isLoggedIn;if(!isLoggedIn){teams=[];updateSelections();}}
async function inspectSession(){if(!window.Live?.client)return;try{const {data,error}=await Live.client.auth.getSession();if(error)throw error;user=data.session?.user||null;setSignedIn(!!user);if(user){await Promise.allSettled([window.TeamBrands?.connect?.(Live.client),window.CloudLibrary?.connect?.(Live.client)]);updateSelections();}}catch(e){$('teamPickerStatus').textContent='Could not load saved teams: '+e.message;}}
function collect(){
 const map=new Map();
 const brands=window.TeamBrands?.list?.()||[];
 for(const b of brands)map.set(b.name.toLowerCase(),{name:b.name,brand:b});
 const rosters=window.CloudLibrary?.rosters?.()||{};
 for(const key of Object.keys(rosters)){
  if(key.startsWith('soccer|'))continue;
  const name=key.split('|')[0]?.trim();
  if(!name)continue;
  const found=map.get(name.toLowerCase());if(!found)map.set(name.toLowerCase(),{name,brand:null});
 }
 return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function updateSelections(){
 teams=user?collect():[];
 const status=$('teamPickerStatus');
 status.textContent=!user?'Sign in to access your saved teams.':teams.length?teams.length+' saved team'+(teams.length===1?'':'s')+' available.':'No saved teams yet. Enter team names below or create one in Team Brands.';
 for(const side of ['home','away']){
  const select=$(side==='home'?'savedHomeTeam':'savedAwayTeam');
  const prior=select.value,existing=$(side).value.trim().toLowerCase();
  select.replaceChildren(new Option('Enter a team manually',''));
  for(const team of teams)select.add(new Option(team.name+(team.brand?' · Brand':' · Roster'),team.name));
  if(teams.some(x=>x.name===prior))select.value=prior;
  else{const match=teams.find(x=>x.name.toLowerCase()===existing);if(match)select.value=match.name;}
 }
}
function choose(side){
 const select=$(side==='home'?'savedHomeTeam':'savedAwayTeam'),team=teams.find(t=>t.name===select.value);
 if(!team)return;
 // Use the existing brand selector for color, kit and logo snapshots.
 const brandSelect=$(side+'Brand');
 if(team.brand&&brandSelect&&[...brandSelect.options].some(o=>o.value===team.brand.id)){
  brandSelect.value=team.brand.id;brandSelect.dispatchEvent(new Event('change',{bubbles:true}));
 }else{
  if(brandSelect){brandSelect.value='';brandSelect.dispatchEvent(new Event('change',{bubbles:true}));}
  $(side).value=team.name;
  if(typeof window.loadSeason==='function')window.loadSeason(side);
 }
}
for(const side of ['home','away']){
 $(side==='home'?'savedHomeTeam':'savedAwayTeam').addEventListener('change',()=>choose(side));
 $(side).addEventListener('input',()=>{const name=$(side).value.trim().toLowerCase(),select=$(side==='home'?'savedHomeTeam':'savedAwayTeam');select.value=teams.find(t=>t.name.toLowerCase()===name)?.name||'';});
}
window.TeamBrands?.subscribe?.(current=>{if(user&&current.phase==='ready')updateSelections()});
window.CloudLibrary?.subscribe?.(current=>{if(user&&current.phase==='ready')updateSelections()});
window.Live?.client?.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;setSignedIn(!!user);if(user){window.TeamBrands?.connect?.(Live.client);window.CloudLibrary?.connect?.(Live.client);updateSelections()}});
inspectSession();
})();
