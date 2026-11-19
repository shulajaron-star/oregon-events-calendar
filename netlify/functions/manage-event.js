// This function manages events in events.json:
// - Delete an event by ID
// - Update an event's status (e.g., mark as cancelled)

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { action, eventId, updates } = JSON.parse(event.body);

    if (!action || !eventId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'action and eventId are required' })
      };
    }

    // Get required environment variables
    const githubToken = process.env.GITHUB_TOKEN;
    const repoOwner = process.env.GITHUB_OWNER || 'shulajaron-star';
    const repoName = process.env.GITHUB_REPO || 'oregon-events-calendar';

    if (!githubToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'GITHUB_TOKEN not configured' })
      };
    }

    // Step 1: Fetch current events.json from GitHub
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

    let commitMessage = '';
    let eventTitle = '';

    // Step 2: Perform the requested action
    if (action === 'delete') {
      // Find and remove the event
      const eventIndex = eventsJson.events.findIndex(e => e.id === eventId);

      if (eventIndex === -1) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Event not found' })
        };
      }

      eventTitle = eventsJson.events[eventIndex].title;
      eventsJson.events.splice(eventIndex, 1);
      commitMessage = `Delete event: ${eventTitle}\n\nEvent ID: ${eventId}\nDeleted via admin interface\n\n🤖 Generated with Claude Code`;

    } else if (action === 'update') {
      // Find and update the event
      const eventIndex = eventsJson.events.findIndex(e => e.id === eventId);

      if (eventIndex === -1) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Event not found' })
        };
      }

      eventTitle = eventsJson.events[eventIndex].title;

      // Apply updates
      if (updates) {
        eventsJson.events[eventIndex] = {
          ...eventsJson.events[eventIndex],
          ...updates,
          last_verified: new Date().toISOString().split('T')[0]
        };
      }

      const updateDescription = updates.status === 'cancelled' ? 'Mark as cancelled' : 'Update';
      commitMessage = `${updateDescription}: ${eventTitle}\n\nEvent ID: ${eventId}\nUpdated via admin interface\n\n🤖 Generated with Claude Code`;

    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid action. Use "delete" or "update"' })
      };
    }

    // Step 3: Commit back to GitHub
    const updatedContent = Buffer.from(JSON.stringify(eventsJson, null, 2)).toString('base64');

    const commitResponse = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/data/events.json`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Oregon Events Admin'
        },
        body: JSON.stringify({
          message: commitMessage,
          content: updatedContent,
          sha: fileData.sha,
          branch: 'main'
        })
      }
    );

    if (!commitResponse.ok) {
      const error = await commitResponse.text();
      throw new Error(`Failed to commit: ${commitResponse.status} ${error}`);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        action: action,
        eventId: eventId,
        eventTitle: eventTitle,
        message: `Event ${action}d successfully. GitHub will trigger a rebuild automatically.`
      })
    };

  } catch (error) {
    console.error('Error managing event:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to manage event',
        message: error.message
      })
    };
  }
};
