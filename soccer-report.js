/* Soccer report renderer. Self-hosted, OFL-licensed fonts; no roster data leaves the browser. */
window.SoccerReport=(()=>{
 let fonts;
 async function loadFonts(){
  if(!fonts)fonts=Promise.all(['Barlow-Regular','Barlow-Bold','BarlowCondensed-Bold'].map(async name=>{
   const response=await fetch('fonts/'+name+'.ttf');if(!response.ok)throw Error('Font unavailable');
   const bytes=new Uint8Array(await response.arrayBuffer());let binary='';
   for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   return {name,data:btoa(binary)};
  })).catch(()=>{fonts=null;return []});
  return fonts;
 }
 async function build(match){
  const doc=new window.jspdf.jsPDF({unit:'pt',format:'letter'}),m=34,w=544,bottom=746;
  const loaded=await loadFonts();
  for(const f of loaded){doc.addFileToVFS(f.name+'.ttf',f.data);doc.addFont(f.name+'.ttf',f.name,'normal')}
  const regular=loaded.length?'Barlow-Regular':'helvetica',bold=loaded.length?'Barlow-Bold':'helvetica',heading=loaded.length?'BarlowCondensed-Bold':'helvetica';
  const ink='#252b34',red='#d71936',muted='#626d79';let y=0;
  const clean=x=>String(x??'').replace(/[\u0000-\u001f]/g,' ');
  const fmt=n=>String(Math.floor(Math.max(0,n)/60)).padStart(2,'0')+':'+String(Math.max(0,n)%60).padStart(2,'0');
  const color=t=>/^#[0-9a-f]{6}$/i.test(match.colors?.[t])?match.colors[t]:red;
  function font(size=10,face=regular,c=ink){doc.setFont(face,'normal');doc.setFontSize(size);doc.setTextColor(c)}
  function text(value,x,yy,size=10,face=regular,c=ink,opts){font(size,face,c);doc.text(clean(value),x,yy,opts)}
  function wrap(value,width,size=10,face=regular){font(size,face);return doc.splitTextToSize(clean(value),width)}
  function rect(x,yy,width,height,c){doc.setFillColor(c);doc.rect(x,yy,width,height,'F')}
  function page(first=false){if(!first)doc.addPage();rect(0,0,612,6,red);rect(m,15,19,19,red);text('Z',m+5,29,14,bold,'#ffffff');text('LARSON LIVE STATS',m+27,30,15,heading);text('SOCCER / MATCH REPORT',578,29,8,bold,muted,{align:'right'});rect(m,40,w,1,'#dce2e8');y=51}
  function ensure(height){if(y+height>bottom)page()}
  function section(title){ensure(48);y+=7;text(title.toUpperCase(),m,y+13,13,heading);rect(m,y+18,24,2,red);y+=25}
  // Table rows wrap within cells and continue across pages with repeated headers.
  function table(headers,widths,rows,accent=ink){
   function header(){rect(m,y,w,20,accent);let x=m;headers.forEach((v,i)=>{text(v,x+6,y+14,8,bold,'#ffffff');x+=widths[i]});y+=20}
   ensure(38);header();
   if(!rows.length)rows=[['No events recorded',...headers.slice(1).map(()=> '')]];
   rows.forEach((cells,index)=>{
    const lines=cells.map((v,i)=>wrap(v,widths[i]-12,9)),count=Math.max(...lines.map(a=>a.length));let offset=0;
    while(offset<count){
     if(y+19>bottom){page();header()}
     const take=Math.min(count-offset,Math.max(1,Math.floor((bottom-y-7)/11))),height=Math.max(19,take*11+8);
     rect(m,y,w,height,index%2?'#ffffff':'#f0f3f6');rect(m,y,3,height,accent);let x=m;
     lines.forEach((items,i)=>{items.slice(offset,offset+take).forEach((v,j)=>text(v,x+6,y+13+j*11,9,i===0?bold:regular));x+=widths[i]});
     y+=height;offset+=take;
    }
   });y+=3;
  }
  const events=match.events||[],tally=(t,k)=>events.filter(e=>e.team===t&&e.kind===k).length;const goals=t=>tally(t,'Goal')+tally(t,'Own goal');const shots=t=>events.filter(e=>e.team===t&&['Goal','Shot on goal','Shot off target','Blocked shot','Penalty kick'].includes(e.kind)).length;const sog=t=>events.filter(e=>e.team===t&&(e.kind==='Goal'||e.kind==='Shot on goal'||(e.kind==='Penalty kick'&&['saved','blocked'].includes(e.penaltyResult)))).length;
  page(true);
  text(match.finished?'FINAL REPORT':'IN PROGRESS',m,y+5,10,bold,red);
  text('HALF '+match.period+'  /  '+fmt(match.seconds),574,y+5,10,bold,muted,{align:'right'});y+=13;
  const nameLines=['away','home'].map(t=>wrap(match[t],218,18,heading));
  const scoreHeight=Math.max(72,42+Math.max(...nameLines.map(a=>a.length))*20);
  rect(m,y,w,scoreHeight,ink);
  ['away','home'].forEach((t,i)=>{const x=m+i*272;rect(x,y,272,4,color(t));text(t==='home'?'HOME':'VISITOR',x+12,y+17,8,bold,'#dce2e8');nameLines[i].forEach((line,j)=>text(line,x+12,y+35+j*20,18,heading,'#ffffff'));text(goals(t),x+259,y+scoreHeight-12,30,heading,'#ffffff',{align:'right'})});y+=scoreHeight+10;
  text('Clock: '+(SoccerClock.mode(match)==='down'?'COUNT DOWN':'COUNT UP')+' / '+(SoccerClock.duration(match)/60)+' minute halves',m,y,9,regular,muted);y+=10;
  text("'left' marks time remaining; other event times show elapsed time. Generated "+new Date().toLocaleString(),m,y,8,regular,muted);y+=3;
  section('Team comparison');
  const definitions=[['Goals','Goal'],['Total shots','_shots'],['Shots on goal','Shot on goal'],['Shots off target','Shot off target'],['Saves','Save'],['Corners','Corner'],['Fouls','Foul'],['Yellow cards','Yellow card'],['Red cards','Red card'],['Offsides','Offside']];if(match.trackCrosses||match.trackedStats?.includes('Cross'))definitions.push(['Crosses','Cross']);if(match.trackedStats?.includes('Free kick'))definitions.push(['Free kicks','Free kick']);if(match.trackedStats?.includes('Team save'))definitions.push(['Team saves','Team save']);if(match.trackedStats?.includes('Injury timeout'))definitions.push(['Injury timeouts','Injury timeout']);
  if(match.trackedStats?.includes('Penalty kick'))definitions.push(['Penalty kicks','_pk']);if(match.trackedStats?.includes('Own goal'))definitions.push(['Own goals','Own goal']);if(match.trackedStats?.includes('Blocked shot'))definitions.push(['Blocked shots','Blocked shot']);const stat=(t,k)=>k==='Goal'?goals(t):k==='_shots'?shots(t):k==='Shot on goal'?sog(t):k==='_pk'?events.filter(e=>e.team===t&&e.penalty).length:tally(t,k);table(['VISITOR','STATISTIC','HOME'],[88,368,88],definitions.map(([label,k])=>[stat('away',k),label,stat('home',k)]));
  section('Scoring summary');
  const ordered=SoccerClock.order(events,match);
  table(['HALF / TIME','TEAM','GOAL / ASSIST'],[80,150,306],ordered.filter(e=>e.kind==='Goal'||e.kind==='Own goal').map(e=>['H'+e.period+' '+SoccerClock.timeLabel(e,fmt),match[e.team],(e.kind==='Own goal'?'Own goal: ':'')+(e.player||'Unassigned')+(e.assist?' / Assist: '+e.assist:'')]));
  for(const t of ['home','away']){
   section((t==='home'?'Home':'Visitor')+' player statistics');text(match[t],m,y+10,10,bold,muted);y+=16;
   const names=[...new Set([...(match.rosters?.[t]||[]),...events.filter(e=>e.team===t).flatMap(e=>[e.player,e.assist]).filter(Boolean)])];
   table(['PLAYER','G','A','SOG','OFF','SV','F','YC','RC'],[232,32,32,44,44,40,40,40,40],names.map(p=>{
    const n=k=>events.filter(e=>e.team===t&&e.player===p&&e.kind===k).length;
    return [p,n('Goal'),events.filter(e=>e.team===t&&e.kind==='Goal'&&e.assist===p).length,n('Goal')+n('Shot on goal')+events.filter(e=>e.team===t&&e.player===p&&e.kind==='Penalty kick'&&['saved','blocked'].includes(e.penaltyResult)).length,n('Shot off target'),n('Save'),n('Foul'),n('Yellow card'),n('Red card')];
   }));
   // A thin jersey-color rule retains contrast even for white or yellow uniforms.
   rect(m,y-5,w,3,color(t));
  }
  ensure(24);text('G Goals   A Assists   SOG Shots on goal   OFF Off target   SV Saves   F Fouls   YC / RC Cards',m,y+13,8,regular,muted);y+=18;
  if((match.shootout||[]).length){section('Penalty shootout');const kicks=match.shootout;table(['TEAM','KICKER','RESULT'],[150,230,156],kicks.map(k=>[match[k.team],k.player||'Unassigned',k.result]));text('Shootout score: '+kicks.filter(k=>k.team==='away'&&k.result==='goal').length+' – '+kicks.filter(k=>k.team==='home'&&k.result==='goal').length,m,y+14,10,bold);y+=22}
  section('Game flow');
  table(['HALF / TIME','TEAM','EVENT / PLAYER'],[80,150,306],ordered.map(e=>['H'+e.period+' '+SoccerClock.timeLabel(e,fmt),match[e.team],e.kind+(e.player?' / '+e.player:'')+(e.assist?' / Assist: '+e.assist:'')]));
  const total=doc.getNumberOfPages();
  for(let i=1;i<=total;i++){doc.setPage(i);rect(m,763,w,1,'#dce2e8');text('LARSON LIVE STATS  /  SOCCER',m,779,8,bold,muted);text(i+' / '+total,578,779,9,bold,muted,{align:'right'})}
  doc.setProperties({title:match.home+' vs '+match.away+' - Soccer Stats',author:'Larson Live Stats',subject:'Soccer match statistics'});
  return doc;
 }
 async function download(match){const doc=await build(match),slug=v=>String(v).replace(/[^a-z0-9]+/gi,'-').slice(0,24);doc.save('soccer-stats-'+slug(match.away)+'-at-'+slug(match.home)+'.pdf')}
 return {build,download};
})();
