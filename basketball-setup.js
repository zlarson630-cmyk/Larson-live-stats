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
const style=document.createElement('style');
style.textContent='.basketball-auth[hidden],#basketballSignOut[hidden]{display:none!important}';
document.head.append(style);
if(signOutButton){signOutButton.id='basketballSignOut';signOutButton.hidden=true;auth?.after(signOutButton);}
let user=null,teams=[];
const manualChoice=new Set();
function setSignedIn(isLoggedIn){authBox.hidden=!!isLoggedIn;if(auth)auth.hidden=!!isLoggedIn;if(signOutButton)signOutButton.hidden=true;updateSelections();}
async function inspectSession(){if(!window.Live?.client)return;try{const {data,error}=await Live.client.auth.getSession();if(error)throw error;user=data.session?.user||null;setSignedIn(!!user);if(user){await Promise.allSettled([window.TeamBrands?.connect?.(Live.client),window.CloudLibrary?.connect?.(Live.client)]);updateSelections();}}catch(e){$('teamPickerStatus').textContent='Could not load saved teams: '+e.message;}}
function collect(){
 const map=new Map();
 const brands=window.TeamBrands?.state().owner===user.id?TeamBrands.list():[];
 for(const b of brands)map.set(b.name.toLowerCase(),{name:b.name,brand:b});
 const rosters=window.CloudLibrary?.state().owner===user.id?CloudLibrary.rosters():{};
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
 $('teamPickerStatus').textContent=!user?'Sign in to access your saved teams.':teams.length?'':'No saved teams yet. Enter a team manually or set one up in Teams.';
 for(const side of ['home','away']){
  const select=$(side+'Team'),prior=select.value,existing=$(side).value.trim().toLowerCase();
  select.replaceChildren(new Option('Enter team manually',''));
  for(const team of teams)select.add(new Option(team.name,team.name));
  const match=teams.find(t=>t.name===prior)||(!manualChoice.has(side)&&teams.find(t=>t.name.toLowerCase()===existing));
  select.value=match?.name||'';
  choose(side);
 }
}
function choose(side,explicit=false){
 const team=teams.find(t=>t.name===$(side+'Team').value),name=$(side),manual=$(side+'ManualName');
 manual.hidden=!!team;
 if(explicit&&!team){
  manualChoice.add(side);
  name.value='';
  name.focus();
 }
 if(team)manualChoice.delete(side);
 const brandSelect=$(side+'Brand'),kit=$(side+'BrandKit'),slot=$(side+'Uniform');
 const brandId=team?.brand?.id||'';
 if(brandSelect&&brandSelect.value!==brandId){
  brandSelect.value=brandId;
  brandSelect.dispatchEvent(new Event('change',{bubbles:true}));
 }
 if(kit)slot.replaceChildren(kit.parentElement);
 slot.hidden=!brandId;
 if(team)name.value=team.name;
 if(explicit&&!brandId)$(side+'Color').value=$(side+'Color').defaultValue;
 window.loadSeason?.(side);
}
for(const side of ['home','away']){
 $(side+'Team').addEventListener('change',()=>choose(side,true));
}
window.syncBasketballTeams=updateSelections;
window.TeamBrands?.subscribe?.(current=>{if(user&&current.phase==='ready')updateSelections()});
window.CloudLibrary?.subscribe?.(current=>{if(user&&current.phase==='ready')updateSelections()});
window.Live?.client?.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;setSignedIn(!!user);if(user){window.TeamBrands?.connect?.(Live.client);window.CloudLibrary?.connect?.(Live.client);updateSelections()}});
inspectSession();
})();
