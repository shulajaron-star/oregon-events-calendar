#!/usr/bin/env node

/**
 * QC Approval Script
 *
 * Merges approved events from events-pending.json into events.json
 *
 * Usage: node scripts/qc-approve.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PENDING_FILE = path.join(__dirname, '../data/events-pending.json');
const EVENTS_FILE = path.join(__dirname, '../data/events.json');

console.log('✅ Approving pending events...\n');

// Check if pending file exists
if (!fs.existsSync(PENDING_FILE)) {
  console.log('❌ No pending events file found');
  process.exit(1);
}

const pendingData = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf-8'));
const pendingEvents = pendingData.events || [];

if (pendingEvents.length === 0) {
  console.log('✓ No pending events to approve\n');
  process.exit(0);
}

// Load existing events
const existingData = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
const existingEvents = existingData.events || [];

console.log(`Current events: ${existingEvents.length}`);
console.log(`Pending events: ${pendingEvents.length}`);

// Merge - add any pending events that don't already exist by ID
let addedCount = 0;
let updatedCount = 0;

pendingEvents.forEach(pendingEvent => {
  const existingIndex = existingEvents.findIndex(e => e.id === pendingEvent.id);

  if (existingIndex === -1) {
    existingEvents.push(pendingEvent);
    addedCount++;
  } else {
    existingEvents[existingIndex] = pendingEvent;
    updatedCount++;
  }
});

// Sort by date
existingEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

// Save
fs.writeFileSync(EVENTS_FILE, JSON.stringify({ events: existingEvents }, null, 2));

// Remove pending file
fs.unlinkSync(PENDING_FILE);

console.log('');
console.log('='.repeat(60));
console.log('✓ Events approved!');
console.log(`  Added:   ${addedCount} new events`);
console.log(`  Updated: ${updatedCount} existing events`);
console.log(`  Total:   ${existingEvents.length} events in calendar`);
console.log('');
console.log('Next steps:');
console.log('  - Run: npm run deduplicate');
console.log('  - Run: npm run validate');
console.log('  - Run: npm run build');
console.log('');
