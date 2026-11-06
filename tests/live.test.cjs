const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function app(){
 const nodes=new Map(), storage=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',checked:false,textContent:'',innerHTML:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},querySelector(){return node('panel')},scrollIntoView(){}});return nodes.get(id);};
 const ctx=vm.createContext({console,structuredClone,URLSearchParams,Date,Math,Promise,
 document:{getElementById:node,querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 location:{pathname:'/',search:''},history:{replaceState(){}},
 setInterval:()=>1,clearInterval(){},alert(){},confirm:()=>true,prompt:()=>null,
 BroadcastChannel:class{postMessage(){}close(){}},Live:{client:null,watch(){return ()=>{}}}});
 ctx.window=ctx;ctx.addEventListener=()=>{};
 vm.runInContext(fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
 vm.runInContext(fs.readFileSync('cloud.js','utf8'),ctx);
 return {ctx,node,run:s=>vm.runInContext(s,ctx)};
}
const initial={id:'ABC123',home:'Home',away:'Away',scores:{home:0,away:0},colors:{home:'#ffffff',away:'#c62828'},fouls:{home:0,away:0},timeouts:{home:5,away:5},period:1,seconds:480,running:false,startedAt:null,events:[],version:1};
function cloud(a,{conflicts=0,fail=false}={}){
 let row=structuredClone(initial), calls=0;
 a.ctx.Live.read=async()=>({state:structuredClone(row)});
 a.ctx.Live.client={from:()=>({update:({state})=>{calls++;const q={eq:(key,value)=>{if(key==='state')assert.equal(typeof value,'string');return q;},select:async()=>{if(fail)return {error:Error('offline')};if(conflicts-->0){row.scores.home++;return {data:[]};}row=state;return {data:[{state:row}]};}};return q;}})};
 a.run("cloudMode=true;owner=true;id='ABC123'");a.ctx.seed=initial;a.run('state=structuredClone(seed)');
 return {row:()=>row,calls:()=>calls};
}
test('local game retains scores, assignment, foul, undo, clock and local overlay URL',async()=>{
 const a=app();a.node('localMode').checked=true;await a.run('createGame()');
 await a.run("score('home',2)");await a.run("pickerValue('11')");await a.run("pickerValue('no-assist')");
 assert.equal(a.run('state.scores.home'),2);assert.equal(a.run('state.events[0].scorer'),'11');
 a.run("foul('away');undo();toggleClock()");assert.equal(a.run('state.fouls.away'),0);assert.equal(a.run('state.running'),true);
 assert.match(a.node('overlay').href,/local=1/);
});
test('cloud saves serialize and retry a conflicting update without losing points',async()=>{
 const a=app(), db=cloud(a,{conflicts:1});
 await a.run("Promise.all([write(s=>s.scores.home+=2),write(s=>s.scores.away+=3)])");
 assert.equal(db.row().scores.home,3);assert.equal(db.row().scores.away,3);assert.equal(db.calls(),3);assert.equal(a.run('pendingWrites'),0);
});
test('public viewers cannot submit writes',async()=>{
 const a=app(),db=cloud(a);a.run('owner=false');assert.equal(await a.run('write(s=>s.scores.home++)'),false);assert.equal(db.calls(),0);
});
test('failed cloud save keeps confirmed state and reports unsaved action',async()=>{
 const a=app();cloud(a,{fail:true});assert.equal(await a.run('write(s=>s.scores.home+=3)'),false);assert.equal(a.run('state.scores.home'),0);assert.match(a.node('sync').textContent,/Not saved/);
});
test('public subscription catches up on reconnect, polls and cleans up',async()=>{
 let cb,refresh,removed=0,reads=0,last,status;
 const client={from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:{id:'ABC123',home_score:++reads}})}),channel:()=>({on(event,filter,fn){assert.equal(filter.table,'live_scoreboards');return this},subscribe(fn){cb=fn;return this}}),removeChannel(){removed++}};
 const ctx=vm.createContext({window:{supabase:{createClient:()=>client},addEventListener(){},removeEventListener(){}},document:{addEventListener(){},removeEventListener(){}},setInterval:fn=>(refresh=fn,1),clearInterval(){}});
 vm.runInContext(fs.readFileSync('live.js','utf8'),ctx);
 const stop=ctx.window.Live.watch('ABC123',x=>last=x,x=>status=x);
 await new Promise(setImmediate);assert.equal(last.home_score,1);
 cb('CHANNEL_ERROR');assert.match(status,/Reconnecting/);cb('SUBSCRIBED');await new Promise(setImmediate);assert.equal(last.home_score,2);
 await refresh();assert.equal(last.home_score,3);stop();await refresh();assert.equal(reads,3);assert.equal(removed,1);
});
