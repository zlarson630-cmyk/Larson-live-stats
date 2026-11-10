/* Derive both PDFs from the same event history as the scorer. */
window.VolleyballReport=(()=>{
 const sides=['away','home'];
 const keys=['kill','assist','ace','dig','block','error'];
 const headers=['Player','K','AST','ACE','DIG','BLK','ERR'];
 function model(game,state,full=false){
  const teams=sides.map(t=>({name:game[t],score:state.setsWon[t],color:t==='away'?'#b51930':'#64748b'}));
  const setScores=state.completed?state.sets:[...state.sets,state.points];
  const line={title:'Set scores',first:156,headers:['Team',...setScores.map((_,i)=>'Set '+(i+1)),'Sets won'],
   rows:sides.map(t=>[game[t],...setScores.map(set=>set[t]),state.setsWon[t]])};
  const names=['Kills','Assists','Aces','Digs','Blocks','Errors'];
  const totals=keys.map((key,i)=>[names[i],...sides.map(t=>Object.values(state.stats[t]).reduce((sum,p)=>sum+(p[key]||0),0))]);
  totals.push(['Timeouts taken',...sides.map(t=>state.timeouts?.[t]||0)]);
  const groups=[
   [line],
   [{title:'Team totals',headers:['Statistic','Visitor','Home'],rows:totals}],
   sides.map(t=>({title:game[t]+' · Player box score',headers,maxRows:13,
    rows:Object.entries(state.stats[t]).sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}))
     .map(([id,stats])=>[id,...keys.map(key=>stats[key]||0)])})),
  ];
  if(full){
   let setIndex=0,rallies=0;
   const rows=game.events.map(event=>{
    const action=event.type==='rally'?'Rally point':event.type==='timeout'?'Timeout':'#'+event.playerId+' · '+event.stat;
    const row=['Set '+(setIndex+1),game[event.team],action];
    if(event.type==='rally'){
     const set=state.sets[setIndex];
     if(++rallies===set?.home+set?.away){setIndex++;rallies=0;}
    }
    return row;
   });
   groups.push([{title:'Game flow',first:72,left:[1,2],headers:['Set','Team','Event'],rows}]);
  }
  const status=state.completed?'FINAL · '+game[state.setsWon.home>state.setsWon.away?'home':'away']+' wins':
   'IN PROGRESS · Set '+(state.sets.length+1)+' · '+game[state.serving]+' serving';
  return {sport:'Volleyball',teams,status:status+' · Best of '+game.bestOf,groups,
   note:'Score header shows sets won. Player stats and rally points are recorded separately.'};
 }
 return {model};
})();
