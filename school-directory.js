/* Shared listings are snapshots. Private season libraries and saved games stay separate. */
window.SchoolDirectory=(()=>{
 const client=()=>{if(!window.Live?.client)throw Error('Directory unavailable.');return Live.client;};
 const teamKey=team=>team.trim().replace(/\s+/g,' ').toLowerCase();
 const seasonFilters=(query,selection)=>query.eq('season',selection.season).eq('program',selection.program).eq('level',selection.level);
 const filters=(query,selection)=>seasonFilters(query,selection).eq('team_key',teamKey(selection.team));
 async function user(){
  const {data,error}=await client().auth.getUser();
  if(error)throw error;
  return data?.user;
 }
 async function own(selection,owner){
  const {data,error}=await filters(client().from('shared_season_rosters').select('id,published,official'),selection)
   .eq('owner_id',owner).maybeSingle();
  if(error)throw error;
  return data;
 }
 async function publish(selection,roster,published,owner){
  if((await user())?.id!==owner)throw Error('Account changed. Reload this roster before sharing.');
  const existing=await own(selection,owner);
  const table=client().from('shared_season_rosters');
  if(!published&&!existing?.published)return;
  if(published&&!roster)throw Error('Add at least one player before publishing.');
  const fields={owner_id:owner,team:selection.team.trim().replace(/\s+/g,' '),season:selection.season,
   program:selection.program,level:selection.level,published};
  const query=published?table.upsert({...fields,roster},{onConflict:'owner_id,team_key,season,program,level'}):
   table.update({published:false}).eq('id',existing.id).eq('owner_id',owner);
  const {data,error}=await query.select('id,published,official').single();
  if(error)throw error;
  if(!data)throw Error('Roster publication changed. Reload and retry.');
  return data;
 }
 async function browse(selection,{partial=false}={}){
  const school=teamKey(selection.team);
  if(!school)return [];
  const base=seasonFilters(client().from('shared_season_rosters')
   .select('id,team,roster,player_count,official,updated_at').eq('published',true),selection);
  const match=partial?base.ilike('team_key','%'+school.replace(/[\\%_]/g,'\\$&')+'%'):base.eq('team_key',school);
  const {data,error}=await match.order('official',{ascending:false}).order('updated_at',{ascending:false}).order('id').range(0,19);
  if(error)throw error;
  return data||[];
 }
 async function isStaff(){
  try{return (await user())?.app_metadata?.lls_staff===true;}catch{return false;}
 }
 async function verify(type,id,verified){
  const {error}=await client().rpc('verify_school_listing',{listing_type:type,listing_id:id,verified});
  if(error)throw error;
 }
 return {teamKey,own,publish,browse,isStaff,verify};
})();
