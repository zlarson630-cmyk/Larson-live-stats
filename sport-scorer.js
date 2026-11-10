/* Scorer-only tabs. The broadcast page keeps its complete read-only view. */
(() => {
 for (const root of document.querySelectorAll('[data-scorer-views]')) {
  const tabs = root.querySelector('[data-scorer-tabs]');
  const buttons = [...tabs.querySelectorAll('[data-scorer-tab]')];
  const panels = [...root.querySelectorAll('[data-scorer-panel]')];
  if (document.body.classList.contains('broadcast')) {
   tabs.hidden = true;
   continue;
  }
  function show(button) {
   for (const tab of buttons) tab.setAttribute('aria-pressed', String(tab === button));
   for (const panel of panels) {
    panel.classList.toggle('sport-tab-inactive', panel.dataset.scorerPanel !== button.dataset.scorerTab);
   }
  }
  for (const button of buttons) button.addEventListener('click', () => show(button));
  show(buttons[0]);
 }
})();
