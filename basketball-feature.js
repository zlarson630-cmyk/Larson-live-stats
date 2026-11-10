/* Full-screen broadcast graphics share the existing timed OBS channel. */
window.BasketballFeature = (() => {
 const titles={intro:'Matchup Intro',upcoming:'Upcoming Games',standings:'Conference Standings'};
 const isFeature=kind=>Object.hasOwn(titles,kind);
 function logoURL(value){
  if(!value)return '';
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}
  catch{return '';}
 }
 function create(kind, fields){
  if(!isFeature(kind))throw Error('Choose a broadcast screen.');
  const conference=fields.conference.trim(),logo=logoURL(fields.logo.trim());
  if(fields.logo.trim()&&!logo)throw Error('Enter an HTTPS conference logo URL.');
  if(kind==='standings'&&!conference)throw Error('Enter the conference name.');
  const rows=kind==='intro'?[]:fields.rows.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>line.split('|').map(cell=>cell.trim()));
  const count=kind==='standings'?3:2;
  if(kind!=='intro'&&(!rows.length||rows.length>10||rows.some(row=>row.length!==count||row.some(cell=>!cell||cell.length>100)))){
   throw Error('Enter 1–10 rows using the format shown below the field.');
  }
  const payload={conference,logo,away:fields.away.trim(),home:fields.home.trim(),
   awayRecord:fields.awayRecord.trim(),homeRecord:fields.homeRecord.trim(),rows};
  if(new TextEncoder().encode(JSON.stringify([payload])).length>3900)throw Error('Shorten the logo URL or the graphic text.');
  return payload;
 }
 function node(tag,cls,text){
  const el=document.createElement(tag);
  if(cls)el.className=cls;
  if(text)el.textContent=text;
  return el;
 }
 function image(url,cls){
  const img=node('img',cls);
  img.alt='';
  img.referrerPolicy='no-referrer';
  img.addEventListener('error',()=>img.remove());
  img.src=url;
  return img;
 }
 function render(host,kind,payload,game){
  host.replaceChildren();
  if(!isFeature(kind)||!payload)return;
  const header=node('header','bf-header');
  header.append(image('assets/brand/larson-z-mark.svg','bf-mark'),node('span','','LARSON LIVE STATS'));
  const conference=node('div','bf-conference',payload.conference);
  const logo=logoURL(payload.logo);
  if(logo)conference.prepend(image(logo,'bf-conference-logo'));
  header.append(conference);
  host.append(header,node('h2','bf-title',titles[kind]));
  if(kind==='intro'){
   const matchup=node('div','bf-matchup');
   for(const side of ['away','home']){
    const name=String(payload[side]||game?.[side]||(side==='away'?'Visitor':'Home')).trim().slice(0,100)||'Team';
    const card=node('article','bf-team');
    const color=game?.colors?.[side];
    if(/^#[0-9a-f]{6}$/i.test(color||''))card.style.setProperty('--bf-team',color);
    const mark=node('div','bf-team-logo',name.split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase());
    const source=game?.logos?.[side]||game?.teamBrands?.[side]?.logo;
    const teamLogo=String(source).length<=400000&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(source)?source:logoURL(source);
    if(teamLogo)mark.append(image(teamLogo,'bf-logo-image'));
    card.append(node('div','bf-side',side==='away'?'VISITOR':'HOME'),mark,node('h3','',name));
    const record=payload[side+'Record'];
    if(record)card.append(node('p','bf-record',record));
    matchup.append(card);
    if(side==='away')matchup.append(node('div','bf-versus','AT'));
   }
   host.append(matchup);
   return;
  }
  const table=node('table','bf-table'),head=node('thead'),body=node('tbody'),heading=node('tr');
  const labels=kind==='upcoming'?['Matchup','Tip-off']:['Team','Conference','Overall'];
  for(const label of labels){const cell=node('th','',label);cell.scope='col';heading.append(cell);}
  head.append(heading);
  for(const row of (Array.isArray(payload.rows)?payload.rows:[]).slice(0,10)){
   if(!Array.isArray(row))continue;
   const line=node('tr');
   labels.forEach((_,i)=>line.append(node('td','',String(row[i]??''))));
   body.append(line);
  }
  table.append(head,body);
  host.append(table);
 }
 async function upcoming(viewer,conference,game){
  if(!conference.trim())throw Error('Enter a conference before loading its schedule.');
  const dates=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Chicago',timeZoneName:'short'});
  const match=team=>Affiliations.key(team?.conference||Affiliations.defaults(team?.name).conference)===Affiliations.key(conference);
  const lines=[];
  const now=new Date().toISOString();
  for(let offset=0;lines.length<10;offset+=100){
   const {data,error}=await viewer.from('game_center_games').select('id,teams,scheduled_at')
    .eq('sport','basketball').eq('status','upcoming').gte('scheduled_at',now)
    .order('scheduled_at').order('id').range(offset,offset+99);
   if(error)throw error;
   for(const row of data){
    if(row.id===game||!Object.values(row.teams).some(match))continue;
    const names=[row.teams.away?.name,row.teams.home?.name].map(name=>String(name||'').replace(/[|\r\n]/g,' '));
    if(names.every(Boolean))lines.push(names.join(' at ').slice(0,100)+' | '+dates.format(new Date(row.scheduled_at)));
    if(lines.length===10)break;
   }
   if(data.length<100)break;
  }
  return lines.join('\n');
 }
 return {titles,isFeature,create,render,upcoming};
})();
