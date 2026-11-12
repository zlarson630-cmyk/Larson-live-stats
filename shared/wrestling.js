(function (root) {
  'use strict';

  const weights = {
    boys: [106, 113, 120, 126, 132, 138, 144, 150, 157, 165, 175, 190, 215, 285],
    girls: [100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 155, 170, 190, 235]
  };
  const periods = [
    ['Period 1', 120], ['Period 2', 120], ['Period 3', 120], ['Sudden victory', 60],
    ['Tiebreaker 1', 30], ['Tiebreaker 2', 30], ['Ultimate tiebreaker', 30]
  ];
  const moves = {
    takedown: ['Takedown', 3], escape: ['Escape', 1], reversal: ['Reversal', 2],
    near2: ['Near fall', 2], near3: ['Near fall', 3], near4: ['Near fall', 4], near5: ['Near fall', 5],
    penalty1: ['Penalty', 1], penalty2: ['Penalty', 2]
  };
  const results = {
    decision: ['Decision', 3], major: ['Major decision', 4], technical: ['Technical fall', 5],
    fall: ['Fall', 6], forfeit: ['Forfeit', 6], default: ['Injury default', 6],
    dq: ['Disqualification', 6], double: ['Double forfeit', 0]
  };
  const sides = ['home', 'away'];

  function createDual(home, away, division, firstWeight, id) {
    home = home.trim();
    away = away.trim();
    const classes = Object.hasOwn(weights, division) ? weights[division] : [];
    const start = classes.indexOf(Number(firstWeight));
    if (!home || !away || home.toLowerCase() === away.toLowerCase() || start < 0) {
      throw Error('Enter two different teams and select a starting weight.');
    }
    return {
      id, home, away, division, finished: false, adjustments: [],
      active: classes[start], updated: Date.now(),
      bouts: [...classes.slice(start), ...classes.slice(0, start)].map(weight => ({
        weight, home: '', away: '', period: 0, remaining: 120000, deadline: null, events: [], result: null
      }))
    };
  }

  function timeLeft(bout, now = Date.now()) {
    return bout.deadline === null ? bout.remaining : Math.max(0, bout.deadline - now);
  }

  function boutScore(bout) {
    const score = { home: 0, away: 0 };
    for (const { side, move } of bout.events) score[side] += moves[move][1];
    return score;
  }

  function dualScore(dual) {
    const score = { home: 0, away: 0 };
    for (const { result } of dual.bouts) {
      if (result?.side) score[result.side] += results[result.type][1];
    }
    for (const { side, points } of dual.adjustments) score[side] += points;
    return score;
  }

  function award(bout, side, move, now = Date.now()) {
    if (bout.result || !sides.includes(side) || !Object.hasOwn(moves, move)) return false;
    bout.events.push({ side, move, period: bout.period, remaining: timeLeft(bout, now) });
    return true;
  }

  function recordResult(bout, type, side, now = Date.now()) {
    if (bout.result) throw Error('Reopen the bout to change its result.');
    if (!Object.hasOwn(results, type)) throw Error('Select the official result.');
    if (type === 'double') side = null;
    else if (!sides.includes(side)) throw Error('Select the winning team.');

    const score = boutScore(bout);
    const margin = side === 'home' ? score.home - score.away : score.away - score.home;
    if (type === 'decision' || type === 'major') {
      if (margin < 1) throw Error('The selected winner must lead the bout score.');
      if (margin >= 15) throw Error('Record the technical fall or fall called by the official.');
      type = margin >= 8 ? 'major' : 'decision';
    }
    if (type === 'technical' && margin < 15) throw Error('A technical fall requires a lead of at least 15 points.');
    bout.remaining = timeLeft(bout, now);
    bout.deadline = null;
    bout.result = { type, side };
  }

  function periodScores(bout) {
    const scores = Array.from({ length: 4 }, () => ({ home: 0, away: 0 }));
    for (const { side, move, period } of bout.events) scores[Math.min(period, 3)][side] += moves[move][1];
    return scores;
  }

  function dualBoxScore(dual) {
    const team = () => ({ wins: 0, fall: 0, technical: 0, major: 0, decision: 0, other: 0, adjustment: 0 });
    const totals = dualScore(dual);
    const box = { home: team(), away: team() };
    for (const { result } of dual.bouts) {
      if (!result?.side) continue;
      const team = box[result.side];
      team.wins++;
      const column = Object.hasOwn(team, result.type) ? result.type : 'other';
      team[column]++;
    }
    for (const { side, points } of dual.adjustments) box[side].adjustment += points;
    for (const side of sides) box[side].points = totals[side];
    return box;
  }

  function createMidDualDemo() {
    const meet = createDual('Prairie Falcons', 'River Otters', 'girls', 130, 'practice-mid-dual');
    const lineup = [
      ['Morgan Hall', 'Jordan Lee'], ['Jamie Cole', 'Riley West'], ['Drew Lane', 'Taylor Park'],
      ['Skyler Reed', 'Peyton Ellis'], ['Rowan Shaw', 'Casey Quinn'], ['Avery Gray', 'Sam Brooks'],
      ['Rory Bell', 'Kendall Fox'], ['Blair Ross', 'Harper Wells'], ['Cameron Hill', 'Charlie King'],
      ['Emerson Price', 'Quinn Rivers'], ['Sydney Green', 'Reese Clark'], ['Dakota James', 'Logan Ford'],
      ['Alex Blake', 'Jules Stone'], ['Dylan Scott', 'Marlowe Wood']
    ];
    const resultsSoFar = [
      ['home', 'fall', 0, 43, [['home', 'takedown', 0, 92]]],
      ['away', 'decision', 2, 0, [['away', 'takedown', 0, 81], ['home', 'escape', 1, 96], ['away', 'escape', 2, 41]]],
      ['home', 'decision', 2, 0, [['home', 'takedown', 0, 93], ['home', 'near4', 0, 80], ['home', 'reversal', 2, 52]]],
      ['away', 'fall', 1, 35, [['away', 'takedown', 0, 55], ['home', 'escape', 1, 85], ['away', 'takedown', 1, 42]]],
      ['away', 'technical', 2, 19, [['away', 'takedown', 0, 97], ['away', 'near4', 0, 78], ['away', 'near4', 1, 84], ['away', 'near4', 2, 19]]],
      ['home', 'decision', 2, 0, [['away', 'takedown', 0, 66], ['home', 'escape', 0, 48], ['home', 'reversal', 1, 72], ['home', 'escape', 2, 33]]],
      ['home', 'fall', 0, 61, [['home', 'takedown', 0, 80]]],
      ['away', 'decision', 2, 0, [['home', 'takedown', 0, 90], ['away', 'escape', 0, 66], ['away', 'takedown', 2, 34]]],
      ['away', 'decision', 2, 0, [['away', 'takedown', 0, 95], ['away', 'near3', 0, 77], ['away', 'near3', 1, 37], ['home', 'escape', 2, 69]]]
    ];
    function stage(bout, period, seconds, events) {
      for (const [side, move, eventPeriod, eventSeconds] of events) {
        bout.period = eventPeriod;
        bout.remaining = eventSeconds * 1000;
        award(bout, side, move);
      }
      bout.period = period;
      bout.remaining = seconds * 1000;
    }
    meet.bouts.forEach((bout, index) => { [bout.home, bout.away] = lineup[index]; });
    resultsSoFar.forEach(([winner, type, period, seconds, events], index) => {
      const bout = meet.bouts[index];
      stage(bout, period, seconds, events);
      recordResult(bout, type, winner);
    });
    const current = meet.bouts[resultsSoFar.length];
    stage(current, 1, 47, [['home', 'takedown', 0, 91], ['away', 'escape', 0, 78], ['away', 'escape', 1, 93]]);
    meet.active = current.weight;
    return meet;
  }

  const api = { weights, periods, moves, results, sides, createDual, timeLeft, boutScore, dualScore, award, recordResult, periodScores, dualBoxScore, createMidDualDemo };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LarsonWrestling = api;
})(globalThis);
