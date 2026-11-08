const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('schedule links basketball to the scorer and ignores a cloud read after sign-out',async()=>{
 const nodes=new Map(),listeners={},filters=[];
 const node=id=>{
  if(!nodes.has(id))nodes.set(id,{textContent:'',value:'',children:[],
   append(...children){this.children.push(...children)},replaceChildren(...children){this.children=children},
   addEventListener(event,handler){this[event]=handler}});
  return nodes.get(id);
 };
 let completeRead;
 const read=new Promise(resolve=>{completeRead=resolve});
 const query={select(){return this},eq(...filter){filters.push(filter);return this},order(){return this},limit(){return read}};
 const client={auth:{
  getUser:async()=>({data:{user:{id:'owner',email:'owner@example.com'}}}),
  onAuthStateChange(handler){listeners.auth=handler}
 },from(){return query}};
 const draft=[{id:'draft',sport:'basketball',home:'Home',away:'Visitor',date:'2026-11-09T19:00:00Z'}];
 const context=vm.createContext({
  window:{Live:{client}},document:{getElementById:node,createElement:()=>node(Symbol())},
  localStorage:{getItem:()=>JSON.stringify(draft)},URLSearchParams,setTimeout,location:{}
 });
 vm.runInContext(fs.readFileSync('assets/js/schedule.js','utf8'),context);
 await new Promise(setImmediate);
 assert.deepEqual(filters,[['owner_id','owner']]);
 const actions=node('games').children[0].children.at(-1);
 actions.children[0].click();
 assert.equal(context.location.href,'basketball-home.html');
 listeners.auth('SIGNED_OUT',null);
 completeRead({data:[{id:'private',sport:'basketball',home:'Private',away:'Hidden'}]});
 await new Promise(setImmediate);
 assert.equal(node('cloudGames').children.length,0);
 assert.match(node('cloudStatus').textContent,/Not signed in/);
});
