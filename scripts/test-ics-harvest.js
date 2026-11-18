#!/usr/bin/env node

/**
 * Test script to harvest events from an ICS feed
 * This demonstrates how we can automatically pull real events from organizations
 */

import https from 'https';
import ical from 'node-ical';

// Test with RAIN's ICS feed
const ICS_URL = 'https://raincatalysts.org/events/?ical=1';

console.log('🔍 Fetching ICS feed from RAIN Catalysts...\n');

https.get(ICS_URL, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('✓ ICS feed fetched successfully\n');

    // Parse the ICS data
    const events = ical.sync.parseICS(data);

    console.log('📅 Events found in feed:\n');
    console.log('='.repeat(80));

    let count = 0;
    for (const key in events) {
      const event = events[key];

      // Only process VEVENT items (actual events)
      if (event.type === 'VEVENT') {
        count++;

        console.log(`\n${count}. ${event.summary}`);
        console.log(`   Date: ${event.start}`);
        console.log(`   Location: ${event.location || 'Not specified'}`);
        console.log(`   URL: ${event.url || 'Not specified'}`);
        console.log(`   Categories: ${event.categories?.join(', ') || 'None'}`);
        console.log(`   Description: ${(event.description || '').substring(0, 150)}...`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n✓ Total events found: ${count}\n`);

    console.log('💡 Next steps:');
    console.log('   1. We can automatically parse these events');
    console.log('   2. Apply scope rules (startup/life science relevance)');
    console.log('   3. Add to data/events.json');
    console.log('   4. Run this weekly to catch new events\n');
  });
}).on('error', (err) => {
  console.error('❌ Error fetching ICS feed:', err.message);
});
