#!/usr/bin/env node
// Drop pending events that are already on the calendar (same id, or same title
// on the same date) or that were rejected in the admin page before.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { matchKey } = require('./lib/match-key.cjs');
const dataDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../data');
const read = (name, fallback) => {
  const file = path.join(dataDir, name);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : fallback;
};

const pending = read('events-pending.json', { events: [] });
const calendar = read('events.json', { events: [] }).events || [];
const archiveDir = path.join(dataDir, 'archive');
const archived = fs.existsSync(archiveDir)
  ? fs.readdirSync(archiveDir).filter(f => f.endsWith('.json'))
      .flatMap(f => read(path.join('archive', f), { events: [] }).events || [])
  : [];
const rejected = read('events-rejected.json', { events: [] }).events || [];

const ids = new Set();
const keys = new Set();
for (const e of [...calendar, ...archived]) { ids.add(e.id); keys.add(matchKey(e.title, e.start)); }
for (const r of rejected) { ids.add(r.id); keys.add(r.key); }

const seen = new Set();
const kept = [];
for (const e of pending.events || []) {
  const key = matchKey(e.title, e.start);
  if (ids.has(e.id) || keys.has(key)) {
    console.log(`  skip (already on calendar or rejected): ${e.title} ${e.start?.slice(0, 10)}`);
    continue;
  }
  if (seen.has(key)) continue;
  seen.add(key);
  kept.push(e);
}

fs.writeFileSync(path.join(dataDir, 'events-pending.json'), JSON.stringify({ ...pending, events: kept }, null, 2));
console.log(`Pending events after filtering: ${kept.length} (removed ${(pending.events || []).length - kept.length})`);
