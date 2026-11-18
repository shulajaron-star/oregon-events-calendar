#!/usr/bin/env node

/**
 * ICS Feed Harvesting Script
 *
 * Automatically fetches events from ICS feeds and adds them to data/events.json
 * Runs weekly to keep the calendar up-to-date with real events
 *
 * Usage: node scripts/harvest-ics-feeds.js
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import ical from 'node-ical';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File paths
const SOURCES_FILE = path.join(__dirname, '../data/sources.json');
const EVENTS_FILE = path.join(__dirname, '../data/events.json');

// Region mapping based on city/location
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

// Helper: Fetch ICS feed
function fetchICSFeed(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Helper: Create event ID
function createEventId(organizer, title, startDate) {
  const orgSlug = organizer.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 20);
  const titleSlug = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .split('-')
    .filter(w => w.length > 2)
    .slice(0, 4)
    .join('-');
  const dateStr = startDate.toISOString().split('T')[0];
  return `${orgSlug}-${titleSlug}-${dateStr}`;
}

// Helper: Determine region from location
function determineRegion(location) {
  if (!location) return 'Statewide/Virtual';

  const locationLower = location.toLowerCase();

  for (const [city, region] of Object.entries(REGION_MAP)) {
    if (locationLower.includes(city)) {
      return region;
    }
  }

  // Default based on keywords
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

  // Try to extract city from common patterns
  const parts = location.split(',');
  if (parts.length >= 2) {
    return parts[1].trim().split(/\s+/)[0];
  }

  return null;
}

// Helper: Categorize event based on description/title
function categorizeEvent(title, description, categories) {
  const text = `${title} ${description}`.toLowerCase();
  const eventCategories = [];

  // Check ICS categories first
  const icsCategories = Array.isArray(categories) ? categories.join(' ').toLowerCase() : '';

  // Life science
  if (text.includes('bio') || text.includes('life science') || text.includes('biotech') ||
      text.includes('medtech') || text.includes('health') || text.includes('pharma')) {
    eventCategories.push('life_science');
  }

  // Startup
  if (text.includes('startup') || text.includes('entrepreneur') || text.includes('founder') ||
      text.includes('venture') || text.includes('pitch')) {
    eventCategories.push('startup');
  }

  // Investor
  if (text.includes('investor') || text.includes('angel') || text.includes('vc') ||
      text.includes('funding') || text.includes('pitch')) {
    eventCategories.push('investor');
  }

  // Training
  if (text.includes('workshop') || text.includes('training') || text.includes('bootcamp') ||
      text.includes('learn') || text.includes('education')) {
    eventCategories.push('training');
  }

  // Networking
  if (text.includes('network') || text.includes('meetup') || text.includes('coffee') ||
      text.includes('connect') || icsCategories.includes('networking')) {
    eventCategories.push('networking');
  }

  // Conference
  if (text.includes('conference') || text.includes('summit') || text.includes('symposium')) {
    eventCategories.push('conference');
  }

  // Underrepresented founders
  if (text.includes('women') || text.includes('diverse') || text.includes('underrepresented') ||
      text.includes('minority')) {
    eventCategories.push('underrepresented_founders');
  }

  // Default if nothing matched
  if (eventCategories.length === 0) {
    eventCategories.push('startup');
  }

  return [...new Set(eventCategories)]; // Remove duplicates
}

// Helper: Format date to ISO with timezone
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  // Determine timezone offset (PST -08:00 or PDT -07:00)
  const offset = date.getTimezoneOffset();
  const offsetHours = Math.abs(Math.floor(offset / 60));
  const offsetSign = offset > 0 ? '-' : '+';
  const tzOffset = `${offsetSign}${String(offsetHours).padStart(2, '0')}:00`;

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${tzOffset}`;
}

// Main harvesting function
async function harvestICSFeeds() {
  console.log('🔍 Starting ICS feed harvesting...\n');

  // Load sources and events
  const sources = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf-8'));
  const eventsData = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
  const existingEvents = eventsData.events;

  // Find sources with ICS feeds
  const icsSources = sources.sources.filter(s => s.active && s.ics_feed);

  console.log(`Found ${icsSources.length} active sources with ICS feeds:\n`);
  icsSources.forEach(s => console.log(`  - ${s.name}: ${s.ics_feed}`));
  console.log();

  const newEvents = [];
  const updatedEvents = [];
  const errors = [];

  // Process each ICS feed
  for (const source of icsSources) {
    console.log(`\n📡 Fetching from ${source.name}...`);

    try {
      const icsData = await fetchICSFeed(source.ics_feed);
      const events = ical.sync.parseICS(icsData);

      let eventCount = 0;
      const today = new Date();
      const endOf2027 = new Date('2027-12-31T23:59:59-08:00');

      for (const key in events) {
        const event = events[key];

        if (event.type !== 'VEVENT') continue;

        const startDate = new Date(event.start);

        // Only include events through end of 2027
        if (startDate < today || startDate > endOf2027) continue;

        eventCount++;

        // Create event object
        const eventId = createEventId(source.name, event.summary, startDate);
        const location = event.location || '';
        const city = extractCity(location);
        const region = determineRegion(location);
        const categories = categorizeEvent(
          event.summary || '',
          event.description || '',
          event.categories
        );

        const eventObj = {
          id: eventId,
          title: event.summary || 'Untitled Event',
          organizer: source.name,
          co_hosts: [],
          start: formatDate(startDate),
          end: event.end ? formatDate(new Date(event.end)) : null,
          format: location.toLowerCase().includes('virtual') || location.toLowerCase().includes('zoom') ? 'virtual' : 'in_person',
          venue: location ? location.split(',')[0].trim() : null,
          city: city,
          region: region,
          categories: categories,
          cost: 'unknown',
          registration_url: event.url || source.events_url,
          source_url: source.ics_feed,
          summary: event.description ? event.description.substring(0, 200).replace(/\n/g, ' ').trim() + '...' : 'Event from ' + source.name,
          status: 'confirmed',
          first_seen: new Date().toISOString().split('T')[0],
          last_verified: new Date().toISOString().split('T')[0]
        };

        // Check if event already exists
        const existingIndex = existingEvents.findIndex(e => e.id === eventId);

        if (existingIndex === -1) {
          newEvents.push(eventObj);
          existingEvents.push(eventObj);
          console.log(`  ✓ New: ${event.summary} (${startDate.toDateString()})`);
        } else {
          // Update last_verified date
          existingEvents[existingIndex].last_verified = new Date().toISOString().split('T')[0];
          updatedEvents.push(eventObj);
          console.log(`  ↻ Updated: ${event.summary} (${startDate.toDateString()})`);
        }
      }

      console.log(`  Found ${eventCount} events in feed`);

    } catch (error) {
      console.error(`  ❌ Error fetching ${source.name}:`, error.message);
      errors.push({ source: source.name, error: error.message });
    }
  }

  // Save updated events
  fs.writeFileSync(EVENTS_FILE, JSON.stringify({ events: existingEvents }, null, 2));

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Harvest Summary:');
  console.log(`   New events added: ${newEvents.length}`);
  console.log(`   Events updated: ${updatedEvents.length}`);
  console.log(`   Total events in calendar: ${existingEvents.length}`);

  if (errors.length > 0) {
    console.log(`\n⚠️  Errors encountered: ${errors.length}`);
    errors.forEach(e => console.log(`   - ${e.source}: ${e.error}`));
  }

  console.log('\n✓ Harvesting complete!\n');

  return {
    newEvents: newEvents.length,
    updatedEvents: updatedEvents.length,
    totalEvents: existingEvents.length,
    errors: errors.length
  };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  harvestICSFeeds()
    .then(summary => {
      console.log('Next steps:');
      console.log('  1. Run: npm run validate');
      console.log('  2. Run: npm run build');
      console.log('  3. Preview: npm run dev\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default harvestICSFeeds;
