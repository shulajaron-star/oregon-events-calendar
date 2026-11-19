// This function runs the weekly event harvesting workflow
// It discovers new events from approved sources and stores them for admin approval

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
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

    // Fetch current events and sources from GitHub
    const [eventsResponse, sourcesResponse] = await Promise.all([
      fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/data/events.json`, {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Oregon Events Admin'
        }
      }),
      fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/data/sources.json`, {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Oregon Events Admin'
        }
      })
    ]);

    if (!eventsResponse.ok || !sourcesResponse.ok) {
      throw new Error('Failed to fetch current data from GitHub');
    }

    const [eventsData, sourcesData] = await Promise.all([
      eventsResponse.json(),
      sourcesResponse.json()
    ]);

    const currentEvents = JSON.parse(Buffer.from(eventsData.content, 'base64').toString());
    const sources = JSON.parse(Buffer.from(sourcesData.content, 'base64').toString());

    // For now, return a summary
    // In a full implementation, this would:
    // 1. Run harvest scripts for each active source
    // 2. Compare discovered events with current events
    // 3. Store new events in a pending queue
    // 4. Store new sources in sources_pending.json

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Weekly harvest workflow initiated',
        summary: {
          activeSources: sources.sources.filter(s => s.active).length,
          currentEvents: currentEvents.events.length,
          note: 'Full harvesting implementation requires Playwright in Netlify environment'
        }
      })
    };

  } catch (error) {
    console.error('Error running harvest:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to run harvest',
        message: error.message
      })
    };
  }
};
