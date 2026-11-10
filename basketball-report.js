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
 el('shotLocationTitle').textContent=SoccerBrand.name(state,play.team)+' · Q'+play.period+' '+play.time+' · '+playLabel(play);
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

function basketballBoxScorePdf(game,gameClock,preset='one',selected=[]){
 const compact=preset==='one',full=preset==='full';
 const include=section=>full||(compact?['periods','teams','players'].includes(section):selected.includes(section));
 const {fresh,totals,teams,periods}=basketballBoxScore(game);
 const doc=new window.jspdf.jsPDF({unit:'pt',format:'letter',orientation:compact?'landscape':'portrait',compress:true});
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
 const shot=(made,attempted,pct=false)=>made+'-'+attempted+(pct&&attempted?' ('+Math.round(100*made/attempted)+'%)':'');
 const statCells=(p,pct=false)=>[p.pts,shot(p.fgm,p.fga,pct),shot(p.tm,p.ta,pct),shot(p.ftm,p.fta,pct),p.ast];
 const roster=Object.fromEntries(order.map(t=>[t,new Map((game.rosters?.[t]||[]).map(p=>[String(p.number),p.name]))]));
 const playerName=(t,n)=>n==null||n==='Unassigned'?'Unassigned':('#'+n+' '+(roster[t].get(String(n))||'')).trim();
 const playerRows=t=>[...new Set([...roster[t].keys(),...Object.keys(totals[t])])]
  .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))
  .map(n=>[playerName(t,n),...statCells(totals[t][n]||fresh())]);
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
  text(compact?'BASKETBALL BOX SCORE':'BASKETBALL GAME REPORT',margin+width,45,{size:10,bold:true,align:'right'});
  text(order.map(t=>name(t)+' '+score(t)).join('  |  '),margin,67,{size:15,bold:true,maxWidth:width});
  const stage=game.libraryStatus==='completed'?'FINAL':'IN PROGRESS / Q'+game.period+' '+gameClock;
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
  const firstPeriod=compact?Math.max(1,periodCount-batch+1):1;
  for(let first=firstPeriod;first<=periodCount;first+=batch){
   const quarters=Array.from({length:Math.min(batch,periodCount-first+1)},(_,i)=>first+i);
   const widths=[width*.4,...Array(quarters.length+1).fill(width*.6/(quarters.length+1))];
   table('Score by period',['TEAM',...quarters.map(q=>'Q'+q),'TOTAL'],widths,
    order.map(t=>[name(t),...quarters.map(q=>complete(t)?periods[t][q]||0:'-'),score(t)]));
  }
  if(order.some(t=>!complete(t))||firstPeriod>1){
   text(firstPeriod>1?'The one-page report shows the most recent eight periods.':
    'Period scores are unavailable where the play log and scoreboard differ.',margin,y-2,{size:8,color:muted});
   y+=9;
  }
 }
 function players(){
  const headers=['PLAYER','PTS','FG','3PT','FT','AST'];
  const rows=Object.fromEntries(order.map(t=>[t,playerRows(t)]));
  const heading=t=>name(t)+'  |  Fouls '+(game.fouls?.[t]??'-')+'  |  TO left '+(game.timeouts?.[t]??'-');
  const total=t=>['Recorded team totals',...statCells(teams[t],true)];
  if(!compact){
   for(const t of order)table(heading(t),headers,[215,53,76,76,76,52],rows[t],{total:total(t)});
   return;
  }
  const start=y,half=(width-14)/2;
  const height=Math.min(18,(bottom-start-23)/(Math.max(1,...order.map(t=>rows[t].length))+1));
  const size=Math.min(10,height*.65);
  const widths=[half-225,34,53,53,53,32];
  order.forEach((t,i)=>{
   y=start;
   const x=margin+i*(half+14);
   text(name(t)+' · Player box score',x,y+12,{size:10,bold:true,maxWidth:half});
   y+=20;
   row(headers,widths,{x,size,height,header:true});
   (rows[t].length?rows[t]:[['None recorded']]).forEach((values,j)=>row(values,widths,{x,size,height,stripe:j%2===0}));
  });
 }
 function teamComparison(){
  if(compact){
   const widths=[.26,.08,.13,.13,.13,.07,.09,.11].map(fraction=>width*fraction);
   const rows=order.map(t=>[name(t),score(t),...statCells(teams[t],true).slice(1),game.fouls?.[t]??'-',game.timeouts?.[t]??'-']);
   table('Team comparison',['TEAM','PTS','FG','3PT','FT','AST','FOULS','TO LEFT'],widths,rows);
   return;
  }
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
   subs.map(e=>[name(e.team),'Q'+e.period+' '+e.time,format(e.team,String(e.out||'').split(', ').filter(Boolean)),
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
   return [label+detail,'Q'+e.period+' '+e.time,name(e.team),order.map(t=>running[t]).join('-')];
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
 if(compact&&include('teams'))teamComparison();
 if(include('players'))players();
 if(!compact&&include('teams'))teamComparison();
 if(include('charts'))shotCharts();
 if(include('lineups'))lineups();
 if(include('log'))playByPlay();
 const pages=doc.getNumberOfPages();
 for(let p=1;p<=pages;p++){
  doc.setPage(p);
  text('Shooting columns use makes-attempts. Log scores reflect recorded plays.',margin,pageHeight-19,{size:8,color:muted});
  text(p+' / '+pages,margin+width,pageHeight-19,{size:8,color:muted,align:'right'});
 }
 return doc;
}
