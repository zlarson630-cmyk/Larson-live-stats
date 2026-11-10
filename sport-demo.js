/* Practice fixtures. Each call returns a fresh game with fictional players. */
window.SportDemo=(()=>{
 const teams={away:'Guilford Vikings',home:'Jefferson J-Hawks'};
 const colors={away:'#142b52',home:'#ffffff'};
 const soccerKey='lls-soccer-test-game';
 const names={
  away:['1, Alex Reed','6, Avery Brooks','9, Cameron Ellis','17, Drew Miller','21, Casey Martin'],
  home:['1, Riley Young','4, Morgan Lane','7, Casey Lee','11, Jordan Robinson','18, Alex Taylor']
 };
 function soccer(){
  const events=[];
  function add(team,kind,period,time,player,extra={}){
   const event={id:'demo-'+(events.length+1),team,kind,period,time,player,clockMode:'down',halfSeconds:2400,elapsedTime:2400-time,...extra};
   events.push(event);
   return event;
  }
  function savedShot(team,period,time,player){
   const other=team==='home'?'away':'home';
   const shot=add(team,'Shot on goal',period,time,player);
   const save=add(other,'Save',period,time,names[other][0],{shotId:shot.id});
   shot.saveId=save.id;
  }
  savedShot('away',1,2120,names.away[3]);
  add('home','Corner',1,1950,names.home[1]);
  add('home','Goal',1,1722,names.home[3],{assist:names.home[2]});
  add('away','Shot off target',1,1340,names.away[2]);
  add('home','Foul',1,1120,names.home[1]);
  add('away','Goal',1,842,names.away[2],{assist:names.away[1]});
  add('away','Yellow card',1,485,names.away[1]);
  savedShot('home',2,2190,names.home[3]);
  add('away','Offside',2,2012,names.away[4]);
  add('home','Goal',2,1724,names.home[2],{assist:names.home[4]});
  add('away','Corner',2,1544,names.away[1]);
  savedShot('away',2,1475,names.away[4]);
  return {...teams,colors:{...colors},sport:'soccer',demo:true,period:2,halfSeconds:2400,
   seconds:1420,clockMode:'down',running:false,startedAt:null,finished:false,
   rosters:{away:[...names.away],home:[...names.home]},
   goalkeepers:{away:names.away[0],home:names.home[0]},pendingSubs:[],events};
 }
 function volleyball(){
  const events=[];
  const add=(type,team,extra={})=>events.push({id:'demo-'+(events.length+1),type,team,...extra});
  const rally=team=>add('rally',team);
  function set(winner,loserPoints){
   const loser=winner==='away'?'home':'away';
   for(let i=0;i<loserPoints;i++){rally(winner);rally(loser);}
   for(let i=loserPoints;i<25;i++)rally(winner);
  }
  add('stat','home',{playerId:'11',stat:'kill'});
  add('stat','home',{playerId:'7',stat:'assist'});
  add('stat','away',{playerId:'9',stat:'dig'});
  set('home',19);
  add('stat','away',{playerId:'6',stat:'ace'});
  add('stat','home',{playerId:'4',stat:'block'});
  set('away',22);
  for(let i=0;i<12;i++){rally('home');rally('away');}
  rally('home');rally('home');
  add('timeout','away');
  add('stat','home',{playerId:'11',stat:'kill'});
  add('stat','away',{playerId:'9',stat:'kill'});
  return {...teams,bestOf:5,firstServer:'home',events};
 }
 function field(sport,engine){
  const game={id:'00000000-0000-4000-8000-000000000001',revision:crypto.randomUUID(),sport,
   demo:true,minutes:12,teams:{...teams},colors:{...colors},events:[]};
  const add=(type,details={})=>game.events.push({type,...details});
  if(sport==='football'){
   const play=(team,label,player,yards)=>add('play',{team,label,player,yards});
   add('clock',{running:false,seconds:569});
   play('home','Pass complete','7 Casey Lee',24);
   play('home','Reception','11 Jordan Robinson',24);
   play('home','Touchdown','11 Jordan Robinson');
   play('home','Extra point','18 Alex Taylor');
   add('clock',{running:false,seconds:200});
   play('away','Rush','21 Casey Martin',32);
   play('away','Touchdown','21 Casey Martin');
   play('away','Extra point','6 Avery Brooks');
   add('period');
   add('clock',{running:false,seconds:385});
   play('home','Rush','4 Morgan Lane',48);
   play('home','Touchdown','4 Morgan Lane');
   play('home','Extra point','18 Alex Taylor');
   add('clock',{running:false,seconds:123});
   play('away','Field goal','6 Avery Brooks');
   add('period');
   add('clock',{running:false,seconds:462});
   add('situation',{possession:'away',down:2,distance:7,spot:'HOME 34'});
   play('home','Tackle','11 Jordan Robinson');
   return game;
  }
  let batter=0;
  const play=label=>{
   const state=engine.replay(game),team=engine.batting(state);
   add('result',{label,player:names[team][batter++%names[team].length],
    pitcher:names[team==='away'?'home':'away'][0],...engine.suggest(state,label)});
  };
  const half=(...hits)=>[...hits,'Strikeout','Other out','Other out'].forEach(play);
  half('Walk','Home run');half('Single','Home run');
  half('Double');half('Walk','Double','Single');
  half('Single','Home run');half('Double');
  play('Single');
  if(sport==='softball'){play('Strikeout');play('Other out');play('Other out');play('Double');}
  add('pitch',{label:'Ball'});
  return game;
 }
 return {soccerKey,soccer,volleyball,field};
})();
