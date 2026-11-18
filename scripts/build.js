#!/usr/bin/env node

/**
 * Build script for Oregon Events Calendar
 *
 * Generates:
 * - site/events.json (current events for web display)
 * - site/events.ics (iCalendar feed for subscriptions)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
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

// Filter to current events only (within 12-month window, not cancelled)
const now = new Date();
const twelveMonthsFromNow = new Date();
twelveMonthsFromNow.setMonth(now.getMonth() + 12);

const currentEvents = eventsData.events.filter(event => {
  const eventDate = new Date(event.start);
  const isInWindow = eventDate >= now && eventDate <= twelveMonthsFromNow;
  const isNotCancelled = event.status !== 'cancelled';
  return isInWindow && isNotCancelled;
});

info(`Building from ${eventsData.events.length} total events`);
info(`${currentEvents.length} events in current 12-month window`);

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
  url: 'https://oregon-events.netlify.app',
  ttl: 3600 // 1 hour cache
});

for (const event of currentEvents) {
  const calEvent = {
    start: new Date(event.start),
    summary: event.title,
    description: `${event.summary}\n\nOrganizer: ${event.organizer}\n\nRegister: ${event.registration_url || event.source_url}`,
    location: event.format === 'virtual'
      ? `Virtual: ${event.venue || 'Online'}`
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
