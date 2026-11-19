exports.handler = async function(event, context) {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  try {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const GITHUB_REPO = process.env.GITHUB_REPO || 'shulajaron-star/oregon-events-calendar';

    // Fetch changelog.json from GitHub
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/data/changelog.json`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'oregon-events-calendar'
        }
      }
    );

    if (!response.ok) {
      // If changelog doesn't exist yet, return empty array
      if (response.status === 404) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ changes: [] })
        };
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    const changelog = JSON.parse(content);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changelog)
    };

  } catch (error) {
    console.error('Error fetching changelog:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to fetch changelog',
        error: error.message
      })
    };
  }
};
