(() => {
  const host = document.getElementById('gameCenter');
  const filters = document.getElementById('gameFilters');
  const scope = document.getElementById('gameScope');
  const sport = document.getElementById('gameSport');
  const notice = document.getElementById('gameNotice');
  const sections = document.getElementById('gameSections');
  const requestedMatch = new URLSearchParams(location.search).get('match');
  const detail = /^[A-Z0-9]{6}$/.test(requestedMatch || '') ? requestedMatch : '';
  const sports = {basketball:'Basketball', soccer:'Soccer', volleyball:'Volleyball'};
  const groups = [
    ['live', 'Live now', 'updated_at', false],
    ['upcoming', 'Upcoming', 'scheduled_at', true],
    ['final', 'Recent finals', 'final_at', false]
  ];
  const fields = 'id,sport,status,teams,home_score,away_score,period,scheduled_at,final_at,updated_at';
  const week = 7 * 86400000;
  const date = new Intl.DateTimeFormat(undefined, {dateStyle:'medium', timeStyle:'short'});
  const defaults = {name:'Jefferson', conference:'NIC-10', association:'IHSA'};
  let rows = [];
  let account = '';
  let teams = [defaults];
  let loaded = false;
  let busy = false;
  let loadError = false;
  let lastRender = '';

  function element(tag, label, className) {
    const node = document.createElement(tag);
    if (label) node.textContent = label;
    if (className) node.className = className;
    return node;
  }

  function preferences(kind) {
    return new Map(teams.filter(team => team[kind]).map(team => [Affiliations.key(team[kind]), team[kind]]));
  }

  function matches(game) {
    if (sport.value !== 'all' && game.sport !== sport.value) return false;
    if (scope.value === 'all') return true;
    const sides = Object.values(game.teams);
    if (scope.value === 'mine') {
      const myTeams = new Set(teams.map(team => Affiliations.teamKey(team.name)));
      return sides.some(team => myTeams.has(Affiliations.teamKey(team.name)));
    }
    const values = preferences(scope.value);
    return sides.some(team => values.has(Affiliations.key(
      team[scope.value] ?? Affiliations.defaults(team.name)[scope.value]
    )));
  }

  function card(game) {
    const article = element('article', '', 'game-card');
    const info = [sports[game.sport]];
    if (game.sport === 'volleyball' && game.status !== 'upcoming') info.push('Sets won');
    if (game.status === 'upcoming') info.push(date.format(new Date(game.scheduled_at)));
    if (game.status === 'final') info.push(date.format(new Date(game.final_at)));
    if (game.status === 'live') {
      const period = {basketball:'Period', soccer:'Half', volleyball:'Set'}[game.sport];
      info.push(period+' '+game.period);
    }
    article.append(element('p', info.join(' · '), 'game-meta'));
    for (const side of ['away', 'home']) {
      const line = element('div', '', 'game-team');
      line.append(element('span', game.teams[side].name));
      if (game.status !== 'upcoming') line.append(element('strong', String(game[side+'_score'])));
      article.append(line);
    }
    if (!detail) {
      const link = element('a', game.status === 'upcoming' ? 'Game details' : 'View scoreboard');
      const path = game.status === 'upcoming' || game.sport === 'volleyball' ? './?match=' :
        game.sport === 'soccer' ? 'soccer-broadcast.html?game=' : 'basketball.html?game=';
      link.href = path+encodeURIComponent(game.id);
      article.append(link);
    } else if (game.status !== 'upcoming' && game.sport !== 'volleyball') {
      const link = element('a', 'Open scoreboard');
      link.href = (game.sport === 'soccer' ? 'soccer-broadcast.html' : 'basketball.html')+'?game='+encodeURIComponent(game.id);
      article.append(link);
    }
    return article;
  }

  function render() {
    const visible = detail ? rows : rows.filter(matches);
    const signature = JSON.stringify([visible, loaded, loadError, scope.value, sport.value]);
    if (signature === lastRender) return;
    lastRender = signature;
    notice.textContent = loadError ? (loaded ? 'Refresh failed. Last loaded scores are shown.' : 'Scores are temporarily unavailable. Retrying…') :
      !loaded ? 'Loading public games…' : !visible.length ?
      (detail ? 'This public game is unavailable.' : 'No public games match these filters.') : '';
    if (!loaded) return;
    sections.replaceChildren();
    for (const [status, title] of groups) {
      const games = visible.filter(game => game.status === status);
      if (!games.length && detail) continue;
      const section = element('section', '', 'game-group');
      section.append(element('h2', title));
      if (games.length) {
        const grid = element('div', '', 'game-grid');
        games.forEach(game => grid.append(card(game)));
        section.append(grid);
      } else {
        section.append(element('p', {
          live:'No games live right now.',
          upcoming:'No public games scheduled in the next 7 days.',
          final:'No public finals in the past 7 days.'
        }[status], 'game-meta'));
      }
      sections.append(section);
    }
  }

  async function readGroup(viewer, [status, , column, ascending], now) {
    const games = [];
    for (let offset = 0; ; offset += 100) {
      let query = viewer.from('game_center_games').select(fields).eq('status', status);
      if (status === 'upcoming') query = query.gte(column, new Date(now).toISOString()).lte(column, new Date(now+week).toISOString());
      else query = query.gte(column, new Date(now-(status === 'live' ? 12*3600000 : week)).toISOString());
      const {data, error} = await query.order(column, {ascending}).order('id').range(offset, offset+99);
      if (error) throw error;
      games.push(...data);
      if (data.length < 100) return games;
    }
  }

  async function refresh() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const viewer = Live.viewer;
      if (!viewer) throw Error('Public scores unavailable.');
      if (detail) {
        const game = await Live.read(viewer, 'game_center_games', detail);
        rows = game ? [game] : [];
      } else {
        const now = Date.now();
        const games = (await Promise.all(groups.map(group => readGroup(viewer, group, now)))).flat();
        rows = [...new Map(games.map(game => [game.id, game])).values()];
      }
      loaded = true;
      loadError = false;
    } catch {
      loadError = true;
    } finally {
      busy = false;
      render();
    }
  }

  function storageKey() { return 'lls-game-center-scope-'+(account || 'guest'); }

  function applyBrands({owner, phase}) {
    const newAccount = owner || '';
    const changed = newAccount !== account;
    let choice = scope.value;
    account = newAccount;
    if (changed || phase === 'ready') {
      try { choice = localStorage.getItem(storageKey()) || 'mine'; } catch { choice = 'mine'; }
    }
    const brands = TeamBrands.list();
    teams = brands.length ? brands : [defaults];
    for (const kind of ['conference','association']) {
      const option = scope.querySelector('option[value="'+kind+'"]');
      const labels = [...preferences(kind).values()];
      option.textContent = labels.length === 1 ? labels[0] : kind === 'conference' ? 'My Conferences' : 'My Associations';
      option.disabled = !labels.length;
    }
    const selected = Array.from(scope.options).find(option => option.value === choice && !option.disabled);
    scope.value = selected?.value || 'mine';
    render();
  }

  if (detail) {
    filters.hidden = true;
    host.querySelector('h1').textContent = 'Public scoreboard';
    host.querySelector('.game-intro').textContent = 'Published by a Larson Live Stats scorer.';
    host.querySelector('.game-back').hidden = false;
  } else {
    try { scope.value = localStorage.getItem(storageKey()) || 'mine'; } catch {}
    TeamBrands.subscribe(applyBrands);
    TeamBrands.connect(Live.client);
    scope.addEventListener('change', () => {
      try { localStorage.setItem(storageKey(), scope.value); } catch {}
      render();
    });
    sport.addEventListener('change', render);
  }
  render();
  refresh();
  setInterval(refresh, 5000);
  window.addEventListener('online', refresh);
  document.addEventListener('visibilitychange', refresh);
})();
