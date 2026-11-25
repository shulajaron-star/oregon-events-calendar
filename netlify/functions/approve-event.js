// This function approves an event suggestion by:
// 1. Reading current events.json from GitHub
// 2. Adding the new event
// 3. Committing back to GitHub
// 4. Triggering a rebuild
// 5. Deleting the form submission

const { removeFromPending } = require('./_shared/pending-store');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { eventData, submissionId, fullEvent } = JSON.parse(event.body);

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
    let newEvent;
    if (fullEvent && fullEvent.title && fullEvent.start) {
      // A harvested pending event is already a complete event: keep every field.
      newEvent = {
        ...fullEvent,
        id: fullEvent.id || generateEventId(fullEvent.organizer, fullEvent.title, fullEvent.start.slice(0, 10)),
        cost: cleanCost(fullEvent.cost),
        status: fullEvent.status === 'needs_review' ? 'confirmed' : (fullEvent.status || 'confirmed'),
        last_verified: today()
      };
    } else {
      const meetingUrl = cleanUrl(eventData.virtual_meeting_url);
      const start = pacificISO(eventData.event_date, eventData.event_time);
      if (!start) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'A valid event date is required', message: 'A valid event date is required' })
        };
      }

      newEvent = {
        id: generateEventId(eventData.organizer, eventData.event_name, eventData.event_date),
        title: eventData.event_name,
        organizer: eventData.organizer,
        co_hosts: [],
        start,
        end: buildEnd(eventData),
        format: guessFormat(eventData.location, meetingUrl),
        venue: eventData.location || null,
        city: extractCity(eventData.location),
        region: guessRegion(eventData.location),
        categories: [eventData.category].filter(Boolean),
        cost: cleanCost(eventData.cost),
        registration_url: eventData.event_url,
        virtual_meeting_url: meetingUrl,
        source_url: eventData.event_url,
        summary: eventData.description || eventData.event_name,
        status: 'confirmed',
        first_seen: today(),
        last_verified: today()
      };
    }

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
          category: (newEvent.categories || [])[0] || null
        },
        note: 'Approved via admin interface'
      });
    } catch (logError) {
      // Log error but don't fail the whole operation
      console.error('Failed to log change:', logError);
    }

    // Step 3.6: An approved harvested event leaves the pending list
    if (fullEvent && fullEvent.id) {
      try {
        await removeFromPending(fullEvent.id, 'approved');
      } catch (pendingError) {
        console.error('Failed to remove from pending:', pendingError);
      }
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

// Pacific time helpers. Event times are stored as Pacific wall-clock times with
// the correct offset for that date (-08:00 in winter, -07:00 during daylight time).
function laOffsetMinutes(utcMs) {
  const parts = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(utcMs)).forEach(p => { parts[p.type] = p.value; });
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - utcMs) / 60000);
}

function pacificISO(date, time) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time && /^\d{1,2}:\d{2}/.test(time) ? time : '00:00').split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let offset = laOffsetMinutes(wall + 8 * 3600000);
  offset = laOffsetMinutes(wall - offset * 60000);
  const sign = offset <= 0 ? '-' : '+';
  const abs = Math.abs(offset);
  const pad = n => String(n).padStart(2, '0');
  return `${date}T${pad(hh)}:${pad(mm)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

// Read the stored Pacific date and time straight from the string, without
// converting through the viewer's own time zone.
function splitPacific(iso) {
  if (!iso) return { date: '', time: '' };
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  return { date, time: time === '00:00' ? '' : time };
}

function today() {
  // Today's date in Pacific time
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date());
}

function buildEnd(data) {
  const endDate = data.event_end_date || (data.event_end_time ? data.event_date : '');
  if (!endDate) return null;
  return pacificISO(endDate, data.event_end_time);
}

function cleanCost(cost) {
  return ['free', 'paid', 'unknown'].includes(cost) ? cost : 'unknown';
}

function guessFormat(location, meetingUrl) {
  if (!location) return meetingUrl ? 'virtual' : 'unknown';
  const loc = location.toLowerCase();
  if (loc.includes('zoom') || loc.includes('virtual') || loc.includes('online')) {
    return 'virtual';
  }
  // A physical location plus a meeting link means people can join either way
  return meetingUrl ? 'hybrid' : 'in_person';
}

// Keep a submitted URL only if it is a valid http(s) link
function cleanUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url.trim());
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? parsed.href : null;
  } catch (e) {
    return null;
  }
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
