(() => {
  'use strict';

  const { weights, periods, moves, results, sides, createDual, timeLeft, boutScore, dualScore, award, recordResult } = window.LarsonWrestling;
  const get = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const demo = params.get('demo') === '1';
  const prefix = 'lls:wrestling:dual:v1:';
  let storage;
  let dual;
  let lastSaved = null;
  let panels = {};

  function element(tag, content, className) {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    if (className) node.className = className;
    return node;
  }

  function announce(message, error = false) {
    const status = get('message');
    status.textContent = message;
    status.classList.toggle('error', error);
  }

  function timeLabel(ms) {
    const seconds = Math.ceil(ms / 1000);
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }

  function show(section) {
    for (const id of ['lobby', 'setup', 'resume', 'scorer']) get(id).hidden = id !== section;
  }

  function read(raw) {
    const meet = JSON.parse(raw);
    return meet && weights[meet.division]?.length === meet.bouts?.length ? meet : null;
  }

  function save(meet) {
    const key = prefix + meet.id;
    const current = storage.getItem(key);
    if (current !== lastSaved) {
      const newer = read(current);
      if (newer) {
        lastSaved = current;
        dual = newer;
        render(true);
      }
      throw Error(newer ? 'Scores changed in another tab. Latest scores loaded. Try again.' : 'This dual was removed in another tab.');
    }
    meet.updated = Date.now();
    const json = JSON.stringify(meet);
    storage.setItem(key, json);
    lastSaved = json;
    dual = meet;
  }

  function active(meet = dual) {
    return meet.bouts.find(bout => bout.weight === meet.active);
  }

  function change(apply, options = {}) {
    try {
      const next = structuredClone(dual);
      apply(active(next), next);
      save(next);
      render(options.rebuild);
      announce(options.message || '');
      return true;
    } catch (error) {
      announce(error.message, true);
      return false;
    }
  }

  function showSaved() {
    const meets = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(prefix)) continue;
      try {
        const meet = read(storage.getItem(key));
        if (meet) meets.push(meet);
      } catch {
        // A damaged entry does not block the rest of the saved meets.
      }
    }
    get('saved').replaceChildren(...meets.sort((a, b) => b.updated - a.updated).map(meet => {
      const score = dualScore(meet);
      const row = element('article', undefined, 'saved');
      const link = element('a', meet.home + ' vs. ' + meet.away);
      link.href = '?' + new URLSearchParams({ dual: meet.id });
      row.append(link, element('p', (meet.finished ? 'Final' : 'In progress') + ' · ' + score.home + '–' + score.away
        + ' · ' + new Date(meet.updated).toLocaleDateString()));
      return row;
    }));
    if (!meets.length) get('saved').append(element('p', 'No dual meets saved yet.'));
    show('resume');
  }

  function createPanel(side) {
    const section = element('section', undefined, 'team ' + side);
    const header = element('div', undefined, 'heading');
    const points = element('output', '0', 'points');
    points.setAttribute('aria-label', dual[side] + ' bout score');
    header.append(element('h3', dual[side]), points);
    const label = element('label', 'Wrestler');
    const name = element('input');
    name.value = active()[side];
    name.placeholder = 'Name (optional)';
    name.maxLength = 60;
    name.addEventListener('change', () => {
      if (!change(bout => { bout[side] = name.value.trim(); })) name.value = active()[side];
    });
    label.append(name);
    const controls = element('div', undefined, 'score-buttons');
    for (const [move, [title, value]] of Object.entries(moves)) {
      const button = element('button', title + ' +' + value);
      button.type = 'button';
      button.setAttribute('aria-label', dual[side] + ' ' + button.textContent);
      button.addEventListener('click', () => change(bout => award(bout, side, move)));
      controls.append(button);
    }
    section.append(header, label, controls);
    panels[side] = { name, points, controls };
    return section;
  }

  function nextOpen() {
    const start = dual.bouts.findIndex(bout => bout.weight === dual.active);
    return [...dual.bouts.slice(start + 1), ...dual.bouts.slice(0, start)].find(bout => !bout.result);
  }

  function describe(bout) {
    if (!bout.result) return '—';
    const { type, side } = bout.result;
    const label = (side ? dual[side] + ' · ' : '') + results[type][0];
    return ['fall', 'technical', 'default', 'dq'].includes(type)
      ? label + ' · ' + periods[bout.period][0] + ', ' + timeLabel(bout.remaining) + ' left'
      : label;
  }

  function renderClock() {
    const bout = active();
    const remaining = timeLeft(bout);
    const running = bout.deadline !== null && remaining > 0;
    const locked = dual.finished || Boolean(bout.result);
    const input = get('clock');
    input.readOnly = running || locked;
    if (document.activeElement !== input || input.readOnly) input.value = timeLabel(remaining);
    get('timer').textContent = running ? 'Stop clock' : 'Start clock';
    get('timer').disabled = locked || !remaining;
    get('period').disabled = running || locked;
  }

  function render(rebuild = false) {
    const bout = active();
    const score = boutScore(bout);
    const locked = dual.finished || Boolean(bout.result);
    const completed = dual.bouts.filter(item => item.result).length;
    if (rebuild) {
      get('scoring').replaceChildren(...sides.map(createPanel));
      get('result').open = false;
      get('log').open = false;
      get('resultForm').reset();
      get('winner').disabled = false;
    }
    get('boutTitle').textContent = bout.weight + ' lb bout';
    get('bout').value = bout.weight;
    get('period').value = bout.period;
    get('undo').disabled = locked || !bout.events.length;
    get('next').disabled = !nextOpen();
    get('reopen').hidden = dual.finished || !bout.result;
    get('result').hidden = locked;
    get('resultText').hidden = !bout.result;
    get('resultText').textContent = bout.result ? describe(bout) : '';
    get('log').hidden = !bout.events.length;
    get('events').replaceChildren(...[...bout.events].reverse().map(event => {
      const [label, value] = moves[event.move];
      return element('li', dual[event.side] + ' · ' + label + ' +' + value + ' · '
        + periods[event.period][0] + ', ' + timeLabel(event.remaining) + ' left');
    }));
    for (const side of sides) {
      const panel = panels[side];
      if (panel.points.value !== String(score[side])) panel.points.value = score[side];
      panel.name.readOnly = locked;
      for (const button of panel.controls.children) button.disabled = locked;
    }
    const totals = dualScore(dual);
    get('dualScore').replaceChildren(...sides.map(side => {
      const team = element('div', undefined, 'dual team ' + side);
      team.append(element('span', dual[side]), element('strong', totals[side], 'points'));
      return team;
    }));
    get('progress').textContent = (demo ? 'Test game · ' : '') + 'IHSA ' + dual.division + ' · '
      + (dual.finished ? 'Final' : completed + ' of ' + dual.bouts.length + ' bouts recorded');
    get('rows').replaceChildren(...dual.bouts.map(item => {
      const row = element('tr', undefined, item.weight === dual.active ? 'current' : '');
      const weight = element('th');
      weight.scope = 'row';
      const link = element('a', item.weight + ' lb');
      link.href = '#boutPanel';
      link.addEventListener('click', event => {
        if (!selectBout(item.weight)) event.preventDefault();
      });
      weight.append(link);
      const score = boutScore(item);
      const hasScore = item.events.length || (item.result && !['forfeit', 'double'].includes(item.result.type));
      row.append(weight, element('td', item.home || '—'), element('td', item.away || '—'),
        element('td', hasScore ? score.home + '–' + score.away : '—'), element('td', describe(item)),
        element('td', item.result ? results[item.result.type][1] : '—'));
      return row;
    }));
    get('adjustments').replaceChildren(...dual.adjustments.map(({ side, points, reason }) =>
      element('li', dual[side] + ' ' + (points > 0 ? '+' : '') + points + ' · ' + reason)));
    get('adjustControls').hidden = dual.finished;
    get('undoAdjustment').disabled = !dual.adjustments.length;
    get('finish').disabled = !dual.finished && completed < dual.bouts.length;
    get('finish').textContent = dual.finished ? 'Reopen dual meet' : 'Finalize dual meet';
    renderClock();
  }

  function selectBout(weight) {
    if (weight === dual.active) return true;
    const bout = active();
    if (bout.deadline !== null && timeLeft(bout) > 0) {
      announce('Stop the clock before switching bouts.', true);
      get('bout').value = dual.active;
      return false;
    }
    const changed = change((_, meet) => { meet.active = weight; }, { rebuild: true });
    if (!changed) get('bout').value = dual.active;
    return changed;
  }

  function open(meet) {
    dual = meet;
    get('matchup').textContent = meet.home + ' vs. ' + meet.away;
    get('homeColumn').textContent = meet.home;
    get('awayColumn').textContent = meet.away;
    get('bout').replaceChildren(...meet.bouts.map(bout => new Option(bout.weight + ' lb', bout.weight)));
    get('winner').replaceChildren(new Option('Choose team', ''), ...sides.map(side => new Option(meet[side], side)));
    get('adjustTeam').replaceChildren(...sides.map(side => new Option(meet[side], side)));
    show('scorer');
    render(true);
    setInterval(renderClock, 150);
  }

  function fillWeights() {
    get('starting').replaceChildren(...weights[get('division').value].map(weight => new Option(weight + ' lb', weight)));
  }

  get('division').addEventListener('change', fillWeights);
  get('newDual').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const values = ['home', 'away', 'division', 'starting'].map(id => get(id).value);
      const meet = createDual(...values, crypto.randomUUID());
      save(meet);
      location.assign('?' + new URLSearchParams({ dual: meet.id }));
    } catch (error) {
      announce(error.message, true);
    }
  });

  get('period').replaceChildren(...periods.map(([label], index) => new Option(label, index)));
  get('period').addEventListener('change', () => {
    const period = Number(get('period').value);
    if (!change(bout => {
      bout.period = period;
      bout.deadline = null;
      bout.remaining = periods[period][1] * 1000;
    })) get('period').value = active().period;
  });
  get('clock').addEventListener('change', event => {
    const match = /^(\d{1,2}):([0-5]\d)$/.exec(event.target.value.trim());
    if (!match) {
      announce('Enter minutes and seconds, such as 1:30.', true);
      event.target.value = timeLabel(timeLeft(active()));
      return;
    }
    if (!change(bout => {
      bout.deadline = null;
      bout.remaining = (Number(match[1]) * 60 + Number(match[2])) * 1000;
    })) event.target.value = timeLabel(timeLeft(active()));
  });
  get('clock').addEventListener('keydown', event => {
    if (event.key === 'Enter') event.target.blur();
  });
  get('timer').addEventListener('click', () => change(bout => {
    const now = Date.now();
    bout.remaining = timeLeft(bout, now);
    bout.deadline = bout.deadline === null && bout.remaining ? now + bout.remaining : null;
  }));
  get('bout').addEventListener('change', () => selectBout(Number(get('bout').value)));
  get('next').addEventListener('click', () => {
    const next = nextOpen();
    if (next) selectBout(next.weight);
  });
  get('undo').addEventListener('click', () => change(bout => bout.events.pop(), { message: 'Last score undone.' }));
  get('outcome').replaceChildren(...Object.entries(results).filter(([type]) => type !== 'major')
    .map(([type, [label]]) => new Option(type === 'decision' ? 'Decision / major decision' : label, type)));
  get('outcome').addEventListener('change', () => {
    get('winner').disabled = get('outcome').value === 'double';
    if (get('winner').disabled) get('winner').value = '';
  });
  get('resultForm').addEventListener('submit', event => {
    event.preventDefault();
    change(bout => recordResult(bout, get('outcome').value, get('winner').value), { message: 'Bout result saved.' });
  });
  get('reopen').addEventListener('click', () => change(bout => { bout.result = null; },
    { rebuild: true, message: 'Bout reopened. Its team points were removed.' }));
  get('adjustForm').addEventListener('submit', event => {
    event.preventDefault();
    const points = get('adjustPoints').valueAsNumber;
    const reason = get('adjustReason').value.trim();
    if (!Number.isInteger(points) || points === 0 || !reason) {
      announce('Enter a nonzero team point adjustment and a reason.', true);
      return;
    }
    if (change((_, meet) => meet.adjustments.push({ side: get('adjustTeam').value, points, reason }),
      { message: 'Team point adjustment saved.' })) event.target.reset();
  });
  get('undoAdjustment').addEventListener('click', () => change((_, meet) => meet.adjustments.pop(),
    { message: 'Last adjustment undone.' }));
  get('finish').addEventListener('click', () => change((_, meet) => { meet.finished = !meet.finished; }));
  get('print').addEventListener('click', () => window.print());

  try {
    storage = demo ? sessionStorage : localStorage;
    if (demo) {
      lastSaved = storage.getItem(prefix + 'practice');
      let meet = read(lastSaved);
      if (!meet) {
        meet = createDual('Prairie Falcons', 'River Otters', 'girls', 120, 'practice');
        const bout = active(meet);
        bout.home = 'Morgan Hall';
        bout.away = 'Jordan Lee';
        award(bout, 'home', 'takedown');
        award(bout, 'away', 'escape');
        save(meet);
      }
      open(meet);
    } else if (params.has('dual')) {
      lastSaved = storage.getItem(prefix + params.get('dual'));
      const meet = read(lastSaved);
      if (meet) open(meet);
      else {
        showSaved();
        announce('That dual meet was not found in this browser.', true);
      }
    } else if (params.has('resume')) showSaved();
    else if (params.has('new')) {
      fillWeights();
      show('setup');
    }
  } catch {
    show('lobby');
    announce('Saved dual meets are unavailable in this browser.', true);
  }
})();
