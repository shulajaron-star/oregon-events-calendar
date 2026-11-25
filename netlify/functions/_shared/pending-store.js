// Read and write the harvest's pending list (data/events-pending.json) and the
// list of rejected events (data/events-rejected.json) through the GitHub API.
const { matchKey } = require('./match-key');

const repoOwner = () => process.env.GITHUB_OWNER || 'shulajaron-star';
const repoName = () => process.env.GITHUB_REPO || 'oregon-events-calendar';

function headers() {
  return {
    'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'Oregon Events Admin'
  };
}

async function readJson(path, fallback) {
  const res = await fetch(
    `https://api.github.com/repos/${repoOwner()}/${repoName()}/contents/${path}?ref=main`,
    { headers: headers() }
  );
  if (res.status === 404) return { data: fallback, sha: null };
  if (!res.ok) throw new Error(`Failed to read ${path}: ${res.status}`);
  const file = await res.json();
  return { data: JSON.parse(Buffer.from(file.content, 'base64').toString('utf-8')), sha: file.sha };
}

async function writeJson(path, data, sha, message) {
  const res = await fetch(
    `https://api.github.com/repos/${repoOwner()}/${repoName()}/contents/${path}`,
    {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({
        message,
        content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
        ...(sha ? { sha } : {}),
        branch: 'main'
      })
    }
  );
  if (!res.ok) throw new Error(`Failed to write ${path}: ${res.status} ${await res.text()}`);
}

// Remove one event from the pending list. Returns the removed event, or null.
// Retries once if the file changed underneath us.
async function removeFromPending(eventId, reason) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, sha } = await readJson('data/events-pending.json', { events: [] });
    const events = data.events || [];
    const removed = events.find(e => e.id === eventId);
    if (!removed) return null;
    try {
      await writeJson(
        'data/events-pending.json',
        { ...data, events: events.filter(e => e.id !== eventId) },
        sha,
        `Pending: ${reason} ${removed.title}`
      );
      return removed;
    } catch (err) {
      if (attempt === 1 || !/409|422/.test(err.message)) throw err;
    }
  }
  return null;
}

// Remember a rejected event so future harvests skip it.
async function rememberRejected(ev) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, sha } = await readJson('data/events-rejected.json', { events: [] });
    const list = data.events || [];
    const key = matchKey(ev.title, ev.start);
    if (list.some(r => r.id === ev.id || r.key === key)) return;
    list.push({
      id: ev.id,
      key,
      title: ev.title,
      start: ev.start,
      organizer: ev.organizer,
      rejected_on: new Date().toISOString().slice(0, 10)
    });
    try {
      await writeJson('data/events-rejected.json', { ...data, events: list }, sha, `Rejected: ${ev.title}`);
      return;
    } catch (err) {
      if (attempt === 1 || !/409|422/.test(err.message)) throw err;
    }
  }
}

module.exports = { readJson, removeFromPending, rememberRejected, matchKey };
