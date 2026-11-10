const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function showcase(){
 const script=fs.readFileSync('basketball.html','utf8');
 const context=vm.createContext({window:{},SoccerBrand:{name:(game,t)=>game[t]},remaining:game=>game.seconds});
 const run=code=>vm.runInContext(code,context);
 run(script.slice(script.indexOf('function playLabel('),script.indexOf('let pickerEvent')));
 run(script.slice(script.indexOf('function basketballOnCourt('),script.indexOf('let subTeam=')));
 run(script.slice(script.indexOf('function basketballBoxScore('),script.indexOf('function broadcastDashboard(')));
 for(const file of ['basketball-demo.js','basketball-graphics.js','basketball-report.js'])run(fs.readFileSync(file,'utf8'));
 return {context,run};
}

test('the demo reconciles its score, fouls, substitutions, shots and OBS callouts',()=>{
 const {context,run}=showcase();
 const game=context.createBasketballDemo();
 assert.equal(game.period,3);
 assert.equal(game.seconds,252);
 assert.equal(game.events[0].kind,'timeout');
 for(const t of ['home','away']){
  const plays=game.events.filter(e=>e.team===t);
  assert.equal(game.scores[t],plays.reduce((sum,e)=>sum+(e.kind==='score'?e.points:0),0));
  assert.equal(game.fouls[t],plays.filter(e=>e.kind==='foul').length);
  assert.equal(game.timeouts[t],5-plays.filter(e=>e.kind==='timeout').length);
  assert.ok(plays.filter(e=>[2,3].includes(e.points)).every(context.basketballShotLocation));
  assert.equal(run('basketballOnCourt(createBasketballDemo(),'+JSON.stringify(t)+').size'),5);
 }
 const {run:streak,leader}=context.basketballGraphicChoices(game);
 assert.equal(streak.headline,'7–0 scoring run');
 assert.match(streak.detail,/Last 2:01/);
 assert.match(leader.headline,/Jordan Robinson.*13 PTS/);
 assert.equal(context.basketballGraphicChoices({...game,events:[]}).run,undefined);
});

test('PDF presets honor the selected sections and keep large compact rosters on one page',()=>{
 const {context}=showcase();
 let labels=[];
 context.window.jspdf={jsPDF:class{
  constructor({orientation}){
   this.pages=1;
   this.internal={pageSize:{getWidth:()=>orientation==='landscape'?792:612,getHeight:()=>orientation==='landscape'?612:792}};
  }
  getNumberOfPages(){return this.pages;}
  addPage(){this.pages++;}
  getTextWidth(value){return value.length*4;}
  text(value){labels.push(value);return this;}
 }};
 for(const method of ['setFont','setFontSize','setTextColor','setFillColor','rect','setPage','setDrawColor','setLineWidth','line','circle']){
  context.window.jspdf.jsPDF.prototype[method]=function(){return this;};
 }
 const game=context.createBasketballDemo();
 game.rosters.home=Array.from({length:50},(_,i)=>({number:String(i+1),name:'Home Player '+(i+1)}));
 assert.equal(context.basketballBoxScorePdf(game,'4:12','one').getNumberOfPages(),1);
 assert.ok(labels.includes('#50 Home Player 50'));
 assert.ok(!labels.includes('Play-by-play'));
 labels=[];
 context.basketballBoxScorePdf(game,'4:12','selected',['charts']);
 assert.ok(labels.includes('Shot charts'));
 assert.ok(!labels.includes('Score by period'));
 labels=[];
 context.basketballBoxScorePdf(game,'4:12','full');
 for(const section of ['Score by period','Team comparison','Shot charts','Substitution log','Play-by-play'])assert.ok(labels.includes(section));
});
