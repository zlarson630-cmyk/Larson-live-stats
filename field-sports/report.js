window.FieldReport = (() => {
  const E=window.FieldSports;
  let fonts;
  function loadFonts() {
    fonts ||= Promise.all(['Barlow-Regular','Barlow-Bold','BarlowCondensed-Bold'].map(async name=>{
      const response=await fetch('fonts/'+name+'.ttf');
      if(!response.ok)throw Error('Report font unavailable.');
      const bytes=new Uint8Array(await response.arrayBuffer());
      let binary='';
      for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      return {name,data:btoa(binary)};
    })).catch(()=>{fonts=null;return [];});
    return fonts;
  }

  function status(game,state,now) {
    if(state.final)return 'FINAL';
    const phase=game.sport==='football'
      ?(state.period>4?'OT'+(state.period-4):'Q'+state.period)+' · '+E.clockText(E.clock(state,now))
      :(state.half==='top'?'Top ':'Bottom ')+state.period+' · '+state.outs+' out · '+state.balls+'–'+state.strikes+' count';
    const situation=game.sport==='football'
      ?game.teams[state.possession]+' ball · Down '+state.down+' & '+state.distance
      :state.bases.some(Boolean)?'Runners '+state.bases.flatMap((occupied,i)=>occupied?[['1st','2nd','3rd'][i]]:[]).join(', '):'Bases empty';
    return 'IN PROGRESS · '+phase+' · '+situation;
  }

  function compactModel(game,now=Date.now()) {
    const state=E.replay(game),tables=E.tables(game,state),football=game.sport==='football';
    const line=tables.line,totals=football?1:3;
    const shown=[0,...line.headers.map((_,i)=>i).slice(1,-totals).slice(-12),...line.headers.map((_,i)=>i).slice(-totals)];
    const omitted=shown.length<line.headers.length;
    const teams=E.sides.map(side=>({name:game.teams[side],score:state.scores[side],color:game.colors[side]}));
    const teamTables=(title,data,maxRows)=>E.sides.map(side=>({
      title:game.teams[side]+' · '+title,headers:football?data.headers.map(label=>({'C/ATT':'C/A','REC YD':'RECY'}[label]||label)):data.headers,rows:data.rows[side],maxRows
    }));
    const recent=state.plays.slice(-5).reverse().map(play=>[E.playContext(game,play),E.playLabel(game,play)]);
    const groups=[
      [{title:(football?'Scoring by period':'Line score')+(omitted?' · Recent periods':''),first:140,
        headers:shown.map(i=>line.headers[i]),rows:line.rows.map(row=>shown.map(i=>row[i]))}],
      [{title:'Team totals',headers:['Statistic','Visitor','Home'],rows:tables.comparison.rows,maxRows:5},
       {title:'Latest plays',headers:['Time / Period','Play'],first:78,left:[1],rows:recent,maxRows:5}],
      teamTables(football?'Player box score':'Batting',tables.players,football?15:9),
    ];
    if(!football)groups.push(teamTables('Pitching',tables.pitching,5));
    return {sport:E.sports[game.sport].name,teams,status:status(game,state,now),groups,
      note:'LARSON LIVE STATS · Full stats PDF includes all player rows and the complete game log.'};
  }

  async function build(game,now=Date.now()) {
    const doc=new window.jspdf.jsPDF({unit:'pt',format:'letter'});
    const state=E.replay(game), tables=E.tables(game,state), sport=E.sports[game.sport].name;
    const assets=await loadFonts();
    for(const {name,data} of assets){doc.addFileToVFS(name+'.ttf',data);doc.addFont(name+'.ttf',name,'normal');}
    const body=assets.length?'Barlow-Regular':'helvetica', bold=assets.length?'Barlow-Bold':'helvetica',
      display=assets.length?'BarlowCondensed-Bold':'helvetica';
    const left=37,width=538,bottom=738,navy='#142339',red='#c72536',gray='#546678';
    let y=0;
    const clean=value=>String(value??'').replace(/[\x00-\x1f]/g,' ');
    function face(size,font=body,color=navy){doc.setFont(font,'normal');doc.setFontSize(size);doc.setTextColor(color);}
    function text(value,x,top,size=10,font=body,color=navy,opts){face(size,font,color);doc.text(clean(value),x,top,opts);}
    function wrap(value,w,size=10,font=body){face(size,font);return doc.splitTextToSize(clean(value),w);}
    function box(x,top,w,h,color){doc.setFillColor(color);doc.rect(x,top,w,h,'F');}
    function page(first=false){
      if(!first)doc.addPage();
      box(0,0,612,792,'#ffffff');
      box(0,0,612,6,red);
      box(left,25,25,25,red);
      text('Z',left+7,44,19,bold,'#ffffff');
      text('LARSON LIVE STATS',left+35,44,22,display);
      text(sport.toUpperCase()+' / BOX SCORE',575,43,10,bold,gray,{align:'right'});
      box(left,60,width,1,'#d7dfe9');
      y=79;
    }
    function room(n){if(y+n>bottom)page();}
    function heading(label){
      room(84);
      y+=11;
      text(label.toUpperCase(),left,y+12,18,display);
      box(left,y+17,32,3,red);
      y+=29;
    }
    function table(headers,rows,columns,accent=navy) {
      const widths=columns||headers.map((_,i)=>i===0?145:(width-145)/(headers.length-1));
      const positions=widths.map((_,i)=>left+widths.slice(0,i).reduce((a,b)=>a+b,0));
      function header(){
        const labels=headers.map((name,i)=>wrap(name,widths[i]-12,9,bold));
        const h=13+11*Math.max(...labels.map(label=>label.length));
        room(h+22);
        box(left,y,width,h,accent);
        labels.forEach((label,i)=>label.forEach((line,n)=>text(line,positions[i]+6,y+14+n*11,9,bold,'#fff')));
        y+=h;
      }
      header();
      for(const [index,row] of rows.entries()){
        const cells=row.map((value,i)=>wrap(value,widths[i]-12,10,i===0?bold:body));
        const count=Math.max(...cells.map(cell=>cell.length));
        let offset=0;
        while(offset<count){
          if(y+24>bottom){page();header();}
          const take=Math.min(count-offset,Math.max(1,Math.floor((bottom-y-9)/12)));
          const h=Math.max(22,9+12*take);
          box(left,y,width,h,index%2?'#ffffff':'#eef2f7');
          cells.forEach((lines,i)=>lines.slice(offset,offset+take).forEach((line,n)=>text(line,positions[i]+6,y+14+n*12,10,i===0?bold:body)));
          y+=h;
          offset+=take;
        }
      }
      y+=7;
    }
    page(true);
    const statusLines=wrap(status(game,state,now),width,10,bold);
    statusLines.forEach((line,i)=>text(line,left,y+4+i*12,10,bold,red));
    y+=13+(statusLines.length-1)*12;
    const names=E.sides.map(side=>wrap(game.teams[side],228,24,display));
    const h=86+Math.max(...names.map(name=>name.length))*24;
    box(left,y,width,h,navy);
    E.sides.forEach((side,i)=>{
      const x=left+i*width/2;
      box(x,y,width/2,5,game.colors[side]);
      text(side==='home'?'HOME':'VISITOR',x+14,y+25,9,bold,'#c6d6eb');
      names[i].forEach((name,n)=>text(name,x+14,y+49+n*24,24,display,'#ffffff'));
      text(state.scores[side],x+width/2-14,y+h-13,41,display,'#ffffff',{align:'right'});
    });
    y+=h+12;
    heading(game.sport==='football'?'Scoring by period':'Line score');
    const line=tables.line;
    if(line.headers.length>15){
      for(let i=1;i<line.headers.length;i+=14){
        const columns=[0,...line.headers.map((_,index)=>index).slice(i,i+14)];
        table(columns.map(n=>line.headers[n]),line.rows.map(row=>columns.map(n=>row[n])));
      }
    }else table(line.headers,line.rows);
    heading('Team comparison');
    table(tables.comparison.headers,tables.comparison.rows,[206,166,166]);
    for(const side of E.sides){
      heading(game.teams[side]+(game.sport==='football'?' · Player stats':' · Batting'));
      const stats=tables.players.rows[side];
      if(stats.length)table(tables.players.headers,stats);
      else{text('No player stats recorded.',left,y+11,10,body,gray);y+=24;}
      if(game.sport!=='football'){
        heading(game.teams[side]+' · Pitching');
        const pitching=tables.pitching.rows[side];
        if(pitching.length)table(tables.pitching.headers,pitching);
        else{text('No pitching stats recorded.',left,y+11,10,body,gray);y+=24;}
      }
    }
    heading('Game flow');
    if(state.plays.length)table(['Time / period','Team','Play'],
      state.plays.map(p=>[E.playContext(game,p),game.teams[p.team],E.playLabel(game,p)]),[106,142,290]);
    else text('No plays recorded.',left,y+11,10,body,gray);
    const count=doc.getNumberOfPages();
    for(let n=1;n<=count;n++){
      doc.setPage(n);
      box(left,755,width,1,'#d7dfe9');
      text('LARSON LIVE STATS  /  '+sport.toUpperCase(),left,773,8,bold,gray);
      text(n+' / '+count,575,773,8,bold,gray,{align:'right'});
    }
    doc.setProperties({title:game.teams.away+' at '+game.teams.home+' · '+sport,author:'Larson Live Stats'});
    return doc;
  }

  async function download(game,preset='full',now=Date.now()) {
    if(preset==='one')return window.SportReport.download(compactModel(game,now));
    const doc=await build(game,now);
    const slug=side=>game.teams[side].toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,32)||side;
    doc.save(game.sport+'-'+slug('away')+'-at-'+slug('home')+'-full-stats.pdf');
  }
  return {build,compactModel,download};
})();
