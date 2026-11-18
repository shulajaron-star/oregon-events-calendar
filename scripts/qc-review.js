#!/usr/bin/env node

/**
 * QC Review Script
 *
 * Reviews newly harvested events before adding them to events.json
 * Shows:
 * - Events missing times
 * - Event date/time summary
 * - Comparison with source URLs
 *
 * Usage: node scripts/qc-review.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PENDING_FILE = path.join(__dirname, '../data/events-pending.json');
const EVENTS_FILE = path.join(__dirname, '../data/events.json');

console.log('📋 EVENT QC REVIEW REPORT\n');
console.log('='.repeat(80));

// Check if pending file exists
if (!fs.existsSync(PENDING_FILE)) {
  console.log('\n❌ No pending events file found (data/events-pending.json)');
  console.log('   Run: npm run harvest:all to generate pending events\n');
  process.exit(1);
}

const pendingData = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf-8'));
const pendingEvents = pendingData.events || [];

if (pendingEvents.length === 0) {
  console.log('\n✓ No pending events to review\n');
  process.exit(0);
}

console.log(`\nFound ${pendingEvents.length} new events to review\n`);

// Group by issue type
const missingTime = [];
const hasTime = [];
const bySource = {};

pendingEvents.forEach(e => {
  const isMidnight = e.start.includes('T00:00:00');

  if (isMidnight) {
    missingTime.push(e);
  } else {
    hasTime.push(e);
  }

  bySource[e.organizer] = (bySource[e.organizer] || 0) + 1;
});

// Report 1: Events by source
console.log('1. EVENTS BY SOURCE:');
console.log('');
Object.entries(bySource).sort((a, b) => b[1] - a[1]).forEach(([org, count]) => {
  console.log(`   ${count.toString().padStart(3)} events - ${org}`);
});

// Report 2: Events missing times
console.log('\n' + '='.repeat(80));
console.log('\n2. EVENTS MISSING SPECIFIC TIMES (will show as all-day):');
console.log(`   ${missingTime.length} of ${pendingEvents.length} events\n`);

if (missingTime.length > 0) {
  missingTime.slice(0, 10).forEach(e => {
    console.log(`   📅 ${e.start.split('T')[0]} - ${e.title}`);
    console.log(`      Organizer: ${e.organizer}`);
    console.log(`      URL: ${e.registration_url || e.source_url}`);
    console.log('');
  });

  if (missingTime.length > 10) {
    console.log(`   ... and ${missingTime.length - 10} more\n`);
  }
}

// Report 3: Events with times (sample)
console.log('='.repeat(80));
console.log('\n3. EVENTS WITH SPECIFIC TIMES (sample):');
console.log(`   ${hasTime.length} of ${pendingEvents.length} events\n`);

hasTime.slice(0, 10).forEach(e => {
  console.log(`   ✓ ${e.start} - ${e.title}`);
  console.log(`      ${e.organizer}`);
  console.log('');
});

if (hasTime.length > 10) {
  console.log(`   ... and ${hasTime.length - 10} more\n`);
}

// Report 4: Date range check
console.log('='.repeat(80));
console.log('\n4. DATE RANGE CHECK:\n');

const dates = pendingEvents.map(e => new Date(e.start)).sort((a, b) => a - b);
const earliest = dates[0];
const latest = dates[dates.length - 1];

console.log(`   Earliest event: ${earliest.toDateString()}`);
console.log(`   Latest event:   ${latest.toDateString()}`);
console.log(`   Span:          ${Math.round((latest - earliest) / (1000 * 60 * 60 * 24))} days\n`);

// Report 5: Summary and next steps
console.log('='.repeat(80));
console.log('\n📊 SUMMARY:\n');
console.log(`   Total pending events:     ${pendingEvents.length}`);
console.log(`   Events with times:        ${hasTime.length} (${Math.round(hasTime.length / pendingEvents.length * 100)}%)`);
console.log(`   Events without times:     ${missingTime.length} (${Math.round(missingTime.length / pendingEvents.length * 100)}%)`);
console.log(`   Unique sources:           ${Object.keys(bySource).length}`);

console.log('\n' + '='.repeat(80));
console.log('\n✅ NEXT STEPS:\n');
console.log('   1. Review the events above');
console.log('   2. Check a few source URLs to verify accuracy');
console.log('   3. If satisfied, run: node scripts/qc-approve.js');
console.log('   4. Or to reject: rm data/events-pending.json\n');
