// This function approves an event suggestion by:
// 1. Reading current events.json from GitHub
// 2. Adding the new event
// 3. Committing back to GitHub
// 4. Triggering a rebuild
// 5. Deleting the form submission

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { eventData, submissionId } = JSON.parse(event.body);

    // Get required environment variables
    const githubToken = process.env.GITHUB_TOKEN;
    const netlifyToken = process.env.NETLIFY_API_TOKEN;
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

    // Step 2: Create new event object
    const newEvent = {
      id: generateEventId(eventData.organizer, eventData.event_name, eventData.event_date),
      title: eventData.event_name,
      organizer: eventData.organizer,
      co_hosts: [],
      start: formatDateTime(eventData.event_date, eventData.event_time),
      end: null,
      format: guessFormat(eventData.location),
      venue: eventData.location || null,
      city: extractCity(eventData.location),
      region: guessRegion(eventData.location),
      categories: [eventData.category],
      cost: 'unknown',
      registration_url: eventData.event_url,
      source_url: eventData.event_url,
      summary: eventData.description || eventData.event_name,
      status: 'confirmed',
      first_seen: new Date().toISOString().split('T')[0],
      last_verified: new Date().toISOString().split('T')[0]
    };

    // Check for duplicates
    const isDuplicate = eventsJson.events.some(e => e.id === newEvent.id);
    if (isDuplicate) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Event with this ID already exists' })
      };
    }

    // Add to events array
    eventsJson.events.push(newEvent);

    // Sort events by start date
    eventsJson.events.sort((a, b) => new Date(a.start) - new Date(b.start));

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
          message: `Add event: ${newEvent.title}\n\nApproved via admin interface\n\n🤖 Generated with Claude Code`,
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

    // Step 3.5: Log the change to changelog.json
    try {
      await logChange(githubToken, repoOwner, repoName, {
        action: 'added',
        eventId: newEvent.id,
        eventTitle: newEvent.title,
        timestamp: new Date().toISOString(),
        details: {
          organizer: newEvent.organizer,
          date: newEvent.start.split('T')[0],
          category: newEvent.categories[0]
        },
        note: 'Approved via admin interface'
      });
    } catch (logError) {
      // Log error but don't fail the whole operation
      console.error('Failed to log change:', logError);
    }

    // Step 4: Delete the Netlify form submission (if token available)
    if (netlifyToken && submissionId) {
      try {
        await fetch(
          `https://api.netlify.com/api/v1/submissions/${submissionId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${netlifyToken}`
            }
          }
        );
      } catch (err) {
        console.log('Could not delete submission:', err.message);
        // Non-critical, continue
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        event: newEvent,
        message: 'Event approved and added to calendar. GitHub will trigger a rebuild automatically.'
      })
    };

  } catch (error) {
    console.error('Error approving event:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to approve event',
        message: error.message
      })
    };
  }
};

// Helper functions

function generateEventId(organizer, title, date) {
  const org = (organizer || 'unknown').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 20);
  const titleSlug = (title || 'event').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 30);
  const dateStr = date || new Date().toISOString().split('T')[0];

  return `${org}-${titleSlug}-${dateStr}`.replace(/^-+|-+$/g, '');
}

function formatDateTime(date, time) {
  if (!date) return new Date().toISOString();

  let dateTime = new Date(date);

  if (time) {
    const [hours, minutes] = time.split(':');
    dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  } else {
    dateTime.setHours(0, 0, 0, 0);
  }

  // Format as ISO with Pacific timezone offset
  const offset = dateTime.getTimezoneOffset();
  const pacificOffset = -8 * 60; // PST offset in minutes
  dateTime.setMinutes(dateTime.getMinutes() + offset - pacificOffset);

  const isoStr = dateTime.toISOString().replace('Z', '');
  const tzOffset = time ? '-07:00' : '-07:00'; // Simplified, would need proper timezone logic

  return isoStr.substring(0, 19) + tzOffset;
}

function guessFormat(location) {
  if (!location) return 'unknown';
  const loc = location.toLowerCase();
  if (loc.includes('zoom') || loc.includes('virtual') || loc.includes('online')) {
    return 'virtual';
  }
  return 'in_person';
}

function extractCity(location) {
  if (!location) return null;

  const cities = ['Portland', 'Eugene', 'Salem', 'Corvallis', 'Bend', 'Vancouver',
                  'Medford', 'Hillsboro', 'Beaverton', 'Gresham'];

  for (const city of cities) {
    if (location.includes(city)) {
      return city;
    }
  }

  return null;
}

function guessRegion(location) {
  if (!location) return 'Statewide/Virtual';

  const loc = location.toLowerCase();

  if (loc.includes('portland') || loc.includes('hillsboro') ||
      loc.includes('beaverton') || loc.includes('gresham')) {
    return 'Portland Metro';
  }
  if (loc.includes('vancouver') || loc.includes('camas')) {
    return 'Southwest Washington';
  }
  if (loc.includes('eugene') || loc.includes('springfield')) {
    return 'Eugene/Lane';
  }
  if (loc.includes('corvallis') || loc.includes('albany')) {
    return 'Willamette Valley';
  }
  if (loc.includes('bend') || loc.includes('redmond')) {
    return 'Central Oregon';
  }
  if (loc.includes('medford') || loc.includes('ashland')) {
    return 'Southern Oregon';
  }
  if (loc.includes('salem')) {
    return 'Willamette Valley';
  }

  return 'Statewide/Virtual';
}

async function logChange(githubToken, repoOwner, repoName, changeEntry) {
  // Fetch current changelog.json
  const getResponse = await fetch(
    `https://api.github.com/repos/${repoOwner}/${repoName}/contents/data/changelog.json`,
    {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Oregon Events Admin'
      }
    }
  );

  let changelog = { changes: [] };
  let fileSha = null;

  if (getResponse.ok) {
    const fileData = await getResponse.json();
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
    changelog = JSON.parse(content);
    fileSha = fileData.sha;
  }

  // Add new change at the beginning (most recent first)
  changelog.changes.unshift(changeEntry);

  // Keep only last 500 changes to prevent file from growing too large
  if (changelog.changes.length > 500) {
    changelog.changes = changelog.changes.slice(0, 500);
  }

  // Commit back to GitHub
  const updatedContent = Buffer.from(JSON.stringify(changelog, null, 2)).toString('base64');

  const commitResponse = await fetch(
    `https://api.github.com/repos/${repoOwner}/${repoName}/contents/data/changelog.json`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Oregon Events Admin'
      },
      body: JSON.stringify({
        message: `Update changelog: ${changeEntry.action} ${changeEntry.eventTitle}`,
        content: updatedContent,
        sha: fileSha,
        branch: 'main'
      })
    }
  );

  if (!commitResponse.ok) {
    throw new Error(`Failed to update changelog: ${commitResponse.status}`);
  }
}
