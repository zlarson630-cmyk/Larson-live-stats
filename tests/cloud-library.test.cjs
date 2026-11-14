const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixtureApp}=require('./helpers/fixture-app.cjs');
const {database}=require('./helpers/cloud-fixture.cjs');
const brand={id:'jhs',name:'Jefferson',nickname:'J-Hawks',kits:{}};
test('published brands can be discovered, copied and edited by a second account without changing the source',async()=>{const db=database(),a=fixtureApp({db}),b=fixtureApp({db,user:{id:'B',email:'b@example.com'}});await Promise.all([a.ready(),b.ready()]);await a.ctx.TeamBrands.save(brand);const id=await a.ctx.SharedBrands.publish({...brand,rosters:{home:'private'}});assert.equal((await b.ctx.SharedBrands.browse())[0].brand.rosters,undefined);assert.equal(b.ctx.TeamBrands.list().length,0);assert.equal(await b.ctx.SharedBrands.add(id),true);assert.equal(await b.ctx.SharedBrands.add(id),false);const copy=b.ctx.TeamBrands.list()[0];await b.ctx.TeamBrands.save({...copy,name:'My copy'});assert.equal(a.ctx.TeamBrands.list()[0].name,'Jefferson');assert.equal((await b.ctx.SharedBrands.browse())[0].brand.name,'Jefferson');await a.ctx.SharedBrands.unpublish(brand.id);assert.equal((await b.ctx.SharedBrands.browse()).length,0);assert.equal(b.ctx.TeamBrands.list()[0].name,'My copy');assert.deepEqual([...a.writes,...b.writes],[])});
test('season rosters survive across devices; concurrent saves merge and sign-out clears access',async()=>{const db=database(),a=fixtureApp({db}),b=fixtureApp({db}),c=fixtureApp({db,user:{id:'B',email:'b@example.com'}});await Promise.all([a.ready(),b.ready(),c.ready()]);await Promise.all([a.ctx.CloudLibrary.saveRoster('jhs|boys|2026–27','11, Alex'),b.ctx.CloudLibrary.saveRoster('soccer|jhs|girls|2026–27','9, Casey')]);await a.ctx.CloudLibrary.refresh();assert.equal(a.ctx.CloudLibrary.rosters()['jhs|boys|2026–27'],'11, Alex');assert.equal(a.ctx.CloudLibrary.rosters()['soccer|jhs|girls|2026–27'],'9, Casey');assert.equal(Object.keys(c.ctx.CloudLibrary.rosters()).length,0);await a.ctx.Live.client.auth.signOut();await a.settle();assert.equal(Object.keys(a.ctx.CloudLibrary.rosters()).length,0);await assert.rejects(a.ctx.CloudLibrary.saveRoster('jhs|boys|2026–27','No'),/Sign in/);assert.deepEqual(a.writes,[])});
test('legacy import preserves existing account brands and rosters, keeps originals, and does not duplicate games',async()=>{const old={matchId:'123',home:'Old Home',away:'Old Away',period:1,seconds:32,events:[{kind:'Goal',team:'home'}]};const entries=Object.entries({'lls-team-brands-v1':{version:1,teams:[{...brand,name:'Old Jefferson'},{...brand,id:'legacy',name:'Old school'}]},'lls-season-rosters-v1':{'jhs|boys|2026–27':'3, Old roster','old school|girls|2026–27':'5, Older player'},'lls-soccer-matches-v1':{123:old},'lls-soccer-v01':old,'lls-game-OLD123':{home:'Basketball Home',away:'Basketball Away',scores:{home:3,away:2},events:[]}}).map(([k,v])=>[k,JSON.stringify(v)]);entries.push(['lls-game-center-scope-guest','mine']);const a=fixtureApp({storageEntries:entries});await a.ready();await a.ctx.TeamBrands.save(brand);await a.ctx.CloudLibrary.saveRoster('jhs|boys|2026–27','4, Current roster');const first=await a.ctx.CloudLibrary.importLegacy(),second=await a.ctx.CloudLibrary.importLegacy();assert.deepEqual([first.brands,first.rosters,first.games],[1,1,2]);assert.deepEqual([second.brands,second.rosters,second.games],[0,0,0]);assert.equal(a.ctx.TeamBrands.list()[0].name,'Jefferson');assert.equal(a.ctx.CloudLibrary.rosters()['jhs|boys|2026–27'],'4, Current roster');assert.equal((await a.ctx.CloudLibrary.games('soccer'))[0].state.scores.home,1);assert.equal(a.storage.size,entries.length);assert.deepEqual(a.writes,[])});
test('basketball saves separate season rosters and applies game-day edits only to the game',async()=>{
 const a=fixtureApp();a.file('soccer-brand.js');a.html('basketball.html');a.file('cloud.js');await a.ready();
 a.node('seasonTeam').value='Jefferson';
 a.node('seasonProgram').value='boys';
 a.node('seasonRoster').value='11, Player One';await a.run('saveManagedRoster()');
 a.node('seasonProgram').value='girls';
 a.run('loadManagedRoster()');a.node('seasonRoster').value='24, Player Two';await a.run('saveManagedRoster()');
 a.node('home').value='Jefferson';a.node('away').value='Visitor';
 a.node('homeProgram').value='girls';a.node('awayProgram').value='girls';
 a.run("loadSeason('home')");
 assert.equal(a.node('homeRoster').value,'24, Player Two');
 a.node('homeRoster').value='25, Player Two';
 a.run("editGameRoster('home');loadSeason('home')");
 assert.equal(a.node('homeRoster').value,'25, Player Two');
 await a.run('createGame()');
 assert.equal(a.db.tables.live_games.length,1);
 await a.run("score('home',2)");
 const state=a.db.tables.live_games[0].state;
 assert.equal(state.scores.home,2);
 assert.equal(state.rosters.home[0].number,'25');
 assert.equal(state.teamSeasons.home.teamId,'jefferson|girls');
 assert.equal(state.teamSeasons.home.seasonId,'jefferson|girls|2026–27');
 assert.equal(a.ctx.CloudLibrary.rosters()['jefferson|girls|2026–27'],'24, Player Two');
 assert.equal(a.ctx.CloudLibrary.rosters()['jefferson|boys|2026–27'],'11, Player One');
 assert.deepEqual(a.writes,[]);
});
test('basketball snapshots five starters and updates the on-court lineup after substitutions',async()=>{
 const a=fixtureApp();a.file('soccer-brand.js');a.html('basketball.html');a.file('cloud.js');await a.ready();
 a.node('homeRoster').value='1, One\n2, Two\n3, Three\n4, Four\n5, Five\n6, Six';
 a.run("editGameRoster('home')");
 for(const value of ['1','2','3','4','5'])a.node('homeStarterChoices').onchange({target:{value,checked:true}});
 assert.match(a.node('homeStarterSummary').textContent,/5\/5/);
 await a.run('createGame()');
 assert.deepEqual(a.db.tables.live_games[0].state.startingLineups.home,['1','2','3','4','5']);
 assert.equal(a.db.tables.account_roster_libraries.length,0);
 await a.run("write(s=>s.pendingSubs=[{id:'sub',team:'home',out:['1'],in:['6']}])");
 await a.run("confirmBasketballSubs('sub');writeQueue");
 assert.equal(a.run("basketballOnCourt(state,'home').has('6')"),true);
 assert.equal(a.run("basketballOnCourt(state,'home').has('1')"),false);
 await a.run('undo()');
 assert.equal(a.run("basketballOnCourt(state,'home').has('1')"),true);
});
test('basketball can import and review a PDF before loading a season',async()=>{
 const a=fixtureApp();a.html('basketball.html');
 a.ctx.pdfjsLib={GlobalWorkerOptions:{},getDocument:()=>({promise:Promise.resolve({
  numPages:1,getPage:async()=>({getTextContent:async()=>({items:[
   {str:'11 Jordan Robinson',transform:[0,0,0,0,10,50]}
  ]})})
 })})};
 a.ctx.pdfInput={files:[{name:'roster.pdf',arrayBuffer:async()=>new ArrayBuffer(0)}]};
 await a.run('importPdf(pdfInput)');
 assert.match(a.node('pdfReviewText').value,/11, Jordan Robinson/);
 a.run('applyPdfRoster()');
 assert.match(a.node('seasonRoster').value,/11, Jordan Robinson/);
 assert.equal(a.db.tables.account_roster_libraries.length,0);
});
test('soccer creates a cloud match, confirms edits, and rolls back an unsuccessful save without writing to the browser',async()=>{const a=fixtureApp({sport:'soccer'});a.file('soccer-brand.js');a.file('soccer-clock.js');a.html('soccer.html');await a.ready();a.node('home').value='Jefferson';a.node('away').value='Visitor';a.node('soccerSeason').value='2026–27';a.node('soccerProgram').value='boys';a.node('hr').value='9, Soccer Player';assert.equal(await a.run('createCloudMatch()'),true);await a.run("choose('Goal','home');saveEvent();cloudQueue");assert.equal(a.db.tables.live_games[0].state.scores.home,1);assert.equal(a.ctx.CloudLibrary.rosters()['soccer|jefferson|boys|2026–27'],'9, Soccer Player');a.db.setOffline(true);await a.run("choose('Goal','home');saveEvent();cloudQueue");assert.match(a.node('status').textContent,/NOT SAVED/);assert.equal(a.run('s.events.length'),1);assert.deepEqual(a.writes,[])});
test('Team Brands renders the complete account shelf and exposes shared brands without opening the editor',async()=>{const db=database(),a=fixtureApp({db}),b=fixtureApp({db,user:{id:'B',email:'b@example.com'}});await Promise.all([a.ready(),b.ready()]);await Promise.all([a.ctx.TeamBrands.save(brand),a.ctx.TeamBrands.save({...brand,id:'another',name:'Another School'})]);await b.ctx.TeamBrands.save({...brand,id:'visitor',name:'Visitor School'});await b.ctx.SharedBrands.publish({id:'visitor'});a.file('soccer-brand.js');a.file('brands-editor.js');await a.settle();assert.equal(a.node('brandCount').textContent,2);assert.equal(a.node('brandLibrary').children.length,2);assert.equal(a.node('sharedLibrary').children.length,1);assert.equal(a.node('sharedLibrary').children[0].children.find(e=>e.textContent==='Add to my library').disabled,false);a.node('brandSearch').value='Another';a.node('brandSearch').input();assert.equal(a.node('brandLibrary').children.length,1);assert.deepEqual(a.writes,[])});

test('shared brand discovery matches the nickname and sorts official listings first',async()=>{
 const db=database(),a=fixtureApp({db}),b=fixtureApp({db,user:{id:'B'}});
 await Promise.all([a.ready(),b.ready()]);
 await a.ctx.TeamBrands.save({...brand,id:'harlem',name:'Harlem High School',nickname:'Huskies'});
 await a.ctx.TeamBrands.save({...brand,id:'another',name:'Another School',nickname:'Huskies'});
 await a.ctx.SharedBrands.publish({id:'harlem'});
 await a.ctx.SharedBrands.publish({id:'another'});
 for(const row of db.tables.shared_team_brands)row.official=row.brand_id==='harlem';
 const rows=await b.ctx.SharedBrands.browse('huskies');
 assert.deepEqual(Array.from(rows,row=>row.name),['Harlem High School','Another School']);
});

test('public season rosters match team, program, season and level, then disappear after unpublishing',async()=>{
 const db=database(),a=fixtureApp({db}),b=fixtureApp({db,user:null});
 a.file('school-directory.js');b.file('school-directory.js');
 await a.ready();
 const season={team:'Harlem',season:'2026–27',program:'girls',level:'varsity'};
 await a.ctx.SchoolDirectory.publish(season,'05, Player One, , ',true,'A');
 await a.ctx.SchoolDirectory.publish({...season,level:'jv'},'12, Player Two, , ',true,'A');
 assert.equal((await b.ctx.SchoolDirectory.browse({...season,team:'  HARLEM  '}))[0].roster,'05, Player One, , ');
 assert.equal((await b.ctx.SchoolDirectory.browse({...season,level:'jv'}))[0].player_count,1);
 assert.equal((await b.ctx.SchoolDirectory.browse({...season,program:'boys'})).length,0);
 await a.ctx.SchoolDirectory.publish(season,'',false,'A');
 assert.equal((await b.ctx.SchoolDirectory.browse(season)).length,0);
 assert.equal((await b.ctx.SchoolDirectory.browse({...season,level:'jv'})).length,1);
});

test('basketball suggests an official roster and copies it only into the game draft',async()=>{
 const a=fixtureApp();
 a.file('soccer-brand.js');a.html('basketball.html');a.file('school-directory.js');
 await a.ready();
 const selection={team:'Harlem',season:'2026–27',program:'girls',level:'varsity'};
 await a.ctx.SchoolDirectory.publish(selection,'05, Player One, , ',true,'A');
 a.db.tables.shared_season_rosters[0].official=true;
 a.node('home').value='Harlem';a.node('homeSeason').value=selection.season;
 a.node('homeProgram').value=selection.program;
 a.file('basketball-roster-directory.js');
 await a.settle();
 await a.ctx.BasketballRosterDirectory.suggest('home',true);
 const rosterPanel=a.node('homeSharedRosters');
 assert.equal(rosterPanel.hidden,false);
 assert.equal(rosterPanel.children[1].textContent,'Use official roster');
 rosterPanel.children[1].onclick();
 assert.match(a.node('homeRoster').value,/05, Player One/);
 assert.equal(a.ctx.CloudLibrary.rosters()['harlem|girls|2026–27'],undefined);
 assert.equal(a.run('gameTeamSeasons().home.sharedRosterId'),a.db.tables.shared_season_rosters[0].id);
});
