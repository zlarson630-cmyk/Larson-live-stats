const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');

function setup(mode='full',options={}){
 const prefix=fs.readFileSync('tests/live.test.cjs','utf8').split('\ntest(')[0];
 const shared={exports:{}};
 new Function('require','module',prefix+'\nmodule.exports={app,cloud,initial};')(require,shared);
 const {app,cloud,initial}=shared.exports;
 const a=app(),lookup=a.ctx.document.getElementById;
 a.ctx.document.getElementById=id=>{
  const node=lookup(id);
  node.style.setProperty=()=>{};node.dataset={};
  return node;
 };
 a.ctx.crypto=crypto;a.ctx.matchMedia=()=>({matches:true});
 const game={...structuredClone(initial),scoringMode:mode,offenseTeam:'home',reboundPrompts:true,
  rosters:{home:[{number:'11',name:'Shooter'},{number:'02',name:'Passer'},{number:'04',name:'Home rebounder'}],away:[{number:'24',name:'Visitor shooter'},{number:'04',name:'Visitor rebounder'}]},...options};
 const db=cloud(a,{game});
 a.run(fs.readFileSync('basketball-workflow.js','utf8'));
 a.run("wfLayout='computer'");
 return {...a,db,async command(text){a.node('wfCommand').value=text;await a.ctx.wfSubmit({preventDefault(){}});return db.row();}};
}

test('one-person book entry credits points and personal/team fouls while keeping the arrow separate',async()=>{
 const a=setup('streamlined',{possession:'away'});
 let game=await a.command('H Y 11');
 assert.equal(game.scores.home,3);
 assert.equal(game.events[0].scorer,'11');
 assert.equal(game.offenseTeam,'home');
 assert.equal(game.possession,'away');
 game=await a.command('F V 24');
 assert.equal(game.fouls.away,1);
 assert.equal(game.events[0].player,'24');
 assert.equal(a.ctx.basketballBoxScore(game).totals.away['24'].pf,1);
 await a.ctx.undo();
 assert.equal(a.db.row().fouls.away,0);
 await a.ctx.undo();
 assert.equal(a.db.row().scores.home,0);
 assert.equal(a.db.row().offenseTeam,'home');
});

test('a complete keyboard sequence links assist, rebound and block without duplicate shots',async()=>{
 const a=setup();
 let game=await a.command('H Y 11 G 02');
 assert.equal(game.events.length,1);
 assert.equal(game.events[0].assist,'02');
 assert.equal(game.offenseTeam,'home');
 game=await a.command('V J 24 M K 04 D 02');
 assert.equal(game.events.length,2);
 const miss=game.events[0];
 assert.equal(miss.scorer,'24');
 assert.deepEqual(JSON.parse(JSON.stringify(miss.block)),{team:'home',player:'04'});
 assert.deepEqual(JSON.parse(JSON.stringify(miss.rebound)),{team:'home',player:'02',type:'defensive'});
 assert.equal(game.offenseTeam,'away');
 const box=a.ctx.basketballBoxScore(game);
 assert.equal(box.totals.home['04'].blk,1);
 assert.equal(box.totals.home['02'].reb,1);
 assert.equal(box.totals.home['02'].ast,1);
 await a.ctx.undo();
 assert.equal(a.db.row().events.length,1);
 assert.equal(a.ctx.basketballBoxScore(a.db.row()).teams.home.blk,0);
 assert.equal(a.db.row().offenseTeam,'away');
});

test('rebounds, turnovers and linked steals keep possession under manual control',async()=>{
 const a=setup();
 let game=await a.command('H J 11 M O 04');
 assert.equal(game.offenseTeam,'home');
 assert.equal(a.ctx.basketballBoxScore(game).teams.home.oreb,1);
 game=await a.command('T 02 S 24');
 assert.equal(game.offenseTeam,'home');
 assert.deepEqual(JSON.parse(JSON.stringify(game.events[0].steal)),{team:'away',player:'24'});
 const box=a.ctx.basketballBoxScore(game);
 assert.equal(box.teams.home.to,1);assert.equal(box.teams.away.stl,1);
});

test('prompt toggle and Streamlined stop at the miss; free throws leave possession for confirmation',async()=>{
 const a=setup('streamlined');
 let game=await a.command('H E 11 G');
 assert.equal(game.offenseTeam,'home');
 assert.equal(game.events[0].assist,'na');
 game=await a.command('H J 11 M');
 assert.equal(a.run('wfDraft'),null);
 assert.equal(a.ctx.basketballBoxScore(game).teams.home.fga,1);
 await a.ctx.wfSetMode('full');await a.ctx.wfSetPrompts(false);
 await a.command('H J 11 M');
 assert.equal(a.run('wfDraft'),null);
 assert.equal(a.db.row().statCoveragePartial,true);
});

test('invalid players and self-assists can be corrected without double scoring',async()=>{
 const a=setup();
 await a.command('H Y 99 G');
 assert.equal(a.db.row().events.length,0);
 await a.command('11 G 11');
 assert.equal(a.db.row().scores.home,3);
 assert.equal(a.run('wfDraft.stage'),'assist');
 await a.command('02');
 assert.equal(a.db.row().scores.home,3);
 assert.equal(a.db.row().events[0].assist,'02');
 assert.equal(a.run('wfDraft'),null);
});

test('failed saves keep the draft for retry and viewers cannot write',async()=>{
 const a=setup('basic');
 a.ctx.write=async()=>false;
 await a.command('J 11');
 assert.equal(a.db.row().events.length,0);
 assert.equal(a.run('wfDraft.action'),'shot');
 a.run('owner=false');
 await a.command('Y 11');
 assert.equal(a.db.row().events.length,0);
});

test('minutes require five starters and integrate substitutions at their game clock',()=>{
 const a=setup();
 const game={period:1,seconds:360,running:false,startingLineups:{home:['1','2','3','4','5']},events:[{kind:'substitution',team:'home',period:1,time:'7:00',out:'1',in:'6'}]};
 const minutes=a.ctx.wfMinutes(game,'home');
 assert.equal(minutes['1'],60);assert.equal(minutes['6'],60);assert.equal(minutes['2'],120);
 assert.equal(a.ctx.wfMinutes({...game,startingLineups:{}},'home'),null);
});

test('a timeout for either team preserves ball possession and can be undone',async()=>{
 const a=setup('basic');
 let game=await a.command('O V');
 assert.equal(game.timeouts.away,4);
 assert.equal(game.offenseTeam,'home');
 await a.ctx.undo();
 assert.equal(a.db.row().timeouts.away,5);
 game=await a.command('V J 24');
 assert.equal(game.scores.away,2);
 assert.equal(game.offenseTeam,'away');
});

test('back-to-back submissions cannot duplicate a play while its save is in flight',async()=>{
 const a=setup('basic');
 a.node('wfCommand').value='J 11';
 await Promise.all([a.ctx.wfSubmit({preventDefault(){}}),a.ctx.wfSubmit({preventDefault(){}})]);
 assert.equal(a.db.row().events.length,1);
 assert.equal(a.db.row().scores.home,2);
});

test('made shots in all three modes preserve the selected team until H or V is entered',async()=>{
 for(const mode of ['basic','streamlined','full']){
  const a=setup(mode,{offenseTeam:'away'});
  const game=await a.command(mode==='basic'?'V Y':mode==='streamlined'?'V Y 24 G':'V Y 24 G N');
  assert.equal(game.offenseTeam,'away');
  assert.equal(game.scores.away,3);
  await a.command('H');
  assert.equal(a.db.row().offenseTeam,'home');
 }
});

test('computer Basic records only team totals without asking for a jersey',async()=>{
 const a=setup('basic');
 let game=await a.command('J');
 assert.equal(game.scores.home,2);
 assert.equal(game.events[0].individualTracking,false);
 assert.equal(game.events[0].scorer,null);
 assert.equal(a.run('wfDraft'),null);
 game=await a.command('F V');
 assert.equal(game.fouls.away,1);
 assert.equal(game.events[0].player,null);
 assert.equal(a.run('wfDraft'),null);
});

test('computer actions keep their order across modes and lock unavailable stats',()=>{
 const a=setup();
 const labels=html=>[...html.matchAll(/>([^<>]+)(?:<small>|<\/button>)/g)].map(m=>m[1]);
 const basic=a.ctx.wfComputerActions('basic'),full=a.ctx.wfComputerActions('full'),charted=a.ctx.wfComputerActions('fullchart');
 assert.deepEqual(labels(basic),labels(full));
 assert.deepEqual(labels(full),labels(charted));
 assert.match(basic,/<button[^>]*disabled[^>]*onclick="wfToken\('R'\)"/);
 assert.doesNotMatch(full,/<button[^>]*disabled[^>]*onclick="wfToken\('R'\)"/);
 assert.match(full,/<button[^>]*disabled[^>]*onclick="wfOpenLatestChart\(\)"/);
 assert.doesNotMatch(charted,/<button[^>]*disabled[^>]*onclick="wfOpenLatestChart\(\)"/);
});

test('phone keeps both team scoring buttons visible and credits the chosen player',async()=>{
 const a=setup('basic');a.run("wfLayout='phone';wfRender()");
 const buttons=a.node('wfPhoneTeams').innerHTML;
 for(const t of ['home','away'])for(const n of [1,2,3])assert.ok(buttons.includes("wfPhoneShot('"+t+"',"+n+")"));
 await a.ctx.wfPhoneShot('away',3);
 assert.equal(a.db.row().scores.away,3);
 await a.command('24');
 const game=a.db.row();
 assert.equal(game.scores.away,3);
 assert.equal(game.events[0].scorer,'24');
 assert.equal(game.events[0].individualTracking,true);
 assert.equal(a.run('wfDraft'),null);
 assert.ok(a.node('wfPhoneTeams').innerHTML.includes("wfPhoneShot('home',2)"));
});

test('desktop keys build and save a play without Enter, even while an earlier key is saving',async()=>{
 const a=setup();
 const field=a.node('wfCommand');
 await Promise.all([...('VY24GN')].map(key=>a.press(key,{target:field})));
 const game=a.db.row();
 assert.equal(game.scores.away,3);
 assert.equal(game.events[0].scorer,'24');
 assert.equal(game.events[0].assist,'no-assist');
 const chips=a.node('wfTrail').innerHTML;
 for(const label of ['Away','Y · 3PT','#24','MAKE'])assert.ok(chips.includes(label));
});

test('ambiguous jersey prefixes wait for the next digit or the next action',async()=>{
 const a=setup('full',{rosters:{home:[{number:'2'},{number:'23'}],away:[]}});
 const field=a.node('wfCommand');
 await a.press('Y',{target:field});
 await a.press('2',{target:field});
 assert.equal(a.run('wfDraft.stage'),'player');
 assert.match(a.node('wfTrail').innerHTML,/#2/);
 await a.press('3',{target:field});
 await a.press('G',{target:field});
 await a.press('N',{target:field});
 assert.equal(a.db.row().events[0].scorer,'23');
 await Promise.all([...('Y2GN')].map(key=>a.press(key,{target:field})));
 assert.equal(a.db.row().events[0].scorer,'2');
});

test('Space toggles the clock in the command field and preserves a jersey in progress',async()=>{
 const a=setup('full',{rosters:{home:[{number:'2'},{number:'23'}],away:[]}});
 const field=a.node('wfCommand');
 field.closest=()=>field;
 field.focus();
 await a.press(' ');
 assert.equal(a.db.row().running,true);
 let repeatPrevented=false;
 await a.press(' ',{repeat:true,preventDefault(){repeatPrevented=true;}});
 assert.equal(repeatPrevented,true);
 assert.equal(a.db.row().running,true);

 await a.press('Y');
 await a.press('2');
 await a.press(' ');
 assert.equal(a.db.row().running,false);
 assert.equal(a.run('wfDraft.stage'),'player');
 assert.equal(a.run('wfDigits'),'2');
 assert.equal(a.ctx.document.activeElement,field);

 for(const key of '3GN')await a.press(key);
 assert.equal(a.db.row().scores.home,3);
 assert.equal(a.db.row().events[0].scorer,'23');
});

test('desktop Jump ball works in every mode and updates both possession indicators',async()=>{
 for(const mode of ['basic','streamlined','full','fullchart']){
  const a=setup(mode,{offenseTeam:'home',possession:null});
  assert.match(a.ctx.wfComputerActions(mode),/<button type="button" title="" onclick="wfToken\('B'\)">Jump ball/);
  const field=a.node('wfCommand');
  await Promise.all(['B','V'].map(key=>a.press(key,{target:field})));
  let game=a.db.row();
  assert.equal(game.offenseTeam,'away');
  assert.equal(game.possession,'home');
  assert.equal(game.events.length,1);
  assert.equal(game.events[0].kind,'jump-ball');
  assert.equal(game.events[0].team,'away');
  assert.equal(a.ctx.playLabel(game.events[0]),'Jump ball');
  assert.doesNotMatch(a.ctx.eventHtml(game.events[0]),/Change player/);
  await a.ctx.undo();
  game=a.db.row();
  assert.equal(game.offenseTeam,'home');
  assert.equal(game.possession,null);
  assert.equal(game.events.length,0);
 }
});

test('removing an older jump ball preserves the newer one and its undo history',async()=>{
 const a=setup('basic',{offenseTeam:'home',possession:'away'});
 let game=await a.command('B V');
 const first=game.events[0].id;
 game=await a.command('B H');
 await a.ctx.correctEvent(first);
 assert.equal(a.db.row().events.length,1);
 assert.equal(a.db.row().offenseTeam,'home');
 await a.ctx.undo();
 game=a.db.row();
 assert.equal(game.offenseTeam,'home');
 assert.equal(game.possession,'away');
 assert.equal(game.events.length,0);
});

test('team buttons resolve a jump ball and undo respects later manual possession changes',async()=>{
 const a=setup('basic',{offenseTeam:'home',possession:'home'});
 await a.ctx.wfToken('B');
 await a.ctx.wfSetTeam('away');
 assert.equal(a.db.row().events[0].team,'away');
 await a.ctx.togglePossession();
 await a.ctx.wfSetTeam('home');
 await a.ctx.undo();
 const game=a.db.row();
 assert.equal(game.offenseTeam,'home');
 assert.equal(game.possession,'away');
 assert.equal(game.events.length,0);
});

test('technical fouls track player or bench, preserve possession and support undo',async()=>{
 const a=setup('full');
 let game=await a.command('C V 24');
 assert.equal(game.events[0].foulType,'technical');
 assert.equal(a.ctx.playLabel(game.events[0]),'Technical foul · #24');
 assert.equal(game.fouls.away,1);
 assert.equal(game.offenseTeam,'home');
 assert.equal(game.scores.home,0);
 assert.equal(a.ctx.basketballBoxScore(game).totals.away['24'].tf,1);
 game=await a.command('C H N');
 assert.equal(game.fouls.home,1);
 assert.equal(game.events[0].player,undefined);
 await a.ctx.undo();
 assert.equal(a.db.row().fouls.home,0);
 const basic=setup('basic');
 game=await basic.command('C H');
 assert.equal(game.events[0].player,null);
 assert.equal(game.fouls.home,1);
});

test('custom college halves load each duration and use five-minute overtime by default',async()=>{
 const a=setup();
 a.node('basketballClockSettings').close=()=>{};
 a.node('basketballClockFormat').value='halves';
 a.node('basketballPeriodMinutes1').value='18';
 a.node('basketballPeriodMinutes2').value='20';
 a.node('basketballOvertimeMinutes').value='5';
 await a.ctx.saveBasketballClockSettings({preventDefault(){}});
 assert.equal(a.db.row().seconds,1080);
 assert.equal(a.ctx.basketballPeriodLabel(a.db.row()),'H1');
 await a.ctx.changePeriod({period:a.db.row().period,arrow:a.db.row().possession??null},a.db.row().possession??null);
 assert.equal(a.db.row().seconds,1200);
 assert.equal(a.ctx.basketballPeriodLabel(a.db.row()),'H2');
 assert.equal(a.ctx.basketballElapsedAt(a.db.row(),2,1190),1090);
 await a.ctx.changePeriod({period:a.db.row().period,arrow:a.db.row().possession??null},a.db.row().possession??null);
 assert.equal(a.db.row().seconds,300);
 assert.equal(a.ctx.basketballPeriodLabel(a.db.row()),'OT');
});

test('scorer notes remain editable after final and feedback prompts once the score is locked',async()=>{
 const a=setup();
 const dialog=a.node('basketballGameText');
 dialog.showModal=()=>{dialog.open=true;};
 dialog.close=()=>{dialog.open=false;};
 const submit={preventDefault(){}};
 a.ctx.openBasketballGameText('scorerNotes');
 a.node('basketballScorerNotes').value='Game-day note';
 await a.ctx.saveBasketballGameText(submit);
 assert.equal(a.db.row().scorerNotes,'Game-day note');

 await a.ctx.markBasketballFinal();
 assert.equal(a.db.row().libraryStatus,'completed');
 assert.equal(dialog.open,true);
 assert.equal(a.node('basketballGameTextTitle').textContent,'Postgame feedback');
 a.node('basketballFeedbackWell').value='Keyboard scoring';
 a.node('basketballFeedbackDifficult').value='Rebounds';
 a.node('basketballFeedbackChange').value='More practice examples';
 await a.ctx.saveBasketballGameText(submit);
 assert.equal(a.db.row().scorerFeedback.change,'More practice examples');
 assert.equal(await a.ctx.toggleClock(),false);

 a.ctx.openBasketballGameText('scorerNotes');
 assert.equal(a.node('basketballScorerNotes').value,'Game-day note');
 a.node('basketballScorerNotes').value='Postgame note';
 await a.ctx.saveBasketballGameText(submit);
 assert.equal(a.db.row().scorerNotes,'Postgame note');
 a.run('owner=false;render()');
 assert.equal(a.node('basketballScorerNotes').value,'');
});

test('opening tip records the winner, sets the arrow and starts a custom first-half clock exactly once',async()=>{
 const a=setup('full',{clockFormat:'halves',periodSeconds:[1080,1200],seconds:1080,possession:'away'});
 const dialog=a.node('basketballOpeningTipDialog');
 dialog.showModal=()=>{dialog.open=true;};
 dialog.close=()=>{dialog.open=false;};
 a.ctx.wfRender();
 assert.equal(a.node('basketballOpeningTip').hidden,false);
 a.ctx.openBasketballOpeningTip();
 assert.equal(dialog.open,true);
 assert.equal(a.node('basketballTipAway').textContent,'Away');
 await Promise.all([a.ctx.recordBasketballOpeningTip('away'),a.ctx.recordBasketballOpeningTip('home')]);
 const game=a.db.row();
 assert.equal(game.running,true);
 assert.equal(game.liveStarted,true);
 assert.equal(game.seconds,1080);
 assert.equal(game.offenseTeam,'away');
 assert.equal(game.possession,'home');
 assert.equal(game.events.length,1);
 assert.equal(game.events[0].time,'18:00');
 assert.equal(a.ctx.playLabel(game.events[0]),'Opening tip');
 assert.equal(dialog.open,false);
 assert.equal(a.node('basketballOpeningTip').hidden,true);
 await a.ctx.toggleClock();
 await a.ctx.recordBasketballOpeningTip('home');
 assert.equal(a.db.row().events.length,1);
});

test('pregame technicals allow an opening tip, and opening-tip controls are hidden for viewers',async()=>{
 const a=setup('basic');
 await a.command('C H');
 a.ctx.wfRender();
 assert.equal(a.node('basketballOpeningTip').hidden,false);
 a.run('owner=false;wfRender()');
 assert.equal(a.node('basketballOpeningTip').hidden,true);
 assert.equal(a.node('basketballPhoneOpeningTip').hidden,true);
});

test('Backspace restores one play step, including a shot result that already saved',async()=>{
 const a=setup();
 const field=a.node('wfCommand');
 const key=k=>a.press(k,{target:field});
 for(const k of 'Y11G')await key(k);
 assert.equal(a.db.row().scores.home,3);
 assert.equal(a.run('wfDraft.stage'),'assist');
 await key('Backspace');
 assert.equal(a.run('wfDraft.stage'),'result');
 assert.equal(a.db.row().scores.home,0);
 await key('M');
 assert.equal(a.db.row().events[0].kind,'miss');
 await key('D');
 await key('Backspace');
 assert.equal(a.run('wfDraft.stage'),'rebound');
 await key('O');
 assert.equal(a.run('wfDraft.team'),'home');
 await key('0');
 await key('Backspace');
 assert.equal(a.run('wfDigits'),'');
 for(const k of '04')await key(k);
 assert.equal(a.db.row().events[0].rebound.type,'offensive');
 await key('Backspace');
 assert.equal(a.db.row().events.length,1);
});

test('Backspace removes only the linked block when returning to the blocker step',async()=>{
 const a=setup();
 await a.command('J 11 M K 04');
 assert.equal(a.db.row().events[0].block.player,'04');
 await a.press('Backspace',{target:a.node('wfCommand')});
 assert.equal(a.run('wfDraft.stage'),'blockPlayer');
 assert.equal(a.db.row().events[0].block,undefined);
 assert.equal(a.db.row().events[0].kind,'miss');
});

test('Enter saves a linked or standalone defensive rebound for review and later assignment',async()=>{
 for(const linked of [true,false]){
  const a=setup();
  const field=a.node('wfCommand');
  const key=k=>a.press(k,{target:field});
  for(const k of linked?'J11MD':'RD')await key(k);
  await key('Enter');
  const game=a.db.row(), event=game.events[0];
  assert.equal(a.run('wfDraft'),null);
  assert.equal((event.rebound||event).player,null);
  assert.equal((event.rebound||event).team,'away');
  assert.equal(a.ctx.basketballBoxScore(game).teams.away.dreb,1);
  assert.equal(a.node('wfReviewQueue').textContent,'Review rebounds (1)');
  assert.match(a.ctx.eventHtml(event),/Assign rebounder/);
  await key('V');
  assert.equal(a.db.row().offenseTeam,'away');
  a.node('basketballReportDock').appendChild=()=>{};
  a.ctx.wfReviewNextRebound();
  for(const k of '04')await key(k);
  assert.equal(a.ctx.basketballBoxScore(a.db.row()).totals.away['04'].dreb,1);
  assert.equal(a.ctx.basketballBoxScore(a.db.row()).teams.away.dreb,1);
  assert.equal(a.node('wfReviewQueue').hidden,true);
 }
});

test('saved foul jersey chips edit the existing play and transfer the personal foul',async()=>{
 const a=setup();
 const trail=a.node('wfTrail'),input=a.node('wfChipNumber');
 trail.querySelector=()=>null;
 input.select=()=>{};
 await a.command('F H 11');
 const eid=a.db.row().events[0].id;
 assert.match(trail.innerHTML,/<button[^>]*aria-label="Edit #11"/);
 a.ctx.wfOpenJerseyChip(2);
 assert.match(trail.innerHTML,/id="wfChipNumber"[^>]*value="11"/);
 input.value='99';
 await a.ctx.wfSaveJerseyChip();
 assert.equal(a.db.row().events[0].player,'11');
 input.value='02';
 await a.ctx.wfJerseyEditKey({key:'Enter',preventDefault(){}});
 const game=a.db.row();
 assert.equal(game.events.length,1);
 assert.equal(game.events[0].id,eid);
 assert.equal(game.events[0].player,'02');
 assert.equal(game.fouls.home,1);
 assert.equal(a.ctx.basketballBoxScore(game).totals.home['02'].pf,1);
 assert.match(trail.innerHTML,/aria-label="Edit #02"/);
});

test('shot and linked rebound jersey chips edit their own teams without changing totals',async()=>{
 const a=setup();
 const trail=a.node('wfTrail'),input=a.node('wfChipNumber');
 trail.querySelector=()=>null;
 input.select=()=>{};
 await a.command('J 11 M D 04');
 a.ctx.wfOpenJerseyChip(2);
 input.value='02';
 await a.ctx.wfSaveJerseyChip();
 let game=a.db.row();
 assert.equal(game.events[0].scorer,'02');
 assert.equal(game.events[0].player,'02');
 assert.equal(game.events[0].rebound.player,'04');
 a.ctx.wfOpenJerseyChip(5);
 input.value='24';
 await a.ctx.wfSaveJerseyChip();
 game=a.db.row();
 assert.equal(game.events[0].rebound.player,'24');
 assert.equal(a.ctx.basketballBoxScore(game).teams.away.dreb,1);

 await a.command('J 11 G 02');
 a.ctx.wfOpenJerseyChip(2);
 input.value='02';
 await a.ctx.wfSaveJerseyChip();
 assert.equal(a.db.row().events[0].scorer,'11');
 a.ctx.wfJerseyEditKey({key:'Escape',preventDefault(){}});
 a.ctx.wfOpenJerseyChip(4);
 input.value='04';
 await a.ctx.wfSaveJerseyChip();
 game=a.db.row();
 assert.equal(game.events[0].assist,'04');
 assert.equal(game.scores.home,2);
});

test('the scoring lineup separates the five on the floor and bench after confirmed substitutions',()=>{
 const roster=Array.from({length:7},(_,i)=>({number:String(i+1),name:'Player '+(i+1)}));
 const a=setup('full',{rosters:{home:roster,away:roster},startingLineups:{home:['1','2','3','4','5']},
  screenSidesSwapped:true,events:[{kind:'substitution',team:'home',out:'2',in:'6'}]});
 const game=a.db.row(),groups=a.ctx.wfLineupGroups(game,'home');
 assert.equal(Array.from(groups.active,p=>p.number).join(','),'1,3,4,5,6');
 assert.equal(Array.from(groups.bench,p=>p.number).join(','),'2,7');
 assert.equal(a.ctx.wfLineupGroups(game,'away').active,null);
 a.ctx.wfRenderLineups();
 const html=a.node('wfLineups').innerHTML;
 assert.ok(html.indexOf('<h3>Home')<html.indexOf('<h3>Away'));
 assert.match(html,/<h4>On the floor<\/h4>[\s\S]+<h4>Bench<\/h4>/);
 assert.match(html,/<h3>Away<\/h3><p>No starting five recorded<\/p><h4>Roster<\/h4>/);
});

test('clock corrections stamp the next play at the new time and preserve saved timestamps',async()=>{
 const a=setup('basic',{seconds:236});
 await a.command('J');
 const saved=a.db.row().events[0];
 assert.equal(saved.time,'3:56');

 a.ctx.openBasketballClockEditor();
 assert.equal(a.node('basketballClockMinutes').value,'3');
 assert.equal(a.node('basketballClockSeconds').value,'56');
 for(let i=0;i<4;i++)a.ctx.stepBasketballClockEdit(1);
 assert.equal(a.node('basketballClockMinutes').value,'4');
 assert.equal(a.node('basketballClockSeconds').value,'00');
 await Promise.all([a.ctx.saveBasketballClockEdit({preventDefault(){}}),a.command('Y')]);
 const game=a.db.row();
 assert.equal(game.seconds,240);
 assert.equal(game.running,false);
 assert.equal(game.events[0].time,'4:00');
 assert.equal(game.events[0].seconds,240);
 assert.equal(game.events[1].id,saved.id);
 assert.equal(game.events[1].time,'3:56');
 assert.equal(a.node('basketballClockEditor').hidden,true);
});

test('clock editor keeps invalid times out and discards cancelled changes',async()=>{
 const a=setup('basic',{seconds:59});
 a.ctx.openBasketballClockEditor();
 a.ctx.stepBasketballClockEdit(1);
 assert.equal(a.node('basketballClockMinutes').value,'1');
 assert.equal(a.node('basketballClockSeconds').value,'00');
 a.node('basketballClockSeconds').value='60';
 await a.ctx.saveBasketballClockEdit({preventDefault(){}});
 assert.equal(a.db.row().seconds,59);
 assert.match(a.node('basketballClockEditStatus').textContent,/0–59/);
 a.ctx.cancelBasketballClockEdit();
 assert.equal(a.node('basketballClockEditor').hidden,true);
 assert.equal(a.db.row().seconds,59);
});

test('scoring mini flow shows the five newest saved plays with their linked details',async()=>{
 const a=setup();
 await a.command('J 11 G 02');
 await a.command('F H 04');
 await a.command('O V');
 await a.command('B H');
 await a.command('F H 11');
 await a.command('J 11 M D 04');
 const mini=a.node('wfMiniPlays');
 assert.equal((mini.innerHTML.match(/<li>/g)||[]).length,5);
 assert.match(mini.innerHTML,/MISS.*DREB · Away · #04/);
 assert.match(mini.innerHTML,/Jump ball/);
 assert.doesNotMatch(mini.innerHTML,/Assist #02/);
 await a.ctx.undo();
 assert.match(mini.innerHTML,/MAKE.*Assist #02/);
 assert.doesNotMatch(mini.innerHTML,/DREB/);
});

test('Next period can switch the arrow or keep it without changing the team in possession',async()=>{
 const a=setup('full',{possession:'home',possessionEvent:'tip',offenseTeam:'home',clockFormat:'halves',periodSeconds:[1080,1200],overtimeSeconds:300,seconds:0});
 const dialog=a.node('basketballNextPeriod');
 dialog.showModal=()=>{dialog.open=true;};
 dialog.close=()=>{dialog.open=false;};
 a.ctx.openBasketballNextPeriod();
 assert.equal(a.node('basketballPeriodSwitchArrow').textContent,'Switch to Away');
 assert.equal(a.db.row().period,1);
 await a.ctx.saveBasketballNextPeriod('switch');
 let game=a.db.row();
 assert.equal(game.period,2);
 assert.equal(game.seconds,1200);
 assert.equal(game.possession,'away');
 assert.equal(game.offenseTeam,'home');
 assert.equal(game.possessionEvent,null);

 a.ctx.openBasketballNextPeriod();
 await a.ctx.saveBasketballNextPeriod('keep');
 game=a.db.row();
 assert.equal(game.period,3);
 assert.equal(game.seconds,300);
 assert.equal(game.possession,'away');
});
