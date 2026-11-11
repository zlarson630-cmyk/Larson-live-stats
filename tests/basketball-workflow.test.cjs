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
  node.style.setProperty=()=>{};
  return node;
 };
 a.ctx.crypto=crypto;a.ctx.matchMedia=()=>({matches:true});
 const game={...structuredClone(initial),scoringMode:mode,offenseTeam:'home',reboundPrompts:true,
  rosters:{home:[{number:'11',name:'Shooter'},{number:'02',name:'Passer'},{number:'04',name:'Home rebounder'}],away:[{number:'24',name:'Visitor shooter'},{number:'04',name:'Visitor rebounder'}]},...options};
 const db=cloud(a,{game});
 a.run(fs.readFileSync('basketball-workflow.js','utf8'));
 return {...a,db,async command(text){a.node('wfCommand').value=text;await a.ctx.wfSubmit({preventDefault(){}});return db.row();}};
}

test('one-person book entry credits points and personal/team fouls while keeping the arrow separate',async()=>{
 const a=setup('basic',{possession:'away'});
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
 assert.equal(a.run('wfDraft.player'),'11');
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
  const game=await a.command(mode==='basic'?'V Y 24':mode==='streamlined'?'V Y 24 G':'V Y 24 G N');
  assert.equal(game.offenseTeam,'away');
  assert.equal(game.scores.away,3);
  await a.command('H');
  assert.equal(a.db.row().offenseTeam,'home');
 }
});
