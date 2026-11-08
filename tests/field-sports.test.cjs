const {test}=require('node:test');
const assert=require('node:assert/strict');
const E=require('../field-sports/engine.js');

const create=(sport,events)=>({sport,minutes:12,teams:{away:'Visitor',home:'Home'},events});
test('football keeps score, possession, clock and entered stats aligned across periods',()=>{
 const play=(team,label,player,yards)=>({type:'play',team,label,player,yards,at:10000});
 const events=[
  {type:'clock',running:true,at:1000},
  {type:'situation',possession:'home',down:2,distance:7,spot:'VIS 38'},
  play('home','Pass complete','QB',22),play('home','Reception','WR',22),
  play('home','Rush','RB',-2),play('home','Touchdown','WR'),play('home','Extra point','K'),
  {type:'period'},play('away','Field goal','K'),{type:'final',at:20000}
 ];
 const game=create('football',events), state=E.replay(game), tables=E.tables(game,state);
 assert.deepEqual(state.scores,{away:3,home:7});
 assert.deepEqual(state.line,{away:[,3],home:[7]});
 assert.equal(state.plays[0].time,'11:51');
 assert.equal(state.down,2);
 assert.equal(state.possession,'home');
 assert.equal(tables.comparison.rows.find(row=>row[0]==='Passing yards')[2],22);
 assert.equal(tables.comparison.rows.find(row=>row[0]==='Rushing yards')[2],-2);
 assert.ok(state.final);
 assert.equal(E.replay(create('football',events.slice(0,-2))).scores.away,0);
});

for(const sport of ['baseball','softball'])test(sport+' tracks runs, pitching and inning changes without counting errors as hits',()=>{
 const events=[], game=create(sport,events);
 function enter(label,player,pitcher,changes={}){
  events.push({type:'result',label,player,pitcher,...E.suggest(E.replay(game),label),...changes});
 }
 enter('Single','A','P');
 enter('Reached on error','B','P');
 enter('Walk','C','P');
 enter('Walk','D','P');
 enter('Home run','E','P');
 enter('Strikeout','A','P');
 enter('Other out','B','P',{outs:2});
 enter('Double','F','Q');
 const s=E.replay(game), tables=E.tables(game,s);
 assert.deepEqual(s.scores,{away:5,home:0});
 assert.deepEqual(s.hits,{away:2,home:1});
 assert.deepEqual(s.errors,{away:0,home:1});
 assert.equal(s.half,'bottom');
 assert.equal(s.outs,0);
 assert.deepEqual(s.bases,[false,true,false]);
 assert.deepEqual(tables.pitching.rows.home,[['P','1.0',2,5,2,1]]);
 assert.ok(tables.players.rows.away.some(row=>row[0]==='E'&&row[3]===4));
 assert.equal(E.replay(create(sport,events.slice(0,-2))).outs,1);
});
