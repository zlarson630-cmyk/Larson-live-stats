const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const script=fs.readFileSync('profile.js','utf8');
function harness({user=null,rows=[],storageEntries=[],deferred=null}={}){
 const nodes=new Map(),storage=new Map(storageEntries),listeners={};
 const node=id=>{if(!nodes.has(id)){const e={value:'',hidden:false,dataset:{},style:{},children:[],text:'',set textContent(v){this.text=v;this.children=[]},get textContent(){return this.text},append(...v){this.children.push(...v)},setAttribute(){},addEventListener(k,v){this[k]=v}};nodes.set(id,e)}return nodes.get(id)};
 let current=user;const queryCalls=[];
 const client={auth:{getSession:async()=>({data:{session:current?{user:current}:null}}),onAuthStateChange(fn){listeners.auth=fn},signOut:async()=>{current=null;listeners.auth('SIGNED_OUT',null);return {}}},from(table){const q={select(){return q},eq(k,v){queryCalls.push([table,k,v]);return q},order(){return q},async range(start,end){return deferred?await deferred:{data:rows.slice(start,end+1)}}};return q}};
 const ctx=vm.createContext({window:{},document:{body:{hasAttribute:()=>true},createElement:()=>node(Symbol()),getElementById:node,querySelector:()=>node('header')},localStorage:{get length(){return storage.size},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)||null},setTimeout,URLSearchParams,encodeURIComponent,console});ctx.window=ctx;ctx.addEventListener=()=>{};ctx.Live={client};node('profileSport').value='all';vm.runInContext(script,ctx);
 return {ctx,node,storage,queryCalls,async flush(){await new Promise(r=>setTimeout(r,15))},signOut:()=>node('profileSignOut').onclick()};
}
test('signed-out profile does not list old browser-only games as account history',async()=>{const h=harness({storageEntries:[['lls-game-OLD123',JSON.stringify({home:'Old',away:'Game'})]]});await h.flush();assert.equal(h.node('gamesCount').textContent,0);assert.match(h.node('profileIdentity').textContent,/Signed out/);});
test('account games use owner-filtered paginated reads, correct sport links and account status',async()=>{const h=harness({user:{id:'A',email:'z@example.com'},rows:[{id:'ABC123',state:{sport:'soccer',home:'Home',away:'Away',scores:{home:1,away:0}},updated_at:'2026-11-06T12:00:00Z'}]});await h.flush();assert.deepEqual(h.queryCalls,[['live_games','owner_id','A']]);assert.equal(h.node('gamesCount').textContent,1);assert.match(h.node('profileIdentity').textContent,/Signed in as z@example.com/);assert.equal(h.ctx.ProfileData.href({id:'ABC123',sport:'soccer',source:'account'}),'soccer.html?game=ABC123');assert.equal(h.node('profileLogin').hidden,true);});
test('signing out hides private games and an in-flight read cannot restore them',async()=>{let release;const pending=new Promise(r=>release=r);const h=harness({user:{id:'A',email:'a@example.com'},deferred:pending});await h.flush();await h.signOut();release({data:[{id:'SECRET',state:{home:'Private',away:'Hidden'}}]});await h.flush();assert.equal(h.node('gamesCount').textContent,0);assert.match(h.node('profileIdentity').textContent,/Signed out/);});
test('search filters cloud game history',async()=>{const h=harness({user:{id:'A'},rows:[{id:'ABC123',state:{home:'Safe',away:'Team'}}]});await h.flush();assert.equal(h.node('gamesCount').textContent,1);h.node('profileSearch').value='missing';h.node('profileSearch').input();assert.equal(h.node('profileGames').children[0].textContent,'No matching games.');});

test('history labels final and unpublished games correctly and filters volleyball',async()=>{
 const state={home:'Home',away:'Away',scores:{home:2,away:0}};
 const h=harness({user:{id:'A'},rows:[
  {id:'BASKET',state:{...state,libraryStatus:'completed'}},
  {id:'VOLLEY',state:{...state,sport:'volleyball',finished:true}},
  {id:'VTRASH',state:{...state,sport:'volleyball',libraryStatus:'trash'}}
 ]});
 await h.flush();
 const cards=h.node('profileGames').children;
 assert.ok(cards.find(card=>card.children.some(child=>child.textContent==='Game BASKET')).children.some(child=>child.textContent==='0 – 2 · Final'));
 h.node('profileSport').value='volleyball';
 h.node('profileSport').change();
 const volleyball=h.node('profileGames').children;
 assert.equal(volleyball.length,2);
 assert.ok(volleyball.every(card=>card.children.some(child=>child.textContent==='Volleyball')));
 const unpublished=volleyball.find(card=>card.children.some(child=>child.textContent.includes('Unpublished')));
 assert.ok(unpublished);
 assert.ok(!unpublished.children.some(child=>child.href));
});

test('trash and restore preserve final status, stop a running clock, and retry a concurrent score',async()=>{
 const {ctx}=harness();
 let state={home:'Home',away:'Away',scores:{home:1,away:0},seconds:120,running:true,startedAt:Date.now()-2000,version:1};
 let conflicts=1,writes=0;
 const client={from(){
  let pending;
  const q={eq(){return q},is(){return q},update({state}){pending=state;return q;},
   maybeSingle:async()=>({data:{state}}),
   select(){
    if(!pending)return q;
    writes++;
    if(conflicts-- >0){
     state={...state,scores:{home:3,away:0},version:2};
     return Promise.resolve({data:[]});
    }
    state=pending;
    return Promise.resolve({data:[{state}]});
   }};
  return q;
 }};
 const action=trash=>ctx.ProfileData.setBasketballTrash(client,'A','ABC123',trash,()=>true);
 await action(true);
 assert.equal(writes,2);
 assert.equal(state.libraryStatus,'trash');
 assert.equal(state.scores.home,3);
 assert.equal(state.running,false);
 assert.ok(state.seconds<=118);
 await action(false);
 assert.equal(state.libraryStatus,'active');
 state={...state,libraryStatus:'completed'};
 await action(true);
 await action(false);
 assert.equal(state.libraryStatus,'completed');
});
