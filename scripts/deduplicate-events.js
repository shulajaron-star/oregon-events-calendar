#!/usr/bin/env node

/**
 * Event Deduplication Script
 *
 * Removes duplicate events based on title + date similarity
 * Keeps the version with the most complete data
 *
 * Usage: node scripts/deduplicate-events.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EVENTS_FILE = path.join(__dirname, '../data/events.json');

// Helper: Normalize title for comparison
function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')  // Remove punctuation
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();
}

// Helper: Score event data completeness
function scoreEvent(event) {
  let score = 0;

  if (event.venue) score += 2;
  if (event.city) score += 2;
  if (event.end) score += 1;
  if (event.summary && event.summary.length > 50) score += 2;
  if (event.co_hosts && event.co_hosts.length > 0) score += 1;
  if (event.cost && event.cost !== 'unknown') score += 1;
  if (event.location) score += 1;

  // Prefer non-scraped sources (manual entries are usually better)
  if (!event.id.includes('rain-regional-accele') &&
      !event.id.includes('oregon-life-sciences-') &&
      !event.id.includes('oregon-entrepreneurs-')) {
    score += 3;
  }

  return score;
}

// Helper: Check if two events are duplicates
function areDuplicates(event1, event2) {
  // Same date (within same day)
  const date1 = event1.start.split('T')[0];
  const date2 = event2.start.split('T')[0];

  if (date1 !== date2) return false;

  // Similar titles
  const title1 = normalizeTitle(event1.title);
  const title2 = normalizeTitle(event2.title);

  // Exact match
  if (title1 === title2) return true;

  // One contains the other (e.g., "Event Name" vs "Event Name | Location")
  if (title1.includes(title2) || title2.includes(title1)) return true;

  // Calculate similarity (simple word overlap)
  const words1 = new Set(title1.split(' ').filter(w => w.length > 3));
  const words2 = new Set(title2.split(' ').filter(w => w.length > 3));

  if (words1.size === 0 || words2.size === 0) return false;

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const similarity = intersection.size / Math.min(words1.size, words2.size);

  return similarity > 0.8;  // 80% word overlap
}

// Main deduplication function
function deduplicateEvents() {
  console.log('🔍 Deduplicating events...\n');

  const data = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
  const events = data.events;

  console.log(`Found ${events.length} total events\n`);

  // Track events to keep
  const toKeep = [];
  const toRemove = [];

  // Check each event against all others
  for (let i = 0; i < events.length; i++) {
    if (toRemove.includes(i)) continue;

    const event1 = events[i];
    let bestVersion = { event: event1, index: i, score: scoreEvent(event1) };
    const duplicates = [];

    for (let j = i + 1; j < events.length; j++) {
      if (toRemove.includes(j)) continue;

      const event2 = events[j];

      if (areDuplicates(event1, event2)) {
        duplicates.push(j);
        const score2 = scoreEvent(event2);

        if (score2 > bestVersion.score) {
          bestVersion = { event: event2, index: j, score: score2 };
        }
      }
    }

    if (duplicates.length > 0) {
      console.log(`Found duplicate group for: ${event1.title}`);
      console.log(`  Date: ${event1.start.split('T')[0]}`);
      console.log(`  Versions found: ${duplicates.length + 1}`);

      // Mark all duplicates for removal except the best one
      [i, ...duplicates].forEach(idx => {
        if (idx !== bestVersion.index) {
          toRemove.push(idx);
          console.log(`  ❌ Removing: ${events[idx].id} (score: ${scoreEvent(events[idx])})`);
        }
      });

      console.log(`  ✓ Keeping: ${bestVersion.event.id} (score: ${bestVersion.score})`);
      console.log();
    }
  }

  // Create filtered list
  const deduplicated = events.filter((_, idx) => !toRemove.includes(idx));

  // Save
  fs.writeFileSync(EVENTS_FILE, JSON.stringify({ events: deduplicated }, null, 2));

  console.log('=' .repeat(80));
  console.log('\n📊 Deduplication Summary:');
  console.log(`   Original events: ${events.length}`);
  console.log(`   Duplicates removed: ${toRemove.length}`);
  console.log(`   Final unique events: ${deduplicated.length}`);
  console.log('\n✓ Deduplication complete!\n');

  return {
    original: events.length,
    removed: toRemove.length,
    final: deduplicated.length
  };
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  deduplicateEvents();
}

export default deduplicateEvents;
