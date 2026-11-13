/* Possession-led basketball entry. Every saved play uses the existing cloud writer. */
const wfModes={basic:'Basic · team totals',streamlined:'Streamlined · scorebook',full:'Full Suite',fullchart:'Full Suite + shot chart'};
const wfIsFull=mode=>mode==='full'||mode==='fullchart';
let wfLayout='auto';
try{wfLayout=localStorage.getItem('lls-basketball-control-layout')||'auto';}catch{}
function wfIsPhone(){return wfLayout==='phone'||(wfLayout==='auto'&&matchMedia('(max-width:700px)').matches);}
function wfSetLayout(layout){if(wfDraft){wfMessage='Finish or skip the current play first.';wfRender();return;}wfLayout=layout;try{localStorage.setItem('lls-basketball-control-layout',layout);}catch{}wfRender();}
let wfDraft=null,wfBusy=false,wfSubmitting=false,wfGame=null,wfInput='',wfMessage='';
let wfDigits='',wfLastTrail=[],wfLastPlay=null,wfChipEdit=null,wfSteps=[],wfKeyQueue=Promise.resolve(),wfKeyGeneration=0;
const wfOriginalRender=render,wfOriginalLabel=playLabel,wfOriginalEvent=eventHtml;
const wfOriginalBox=basketballBoxScore,wfOriginalUndo=undo,wfOriginalCorrect=correctEvent;
const wfOther=team=>team==='home'?'away':'home';
const wfReboundType=key=>key==='O'?'offensive':key==='D'?'defensive':null;
const wfReboundTeam=(shootingTeam,type)=>type==='defensive'?wfOther(shootingTeam):shootingTeam;
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
  ['Layup · L',"wfToken('L')",true],
  ['Dunk · U',"wfToken('U')",true],
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
  ['Substitutions · I',"wfToken('I')",full],
  ['Shot chart','wfOpenLatestChart()',mode==='fullchart'],
 ];
 return actions.map(([label,handler,available])=>{
  const disabled=!available||wfBusy||!!wfDraft||!canWrite()||gameLocked(state);
  const reason=available?'':label==='Shot chart'?'Available in Full Suite + shot chart':'Available in Full Suite';
  return '<button type="button" '+(disabled?'disabled ':'')+'title="'+reason+'" onclick="'+handler+'">'+label+(!available?'<small>Not in this mode</small>':'')+'</button>';
 }).join('');
}
const wfJerseyEntryHint='Enter two digits for the jersey number (for example, 05 for #5).';
function wfStage(){
 const d=wfDraft;
 if(!d)return 'Choose a play, or type a command.';
 if(d.action==='jump-ball')return 'Who gets the ball? H for home or V for visitor.';
 if(d.stage==='team')return d.action==='timeout'?'Which team called timeout?':'Which team committed the foul?';
 if(d.stage==='player'&&d.technical)return 'Enter the player’s two-digit jersey or choose Team / bench · N.';
 if(d.stage==='player')return 'Enter '+(d.action==='shot'?'shooter':d.action==='foul'?'fouling player':'player')+' jersey number using two digits.';
 if(d.stage==='phonePlayer')return 'Basket saved. Who scored? Choose a player or assign later.';
 if(d.stage==='result')return 'G for make, O for miss + offensive rebound, D for miss + defensive rebound, or M for miss.'+(d.points>1?' K records a blocked shot.':'');
 if(d.stage==='assist')return 'Who assisted? Enter a two-digit jersey, or press Enter for no assist and switch possession.';
 if(d.stage==='rebound')return 'Rebound: D defensive, O offensive, or N to skip.'+(!d.block&&d.eid&&d.points!==1?' K records a block.':'');
 if(d.stage==='reboundPlayer')return 'Enter the rebounder’s two-digit jersey, press M for a team rebound, or press Enter to review later.';
 if(d.stage==='steal')return 'Was there a steal? S to credit a steal, or N for none.';
 return 'Enter '+(d.stage==='blockPlayer'?'blocker':d.stage==='stealPlayer'?'stealing player':'rebounder')+' jersey number using two digits.';
}
function wfNumbers(team){
 const roster=state.rosters?.[team]||[];
 return roster.map(p=>wfButton('#'+p.number+(p.name?' '+p.name:''),String(p.number))).join('');
}
function wfAddJerseyChip(d,role,number){
 (d.jerseyChips||={})[d.trail.length]=role;
 d.trail.push(wfJerseyLabel(role,number));
}
function wfJerseyLabel(role,number){return (role==='assist'?'Assist ':'')+'#'+number;}
function wfJerseyTarget(event,role){
 if(!event)return null;
 if(role==='scorer'||role==='assist'||role==='player')return {record:event,field:role};
 const record=role==='rebound'&&event.kind==='rebound'?event:event[role];
 return record?{record,field:'player'}:null;
}
function wfRenderTrail(){
 const saved=wfLastPlay&&state.events.find(e=>e.id===wfLastPlay.id);
 if(wfLastPlay&&!saved){wfLastPlay=null;wfLastTrail=[];wfChipEdit=null;}
 if(wfChipEdit){
  if(wfDraft||!canWrite()||gameLocked(state))wfChipEdit=null;
  else if(el('wfTrail').querySelector('#wfChipNumber'))return;
 }
 const trail=(wfDraft?.trail||wfLastTrail).map(label=>!wfDraft&&saved&&['2-point shot','3-point shot','Free throw','Layup','Dunk'].includes(label)?(saved.shotType==='layup'?'Layup':saved.shotType==='dunk'?'Dunk':saved.points===1?'Free throw':saved.points===3?'3-point shot':'2-point shot'):label);
 const labels={'2-point shot':'J · 2PT','3-point shot':'Y · 3PT','Free throw':'E · FT',Made:'MAKE',Missed:'MISS'};
 el('wfTrail').innerHTML=[...trail,...(wfDigits?['#'+wfDigits]:[])].map((step,index)=>{
  const role=!wfDraft&&wfLastPlay?.chips[index];
  const target=role?wfJerseyTarget(saved,role):null;
  const number=target?.record[target.field];
  if(role&&/^\d{1,2}$/.test(String(number))){
   const label=wfJerseyLabel(role,number);
   if(wfChipEdit?.index===index&&wfChipEdit.id===saved.id&&canWrite()&&!gameLocked(state)){
    const padded=String(number).padStart(2,'0');
    const entry=String(wfValidPlayer(target.record.team,padded))===String(number)?padded:'';
    return '<input id="wfChipNumber" class="wf-chip-number" type="text" inputmode="numeric" autocomplete="off" maxlength="2" aria-label="Correct jersey number" value="'+escapeHtml(entry)+'" onkeydown="wfJerseyEditKey(event)"><button type="button" class="wf-chip-confirm" onclick="wfSaveJerseyChip()">Save</button>';
   }
   if(canWrite()&&!gameLocked(state))return '<button type="button" class="wf-chip wf-chip-edit" aria-label="Edit '+escapeHtml(label)+'" onclick="wfOpenJerseyChip('+index+')">'+escapeHtml(label)+'</button>';
   step=label;
  }else if(role){
   step=role==='assist'&&number==='no-assist'?'No assist':number==='team'?'Team rebound':'Unassigned';
  }
  const result=step==='Made'?' wf-chip-made':step==='Missed'?' wf-chip-missed':'';
  return '<span class="wf-chip'+result+'">'+escapeHtml(labels[step]||step)+'</span>';
 }).join('');
}
function wfLinkedReboundTeam(shot){
 const rebound=shot.rebound;
 if(shot.kind==='miss'&&Number(shot.points)===1&&rebound.type==='offensive'&&rebound.player==='team')return shot.team;
 return rebound.team;
}
function wfMiniPlayChips(play){
 const chip=(label,style='',team,field)=>{
  const action=field&&canWrite()&&!gameLocked(state)?' data-edit-play="'+field+'" aria-label="Edit '+escapeHtml(label)+'" type="button"':'';
  const tag=action?'button':'span';
  const color=value=>/^#[0-9a-f]{6}$/i.test(value);
  if(team==='home'||team==='away'){
   const jersey=uniform(team),ink=uniformInk(team),accent=uniformAccent(team);
   if([jersey,ink,accent].every(color)){
    return '<'+tag+action+' class="wf-chip wf-chip-team" style="--chip-jersey:'+jersey+';--chip-ink:'+ink+';--chip-accent:'+accent+'">'+escapeHtml(label)+'</'+tag+'>';
   }
  }
  return '<'+tag+action+' class="wf-chip'+style+'">'+escapeHtml(label)+'</'+tag+'>';
 };
 const jersey=number=>number==='team'?'Team rebound':number==null?'Review later':'#'+number;
 const jerseyChip=(number,team,role)=>chip(jersey(number),'',/^\d{1,2}$/.test(String(number))?team:undefined,/^\d{1,2}$/.test(String(number))?role:undefined);
 const chips=[chip(SoccerBrand.name(state,play.team),'',play.team)];
 if(play.kind==='score'||play.kind==='miss'){
  chips.push(chip(play.points===1?'FT':(['layup','dunk'].includes(play.shotType)?play.shotType:play.points+'PT'),'',undefined,'points'));
  if(play.individualTracking!==false)chips.push(play.scorer==null?chip('Unassigned'):jerseyChip(play.scorer,play.team,'scorer'));
  chips.push(play.kind==='score'?chip('MAKE',' wf-chip-made'):chip('MISS',' wf-chip-missed'));
  if(/^\d{1,2}$/.test(String(play.assist)))chips.push(chip('Assist'),jerseyChip(play.assist,play.team,'assist'));
 }else if(play.kind==='rebound'){
  chips.push(chip(play.reboundType==='defensive'?'Defensive rebound':play.reboundType==='offensive'?'Offensive rebound':'Rebound'));
  chips.push(chip(jersey(play.player),'',play.team,'rebound'));
 }else{
  const labels={'jump-ball':'Jump ball',foul:play.foulType==='technical'?'Technical foul':'Personal foul',turnover:'Turnover',steal:'Steal',block:'Block'};
  chips.push(chip(play.openingTip?'Opening tip':labels[play.kind]||wfOriginalLabel(play)));
  if(labels[play.kind]&&play.player!=null)chips.push(jerseyChip(play.player,play.team,'player'));
 }
 for(const [key,label] of [['block','Block'],['rebound','Rebound'],['steal','Steal']]){
  const detail=play[key];
  if(!detail)continue;
  const type=key==='rebound'?(detail.type==='defensive'?'DREB':detail.type==='offensive'?'OREB':'Rebound'):label;
  chips.push(chip(type));
  const team=key==='rebound'?wfLinkedReboundTeam(play):detail.team;
  if(team&&team!==play.team)chips.push(chip(SoccerBrand.name(state,team),'',team));
  chips.push(key==='rebound'?chip(jersey(detail.player),'',team,'rebound'):jerseyChip(detail.player,team,key));
 }
 if(play.kind==='turnover'&&!play.steal&&wfIsFull(wfMode(state))&&canWrite()&&!gameLocked(state))chips.push(chip('Add steal','',undefined,'steal'));
 return chips.join('');
}
function wfRenderMiniFlow(){
 const plays=state.events.slice(0,5);
 el('wfMiniEmpty').hidden=plays.length>0;
 el('wfMiniPlays').innerHTML=plays.map(play=>{
  const time=basketballPeriodLabel(state,play.period)+' '+play.time;
  const label='<time>'+escapeHtml(time)+'</time>';
  const edit=canWrite()&&!gameLocked(state);
  return '<li data-play-id="'+escapeHtml(play.id)+'">'+(edit?'<button type="button" class="wf-edit-time" data-edit-play="time" aria-label="Edit time '+escapeHtml(time)+'">'+label+'</button>':label)+'<div>'+wfMiniPlayChips(play)+'</div></li>';
 }).join('');
}
let wfRecentEdit=null;
document.addEventListener('click',event=>{
 const button=event.target.closest?.('#wfMiniPlays [data-edit-play]');
 if(button)wfOpenRecentEdit(button.closest('[data-play-id]').dataset.playId,button.dataset.editPlay);
});
function wfOpenRecentEdit(eid,field){
 if(!canWrite()||gameLocked(state)||wfBusy||wfDraft||wfChipEdit)return;
 const play=state.events.slice(0,5).find(e=>e.id===eid);
 if(!play)return;
 const target=wfJerseyTarget(play,field);
 const value=field==='time'?play.time:field==='points'?play.points:target?.record[target.field];
 const addSteal=field==='steal'&&play.kind==='turnover'&&!play.steal;
 if(value==null&&!addSteal&&!(field==='rebound'&&target))return;
 wfRecentEdit={eid,field,value,addSteal,team:addSteal?wfOther(play.team):target?.record.team,kind:play.kind,period:play.period,game:id};
 el('wfRecentTitle').textContent=field==='time'?'Edit play time':field==='points'?'Edit shot value':addSteal?'Add steal':field==='rebound'?'Edit rebound credit':'Edit jersey number';
 el('wfRecentHint').textContent=field==='time'?'Enter minutes and seconds (M:SS).':field==='points'?'Enter 2 or 3 for a field goal, or 1 for a free throw.':field==='rebound'?'Enter a two-digit jersey or TEAM.':wfJerseyEntryHint;
 el('wfRecentStatus').textContent='';
 const input=el('wfRecentValue');
 input.value=value==null?'':target?String(value).padStart(2,'0'):String(value);
 el('wfRecentEdit').showModal();
 input.select();
}
async function wfSaveRecentEdit(event){
 event.preventDefault();
 const edit=wfRecentEdit;
 if(!edit||!el('wfRecentEdit').open||edit.game!==id||!canWrite()||gameLocked(state)||wfBusy)return;
 const {eid,field,value,team,kind,period,addSteal}=edit;
 const input=el('wfRecentValue').value.trim();
 const clock=/^(\d{1,2}):([0-5]\d)$/.exec(input);
 const seconds=clock?Number(clock[1])*60+Number(clock[2]):null;
 const teamRebound=field==='rebound'&&input.toUpperCase()==='TEAM';
 const jersey=team&&/^\d{2}$/.test(input)?wfValidPlayer(team,input):null;
 if(field==='time'?(seconds===null||seconds>basketballPeriodSeconds(state,period)):field==='points'?!/^[1-3]$/.test(input):!teamRebound&&jersey===null){
  el('wfRecentStatus').textContent='Enter a valid value for this play.';return;
 }
 const saved=await wfSave(s=>{
  const play=s.events.find(e=>e.id===eid);
  if(!play||play.kind!==kind||play.period!==period)throw Error('The play changed. Reopen it to edit.');
  if(field==='time'){
   if(play.time!==value||seconds>basketballPeriodSeconds(s,period))throw Error('The play clock changed. Reopen it to edit.');
   play.seconds=seconds;play.time=Math.floor(seconds/60)+':'+clock[2];
  }else if(field==='points'){
   if(play.points!==value)throw Error('The shot value changed. Reopen it to edit.');
   const points=Number(input);
   if(points===Number(value))return;
   if(play.kind==='score')s.scores[play.team]+=points-Number(value);
   play.points=points;play.shotType=points===1?'free throw':points===3?'three-pointer':'jumper';
   if(points===1){delete play.shotLocation;if(play.kind==='score')play.assist='na';if(play.pendingDetail==='assist')delete play.pendingDetail;}
   else if(play.assist==='na')play.assist=null;
  }else{
   const target=wfJerseyTarget(play,field);
   const number=teamRebound?'team':wfValidPlayer(team,input,s);
   if(addSteal){
    if(play.steal||wfOther(play.team)!==team||number===null)throw Error('The turnover changed. Reopen it to edit.');
    play.steal={team,player:String(number)};delete play.pendingDetail;return;
   }
   if(!target||target.record.team!==team||target.record[target.field]!==value||number===null)throw Error('The jersey changed. Reopen the play to edit.');
   const other=field==='scorer'?play.assist:field==='assist'?play.scorer:null;
   if(other!=null&&String(other)===String(number))throw Error('The shooter cannot assist their own basket.');
   target.record[target.field]=String(number);
   if(field==='scorer')play.player=String(number);
  }
 });
 if(wfRecentEdit!==edit||id!==edit.game)return;
 if(!saved){el('wfRecentStatus').textContent='Correction not saved. Check the play and try again.';return;}
 if(el('wfRecentEdit').open)el('wfRecentEdit').close();
 wfRecentEdit=null;
 wfMessage='Play corrected.';
 wfRender();el('wfCommand').focus();
}
function wfOpenJerseyChip(index){
 if(wfDraft||wfBusy||wfChipEdit||!canWrite()||gameLocked(state))return;
 const play=wfLastPlay&&state.events.find(e=>e.id===wfLastPlay.id);
 const role=wfLastPlay?.chips[index],target=role?wfJerseyTarget(play,role):null;
 const number=target?.record[target.field];
 if(!/^\d{1,2}$/.test(String(number)))return;
 wfChipEdit={id:play.id,index,role,number,team:target.record.team,saving:false};
 wfMessage='Type the correct two-digit jersey and press Enter. Esc cancels.';
 wfRender();
 el('wfChipNumber').focus();
 el('wfChipNumber').select();
}
function wfJerseyEditKey(event){
 if(!['Enter','Escape'].includes(event.key))return;
 event.preventDefault();
 if(event.key==='Enter')return wfSaveJerseyChip();
 if(wfChipEdit?.saving)return;
 wfChipEdit=null;wfMessage='';wfRender();
 el('wfCommand').focus();
}
async function wfSaveJerseyChip(){
 const edit=wfChipEdit;
 if(!edit||edit.saving||!canWrite()||gameLocked(state))return;
 const input=el('wfChipNumber');
 const entry=input.value.trim();
 const player=/^\d{2}$/.test(entry)?wfValidPlayer(edit.team,entry):null;
 if(player===null){
  el('wfPrompt').textContent=!/^\d{2}$/.test(entry)?wfJerseyEntryHint:'Enter a jersey from '+SoccerBrand.name(state,edit.team)+'’s roster.';
  input.focus();input.select();return;
 }
 const number=String(player);
 edit.saving=true;
 input.readOnly=true;
 const saved=await write(game=>{
  const play=game.events.find(e=>e.id===edit.id),target=wfJerseyTarget(play,edit.role);
  if(!target||target.record.team!==edit.team||target.record[target.field]!==edit.number)throw Error('This jersey was changed. Reopen the play before editing.');
  const other=edit.role==='scorer'?play.assist:edit.role==='assist'?play.scorer:null;
  if(other!=null&&String(other)===number)throw Error('The shooter cannot assist their own basket.');
  target.record[target.field]=number;
  if(edit.role==='scorer')play.player=number;
 });
 if(wfChipEdit!==edit)return;
 edit.saving=false;
 if(!saved){
  input.readOnly=false;
  el('wfPrompt').textContent='Jersey not saved. Check the selection and try again.';
  input.focus();input.select();return;
 }
 wfChipEdit=null;
 wfMessage='Jersey updated. Ready for the next play.';
 wfRender();
 el('wfCommand').focus();
}
function wfRender(){
 if(!state||!el('wfPanel'))return;
 if(wfGame!==id){wfGame=id;wfDraft=null;wfInput='';wfMessage='';wfDigits='';wfLastTrail=[];wfLastPlay=null;wfChipEdit=null;wfSteps=[];}
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
 el('wfTeam').textContent=SoccerBrand.name(state,team)+(wfDraft?' · '+(wfDraft.stage==='assist'?'Assist':wfDraft.stage==='blockPlayer'?'Block':['steal','stealPlayer'].includes(wfDraft.stage)?'Steal':wfDraft.stage==='reboundPlayer'?'Rebound':wfDraft.action==='foul'?(wfDraft.technical?'Technical foul':'Personal foul'):wfDraft.action==='timeout'?'Timeout':wfDraft.action==='jump-ball'?'Jump ball':wfDraft.action==='shot'?'Shot entry':wfDraft.action):' has the ball');
 for(const t of ['home','away']){
  const button=el('wfTeam-'+t);
  button.textContent=(t==='home'?'H · ':'V · ')+SoccerBrand.name(state,t);
  button.setAttribute('aria-pressed',String(wfOffense(state)===t));
 }
 el('wfPrompt').textContent=wfMessage||wfStage();
 wfRenderTrail();
 wfRenderMiniFlow();
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
 else if(d.stage==='result')buttons=wfButton('Made · G','G')+
  wfButton('Miss + offensive rebound · O','O')+wfButton('Miss + defensive rebound · D','D')+wfButton('Missed · M','M')+(d.points>1?wfButton('Blocked shot · K','K'):'');
 else if(d.stage==='rebound')buttons=wfButton('Defensive rebound · D','D')+wfButton('Offensive rebound · O','O')+(d.block||!d.eid||d.points===1?'':wfButton('Blocked shot · K','K'))+wfButton('Skip · N','N');
 else if(d.stage==='steal')buttons=wfButton('Credit steal · S','S')+wfButton('No steal · N','N');
 else{
  buttons=wfNumbers(d.team);
  if(d.stage==='player'&&d.technical)buttons+=wfButton('Team / bench · N','N');
  if(d.stage==='assist')buttons+=wfButton('No assist + switch · Enter','END')+wfButton('No assist + switch · N','N');
  if(d.stage==='reboundPlayer')buttons+=wfButton(SoccerBrand.name(state,d.team)+' team rebound · M','M')+wfButton('Review later · Enter','REVIEW');
 }
 el('wfChoices').innerHTML=buttons;
 el('wfActionGrid').innerHTML=wfComputerActions(mode);
 el('wfChoices').hidden=!wfDraft;
 el('wfActionGrid').hidden=phone;
 el('wfSkip').hidden=!d;
 el('wfUndo').disabled=wfBusy;
 const pending=state.events.filter(wfHasPendingRebound).length;
 const details=state.events.filter(wfPendingDetail).length;
 const detailReview=el('wfDetailReview');
 detailReview.hidden=!details||!canWrite()||gameLocked(state);
 detailReview.disabled=wfBusy||!!d;
 detailReview.textContent='Review unfinished plays ('+details+')';
 const review=el('wfReviewQueue');
 review.hidden=!pending||!canWrite()||gameLocked(state);
 review.disabled=wfBusy||!!d;
 review.textContent='Review rebounds ('+pending+')';
 el('wfTracking').textContent=mode==='basic'?'Team totals · Clock, score, team fouls and timeouts. No individual statistics.':mode==='streamlined'?'Scorebook · Player points and personal fouls, with clock, team fouls and timeouts.':'Full Box · Shooting, assists, rebounds, steals, blocks, turnovers and substitutions. Minutes require a five-player lineup.';
 el('wfCoverage').textContent=wfCoverage(state);
 el('wfPanel').querySelectorAll('button,input,select').forEach(x=>{if(!x.closest('#wfActionGrid'))x.disabled=(wfBusy&&(phone||x!==field))||!canWrite()||gameLocked(state);});
 el('scoreControls').hidden=true;
 el('score').querySelectorAll(':scope > .row').forEach(x=>x.hidden=true);
 wfRenderBox();
 wfRenderLineups();
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
function wfFinish(message='Play saved. Ready for the next play.',openChart=true){
 const finished=wfDraft;
 if(finished?.eid){
  wfLastTrail=[...finished.trail];
  wfLastPlay={id:finished.eid,chips:finished.jerseyChips||{}};
 }
 wfChipEdit=null;
 wfDigits='';wfSteps=[];wfDraft=null;wfInput='';wfMessage=message;wfRender();
 if(openChart&&finished?.eid&&finished.action==='shot'&&finished.points>1&&wfMode(state)==='fullchart'&&!finished.phone&&!finished.recovered)openBasketballShotLocation(finished.eid);
}
function wfSkip(){
 if(wfBusy)return;
 wfFinish(wfDraft?.eid?'Play saved. Unassigned details can be filled in from Game Flow.':'Entry cancelled.');
 el('wfCommand').focus();
}
function wfValidPlayer(team,token,game=state){
 if(!/^\d{1,2}$/.test(token))return null;
 const roster=game.rosters?.[team]||[];
 if(!roster.length)return token;
 return roster.find(p=>String(p.number)===token)?.number??roster.find(p=>Number(p.number)===Number(token))?.number??null;
}
const wfJumpBallFields=[['offenseTeam','offenseEvent'],['possession','possessionEvent']];
function wfRestorePossession(game,event){
 const changes=event.beforePossession||event.beforeJump;
 if(!changes)return;
 for(const [field,source] of wfJumpBallFields){
  const previous=changes[field];
  if(!previous)continue;
  if(game[source]===event.id){
   game[field]=previous.value;
   game[source]=previous.source;
  }
  for(const later of game.events){
   const saved=later.beforePossession||later.beforeJump;
   if(saved?.[field]?.source===event.id)saved[field]=previous;
  }
 }
}
function wfCanEndMadePossession(game,event){
 return event?.kind==='score'&&wfCanSwitchOffense(game,event);
}
function wfCanSwitchOffense(game,event,offense=event.team){
 return game.events[0]?.id===event.id&&event.period===game.period&&wfOffense(game)===offense&&!event.beforePossession;
}
function wfSwitchOffense(game,event,offense=event.team){
 if(!wfCanSwitchOffense(game,event,offense))return false;
 event.beforePossession={offenseTeam:{value:game.offenseTeam??null,source:game.offenseEvent??null}};
 game.offenseTeam=wfOther(offense);
 game.offenseEvent=event.id;
 return true;
}
async function wfEndMadePossession(){
 const game=id,event=state.events[0];
 if(wfChipEdit||wfLastPlay?.id!==event?.id||!wfCanEndMadePossession(state,event))return true;
 let switched=false;
 const saved=await wfSave(s=>{
  switched=s.events[0]?.id===event.id&&wfSwitchOffense(s,s.events[0]);
 });
 if(!saved||id!==game)return false;
 if(switched){wfMessage='Possession switched to '+SoccerBrand.name(state,wfOffense(state))+'.';wfRender();}
 return true;
}
async function wfCommit(d){
 const eid=d.eid||(d.commitId??=crypto.randomUUID()),game=id;
 const ok=await wfSave(s=>{
  const existing=s.events.find(e=>e.id===eid);
  if(existing){
   const kind=d.action==='shot'?(d.made?'score':'miss'):d.action;
   if(existing.kind!==kind||existing.team!==d.team||existing.player!==d.player)throw Error('This play was already saved. Check Game Flow.');
   return;
  }
  if(d.phone){s.phoneBookStats=true;if(s.events.some(e=>e.individualTracking===false))s.statCoveragePartial=true;}
  const e={id:eid,kind:d.action==='shot'?(d.made?'score':'miss'):d.action,team:d.team,period:s.period,time:stamp(s),seconds:remaining(s),player:d.player,workflow:true};
  if(d.action==='shot'){
   e.individualTracking=wfMode(s)!=='basic'||!!d.phone;
   if(!e.individualTracking){e.player=null;d.player=null;}
   if(d.phone&&wfIsFull(wfMode(s)))s.statCoveragePartial=true;
   e.points=d.points;e.scorer=d.player;e.shotType=d.shotType||(d.points===1?'free throw':d.points===3?'three-pointer':'jumper');
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
  if(e.kind==='score'&&e.assist===null)e.pendingDetail='assist';
  if(e.kind==='miss'&&d.pendingRebound)e.pendingDetail=d.pendingRebound;
  if(e.kind==='turnover')e.pendingDetail='steal';
  s.events.unshift(e);
  if(e.kind==='turnover')wfSwitchOffense(s,e);
  if(e.kind==='rebound'&&e.reboundType==='defensive')wfSwitchOffense(s,e,d.offense);
 });
 if(id!==game)return false;
 if(!ok){wfMessage='Play not saved. Retry this entry.';wfRender();return false;}
 d.eid=eid;
 return true;
}
async function wfPatch(d,change,resolve=false){
 const ok=await wfSave(s=>{
  const e=s.events.find(x=>x.id===d.eid);
  if(!e)throw Error('The play was removed. Start a new entry.');
  const pending=d.recovered||d.followup;
  if(pending&&wfPendingDetail(e)!==pending)throw Error('The play was already reviewed. Check Game Flow.');
  change(e,s);
  if(resolve)delete e.pendingDetail;
 });
 if(!ok){wfMessage='Detail not saved. Retry the selection.';wfRender();}
 return ok;
}
async function wfToken(raw,fromCommand=false){
 if(state&&wfGame!==id)wfRender();
 if(wfChipEdit?.saving)return false;
 if(wfChipEdit){wfChipEdit=null;wfRender();}
 wfDigits='';
 const game=id,previous=wfDraft?structuredClone(wfDraft):null;
 const accepted=await wfApplyToken(raw,fromCommand);
 if(accepted&&id===game&&wfDraft&&wfDraft.stage!==previous?.stage)wfSteps.push(previous);
 return accepted;
}
async function wfBackStep(){
 if(wfBusy)return false;
 if(wfDigits){wfDigits=wfDigits.slice(0,-1);wfMessage='';wfRender();return true;}
 if(!wfDraft||!wfSteps.length)return true;
 const current=wfDraft,previous=wfSteps.at(-1),game=id;
 if(current.eid&&!previous?.eid){
  const expected=state.events.find(e=>e.id===current.eid);
  if(!await wfSave(s=>{
   const latest=s.events[0];
   if(!latest||latest.id!==current.eid||JSON.stringify(latest)!==JSON.stringify(expected))throw Error('The saved play changed. Review it in Game Flow.');
   s.events.shift();
   wfRestorePossession(s,latest);
   if(latest.kind==='score')s.scores[latest.team]-=latest.points;
  }))return false;
 }else if(current.block&&!previous?.block){
  const expected=state.events.find(e=>e.id===current.eid)?.block;
  if(!await wfPatch(current,e=>{
   if(e.block?.team!==expected?.team||e.block?.player!==expected?.player)throw Error('The block changed. Review it in Game Flow.');
   delete e.block;
   if((previous.followup||previous.recovered)==='blockPlayer')e.pendingDetail='blockPlayer';
  }))return false;
 }
 if(id!==game)return false;
 wfSteps.pop();
 wfDraft=previous;
 wfMessage='';
 wfRender();
 return true;
}
async function wfApplyToken(raw,fromCommand=false){
 if(!state||!canWrite()||gameLocked(state)||wfBusy||(wfSubmitting&&!fromCommand))return false;
 if(wfGame!==id)wfRender();
 const token=String(raw).trim().toUpperCase();
 wfMessage='';
 let d=wfDraft;
 if(!d){
  if(token==='END')return wfEndMadePossession();
  if(token==='H'||token==='V')return wfSetTeam(token==='H'?'home':'away',fromCommand);
  if(token==='G'){return true;}
  const team=wfOffense(state),full=wfIsFull(wfMode(state));
  const shotLabel={J:'2-point shot',Y:'3-point shot',E:'Free throw',L:'Layup',U:'Dunk'}[token];
  if(token==='I'&&full){openBasketballSubs(team,true);return true;}
  if(shotLabel)wfDraft={action:'shot',points:token==='Y'?3:token==='E'?1:2,shotType:{L:'layup',U:'dunk'}[token],team,offense:team,stage:'player',trail:[SoccerBrand.name(state,team),shotLabel]};
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
 if(['END','N'].includes(token)&&d.stage==='assist'){
  if(!await wfPatch(d,(e,s)=>{
   if(e.kind!=='score'||Number(e.points)<=1)throw Error('The shot changed. Review it in Game Flow.');
   if(e.assist==null)e.assist='no-assist';
   if(!d.recovered||e.period===s.period)wfSwitchOffense(s,e);
  },true))return false;
  if(state.events.find(e=>e.id===d.eid)?.assist==='no-assist')d.trail.push('No assist');
  wfFinish();return true;
 }
 if(token==='N'&&['rebound','steal'].includes(d.stage)){
  if(d.eid&&state.events.find(e=>e.id===d.eid)?.pendingDetail){
   if(!await wfPatch(d,()=>{},true))return false;
  }
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
  const reboundType=wfReboundType(token);
  const blocked=token==='K'&&d.points>1;
  if(!blocked&&!reboundType&&!['G','M','X'].includes(token)){wfMessage=wfStage();wfRender();return false;}
  d.made=token==='G';
  d.pendingRebound=!d.made?(blocked?'blockPlayer':reboundType||(el('wfPrompts').checked?'rebound':null)):null;
  if(!await wfCommit(d))return false;
  const pending=d.followup=wfPendingDetail(state.events.find(e=>e.id===d.eid));
  d.trail.push(d.made?'Made':'Missed');
  if(pending==='offensive'||pending==='defensive')wfChooseRebound(d,pending);
  else if(pending==='blockPlayer')wfChooseBlock(d);
  else if(pending)d.stage=pending;
  else wfFinish();
  wfRender();return true;
 }
 if(d.stage==='steal'){
  if(token!=='S'){wfMessage='Choose S for a steal or N for none.';wfRender();return false;}
  d.team=wfOther(d.offense);d.stage='stealPlayer';d.trail.push('Steal');wfRender();return true;
 }
 if(d.stage==='rebound'){
  if(token==='K'&&d.eid&&!d.block&&d.points!==1){wfChooseBlock(d);wfRender();return true;}
  const reboundType=wfReboundType(token);
  if(!reboundType){wfMessage=wfStage();wfRender();return false;}
  wfChooseRebound(d,reboundType);wfRender();return true;
 }
 if(d.stage==='player'&&d.technical&&token==='N'){
  if(!await wfCommit(d))return false;
  d.trail.push('Team / bench');
  wfFinish('Technical foul saved.');return true;
 }
 if(d.stage==='reboundPlayer'){
  if(token==='REVIEW')return wfSaveRebound(d,null);
  if(token==='M'||token==='TEAM')return wfSaveRebound(d,'team');
 }
 const number=wfValidPlayer(d.team,token);
 if(number===null){wfMessage='Enter a jersey number from '+SoccerBrand.name(state,d.team)+'’s roster.';wfRender();return false;}
 if(d.stage==='phonePlayer'){
  if(!await wfPatch(d,e=>{e.scorer=String(number);e.player=String(number);}))return false;
  wfAddJerseyChip(d,'scorer',number);wfFinish();return true;
 }
 if(d.stage==='assist'){
  const shot=state.events.find(e=>e.id===d.eid);
  if(String(shot?.scorer)===String(number)){wfMessage='The shooter cannot assist their own basket.';wfRender();return false;}
  if(!await wfPatch(d,(e,s)=>{
   if(e.kind!=='score'||Number(e.points)<=1)throw Error('The shot changed. Review it in Game Flow.');
   if(String(e.scorer)===String(number))throw Error('The shooter cannot assist their own basket.');
   e.assist=String(number);
   if(!d.recovered||e.period===s.period)wfSwitchOffense(s,e);
  },true))return false;
  wfAddJerseyChip(d,'assist',number);wfFinish();return true;
 }
 if(d.stage==='blockPlayer'||d.stage==='stealPlayer'){
  const key=d.stage==='blockPlayer'?'block':'steal';
  if(!await wfPatch(d,e=>{
   e[key]={team:d.team,player:String(number)};
   if(key==='block'&&e.pendingDetail==='blockPlayer')e.pendingDetail='rebound';
  },key==='steal'))return false;
  wfAddJerseyChip(d,key,number);
  if(key==='block'){if(d.followup==='blockPlayer')d.followup='rebound';if(d.recovered==='blockPlayer')d.recovered='rebound';d.block=true;d.team=d.offense;d.stage='rebound';wfRender();}else wfFinish();
  return true;
 }
 if(d.stage==='reboundPlayer')return wfSaveRebound(d,String(number));
 d.player=String(number);wfAddJerseyChip(d,d.action==='shot'?'scorer':'player',number);
 if(d.action==='shot'){
  if(!wfIsFull(wfMode(state))||d.phone){
   d.made=true;d.trail.push('Made');if(!await wfCommit(d))return false;wfFinish();
  }else{d.stage='result';wfRender();}
  return true;
 }
 if(!await wfCommit(d))return false;
 if(d.action==='turnover'){d.team=wfOther(d.offense);d.stage='steal';d.followup='steal';wfRender();}else wfFinish();
 return true;
}
function wfChooseBlock(d){
 d.team=wfOther(d.offense);d.stage='blockPlayer';d.trail.push('Block');
}
function wfChooseRebound(d,type){
 const shootingTeam=state.events.find(e=>e.id===d.eid&&e.kind==='miss')?.team??d.offense;
 d.reboundType=type;
 d.team=wfReboundTeam(shootingTeam,type);
 d.stage='reboundPlayer';
 d.trail.push(type+' rebound');
}
async function wfSaveRebound(d,player){
 let creditedTeam=d.team;
 if(d.review){
  if(player!==null&&!await wfPatch(d,e=>{
   const rebound=e.kind==='rebound'?e:e.rebound;
   if(!rebound||rebound.player!==null||rebound.team!==d.team)throw Error('The rebound changed. Reopen it from Game Flow.');
   rebound.player=player;
  }))return false;
 }else if(d.eid){
  if(!await wfPatch(d,(e,s)=>{
   if(e.kind!=='miss')throw Error('The shot changed. Review it in Game Flow.');
   creditedTeam=wfReboundTeam(e.team,d.reboundType);
   if(creditedTeam!==d.team&&player!=='team')throw Error('The rebound team changed. Review the shot in Game Flow.');
   e.rebound={team:creditedTeam,player,type:d.reboundType};
   if(d.reboundType==='defensive')wfSwitchOffense(s,e);
   else if(e.beforePossession){wfRestorePossession(s,e);delete e.beforePossession;}
  },true))return false;
 }else{
  d.player=player;
  if(!await wfCommit(d))return false;
 }
 if(player===null||player==='team')d.trail.push(player===null?'Review later':'Team rebound');
 else wfAddJerseyChip(d,'rebound',player);
 const message=player===null?'Rebound saved for review in Game Flow.':player==='team'?SoccerBrand.name(state,creditedTeam)+' team rebound saved.':'Rebound saved.';
 wfFinish(message,player!==null);
 return true;
}
async function wfSubmit(event){
 event?.preventDefault();
 if(wfBusy||wfSubmitting)return;
 const command=el('wfCommand').value.trim();
 if(!command)return;
 wfInput='';el('wfCommand').value='';
 const tokens=command.toUpperCase().match(/TEAM|\d+|[A-Z]/g)||[];
 wfSubmitting=true;
 try{
  for(let i=0;i<tokens.length;i++){
   const token=tokens[i];
   const incompleteJersey=/^\d+$/.test(token)&&!/^\d{2}$/.test(token);
   if(incompleteJersey){wfMessage=wfJerseyEntryHint;wfRender();}
   if(incompleteJersey||!await wfToken(token,true)){
    wfInput=tokens.slice(i).join(' ');el('wfCommand').value=wfInput;break;
   }
   if(token==='I')return;
  }
 }finally{wfSubmitting=false;}
 el('wfCommand').focus();
}
function wfNeedsJersey(){
 return ['player','assist','reboundPlayer','blockPlayer','stealPlayer'].includes(wfDraft?.stage);
}

async function wfProcessKey(key){
 if(key==='ESCAPE'){wfSkip();return;}
 if(key==='BACKSPACE')return wfBackStep();
 if(/^\d$/.test(key)&&wfNeedsJersey()){
  wfDigits+=key;
  if(wfDigits.length===1){wfMessage='';wfRender();return;}
  return wfToken(wfDigits);
 }
 if(wfDigits){wfMessage=wfJerseyEntryHint;wfRender();return false;}
 if(key==='ENTER'){
  if(wfDraft?.stage==='reboundPlayer')return wfToken('REVIEW');
  if(!wfDraft||wfDraft.stage==='assist')return wfToken('END');
  return true;
 }
 return wfToken(key);
}

document.removeEventListener('keydown',basketballKeydown);
document.addEventListener('keydown',event=>{
 if(event.defaultPrevented||event.isComposing||event.altKey||event.ctrlKey||event.metaKey||!state||!canWrite()||gameLocked(state)||el('app').classList.contains('hide'))return;
 if(el('basketballSaveRecovery').open||el('basketballNextPeriod').open||el('wfRecentEdit').open||el('basketballGameText').open||el('basketballClockSettings').open||el('basketballPdfDialog').open||el('shotLocationDialog').open||pickerEvent)return;
 if(!el('subSheet').classList.contains('hide'))return basketballSubKeys(event);
 if(event.target?.closest?.('#basketballClockEditor')?.id==='basketballClockEditor')return;
 if(event.key==='F8'){event.preventDefault();if(!event.repeat)toggleClock();return;}
 const editable=event.target?.closest?.('input,textarea,select,[contenteditable=true]');
 if(wfIsPhone()){
  if(event.key==='Escape'&&!wfBusy&&wfDraft){event.preventDefault();wfSkip();}
  if(event.key===' '&&!editable){event.preventDefault();if(!event.repeat)toggleClock();}
  return;
 }
 const commandField=event.target===el('wfCommand');
 if(editable&&!commandField)return;
 if(event.key===' '&&!commandField&&event.target?.closest?.('#wfTrail button, #wfMiniPlays button'))return;
 if(event.key===' '){event.preventDefault();if(!event.repeat)return toggleClock();return;}
 if(event.repeat||el('score').classList.contains('hide'))return;
 if(event.key==='Enter'&&!commandField&&event.target?.closest?.('button,a,summary'))return;
 if(!/^[a-z0-9]$/i.test(event.key)&&!['Escape','Backspace','Enter'].includes(event.key))return;
 event.preventDefault();
 if(!commandField&&/^[a-z0-9]$/i.test(event.key))el('wfCommand').focus();
 const game=id,generation=wfKeyGeneration,key=event.key.toUpperCase();
 wfKeyQueue=wfKeyQueue.then(async()=>{
  if(generation!==wfKeyGeneration||id!==game||!state||!canWrite()||gameLocked(state)||wfIsPhone()||!el('subSheet').classList.contains('hide')||el('wfRecentEdit').open||el('shotLocationDialog').open||el('score').classList.contains('hide'))return;
  if(await wfProcessKey(key)===false)wfKeyGeneration++;
 }).catch(error=>{
  wfKeyGeneration++;console.error(error);
  if(id===game){wfMessage='Could not process that key. Check the play before continuing.';wfRender();}
 });
 return wfKeyQueue;
});
render=function(){
 wfOriginalRender();
 const draft=wfDraft;
 if(!wfBusy&&wfGame===id&&draft){
  const committed=draft.commitId&&!draft.eid&&state.events.some(e=>e.id===draft.commitId);
  const pending=draft.recovered||draft.followup;
  const detailChanged=pending&&wfPendingDetail(state.events.find(e=>e.id===draft.eid))!==pending;
  if(committed||detailChanged){
   wfKeyGeneration++;
   wfFinish('Game updated. Check Game Flow for the saved play.',false);
  }else wfRender();
 }else wfRender();
 renderBasketballGameText();
 renderBasketballClockEditor();
};
playLabel=function(e){
 const labels={'jump-ball':'Jump ball',rebound:'Rebound',turnover:'Turnover',steal:'Steal',block:'Block'};
 let label=e.openingTip?'Opening tip':e.kind==='foul'&&e.foulType==='technical'?'Technical foul':labels[e.kind]||wfOriginalLabel(e);
 if(e.player&& !['score','miss'].includes(e.kind))label+=' · '+(e.player==='team'?'Team':'#'+e.player);
 if(e.kind==='rebound'&&e.player===null)label=(e.reboundType==='defensive'?'Defensive':'Offensive')+' rebound · Review later';
 if(e.rebound){
  const player=e.rebound.player;
  label+=' · '+e.rebound.type+' rebound '+SoccerBrand.name(state,wfLinkedReboundTeam(e))+' · '+(player===null?'Review later':player==='team'?'Team':'#'+player);
 }
 if(e.block)label+=' · Block #'+e.block.player;
 if(e.steal)label+=' · Steal #'+e.steal.player;
 return label;
};
eventHtml=function(e){
 let html=wfOriginalEvent(e);
 if(wfMode(state)!=='fullchart')html=html.replace('<button onclick="openBasketballShotLocation','<button disabled title="Available in Full Suite + shot chart" onclick="openBasketballShotLocation');
 if(e.individualTracking===false)html=html.replace(/<button[^>]*onclick="assign\('[^']*','(?:scorer|assist|player)'\)"[\s\S]*?<\/button>/g,'');
 const detail=wfPendingDetail(e);
 if(detail){
  const label=detail==='blockPlayer'?'block':detail==='assist'?'assist':detail==='steal'?'steal':'rebound';
  html=html.replace('<div class="flowActions">','<div class="flowActions"><button class="pending" onclick="wfReviewDetail(\''+escapeHtml(e.id)+'\')">Review '+label+'</button>');
 }
 const pendingRebound=wfHasPendingRebound(e);
 if(pendingRebound)html=html.replace('<div class="flowActions">','<div class="flowActions"><button class="pending" onclick="wfReviewRebound(\''+escapeHtml(e.id)+'\')">Assign rebounder</button>');
 if(e.kind==='miss')html=html.replace('<div class="flowActions">','<div class="flowActions"><button '+(!wfIsFull(wfMode(state))?'disabled title="Available in Full Suite" ':'')+'onclick="wfEditOutcome(\''+escapeHtml(e.id)+'\')">Rebound / block</button>');
 for(const key of ['rebound','block','steal']){
  if(e[key])html=html.replace('<div class="flowActions">','<div class="flowActions"><button onclick="wfRemoveOutcome(\''+escapeHtml(e.id)+'\',\''+key+'\')">Remove '+key+'</button>');
 }
 if(e.assist==='untracked')html=html.replace(/<button[^>]*onclick="assign\('[^']*','assist'\)"[\s\S]*?<\/button>/,'');
 if(e.workflow){
  const line=SoccerBrand.name(state,e.team)+' · '+playLabel(e)+(['score','miss'].includes(e.kind)&&e.individualTracking!==false?' · '+wfPlayerName(e.team,e.scorer):'');
  html=html.replace('<div class="flowActions">','<p class="wf-logline">'+escapeHtml(line)+'</p><div class="flowActions">');
  if(!pendingRebound&&e.individualTracking!==false&&!['score','miss','timeout','jump-ball'].includes(e.kind))html=html.replace('<div class="flowActions">','<div class="flowActions"><button onclick="assign(\''+escapeHtml(e.id)+'\',\'player\')">Change player</button>');
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
 if(wfBusy||wfChipEdit?.saving)return;
 const latest=state?.events?.[0];
 if(latest?.workflow){
  const ok=await wfSave(s=>{
   if(s.events[0]?.id!==latest.id)throw Error('A newer play was saved. Review Game Flow before undoing.');
   const e=s.events.shift();
   if(e.kind==='score')s.scores[e.team]-=e.points;
   if(e.kind==='foul')s.fouls[e.team]--;
   if(e.kind==='timeout')s.timeouts[e.team]++;
   wfRestorePossession(s,e);
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
   wfRestorePossession(s,removed);
  });
 }else if(e&&['rebound','steal','block','turnover'].includes(e.kind)){
  if(!confirm('Remove this play and its linked statistics?'))return;
  await wfSave(s=>{
   const index=s.events.findIndex(x=>x.id===eid);
   if(index<0)return;
   const [removed]=s.events.splice(index,1);
   wfRestorePossession(s,removed);
   s.statCoveragePartial=true;
  });
 }else{
  await wfOriginalCorrect(eid);
  const changed=state.events.find(x=>x.id===eid);
  if(changed?.kind==='score'&&(changed.rebound||changed.block)){
   await wfSave(s=>{const play=s.events.find(x=>x.id===eid);if(play){delete play.rebound;delete play.block;}});
  }
 }
 if(wfDraft?.eid===eid)wfFinish('Play changed. Review Game Flow before continuing.');
};
// Save the follow-up with the play so a new scorer session can recover it from the game record.
function wfPendingDetail(event){
 if(!event)return null;
 const detail=event.pendingDetail;
 if(detail==='assist'&&event.kind==='score'&&Number(event.points)>1&&event.assist===null)return detail;
 if(detail==='steal'&&event.kind==='turnover'&&!event.steal)return detail;
 if(['rebound','offensive','defensive','blockPlayer'].includes(detail)&&event.kind==='miss'&&!event.rebound)return detail;
 return null;
}
function wfReviewNextDetail(){
 const play=state?.events.findLast(wfPendingDetail);
 if(play)wfReviewDetail(play.id);
}
function wfReviewDetail(eid){
 if(wfBusy||wfDraft||!canWrite()||gameLocked(state))return;
 const play=state.events.find(e=>e.id===eid),detail=wfPendingDetail(play);
 if(!detail)return;
 const turnover=detail==='steal';
 wfDraft={action:turnover?'turnover':'shot',eid,team:turnover?wfOther(play.team):play.team,offense:play.team,
  stage:turnover||detail==='assist'?detail:'rebound',points:play.points,block:!!play.block,recovered:detail,
  trail:[SoccerBrand.name(state,play.team),playLabel(play)]};
 if(detail==='offensive'||detail==='defensive')wfChooseRebound(wfDraft,detail);
 if(detail==='blockPlayer')wfChooseBlock(wfDraft);
 showTab('score');wfRender();
 if(!wfIsPhone())el('wfCommand').focus();
}
function wfHasPendingRebound(event){
 return event.rebound?.player===null||(event.kind==='rebound'&&event.player===null);
}
function wfReviewNextRebound(){
 const pending=state?.events.findLast(wfHasPendingRebound);
 if(pending)wfReviewRebound(pending.id);
}
function wfReviewRebound(eid){
 if(wfBusy||wfDraft||!canWrite()||gameLocked(state))return;
 const e=state.events.find(x=>x.id===eid);
 const rebound=e?.kind==='rebound'?e:e?.rebound;
 if(!rebound||rebound.player!==null)return;
 const type=rebound.reboundType||rebound.type;
 wfDraft={action:'rebound',eid,review:true,stage:'reboundPlayer',team:rebound.team,trail:[SoccerBrand.name(state,rebound.team),type+' rebound']};
 showTab('score');wfRender();
 if(!wfIsPhone())el('wfCommand').focus();
}
function wfEditOutcome(eid){
 if(wfBusy||wfDraft)return;
 const e=state.events.find(x=>x.id===eid);
 if(!e||e.kind!=='miss')return;
 if(wfPendingDetail(e))return wfReviewDetail(eid);
 wfDraft={action:'shot',eid:e.id,team:e.team,offense:e.team,stage:'rebound',trail:[SoccerBrand.name(state,e.team),'Miss '+e.points,'#'+e.scorer],block:!!e.block};
 showTab('score');wfRender();
}
async function wfRemoveOutcome(eid,key){
 if(!['rebound','block','steal'].includes(key))return;
 await wfSave(s=>{const e=s.events.find(x=>x.id===eid);if(e){if(key==='rebound'&&e.beforePossession){wfRestorePossession(s,e);delete e.beforePossession;}delete e[key];}});
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
  if(e.rebound)add(wfLinkedReboundTeam(e),e.rebound.player,e.rebound.type==='offensive'?'oreb':'dreb');
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
  const out=String(e.out||'').split(', ').filter(Boolean),incoming=String(e.in||'').split(', ').filter(Boolean);
  if(!e.lineup&&(out.length!==incoming.length||out.some(n=>!active.has(n))||incoming.some(n=>active.has(n))))return null;
  for(const n of active)totals[n]=(totals[n]||0)+at-previous;
  if(e.lineup?.length===5){active.clear();e.lineup.forEach(n=>active.add(n));}
  else{out.forEach(n=>active.delete(n));incoming.forEach(n=>active.add(n));}
  previous=at;
 }
 if(end<previous)return null;
 for(const n of active)totals[n]=(totals[n]||0)+end-previous;
 return totals;
}
function wfLineupGroups(game,team){
 const active=basketballOnCourt(game,team);
 const roster=game.rosters?.[team]||[];
 if(active?.size!==5)return {active:null,bench:[],roster};
 return {
  active:[...active].sort((a,b)=>Number(a)-Number(b)||String(a).localeCompare(String(b))).map(number=>roster.find(player=>String(player.number)===String(number))||{number}),
  bench:roster.filter(player=>!active.has(String(player.number))),
  roster
 };
}
function wfRenderLineups(){
 const box=el('wfLineups');
 const order=state.screenSidesSwapped?['home','away']:['away','home'];
 const list=(players,empty)=>players.length?'<ul>'+players.map(player=>
  '<li><b>#'+escapeHtml(player.number)+'</b>'+(player.name?'<span>'+escapeHtml(player.name)+'</span>':'')+'</li>').join('')+'</ul>':'<p>'+empty+'</p>';
 box.innerHTML=order.map(team=>{
  const {active,bench,roster}=wfLineupGroups(state,team);
  const lineupHint=wfIsFull(wfMode(state))?'':' title="Shows the last recorded lineup"';
  return '<div class="wf-lineup"><h3>'+escapeHtml(SoccerBrand.name(state,team))+'</h3>'+
   (active?'<h4'+lineupHint+'>On the floor</h4>'+list(active,'')+'<h4>Bench</h4>'+list(bench,'No bench players'):
    '<p>No starting five recorded</p>'+(roster.length?'<h4>Roster</h4>'+list(roster,''):''))+'</div>';
 }).join('');
 box.hidden=order.every(team=>!(state.rosters?.[team]?.length||state.startingLineups?.[team]?.length));
}
function wfRenderBox(){
 const box=el('wfBox');if(!box)return;
 const teamOnly=wfMode(state)==='basic'&&!wfIsPhone();
 el('wfBoxSortControl').hidden=teamOnly;
 if(teamOnly){box.innerHTML='<p>Basic records team totals. Choose Streamlined to track player points and fouls.</p>';return;}
 const mode=wfMode(state),stats=basketballBoxScore(state),full=wfIsFull(mode);
 const byPoints=el('wfBoxSort').value==='points';
 const labels=mode==='basic'?['PTS','PF','TF']:['PTS','PF','TF','FG','3PT','FT',...(full?['REB','AST','STL','BLK','TO','MIN']:[])];
 const cells=(p,minutes)=>mode==='basic'?[p.pts,p.pf,p.tf]:[p.pts,p.pf,p.tf,p.fgm+'-'+p.fga,p.tm+'-'+p.ta,p.ftm+'-'+p.fta,...(full?[p.reb,p.ast,p.stl,p.blk,p.to,minutes==null?'—':Math.floor(minutes/60)+':'+String(minutes%60).padStart(2,'0')]:[])];
 box.innerHTML=['away','home'].map(t=>{
  const mins=full?wfMinutes(state,t):null;
  const numbers=[...new Set([...(state.rosters?.[t]||[]).map(p=>String(p.number)),...Object.keys(stats.totals[t])])];
  numbers.sort((a,b)=>{
   if(a==='Unassigned')return 1;
   if(b==='Unassigned')return -1;
   const difference=byPoints?(stats.totals[t][b]?.pts??0)-(stats.totals[t][a]?.pts??0):0;
   return difference||Number(a)-Number(b)||a.localeCompare(b);
  });
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
