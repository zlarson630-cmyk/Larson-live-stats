(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.FieldSports = engine;
})(typeof window === 'object' ? window : globalThis, () => {
  const sports = {
    football: {name:'Football', unit:'Quarter', regulation:4, minutes:12},
    baseball: {name:'Baseball', unit:'Inning', regulation:7},
    softball: {name:'Softball', unit:'Inning', regulation:7}
  };
  const football = {'Touchdown':6, 'Extra point':1, 'Two-point conversion':2, 'Field goal':3, 'Safety':2};
  const footballStats = ['Rush', 'Pass complete', 'Pass incomplete', 'Reception', 'Tackle', 'Sack', 'Interception'];
  const diamond = {
    Single:{hit:1}, Double:{hit:2}, Triple:{hit:3}, 'Home run':{hit:4},
    Walk:{free:true}, 'Hit by pitch':{free:true}, 'Reached on error':{error:true},
    'Fielders choice':{}, 'Sacrifice':{out:1}, 'Strikeout':{out:1}, 'Other out':{out:1}, 'Runner play':{}
  };
  const sides = ['away','home'];
  const flip = side => side === 'home' ? 'away' : 'home';
  const batting = state => state.half === 'top' ? 'away' : 'home';
  const clock = (s, now=Date.now()) => Math.max(0,s.seconds-(s.startedAt == null ? 0 : Math.max(0,Math.floor((now-s.startedAt)/1000))));
  const clockText = seconds => Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');

  function suggest(state, outcome) {
    const kind = diamond[outcome];
    if (!kind) throw Error('Choose a batting result.');
    const bases = [...state.bases];
    let runs = 0;
    if (kind.hit || kind.error) {
      const distance = kind.hit || 1;
      runs = Number(distance===4);
      bases.fill(false);
      state.bases.forEach((occupied,i) => {
        if (!occupied) return;
        if (i+distance>=3) runs++;
        else bases[i+distance]=true;
      });
      if (distance<4) bases[distance-1]=true;
    } else if (kind.free) {
      if (bases[0] && bases[1] && bases[2]) runs++;
      if (bases[0] && bases[1]) bases[2]=true;
      if (bases[0]) bases[1]=true;
      bases[0]=true;
    }
    return {bases, runs, rbi:kind.error ? 0 : runs, outs:kind.out||0};
  }

  function replay(game) {
    const isFootball = game.sport === 'football';
    const playerMap = () => ({away:Object.create(null),home:Object.create(null)});
    const s = {
      scores:{away:0,home:0}, hits:{away:0,home:0}, errors:{away:0,home:0},
      line:{away:[],home:[]}, players:playerMap(), pitchers:playerMap(), periods:1,
      footballTotals:{away:{pass:0,rush:0,tackles:0},home:{pass:0,rush:0,tackles:0}},
      period:1, half:'top', outs:0, balls:0, strikes:0, bases:[false,false,false],
      seconds:(game.minutes||12)*60, startedAt:null, possession:'away', down:1, distance:10, spot:'',
      final:false, plays:[]
    };
    function nextHalf() {
      if (s.half==='bottom') s.period++;
      s.half=s.half==='top'?'bottom':'top';
      s.periods=Math.max(s.periods,s.period);
      s.outs=s.balls=s.strikes=0;
      s.bases=[false,false,false];
    }
    for (const e of game.events) {
      if (s.final) continue;
      if (e.type==='final') {
        s.final=true;
        s.seconds=clock(s,e.at);
        s.startedAt=null;
        continue;
      }
      if (e.type==='period') {
        if (isFootball) {
          s.period++;
          s.periods=s.period;
          s.seconds=(game.minutes||12)*60;
          s.startedAt=null;
        } else nextHalf();
        continue;
      }
      if (isFootball && e.type==='clock') {
        s.seconds=e.seconds ?? clock(s,e.at);
        s.startedAt=e.running&&s.seconds>0?e.at:null;
        continue;
      }
      if (isFootball && e.type==='situation') {
        Object.assign(s,{possession:e.possession,down:e.down,distance:e.distance,spot:e.spot});
        continue;
      }
      if (!isFootball && e.type==='pitch') {
        if(e.label==='Ball')s.balls=Math.min(4,s.balls+1);
        if(e.label==='Strike')s.strikes=Math.min(3,s.strikes+1);
        if(e.label==='Foul'&&s.strikes<2)s.strikes++;
        continue;
      }
      const team = isFootball ? e.team : batting(s);
      if (!sides.includes(team)) continue;
      const kind = diamond[e.label];
      const points = isFootball ? football[e.label]||0 : e.runs;
      if (isFootball && e.type!=='play' || !isFootball && (e.type!=='result'||!kind)) continue;
      const player = e.player?.trim();
      const record = player ? (s.players[team][player.toLowerCase()] ||= {player,points:0,td:0,ab:0,h:0,rbi:0,bb:0,k:0,pass:0,comp:0,att:0,rush:0,rec:0,recYards:0,tackles:0,sacks:0,int:0}) : null;
      s.scores[team]+=points;
      s.line[team][s.period-1]=(s.line[team][s.period-1]||0)+points;
      s.plays.push({...e,team,period:s.period,half:s.half,time:isFootball?clockText(clock(s,e.at)):null,points});
      if (isFootball) {
        const totals=s.footballTotals[team], yards=e.yards||0;
        if(e.label==='Rush')totals.rush+=yards;
        if(e.label==='Pass complete')totals.pass+=yards;
        if(e.label==='Tackle')totals.tackles++;
        if(record){
          record.points+=points;
          record.td+=Number(e.label==='Touchdown');
          if(e.label==='Rush')record.rush+=yards;
          if(e.label==='Pass complete'){record.comp++;record.pass+=yards;}
          if(e.label==='Pass complete'||e.label==='Pass incomplete')record.att++;
          if(e.label==='Reception'){record.rec++;record.recYards+=yards;}
          if(e.label==='Tackle')record.tackles++;
          if(e.label==='Sack')record.sacks++;
          if(e.label==='Interception')record.int++;
        }
        continue;
      }
      s.hits[team]+=Number(!!kind.hit);
      s.errors[flip(team)]+=Number(!!kind.error);
      if (record && e.label!=='Runner play') {
        record.ab+=Number(!kind.free&&e.label!=='Sacrifice');
        record.h+=Number(!!kind.hit);
        record.rbi+=e.rbi;
        record.bb+=Number(e.label==='Walk');
        record.k+=Number(e.label==='Strikeout');
      }
      const pitcher=e.pitcher?.trim();
      if(pitcher){
        const defense=s.pitchers[flip(team)];
        const p=defense[pitcher.toLowerCase()] ||= {player:pitcher,outs:0,h:0,r:0,bb:0,k:0};
        p.outs+=e.outs;
        p.h+=Number(!!kind.hit);
        p.r+=e.runs;
        p.bb+=Number(e.label==='Walk');
        p.k+=Number(e.label==='Strikeout');
      }
      s.outs+=e.outs;
      s.bases=[...e.bases];
      if(e.label!=='Runner play')s.balls=s.strikes=0;
      if(s.outs>=3)nextHalf();
    }
    return s;
  }

  function tables(game,s) {
    const isFootball=game.sport==='football', rule=sports[game.sport];
    const playedPeriods=s.final&&!isFootball?Math.max(s.line.away.length,s.line.home.length):s.periods;
    const periods=Array.from({length:Math.max(rule.regulation,playedPeriods)},(_,i)=>i+1);
    const lineHeaders=['Team',...periods.map(n=>n>rule.regulation&&isFootball?'OT'+(n-rule.regulation):String(n)),
      ...(isFootball?['Total']:['R','H','E'])];
    const lineRows=sides.map(side=>[game.teams[side],
      ...periods.map(n=>s.line[side][n-1]??(n<s.period||n===s.period&&(isFootball||side==='away'||s.half==='bottom')?0:'–')),
      s.scores[side],...(isFootball?[]:[s.hits[side],s.errors[side]])]);
    const metrics=isFootball?[
      ['Points',t=>s.scores[t]],['Passing yards',t=>s.footballTotals[t].pass],
      ['Rushing yards',t=>s.footballTotals[t].rush],['Tackles',t=>s.footballTotals[t].tackles]
    ]:[
      ['Runs',t=>s.scores[t]],['Hits',t=>s.hits[t]],['Errors',t=>s.errors[t]],
      ['Walks',t=>s.plays.filter(p=>p.team===t&&p.label==='Walk').length],
      ['Strikeouts',t=>s.plays.filter(p=>p.team===t&&p.label==='Strikeout').length]
    ];
    function bySide(map,format) {
      return Object.fromEntries(sides.map(side=>[side,Object.values(map[side]).map(format)]));
    }
    return {
      line:{headers:lineHeaders,rows:lineRows},
      comparison:{headers:['Statistic',game.teams.away,game.teams.home],rows:metrics.map(([label,value])=>[label,value('away'),value('home')])},
      players:{
        headers:isFootball?['Player','PTS','TD','C/ATT','PASS','RUSH','REC','REC YD','TKL','SACK','INT']:['Batter','AB','H','RBI','BB','K'],
        rows:bySide(s.players,p=>isFootball?
          [p.player,p.points,p.td,p.comp+'/'+p.att,p.pass,p.rush,p.rec,p.recYards,p.tackles,p.sacks,p.int]:
          [p.player,p.ab,p.h,p.rbi,p.bb,p.k])
      },
      pitching:{headers:['Pitcher','IP','H','R','BB','K'],
        rows:bySide(s.pitchers,p=>[p.player,Math.floor(p.outs/3)+'.'+(p.outs%3),p.h,p.r,p.bb,p.k])}
    };
  }

  function playContext(game,play) {
    return game.sport==='football'?(play.period<=4?'Q'+play.period:'OT'+(play.period-4))+' · '+play.time:
      (play.half==='top'?'Top ':'Bottom ')+play.period;
  }

  function playLabel(game,play) {
    const bits=[play.label==='Fielders choice'?'Fielder’s choice':play.label];
    if(play.player)bits.push(play.player);
    if(game.sport==='football'){
      if(play.points)bits.push('+'+play.points+' pts');
      if(play.yards!==undefined&&['Rush','Pass complete','Reception'].includes(play.label))bits.push(play.yards+' yd');
    }else{
      if(play.points)bits.push(play.points+(play.points===1?' run':' runs'));
      if(play.outs)bits.push(play.outs+(play.outs===1?' out':' outs'));
    }
    return bits.join(' · ');
  }

  return {sports, football, footballStats, diamond, sides, batting, clock, clockText, suggest, replay, tables, playContext, playLabel};
});
