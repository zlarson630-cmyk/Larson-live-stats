(() => {
  'use strict';

  const page = location.pathname.split('/').pop() || 'index.html';
  const supportEmail = 'zlarson630@gmail.com';
  const starting = ['How do I start a game?', 'Choose your sport from Home and follow its game setup. For basketball, use Quick Game for a fast setup or Resume Game to open a saved game.'];
  const saved = ['Where are my saved games?', 'Sign in with the account you used to create the game, then open My Games. Browser-only games are available on the device and browser where you started them.'];
  const basketball = [
    ['What are the basketball shortcuts?', 'On a computer, press Space or F8 to start or stop the clock, H for home or V for visitor, J for a two-pointer, Y for a three-pointer, E for a free throw, L for layup, U for dunk, and I for Full Suite substitutions. Enter jerseys with two digits, such as 05. Open Quick guide & keyboard commands in the scorer for the full list.'],
    ['How do I correct a play?', 'Use Backspace while entering a play. In Last five plays, click a timestamp, shot value, or jersey to correct it. Click Add steal on a turnover or the rebound chip to change its credit. Use Undo last play to remove the latest play or Game Flow to review older plays.'],
    ['What if a save can’t be confirmed?', 'When your connection returns, choose Check and retry. The scorer checks whether the original action saved before trying it again. If you reload, review the last action in Game Flow before re-entering it.'],
    ['How do I get a box score?', 'Open PDF reports in the scorer and choose One-page PDF or Full stats PDF. You can download a report during the game or after it ends.'],
  ];
  const topics = {
    'basketball.html': basketball,
    'basketball-home.html': [starting, saved, basketball[3]],
    'basketball-operator.html': [
      ['How do I control the graphics?', 'Sign in with the account authorized for this game. Choose the graphic in the operator controls, then open the OBS scorebug to get the browser-source URL.'],
    ],
    'brands.html': [
      ['How do I reuse team colors and logos?', 'Save the school’s colors, logos, and uniforms in Team Brands, then select the brand when setting up a game.'],
    ],
    'schedule.html': [
      ['Where do I find a scheduled game?', 'Open Schedule to review upcoming games. Use My Games to find the game once it has been created.'],
    ],
    'profile.html': [saved],
    'quick-game.html': [starting, saved],
    'soccer.html': [
      ['How do I score a soccer match?', 'Set up the teams, open the match, and use the scorer controls to manage the clock and record goals and other events. Use the report controls to download the match summary.'],
    ],
    'soccer-broadcast.html': [
      ['Where do I find the on-air graphic?', 'Open the match’s overlay link from the scorer to get the OBS browser-source URL. The Broadcast Center is for following the match.'],
    ],
    'volleyball.html': [
      ['How do I record a rally?', 'Award the point to the team that won the rally. Check the score and serving team at stoppages, and use Undo if you award a point to the wrong side.'],
    ],
    'wrestling.html': [
      ['How do I see the dual results?', 'The dual overview tracks the team score. Open the results to review the completed bouts and the points they added to the dual.'],
    ],
    'field-sports.html': [
      ['Where are my game and report saved?', 'These games are saved in this browser. Use One-page PDF to download a report, or open the Broadcast Center in another tab on this device.'],
    ],
    'games.html': [
      ['How do I follow a game?', 'Choose a game in Public Scores to open its live score.'],
    ],
    'view.html': [
      ['Can I score from this screen?', 'This is a public scoreboard. To record plays, open the scorer for your sport and sign in with the account that has scoring access.'],
    ],
  };
  const questions = topics[page] || [starting, saved];

  const button = document.createElement('button');
  button.className = 'lls-help-launch';
  button.type = 'button';
  button.textContent = 'Help';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'lls-help');

  const dialog = document.createElement('dialog');
  dialog.id = 'lls-help';
  dialog.className = 'lls-help';
  dialog.setAttribute('aria-labelledby', 'lls-help-title');

  const header = document.createElement('header');
  const heading = document.createElement('h2');
  heading.id = 'lls-help-title';
  heading.textContent = 'Help';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Close';
  close.autofocus = true;
  header.append(heading, close);
  dialog.append(header);

  for (const [question, answer] of questions) {
    const item = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = question;
    const description = document.createElement('p');
    description.textContent = answer;
    item.append(summary, description);
    dialog.append(item);
  }

  if (supportEmail) {
    const contact = document.createElement('a');
    contact.className = 'lls-help-contact';
    contact.href = 'mailto:' + supportEmail + '?subject=' + encodeURIComponent('Larson Live Stats help');
    contact.textContent = 'Email the creator';
    dialog.append(contact);
  }

  button.addEventListener('keydown', event => event.stopPropagation());
  button.addEventListener('click', () => dialog.showModal());
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => button.focus({ preventScroll: true }));
  dialog.addEventListener('keydown', event => event.stopPropagation());
  document.body.append(button, dialog);
})();
