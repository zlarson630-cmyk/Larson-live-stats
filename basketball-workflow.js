/* Possession-led basketball entry. Every saved play uses the existing cloud writer. */
const wfModes={basic:'Basic · team totals',streamlined:'Streamlined · scorebook',full:'Full Suite',fullchart:'Full Suite + shot chart'};
const wfIsFull=mode=>mode==='full'||mode==='fullchart';
let wfLayout='auto';
try{wfLayout=localStorage.getItem('lls-basketball-control-layout')||'auto';}catch{}
function wfIsPhone(){return wfLayout==='phone'||(wfLayout==='auto'&&matchMedia('(max-width:700px)').matches);}
function wfSetLayout(layout){if(wfDraft){wfMessage='Finish or skip the current play first.';wfRender();return;}wfLayout=layout;try{localStorage.setItem('lls-basketball-control-layout',layout);}catch{}wfRender();}
let wfDraft=null,wfBusy=false,wfSubmitting=false,wfGame=null,wfInput='',wfMessage='';
let wfDigits='',wfLastTrail=[],wfKeyQueue=Promise.resolve(),wfKeyGeneration=0;
const wfOriginalRender=render,wfOriginalLabel=playLabel,wfOriginalEvent=eventHtml;
const wfOriginalBox=basketballBoxScore,wfOriginalUndo=undo,wfOriginalCorrect=correctEvent;
const wfOther=team=>team==='home'?'away':'home';
const wfMode=game=>game?.scoringMode==='full'&&game.shotChartEnabled?'fullchart':Object.hasOwn(wfModes,game?.scoringMode)?game.scoringMode:'streamlined';
const wfOffense=game=>['home','away'].includes(game?.offenseTeam)?game.offenseTeam:'home';
function wfElapsed(game){return basketballElapsedAt(game,Math.max(1,game.period),remaining(game));}
function wfPlayerName(team,number){
 if(number==='team')return 'Team';
 const p=state.rosters?.[team]?.find(p=>String(p.number)===String(number));
 return '#'+number+(p?.name?' '+p.name:'');
}
function wfButton(label,token){return '<button type="button" onclick="wfToken(\''+token+'\')">'+escapeHtml(label)+'</button>';}
function wfComputerActions(mode){
 const full=wfIsFull(mode);
 const actions=[
  ['2-point shot · J',"wfToken('J')",true],
  ['3-point shot · Y',"wfToken('Y')",true],
  ['Free throw · E',"wfToken('E')",true],
  ['Personal foul · F',"wfToken('F')",true],
  ['Technical foul · C',"wfToken('C')",true],
  ['Timeout · O',"wfToken('O')",true],
  ['Jump ball · B',"wfToken('B')",true],
  ['Missed shots',"wfExplainAction('miss')",full],
  ['Assist',"wfExplainAction('assist')",full],
  ['Rebound · R',"wfToken('R')",full],
  ['Turnover · T',"wfToken('T')",full],
  ['Steal · S',"wfToken('S')",full],
  ['Block · K',"wfToken('K')",full],
  ['Substitutions','openBasketballSubs(wfOffense(state))',full],
  ['Shot chart','wfOpenLatestChart()',mode==='fullchart'],
 ];
 return actions.map(([label,handler,available])=>{
  const disabled=!available||wfBusy||!!wfDraft||!canWrite()||gameLocked(state);
  const reason=available?'':label==='Shot chart'?'Available in Full Suite + shot chart':'Available in Full Suite';
  return '<button type="button" '+(disabled?'disabled ':'')+'title="'+reason+'" onclick="'+handler+'">'+label+(!available?'<small>Not in this mode</small>':'')+'</button>';
 }).join('');
}
function wfStage(){
 const d=wfDraft;
 if(!d)return 'Choose a play, or type a command.';
 if(d.action==='jump-ball')return 'Who gets the ball? H for home or V for visitor.';
 if(d.stage==='team')return d.action==='timeout'?'Which team called timeout?':'Which team committed the foul?';
 if(d.stage==='player'&&d.technical)return 'Enter the player’s jersey or choose Team / bench · N.';
 if(d.stage==='player')return 'Enter '+(d.action==='shot'?'shooter':d.action==='foul'?'fouling player':'player')+' jersey number.';
 if(d.stage==='phonePlayer')return 'Basket saved. Who scored? Choose a player or assign later.';
 if(d.stage==='result')return 'Made or missed?';
 if(d.stage==='assist')return 'Who assisted? Choose a player, N for no assist, or skip.';
 if(d.stage==='rebound')return 'Rebound: D defensive, O offensive, K blocked shot, or N to skip.';
 if(d.stage==='steal')return 'Was there a steal? S to credit a steal, or N for none.';
 return 'Enter '+(d.stage==='blockPlayer'?'blocker':d.stage==='stealPlayer'?'stealing player':'rebounder')+' jersey number, or Team.';
}
function wfNumbers(team){
 const roster=state.rosters?.[team]||[];
 return roster.map(p=>wfButton('#'+p.number+(p.name?' '+p.name:''),String(p.number))).join('');
}
function wfRender(){
 if(!state||!el('wfPanel'))return;
 if(wfGame!==id){wfGame=id;wfDraft=null;wfInput='';wfMessage='';wfDigits='';wfLastTrail=[];}
 const mode=wfMode(state),team=wfDraft?.team||wfOffense(state),phone=wfIsPhone();
 el('score').dataset.controls=phone?'phone':'computer';
 el('wfLayout').value=wfLayout;
 wfRenderPhone();
 const panel=el('wfPanel');
 panel.style.setProperty('--wf-jersey',uniform(team));
 panel.style.setProperty('--wf-ink',uniformInk(team));
 panel.style.setProperty('--wf-accent',uniformAccent(team));
 el('wfMode').value=mode;
 el('wfPrompts').checked=state.reboundPrompts??(wfIsFull(mode)&&matchMedia('(pointer:fine)').matches);
 el('wfPromptsLabel').hidden=!wfIsFull(mode);
 el('wfSubs').hidden=!wfIsFull(mode);
 el('wfTeam').textContent=SoccerBrand.name(state,team)+(wfDraft?' · '+(wfDraft.stage==='assist'?'Assist':wfDraft.stage==='blockPlayer'?'Block':wfDraft.stage==='stealPlayer'?'Steal':wfDraft.stage==='reboundPlayer'?'Rebound':wfDraft.action==='foul'?(wfDraft.technical?'Technical foul':'Personal foul'):wfDraft.action==='timeout'?'Timeout':wfDraft.action==='jump-ball'?'Jump ball':wfDraft.action==='shot'?'Shot entry':wfDraft.action):' has the ball');
 for(const t of ['home','away']){
  const button=el('wfTeam-'+t);
  button.textContent=(t==='home'?'H · ':'V · ')+SoccerBrand.name(state,t);
  button.setAttribute('aria-pressed',String(wfOffense(state)===t));
 }
 el('wfPrompt').textContent=wfMessage||wfStage();
 const trail=wfDraft?.trail||wfLastTrail;
 const labels={'2-point shot':'J · 2PT','3-point shot':'Y · 3PT','Free throw':'E · FT',Made:'MAKE',Missed:'MISS'};
 el('wfTrail').innerHTML=[...trail,...(wfDigits?['#'+wfDigits]:[])].map(step=>{
  const result=step==='Made'?' wf-chip-made':step==='Missed'?' wf-chip-missed':'';
  return '<span class="wf-chip'+result+'">'+escapeHtml(labels[step]||step)+'</span>';
 }).join('');
 const field=el('wfCommand');
 if(document.activeElement!==field)field.value=wfInput;
 let buttons='';
 const d=wfDraft;
 if(!d){
  buttons=wfButton('2-point shot · J','J')+wfButton('3-point shot · Y','Y')+wfButton('Free throw · E','E')+wfButton('Personal foul · F','F')+wfButton('Timeout · O','O');

 }else if(d.stage==='team'){
  const showKey=d.action==='jump-ball';
  buttons=wfButton((showKey?'H · ':'')+SoccerBrand.name(state,'home'),'H')+wfButton((showKey?'V · ':'')+SoccerBrand.name(state,'away'),'V');
 }
 else if(d.stage==='result')buttons=wfButton('Made · G','G')+wfButton('Missed · M','M');
 else if(d.stage==='rebound')buttons=wfButton('Defensive rebound · D','D')+wfButton('Offensive rebound · O','O')+(d.block? '':wfButton('Blocked shot · K','K'))+wfButton('Skip · N','N');
 else if(d.stage==='steal')buttons=wfButton('Credit steal · S','S')+wfButton('No steal · N','N');
 else{
  buttons=wfNumbers(d.team);
  if(d.stage==='player'&&d.technical)buttons+=wfButton('Team / bench · N','N');
  if(d.stage==='assist')buttons+=wfButton('No assist · N','N');
  if(d.stage==='reboundPlayer')buttons+=wfButton('Team rebound','TEAM');
 }
 el('wfChoices').innerHTML=buttons;
 el('wfActionGrid').innerHTML=wfComputerActions(mode);
 el('wfChoices').hidden=!wfDraft;
 el('wfActionGrid').hidden=phone;
 el('wfSkip').hidden=!d;
 el('wfUndo').disabled=wfBusy;
 el('wfTracking').textContent=mode==='basic'?'Team totals · Clock, score, team fouls and timeouts. No individual statistics.':mode==='streamlined'?'Scorebook · Player points and personal fouls, with clock, team fouls and timeouts.':'Full Box · Shooting, assists, rebounds, steals, blocks, turnovers and substitutions. Minutes require a five-player lineup.';
 el('wfCoverage').textContent=wfCoverage(state);
 el('wfPanel').querySelectorAll('button,input,select').forEach(x=>{if(!x.closest('#wfActionGrid'))x.disabled=(wfBusy&&(phone||x!==field))||!canWrite()||gameLocked(state);});
 el('scoreControls').hidden=true;
 el('score').querySelectorAll(':scope > .row').forEach(x=>x.hidden=true);
 wfRenderBox();
}
function wfCoverage(game){
 if(game.statCoveragePartial)return 'Tracking changed during this game. Some shooting and advanced totals cover only part of the game.';
 if(!wfIsFull(wfMode(game)))return 'Missed shots are untracked in this mode. Shooting percentages are unavailable.';
 if(!game.scoringMode)return 'Earlier tracking coverage is unknown. Confirm that all attempts were recorded before using percentages.';
 return '';
}
async function wfSetTeam(team,fromCommand=false){
 if(wfDraft?.action==='jump-ball')return wfToken(team==='home'?'H':'V',fromCommand);
 if(wfDraft||wfBusy||(wfSubmitting&&!fromCommand))return false;
 return wfSave(s=>{s.offenseTeam=team;s.offenseEvent=null;});
}
async function wfSave(change){
 wfBusy=true;wfRender();
 try{return await write(change);}
 finally{wfBusy=false;wfRender();}
}
async function wfSetMode(mode){
 if(wfDraft||wfBusy||wfSubmitting){el('wfMode').value=wfMode(state);wfMessage='Finish or skip this play before changing modes.';wfRender();return;}
 if(!Object.hasOwn(wfModes,mode))return;
 await wfSave(s=>{
  const previous=wfMode(s);
  if(previous!==mode&&((s.events||[]).length||s.running||remaining(s)<basketballPeriodSeconds(s)||s.period>1))s.statCoveragePartial=true;
  if(wfIsFull(mode)&&!wfIsFull(previous)){
   s.minuteBaseline=wfElapsed(s);
   s.minuteLineups=Object.fromEntries(['home','away'].map(t=>[t,[...(basketballOnCourt(s,t)||[])]]));
  }
  s.scoringMode=mode==='fullchart'?'full':mode;s.shotChartEnabled=mode==='fullchart';
  (s.modeHistory||(s.modeHistory=[])).push({mode,period:s.period,time:stamp(s)});
 });
}
async function wfSetPrompts(value){await wfSave(s=>s.reboundPrompts=value);}
function wfFinish(message='Play saved. Ready for the next play.'){
 const finished=wfDraft;
 if(finished?.eid)wfLastTrail=[...finished.trail];
 wfDigits='';wfDraft=null;wfInput='';wfMessage=message;wfRender();
 if(finished?.eid&&finished.action==='shot'&&finished.points>1&&wfMode(state)==='fullchart'&&!finished.phone)openBasketballShotLocation(finished.eid);
}
function wfSkip(){
 if(wfBusy)return;
 wfFinish(wfDraft?.eid?'Play saved. Unassigned details can be filled in from Game Flow.':'Entry cancelled.');
 el('wfCommand').focus();
}
function wfValidPlayer(team,token){
 if(!/^\d{1,2}$/.test(token))return null;
 const roster=state.rosters?.[team]||[];
 if(!roster.length)return token;
 return roster.find(p=>String(p.number)===token)?.number??roster.find(p=>Number(p.number)===Number(token))?.number??null;
}
const wfJumpBallFields=[['offenseTeam','offenseEvent'],['possession','possessionEvent']];
function wfRemoveJumpBall(game,event){
 for(const [field,source] of wfJumpBallFields){
  const previous=event.beforeJump[field];
  if(game[source]===event.id){
   game[field]=previous.value;
   game[source]=previous.source;
  }
  for(const later of game.events){
   if(later.beforeJump?.[field].source===event.id)later.beforeJump[field]=previous;
  }
 }
}
async function wfCommit(d){
 const eid=d.eid||crypto.randomUUID(),game=id;
 const ok=await wfSave(s=>{
  if(s.events.some(e=>e.id===eid))return;
  if(d.phone){s.phoneBookStats=true;if(s.events.some(e=>e.individualTracking===false))s.statCoveragePartial=true;}
  const e={id:eid,kind:d.action==='shot'?(d.made?'score':'miss'):d.action,team:d.team,period:s.period,time:stamp(s),seconds:remaining(s),player:d.player,workflow:true};
  if(d.action==='shot'){
   e.individualTracking=wfMode(s)!=='basic'||!!d.phone;
   if(!e.individualTracking){e.player=null;d.player=null;}
   if(d.phone&&wfIsFull(wfMode(s)))s.statCoveragePartial=true;
   e.points=d.points;e.scorer=d.player;e.shotType=d.points===1?'free throw':d.points===3?'three-pointer':'jumper';
   if(d.made){s.scores[d.team]+=d.points;e.assist=d.points===1?'na':wfIsFull(wfMode(s))&&!d.phone?null:'untracked';}
  }
  if(d.action==='foul'){s.fouls[d.team]++;e.individualTracking=wfMode(s)!=='basic'||!!d.phone;if(!e.individualTracking)e.player=null;if(d.technical)e.foulType='technical';}
  if(d.action==='rebound')e.reboundType=d.reboundType;
  if(d.action==='jump-ball'){
   e.beforeJump={};
   for(const [field,source] of wfJumpBallFields){
    e.beforeJump[field]={value:s[field]??null,source:s[source]??null};
    s[source]=eid;
   }
   s.offenseTeam=d.team;
   s.possession=wfOther(d.team);
  }
  if(d.action==='timeout'){
   if(s.timeouts[d.team]<=0)throw Error('No timeouts remaining for this team.');
   s.timeouts[d.team]--;
  }
  s.events.unshift(e);
 });
 if(id!==game)return false;
 if(!ok){wfMessage='Play not saved. Retry this entry.';wfRender();return false;}
 d.eid=eid;
 return true;
}
async function wfPatch(d,change){
 const ok=await wfSave(s=>{
  const e=s.events.find(x=>x.id===d.eid);
  if(!e)throw Error('The play was removed. Start a new entry.');
  change(e,s);
 });
 if(!ok){wfMessage='Detail not saved. Retry the selection.';wfRender();}
 return ok;
}
async function wfToken(raw,fromCommand=false){
 if(!state||!canWrite()||gameLocked(state)||wfBusy||(wfSubmitting&&!fromCommand))return false;
 if(wfGame!==id)wfRender();
 const token=String(raw).trim().toUpperCase();
 wfMessage='';
 let d=wfDraft;
 if(!d){
  if(token==='H'||token==='V')return wfSetTeam(token==='H'?'home':'away',fromCommand);
  if(token==='G'){return true;}
  const team=wfOffense(state),full=wfIsFull(wfMode(state));
  if(['J','Y','E'].includes(token))wfDraft={action:'shot',points:token==='J'?2:token==='Y'?3:1,team,offense:team,stage:'player',trail:[SoccerBrand.name(state,team),token==='E'?'Free throw':token==='Y'?'3-point shot':'2-point shot']};
  else if(token==='F'||token==='C'){
   const technical=token==='C';
   wfDraft={action:'foul',technical,team:wfOther(team),stage:'team',trail:[technical?'Technical foul':'Personal foul']};
  }
  else if(token==='O')wfDraft={action:'timeout',team,stage:'team',trail:['Timeout']};
  else if(token==='B')wfDraft={action:'jump-ball',team,stage:'team',trail:['Jump ball']};
  else if(full&&token==='R')wfDraft={action:'rebound',team,offense:team,stage:'rebound',trail:['Rebound']};
  else if(full&&['T','S','K'].includes(token))wfDraft={action:token==='T'?'turnover':token==='S'?'steal':'block',team:token==='T'?team:wfOther(team),offense:team,stage:'player',trail:[token==='T'?'Turnover':token==='S'?'Steal':'Block']};
  else{wfMessage='Choose J, Y, E, F, C, O or B'+(full?', T, R, S or K':'')+'.';wfRender();return false;}
  if(wfMode(state)==='basic'&&wfDraft.action==='shot'){wfDraft.made=true;wfDraft.trail.push('Made');if(!await wfCommit(wfDraft))return false;wfFinish();}
  wfRender();return true;
 }
 if(token==='N'&&['assist','rebound','steal'].includes(d.stage)){
  if(d.stage==='assist'){if(!await wfPatch(d,e=>e.assist='no-assist'))return false;d.trail.push('No assist');}
  wfFinish();return true;
 }
 if(d.stage==='team'){
  if(!['H','V'].includes(token)){wfMessage='Choose H for home or V for visitor.';wfRender();return false;}
  d.team=token==='H'?'home':'away';
  if(d.action==='jump-ball'){
   if(!await wfCommit(d))return false;
   d.trail.push(SoccerBrand.name(state,d.team));
   wfFinish('Jump ball saved.');return true;
  }
  d.trail.push(SoccerBrand.name(state,d.team));
  if(d.action==='timeout'){
   if(!await wfCommit(d)){d.stage='team';return false;}
   wfFinish('Timeout saved.');return true;
  }
  if(wfMode(state)==='basic'&&d.action==='foul'&&!d.phone){if(!await wfCommit(d))return false;wfFinish();return true;}
  d.stage='player';wfRender();return true;
 }
 if(d.stage==='result'){
  if(!['G','M','X'].includes(token)){wfMessage='Choose G for made or M for missed.';wfRender();return false;}
  d.made=token==='G';d.trail.push(d.made?'Made':'Missed');
  if(!await wfCommit(d))return false;
  if(wfIsFull(wfMode(state))&&d.made&&d.points>1)d.stage='assist';
  else if(wfIsFull(wfMode(state))&&!d.made&&el('wfPrompts').checked)d.stage='rebound';
  else wfFinish();
  wfRender();return true;
 }
 if(d.stage==='steal'){
  if(token!=='S'){wfMessage='Choose S for a steal or N for none.';wfRender();return false;}
  d.team=wfOther(d.offense);d.stage='stealPlayer';d.trail.push('Steal');wfRender();return true;
 }
 if(d.stage==='rebound'){
  if(token==='K'&&d.eid&&!d.block){d.team=wfOther(d.offense);d.stage='blockPlayer';d.trail.push('Block');wfRender();return true;}
  if(!['D','O'].includes(token)){wfMessage='Choose D, O, K or N.';wfRender();return false;}
  d.reboundType=token==='D'?'defensive':'offensive';d.team=token==='D'?wfOther(d.offense):d.offense;d.stage='reboundPlayer';d.trail.push(d.reboundType+' rebound');wfRender();return true;
 }
 if(d.stage==='player'&&d.technical&&token==='N'){
  if(!await wfCommit(d))return false;
  d.trail.push('Team / bench');
  wfFinish('Technical foul saved.');return true;
 }
 const number=token==='TEAM'&&d.stage==='reboundPlayer'?'team':wfValidPlayer(d.team,token);
 if(number===null){wfMessage='Enter a jersey number from '+SoccerBrand.name(state,d.team)+'’s roster.';wfRender();return false;}
 if(d.stage==='phonePlayer'){
  if(!await wfPatch(d,e=>{e.scorer=String(number);e.player=String(number);}))return false;
  d.trail.push('#'+number);wfFinish();return true;
 }
 if(d.stage==='assist'){
  const shot=state.events.find(e=>e.id===d.eid);
  if(String(shot?.scorer)===String(number)){wfMessage='The shooter cannot assist their own basket.';wfRender();return false;}
  if(!await wfPatch(d,e=>e.assist=String(number)))return false;
  d.trail.push('Assist #'+number);wfFinish();return true;
 }
 if(d.stage==='blockPlayer'||d.stage==='stealPlayer'){
  const key=d.stage==='blockPlayer'?'block':'steal';
  if(!await wfPatch(d,e=>e[key]={team:d.team,player:String(number)}))return false;
  d.trail.push('#'+number);
  if(key==='block'){d.block=true;d.team=d.offense;d.stage='rebound';wfRender();}else wfFinish();
  return true;
 }
 if(d.stage==='reboundPlayer'){
  d.trail.push(number==='team'?'Team rebound':'#'+number);
  if(d.eid){
   if(!await wfPatch(d,(e,s)=>{e.rebound={team:d.team,player:String(number),type:d.reboundType};}))return false;
  }else{
   d.player=String(number);d.action='rebound';
   if(!await wfCommit(d))return false;
  }
  wfFinish();return true;
 }
 d.player=String(number);d.trail.push('#'+number);
 if(d.action==='shot'){
  if(!wfIsFull(wfMode(state))||d.phone){
   d.made=true;d.trail.push('Made');if(!await wfCommit(d))return false;wfFinish();
  }else{d.stage='result';wfRender();}
  return true;
 }
 if(!await wfCommit(d))return false;
 if(d.action==='turnover'){d.stage='steal';wfRender();}else wfFinish();
 return true;
}
async function wfSubmit(event){
 event?.preventDefault();
 if(wfBusy||wfSubmitting)return;
 const command=el('wfCommand').value.trim();
 if(!command)return;
 wfInput='';el('wfCommand').value='';
 const tokens=command.toUpperCase().match(/TEAM|\d{1,2}|[A-Z]/g)||[];
 wfSubmitting=true;
 try{
  for(let i=0;i<tokens.length;i++){
   if(!await wfToken(tokens[i],true)){
    wfInput=tokens.slice(i).join(' ');el('wfCommand').value=wfInput;break;
   }
  }
 }finally{wfSubmitting=false;}
 el('wfCommand').focus();
}
function wfNeedsJersey(){
 return ['player','assist','reboundPlayer','blockPlayer','stealPlayer'].includes(wfDraft?.stage);
}

async function wfProcessKey(key){
 if(key==='ESCAPE'){wfSkip();return;}
 if(key==='BACKSPACE'){wfDigits=wfDigits.slice(0,-1);wfRender();return;}
 if(/^\d$/.test(key)&&wfNeedsJersey()){
  wfDigits+=key;
  const roster=state.rosters?.[wfDraft.team]||[];
  const mayContinue=wfDigits.length===1&&(wfDigits==='0'||!roster.length||
   roster.some(p=>String(p.number).length===2&&String(p.number).startsWith(wfDigits)));
  if(mayContinue){wfRender();return;}
  const number=wfDigits;
  wfDigits='';
  return wfToken(number);
 }
 if(wfDigits){
  const number=wfDigits;
  wfDigits='';
  if(!await wfToken(number))return false;
 }
 return wfToken(key);
}

document.removeEventListener('keydown',basketballKeydown);
document.addEventListener('keydown',event=>{
 if(event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||!state||!canWrite()||gameLocked(state)||el('app').classList.contains('hide'))return;
 if(el('basketballGameText').open||el('basketballClockSettings').open||el('basketballPdfDialog').open||el('shotLocationDialog').open||!el('subSheet').classList.contains('hide')||pickerEvent)return;
 if(event.key==='F8'){event.preventDefault();if(!event.repeat)toggleClock();return;}
 const editable=event.target?.closest?.('input,textarea,select,[contenteditable=true]');
 if(wfIsPhone()){
  if(event.key==='Escape'&&!wfBusy&&wfDraft){event.preventDefault();wfSkip();}
  if(event.key===' '&&!editable){event.preventDefault();if(!event.repeat)toggleClock();}
  return;
 }
 const commandField=event.target===el('wfCommand');
 if(editable&&!commandField)return;
 if(event.key===' '){event.preventDefault();if(!event.repeat)return toggleClock();return;}
 if(event.repeat||el('score').classList.contains('hide'))return;
 if(!/^[a-z0-9]$/i.test(event.key)&&!['Escape','Backspace'].includes(event.key))return;
 event.preventDefault();
 if(!commandField&&/^[a-z0-9]$/i.test(event.key))el('wfCommand').focus();
 const game=id,generation=wfKeyGeneration,key=event.key.toUpperCase();
 wfKeyQueue=wfKeyQueue.then(async()=>{
  if(generation!==wfKeyGeneration||id!==game||!state||!canWrite()||gameLocked(state)||wfIsPhone()||el('shotLocationDialog').open||el('score').classList.contains('hide'))return;
  if(await wfProcessKey(key)===false)wfKeyGeneration++;
 }).catch(error=>{
  wfKeyGeneration++;console.error(error);
  if(id===game){wfMessage='Could not process that key. Check the play before continuing.';wfRender();}
 });
 return wfKeyQueue;
});
render=function(){wfOriginalRender();wfRender();renderBasketballGameText();};
playLabel=function(e){
 const labels={'jump-ball':'Jump ball',rebound:'Rebound',turnover:'Turnover',steal:'Steal',block:'Block'};
 let label=e.kind==='foul'&&e.foulType==='technical'?'Technical foul':labels[e.kind]||wfOriginalLabel(e);
 if(e.player&& !['score','miss'].includes(e.kind))label+=' · '+(e.player==='team'?'Team':'#'+e.player);
 if(e.rebound)label+=' · '+e.rebound.type+' rebound '+SoccerBrand.name(state,e.rebound.team)+' #'+e.rebound.player;
 if(e.block)label+=' · Block #'+e.block.player;
 if(e.steal)label+=' · Steal #'+e.steal.player;
 return label;
};
eventHtml=function(e){
 let html=wfOriginalEvent(e);
 if(wfMode(state)!=='fullchart')html=html.replace('<button onclick="openBasketballShotLocation','<button disabled title="Available in Full Suite + shot chart" onclick="openBasketballShotLocation');
 if(e.individualTracking===false)html=html.replace(/<button[^>]*onclick="assign\('[^']*','(?:scorer|assist|player)'\)"[\s\S]*?<\/button>/g,'');
 if(e.kind==='miss')html=html.replace('<div class="flowActions">','<div class="flowActions"><button '+(!wfIsFull(wfMode(state))?'disabled title="Available in Full Suite" ':'')+'onclick="wfEditOutcome(\''+escapeHtml(e.id)+'\')">Rebound / block</button>');
 for(const key of ['rebound','block','steal']){
  if(e[key])html=html.replace('<div class="flowActions">','<div class="flowActions"><button onclick="wfRemoveOutcome(\''+escapeHtml(e.id)+'\',\''+key+'\')">Remove '+key+'</button>');
 }
 if(e.assist==='untracked')html=html.replace(/<button[^>]*onclick="assign\('[^']*','assist'\)"[\s\S]*?<\/button>/,'');
 if(e.workflow){
  const line=SoccerBrand.name(state,e.team)+' · '+playLabel(e)+(['score','miss'].includes(e.kind)&&e.individualTracking!==false?' · '+wfPlayerName(e.team,e.scorer):'');
  html=html.replace('<div class="flowActions">','<p class="wf-logline">'+escapeHtml(line)+'</p><div class="flowActions">');
  if(e.individualTracking!==false&&!['score','miss','timeout','jump-ball'].includes(e.kind))html=html.replace('<div class="flowActions">','<div class="flowActions"><button onclick="assign(\''+escapeHtml(e.id)+'\',\'player\')">Change player</button>');
 }
 return html;
};
const wfPickerRenderer=renderPicker;
renderPicker=function(){
 wfPickerRenderer();
 if(pickerField==='player'){
  el('pickerTitle').textContent=SoccerBrand.name(state,state.events.find(e=>e.id===pickerEvent).team)+' · Change player';
 }
};
const wfPickerValue=pickerValue;
pickerValue=function(value){
 const e=state.events.find(x=>x.id===pickerEvent);
 if(pickerField==='assist'&&value!=null&&String(value)===String(e?.scorer)){
  el('pickerHint').textContent='The shooter cannot assist their own basket.';return;
 }
 return wfPickerValue(value);
};
undo=async function(){
 if(wfBusy)return;
 const latest=state?.events?.[0];
 if(latest?.workflow){
  const ok=await wfSave(s=>{
   if(s.events[0]?.id!==latest.id)throw Error('A newer play was saved. Review Game Flow before undoing.');
   const e=s.events.shift();
   if(e.kind==='score')s.scores[e.team]-=e.points;
   if(e.kind==='foul')s.fouls[e.team]--;
   if(e.kind==='timeout')s.timeouts[e.team]++;
   if(e.kind==='jump-ball')wfRemoveJumpBall(s,e);
  });
  if(ok)wfFinish('Last play undone.');
  return;
 }
 return wfOriginalUndo();
};
correctEvent=async function(eid){
 const e=state.events.find(e=>e.id===eid);
 if(e?.kind==='jump-ball'){
  if(!confirm('Remove this jump ball from Game Flow?'))return;
  await wfSave(s=>{
   const index=s.events.findIndex(x=>x.id===eid);
   if(index<0)return;
   const [removed]=s.events.splice(index,1);
   wfRemoveJumpBall(s,removed);
  });
 }else if(e&&['rebound','steal','block','turnover'].includes(e.kind)){
  if(!confirm('Remove this play and its linked statistics?'))return;
  await wfSave(s=>{s.events=s.events.filter(x=>x.id!==eid);s.statCoveragePartial=true;});
 }else{
  await wfOriginalCorrect(eid);
  const changed=state.events.find(x=>x.id===eid);
  if(changed?.kind==='score'&&(changed.rebound||changed.block)){
   await wfSave(s=>{const play=s.events.find(x=>x.id===eid);if(play){delete play.rebound;delete play.block;}});
  }
 }
 if(wfDraft?.eid===eid)wfFinish('Play changed. Review Game Flow before continuing.');
};
function wfEditOutcome(eid){
 if(wfBusy||wfDraft)return;
 const e=state.events.find(x=>x.id===eid);
 if(!e||e.kind!=='miss')return;
 wfDraft={action:'shot',eid:e.id,team:e.team,offense:e.team,stage:'rebound',trail:[SoccerBrand.name(state,e.team),'Miss '+e.points,'#'+e.scorer],block:!!e.block};
 showTab('score');wfRender();
}
async function wfRemoveOutcome(eid,key){
 if(!['rebound','block','steal'].includes(key))return;
 await wfSave(s=>{const e=s.events.find(x=>x.id===eid);if(e)delete e[key];});
}
basketballBoxScore=function(game){
 const result=wfOriginalBox(game),baseFresh=result.fresh;
 const fresh=()=>({...baseFresh(),pf:0,tf:0,oreb:0,dreb:0,reb:0,stl:0,blk:0,to:0});
 result.fresh=fresh;
 for(const t of ['home','away']){
  result.teams[t]={...fresh(),...result.teams[t]};
  for(const k of Object.keys(result.totals[t]))result.totals[t][k]={...fresh(),...result.totals[t][k]};
 }
 const add=(team,number,key)=>{
  if(!result.teams[team])return;
  const k=number==null?'Unassigned':String(number);
  const player=result.totals[team][k]||(result.totals[team][k]=fresh());
  player[key]++;result.teams[team][key]++;
  if(key==='oreb'||key==='dreb'){player.reb++;result.teams[team].reb++;}
 };
 for(const e of game.events||[]){
  if(e.kind==='foul'){
   add(e.team,e.player,'pf');
   if(e.foulType==='technical')add(e.team,e.player,'tf');
  }
  if(e.kind==='rebound')add(e.team,e.player,e.reboundType==='offensive'?'oreb':'dreb');
  if(e.kind==='turnover')add(e.team,e.player,'to');
  if(e.kind==='steal')add(e.team,e.player,'stl');
  if(e.kind==='block')add(e.team,e.player,'blk');
  if(e.rebound)add(e.rebound.team,e.rebound.player,e.rebound.type==='offensive'?'oreb':'dreb');
  if(e.block)add(e.block.team,e.block.player,'blk');
  if(e.steal)add(e.steal.team,e.steal.player,'stl');
 }
 return result;
};
function wfMinutes(game,team){
 const initial=game.minuteLineups?.[team]||game.startingLineups?.[team];
 if(initial?.length!==5)return null;
 const active=new Set(initial.map(String)),totals={};
 const start=game.minuteBaseline??0,end=wfElapsed(game);
 let previous=start;
 for(const e of [...(game.events||[])].reverse()){
  if(e.kind!=='substitution'||e.team!==team)continue;
  const clock=String(e.time).match(/^(\d+):(\d{2})$/);
  if(!clock)continue;
  const at=basketballElapsedAt(game,e.period,Number(clock[1])*60+Number(clock[2]));
  if(at<start)continue;
  if(at<previous||at>end)return null;
  const out=String(e.out).split(', '),incoming=String(e.in).split(', ');
  if(out.length!==incoming.length||out.some(n=>!active.has(n))||incoming.some(n=>active.has(n)))return null;
  for(const n of active)totals[n]=(totals[n]||0)+at-previous;
  out.forEach(n=>active.delete(n));incoming.forEach(n=>active.add(n));previous=at;
 }
 if(end<previous)return null;
 for(const n of active)totals[n]=(totals[n]||0)+end-previous;
 return totals;
}
function wfRenderBox(){
 const box=el('wfBox');if(!box)return;
 if(wfMode(state)==='basic'&&!wfIsPhone()){box.innerHTML='<p>Basic records team totals. Choose Streamlined to track player points and fouls.</p>';return;}
 const mode=wfMode(state),stats=basketballBoxScore(state),full=wfIsFull(mode);
 const labels=mode==='basic'?['PTS','PF','TF']:['PTS','PF','TF','FG','3PT','FT',...(full?['REB','AST','STL','BLK','TO','MIN']:[])];
 const cells=(p,minutes)=>mode==='basic'?[p.pts,p.pf,p.tf]:[p.pts,p.pf,p.tf,p.fgm+'-'+p.fga,p.tm+'-'+p.ta,p.ftm+'-'+p.fta,...(full?[p.reb,p.ast,p.stl,p.blk,p.to,minutes==null?'—':Math.floor(minutes/60)+':'+String(minutes%60).padStart(2,'0')]:[])];
 box.innerHTML=['away','home'].map(t=>{
  const mins=full?wfMinutes(state,t):null;
  const numbers=[...new Set([...(state.rosters?.[t]||[]).map(p=>String(p.number)),...Object.keys(stats.totals[t])])];
  return '<section><h3>'+escapeHtml(SoccerBrand.name(state,t))+'</h3><div class="wf-table"><table><thead><tr><th>Player</th>'+labels.map(l=>'<th>'+l+'</th>').join('')+'</tr></thead><tbody>'+numbers.map(n=>'<tr><th>'+escapeHtml(n==='Unassigned'?'Unassigned':wfPlayerName(t,n))+'</th>'+cells(stats.totals[t][n]||stats.fresh(),mins?.[n]??(mins?0:null)).map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></section>';
 }).join('');
}

function wfExplainAction(action){wfMessage=action==='assist'?'Record a made field goal to credit its assist.':'Choose a shot type and player, then select Missed.';wfRender();}
function wfOpenLatestChart(){const e=state.events.find(e=>['score','miss'].includes(e.kind)&&e.points>1);if(e)openBasketballShotLocation(e.id);else{wfMessage='Record a field-goal attempt first.';wfRender();}}
function wfRenderPhone(){
 const box=el('wfPhoneTeams');if(!box)return;
 el('wfPhoneClock').textContent=basketballPeriodLabel(state)+' · '+stamp(state);
 box.innerHTML=['away','home'].map(t=>'<section style="--phone-jersey:'+uniform(t)+';--phone-ink:'+uniformInk(t)+'"><h3>'+escapeHtml(SoccerBrand.name(state,t))+'</h3><strong>'+state.scores[t]+'</strong><p>Fouls '+state.fouls[t]+' · Timeouts '+state.timeouts[t]+'</p><div>'+[1,2,3].map(n=>'<button type="button" '+(wfBusy||wfDraft||!canWrite()||gameLocked(state)?'disabled':'')+' onclick="wfPhoneShot(\''+t+'\','+n+')">+'+n+'</button>').join('')+'</div><button '+(wfBusy||wfDraft?'disabled':'')+' onclick="wfPhoneFoul(\''+t+'\')">Foul</button><button '+(wfBusy||wfDraft||!canWrite()||gameLocked(state)?'disabled':'')+' onclick="wfPhoneTechnical(\''+t+'\')">Technical</button><button '+(wfBusy||wfDraft?'disabled':'')+' onclick="wfPhoneTimeout(\''+t+'\')">Timeout</button></section>').join('');
 el('wfReporter').textContent=state.demo?'Practice game':canWrite()?'Signed-in scorer':'Public viewer · sign in to score';
}
async function wfPhoneShot(team,points){
 if(wfBusy||wfDraft||!canWrite()||gameLocked(state))return;
 wfDraft={action:'shot',team,offense:team,points,made:true,player:null,phone:true,stage:'phonePlayer',trail:[SoccerBrand.name(state,team),'Made '+points]};
 wfMessage='';
 if(!await wfCommit(wfDraft)){wfDraft=null;wfRender();return;}
 wfRender();
}
function wfPhoneTechnical(team){
 if(wfBusy||wfDraft||!canWrite()||gameLocked(state))return;
 wfDraft={action:'foul',technical:true,phone:true,team,stage:'player',trail:['Technical foul',SoccerBrand.name(state,team)]};
 wfRender();
}
async function wfPhoneFoul(team){if(wfBusy||wfDraft||!canWrite()||gameLocked(state))return;if(await wfCommit({action:'foul',team,phone:true}))wfFinish('Team foul saved.');}
async function wfPhoneTimeout(team){if(wfBusy||wfDraft||!canWrite()||gameLocked(state))return;if(await wfCommit({action:'timeout',team,phone:true}))wfFinish('Timeout saved.');}
window.addEventListener('resize',()=>{if(state)wfRender();});
const wfBaseClockTick=tickBasketballClock;
tickBasketballClock=function(){wfBaseClockTick();if(state&&el('wfPhoneClock'))el('wfPhoneClock').textContent=basketballPeriodLabel(state)+' · '+stamp(state);};
