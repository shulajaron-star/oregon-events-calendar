// This function fetches the current events from GitHub

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

    // Fetch events.json from GitHub
    const getFileResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/data/events.json`,
      {
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Oregon Events Admin'
        }
      }
    );

    if (!getFileResponse.ok) {
      throw new Error(`Failed to fetch events.json: ${getFileResponse.statusText}`);
    }

    const fileData = await getFileResponse.json();
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const eventsJson = JSON.parse(content);

    // Filter to show only upcoming and recent events (within last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const relevantEvents = eventsJson.events.filter(e => {
      const eventDate = new Date(e.start);
      return eventDate >= sevenDaysAgo;
    });

    // Sort by date (newest first)
    relevantEvents.sort((a, b) => new Date(b.start) - new Date(a.start));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        events: relevantEvents,
        total: relevantEvents.length
      })
    };

  } catch (error) {
    console.error('Error fetching events:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch events',
        message: error.message
      })
    };
  }
};
