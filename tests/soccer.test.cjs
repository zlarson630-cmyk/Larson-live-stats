const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function app(){
 const nodes=new Map(),storage=new Map();
 function node(id){if(!nodes.has(id)){const classes=new Set();nodes.set(id,{value:'',textContent:'',children:[],style:{setProperty(){}},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle(c,on){on?classes.add(c):classes.delete(c)}},setAttribute(k,v){this[k]=v},append(...a){this.children.push(...a)},set innerHTML(v){this.children=[];this.html=v},get innerHTML(){return this.html||''},scrollIntoView(){}})}return nodes.get(id)}
 const ctx=vm.createContext({console,Date,Math,Promise,JSON,document:{getElementById:node,createElement:()=>node(Symbol()),querySelectorAll:()=>[]},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},setInterval:()=>1,clearInterval(){},confirm:()=>true,alert(){},prompt:()=>null,Live:{client:null}});ctx.window=ctx;
 vm.runInContext(fs.readFileSync('soccer-clock.js','utf8'),ctx);ctx.SoccerClock=ctx.window.SoccerClock;
 vm.runInContext(fs.readFileSync('soccer.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
 node('home').value='Home';node('away').value='Visitor';node('hc').value='#ffffff';node('ac').value='#245eaa';node('hr').value='9, Jordan\n7, Casey';node('ar').value='1, Alex';
 const run=s=>vm.runInContext(s,ctx);run('newMatch()');return {run,node,ctx,storage};
}
test('two columns route every event to the correct team and roster',()=>{
 const a=app(),cols=a.node('eventButtons').children;assert.equal(cols.length,2);for(const c of cols)assert.equal(c.children.filter(x=>x['aria-label']).length,10);
 cols[1].children[2].onclick();assert.equal(a.run('team'),'away');assert.equal(a.node('entryTitle').textContent,'Goal · Visitor');assert.equal(a.node('players').children[0].textContent,'1, Alex');
 a.node('player').value='1, Alex';a.node('eventTime').value='04:21';a.run('saveEvent()');assert.equal(a.run('s.events[0].team'),'away');assert.equal(a.node('awayScore').textContent,1);
 a.run("choose('Goal','home')");a.node('player').value='9, Jordan';a.node('assist').value='7, Casey';a.node('eventTime').value='12:34';a.run('saveEvent()');assert.equal(a.node('homeScore').textContent,1);assert.match(a.node('stats').innerHTML,/Shots on goal/);
});
test('edit, delete, undo and persistence retain player, team and half',()=>{
 const a=app();a.run("choose('Goal','away')");a.node('eventTime').value='01:20';a.node('player').value='1, Alex';a.run('saveEvent();nextPeriod();editEvent(s.events[0].id)');a.node('eventTime').value='02:30';a.run('saveEvent()');assert.equal(a.run('s.events[0].period'),1);assert.equal(a.run('s.events[0].time'),150);assert.equal(a.run('s.events[0].team'),'away');
 a.run("choose('Foul','home')");a.node('eventTime').value='03:00';a.run('saveEvent();undo()');assert.equal(a.run('s.events.length'),1);a.run('deleteEvent(s.events[0].id)');assert.equal(a.run('s.events.length'),0);a.run('resume()');assert.equal(a.run('s.period'),2);
});
test('clock, final-state correction and read-only guards remain intact',()=>{
 const a=app();a.run('toggleClock()');assert.equal(a.run('s.running'),true);a.run('toggleClock()');assert.equal(a.run('s.running'),false);a.run("choose('Save','home')");a.node('eventTime').value='00:10';a.run('saveEvent();endMatch()');assert.equal(a.run('s.finished'),true);assert.equal(a.node('eventButtons').children[0].children[2].disabled,true);
 a.run("choose('Goal','away')");assert.equal(a.run('kind'),null);a.run('editEvent(s.events[0].id)');a.node('player').value='9, Jordan';a.run('saveEvent()');assert.equal(a.run('s.events[0].player'),'9, Jordan');
 a.run("cloudId='ABC123';cloudOwner=false;cancelEntry();choose('Goal','home');undo();deleteEvent(s.events[0].id)");assert.equal(a.run('s.events.length'),1);assert.equal(a.run('kind'),null);
});
test('PDF contains brand, score, players, goals and paginated flow with repeated headers',async()=>{
 const pages=[[]];let current=pages[0];
 class Doc{setFont(){}setFontSize(){}setTextColor(){}setFillColor(){}setProperties(){}rect(){}addPage(){pages.push(current=[])}setPage(i){current=pages[i-1]}getNumberOfPages(){return pages.length}splitTextToSize(v,w){return String(v).match(new RegExp('.{1,'+Math.max(1,Math.floor(w/6))+'}','g'))||['']}text(v,x,y){assert.ok(y>=0&&y<=792,'Text stays on page');current.push(String(v))}}
 const ctx=vm.createContext({window:{jspdf:{jsPDF:Doc}},fetch:async()=>{throw Error('offline')},Date,console});vm.runInContext(fs.readFileSync('soccer-clock.js','utf8'),ctx);ctx.SoccerClock=ctx.window.SoccerClock;vm.runInContext(fs.readFileSync('soccer-report.js','utf8'),ctx);
 const events=Array.from({length:80},(_,i)=>({team:i%2?'home':'away',kind:i===0?'Goal':'Foul',period:i<40?1:2,time:i*20,player:'Player '+i,assist:i===0?'Helper':''}));
 await ctx.window.SoccerReport.build({home:'Home',away:'Away',colors:{home:'#ffffff',away:'#ffcc00'},period:2,seconds:0,clockMode:'down',halfSeconds:2400,finished:true,events:events.map(e=>({...e,clockMode:'down',halfSeconds:2400,time:2400-e.time})),rosters:{home:['Unused roster player'],away:[]}});
 assert.ok(pages.length>2);for(const page of pages){assert.ok(page.includes('LARSON LIVE STATS'));assert.ok(page.includes('LARSON LIVE STATS  /  SOCCER'))}
 const text=pages.flat().join('\n');assert.ok(text.indexOf('Foul / Player 1')<text.indexOf('Foul / Player 79'));assert.ok(text.replace(/\s/g,'').includes('39:40left'));
 for(const label of ['TEAM COMPARISON','SCORING SUMMARY','GAME FLOW','Unused roster player','Assist: Helper','Player 79'])assert.ok(text.includes(label),label);
});
test('countdown defaults to configured half, pauses, resumes and automatically stops once at zero',()=>{
 const a=app();let now=100000;a.ctx.Date=class extends Date{static now(){return now}};
 a.node('setupClockMode').value='down';a.node('setupHalfMinutes').value='40';a.run('newMatch()');assert.equal(a.run('seconds()'),2400);
 a.run('toggleClock()');now+=5000;assert.equal(a.run('seconds()'),2395);a.run('toggleClock()');now+=10000;assert.equal(a.run('seconds()'),2395);
 a.run('toggleClock()');now+=2400000;a.run('tickClock()');assert.equal(a.run('seconds()'),0);assert.equal(a.run('s.running'),false);assert.equal(a.run('s.startedAt'),null);assert.equal(a.node('clock').textContent,'00:00');a.run('toggleClock()');assert.equal(a.run('s.running'),false);
 a.run('nextPeriod()');assert.equal(a.run('s.seconds'),2400);assert.equal(a.run('s.period'),2);assert.equal(a.run('s.running'),false);
});
test('mode conversion retains elapsed time and event clock context; legacy games stay count-up',()=>{
 const a=app();a.run("s.seconds=300;choose('Goal','home')");a.node('eventTime').value='04:00';a.run('saveEvent()');a.node('matchClockMode').value='down';a.node('matchHalfMinutes').value='30';a.run('applyClockSettings()');assert.equal(a.run('s.seconds'),1500);assert.equal(a.run('s.events[0].clockMode'),'up');assert.equal(a.run('s.events[0].time'),240);
 a.run("choose('Goal','away')");a.node('eventTime').value='20:00';a.run('saveEvent()');assert.equal(a.run('s.events[1].elapsedTime'),600);a.run('editEvent(s.events[1].id)');a.node('eventTime').value='21:00';a.run('saveEvent()');assert.equal(a.run('s.events[1].elapsedTime'),540);
 assert.equal(a.run('SoccerClock.order(s.events,s)[0].team'),'home');a.run('resume()');assert.equal(a.run('s.clockMode'),'down');assert.equal(a.run('s.halfSeconds'),1800);
 a.run('delete s.clockMode;delete s.halfSeconds;s.seconds=10;s.running=true;s.startedAt=Date.now()-3000');assert.equal(a.run('seconds()'),13);
});
test('invalid settings and read-only viewers cannot change the clock or persist expiry',()=>{
 const a=app();a.node('setupHalfMinutes').value='0';assert.equal(a.run('newMatch()'),false);a.node('matchHalfMinutes').value='181';a.node('matchClockMode').value='down';a.run('applyClockSettings()');assert.equal(a.run('SoccerClock.mode(s)'),'up');
 a.run("cloudId='ABC123';cloudOwner=false;s.clockMode='down';s.seconds=1;s.running=true;s.startedAt=Date.now()-5000;tickClock();applyClockSettings();toggleClock();nextPeriod()");assert.equal(a.run('s.seconds'),1);assert.equal(a.run('s.running'),true);assert.equal(a.run('seconds()'),0);assert.equal(a.run('s.period'),1);
});
test('broadcaster and public OBS use the same countdown math and clamp expired clocks',async()=>{
 for(const file of ['soccer-broadcast.html','soccer-overlay.html']){
  const nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:'',style:{setProperty(){}}});return nodes.get(id)};
  const state={home:'H',away:'A',scores:{home:0,away:0},colors:{},events:[],rosters:{},period:1,seconds:60,clockMode:'down',running:true,startedAt:100000};
  const ctx=vm.createContext({window:{},Date:class extends Date{static now(){return 105000}},URLSearchParams,location:{search:file.includes('overlay')?'?game=ABC123':'?local=1'},document:{getElementById:node},localStorage:{getItem:()=>JSON.stringify(state)},setInterval:()=>1,Live:{watch(id,cb){cb({home:'H',away:'A',clock_mode:'down'})},publicState:()=>state}});
  vm.runInContext(fs.readFileSync('soccer-clock.js','utf8'),ctx);ctx.SoccerClock=ctx.window.SoccerClock;
  vm.runInContext(fs.readFileSync(file,'utf8').match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
  vm.runInContext(file.includes('broadcast')?'tick()':'draw()',ctx);assert.match(node('clock').textContent,/00:55$/);
  ctx.Date=class extends Date{static now(){return 200000}};vm.runInContext(file.includes('broadcast')?'tick()':'draw()',ctx);assert.match(node('clock').textContent,/00:00$/);
 }
});
