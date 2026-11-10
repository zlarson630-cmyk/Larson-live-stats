(() => {
  const E=window.FieldSports, $=id=>document.getElementById(id);
  const params=new URLSearchParams(location.search);
  const sport=Object.hasOwn(E.sports,params.get('sport'))?params.get('sport'):'football';
  const config=E.sports[sport], football=sport==='football';
  const isBroadcast=params.get('view')==='broadcast';
  const requested=params.get('game')||'';
  const demo=params.get('demo')==='1';
  const activeKey='lls-field-active-'+sport;
  const key=id=>(demo?'lls-field-demo-':'lls-field-game-')+sport+'-'+id;
  const fieldNames=['first','second','third'];
  let game=null, state=null, editingSetup=!demo&&!isBroadcast&&!requested&&params.get('setup')==='1', pendingPDF=null;

  function read(id) {
    if(!/^[a-f0-9-]{36}$/.test(id||''))return null;
    try{
      const data=JSON.parse(localStorage.getItem(key(id)));
      return data?.id===id&&data.sport===sport&&Array.isArray(data.events)?data:null;
    }catch{return null;}
  }

  function active() {
    try{return localStorage.getItem(activeKey);}catch{return null;}
  }

  function say(message='') {$('notice').textContent=message;}
  function element(tag,text) {
    const node=document.createElement(tag);
    if(text!==undefined)node.textContent=text;
    return node;
  }
  function makeTable(headers,rows) {
    const table=element('table'), head=element('thead'), body=element('tbody');
    const titles=element('tr');
    for(const label of headers){
      const cell=element('th',label);cell.scope='col';titles.append(cell);
    }
    head.append(titles);
    for(const [name,...values] of rows){
      const row=element('tr'), label=element('th',name);
      label.scope='row';row.append(label,...values.map(value=>element('td',value)));
      body.append(row);
    }
    table.append(head,body);
    return table;
  }

  function syncSelectors() {
    for(const select of [$('footballTeam'),$('possession')]){
      for(const option of select.options)option.textContent=game.teams[option.value];
    }
    $('possession').value=state.possession;
    $('down').value=state.down;
    $('distance').value=state.distance;
    $('spot').value=state.spot;
  }

  function install(next) {
    game=next;
    state=game?E.replay(game):null;
    if(game&&!isBroadcast){syncSelectors();suggest();}
    render();
  }

  function save(next, create=false) {
    try {
      localStorage.setItem(key(next.id),JSON.stringify(next));
      if(create&&!demo)localStorage.setItem(activeKey,next.id);
    } catch {
      say('Could not save on this device. Check available browser storage.');
      return false;
    }
    install(next);
    say('');
    return true;
  }

  function commit(event) {
    if(!game||state.final||isBroadcast)return false;
    const latest=read(game.id);
    if(!latest||latest.revision!==game.revision){
      if(latest)install(latest);
      say('This game changed in another tab. Review the latest score and retry.');
      return false;
    }
    return save({...game,revision:crypto.randomUUID(),events:[...game.events,{...event,at:Date.now()}]});
  }

  function suggest() {
    if(football||!state)return;
    const play=E.suggest(state,$('outcome').value);
    $('runs').value=play.runs;$('rbi').value=play.rbi;$('outs').value=play.outs;
    play.bases.forEach((on,i)=>{$('base'+(i+1)).checked=on;});
  }

  function playerPanels(kind,host,view) {
    const panels=E.sides.map(side=>{
      const panel=element('div'), title=element('h3',game.teams[side]+(kind==='pitching'?' · Pitching':''));
      panel.className='players';
      panel.style.setProperty('--jersey',game.colors[side]);
      const container=element('div');container.className='table-wrap';
      if(view.rows[side].length)container.append(makeTable(view.headers,view.rows[side]));
      else container.append(element('p','No player stats recorded.'));
      panel.append(title,container);
      return panel;
    });
    host.replaceChildren(...panels);
  }

  function renderLeaders() {
    const categories=football?
      [['Points','points'],['Passing yards','pass'],['Rushing yards','rush'],['Receiving yards','recYards']]:
      [['Hits','h'],['Runs batted in','rbi'],['Strikeouts pitched','k',true]];
    const cards=categories.map(([label,stat,pitching])=>{
      const players=pitching?state.pitchers:state.players;
      const ranking=E.sides.flatMap(side=>Object.values(players[side]).map(player=>({player,side})))
        .sort((a,b)=>b.player[stat]-a.player[stat]);
      const top=ranking[0], card=element('div');
      card.className='leader';
      card.append(element('span',label));
      if(top?.player[stat]>0){
        card.style.setProperty('--jersey',game.colors[top.side]);
        card.append(element('strong',top.player[stat]),element('small',top.player.player+' · '+game.teams[top.side]));
      } else card.append(element('small','No leader yet'));
      return card;
    });
    $('leaders').replaceChildren(...cards);
  }

  function render() {
    $('setup').hidden=isBroadcast||!!game&&!editingSetup;
    $('resume').hidden=!game;
    $('game').hidden=!game||editingSetup;
    $('topActions').hidden=!game||editingSetup;
    if(!game||editingSetup)return;
    const demoQuery=demo?'&demo=1':'';
    const broadcastURL='?sport='+sport+'&view=broadcast&game='+game.id+demoQuery;
    $('broadcastLink').href=isBroadcast?(demo?'?sport='+sport+demoQuery+'&game='+game.id:'?sport='+sport+'&game='+game.id):broadcastURL;
    $('broadcastLink').textContent=isBroadcast?'Open scorer':'Broadcast Center ↗';
    $('broadcastLink').target=isBroadcast?'_self':'_blank';
    $('phase').textContent=state.final?'FINAL':football?
      (state.period>config.regulation?'Overtime '+(state.period-config.regulation):'Quarter '+state.period):
      (state.half==='top'?'Top ':'Bottom ')+state.period;
    for(const side of E.sides){
      $(side+'Name').textContent=game.teams[side];
      $(side+'Score').textContent=state.scores[side];
      $(side+'Card').style.setProperty('--jersey',game.colors[side]);
    }
    if(football){
      $('situation').textContent=game.teams[state.possession]+' ball · '+['','1st','2nd','3rd','4th'][state.down]+' & '+state.distance+(state.spot?' · '+state.spot:'');
      tick();
    } else {
      $('detail').textContent=state.final?'Box score':state.outs+' '+(state.outs===1?'out':'outs');
      $('situation').textContent=state.final?'':game.teams[E.batting(state)]+' batting · '+state.balls+'–'+state.strikes+' count';
      $('diamond').setAttribute('aria-label','Occupied bases: '+(fieldNames.filter((name,i)=>state.bases[i]).join(', ')||'none'));
      Array.from($('diamond').children).forEach((base,i)=>base.classList.toggle('on',state.bases[i]));
    }

    if(isBroadcast)renderLeaders();
    const tables=E.tables(game,state);
    $('lineScore').replaceChildren(makeTable(tables.line.headers,tables.line.rows));
    $('comparison').replaceChildren(makeTable(tables.comparison.headers,tables.comparison.rows));
    playerPanels('players',$('playerStats'),tables.players);
    if(!football)playerPanels('pitching',$('pitchingStats'),tables.pitching);

    const plays=state.plays.slice(-12).reverse().map(play=>{
      const row=element('li');
      row.style.setProperty('--jersey',game.colors[play.team]);
      row.append(element('small',game.teams[play.team]+' · '+E.playContext(game,play)),
        element('strong',E.playLabel(game,play)));
      return row;
    });
    $('playLog').replaceChildren(...(plays.length?plays:[element('li','No plays recorded yet.')]));
    for(const control of document.querySelectorAll('#footballEntry input,#footballEntry select,#footballEntry button,#diamondEntry input,#diamondEntry select,#diamondEntry button,#footballTools input,#footballTools select,#footballTools button,#period,#finish'))control.disabled=state.final;
    $('undo').disabled=!game.events.length;
  }

  function tick() {
    if(!football||!state)return;
    const seconds=E.clock(state);
    $('detail').textContent=E.clockText(seconds);
    $('clockToggle').textContent=state.startedAt!==null&&seconds>0?'Pause clock':'Start clock';
    $('clockToggle').disabled=state.final||seconds===0;
  }

  function enableScoring() {
    const outcome=$('outcome');
    for(const value of Object.keys(E.diamond)){
      const option=element('option',value==='Fielders choice'?'Fielder’s choice':value);option.value=value;outcome.append(option);
    }
    for(const value of E.footballStats)$('footballStat').append(element('option',value));
    for(const [label,points] of Object.entries(E.football)){
      const button=element('button','+'+points+' '+label);button.type='button';
      button.onclick=()=>commit({type:'play',team:$('footballTeam').value,label,player:$('footballPlayer').value.trim()});
      $('footballButtons').append(button);
    }

    $('setupForm').onsubmit=event=>{
      event.preventDefault();
      const data=new FormData(event.currentTarget);
      const away=String(data.get('away')).trim(), home=String(data.get('home')).trim();
      if(!away||!home){say('Enter both team names.');return;}
      if(game&&!confirm('Start a separate game? The previous game’s broadcast link will still open it on this device.'))return;
      const next={id:crypto.randomUUID(),revision:crypto.randomUUID(),sport,teams:{away,home},colors:{away:data.get('awayColor'),home:data.get('homeColor')},minutes:Number(data.get('minutes')),events:[]};
      editingSetup=false;save(next,true);
      if(game?.id===next.id)history.replaceState(null,'','?sport='+sport+'&game='+game.id);
    };
    $('resume').onclick=()=>{editingSetup=false;render();};
    $('newGame').onclick=()=>{if(demo){location.href='?sport='+sport+'&demo=1';return;}editingSetup=true;render();$('setupTitle').scrollIntoView({block:'start'});};
    $('undo').onclick=()=>{
      if(!game?.events.length)return;
      const latest=read(game.id);
      if(latest?.revision!==game.revision){
        if(latest)install(latest);
        say('This game changed in another tab. Review the latest score and retry.');
        return;
      }
      save({...game,revision:crypto.randomUUID(),events:game.events.slice(0,-1)});
    };
    $('finish').onclick=()=>{if(confirm('Mark this game final?'))commit({type:'final'});};
    $('period').onclick=()=>{if(confirm(football?'Advance to the next period?':'End this half-inning and clear the bases?'))commit({type:'period'});};

    $('footballEntry').onsubmit=event=>{
      event.preventDefault();
      commit({type:'play',team:$('footballTeam').value,label:$('footballStat').value,player:$('footballPlayer').value.trim(),yards:Number($('yards').value)});
    };
    $('clockToggle').onclick=()=>commit({type:'clock',running:state.startedAt===null});
    $('applyClock').onclick=()=>{
      const parts=$('clockSet').value.trim().match(/^(\d{1,2}):([0-5]\d)$/);
      if(!parts){say('Enter the clock in minutes:seconds.');return;}
      commit({type:'clock',running:false,seconds:Number(parts[1])*60+Number(parts[2])});
    };
    $('possessionForm').onsubmit=event=>{
      event.preventDefault();
      commit({type:'situation',possession:$('possession').value,down:Number($('down').value),distance:Number($('distance').value),spot:$('spot').value.trim()});
    };
    outcome.onchange=suggest;
    for(const button of $('pitchButtons').querySelectorAll('[data-pitch]')){
      button.onclick=()=>{
        if(state.balls===4||state.strikes===3){say('Record the plate appearance before adding another pitch.');return;}
        commit({type:'pitch',label:button.dataset.pitch});
        if(state.balls===4){outcome.value='Walk';suggest();}
        if(state.strikes===3){outcome.value='Strikeout';suggest();}
      };
    }
    $('diamondEntry').onsubmit=event=>{
      event.preventDefault();
      const runs=Number($('runs').value),rbi=Number($('rbi').value),outs=Number($('outs').value);
      if(rbi>runs||outs+state.outs>3){say('RBI cannot exceed runs, and this play cannot take the half beyond three outs.');return;}
      if(outcome.value==='Runner play'&&rbi){say('Runner plays cannot earn a batter RBI.');return;}
      const team=E.batting(state);
      const saved=commit({type:'result',label:outcome.value,player:$('batter').value.trim(),pitcher:$('pitcher').value.trim(),runs,rbi,outs,bases:fieldNames.map((name,i)=>$('base'+(i+1)).checked)});
      if(!saved)return;
      if(state&&E.batting(state)!==team)$('pitcher').value='';
      $('batter').value='';
    };
  }

  async function script(url) {
    return new Promise((resolve,reject)=>{
      const script=element('script');script.src=url;script.onload=resolve;script.onerror=()=>reject(Error('Could not load the PDF exporter.'));document.head.append(script);
    });
  }

  async function downloadPdf(preset) {
    if(!game)return;
    const snapshot=game,now=Date.now(),button=$(preset==='one'?'pdf':'pdfFull');
    button.disabled=true;
    try{
      pendingPDF ||= (async()=>{
        if(!window.jspdf)await script('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js');
        if(!window.SportReport)await script('sport-report.js');
        if(!window.FieldReport)await script('field-sports/report.js?v=pdf-suite');
      })().catch(error=>{pendingPDF=null;throw error;});
      await pendingPDF;
      await window.FieldReport.download(snapshot,preset,now);
      say(preset==='one'?'One-page box score exported.':'Full stats report exported.');
    } catch(error){say(error.message);}
    finally{button.disabled=false;}
  }
  $('pdf').onclick=()=>downloadPdf('one');
  $('pdfFull').onclick=()=>downloadPdf('full');

  document.title='Larson Live Stats · '+config.name+(isBroadcast?' Broadcast':'');
  $('title').textContent=isBroadcast?'Broadcast Center':config.name+' scorer';
  $('sportLabel').textContent=isBroadcast?config.name+' · Broadcast view':'Larson Live Stats · Local beta';
  const lobby='sport-home.html?sport='+sport;
  $('fieldHeaderSport').textContent=config.name+' · Beta';
  $('fieldNavSport').textContent='· '+config.name;
  $('fieldLobbyLink').href=lobby;
  document.querySelector('.sportsMenu a[href="'+lobby+'"]').setAttribute('aria-current','page');
  $('minutesField').hidden=!football;
  $('footballEntry').hidden=$('footballTools').hidden=!football;
  $('diamondEntry').hidden=$('diamond').hidden=$('pitchingStats').hidden=football;
  $('controls').hidden=isBroadcast;
  $('leadersPanel').hidden=!isBroadcast;
  $('period').textContent=football?'Next period':'Next half-inning';
  if(demo){
    $('sportDemoBanner').hidden=false;
    $('sportDemoReset').href='?sport='+sport+'&demo=1';
    $('sportDemoExit').href=lobby;
  }
  if(isBroadcast){
    document.body.classList.add('broadcast');
    $('setup').hidden=true;
    window.addEventListener('storage',event=>{
      if(event.key===key(requested))install(read(requested));
    });
    install(read(requested));
    if(!game)say('This broadcast opens on the device and browser that saved the game.');
  } else {
    enableScoring();
    if(demo){
      const saved=read(requested);
      if(saved)install(saved);
      else save(window.SportDemo.field(sport,E));
    }else install(read(requested)||read(active()));
  }
  if(football)setInterval(tick,250);
})();
