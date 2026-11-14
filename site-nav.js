/* One destination per sport. Page-specific subnavigation stays with its workflow. */
(() => {
 const routes=[
  ['Basketball','basketball-home.html','basketball'],
  ['Soccer','sport-home.html?sport=soccer','soccer'],
  ['Volleyball','sport-home.html?sport=volleyball','volleyball'],
  ['Wrestling','wrestling.html','wrestling'],
  ['Football','sport-home.html?sport=football','football'],
  ['Baseball','sport-home.html?sport=baseball','baseball'],
  ['Softball','sport-home.html?sport=softball','softball'],
 ];
 const currentSport=new URLSearchParams(location.search).get('sport')||document.body.dataset.sport;
 function link(label,href,active){
  const a=document.createElement('a');
  a.href=href;
  a.textContent=label;
  if(active)a.setAttribute('aria-current','page');
  return a;
 }
 for(const nav of document.querySelectorAll('[data-site-nav]')){
  const variant=nav.dataset.siteNav;
  const current=nav.dataset.page;
  const sports=document.createElement('details');
  const summary=document.createElement('summary');
  summary.textContent='Sports';
  const selected=routes.find(route=>route[2]===currentSport);
  if(selected){
   const label=document.createElement('span');
   if(variant==='field')label.id='fieldNavSport';
   label.textContent=' · '+selected[0];
   summary.append(label);
  }else if(variant==='field'){
   const label=document.createElement('span');
   label.id='fieldNavSport';
   summary.append(label);
  }
  const menu=document.createElement('div');
  menu.className='sportsMenu';
  for(const [label,href,sport] of routes)menu.append(link(label,href,currentSport===sport&&current==='sport'));
  sports.append(summary,menu);
  nav.classList.add('navHierarchy');
  nav.setAttribute('aria-label',variant==='game'?'Game site menu':'Site navigation');
  nav.replaceChildren(link('Home','./',current==='home'),sports,
   link('Team Brands','brands.html',current==='brands'),link('My Profile','profile.html',current==='profile'));
  if(variant==='game')nav.append(link('Game Lobby','basketball.html'),link('Teams','basketball.html#teams'));
  nav.addEventListener('keydown',event=>{
   if(event.key==='Escape'&&sports.open){sports.open=false;summary.focus();}
  });
 }
})();
