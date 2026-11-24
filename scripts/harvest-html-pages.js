#!/usr/bin/env node

/**
 * HTML Page Harvesting Script with Playwright
 *
 * Scrapes events from JavaScript-rendered pages (OEN, OLS, etc.) that don't have ICS feeds
 * Uses Playwright headless browser to execute JavaScript and extract event data
 *
 * Usage: node scripts/harvest-html-pages.js [--source <source-name>]
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { getHubScrapers } from './hub-scrapers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const EVENTS_FILE = path.join(__dirname, '../data/events.json');
const PENDING_FILE = path.join(__dirname, '../data/events-pending.json');

// Region mapping
const REGION_MAP = {
  'portland': 'Portland Metro',
  'beaverton': 'Portland Metro',
  'hillsboro': 'Portland Metro',
  'gresham': 'Portland Metro',
  'tigard': 'Portland Metro',
  'lake oswego': 'Portland Metro',
  'west linn': 'Portland Metro',
  'oregon city': 'Portland Metro',
  'vancouver': 'Southwest Washington',
  'camas': 'Southwest Washington',
  'clark county': 'Southwest Washington',
  'corvallis': 'Willamette Valley',
  'albany': 'Willamette Valley',
  'salem': 'Willamette Valley',
  'eugene': 'Eugene/Lane',
  'springfield': 'Eugene/Lane',
  'florence': 'Coast',
  'newport': 'Coast',
  'lincoln city': 'Coast',
  'bend': 'Central Oregon',
  'redmond': 'Central Oregon',
  'ashland': 'Southern Oregon',
  'medford': 'Southern Oregon',
  'grants pass': 'Southern Oregon',
};

// Helper: Create event ID
function createEventId(organizer, title, startDate) {
  const orgSlug = organizer.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 20);
  const titleSlug = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .split('-')
    .filter(w => w.length > 2)
    .slice(0, 4)
    .join('-');
  const dateStr = typeof startDate === 'string' ? startDate.split('T')[0] : startDate.toISOString().split('T')[0];
  return `${orgSlug}-${titleSlug}-${dateStr}`;
}

// Helper: Determine region from location
function determineRegion(location, city) {
  if (!location && !city) return 'Statewide/Virtual';

  const locationLower = (location || '').toLowerCase() + ' ' + (city || '').toLowerCase();

  for (const [cityName, region] of Object.entries(REGION_MAP)) {
    if (locationLower.includes(cityName)) {
      return region;
    }
  }

  if (locationLower.includes('virtual') || locationLower.includes('online') || locationLower.includes('zoom')) {
    return 'Statewide/Virtual';
  }

  return 'Statewide/Virtual';
}

// Helper: Extract city from location
function extractCity(location) {
  if (!location) return null;

  const locationLower = location.toLowerCase();

  for (const city of Object.keys(REGION_MAP)) {
    if (locationLower.includes(city)) {
      return city.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }

  return null;
}

// Helper: Categorize event
function categorizeEvent(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  const eventCategories = [];

  if (text.includes('bio') || text.includes('life science') || text.includes('biotech') ||
      text.includes('medtech') || text.includes('health') || text.includes('pharma')) {
    eventCategories.push('life_science');
  }

  if (text.includes('startup') || text.includes('entrepreneur') || text.includes('founder') ||
      text.includes('venture') || text.includes('pitch')) {
    eventCategories.push('startup');
  }

  if (text.includes('investor') || text.includes('angel') || text.includes('vc') ||
      text.includes('funding') || text.includes('pitch')) {
    eventCategories.push('investor');
  }

  if (text.includes('workshop') || text.includes('training') || text.includes('bootcamp') ||
      text.includes('learn') || text.includes('education')) {
    eventCategories.push('training');
  }

  if (text.includes('network') || text.includes('meetup') || text.includes('coffee') ||
      text.includes('connect')) {
    eventCategories.push('networking');
  }

  if (text.includes('conference') || text.includes('summit') || text.includes('symposium')) {
    eventCategories.push('conference');
  }

  if (text.includes('women') || text.includes('diverse') || text.includes('underrepresented') ||
      text.includes('minority')) {
    eventCategories.push('underrepresented_founders');
  }

  if (eventCategories.length === 0) {
    eventCategories.push('startup');
  }

  return [...new Set(eventCategories)];
}

// Helper: Format date to ISO with Pacific timezone
function formatDateToPacific(dateString) {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    // Pacific timezone offset (PST -08:00 or PDT -07:00)
    const month_num = date.getMonth();
    const isDST = month_num >= 2 && month_num <= 10;
    const tzOffset = isDST ? '-07:00' : '-08:00';

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${tzOffset}`;
  } catch (error) {
    return null;
  }
}

// Helper: Parse date from text
function parseDate(dateText) {
  if (!dateText) return null;

  try {
    // Try parsing as-is first
    let date = new Date(dateText);
    if (!isNaN(date.getTime())) return date;

    // Try common patterns
    const patterns = [
      /(\w+\s+\d{1,2},?\s+\d{4})/i,     // "November 19, 2026" or "November 19 2026"
      /(\d{1,2}\/\d{1,2}\/\d{4})/,      // "11/19/2026"
      /(\d{4}-\d{2}-\d{2})/,             // "2026-11-19"
      /(\w+\s+to\s+\w+\s+\d{4})/i,      // "Nov 16 to Nov 19 2026"
      /(\w+\s+\d{1,2}\s+to\s+\w+\s+\d{1,2}\s+\d{4})/i, // "Nov 16 to Nov 19 2026"
    ];

    for (const pattern of patterns) {
      const match = dateText.match(pattern);
      if (match) {
        // For "to" patterns, extract first date
        let dateStr = match[1];
        if (dateStr.includes(' to ')) {
          dateStr = dateStr.split(' to ')[0] + ' ' + dateStr.match(/\d{4}/)[0];
        }
        date = new Date(dateStr);
        if (!isNaN(date.getTime())) return date;
      }
    }

    // If we have just "November 2026", default to first of month
    const monthYearMatch = dateText.match(/^(\w+)\s+(\d{4})$/i);
    if (monthYearMatch) {
      date = new Date(`${monthYearMatch[1]} 1, ${monthYearMatch[2]}`);
      if (!isNaN(date.getTime())) return date;
    }

    return null;
  } catch (error) {
    return null;
  }
}

// Scraper: Oregon Life Sciences
async function scrapeOLS(page) {
  console.log('📡 Scraping Oregon Life Sciences...');

  try {
    await page.goto('https://oregonlifesciences.org/events', {
      waitUntil: 'load',
      timeout: 30000
    });

    // Wait longer for JavaScript to fully execute and render
    await page.waitForTimeout(8000);

    // Log page content for debugging
    const hasEvents = await page.evaluate(() => {
      const count = document.querySelectorAll('div.event-table.c-event-date-stub').length;
      console.log(`Page has ${count} event elements`);
      return count > 0;
    });

    if (!hasEvents) {
      console.log('  ⚠️  No events found on page - may need manual review');
    }

    // Extract events using page.evaluate to run code in browser context
    const events = await page.evaluate(() => {
      const eventElements = [];

      // OLS uses div with both classes: event-table AND c-event-date-stub
      const elements = document.querySelectorAll('div.event-table.c-event-date-stub');

      elements.forEach(el => {
        try {
          // Extract title from the STRONG tag with specific class
          const titleEl = el.querySelector('strong.c-event-date-stub__event-name');
          const title = titleEl?.textContent?.trim();

          // Extract start date - has class "date-stub" and "c-event-date-stub__start"
          const startDateEl = el.querySelector('div.c-event-date-stub__start.date-stub');
          const startDate = startDateEl?.textContent?.trim();

          // Extract end date - has classes "date-stub", "end-date", and "c-event-date-stub__end-date"
          const endDateEl = el.querySelector('div.c-event-date-stub__end-date.end-date');
          const endDate = endDateEl?.textContent?.trim();

          let dateText = startDate || '';
          if (endDate && endDate !== startDate) {
            dateText = `${startDate} to ${endDate} 2026`; // Add year since debug shows "Nov 19"
          } else if (startDate) {
            dateText = `${startDate} 2026`;
          }

          // Extract time if present (using <time> tag, not div)
          const timeEl = el.querySelector('time.c-event-date-stub__time');
          const timeText = timeEl?.textContent?.trim().replace(/\s+/g, ' ');

          // Extract link from Details button (span with class c-event-date-stub__btn)
          const linkEl = el.querySelector('a');
          const link = linkEl?.href || '';

          // Location might be in the title (e.g., "Oregon Bio Women Meetup | Corvallis")
          let location = '';
          if (title && title.includes('|')) {
            const parts = title.split('|');
            location = parts[1]?.trim() || '';
          }

          if (title && dateText) {
            eventElements.push({
              title: title.split('|')[0].trim(), // Remove location from title if present
              dateText: timeText ? `${dateText} ${timeText}` : dateText,
              location: location,
              description: title,
              url: link
            });
          }
        } catch (err) {
          // Silently continue on parse errors
        }
      });

      return eventElements;
    });

    console.log(`  Found ${events.length} potential events`);
    return events;

  } catch (error) {
    console.error('  ❌ Error scraping OLS:', error.message);
    return [];
  }
}

// Scraper: OEN (NeonCRM)
async function scrapeOEN(page) {
  console.log('📡 Scraping Oregon Entrepreneurs Network...');

  try {
    await page.goto('https://oen.app.neoncrm.com/nx/portal/event-calendar', {
      waitUntil: 'load',
      timeout: 30000
    });

    // Wait for calendar to fully render
    await page.waitForTimeout(5000);

    const events = await page.evaluate(() => {
      const eventElements = [];

      // Get the current month/year from the calendar header
      const headerText = document.querySelector('th[colspan]')?.textContent?.trim() || '';
      const monthYearMatch = headerText.match(/(\w+)\s+(\d{4})/);
      const currentMonth = monthYearMatch ? monthYearMatch[1] : 'November';
      const currentYear = monthYearMatch ? monthYearMatch[2] : '2026';

      // OEN uses a calendar view - calendar cells are in rows
      const calendarRows = document.querySelectorAll('tr');

      calendarRows.forEach(row => {
        const cells = row.querySelectorAll('td');

        cells.forEach((cell, index) => {
          try {
            // Try to find the day number in the cell (usually first text node or small number)
            const cellText = cell.textContent?.trim() || '';
            const dayMatch = cellText.match(/^(\d{1,2})/);
            const dayNum = dayMatch ? dayMatch[1] : null;

            // Look for event links within this cell
            const links = cell.querySelectorAll('a');

            links.forEach(link => {
              const title = link.textContent?.trim();
              const url = link.href;

              // Skip empty links, navigation links, or day number links
              if (!title || title.length < 10 || title.includes('<<') || title.includes('>>')) {
                return;
              }

              // Construct date with day number if we have it
              let dateText = '';
              if (dayNum) {
                dateText = `${currentMonth} ${dayNum}, ${currentYear}`;
              } else {
                dateText = `${currentMonth} 1, ${currentYear}`; // Fallback
              }

              if (title && url) {
                eventElements.push({
                  title,
                  dateText,
                  location: '',
                  description: title,
                  url
                });
              }
            });
          } catch (err) {
            // Silently continue
          }
        });
      });

      return eventElements;
    });

    console.log(`  Found ${events.length} potential events`);
    return events;

  } catch (error) {
    console.error('  ❌ Error scraping OEN:', error.message);
    return [];
  }
}

// Scraper for Technology Association of Oregon (TAO)
async function scrapeTAO(page) {
  console.log('📡 Scraping Technology Association of Oregon (TAO)...');

  try {
    await page.goto('https://www.techoregon.org/events', {
      waitUntil: 'load',
      timeout: 30000
    });

    await page.waitForTimeout(8000);

    const events = await page.evaluate(() => {
      const eventElements = [];

      // TAO uses event cards with links like /event/[slug]
      const eventLinks = document.querySelectorAll('a[href*="/event/"]');

      eventLinks.forEach(link => {
        const href = link.href;

        // Skip if this is a navigation link or generic "events" page link
        if (href.endsWith('/events') || href.includes('/events?')) {
          return;
        }

        // Get the text content - it often contains date + title concatenated
        const text = link.textContent?.trim();

        if (!text || text.length < 10) return;

        // Try to parse the date from the text
        // Format is often like "Thu19Nov 2026Event Title" or "19 Nov 2026 Event Title"
        const dateMatch = text.match(/(\w{3})?(\d{1,2})([A-Z][a-z]{2})\s*(\d{4})/);

        let dateText = '';
        let title = text;

        if (dateMatch) {
          const day = dateMatch[2];
          const month = dateMatch[3];
          const year = dateMatch[4];
          dateText = `${month} ${day}, ${year}`;

          // Remove the date portion from title
          title = text.replace(dateMatch[0], '').trim();
        } else {
          // Try another format: Look for date separately
          // The page might have date in a separate element
          const parent = link.closest('[class*="event"]');
          if (parent) {
            const dateEl = parent.querySelector('[class*="date"], time, .event-date');
            if (dateEl) {
              dateText = dateEl.textContent?.trim() || dateEl.getAttribute('datetime') || '';
            }
          }
        }

        if (title && title.length > 5) {
          eventElements.push({
            title,
            dateText,
            location: '',
            description: title,
            url: href
          });
        }
      });

      return eventElements;
    });

    console.log(`  Found ${events.length} potential events`);
    return events;

  } catch (error) {
    console.error('  ❌ Error scraping TAO:', error.message);
    return [];
  }
}

// Scraper for OSU Advantage Accelerator
async function scrapeOSUAdvantage(page) {
  console.log('📡 Scraping OSU Advantage Accelerator...');

  try {
    await page.goto('https://events.oregonstate.edu/department/osu_advantage', {
      waitUntil: 'load',
      timeout: 30000
    });

    await page.waitForTimeout(5000);

    const events = await page.evaluate(() => {
      const eventElements = [];

      // OSU uses Localist - look for event cards in "Recent Events" section
      // Note: "Upcoming Events" section may be empty, so we look at the full calendar
      const eventCards = document.querySelectorAll('.em-card, [class*="lw_events"]');

      eventCards.forEach(card => {
        const titleEl = card.querySelector('.em-card_title, .lw_events_title, h3, h4');
        const dateEl = card.querySelector('.em-card_event-date, .lw_start_date, time');
        const locationEl = card.querySelector('.em-card_event-location, .lw_location');
        const linkEl = card.querySelector('a');

        const title = titleEl?.textContent?.trim();
        const dateText = dateEl?.textContent?.trim() || dateEl?.getAttribute('datetime');
        const location = locationEl?.textContent?.trim();
        const url = linkEl?.href;

        // Parse date text - Localist often uses format like "Thu, May 22, 2025 12pm to 1pm PST"
        if (title && dateText && url) {
          eventElements.push({
            title,
            dateText,
            location: location || '',
            description: title,
            url
          });
        }
      });

      return eventElements;
    });

    console.log(`  Found ${events.length} potential events`);

    if (events.length === 0) {
      console.log('  ℹ️  No upcoming events found (this is normal if OSU Advantage has no scheduled events)');
    }

    return events;

  } catch (error) {
    console.error('  ❌ Error scraping OSU Advantage:', error.message);
    return [];
  }
}

// Scraper for Built Oregon
async function scrapeBuiltOregon(page) {
  console.log('📡 Scraping Built Oregon...');

  try {
    await page.goto('https://www.builtoregon.com/events', {
      waitUntil: 'load',
      timeout: 30000
    });

    await page.waitForTimeout(8000);

    const events = await page.evaluate(() => {
      const eventElements = [];

      // Built Oregon uses Squarespace event list
      // Skip past events (marked with eventlist-event--past class)
      const eventCards = document.querySelectorAll('.eventlist-event:not(.eventlist-event--past)');

      eventCards.forEach(card => {
        const titleEl = card.querySelector('.eventlist-title');
        const dateTagEl = card.querySelector('.eventlist-datetag');
        const timeEl = card.querySelector('.eventlist-meta-time');
        const locationEl = card.querySelector('.eventlist-meta-address');
        const linkEl = card.querySelector('a');

        const title = titleEl?.textContent?.trim();
        let timeText = timeEl?.textContent?.trim();
        const location = locationEl?.textContent?.trim();
        const url = linkEl?.href;

        // Clean up time text - extract just the start time (e.g., "10:00 AM\n6:30 PM" -> "10:00 AM")
        if (timeText) {
          const timeMatch = timeText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/);
          timeText = timeMatch ? timeMatch[1] : timeText.split('\n')[0].trim();
        }

        // Get month and day separately from the date tag
        let dateText = '';
        if (dateTagEl) {
          const monthEl = dateTagEl.querySelector('.eventlist-datetag-startdate--month');
          const dayEl = dateTagEl.querySelector('.eventlist-datetag-startdate--day');

          const month = monthEl?.textContent?.trim();
          const day = dayEl?.textContent?.trim();

          if (month && day) {
            // Determine year - if the date would be in the past with current year, use next year
            const currentYear = new Date().getFullYear();
            const testDate = new Date(`${month} ${day} ${currentYear}`);
            const year = testDate < new Date() ? currentYear + 1 : currentYear;

            // Build date string like "Sep 25 2027"
            dateText = `${month} ${day} ${year}`;

            // Add time if available
            if (timeText) {
              dateText = dateText + ' ' + timeText;
            }
          }
        }

        if (title && dateText && url) {
          eventElements.push({
            title,
            dateText,
            location: location || '',
            description: title,
            url
          });
        }
      });

      return eventElements;
    });

    console.log(`  Found ${events.length} potential events`);
    return events;

  } catch (error) {
    console.error('  ❌ Error scraping Built Oregon:', error.message);
    return [];
  }
}

// Scraper for Oregon Startup Center
async function scrapeOregonStartupCenter(page) {
  console.log('📡 Scraping Oregon Startup Center...');

  try {
    await page.goto('https://www.oregonstartupcenter.org/events', {
      waitUntil: 'load',
      timeout: 30000
    });

    await page.waitForTimeout(8000);

    const events = await page.evaluate(() => {
      const eventElements = [];

      // Oregon Startup Center uses a custom events layout
      // Look for Eventbrite links and surrounding content
      const eventLinks = document.querySelectorAll('a[href*="eventbrite.com"]');

      eventLinks.forEach(link => {
        const url = link.href;

        // Extract title from Eventbrite URL (e.g., "westside-founder-coffee-december-2026")
        const urlMatch = url.match(/eventbrite\.com\/e\/([^-]+-[^-]+(?:-[^-]+)*)-tickets/);
        let title = urlMatch ? urlMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : link.textContent?.trim();

        // Look for date information in the page body
        const bodyText = document.body.innerText;

        // Try to extract date patterns like "December 2nd at 9am"
        const dateMatch = bodyText.match(/([A-Z][a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)/i);

        let dateText = '';
        if (dateMatch) {
          const month = dateMatch[1];
          const day = dateMatch[2];
          const time = dateMatch[3] || '';

          // Determine year
          const currentYear = new Date().getFullYear();
          const testDate = new Date(`${month} ${day} ${currentYear}`);
          const year = testDate < new Date() ? currentYear + 1 : currentYear;

          dateText = `${month} ${day} ${year} ${time}`;
        }

        if (title && title.length > 10 && url && dateText) {
          eventElements.push({
            title,
            dateText,
            location: '',
            description: title,
            url
          });
        }
      });

      return eventElements;
    });

    console.log(`  Found ${events.length} potential events`);
    return events;

  } catch (error) {
    console.error('  ❌ Error scraping Oregon Startup Center:', error.message);
    return [];
  }
}

// Process scraped events into standard format
function processScrapedEvents(scrapedEvents, sourceName, sourceUrl) {
  const processedEvents = [];
  const today = new Date();
  const endOf2027 = new Date('2027-12-31T23:59:59-08:00');

  for (const event of scrapedEvents) {
    try {
      const startDate = parseDate(event.dateText);

      if (!startDate || isNaN(startDate.getTime())) {
        console.log(`  ⚠️  Skipping event (bad date): ${event.title} - "${event.dateText}"`);
        continue;
      }

      if (startDate < today) {
        console.log(`  ⚠️  Skipping past event: ${event.title} - ${startDate.toDateString()}`);
        continue;
      }

      if (startDate > endOf2027) {
        console.log(`  ⚠️  Skipping future event (beyond 2027): ${event.title} - ${startDate.toDateString()}`);
        continue;
      }

      const formattedStart = formatDateToPacific(startDate);
      if (!formattedStart) continue;

      const eventId = createEventId(sourceName, event.title, formattedStart);
      const categories = categorizeEvent(event.title, event.description || '');
      const city = extractCity(event.location);
      const region = determineRegion(event.location, city);

      const isVirtual = (event.location || '').toLowerCase().includes('virtual') ||
                       (event.location || '').toLowerCase().includes('zoom') ||
                       (event.location || '').toLowerCase().includes('online');

      const eventObj = {
        id: eventId,
        title: event.title,
        organizer: sourceName,
        co_hosts: [],
        start: formattedStart,
        end: null,
        format: isVirtual ? 'virtual' : 'in_person',
        venue: event.location || null,
        city: city,
        region: region,
        categories: categories,
        cost: 'unknown',
        registration_url: event.url || sourceUrl,
        source_url: sourceUrl,
        summary: (event.description || `Event from ${sourceName}`).substring(0, 200),
        status: 'confirmed',
        first_seen: new Date().toISOString().split('T')[0],
        last_verified: new Date().toISOString().split('T')[0]
      };

      processedEvents.push(eventObj);
      console.log(`  ✓ Parsed: ${event.title} (${formattedStart.split('T')[0]})`);

    } catch (err) {
      console.error(`  ⚠️  Error processing event: ${err.message}`);
    }
  }

  return processedEvents;
}

// Main harvesting function
async function harvestHTMLPages(specificSource = null) {
  console.log('🔍 Starting HTML page harvesting with Playwright...\n');

  // Load existing events
  const eventsData = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
  const existingEvents = eventsData.events;

  const scrapers = [
    {
      name: 'Oregon Life Sciences (OLS)',
      fn: scrapeOLS,
      url: 'https://oregonlifesciences.org/events'
    },
    {
      name: 'Oregon Entrepreneurs Network (OEN)',
      fn: scrapeOEN,
      url: 'https://oen.app.neoncrm.com/nx/portal/event-calendar'
    },
    {
      name: 'Technology Association of Oregon (TAO)',
      fn: scrapeTAO,
      url: 'https://www.techoregon.org/events'
    },
    {
      name: 'OSU Advantage Accelerator',
      fn: scrapeOSUAdvantage,
      url: 'https://events.oregonstate.edu/department/osu_advantage'
    },
    {
      name: 'Built Oregon',
      fn: scrapeBuiltOregon,
      url: 'https://www.builtoregon.com/events'
    },
    {
      name: 'Oregon Startup Center',
      fn: scrapeOregonStartupCenter,
      url: 'https://www.oregonstartupcenter.org/events'
    },
    // Innovation hubs and regional development councils (scripts/hub-scrapers.js)
    ...getHubScrapers()
  ];

  let newEvents = [];
  let updatedEvents = [];
  const errors = [];

  // Launch browser
  console.log('🚀 Launching headless browser...\n');
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    // Run scrapers
    for (const scraper of scrapers) {
      if (specificSource && !scraper.name.includes(specificSource)) {
        continue;
      }

      console.log(`\n${'='.repeat(80)}\n`);

      try {
        const scrapedEvents = await scraper.fn(page);
        const processedEvents = scraper.prebuilt
          ? scrapedEvents
          : processScrapedEvents(scrapedEvents, scraper.name, scraper.url);

        for (const eventObj of processedEvents) {
          const existingIndex = existingEvents.findIndex(e => e.id === eventObj.id);

          if (existingIndex === -1) {
            newEvents.push(eventObj);
            existingEvents.push(eventObj);
          } else {
            existingEvents[existingIndex].last_verified = new Date().toISOString().split('T')[0];
            updatedEvents.push(eventObj);
          }
        }

      } catch (error) {
        console.error(`❌ Error with ${scraper.name}:`, error.message);
        errors.push({ source: scraper.name, error: error.message });
      }
    }

  } finally {
    await browser.close();
    console.log('\n✓ Browser closed');
  }

  // Save NEW events to pending file for QC review
  if (newEvents.length > 0) {
    fs.writeFileSync(PENDING_FILE, JSON.stringify({ events: newEvents }, null, 2));
    console.log(`\n✓ Saved ${newEvents.length} new events to data/events-pending.json for QC review`);
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Harvest Summary:');
  console.log(`   New events found: ${newEvents.length} (saved to pending)`);
  console.log(`   Events updated: ${updatedEvents.length}`);
  console.log(`   Total events if approved: ${existingEvents.length + newEvents.length}`);

  if (errors.length > 0) {
    console.log(`\n⚠️  Errors encountered: ${errors.length}`);
    errors.forEach(e => console.log(`   - ${e.source}: ${e.error}`));
  }

  console.log('\n✓ HTML harvesting complete!');

  if (newEvents.length > 0) {
    console.log('\n📋 Next steps:');
    console.log('   1. Review: node scripts/qc-review.js');
    console.log('   2. Approve: node scripts/qc-approve.js');
    console.log('   3. Or reject: rm data/events-pending.json\n');
  } else {
    console.log('');
  }

  return {
    newEvents: newEvents.length,
    updatedEvents: updatedEvents.length,
    totalEvents: existingEvents.length,
    errors: errors.length
  };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const sourceArg = args.indexOf('--source');
  const specificSource = sourceArg !== -1 ? args[sourceArg + 1] : null;

  harvestHTMLPages(specificSource)
    .then(summary => {
      console.log('Next steps:');
      console.log('  1. Review scraped events in data/events.json');
      console.log('  2. Run: npm run validate');
      console.log('  3. Run: npm run build\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default harvestHTMLPages;
