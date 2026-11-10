const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const vm=require('node:vm');

function element(){
 return {children:[],style:{setProperty(){}},append(...children){this.children.push(...children);},
  prepend(child){this.children.unshift(child);},replaceChildren(){this.children=[];},addEventListener(){}};
}
const context=vm.createContext({document:{createElement:element},URL,TextEncoder});
context.window=context;
for(const file of ['affiliations.js','basketball-feature.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
const feature=context.BasketballFeature;
const fields={conference:'NIC-10',logo:'https://example.com/logo.png',away:'Guilford',home:'Jefferson',
 awayRecord:'11–5',homeRecord:'12–4',rows:''};

test('broadcast graphics render matchup, schedule and conference records as text',()=>{
 const host=element();
 feature.render(host,'intro',feature.create('intro',fields),{colors:{away:'#142b52'},logos:{away:'https://example.com/team.png'}});
 assert.equal(host.children[2].children[0].children[2].textContent,'Guilford');
 assert.equal(host.children[2].children[2].children[3].textContent,'12–4');
 for(const [kind,rows] of [['upcoming','Guilford at Jefferson | Friday, 7 PM CT'],['standings','<Jefferson> | 7–1 | 12–4']]){
  const payload=feature.create(kind,{...fields,rows});
  feature.render(host,kind,payload);
  assert.equal(host.children[2].children[1].children[0].children[0].textContent,rows.split(' | ')[0]);
 }
 assert.throws(()=>feature.create('standings',{...fields,rows:'Jefferson | 7–1'}),/1–10 rows/);
 assert.throws(()=>feature.create('intro',{...fields,logo:'javascript:alert(1)'}),/HTTPS/);
});

test('upcoming games use the public conference schedule and omit the current game',async()=>{
 const data=[
  {id:'THIS',teams:{away:{name:'Guilford'},home:{name:'Jefferson'}},scheduled_at:'2027-01-10T02:00:00Z'},
  {id:'NEXT',teams:{away:{name:'Guilford Vikings'},home:{name:'Auburn'}},scheduled_at:'2027-01-12T01:00:00Z'},
  {id:'OTHER',teams:{away:{name:'Unrelated'},home:{name:'Visitor'}},scheduled_at:'2027-01-12T01:00:00Z'}
 ];
 const query={select(){return this;},eq(){return this;},gte(){return this;},order(){return this;},range(){return {data};}};
 const result=await feature.upcoming({from(){return query;}},'NIC-10','THIS');
 assert.match(result,/^Guilford Vikings at Auburn \| .*7:00 PM CST$/);
});
