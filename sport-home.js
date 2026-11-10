(() => {
 const sports = {
  soccer: ['Soccer','⚽','soccer.html#setup','soccer.html#saved-matches','Set teams, rosters, and match clock','Find a match saved to your account'],
  volleyball: ['Volleyball','🏐','volleyball.html#setup','volleyball.html#scoreboard','Open match setup and new match controls','Return to the match saved on this device'],
  football: ['Football','🏈'],
  baseball: ['Baseball','⚾'],
  softball: ['Softball','🥎'],
 };
 const sport = new URLSearchParams(location.search).get('sport');
 if (!Object.hasOwn(sports,sport)) return;
 const [name,icon,setup,resume,newHint,resumeHint] = sports[sport];
 const get = id => document.getElementById(id);
 const scorer = 'field-sports.html?sport='+sport;
 document.title = name+' · Larson Live Stats';
 get('sportTitle').textContent = icon+' '+name;
 get('sportPrompt').textContent = 'What would you like to do?';
 get('newGameLink').href = setup||scorer+'&setup=1';
 get('resumeGameLink').href = resume||scorer;
 get('testGameLink').href = setup?setup.split('#')[0]+'?demo=1':scorer+'&demo=1';
 get('newGameHint').textContent = newHint||'Set teams and game options';
 get('resumeGameHint').textContent = resumeHint||'Return to the game saved on this device';
 get('sportChoices').hidden = false;
})();
