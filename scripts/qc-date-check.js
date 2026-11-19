#!/usr/bin/env node

/**
 * QC Date Check - Validates event dates for common issues
 *
 * Checks for:
 * - Events with years that don't match title (e.g., "Event 2024" but date is 2027)
 * - Events dated more than 18 months in the future
 * - Events with suspicious date patterns
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EVENTS_FILE = path.join(__dirname, '../data/events.json');

console.log('\n🔍 QC Date Check - Validating event dates...\n');

const data = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
const events = data.events || [];

let issuesFound = 0;
const now = new Date();
const eighteenMonthsFromNow = new Date();
eighteenMonthsFromNow.setMonth(eighteenMonthsFromNow.getMonth() + 18);

events.forEach(event => {
  const eventDate = new Date(event.start);
  const eventYear = eventDate.getFullYear();
  const issues = [];

  // Check 1: Title contains a different year than the event date
  const yearInTitle = event.title.match(/\b(20\d{2})\b/);
  if (yearInTitle && parseInt(yearInTitle[1]) !== eventYear) {
    issues.push(`Title mentions year ${yearInTitle[1]} but event is dated ${eventYear}`);
  }

  // Check 2: Event is more than 18 months in the future
  if (eventDate > eighteenMonthsFromNow) {
    issues.push(`Event is more than 18 months in the future (${eventDate.toLocaleDateString()})`);
  }

  // Check 3: Event ID contains a different year
  const yearInId = event.id.match(/\b(20\d{2})\b/);
  if (yearInId && parseInt(yearInId[1]) !== eventYear) {
    issues.push(`ID contains year ${yearInId[1]} but event is dated ${eventYear}`);
  }

  if (issues.length > 0) {
    issuesFound += issues.length;
    console.log(`\x1b[33m⚠ ${event.title}\x1b[0m`);
    console.log(`  Organizer: ${event.organizer}`);
    console.log(`  Date: ${event.start}`);
    console.log(`  ID: ${event.id}`);
    issues.forEach(issue => console.log(`  \x1b[31m✗\x1b[0m ${issue}`));
    console.log('');
  }
});

console.log('==================================================');
if (issuesFound === 0) {
  console.log('\x1b[32m✓ No date issues found!\x1b[0m\n');
  process.exit(0);
} else {
  console.log(`\x1b[31m✗ Found ${issuesFound} date issue(s)\x1b[0m`);
  console.log('\nRecommendations:');
  console.log('  1. Review these events in the admin interface');
  console.log('  2. Delete incorrect events or fix dates');
  console.log('  3. Check the scraper for the organizer');
  console.log('  4. Consider filtering out past events in scraper\n');
  process.exit(1);
}
