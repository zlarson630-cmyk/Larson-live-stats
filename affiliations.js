/* Northern Illinois member-school aliases for games without a saved team brand. */
window.Affiliations = (() => {
  const key = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const members = [
    ['Jefferson', 'Jefferson High School', 'Rockford Jefferson', 'Jefferson J-Hawks'],
    ['Auburn', 'Rockford Auburn', 'Auburn Knights'],
    ['Belvidere', 'Belvidere HS', 'Belvidere Bucs'],
    ['Belvidere North', 'Belvidere North Blue Thunder'],
    ['Boylan', 'Boylan Catholic', 'Rockford Boylan Catholic', 'Boylan Titans'],
    ['East', 'Rockford East', 'East E-Rabs'],
    ['Freeport', 'Freeport HS', 'Freeport Pretzels'],
    ['Guilford', 'Rockford Guilford', 'Guilford Vikings'],
    ['Harlem', 'Machesney Park Harlem', 'Harlem Huskies'],
    ['Hononegah', 'Rockton Hononegah', 'Hononegah Indians']
  ];
  const aliases = new Map(members.flatMap(names => names.map(name => [key(name), key(names[0])])));
  const teamKey = name => aliases.get(key(name)) || key(name);
  const defaults = name => aliases.has(key(name)) ? {conference:'NIC-10', association:'IHSA'} : {};
  return {key, teamKey, defaults};
})();
