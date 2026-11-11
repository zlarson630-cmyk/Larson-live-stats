/* Basketball reports and shot locations use the scorer's current game snapshot. */
function openBasketballPdf(){
 if(state&&canWrite())el('basketballPdfDialog').showModal();
}
function downloadBasketballPdf(preset){
 if(!state||!canWrite())return;
 if(!window.jspdf?.jsPDF){
  scorerToast('PDF export is unavailable. Check your connection and refresh.',true);
  return;
 }
 const sections=preset==='selected'?[...el('basketballPdfOptions').querySelectorAll('input:checked')].map(input=>input.value):[];
 if(preset==='selected'&&!sections.length){
  el('basketballPdfStatus').textContent='Choose at least one section.';
  return;
 }
 const game=state,clock=stamp(game);
 try{
  basketballBoxScorePdf(game,clock,preset,sections).save(
   'basketball-'+(preset==='one'?'box-score':'report')+'-'+id+'-q'+game.period+'-'+clock.replace(':','-')+'.pdf');
  el('basketballPdfStatus').textContent='';
  if(el('basketballPdfDialog').open)el('basketballPdfDialog').close();
 }catch(error){
  console.error('Basketball PDF export failed',error);
  scorerToast('Could not download the report. Try again.',true);
 }
}

const basketballCourt={width:50,depth:47};
function basketballCourtLines(){
 const arc=(x,y,r,start,end)=>Array.from({length:25},(_,i)=>{
  const angle=start+(end-start)*i/24;
  return [x+r*Math.cos(angle),y+r*Math.sin(angle)];
 });
 return [
  [[0,0],[50,0],[50,47],[0,47],[0,0]],
  [[19,0],[19,19],[31,19],[31,0]], [[22,4],[28,4]],
  arc(25,5.25,.75,0,2*Math.PI),arc(25,19,6,0,2*Math.PI),
  [[5.25,0],...arc(25,5.25,19.75,Math.PI,0),[44.75,0]],
  arc(25,47,6,Math.PI,2*Math.PI),
 ];
}
function basketballFieldGoal(play){
 return ['score','miss'].includes(play?.kind)&&[2,3].includes(Number(play.points));
}
function basketballShotLocation(play){
 const p=play?.shotLocation;
 return basketballFieldGoal(play)&&p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
  p.x>=0&&p.x<=basketballCourt.width&&p.y>=0&&p.y<=basketballCourt.depth?p:null;
}
let basketballShotTarget=null,basketballShotPoint=null;
function openBasketballShotLocation(eid){
 if(!canWrite())return;
 const play=state?.events.find(event=>event.id===eid);
 if(!basketballFieldGoal(play))return;
 basketballShotTarget={game:id,eid};
 basketballShotPoint=basketballShotLocation(play);
 el('shotLocationTitle').textContent=SoccerBrand.name(state,play.team)+' · '+basketballPeriodLabel(state,play.period)+' '+play.time+' · '+playLabel(play);
 el('shotLocationStatus').textContent='';
 el('shotCourt').innerHTML=basketballCourtLines().map(points=>
  '<polyline points="'+points.map(p=>p.join(',')).join(' ')+'"/>').join('')+'<circle id="shotCourtMarker" r="1"/>';
 updateBasketballShotPoint();
 el('shotLocationDialog').showModal();
}
function updateBasketballShotPoint(){
 const point=basketballShotPoint,marker=el('shotCourtMarker');
 marker.style.display=point?'':'none';
 marker.setAttribute('cx',point?.x??0);
 marker.setAttribute('cy',point?.y??0);
 el('shotLocationSave').disabled=!point;
 el('shotLocationStatus').textContent=point?'Location selected. Save to apply.':'Select a spot on the court.';
}
function pickBasketballShotPoint(event){
 const rect=event.currentTarget.getBoundingClientRect();
 moveBasketballShotPoint((event.clientX-rect.left)/rect.width*basketballCourt.width,
  (event.clientY-rect.top)/rect.height*basketballCourt.depth);
}
function basketballShotKeys(event){
 const offset={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
 if(!offset)return;
 event.preventDefault();
 const p=basketballShotPoint||{x:25,y:16};
 moveBasketballShotPoint(p.x+offset[0],p.y+offset[1]);
}
function moveBasketballShotPoint(x,y){
 basketballShotPoint={x:Math.round(10*Math.max(0,Math.min(basketballCourt.width,x)))/10,
  y:Math.round(10*Math.max(0,Math.min(basketballCourt.depth,y)))/10};
 updateBasketballShotPoint();
}
async function saveBasketballShotLocation(clear=false){
 const target=basketballShotTarget,point=basketballShotPoint;
 if(!target||target.game!==id||!canWrite()||(!clear&&!point))return;
 const dialog=el('shotLocationDialog'),save=el('shotLocationSave'),remove=el('shotLocationRemove');
 if(remove.disabled)return;
 save.disabled=remove.disabled=true;
 try{
  const saved=await write(game=>{
   const play=game.events.find(event=>event.id===target.eid);
   if(!basketballFieldGoal(play))throw Error('This shot changed. Reopen it to set a location.');
   if(clear)delete play.shotLocation;
   else play.shotLocation=point;
  });
  if(saved&&basketballShotTarget===target)dialog.close();
  else if(basketballShotTarget===target)el('shotLocationStatus').textContent='Location could not be saved. Reopen the shot and try again.';
 }finally{
  remove.disabled=false;
  save.disabled=!basketballShotPoint;
 }
}

function basketballOnePageBoxScore(game,gameClock){
 const {fresh,totals,teams,periods}=basketballBoxScore(game);
 const order=game.screenSidesSwapped?['home','away']:['away','home'];
 const events=game.events||[], name=t=>SoccerBrand.name(game,t), score=t=>game.scores?.[t]??0;
 const book=['basic','streamlined'].includes(game.scoringMode);
 const playerStats=game.scoringMode!=='basic'||game.phoneBookStats;
 const advanced=['full','fullchart'].includes(game.scoringMode)||game.demo;
 const complete=t=>Object.values(periods[t]).reduce((sum,points)=>sum+points,0)===score(t);
 const rosters=Object.fromEntries(order.map(t=>[t,new Map((game.rosters?.[t]||[]).map(p=>[String(p.number),p.name]))]));
 const players=Object.fromEntries(order.map(t=>[t,playerStats?[...new Set([...rosters[t].keys(),...Object.keys(totals[t])])]:[]]));
 for(const t of order){
  const starters=(game.startingLineups?.[t]||[]).map(String);
  const rank=n=>starters.includes(n)?starters.indexOf(n):starters.length;
  players[t].sort((a,b)=>rank(a)-rank(b)||a.localeCompare(b,undefined,{numeric:true}));
 }
 const count=order.reduce((sum,t)=>sum+Math.max(1,players[t].length),0);
 const format=count>88?[792,Math.max(1224,240+count*11)]:count>63?'tabloid':count>46?'legal':'letter';
 const doc=new window.jspdf.jsPDF({unit:'pt',format,orientation:'portrait',compress:true});
 const pageWidth=doc.internal.pageSize.getWidth(),pageHeight=doc.internal.pageSize.getHeight();
 const margin=22,width=pageWidth-2*margin,gap=10,boxWidth=Math.round(width*.72),shootWidth=width-boxWidth-gap;
 const ink='#142033',muted='#475569',red='#ed1e26',rule='#d5dee8',pale='#f2f5f9';
 const clean=value=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/[\u2010-\u2014]/g,'-');
 const text=(value,x,y,{size=8.5,bold=false,color=ink,align='left',maxWidth}={})=>{
  doc.setFont('helvetica',bold?'bold':'normal').setFontSize(size).setTextColor(color);
  let label=clean(value);
  if(maxWidth&&doc.getTextWidth(label)>maxWidth){
   while(label&&doc.getTextWidth(label+'...')>maxWidth)label=label.slice(0,-1);
   label+='...';
  }
  doc.text(label,x,y,{align});
 };
 const fill=(x,y,w,h,color)=>doc.setFillColor(color).rect(x,y,w,h,'F');
 const line=(x,y,w)=>doc.setDrawColor(rule).setLineWidth(.55).line(x,y,x+w,y);
 const pairs=[['fgm','fga'],['tm','ta'],['ftm','fta']];
 const attempts=(stat,made,tried)=>book?String(stat[made]??0):(stat[made]??0)+'-'+(stat[tried]??0);
 const percent=(stat,made,tried)=>book||game.statCoveragePartial||!stat[tried]?'':(100*stat[made]/stat[tried]).toFixed(1)+'%';
 const lastPeriod=Math.max(1,Number(game.period)||1,...events.map(e=>Number(e.period)||1));
 const firstPeriod=Math.max(1,lastPeriod-7);
 const periodList=Array.from({length:lastPeriod-firstPeriod+1},(_,i)=>firstPeriod+i);
 const periodStats=periodList.map(period=>basketballBoxScore({...game,events:events.filter(e=>e.period===period)}).teams);
 const phase=period=>basketballPeriodLabel(game,period);
 const minutesLabel=seconds=>seconds==null?'-':Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
 const accent=t=>{
  const color=game.teamBrands?.[t]?.scheme?.accent||game.colors?.[t];
  return /^#[\da-f]{6}$/i.test(color)&&color.toLowerCase()!=='#ffffff'?color:red;
 };
 function row(values,widths,x,y,height,{size=8.5,header=false,total=false,stripe=false}={}){
  const span=widths.reduce((sum,col)=>sum+col,0);
  if(header||total||stripe)fill(x,y,span,height,header?'#e7edf4':total?'#e9eff5':pale);
  if(total)line(x,y,span);
  widths.forEach((col,i)=>{
   text(values[i],x+(i===0?4:col/2),y+height/2+size*.34,{size,bold:header||total,align:i===0?'left':'center',maxWidth:col-(i===0?8:3)});
   x+=col;
  });
 }
 function heading(label,x,top,w,color=red){
  fill(x,top,w,20,ink);
  fill(x,top,3,20,color);
  text(label,x+8,top+13.5,{size:10,bold:true,color:'#ffffff',maxWidth:w-16});
 }
 fill(0,0,pageWidth,pageHeight,'#ffffff');
 fill(margin,22,22,22,red);
 text('Z',margin+11,38,{size:15,bold:true,color:'#ffffff',align:'center'});
 text('LARSON LIVE STATS',margin+29,32,{size:11,bold:true});
 text('BASKETBALL BOX SCORE',margin+29,43,{size:8,bold:true,color:muted});
 const final=game.libraryStatus==='completed';
 text(final?'FINAL':phase(game.period)+'  '+gameClock,margin+width,32,{size:11,bold:true,align:'right'});
 const timestamp=game.scheduledAt||game.finalAt;
 const date=timestamp&&new Date(timestamp);
 const meta=[date&&!Number.isNaN(date.getTime())?date.toLocaleDateString('en-US'):'',game.demo?'DEMO GAME':game.id?'GAME '+game.id:''].filter(Boolean);
 text(meta.join('  /  '),margin+width,43,{size:8,color:muted,align:'right'});
 text(order.map(t=>name(t)+'  '+score(t)).join('   /   '),margin,69,{size:17,bold:true,maxWidth:width});
 fill(margin,77,width,2,red);
 let y=91;
 const shootingHeight=37+19*(periodList.length+1);
 const tableBudget=pageHeight-y-172;
 const rowHeight=Math.min(18,(tableBudget-108)/count,
  ...order.map(t=>(tableBudget-shootingHeight-54)/Math.max(1,players[t].length)));
 const size=Math.min(9.1,Math.max(7.4,rowHeight*.7));
 const advancedKeys=['oreb','dreb','reb','ast','to','stl','blk'];
 const columns=advanced?['PLAYER','MIN','PTS','FG','3PT','FT','OR','DR','REB','PF','TF','AST','TO','STL','BLK']:['PLAYER','PTS','FG','3PT','FT','PF','TF'];
 const weights=advanced?[102,27,20,29,29,29,18,18,22,19,17,19,19,19,20]:[164,30,45,45,45,26,26];
 const divisor=weights.reduce((a,b)=>a+b,0);
 const playerWidths=weights.map(n=>n*boxWidth/divisor);
 const shotRow=stat=>pairs.map(([made,tried])=>attempts(stat,made,tried));
 for(const t of order){
  const top=y,x=margin+boxWidth+gap;
  heading(name(t)+'  /  '+score(t),margin,top,boxWidth,accent(t));
  heading('Shooting by period',x,top,shootWidth,accent(t));
  const minutes=advanced&&!game.statCoveragePartial&&typeof wfMinutes==='function'?wfMinutes(game,t):null;
  const playerName=n=>n==='Unassigned'?'Unassigned / team':('#'+n+' '+(rosters[t].get(n)||'')).trim();
  const cells=(label,stat,time,points,isTotal=false)=>[
   label,...(advanced?[time]:[]),points,...shotRow(stat),
   ...(advanced?advancedKeys.slice(0,3).map(key=>stat[key]??'-'):[]),isTotal?(game.fouls?.[t]??'-'):(stat.pf??'-'),stat.tf??'-',
   ...(advanced?advancedKeys.slice(3).map(key=>stat[key]??'-'):[])
  ];
  y+=20;
  row(columns,playerWidths,margin,y,17,{header:true,size:7.7});y+=17;
  if(!players[t].length){
   row([playerStats?'No players recorded':'Team totals only'],playerWidths,margin,y,rowHeight,{size});
   y+=rowHeight;
  }
  players[t].forEach((n,i)=>{
   const stat=totals[t][n]||fresh();
   row(cells(playerName(n),stat,minutesLabel(n==='Unassigned'?null:minutes?.[n]??(minutes?0:null)),stat.pts),playerWidths,margin,y,rowHeight,{size,stripe:i%2===0});
   y+=rowHeight;
  });
  row(cells('Totals',teams[t],'-',score(t),true),playerWidths,margin,y,17,{total:true,size:8.4});
  y+=17;
  const shootCols=[31,...Array(3).fill((shootWidth-31)/3)];
  row(['','FG','3PT','FT'],shootCols,x,top+20,17,{header:true,size:7.8});
  [...periodList.map((p,i)=>[phase(p),periodStats[i][t]]),['GAME',teams[t]]].forEach(([label,stat],i)=>{
   const topRow=top+37+i*19;
   const total=i===periodList.length;
   if(total||i%2===0)fill(x,topRow,shootWidth,19,total?'#e9eff5':pale);
   text(label,x+4,topRow+12,{size:7.8,bold:total});
   pairs.forEach(([made,tried],col)=>{
    const center=x+31+(col+.5)*shootCols[1],pct=percent(stat,made,tried);
    text(attempts(stat,made,tried),center,topRow+(pct?8:12),{size:8.1,bold:total,align:'center',maxWidth:shootCols[1]-3});
    if(pct)text(pct,center,topRow+16,{size:7,color:muted,align:'center'});
   });
  });
  y=Math.max(y,top+37+19*(periodList.length+1))+12;
 }
 const bottomTop=y+1,summaryW=(width-2*gap)/3;
 const summary=(title,headers,rows,index)=>{
  const x=margin+index*(summaryW+gap);
  const labelShare=index===0?.35:.46;
  const widths=[summaryW*labelShare,...Array(headers.length-1).fill(summaryW*(1-labelShare)/(headers.length-1))];
  heading(title,x,bottomTop,summaryW);
  row(headers,widths,x,bottomTop+20,15,{header:true,size:7.2});
  rows.forEach((values,i)=>row(values,widths,x,bottomTop+35+i*13,13,{size:7.7,stripe:i%2===0}));
 };
 const short=t=>game.teamBrands?.[t]?.shortName||name(t);
 summary('Score by period',['TEAM',...periodList.map(phase),'TOT'],order.map(t=>[short(t),...periodList.map(p=>complete(t)?periods[t][p]||0:'-'),score(t)]),0);
 summary('Team comparison',['STAT',...order.map(short)],[
  ['FOULS',...order.map(t=>game.fouls?.[t]??'-')],['TO LEFT',...order.map(t=>game.timeouts?.[t]??'-')],
  ...[['REB','reb'],['AST','ast'],['TURNOVERS','to']].map(([label,key])=>[label,...order.map(t=>advanced?teams[t][key]??'-':'-')])
 ],1);
 const running={away:0,home:0},lead={away:0,home:0},best={away:0,home:0};
 let leader=null,runTeam=null,run=0,changes=0,ties=0;
 for(const event of [...events].reverse()){
  if(event.kind!=='score'||!Object.hasOwn(running,event.team)||!(event.points>0))continue;
  const team=event.team,other=team==='home'?'away':'home';
  running[team]+=Number(event.points);
  run=runTeam===team?run+Number(event.points):Number(event.points);
  runTeam=team;best[team]=Math.max(best[team],run);
  const difference=running[team]-running[other];
  if(!difference)ties++;
  else if(difference>0){
   lead[team]=Math.max(lead[team],difference);
   if(leader&&leader!==team)changes++;
   leader=team;
  }
 }
 const balanced=order.every(complete);
 summary('Game trends',['STAT',...order.map(short)],[
  ['BIGGEST LEAD',...order.map(t=>balanced?lead[t]:'-')],['BEST RUN',...order.map(t=>balanced?best[t]+'-0':'-')],
  ['LEAD CHANGES',balanced?changes:'-',''],['TIMES TIED',balanced?ties:'-','']
 ],2);
 line(margin,pageHeight-34,width);
 const note=book?'Shooting shows makes only in this scoring mode.':game.statCoveragePartial?'Tracking changed during the game. Shooting and advanced stats may be partial.':'Shooting uses makes-attempts. TF is included in PF.';
 const caveats=[note,!balanced?'Period scores or trends may be unavailable where the log and scoreboard differ.':'',firstPeriod>1?'Showing the last eight periods.':''].filter(Boolean);
 caveats.forEach((note,index)=>text(note,margin,pageHeight-24+index*8,{size:7.5,color:muted,maxWidth:width-28}));
 text('1 / 1',margin+width,pageHeight-24,{size:7.5,color:muted,align:'right'});
 return doc;
}

function basketballBoxScorePdf(game,gameClock,preset='one',selected=[]){
 if(preset==='one')return basketballOnePageBoxScore(game,gameClock);
 const full=preset==='full';
 const include=section=>full||selected.includes(section);
 const {fresh,totals,teams,periods}=basketballBoxScore(game);
 const doc=new window.jspdf.jsPDF({unit:'pt',format:'letter',orientation:'portrait',compress:true});
 const pageWidth=doc.internal.pageSize.getWidth(),pageHeight=doc.internal.pageSize.getHeight();
 const margin=32,width=pageWidth-2*margin,bottom=pageHeight-39;
 const order=game.screenSidesSwapped?['home','away']:['away','home'];
 const events=game.events||[];
 const name=t=>SoccerBrand.name(game,t);
 const score=t=>game.scores?.[t]??0;
 const muted='#475569',ink='#172033';
 const clean=v=>String(v??'').replace(/[\u0000-\u001f]/g,' ');
 const periodCount=Math.max(1,Number(game.period)||1,...Object.keys(periods.home).map(Number),...Object.keys(periods.away).map(Number));
 const complete=t=>Object.values(periods[t]).reduce((sum,n)=>sum+n,0)===score(t);
 const shot=(made,attempted,pct=false)=>['basic','streamlined'].includes(game.scoringMode)?made+' made':made+'-'+attempted+(pct&&attempted&&!game.statCoveragePartial?' ('+Math.round(100*made/attempted)+'%)':'');
 const statCells=(p,pct=false)=>[p.pts,shot(p.fgm,p.fga,pct),shot(p.tm,p.ta,pct),shot(p.ftm,p.fta,pct),['basic','streamlined'].includes(game.scoringMode)?'-':p.ast];
 const roster=Object.fromEntries(order.map(t=>[t,new Map((game.rosters?.[t]||[]).map(p=>[String(p.number),p.name]))]));
 const playerName=(t,n)=>n==null||n==='Unassigned'?'Unassigned':('#'+n+' '+(roster[t].get(String(n))||'')).trim();
 const playerRows=t=>[...new Set([...roster[t].keys(),...Object.keys(totals[t])])]
  .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))
  .map(n=>[playerName(t,n),...statCells(totals[t][n]||fresh()),totals[t][n]?.pf??0]);
 let y;
 function text(value,x,baseline,{size=10,bold=false,color=ink,align='left',maxWidth}={}){
  doc.setFont('helvetica',bold?'bold':'normal').setFontSize(size).setTextColor(color);
  let label=clean(value);
  if(maxWidth&&doc.getTextWidth(label)>maxWidth){
   while(label.length&&doc.getTextWidth(label+'...')>maxWidth)label=label.slice(0,-1);
   label+='...';
  }
  doc.text(label,x,baseline,{align});
 }
 function rect(x,top,w,h,color){doc.setFillColor(color).rect(x,top,w,h,'F');}
 function page(){
  if(y!==undefined)doc.addPage();
  rect(0,0,pageWidth,pageHeight,'#ffffff');
  rect(margin,26,width,3,'#b62d43');
  rect(margin,33,19,19,'#b62d43');
  text('Z',margin+9.5,47,{size:13,bold:true,color:'#fff',align:'center'});
  text('LARSON LIVE STATS',margin+26,46,{size:11,bold:true});
  text('BASKETBALL GAME REPORT',margin+width,45,{size:10,bold:true,align:'right'});
  text(order.map(t=>name(t)+' '+score(t)).join('  |  '),margin,67,{size:15,bold:true,maxWidth:width});
  const stage=game.libraryStatus==='completed'?'FINAL':'IN PROGRESS / '+basketballPeriodLabel(game)+' '+gameClock;
  text(stage+'  /  '+(game.demo?'TEST GAME':'GAME '+game.id),margin,85,{size:9,color:muted});
  text('Possession arrow: '+(game.possession?name(game.possession):'-'),margin+width,85,{size:9,color:muted,align:'right',maxWidth:width/2});
  y=104;
 }
 function section(title){
  if(y+53>bottom)page();
  text(title,margin,y+11,{size:12,bold:true,maxWidth:width});
  y+=20;
 }
 function row(values,widths,{x=margin,size=9,height=16,header=false,total=false,stripe=false}={}){
  const w=widths.reduce((sum,n)=>sum+n,0);
  if(header||total||stripe)rect(x,y,w,height,header?'#e4e9f1':total?'#edf0f5':'#f6f8fa');
  widths.forEach((col,i)=>{
   const left=i===0;
   text(values[i],x+(left?5:col/2),y+height/2+size/3,{size,bold:header||total,align:left?'left':'center',maxWidth:col-(left?10:5)});
   x+=col;
  });
  y+=height;
 }
 function table(title,headers,widths,rows,{total=null}={}){
  const drawHeader=continued=>{section(title+(continued?' (continued)':''));row(headers,widths,{header:true});};
  if(y+64>bottom)page();
  drawHeader(false);
  const lines=rows.length?rows:[['None recorded']];
  lines.forEach((values,i)=>{
   if(y+16>bottom){page();drawHeader(true);}
   row(values,widths,{stripe:i%2===0});
  });
  if(total){
   if(y+16>bottom){page();drawHeader(true);}
   row(total,widths,{total:true});
  }
  y+=14;
 }
 function byPeriod(){
  const batch=8;
  const firstPeriod=1;
  for(let first=firstPeriod;first<=periodCount;first+=batch){
   const quarters=Array.from({length:Math.min(batch,periodCount-first+1)},(_,i)=>first+i);
   const widths=[width*.4,...Array(quarters.length+1).fill(width*.6/(quarters.length+1))];
   table('Score by period',['TEAM',...quarters.map(q=>basketballPeriodLabel(game,q)),'TOTAL'],widths,
    order.map(t=>[name(t),...quarters.map(q=>complete(t)?periods[t][q]||0:'-'),score(t)]));
  }
  if(order.some(t=>!complete(t))){
   text('Period scores are unavailable where the play log and scoreboard differ.',margin,y-2,{size:8,color:muted});
   y+=9;
  }
 }
 function players(){
  if(game.scoringMode==='basic'&&!game.phoneBookStats){section('Basic / team totals only');text('Individual statistics were not collected in this scoring mode.',margin,y+10,{size:9,color:muted});y+=24;return;}

  const headers=['PLAYER','PTS','FG','3PT','FT','AST','PF'];
  const rows=Object.fromEntries(order.map(t=>[t,playerRows(t)]));
  const heading=t=>name(t)+'  |  Fouls '+(game.fouls?.[t]??'-')+'  |  TO left '+(game.timeouts?.[t]??'-');
  const total=t=>['Recorded team totals',...statCells(teams[t],true),teams[t].pf??0];
  for(const t of order)table(heading(t),headers,[190,40,76,76,76,48,42],rows[t],{total:total(t)});
 }
 function teamComparison(){
  const rows=[
   ['Score',t=>score(t)],['Field goals',t=>shot(teams[t].fgm,teams[t].fga,true)],
   ['Three-pointers',t=>shot(teams[t].tm,teams[t].ta,true)],['Free throws',t=>shot(teams[t].ftm,teams[t].fta,true)],
   ['Assists',t=>teams[t].ast],['Team fouls',t=>game.fouls?.[t]??'-'],['Timeouts left',t=>game.timeouts?.[t]??'-'],
  ];
  table('Team comparison',['STAT',...order.map(name)],[180,184,184],rows.map(([label,value])=>[label,...order.map(value)]));
 }
 function lineups(){
  const format=(t,numbers)=>numbers?.length?numbers.map(n=>playerName(t,n)).join(', '):'Unavailable';
  for(const t of order){
   const starters=game.startingLineups?.[t]||[],onCourt=basketballOnCourt(game,t);
   const active=onCourt?[...onCourt]:[];
   const count=Math.max(starters.length,active.length);
   table(name(t)+' lineups',['POSITION','STARTERS','ON COURT'],[100,224,224],
    Array.from({length:count},(_,i)=>[i+1,starters[i]!=null?format(t,[starters[i]]):'-',active[i]!=null?format(t,[active[i]]):'-']));
  }
  const subs=events.filter(e=>e.kind==='substitution').reverse();
  table('Substitution log',['TEAM','CLOCK','OUT','IN'],[135,75,169,169],
   subs.map(e=>[name(e.team),basketballPeriodLabel(game,e.period)+' '+e.time,format(e.team,String(e.out||'').split(', ').filter(Boolean)),
    format(e.team,String(e.in||'').split(', ').filter(Boolean))]));
 }
 function playByPlay(){
  const running={home:0,away:0};
  const rows=[...events].reverse().map(e=>{
   const attempt=['score','miss'].includes(e.kind);
   if(e.kind==='score')running[e.team]+=Number(e.points)||0;
   const label=e.kind==='score'?(Number(e.points)===1?'Made FT':'Made '+e.points+'-pointer'):
    e.kind==='miss'?(Number(e.points)===1?'Missed FT':'Missed '+e.points+'-pointer'):playLabel(e);
   const detail=attempt?' / '+playerName(e.team,e.scorer)+
    (/^\d{1,2}$/.test(String(e.assist))?' / Assist '+playerName(e.team,e.assist):''):'';
   return [label+detail,basketballPeriodLabel(game,e.period)+' '+e.time,name(e.team),order.map(t=>running[t]).join('-')];
  });
  table('Play-by-play',['PLAY','CLOCK','TEAM','LOG SCORE'],[285,67,130,66],rows);
 }
 function shotCharts(){
  if(y+295>bottom)page();
  section('Shot charts');
  text('Circle = made   X = missed   /   Field-goal attempts with a recorded location',margin,y+4,{size:9,color:muted});
  y+=23;
  const scale=4.6,courtWidth=basketballCourt.width*scale,courtHeight=basketballCourt.depth*scale;
  order.forEach((t,i)=>{
   const x=margin+i*(width/2),top=y+34;
   const attempts=events.filter(e=>e.team===t&&basketballFieldGoal(e));
   const located=attempts.filter(basketballShotLocation);
   text(name(t),x,top-19,{size:11,bold:true,maxWidth:width/2-12});
   text(located.length+' of '+attempts.length+' attempts mapped',x,top-6,{size:8,color:muted});
   doc.setDrawColor('#a0adbe').setLineWidth(.55);
   basketballCourtLines().forEach(points=>points.slice(1).forEach(([bx,by],j)=>{
    const [ax,ay]=points[j];
    doc.line(x+ax*scale,top+ay*scale,x+bx*scale,top+by*scale);
   }));
   for(const e of located){
    const p=basketballShotLocation(e),cx=x+p.x*scale,cy=top+p.y*scale;
    if(e.kind==='score'){
     doc.setDrawColor('#116b4d').setLineWidth(1.05).circle(cx,cy,2.2,'S');
    }else{
     doc.setDrawColor('#a5243f').setLineWidth(1.05).line(cx-2,cy-2,cx+2,cy+2).line(cx-2,cy+2,cx+2,cy-2);
    }
   }
   if(!located.length)text('No shot locations recorded',x+courtWidth/2,top+courtHeight/2,{size:9,align:'center'});
  });
  y+=courtHeight+47;
 }
 page();
 if(include('periods'))byPeriod();
 if(include('players'))players();
 if(include('players')&&game.scoringMode==='full'){
  for(const t of order){
   const minutes=typeof wfMinutes==='function'?wfMinutes(game,t):null;
   const rows=[...new Set([...roster[t].keys(),...Object.keys(totals[t])])].map(n=>{
    const p=totals[t][n]||fresh(),seconds=minutes?.[n]??(minutes?0:null);
    return [playerName(t,n),p.oreb??0,p.dreb??0,p.reb??0,p.stl??0,p.blk??0,p.to??0,seconds==null?'-':Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')];
   });
   table(name(t)+' / Full Box',['PLAYER','OREB','DREB','REB','STL','BLK','TO','MIN'],[198,50,50,50,50,50,50,50],rows);
  }
 }
 if(include('teams'))teamComparison();
 if(include('charts'))shotCharts();
 if(include('lineups'))lineups();
 if(include('log'))playByPlay();
 const pages=doc.getNumberOfPages();
 for(let p=1;p<=pages;p++){
  doc.setPage(p);
  text(['basic','streamlined'].includes(game.scoringMode)?'Book scoring: missed shots and advanced stats are untracked. Shooting columns show makes only.':game.statCoveragePartial?'Tracking changed during the game. Shooting and advanced totals may be partial.':'Shooting columns use makes-attempts. Log scores reflect recorded plays.',margin,pageHeight-19,{size:8,color:muted,maxWidth:width-40});
  text(p+' / '+pages,margin+width,pageHeight-19,{size:8,color:muted,align:'right'});
 }
 return doc;
}
