/* The second station can update only the selected shot's assigned details. */
(() => {
 const byId=id=>document.getElementById('tag-'+id);
 const params=new URLSearchParams(location.search);
 const game=params.get('game')?.toUpperCase(),key=location.hash.slice(1);
 const court=byId('court'),svgNS='http://www.w3.org/2000/svg';
 let snapshot,selected,loading=false,saving=false,entryType,keyboardPoint,pinned=false;
 const other=team=>team==='home'?'away':'home';
 const finished=shot=>snapshot.mode==='chart'?!!shot.shotLocation:
  shot.kind==='score'?shot.assist!=null:!!(shot.rebound||shot.tagTeamNoRebound);
 function periodLabel(period){
  const halves=snapshot.clockFormat==='halves',overtime=period-(halves?2:4);
  return overtime>1?overtime+'OT':overtime===1?'OT':(halves?'H':'Q')+period;
 }
 const label=shot=>[
  periodLabel(shot.period)+' '+shot.time,
  snapshot[shot.team],shot.scorer==null?'Unassigned':'#'+shot.scorer,
  shot.points+'PT',shot.kind==='score'?'Make':'Miss',
 ].join(' · ');
 const shape=(type,attrs)=>{
  const node=document.createElementNS(svgNS,type);
  for(const [name,value] of Object.entries(attrs))node.setAttribute(name,value);
  return node;
 };
 for(const points of basketballCourtLines())byId('court-lines').append(shape('polyline',{points:points.map(pair=>pair.join(',')).join(' ')}));
 function button(label,action){
  const node=document.createElement('button');
  node.type='button';
  node.textContent=label;
  node.disabled=saving;
  node.addEventListener('click',action);
  return node;
 }
 function actions(className=''){
  const node=document.createElement('div');
  node.className='tag-actions '+className;
  return node;
 }
 function select(id){
  pinned=true;
  selected=id;
  entryType=null;
  keyboardPoint=null;
  byId('feedback').textContent='';
  render();
 }
 function render(){
  const chart=snapshot.mode==='chart';
  const title=chart?'Shot Chart':'Assists & Rebounds';
  byId('title').textContent=title;
  byId('matchup').textContent=snapshot.away+' at '+snapshot.home;
  byId('workspace').hidden=false;
  byId('chart').hidden=!chart;
  byId('detail').hidden=chart;
  const shot=snapshot.shots.find(s=>s.id===selected);
  const list=byId('list');
  const scroll=list.scrollTop;
  const focused=list.contains(document.activeElement)?document.activeElement.dataset.shotId:null;
  list.replaceChildren();
  for(const row of snapshot.shots){
   const li=document.createElement('li');
   const control=button(label(row),()=>select(row.id));
   control.setAttribute('aria-pressed',String(row.id===selected));
   control.dataset.shotId=row.id;
   if(row.id===selected)control.classList.add(row.kind==='score'?'tag-make':'tag-miss');
   const status=document.createElement('small');
   status.className='tag-shot-meta';
   status.textContent=finished(row)?(chart?'Plotted':row.kind==='score'?'Assist checked':'Rebound checked'):
    chart?'Needs location':row.kind==='score'?'Needs assist':'Needs rebound';
   control.append(status);
   li.append(control);
   list.append(li);
  }
  if(focused)[...list.querySelectorAll('button')].find(control=>control.dataset.shotId===focused)?.focus({preventScroll:true});
  const active=list.querySelector('[aria-pressed="true"]');
  list.scrollTop=active&&active.offsetTop<scroll?active.offsetTop:active&&active.offsetTop+active.offsetHeight>scroll+list.clientHeight?active.offsetTop+active.offsetHeight-list.clientHeight:scroll;
  const remaining=snapshot.shots.filter(row=>!finished(row)).length;
  byId('count').textContent=remaining+' to do';
  byId('selection').textContent=shot?label(shot):'Waiting for shots';
  byId('instructions').textContent=shot?(chart?'Tap or click the shot location. You can also use the arrow keys, then Enter.':''):'Shots appear here as the primary scorer saves them.';
  if(chart){
   const marks=byId('marks');
   marks.replaceChildren();
   for(const row of snapshot.shots){
    if(!basketballShotLocation(row))continue;
    const {x,y}=row.shotLocation;
    const mark=row.kind==='score'?shape('circle',{cx:x,cy:y,r:.65}):
     shape('path',{d:'M'+(x-.55)+' '+(y-.55)+'l1.1 1.1m-1.1 0l1.1 -1.1'});
    if(row.id===selected)mark.setAttribute('data-selected','');
    marks.append(mark);
   }
   const cursor=byId('cursor');
   cursor.setAttribute('visibility',keyboardPoint?'visible':'hidden');
   if(keyboardPoint){
    cursor.setAttribute('cx',keyboardPoint.x);
    cursor.setAttribute('cy',keyboardPoint.y);
   }
   return;
  }
  const detail=byId('detail');
  detail.replaceChildren();
  if(!shot)return;
  const choices=actions();
  let team=shot.team;
  if(shot.kind==='score'){
   byId('instructions').textContent=shot.assist==='no-assist'?'Saved · No assist':
    shot.assist!=null?'Saved · Assist #'+shot.assist:'Who assisted?';
   choices.append(button('No assist',()=>save({player:'no-assist'})));
  }else{
   const selectedType=entryType||shot.rebound?.type;
   byId('instructions').textContent=shot.tagTeamNoRebound?'Saved · No rebound':
    shot.rebound?'Saved · '+shot.rebound.type+' rebound · '+(shot.rebound.player==='team'?'Team':'#'+shot.rebound.player):'Who got the rebound?';
   for(const type of ['offensive','defensive']){
    const control=button(type==='offensive'?'Offensive rebound':'Defensive rebound',()=>{entryType=type;render();});
    control.setAttribute('aria-pressed',String(type===selectedType));
    choices.append(control);
   }
   choices.append(button('No rebound',()=>save({type:'none'})));
   detail.append(choices);
   if(!selectedType)return;
   team=selectedType==='defensive'?other(shot.team):shot.team;
   const players=actions('tag-players');
   players.append(button('Team rebound',()=>save({type:selectedType,player:'team'})));
   addPlayers(players,team,()=>true,player=>save({type:selectedType,player}));
   detail.append(players);
   return;
  }
  const players=actions('tag-players');
  addPlayers(players,team,player=>String(player.number)!==String(shot.scorer),player=>save({player}));
  detail.append(choices,players);
 }
 function addPlayers(container,team,filter,action){
  const roster=(snapshot.rosters?.[team]||[]).filter(filter).sort((a,b)=>Number(a.number)-Number(b.number));
  for(const player of roster){
   const number=String(player.number);
   container.append(button('#'+number+(player.name?' '+player.name:''),()=>action(number)));
  }
  if(!roster.length)container.append(document.createTextNode('No eligible players on the roster.'));
 }
 function accept(data,advance=false){
  if(snapshot&&Number(data.version)<Number(snapshot.version))return;
  const changed=!snapshot||snapshot.version!==data.version;
  snapshot=data;
  byId('status').textContent='';
  if(advance)pinned=false;
  const current=data.shots.find(shot=>shot.id===selected);
  const pending=data.shots.find(shot=>!finished(shot));
  const idle=!pinned&&!keyboardPoint&&!entryType;
  if(advance||!current||(idle&&finished(current)&&pending)){
   selected=(pending||data.shots.at(-1))?.id;
   entryType=null;
   keyboardPoint=null;
  }
  if(changed||advance)render();
 }
 async function rpc(args){
  const {data,error}=await Live.viewer.rpc('basketball_tag_team',{game_code:game,link_key:key,...args})
   .abortSignal(AbortSignal.timeout(8000));
  if(error)throw error;
  return data;
 }
 async function refresh(){
  if(loading||saving)return;
  loading=true;
  try{
   const data=await rpc({});
   if(!saving)accept(data);
  }catch(error){
   if(!saving&&error.code==='P0001'){
    snapshot=null;
    byId('workspace').hidden=true;
   }
   byId('status').textContent=error.code==='P0001'?error.message:'Disconnected · retrying';
  }finally{loading=false;}
 }
 async function save(detail){
  if(saving||!snapshot)return;
  const shot=snapshot.shots.find(row=>row.id===selected);
  if(!shot)return;
  saving=true;
  byId('feedback').textContent='Saving…';
  render();
  try{
   const expected=['kind','team','points','scorer','assist','rebound','shotLocation','tagTeamDetail','tagTeamNoRebound']
    .map(field=>shot[field]??null);
   const data=await rpc({play_id:shot.id,detail,expected});
   accept(data,true);
   byId('feedback').textContent='Saved · '+label(shot);
  }catch(error){
   byId('feedback').textContent=error.code==='P0001'?error.message:'Could not confirm save. Check the shot and try again.';
  }finally{
   saving=false;
   render();
   refresh();
  }
 }
 const point=(x,y)=>({
  x:Math.round(10*Math.max(0,Math.min(basketballCourt.width,x)))/10,
  y:Math.round(10*Math.max(0,Math.min(basketballCourt.depth,y)))/10,
 });
 court.addEventListener('click',event=>{
  const matrix=court.getScreenCTM();
  if(!matrix)return;
  const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
  if(p.x>=0&&p.x<=basketballCourt.width&&p.y>=0&&p.y<=basketballCourt.depth)save({location:point(p.x,p.y)});
 });
 court.addEventListener('keydown',event=>{
  if(!snapshot||!selected||saving)return;
  const move={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
  if(move){
   event.preventDefault();
   const origin=keyboardPoint||snapshot.shots.find(shot=>shot.id===selected)?.shotLocation||{x:25,y:16};
   keyboardPoint=point(origin.x+move[0],origin.y+move[1]);
   render();
  }else if(event.key==='Enter'&&keyboardPoint){
   event.preventDefault();
   save({location:keyboardPoint});
  }
 });
 if(!/^[A-Z0-9]{6}$/.test(game||'')||!(/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(key))){
  byId('status').textContent='Open the second-device link from the primary scorer.';
 }else if(!window.Live?.viewer){
  byId('status').textContent='Cloud connection unavailable. Refresh to try again.';
 }else{
  // A private-data refresh follows the existing public scoreboard change signal.
  Live.watch(game,refresh,()=>{});
  refresh();
 }
})();
