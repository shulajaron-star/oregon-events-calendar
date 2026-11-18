#!/usr/bin/env node

/**
 * API Investigation Tool
 *
 * This script helps identify API endpoints used by event pages
 * Run this and examine the output to find data sources
 */

import axios from 'axios';

console.log('🔍 Investigating Event Page APIs...\n');

// Test common API patterns
const sites = [
  {
    name: 'Oregon Life Sciences',
    base: 'https://oregonlifesciences.org',
    tests: [
      '/events',
      '/events.json',
      '/api/events',
      '/wp-json/tribe/events/v1/events',
      '/?feed=tribe_events',
    ]
  },
  {
    name: 'Oregon Entrepreneurs Network',
    base: 'https://oen.app.neoncrm.com',
    tests: [
      '/nx/portal/event-calendar',
      '/api/events',
      '/nx/api/events',
    ]
  }
];

async function testEndpoint(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json,text/html,*/*'
      },
      timeout: 5000,
      maxRedirects: 5
    });

    const contentType = response.headers['content-type'] || '';
    const isJson = contentType.includes('application/json');
    const hasJsonData = typeof response.data === 'object';

    return {
      status: response.status,
      contentType,
      isJson,
      hasJsonData,
      dataType: Array.isArray(response.data) ? 'array' : typeof response.data,
      dataKeys: hasJsonData ? Object.keys(response.data).slice(0, 5) : [],
      dataLength: response.data?.length || (typeof response.data === 'string' ? response.data.length : 0)
    };
  } catch (error) {
    return {
      error: error.response?.status || error.code || error.message
    };
  }
}

async function investigate() {
  for (const site of sites) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`\n🌐 ${site.name}`);
    console.log(`   Base: ${site.base}\n`);

    for (const path of site.tests) {
      const url = site.base + path;
      console.log(`   Testing: ${path}`);

      const result = await testEndpoint(url);

      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      } else {
        console.log(`   ✓ Status: ${result.status}`);
        console.log(`   Content-Type: ${result.contentType}`);

        if (result.isJson || result.hasJsonData) {
          console.log(`   🎯 JSON FOUND!`);
          console.log(`   Data Type: ${result.dataType}`);
          if (result.dataKeys.length) {
            console.log(`   Keys: ${result.dataKeys.join(', ')}`);
          }
        } else {
          console.log(`   HTML/Text (${result.dataLength} chars)`);
        }
      }
      console.log();
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📋 Next Steps:');
  console.log('   1. Check output above for any "JSON FOUND" messages');
  console.log('   2. If found, test the endpoint in your browser');
  console.log('   3. If no APIs found, we\'ll need Playwright for JavaScript rendering\n');
  console.log('💡 Manual Check:');
  console.log('   Open these URLs in browser DevTools (Network tab):');
  console.log('   - https://oregonlifesciences.org/events');
  console.log('   - https://oen.app.neoncrm.com/nx/portal/event-calendar');
  console.log('   Look for XHR/Fetch requests returning JSON with event data\n');
}

investigate().catch(console.error);
