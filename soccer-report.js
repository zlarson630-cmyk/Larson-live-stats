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
  const doc=new window.jspdf.jsPDF({unit:'pt',format:'letter'}),m=38,w=536,bottom=738;
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
  function page(first=false){if(!first)doc.addPage();rect(0,0,612,6,red);rect(m,22,25,25,red);text('Z',m+7,41,19,bold,'#ffffff');text('LARSON LIVE STATS',m+35,40,20,heading);text('SOCCER / MATCH REPORT',574,39,9,bold,muted,{align:'right'});rect(m,57,w,1,'#dce2e8');y=78}
  function ensure(height){if(y+height>bottom)page()}
  function section(title){ensure(105);y+=12;text(title.toUpperCase(),m,y+17,17,heading);rect(m,y+24,28,3,red);y+=38}
  // Table rows wrap within cells and continue across pages with repeated headers.
  function table(headers,widths,rows,accent=ink){
   function header(){rect(m,y,w,25,accent);let x=m;headers.forEach((v,i)=>{text(v,x+7,y+16,9,bold,'#ffffff');x+=widths[i]});y+=25}
   ensure(49);header();
   if(!rows.length)rows=[['No events recorded',...headers.slice(1).map(()=> '')]];
   rows.forEach((cells,index)=>{
    const lines=cells.map((v,i)=>wrap(v,widths[i]-14,10)),count=Math.max(...lines.map(a=>a.length));let offset=0;
    while(offset<count){
     if(y+25>bottom){page();header()}
     const take=Math.min(count-offset,Math.max(1,Math.floor((bottom-y-12)/13))),height=Math.max(27,take*13+12);
     rect(m,y,w,height,index%2?'#ffffff':'#f0f3f6');rect(m,y,3,height,accent);let x=m;
     lines.forEach((items,i)=>{items.slice(offset,offset+take).forEach((v,j)=>text(v,x+7,y+16+j*13,10,i===0?bold:regular));x+=widths[i]});
     y+=height;offset+=take;
    }
   });y+=5;
  }
  const events=match.events||[],tally=(t,k)=>events.filter(e=>e.team===t&&e.kind===k).length;
  page(true);
  text(match.finished?'FINAL REPORT':'IN PROGRESS',m,y+5,10,bold,red);
  text('HALF '+match.period+'  /  '+fmt(match.seconds),574,y+5,10,bold,muted,{align:'right'});y+=20;
  const nameLines=['home','away'].map(t=>wrap(match[t],206,22,heading));
  const scoreHeight=Math.max(105,66+Math.max(...nameLines.map(a=>a.length))*25);
  rect(m,y,w,scoreHeight,ink);
  ['home','away'].forEach((t,i)=>{const x=m+i*268;rect(x,y,268,5,color(t));text(t==='home'?'HOME':'VISITOR',x+16,y+23,9,bold,'#dce2e8');nameLines[i].forEach((line,j)=>text(line,x+16,y+49+j*25,22,heading,'#ffffff'));text(tally(t,'Goal'),x+246,y+scoreHeight-15,37,heading,'#ffffff',{align:'right'})});y+=scoreHeight+18;
  text('Clock: '+(SoccerClock.mode(match)==='down'?'COUNT DOWN':'COUNT UP')+' / '+(SoccerClock.duration(match)/60)+' minute halves',m,y,9,regular,muted);y+=12;
  text("'left' marks time remaining; other event times show elapsed time. Generated "+new Date().toLocaleString(),m,y,8,regular,muted);y+=7;
  section('Team comparison');
  const definitions=[['Goals','Goal'],['Shots on goal','Shot on goal'],['Shots off target','Shot off target'],['Saves','Save'],['Corners','Corner'],['Fouls','Foul'],['Yellow cards','Yellow card'],['Red cards','Red card'],['Offsides','Offside']];if(match.trackCrosses||match.trackedStats?.includes('Cross'))definitions.push(['Crosses','Cross']);if(match.trackedStats?.includes('Free kick'))definitions.push(['Free kicks','Free kick']);if(match.trackedStats?.includes('Team save'))definitions.push(['Team saves','Team save']);if(match.trackedStats?.includes('Injury timeout'))definitions.push(['Injury timeouts','Injury timeout']);
  table(['HOME','STATISTIC','VISITOR'],[110,316,110],definitions.map(([label,k])=>[tally('home',k)+(k==='Shot on goal'?tally('home','Goal'):0),label,tally('away',k)+(k==='Shot on goal'?tally('away','Goal'):0)]));
  section('Scoring summary');
  const ordered=SoccerClock.order(events,match);
  table(['HALF / TIME','TEAM','GOAL / ASSIST'],[80,150,306],ordered.filter(e=>e.kind==='Goal').map(e=>['H'+e.period+' '+SoccerClock.timeLabel(e,fmt),match[e.team],(e.player||'Unassigned')+(e.assist?' / Assist: '+e.assist:'')]));
  for(const t of ['home','away']){
   ensure(170);section((t==='home'?'Home':'Visitor')+' player statistics');
   // Team names are table content, so long school names wrap safely.
   table(['TEAM'],[536],[[match[t]]],ink);
   const names=[...new Set([...(match.rosters?.[t]||[]),...events.filter(e=>e.team===t).flatMap(e=>[e.player,e.assist]).filter(Boolean)])];
   table(['PLAYER','G','A','SOG','OFF','SV','F','YC','RC'],[224,32,32,44,44,40,40,40,40],names.map(p=>{
    const n=k=>events.filter(e=>e.team===t&&e.player===p&&e.kind===k).length;
    return [p,n('Goal'),events.filter(e=>e.team===t&&e.kind==='Goal'&&e.assist===p).length,n('Goal')+n('Shot on goal'),n('Shot off target'),n('Save'),n('Foul'),n('Yellow card'),n('Red card')];
   }));
   // A thin jersey-color rule retains contrast even for white or yellow uniforms.
   rect(m,y-5,w,3,color(t));
  }
  ensure(32);text('G Goals   A Assists   SOG Shots on goal   OFF Off target   SV Saves   F Fouls   YC / RC Cards',m,y+13,8,regular,muted);y+=24;
  section('Game flow');
  table(['HALF / TIME','TEAM','EVENT / PLAYER'],[80,150,306],ordered.map(e=>['H'+e.period+' '+SoccerClock.timeLabel(e,fmt),match[e.team],e.kind+(e.player?' / '+e.player:'')+(e.assist?' / Assist: '+e.assist:'')]));
  const total=doc.getNumberOfPages();
  for(let i=1;i<=total;i++){doc.setPage(i);rect(m,758,w,1,'#dce2e8');text('LARSON LIVE STATS  /  SOCCER',m,775,8,bold,muted);text(i+' / '+total,574,775,9,bold,muted,{align:'right'})}
  doc.setProperties({title:match.home+' vs '+match.away+' - Soccer Stats',author:'Larson Live Stats',subject:'Soccer match statistics'});
  return doc;
 }
 async function download(match){const doc=await build(match),slug=v=>String(v).replace(/[^a-z0-9]+/gi,'-').slice(0,24);doc.save('soccer-stats-'+slug(match.away)+'-at-'+slug(match.home)+'.pdf')}
 return {build,download};
})();
