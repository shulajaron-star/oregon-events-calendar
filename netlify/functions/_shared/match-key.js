// Key for spotting the same event under a slightly different title or id:
// "Founder Coffee January 2027 | Beaverton" on 2027-01-13 matches
// "Founder Coffee - January 2027" on the same Pacific date.
function matchKey(title, start) {
  const base = (title || '').split('|')[0].toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return `${base}@${(start || '').slice(0, 10)}`;
}
module.exports = { matchKey };
