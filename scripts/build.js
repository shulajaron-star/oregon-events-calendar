#!/usr/bin/env node

/**
 * Build script for Oregon Events Calendar
 *
 * Generates:
 * - site/events.json (events for web display, including past events)
 * - site/events.ics (iCalendar feed for subscriptions)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import ical from 'ical-generator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ANSI color codes
const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function info(msg) {
  console.log(`${colors.blue}ℹ ${msg}${colors.reset}`);
}

function success(msg) {
  console.log(`${colors.green}✓ ${msg}${colors.reset}`);
}

// Load events
const eventsPath = join(projectRoot, 'data', 'events.json');
const eventsData = JSON.parse(readFileSync(eventsPath, 'utf8'));

// Load archived (past) events so finished events stay on the calendar
const archiveDir = join(projectRoot, 'data', 'archive');
const archivedEvents = existsSync(archiveDir)
  ? readdirSync(archiveDir)
      .filter(f => /^\d{4}\.json$/.test(f))
      .flatMap(f => JSON.parse(readFileSync(join(archiveDir, f), 'utf8')).events || [])
  : [];

// Keep past events (they are never removed from the calendar); only drop
// cancelled events and anything more than 12 months out.
const now = new Date();
const twelveMonthsFromNow = new Date();
twelveMonthsFromNow.setMonth(now.getMonth() + 12);

const seenIds = new Set();
const currentEvents = [...archivedEvents, ...eventsData.events].filter(event => {
  if (seenIds.has(event.id)) return false;
  seenIds.add(event.id);
  const eventDate = new Date(event.start);
  const isInWindow = eventDate <= twelveMonthsFromNow;
  const isNotCancelled = event.status !== 'cancelled';
  return isInWindow && isNotCancelled;
}).sort((a, b) => new Date(a.start) - new Date(b.start));

info(`Building from ${eventsData.events.length} upcoming and ${archivedEvents.length} archived events`);
info(`${currentEvents.length} events on the calendar (past events kept)`);

// Ensure site directory exists
mkdirSync(join(projectRoot, 'site'), { recursive: true });

// Generate events.json for website
const webEventsPath = join(projectRoot, 'site', 'events.json');
writeFileSync(
  webEventsPath,
  JSON.stringify({ events: currentEvents }, null, 2),
  'utf8'
);
success(`Generated ${webEventsPath}`);

// Generate events.ics calendar feed
const calendar = ical({
  name: 'Oregon Startup & Bioscience Events',
  description: 'Startup, entrepreneurship, and bioscience industry events in Oregon and Southwest Washington',
  timezone: 'America/Los_Angeles',
  url: 'https://oregonstartupeventscalendar.netlify.app',
  ttl: 3600 // 1 hour cache
});

for (const event of currentEvents) {
  const calEvent = {
    start: new Date(event.start),
    summary: event.title,
    description: [
      event.summary,
      `Organizer: ${event.organizer}`,
      event.virtual_meeting_url ? `Join online: ${event.virtual_meeting_url}` : null,
      `Register: ${event.registration_url || event.source_url}`
    ].filter(Boolean).join('\n\n'),
    location: event.format === 'virtual'
      ? (event.virtual_meeting_url || `Virtual: ${event.venue || 'Online'}`)
      : event.venue
        ? `${event.venue}, ${event.city || ''}`
        : event.city || '',
    url: event.registration_url || event.source_url,
    organizer: {
      name: event.organizer,
      email: 'noreply@oregon-events.netlify.app'
    },
    categories: event.categories ? event.categories.map(cat => ({ name: cat })) : [],
    status: event.status === 'postponed' ? 'CANCELLED' : 'CONFIRMED'
  };

  // Add end time if present
  if (event.end) {
    calEvent.end = new Date(event.end);
  }

  // Handle all-day events
  if (event.start.includes('T00:00:00')) {
    calEvent.allDay = true;
  }

  calendar.createEvent(calEvent);
}

const icsPath = join(projectRoot, 'site', 'events.ics');
writeFileSync(icsPath, calendar.toString(), 'utf8');
success(`Generated ${icsPath}`);

// Summary
console.log('\n' + '='.repeat(50));
success(`Build complete! Generated ${currentEvents.length} events`);
console.log(`\nFiles created:`);
console.log(`  - site/events.json (for website)`);
console.log(`  - site/events.ics (for calendar subscriptions)`);
