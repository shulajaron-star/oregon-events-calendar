#!/usr/bin/env node

/**
 * Validation script for Oregon Events Calendar
 *
 * Checks:
 * - JSON syntax and schema compliance
 * - Date range (today through today + 12 months)
 * - No duplicate event IDs
 * - Required fields present
 * - Valid enum values
 * - ISO 8601 dates with America/Los_Angeles timezone
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ANSI color codes for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

let errorCount = 0;
let warningCount = 0;

function error(msg) {
  console.error(`${colors.red}✗ ERROR: ${msg}${colors.reset}`);
  errorCount++;
}

function warn(msg) {
  console.warn(`${colors.yellow}⚠ WARNING: ${msg}${colors.reset}`);
  warningCount++;
}

function info(msg) {
  console.log(`${colors.blue}ℹ ${msg}${colors.reset}`);
}

function success(msg) {
  console.log(`${colors.green}✓ ${msg}${colors.reset}`);
}

// Load and parse JSON files
function loadJSON(filepath) {
  try {
    const content = readFileSync(filepath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    error(`Failed to load or parse ${filepath}: ${err.message}`);
    return null;
  }
}

// Validate date format and timezone
function validateDate(dateStr, fieldName, eventId) {
  if (!dateStr) {
    error(`Event ${eventId}: ${fieldName} is missing`);
    return false;
  }

  // Check ISO 8601 format with timezone
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(-07:00|-08:00)$/;
  if (!iso8601Regex.test(dateStr)) {
    error(`Event ${eventId}: ${fieldName} "${dateStr}" is not in ISO 8601 format with Pacific timezone (-07:00 or -08:00)`);
    return false;
  }

  // Try to parse the date
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    error(`Event ${eventId}: ${fieldName} "${dateStr}" is not a valid date`);
    return false;
  }

  return true;
}

// Check if date is within the 12-month window
function isInWindow(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const twelveMonthsFromNow = new Date();
  twelveMonthsFromNow.setMonth(now.getMonth() + 12);

  // Set to start of day for comparison
  now.setHours(0, 0, 0, 0);

  return date >= now && date <= twelveMonthsFromNow;
}

// Validate event object
function validateEvent(event, allIds) {
  const requiredFields = ['id', 'title', 'organizer', 'start', 'status', 'first_seen', 'last_verified'];
  const validFormats = ['in_person', 'virtual', 'hybrid'];
  const validRegions = [
    'Portland Metro', 'Southwest Washington', 'Willamette Valley',
    'Eugene/Lane', 'Central Oregon', 'Southern Oregon',
    'Coast', 'Eastern Oregon', 'Statewide/Virtual'
  ];
  const validCategories = [
    'startup', 'training', 'investor', 'life_science',
    'networking', 'conference', 'underrepresented_founders'
  ];
  const validCosts = ['free', 'paid', 'unknown'];
  const validStatuses = ['confirmed', 'needs_review', 'cancelled', 'postponed'];

  // Check required fields
  for (const field of requiredFields) {
    if (!event[field]) {
      error(`Event ${event.id || 'unknown'}: Missing required field "${field}"`);
    }
  }

  // Check for duplicate IDs
  if (allIds.has(event.id)) {
    error(`Duplicate event ID: ${event.id}`);
  } else {
    allIds.add(event.id);
  }

  // Validate dates
  if (event.start) {
    validateDate(event.start, 'start', event.id);

    // Check if event is in the 12-month window
    if (!isInWindow(event.start)) {
      warn(`Event ${event.id}: Start date ${event.start} is outside the 12-month window`);
    }
  }

  if (event.end) {
    validateDate(event.end, 'end', event.id);

    // Check that end is after start
    if (event.start && event.end) {
      const start = new Date(event.start);
      const end = new Date(event.end);
      if (end < start) {
        error(`Event ${event.id}: End date is before start date`);
      }
    }
  }

  // Validate enums
  if (event.format && !validFormats.includes(event.format)) {
    error(`Event ${event.id}: Invalid format "${event.format}". Must be one of: ${validFormats.join(', ')}`);
  }

  if (event.region && !validRegions.includes(event.region)) {
    error(`Event ${event.id}: Invalid region "${event.region}". Must be one of: ${validRegions.join(', ')}`);
  }

  if (event.cost && !validCosts.includes(event.cost)) {
    error(`Event ${event.id}: Invalid cost "${event.cost}". Must be one of: ${validCosts.join(', ')}`);
  }

  if (event.status && !validStatuses.includes(event.status)) {
    error(`Event ${event.id}: Invalid status "${event.status}". Must be one of: ${validStatuses.join(', ')}`);
  }

  // Validate categories array
  if (event.categories) {
    if (!Array.isArray(event.categories)) {
      error(`Event ${event.id}: categories must be an array`);
    } else if (event.categories.length === 0) {
      error(`Event ${event.id}: categories array is empty`);
    } else {
      for (const cat of event.categories) {
        if (!validCategories.includes(cat)) {
          error(`Event ${event.id}: Invalid category "${cat}". Must be one of: ${validCategories.join(', ')}`);
        }
      }
    }
  }

  // Validate co_hosts is an array
  if (event.co_hosts && !Array.isArray(event.co_hosts)) {
    error(`Event ${event.id}: co_hosts must be an array`);
  }

  // Check for needs_review events
  if (event.status === 'needs_review') {
    info(`Event ${event.id}: Flagged for review - "${event.title}"`);
  }
}

// Main validation
function validate() {
  console.log('\n🔍 Validating Oregon Events Calendar data...\n');

  // Load events
  const eventsPath = join(projectRoot, 'data', 'events.json');
  const eventsData = loadJSON(eventsPath);

  if (!eventsData) {
    return 1;
  }

  if (!eventsData.events || !Array.isArray(eventsData.events)) {
    error('events.json must have an "events" array at the root');
    return 1;
  }

  info(`Found ${eventsData.events.length} events`);

  // Validate each event
  const allIds = new Set();
  for (const event of eventsData.events) {
    validateEvent(event, allIds);
  }

  // Load sources
  const sourcesPath = join(projectRoot, 'data', 'sources.json');
  const sourcesData = loadJSON(sourcesPath);

  if (sourcesData && sourcesData.sources) {
    info(`Found ${sourcesData.sources.length} sources`);

    // Check for sources that haven't been checked in a while
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const source of sourcesData.sources) {
      if (source.active && source.last_checked) {
        const lastChecked = new Date(source.last_checked);
        if (lastChecked < thirtyDaysAgo) {
          warn(`Source "${source.name}" hasn't been checked in over 30 days (last checked: ${source.last_checked})`);
        }
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  if (errorCount === 0 && warningCount === 0) {
    success('All validation checks passed!');
    return 0;
  } else {
    if (errorCount > 0) {
      error(`Found ${errorCount} error(s)`);
    }
    if (warningCount > 0) {
      warn(`Found ${warningCount} warning(s)`);
    }
    return errorCount > 0 ? 1 : 0;
  }
}

// Run validation
const exitCode = validate();
process.exit(exitCode);
