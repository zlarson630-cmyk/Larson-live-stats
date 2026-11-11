/* Fictional rosters and a repeatable game for presentations and practice. */
function createBasketballDemo(){
 const teams={
  home:{name:'Jefferson J-Hawks',short:'Jefferson',jersey:'#ffffff',ink:'#9f1532',accent:'#d2a541',
   roster:'2 Ellis Monroe|4 Avery Brooks|11 Jordan Robinson|15 Cameron Hayes|23 Tyler Bennett|3 Micah Reed|12 Riley Dawson|21 Drew Collins|32 Sam Carter'},
  away:{name:'Guilford Vikings',short:'Guilford',jersey:'#142b52',ink:'#ffffff',accent:'#8ec8ed',
   roster:'1 Casey Morgan|5 Blake Harrison|10 Logan Price|14 Parker Young|24 Taylor Lewis|3 Devon Miller|12 Rowan Scott|20 Jesse Walker|33 Quinn Kelly'},
 };
 const rosters={},colors={},startingLineups={},teamBrands={};
 for(const [team,info] of Object.entries(teams)){
  rosters[team]=info.roster.split('|').map(entry=>{
   const split=entry.indexOf(' ');
   return {number:entry.slice(0,split),name:entry.slice(split+1)};
  });
  startingLineups[team]=rosters[team].slice(0,5).map(p=>p.number);
  colors[team]=info.jersey;
  teamBrands[team]={displayName:info.name,shortName:info.short,scheme:{jersey:info.jersey,ink:info.ink,accent:info.accent}};
 }
 const game={id:'DEMO01',demo:true,sport:'basketball',home:teams.home.name,away:teams.away.name,colors,
  rosters,startingLineups,teamBrands,scores:{home:0,away:0},fouls:{home:0,away:0},timeouts:{home:5,away:5},
  period:3,seconds:252,running:false,startedAt:null,possession:'away',libraryStatus:'active',events:[]};
 const lineup={home:[...startingLineups.home],away:[...startingLineups.away]};
 let seed=24601;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 function add(team,kind,period,seconds,extra={}){
  const time=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
  game.events.unshift({id:'demo'+game.events.length,team,kind,period,time,...extra});
  if(kind==='score')game.scores[team]+=extra.points;
  if(kind==='foul')game.fouls[team]++;
  if(kind==='timeout')game.timeouts[team]--;
 }
 function shot(team,period,seconds,points,made,shooter){
  const players=lineup[team],scorer=shooter||players[Math.floor(random()*players.length)];
  const others=players.filter(number=>number!==scorer);
  const assist=points===1?'na':random()<.68?others[Math.floor(random()*others.length)]:'no-assist';
  const angle=.18+random()*(Math.PI-.36),radius=points===3?20.5+random()*5.5:1.6+random()*16.7;
  const shotLocation=points===1?{}:{shotLocation:{x:Math.round(10*Math.max(.5,Math.min(49.5,25+Math.cos(angle)*radius)))/10,
   y:Math.round(10*(5.25+Math.sin(angle)*radius))/10}};
  add(team,made?'score':'miss',period,seconds,{points,scorer,...(made?{assist}:{}),...shotLocation});
 }
 const madeByQuarter=[
  {home:[2,2,3,2,1,2,3],away:[2,3,2,1,2,3]},
  {home:[3,2,1,2,2,3,1],away:[2,3,2,2,3,1,2,2]},
 ];
 madeByQuarter.forEach((makes,index)=>{
  const period=index+1;
  for(let possession=0;possession<16;possession++){
   const team=possession%2===0?'home':'away',turn=Math.floor(possession/2),clock=466-possession*29;
   if(turn===4){
    const out=lineup[team][1],incoming=rosters[team][5+index].number;
    add(team,'substitution',period,clock+8,{out,in:incoming});
    lineup[team][1]=incoming;
   }
   if(turn===2||turn===5)add(team,'foul',period,clock+4);
   if(turn===6&&team===(index===0?'away':'home'))add(team,'timeout',period,clock+4);
   shot(team,period,clock,turn===3?3:2,false);
   if(makes[team][turn])shot(team,period,clock-6,makes[team][turn],true);
  }
 });
 shot('home',2,23,1,true,'11');
 shot('away',3,465,3,true);
 shot('home',3,452,2,false);
 add('home','foul',3,441);
 shot('away',3,429,2,true);
 shot('home',3,407,2,true,'11');
 shot('away',3,381,3,false);
 shot('away',3,373,2,true);
 shot('home',3,372,3,true,'11');
 shot('away',3,351,2,false);
 shot('home',3,319,2,true,'11');
 add('away','foul',3,309);
 shot('away',3,291,2,false);
 shot('home',3,274,2,true,'11');
 add('away','timeout',3,252);
 return game;
}
let basketballDemoSession='1';
function basketballDemoStorage(key){return 'lls-basketball-demo-'+basketballDemoSession+'-'+key;}
function basketballDemoSave(key,value){
 try{localStorage.setItem(basketballDemoStorage(key),JSON.stringify(value));}catch{}
}
function basketballDemoRead(key){
 try{return JSON.parse(localStorage.getItem(basketballDemoStorage(key)));}catch{return null;}
}
function startBasketballDemo(){
 const params=new URLSearchParams(location.search);
 if(params.get('demo')!=='1'||params.has('game')||params.has('local'))return;
 // Keep a practice game across refreshes in the same browser tab.
 const sessionKey='lls-basketball-practice-session';
 let previous;
 try{previous=sessionStorage.getItem(sessionKey);}catch{}
 basketballDemoSession=previous||crypto.randomUUID();
 const saved=previous?basketballDemoRead('game'):null;
 state=saved?.demo&&saved.id==='DEMO01'?saved:createBasketballDemo();
 try{sessionStorage.setItem(sessionKey,basketballDemoSession);}catch{}
 id=state.id;
 canWrite=()=>true;
 write=async (change,gameTextField)=>{
  if(basketballWriteLocked(state,gameTextField))return false;
  try{
   const next=structuredClone(state);
   change(next);
   state=next;
   basketballDemoSave('game',state);
   render();
   return true;
  }catch(error){
   scorerToast(error.message,true);
   return false;
  }
 };
 goHome=event=>{event?.preventDefault();location.assign('basketball-home.html');return false;};
 basketballDemoSave('game',state);
 if(!saved)basketballDemoSave('graphic',null);
 el('lobby').classList.add('hide');
 el('teams').classList.add('hide');
 el('app').classList.remove('hide');
 el('basketballDemoBanner').classList.remove('hide');
 el('basketballGraphicControls').open=true;
 render();
 el('overlay').href='overlay.html?demo='+basketballDemoSession;
 const previousRender=render;
 render=()=>{previousRender();el('overlay').href='overlay.html?demo='+basketballDemoSession;};
 clockTimer=setInterval(tickBasketballClock,250);
}
