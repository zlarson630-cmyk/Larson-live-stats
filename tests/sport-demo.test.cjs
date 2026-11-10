const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const field=require('../field-sports/engine.js');
const volleyball=require('../volleyball/engine.cjs');

const ctx=vm.createContext({window:null,crypto:{randomUUID:()=> 'revision'}});
ctx.window=ctx;
for(const file of ['sport-demo.js','soccer-brand.js','soccer-clock.js','soccer-report.js','field-sports/report.js','volleyball/report.js']){
 if(file.startsWith('field-sports'))ctx.FieldSports=field;
 vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
}

test('soccer practice match starts in the second half with linked saves and a 2–1 PDF score',()=>{
 const game=ctx.SportDemo.soccer(), model=ctx.SoccerReport.compactModel(game);
 assert.equal(game.seconds,1420);
 assert.equal(game.period,2);
 assert.deepEqual(Array.from(model.teams,t=>t.score),[1,2]);
 for(const shot of game.events.filter(e=>e.saveId))assert.equal(game.events.find(e=>e.id===shot.saveId).shotId,shot.id);
 game.events.length=0;
 assert.ok(ctx.SportDemo.soccer().events.length);
});

test('volleyball practice match opens 1–1 in sets and 14–12 in set three',()=>{
 const game=ctx.SportDemo.volleyball();
 const state=volleyball.replay(game.events,{rules:{bestOf:game.bestOf},firstServer:game.firstServer});
 assert.deepEqual(state.setsWon,{home:1,away:1});
 assert.deepEqual(state.points,{home:14,away:12});
 assert.equal(state.timeouts.away,1);
 assert.equal(ctx.VolleyballReport.model(game,state,true).groups.at(-1)[0].rows.length,game.events.length);
});

test('field practice games replay with active clocks or innings and populated PDF stat tables',()=>{
 for(const sport of ['football','baseball','softball']){
  const game=ctx.SportDemo.field(sport,field),state=field.replay(game);
  const report=ctx.FieldReport.compactModel(game);
  assert.equal(state.final,false);
  assert.deepEqual(Array.from(report.teams,t=>t.score),[state.scores.away,state.scores.home]);
  assert.ok(field.tables(game,state).players.rows.home.length);
  if(sport==='football'){
   assert.equal(state.period,3);
   assert.equal(state.seconds,462);
   assert.equal(state.startedAt,null);
   assert.deepEqual(state.scores,{away:10,home:14});
  }else{
   assert.equal(state.period,4);
   assert.equal(state.half,sport==='baseball'?'top':'bottom');
   assert.equal(state.balls,1);
   assert.ok(field.tables(game,state).pitching.rows.home.length);
  }
 }
});
