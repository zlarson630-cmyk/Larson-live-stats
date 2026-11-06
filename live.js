/* Only a public publishable key belongs here. RLS enforces all write access. */
window.Live = (() => {
  const url = 'https://mdbxghrqpvqqruzrlqsi.supabase.co';
  const key = 'sb_publishable_PnGlf_9UHKpglA7LR24VRg_SXfJtMXC';
  const client = window.supabase?.createClient(url, key);
  const viewer = window.supabase?.createClient(url, key, {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  async function read(client, table, id) {
    if (!client) throw Error('Cloud library unavailable. Check connection and refresh.');
    const {data,error} = await client.from(table).select('*').eq('id',id).maybeSingle();
    if(error) throw error;
    return data;
  }
  function watch(id, receive, status) {
    let stopped=false, busy=false, generation=0;
    async function refresh() {
      if(stopped||busy)return;
      busy=true; const request=++generation;
      try { const row=await read(viewer,'live_scoreboards',id); if(!stopped&&request===generation){receive(row);status(row?'Live · public scoreboard':'Game not found');} }
      catch(e){if(!stopped)status('Disconnected · retrying; last score shown');}
      finally{busy=false;}
    }
    const channel=viewer?.channel('scoreboard-'+id).on('postgres_changes',
      {event:'*',schema:'public',table:'live_scoreboards',filter:'id=eq.'+id},refresh)
      .subscribe(s=>{if(stopped)return;if(s==='SUBSCRIBED')refresh();else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(s))status('Reconnecting · last score shown');});
    const timer=setInterval(refresh,3000);
    window.addEventListener('online',refresh);
    document.addEventListener('visibilitychange',refresh);
    refresh();
    return ()=>{stopped=true;generation++;clearInterval(timer);if(channel)viewer.removeChannel(channel);window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',refresh);};
  }
  function publicState(row){return {id:row.id,home:row.home,away:row.away,scores:{home:row.home_score,away:row.away_score},period:row.period,seconds:row.seconds,running:row.running,startedAt:row.started_at,colors:{home:row.home_color,away:row.away_color},fouls:{home:'—',away:'—'},timeouts:{home:'—',away:'—'},events:[],rosters:{}};}
  return {client,read,watch,publicState};
})();
