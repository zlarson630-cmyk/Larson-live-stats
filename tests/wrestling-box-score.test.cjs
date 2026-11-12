const assert = require('node:assert/strict');
const test = require('node:test');
const { createDual, award, recordResult, periodScores, dualBoxScore } = require('../shared/wrestling.js');

test('period points preserve side and combine all overtime scoring', () => {
  const [bout] = createDual('Home', 'Away', 'boys', 106, 'test').bouts;
  award(bout, 'away', 'takedown');
  bout.period = 1;
  award(bout, 'home', 'escape');
  bout.period = 4;
  award(bout, 'away', 'escape');
  bout.period = 5;
  award(bout, 'home', 'takedown');
  assert.deepEqual(periodScores(bout), [
    { home: 0, away: 3 }, { home: 1, away: 0 }, { home: 0, away: 0 }, { home: 3, away: 1 }
  ]);
});

test('team summary includes official wins and adjustments but excludes unfinished bouts and double forfeits', () => {
  const dual = createDual('Home', 'Away', 'girls', 100, 'test');
  const [fall, forfeit, double, pending] = dual.bouts;
  recordResult(fall, 'fall', 'home');
  recordResult(forfeit, 'forfeit', 'away');
  recordResult(double, 'double');
  award(pending, 'home', 'takedown');
  dual.adjustments.push({ side: 'home', points: -1, reason: 'Official adjustment' });
  assert.deepEqual(dualBoxScore(dual), {
    home: { wins: 1, fall: 1, technical: 0, major: 0, decision: 0, other: 0, adjustment: -1, points: 5 },
    away: { wins: 1, fall: 0, technical: 0, major: 0, decision: 0, other: 1, adjustment: 0, points: 6 }
  });
});
