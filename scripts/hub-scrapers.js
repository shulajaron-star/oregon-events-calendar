/**
 * Readers for Oregon Innovation Hub and regional economic development sources
 *
 * Added 2026-11-24. Each reader returns finished event objects (the same
 * shape as data/events.json), so harvest-html-pages.js uses them as they are
 * instead of running them through its text date parser.
 *
 * A reader only runs when its source is in data/sources.json with
 * "active": true. Match is on the source name.
 *
 * How each site is read (checked 2026-11-24):
 *   EDCO ......................... Webflow page, server rendered cards (Playwright)
 *   Metro Region Innovation Hub .. Wix Events list, then JSON-LD on each event page (Playwright)
 *   Cascades West Innovation Hub . public Google Calendar ICS feed (no browser)
 *   South Coast Dev. Council ..... WordPress theme list, article.event_post (Playwright)
 *   Northwest Innovation Hub ..... no event listing on the page yet; reader looks for
 *                                  JSON-LD events or event links and reports what it found
 *   Mid-Columbia Innovation Hub .. The Events Calendar REST API (no browser)
 *   Oregon Frontier Innovation Hub Squarespace list section with "Date:/Time:/Location:" text (Playwright)
 *   Southern Oregon Innovation Hub The Events Calendar REST API (no browser)
 *   Klamath & Lake Counties Hub .. Astro static page, event cards (Playwright)
 */

import fs from 'fs';
import path from 'path';
import ical from 'node-ical';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SOURCES_FILE = path.join(__dirname, '../data/sources.json');

const TZ = 'America/Los_Angeles';
const USER_AGENT = 'OregonEventsCalendarBot/1.0 (+https://oregonstartupeventscalendar.netlify.app/)';

// ---------------------------------------------------------------------------
// Time helpers. Everything is converted to Pacific wall-clock time with the
// correct -07:00 / -08:00 offset for that date, whatever zone the runner is in.
// ---------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, '0');

const tzParts = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
  timeZoneName: 'shortOffset',
});

function offsetForInstant(date) {
  const name = tzParts.formatToParts(date).find(p => p.type === 'timeZoneName').value; // "GMT-7"
  return name.includes('-7') ? '-07:00' : '-08:00';
}

/** An absolute instant (Date) as Pacific ISO 8601. */
export function instantToPacific(date) {
  if (!(date instanceof Date) || isNaN(date)) return null;
  const p = Object.fromEntries(tzParts.formatToParts(date).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offsetForInstant(date)}`;
}

/** A Pacific wall-clock date and time as ISO 8601 with the right offset. */
export function pacificWallClock(y, m, d, h = 0, min = 0) {
  // Probe at the given wall-clock hour read as PST; close enough to pick the offset.
  const probe = new Date(Date.UTC(y, m - 1, d, h + 8, min));
  return `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00${offsetForInstant(probe)}`;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Finds a calendar date in text like "December 22, 2026", "Wed 13 Jan 2027"
 * or "Friday, October 23, 2026". Returns { y, m, d } or null.
 */
export function parseDayText(text) {
  if (!text) return null;
  const t = text.replace(/\s+/g, ' ');
  let m = t.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (m) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    if (mi >= 0) return { y: +m[3], m: mi + 1, d: +m[2] };
  }
  m = t.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/);
  if (m) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi >= 0) return { y: +m[3], m: mi + 1, d: +m[1] };
  }
  return null;
}

/**
 * Finds a time or time range like "8:30 AM – 10:00 AM", "4:30–6:30 PM PT"
 * or "9am". Returns { start: {h, min}, end: {h, min} | null } or null.
 */
export function parseTimeRange(text) {
  if (!text) return null;
  const re = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/gi;
  const t = text.replace(/noon/i, '12:00 PM');
  const found = [];
  let m;
  while ((m = re.exec(t)) !== null) {
    // Skip bare numbers with no minutes and no am/pm (dates, years, street numbers).
    if (!m[2] && !m[3]) continue;
    const h = +m[1];
    if (h > 23) continue;
    found.push({ h, min: m[2] ? +m[2] : 0, ap: m[3] ? m[3][0].toLowerCase() : null });
    if (found.length === 2) break;
  }
  if (found.length === 0) return null;
  // "4:30–6:30 PM": the first time takes the second one's am/pm.
  if (found[1] && !found[0].ap && found[1].ap) {
    found[0].ap = found[1].ap;
    // ...unless that would put the start after the end (e.g. "11:00–1:00 PM").
    if (found[0].ap === 'p' && found[0].h !== 12 && found[0].h > found[1].h % 12) found[0].ap = 'a';
  }
  const to24 = ({ h, min, ap }) => {
    let hh = h;
    if (ap === 'p' && h < 12) hh += 12;
    if (ap === 'a' && h === 12) hh = 0;
    return { h: hh, min };
  };
  return { start: to24(found[0]), end: found[1] ? to24(found[1]) : null };
}

/** Builds start/end ISO strings from a date text and an optional time text. */
export function buildTimes(dayText, timeText) {
  const day = parseDayText(dayText);
  if (!day) return null;
  const times = parseTimeRange(timeText);
  if (!times) {
    // All-day event (no time stated): 00:00:00 per project convention.
    return { start: pacificWallClock(day.y, day.m, day.d), end: null };
  }
  return {
    start: pacificWallClock(day.y, day.m, day.d, times.start.h, times.start.min),
    end: times.end ? pacificWallClock(day.y, day.m, day.d, times.end.h, times.end.min) : null,
  };
}

// ---------------------------------------------------------------------------
// Event object helpers
// ---------------------------------------------------------------------------

const REGION_MAP = {
  'portland': 'Portland Metro', 'beaverton': 'Portland Metro', 'hillsboro': 'Portland Metro',
  'gresham': 'Portland Metro', 'tigard': 'Portland Metro', 'lake oswego': 'Portland Metro',
  'oregon city': 'Portland Metro', 'tualatin': 'Portland Metro', 'milwaukie': 'Portland Metro',
  'vancouver': 'Southwest Washington', 'camas': 'Southwest Washington', 'longview': 'Southwest Washington',
  'corvallis': 'Willamette Valley', 'albany': 'Willamette Valley', 'salem': 'Willamette Valley',
  'lebanon': 'Willamette Valley', 'mcminnville': 'Willamette Valley',
  'eugene': 'Eugene/Lane', 'springfield': 'Eugene/Lane',
  'astoria': 'Coast', 'seaside': 'Coast', 'tillamook': 'Coast', 'newport': 'Coast',
  'lincoln city': 'Coast', 'florence': 'Coast', 'coos bay': 'Coast', 'north bend': 'Coast',
  'bandon': 'Coast', 'gold beach': 'Coast', 'brookings': 'Coast', 'port orford': 'Coast',
  'bend': 'Central Oregon', 'redmond': 'Central Oregon', 'prineville': 'Central Oregon',
  'sisters': 'Central Oregon', 'sunriver': 'Central Oregon', 'la pine': 'Central Oregon',
  'madras': 'Central Oregon', 'powell butte': 'Central Oregon',
  'ashland': 'Southern Oregon', 'medford': 'Southern Oregon', 'grants pass': 'Southern Oregon',
  'roseburg': 'Southern Oregon', 'klamath falls': 'Southern Oregon', 'lakeview': 'Southern Oregon',
  'hood river': 'Eastern Oregon', 'the dalles': 'Eastern Oregon', 'maupin': 'Eastern Oregon',
  'pendleton': 'Eastern Oregon', 'la grande': 'Eastern Oregon', 'baker city': 'Eastern Oregon',
  'ontario': 'Eastern Oregon', 'arlington': 'Eastern Oregon', 'hermiston': 'Eastern Oregon',
  'john day': 'Eastern Oregon', 'burns': 'Eastern Oregon', 'enterprise': 'Eastern Oregon',
};

const VIRTUAL_RE = /\b(virtual|online|zoom|webinar|teams)\b/i;

function findCity(text) {
  const lower = (text || '').toLowerCase();
  for (const city of Object.keys(REGION_MAP)) {
    if (new RegExp(`\\b${city}\\b`).test(lower)) {
      return city.replace(/\b\w/g, c => c.toUpperCase());
    }
  }
  return null;
}

function categorize(text) {
  const t = text.toLowerCase();
  const c = [];
  if (/\b(bio\w*|life science|medtech|medical device|health ?tech|digital health|pharma)\b/.test(t)) c.push('life_science');
  if (/\b(startup|start-up|entrepreneur\w*|founder\w*|venture|pitch|accelerator|incubator|innovat\w*|1 million cups)\b/.test(t)) c.push('startup');
  if (/\b(investor\w*|angel|funding|capital|sbir|sttr)\b/.test(t)) c.push('investor');
  if (/\b(workshop|training|bootcamp|class|course|webinar|lab|instruction)\b/.test(t)) c.push('training');
  if (/\b(network\w*|meetup|coffee|pubtalk|hubtalk|social|mixer|after hours)\b/.test(t)) c.push('networking');
  if (/\b(conference|summit|symposium|showcase)\b/.test(t)) c.push('conference');
  if (/\b(women|diverse|diversity|underrepresented|latin[oax]|bipoc|tribal|veteran)\b/.test(t)) c.push('underrepresented_founders');
  if (c.length === 0) c.push('startup');
  return [...new Set(c)];
}

// Words that show a startup, innovation, investor or life science angle.
const SCOPE_RE = /\b(startup|start-up|entrepreneur\w*|founder\w*|venture|pitch|accelerator|incubator|innovat\w*|investor\w*|angel|funding|capital|sbir|sttr|grant|commerciali\w*|bio\w*|life science|medtech|tech\w*|prototyp\w*|1 million cups|pubtalk|hubtalk|maker\w*|ai\b|artificial intelligence|business plan|ideation|design thinking)\b/i;

function slug(s, max) {
  return s.toLowerCase().replace(/&#?\w+;/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, max);
}

function makeId(organizer, title, start) {
  const titleSlug = slug(title, 200).split('-').filter(w => w.length > 2).slice(0, 4).join('-');
  return `${slug(organizer, 20)}-${titleSlug}-${start.split('T')[0]}`;
}

function decodeEntities(s) {
  return (s || '')
    .replace(/&#8211;|&ndash;/g, '-').replace(/&#8212;|&mdash;/g, '-')
    .replace(/&#8217;|&#8216;|&rsquo;|&lsquo;/g, "'").replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#038;|&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Turns raw fields into an event object. `cfg` is the reader config below.
 * Events outside today .. today + 12 months are dropped (returns null).
 */
function toEvent(cfg, raw) {
  if (!raw.title || !raw.start) return null;
  const startDate = new Date(raw.start);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowEnd = new Date(now);
  windowEnd.setMonth(windowEnd.getMonth() + 12);
  if (isNaN(startDate) || startDate < todayStart || startDate > windowEnd) return null;

  const title = decodeEntities(raw.title);
  const location = decodeEntities(raw.location || '');
  const description = decodeEntities(raw.description || '');
  const text = `${title} ${description}`;

  const city = raw.city || findCity(location) || findCity(title) || null;
  const virtual = VIRTUAL_RE.test(location) || (!location && VIRTUAL_RE.test(title));
  const region = (city && REGION_MAP[city.toLowerCase()]) || (virtual ? 'Statewide/Virtual' : cfg.defaultRegion);

  let cost = raw.cost || 'unknown';
  if (cost !== 'free' && cost !== 'paid' && cost !== 'unknown') {
    cost = /free/i.test(cost) ? 'free' : /\$\s*\d|paid|\d+\.\d\d/.test(cost) ? 'paid' : 'unknown';
  }

  const today = new Date().toISOString().split('T')[0];
  const event = {
    id: makeId(cfg.name, title, raw.start),
    title,
    organizer: cfg.name,
    co_hosts: [],
    start: raw.start,
    end: raw.end && new Date(raw.end) >= startDate ? raw.end : null,
    format: virtual ? 'virtual' : 'in_person',
    venue: location || null,
    city,
    region,
    categories: categorize(text),
    cost,
    registration_url: raw.url || cfg.eventsUrl,
    source_url: cfg.eventsUrl,
    summary: `${raw.kind ? raw.kind + ' from ' : 'Event from '}${cfg.name}${city ? ` in ${city}` : virtual ? ', online' : ''}. See the event page for details.`,
    status: 'confirmed',
    first_seen: today,
    last_verified: today,
  };

  // Regional development councils also run general business events. Flag the
  // ones with no startup, innovation or life science angle for a scope call.
  if (cfg.scopeCheck && !SCOPE_RE.test(text)) {
    event.status = 'needs_review';
    event.review_reason = 'General business event from a regional development council; check it has a startup or innovation angle.';
  }
  return event;
}

async function getText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function getJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function excluded(cfg, title) {
  return (cfg.excludeTitles || []).some(re => re.test(title || ''));
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

/** The Events Calendar (WordPress) REST API: /wp-json/tribe/events/v1/events */
async function readTribeApi(cfg) {
  const out = [];
  const start = new Date().toISOString().split('T')[0];
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 12);
  let url = `${cfg.apiUrl}?per_page=50&start_date=${start}&end_date=${endDate.toISOString().split('T')[0]}`;
  for (let pageNo = 0; url && pageNo < 20; pageNo++) {
    const data = await getJSON(url);
    for (const e of data.events || []) {
      const title = decodeEntities(e.title);
      if (!title || excluded(cfg, title)) continue;
      let startISO, endISO;
      if (e.all_day) {
        const [y, m, d] = e.start_date.split(' ')[0].split('-').map(Number);
        startISO = pacificWallClock(y, m, d);
        endISO = null;
      } else {
        startISO = instantToPacific(new Date(e.utc_start_date.replace(' ', 'T') + 'Z'));
        endISO = e.utc_end_date ? instantToPacific(new Date(e.utc_end_date.replace(' ', 'T') + 'Z')) : null;
      }
      const v = Array.isArray(e.venue) ? null : e.venue;
      const location = v ? [v.venue, v.address, v.city].filter(Boolean).join(', ') : '';
      out.push(toEvent(cfg, {
        title,
        start: startISO,
        end: endISO,
        location,
        city: v && v.city && REGION_MAP[v.city.toLowerCase()] ? v.city : null,
        description: e.excerpt || e.description || '',
        url: e.website || e.url,
        cost: e.cost || (e.cost_details && e.cost_details.values && e.cost_details.values.length ? 'paid' : 'unknown'),
      }));
    }
    url = data.next_rest_url || null;
  }
  return out.filter(Boolean);
}

/** Public ICS feed, with recurring events expanded within the window. */
async function readIcsFeed(cfg) {
  const text = await getText(cfg.icsUrl);
  const parsed = ical.sync.parseICS(text);
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setMonth(windowEnd.getMonth() + 12);
  const out = [];

  for (const ev of Object.values(parsed)) {
    if (ev.type !== 'VEVENT') continue;
    const title = typeof ev.summary === 'string' ? ev.summary : ev.summary?.val;
    if (!title || excluded(cfg, title)) continue;
    if (ev.status && /cancel/i.test(ev.status)) continue;

    const allDay = ev.datetype === 'date';
    const durationMs = ev.end ? new Date(ev.end) - new Date(ev.start) : 0;
    let starts = [new Date(ev.start)];
    if (ev.rrule) {
      starts = ev.rrule.between(now, windowEnd, true);
      const ex = new Set(Object.values(ev.exdate || {}).map(d => new Date(d).toISOString().split('T')[0]));
      starts = starts.filter(d => !ex.has(d.toISOString().split('T')[0]));
    }

    for (const s of starts) {
      let startISO, endISO;
      if (allDay) {
        // All-day dates come back as UTC midnight of the calendar day.
        startISO = pacificWallClock(s.getUTCFullYear(), s.getUTCMonth() + 1, s.getUTCDate());
        endISO = null;
      } else {
        startISO = instantToPacific(s);
        endISO = durationMs > 0 ? instantToPacific(new Date(s.getTime() + durationMs)) : null;
      }
      const desc = typeof ev.description === 'string' ? ev.description : '';
      const link = (desc.match(/https?:\/\/[^\s"<>]+/) || [])[0];
      out.push(toEvent(cfg, {
        title,
        start: startISO,
        end: endISO,
        location: typeof ev.location === 'string' ? ev.location : '',
        description: desc,
        url: (typeof ev.url === 'string' && ev.url) || link || cfg.eventsUrl,
      }));
    }
  }
  return out.filter(Boolean);
}

async function gotoPage(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
}

/** EDCO (Webflow): .events_item cards with a date tag. No times or links are given. */
async function readEdco(cfg, page) {
  await gotoPage(page, cfg.eventsUrl);
  const cards = await page.$$eval('.events_item', items => items.map(it => ({
    date: [...it.querySelectorAll('.card_date-wrapper > *')].map(x => x.textContent.trim()).join(' '),
    title: it.querySelector('h3')?.textContent.trim(),
    location: it.querySelector('.text-size-small')?.textContent.trim() || '',
    description: it.querySelector('.text-color-black-secondary')?.textContent.trim() || '',
    href: it.querySelector('a')?.getAttribute('href') || '',
  })));
  return cards.map(c => {
    const times = buildTimes(c.date, null); // only a date is listed
    if (!times || !c.title) return null;
    const url = c.href && c.href !== '#' ? new URL(c.href, cfg.eventsUrl).href : cfg.eventsUrl;
    return toEvent(cfg, { ...c, location: c.location.replace(/\s*\|\s*/g, ', '), ...times, url });
  }).filter(Boolean);
}

/** Wix Events: collect /event-details/ links, then read JSON-LD on each page. */
async function readWixEvents(cfg, page) {
  const links = new Set();
  for (const listUrl of cfg.listUrls) {
    await gotoPage(page, listUrl);
    await page.waitForTimeout(3000);
    const found = await page.$$eval('a[href*="/event-details/"]', as => as.map(a => a.href.split('?')[0]));
    found.forEach(l => links.add(l));
  }
  const out = [];
  for (const link of links) {
    await gotoPage(page, link);
    const items = await page.$$eval('script[type="application/ld+json"]', ss => ss.map(s => s.textContent));
    for (const raw of items) {
      let data;
      try { data = JSON.parse(raw); } catch { continue; }
      for (const ld of [].concat(data['@graph'] || data)) {
        if (ld['@type'] !== 'Event' || !ld.startDate) continue;
        const loc = ld.location || {};
        const addr = typeof loc.address === 'string' ? loc.address : [loc.address?.streetAddress, loc.address?.addressLocality].filter(Boolean).join(', ');
        const online = /OnlineEventAttendanceMode/.test(ld.eventAttendanceMode || '') || loc['@type'] === 'VirtualLocation';
        out.push(toEvent(cfg, {
          title: ld.name,
          start: instantToPacific(new Date(ld.startDate)),
          end: ld.endDate ? instantToPacific(new Date(ld.endDate)) : null,
          location: online ? 'Online' : [loc.name, addr].filter(Boolean).join(', '),
          description: ld.description || '',
          url: link,
        }));
      }
    }
  }
  return out.filter(Boolean);
}

/** South Coast Development Council (custom WordPress theme): article.event_post */
async function readScdc(cfg, page) {
  await gotoPage(page, cfg.eventsUrl);
  const cards = await page.$$eval('article.event_post', items => items.map(it => ({
    when: it.querySelector('.post-list-meta')?.textContent.trim() || '',
    title: it.querySelector('h2')?.textContent.trim(),
    url: it.querySelector('h2 a')?.href || '',
    description: it.querySelector('p')?.textContent.trim() || '',
  })));
  return cards.map(c => {
    // "December 22, 2026 @ 8:30 AM – 10:00 AM"
    const [dayPart, timePart] = c.when.split('@');
    const times = buildTimes(dayPart, timePart);
    if (!times || !c.title) return null;
    // Titles often end with the town: "Morning Grind Mastermind – Coos Bay"
    return toEvent(cfg, { ...c, ...times, location: findCity(c.title) || '' });
  }).filter(Boolean);
}

/** Oregon Frontier (Squarespace list section): "Date: / Time: / Location: / Cost:" lines. */
async function readSquarespaceList(cfg, page) {
  await gotoPage(page, cfg.eventsUrl);
  const cards = await page.$$eval('.list-item', items => items.map(it => ({
    title: it.querySelector('.list-item-content__title')?.textContent.trim(),
    body: it.querySelector('.list-item-content__description')?.innerText || '',
    url: it.querySelector('a[href]')?.href || '',
  })));
  return cards.map(c => {
    const field = (name) => (c.body.match(new RegExp(`${name}:\\s*([^\\n]+)`, 'i')) || [])[1]?.trim() || '';
    const times = buildTimes(field('Date'), field('Time'));
    if (!times || !c.title) return null;
    const costText = field('Cost');
    return toEvent(cfg, {
      title: c.title,
      ...times,
      location: field('Location'),
      description: c.body,
      url: c.url,
      cost: costText ? (/free/i.test(costText) ? 'free' : 'paid') : 'unknown',
    });
  }).filter(Boolean);
}

/** Klamath & Lake Counties Innovation Hub (Astro): grid of cards with date, time, place spans. */
async function readKlamathHub(cfg, page) {
  await gotoPage(page, cfg.eventsUrl);
  const cards = await page.$$eval('div.grid > div.rounded-lg', items => items.map(it => ({
    kind: it.querySelector('.absolute')?.textContent.trim() || '',
    title: it.querySelector('h3')?.textContent.trim(),
    description: it.querySelector('h3 + p, p')?.textContent.trim() || '',
    spans: [...it.querySelectorAll('span')].map(s => s.textContent.trim()).filter(Boolean),
    url: [...it.querySelectorAll('a[href]')].map(a => a.href).find(h => !h.startsWith('javascript')) || '',
  })));
  return cards.flatMap(c => {
    if (!c.title) return [];
    const nextSpan = c.spans.find(s => /^Next dates:\s*\S/i.test(s)) || '';
    const isDate = (s) => /\b\d{4}\b/.test(s) && /[A-Za-z]{3}/.test(s) && !/^Next dates/i.test(s);
    const dateSpan = c.spans.find(isDate) || '';
    const timeSpan = c.spans.find(s => /\d{1,2}(:\d{2})?\s*(am|pm)/i.test(s)) || '';
    const placeSpan = c.spans.find(s => s !== dateSpan && s !== timeSpan &&
      !/^Next dates/i.test(s) && !/\b(every|each)\b/i.test(s)) || '';
    const costText = (c.description.match(/free|\$\s*\d+/i) || [])[0];
    const cost = costText ? (/free/i.test(costText) && !/\$/.test(c.description) ? 'free' : 'paid') : 'unknown';
    // Repeating events list later dates as "Next dates: Dec 8, 2026 · Jan 26, 2027 · ..."
    const days = [dateSpan, ...nextSpan.replace(/^Next dates:/i, '').split(/[·•|]/)].map(x => x.trim()).filter(Boolean);
    return days.map(day => {
      const times = buildTimes(day, timeSpan);
      if (!times) return null;
      return toEvent(cfg, {
        title: c.title,
        ...times,
        location: placeSpan,
        description: c.description,
        url: c.url,
        kind: c.kind || null,
        cost,
      });
    }).filter(Boolean);
  });
}

/**
 * Fallback for pages with no event list yet (Northwest Innovation Hub).
 * Reads schema.org Event JSON-LD if the page ever adds it, and logs any
 * event links so the next run's report shows when the page starts listing events.
 */
async function readGenericPage(cfg, page) {
  await gotoPage(page, cfg.eventsUrl);
  const { lds, links } = await page.evaluate(() => ({
    lds: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => s.textContent),
    links: [...document.querySelectorAll('a[href]')].map(a => a.href)
      .filter(h => /eventbrite|lu\.ma|meetup\.com|\/events?\/|event-details/i.test(h)),
  }));
  const out = [];
  for (const raw of lds) {
    let data;
    try { data = JSON.parse(raw); } catch { continue; }
    for (const ld of [].concat(data['@graph'] || data)) {
      if (ld['@type'] !== 'Event' || !ld.startDate) continue;
      out.push(toEvent(cfg, {
        title: ld.name,
        start: instantToPacific(new Date(ld.startDate)),
        end: ld.endDate ? instantToPacific(new Date(ld.endDate)) : null,
        location: ld.location?.name || '',
        description: ld.description || '',
        url: ld.url || cfg.eventsUrl,
      }));
    }
  }
  if (out.length === 0 && links.length > 0) {
    console.log(`  ℹ️  ${cfg.name}: no structured events, but the page now links to: ${[...new Set(links)].slice(0, 5).join(', ')}`);
    console.log('     A site-specific reader may be needed.');
  }
  return out.filter(Boolean);
}

// ---------------------------------------------------------------------------
// Reader configs. `name` must match the source name in data/sources.json.
// ---------------------------------------------------------------------------

export const HUB_READERS = [
  {
    name: 'Economic Development for Central Oregon (EDCO)',
    eventsUrl: 'https://www.edcoinfo.com/events',
    defaultRegion: 'Central Oregon',
    scopeCheck: true,
    read: readEdco,
  },
  {
    name: 'Metro Region Innovation Hub',
    eventsUrl: 'https://www.portlandmetrohub.org/events',
    listUrls: ['https://www.portlandmetrohub.org/events', 'https://www.portlandmetrohub.org/event-list'],
    defaultRegion: 'Portland Metro',
    read: readWixEvents,
  },
  {
    name: 'Cascades West Innovation Hub',
    eventsUrl: 'https://innovatecascadeswest.org/#event-calendar',
    icsUrl: 'https://calendar.google.com/calendar/ical/innovation%40raincatalysts.org/public/basic.ics',
    defaultRegion: 'Willamette Valley',
    // Daily all-day placeholders for booking advising slots, not events.
    excludeTitles: [/^1:1 .*advising/i],
    read: readIcsFeed,
  },
  {
    name: 'South Coast Development Council (SCDC)',
    eventsUrl: 'https://scdcinc.org/about-scdc/events/',
    defaultRegion: 'Coast',
    scopeCheck: true,
    read: readScdc,
  },
  {
    name: 'Northwest Innovation Hub',
    eventsUrl: 'https://nwinnovationhub.com/?page_id=30',
    defaultRegion: 'Coast',
    read: readGenericPage,
  },
  {
    name: 'Mid-Columbia Innovation Hub',
    eventsUrl: 'https://midcolumbiainnovationhub.org/events/',
    apiUrl: 'https://midcolumbiainnovationhub.org/wp-json/tribe/events/v1/events',
    defaultRegion: 'Eastern Oregon',
    read: readTribeApi,
  },
  {
    name: 'Oregon Frontier Innovation Hub',
    eventsUrl: 'https://www.oregonfrontier.org/news-events',
    defaultRegion: 'Eastern Oregon',
    read: readSquarespaceList,
  },
  {
    name: 'Southern Oregon Innovation Hub',
    eventsUrl: 'https://southernoregoninnovationhub.org/events/',
    apiUrl: 'https://southernoregoninnovationhub.org/wp-json/tribe/events/v1/events',
    defaultRegion: 'Southern Oregon',
    // About 210 dates a year, almost all weekly open labs and 1 Million Cups.
    maxPerSeries: 8,
    read: readTribeApi,
  },
  {
    name: 'Klamath & Lake Counties Innovation Hub',
    eventsUrl: 'https://www.innovationhub.solutions/resources/events',
    defaultRegion: 'Southern Oregon',
    read: readKlamathHub,
  },
];

// A weekly drop-in lab would add 52 entries at once. Keep only the next few
// dates of each repeating series; the weekly run adds later dates as they
// come into range. Monthly series still get a full year at 12.
const DEFAULT_MAX_PER_SERIES = 12;

function limitSeries(events, max) {
  const sorted = [...events].sort((a, b) => new Date(a.start) - new Date(b.start));
  const seen = new Map();
  return sorted.filter(e => {
    const key = e.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const n = (seen.get(key) || 0) + 1;
    seen.set(key, n);
    return n <= max;
  });
}

/**
 * Scraper entries for harvest-html-pages.js, limited to sources that are
 * approved and active in data/sources.json. Each fn returns finished events.
 */
export function getHubScrapers() {
  let active = new Set();
  try {
    const { sources } = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf-8'));
    active = new Set(sources.filter(s => s.active).map(s => s.name));
  } catch (e) {
    console.error('  ⚠️  Could not read data/sources.json for hub readers:', e.message);
  }
  return HUB_READERS.filter(cfg => active.has(cfg.name)).map(cfg => ({
    name: cfg.name,
    url: cfg.eventsUrl,
    prebuilt: true,
    fn: async (page) => {
      console.log(`📡 Reading ${cfg.name}...`);
      const found = await cfg.read(cfg, page);
      const events = limitSeries(found, cfg.maxPerSeries ?? DEFAULT_MAX_PER_SERIES);
      console.log(`  Found ${found.length} events in the next 12 months` +
        (events.length < found.length ? `, keeping ${events.length} (next ${cfg.maxPerSeries ?? DEFAULT_MAX_PER_SERIES} of each repeating series)` : ''));
      return events;
    },
  }));
}
