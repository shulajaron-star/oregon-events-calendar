// This function fetches pending events and sources for admin review
const { readJson, matchKey } = require('./_shared/pending-store');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const githubToken = process.env.GITHUB_TOKEN;
    const repoOwner = process.env.GITHUB_OWNER || 'shulajaron-star';
    const repoName = process.env.GITHUB_REPO || 'oregon-events-calendar';

    if (!githubToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'GITHUB_TOKEN not configured' })
      };
    }

    // Fetch pending events and sources from GitHub
    const [pendingEventsResponse, pendingSourcesResponse] = await Promise.all([
      fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/data/events-pending.json`, {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Oregon Events Admin'
        }
      }),
      fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/data/sources_pending.json`, {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Oregon Events Admin'
        }
      })
    ]);

    let pendingEvents = { events: [] };
    let pendingSources = { sources: [] };

    // Parse pending events if file exists
    if (pendingEventsResponse.ok) {
      const data = await pendingEventsResponse.json();
      const content = Buffer.from(data.content, 'base64').toString();
      pendingEvents = JSON.parse(content);
    }

    // Parse pending sources if file exists
    if (pendingSourcesResponse.ok) {
      const data = await pendingSourcesResponse.json();
      const content = Buffer.from(data.content, 'base64').toString();
      pendingSources = JSON.parse(content);
    }

    // Hide anything already on the calendar or already rejected, even if the
    // pending file still lists it
    let pending = pendingEvents.events || [];
    try {
      const [calendar, rejected] = await Promise.all([
        readJson('data/events.json', { events: [] }),
        readJson('data/events-rejected.json', { events: [] })
      ]);
      const ids = new Set();
      const keys = new Set();
      for (const e of calendar.data.events || []) { ids.add(e.id); keys.add(matchKey(e.title, e.start)); }
      for (const r of rejected.data.events || []) { ids.add(r.id); keys.add(r.key); }
      pending = pending.filter(e => !ids.has(e.id) && !keys.has(matchKey(e.title, e.start)));
    } catch (filterError) {
      console.error('Could not filter pending events:', filterError);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        events: pending,
        sources: pendingSources.sources || []
      })
    };

  } catch (error) {
    console.error('Error fetching pending items:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch pending items',
        message: error.message
      })
    };
  }
};
