/* Shared print layout for compact game sheets and paginated stat reports. */
window.SportReport=(()=>{
 const ink='#172332',muted='#526174',red='#b51930',margin=30,rowHeight=14;
 const clean=value=>String(value??'–').replace(/[\x00-\x1f]/g,' ');
 function build(model,{full=false}={}){
  const doc=new window.jspdf.jsPDF({unit:'pt',format:'letter',orientation:full?'portrait':'landscape',compress:true});
  const pageWidth=doc.internal.pageSize.getWidth(),pageHeight=doc.internal.pageSize.getHeight();
  const width=pageWidth-2*margin,bottom=pageHeight-42;
  let y;
  function box(x,top,w,h,color){doc.setFillColor(color).rect(x,top,w,h,'F');}
  function text(value,x,top,{size=9,bold=false,color=ink,max,align='left'}={}){
   doc.setFont('helvetica',bold?'bold':'normal').setFontSize(size).setTextColor(color);
   let label=clean(value);
   if(max&&doc.getTextWidth(label)>max){
    while(label.length&&doc.getTextWidth(label+'...')>max)label=label.slice(0,-1);
    label+='...';
   }
   doc.text(label,x,top,{align});
  }
  function page(){
   if(y!==undefined)doc.addPage();
   box(0,0,pageWidth,pageHeight,'#ffffff');
   box(margin,24,width,3,red);
   box(margin,35,24,24,red);
   text('Z',margin+12,53,{size:17,bold:true,color:'#ffffff',align:'center'});
   text('LARSON LIVE STATS',margin+32,52,{size:13,bold:true});
   text(model.sport.toUpperCase()+' / '+(full?'FULL STATS':'ONE-PAGE BOX SCORE'),pageWidth-margin,52,{size:9,bold:true,align:'right'});
   const [away,home]=model.teams;
   for(const [i,team] of model.teams.entries()){
    const x=margin+i*width/2,w=width/2;
    box(x,66,w,31,i?'#eef2f6':'#f6f8fa');
    box(x,66,w,3,/^#[0-9a-f]{6}$/i.test(team.color)?team.color:red);
    text(team.name,x+9,87,{size:13,bold:true,max:w-62});
    text(team.score,x+w-9,87,{size:16,bold:true,align:'right'});
   }
   text(model.status,margin,113,{size:9,bold:true,max:width});
   doc.setProperties({title:away.name+' at '+home.name+' · '+model.sport,author:'Larson Live Stats'});
   y=127;
  }
  function table(spec,x,top,w,rows,continued=false){
   text(spec.title+(continued?' (continued)':''),x,top+10,{size:10,bold:true,max:w});
   top+=15;
   const first=spec.headers.length===1?w:Math.min(spec.first??(spec.headers.length>8?102:125),w*.43);
   const widths=spec.widths?spec.widths.map(fraction=>w*fraction):[first,...Array(spec.headers.length-1).fill((w-first)/Math.max(1,spec.headers.length-1))];
   function row(values,isHeader,index){
    box(x,top,w,rowHeight,isHeader?'#e1e7ef':index%2?'#f3f6f9':'#ffffff');
    let left=x;
    for(const [i,cellWidth] of widths.entries()){
     const align=i===0||spec.left?.includes(i)?'left':'center';
     text(values[i]??'',left+(align==='left'?4:cellWidth/2),top+10,{size:isHeader?(widths.length>8&&w<400?7:8):9,bold:isHeader,max:cellWidth-6,align});
     left+=cellWidth;
    }
    top+=rowHeight;
   }
   row(spec.headers,true,0);
   if(rows.length)rows.forEach((values,i)=>row(values,false,i));
   else row(['No stats recorded'],false,0);
   return top;
  }
  page();
  if(full){
   for(const spec of model.groups.flat()){
    const rows=spec.rows.length?spec.rows:[['No stats recorded']];
    let offset=0;
    while(offset<rows.length){
     if(y+15+2*rowHeight>bottom)page();
     const count=Math.floor((bottom-y-15)/rowHeight)-1;
     y=table(spec,margin,y,width,rows.slice(offset,offset+count),offset>0)+9;
     offset+=count;
    }
   }
  }else{
   for(const group of model.groups){
    const w=(width-12*(group.length-1))/group.length;
    const fit=Math.max(0,Math.floor((bottom-y-15)/rowHeight)-1);
    if(fit<1)break;
    let end=y;
    for(const [i,spec] of group.entries()){
     const cap=Math.min(fit,spec.maxRows??fit);
     const rows=spec.rows.length>cap
      ?[...spec.rows.slice(0,cap-1),['+'+String(spec.rows.length-cap+1)+' more (Full PDF)']]
      :spec.rows;
     end=Math.max(end,table(spec,margin+i*(w+12),y,w,rows));
    }
    y=end+8;
   }
  }
  const pages=doc.getNumberOfPages();
  for(let p=1;p<=pages;p++){
   doc.setPage(p);
   box(margin,pageHeight-31,width,1,'#dce2e8');
   text(model.note||'LARSON LIVE STATS',margin,pageHeight-17,{size:8,color:muted,max:width-55});
   text(p+' / '+pages,pageWidth-margin,pageHeight-17,{size:8,color:muted,align:'right'});
  }
  return doc;
 }
 function download(model,full=false){
  const slug=model.teams.map(t=>String(t.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,28)).join('-at-');
  build(model,{full}).save(model.sport.toLowerCase()+'-'+slug+'-'+(full?'full-stats':'box-score')+'.pdf');
 }
 return {build,download};
})();
