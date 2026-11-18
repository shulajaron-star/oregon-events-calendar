const https = require('https');
const http = require('http');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { url } = JSON.parse(event.body);

    if (!url) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'URL is required' })
      };
    }

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid URL' })
      };
    }

    // Fetch the page
    const html = await fetchPage(parsedUrl);

    // Parse the HTML to extract event information
    const eventData = parseEventData(html, parsedUrl.hostname);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventData)
    };

  } catch (error) {
    console.error('Error fetching event:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch event details',
        message: error.message
      })
    };
  }
};

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; OregonEventsBot/1.0)'
      }
    };

    const req = protocol.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve(data);
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

function parseEventData(html, hostname) {
  const eventData = {
    title: '',
    date: '',
    time: '',
    location: '',
    organizer: '',
    description: ''
  };

  // Extract title from various possible sources
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
                     html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                     html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
  if (titleMatch) {
    eventData.title = cleanText(titleMatch[1]);
  }

  // Extract date from meta tags or common patterns
  const datePatterns = [
    /<meta\s+property="event:start_date"\s+content="([^"]+)"/i,
    /<time[^>]*datetime="([^"]+)"/i,
    /<meta\s+itemprop="startDate"\s+content="([^"]+)"/i,
    /takes place (?:on |from )?(\w+ \d{1,2}, \d{4})/i,
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i,
    /\b(\d{4}-\d{2}-\d{2})\b/
  ];

  for (const pattern of datePatterns) {
    const match = html.match(pattern);
    if (match) {
      eventData.date = match[1];
      break;
    }
  }

  // Extract time
  const timePattern = /\b(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/i;
  const timeMatch = html.match(timePattern);
  if (timeMatch) {
    eventData.time = timeMatch[1];
  }

  // Extract location
  const locationPatterns = [
    /<meta\s+property="event:location"\s+content="([^"]+)"/i,
    /<meta\s+itemprop="location"\s+content="([^"]+)"/i,
    /<span[^>]*class="[^"]*location[^"]*"[^>]*>([^<]+)</i,
    /\bat ([^.]+(?:Portland|Corvallis|Eugene|Salem|Bend|Vancouver)[^.]*)\./i,
    /Location:\s*([^\n<]+)/i
  ];

  for (const pattern of locationPatterns) {
    const match = html.match(pattern);
    if (match) {
      eventData.location = cleanText(match[1]);
      break;
    }
  }

  // Extract description
  const descPatterns = [
    /<meta\s+property="og:description"\s+content="([^"]+)"/i,
    /<meta\s+name="description"\s+content="([^"]+)"/i,
    /<meta\s+itemprop="description"\s+content="([^"]+)"/i
  ];

  for (const pattern of descPatterns) {
    const match = html.match(pattern);
    if (match) {
      eventData.description = cleanText(match[1]);
      break;
    }
  }

  // Try to infer organizer from hostname
  if (hostname) {
    const orgPatterns = {
      'eventbrite.com': 'Eventbrite',
      'oregonlifesciences.org': 'Oregon Life Sciences (OLS)',
      'builtoregon.com': 'Built Oregon',
      'oen.org': 'Oregon Entrepreneurs Network (OEN)',
      'techoregon.org': 'Technology Association of Oregon (TAO)',
      'raincatalysts.org': 'RAIN',
      'otradi.org': 'OTRADI'
    };

    for (const [domain, org] of Object.entries(orgPatterns)) {
      if (hostname.includes(domain)) {
        eventData.organizer = org;
        break;
      }
    }
  }

  return eventData;
}

function cleanText(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
