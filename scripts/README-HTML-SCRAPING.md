# HTML Scraping for Oregon Events Calendar

## Overview

This project has two harvesting approaches:
1. **ICS Feed Harvesting** (`harvest-ics-feeds.js`) - Works great for RAIN, OTRADI
2. **HTML Page Scraping** (`harvest-html-pages.js`) - For sites without ICS feeds (OEN, OLS)

## Current Status

### ✅ Working: ICS Feed Scraper
Sources with ICS feeds work perfectly:
- RAIN: `https://raincatalysts.org/events/?ical=1`
- OTRADI: `https://www.otradi.org/?post_type=tribe_events&ical=1&eventDisplay=list`

**Usage:**
```bash
npm run harvest
```

### ⚠️ Needs Work: HTML Scraper

The HTML scraper framework is built, but **OEN and OLS pages are JavaScript-rendered**, which means simple HTML parsing with Cheerio won't work.

## The Problem: JavaScript-Rendered Pages

Both Oregon Life Sciences and OEN use JavaScript to load event content dynamically. When you fetch the HTML with curl/axios, you get an empty shell that loads content via JavaScript after the page loads.

## Solutions

### Option 1: Playwright (Recommended)
Use a headless browser that executes JavaScript:

```bash
npm install playwright
```

The scraper would:
1. Launch a headless browser
2. Navigate to the events page
3. Wait for content to load
4. Extract event data from the rendered DOM
5. Close browser

**Pros:**
- Works with any JavaScript-rendered site
- Can handle dynamic loading, infinite scroll, etc.
- More reliable long-term

**Cons:**
- Slower (3-5 seconds per page)
- Heavier resource usage
- Requires Chromium download (~100MB)

### Option 2: API Discovery
Check if these sites expose APIs we can use directly:

```bash
# Check network requests when viewing the events page
# Look for JSON responses with event data
```

**Pros:**
- Fast and efficient
- More reliable than HTML parsing

**Cons:**
- APIs may not exist
- APIs may be undocumented/unsupported
- May require authentication

### Option 3: Manual Entry (Current Approach)
Continue adding events manually or via screenshots as noted in sources.json.

**Pros:**
- No technical dependencies
- Complete control over data quality

**Cons:**
- Time-consuming (10-15 minutes per source)
- Not automated

## Recommended Next Steps

### 1. Investigate APIs
Before investing in Playwright, check if OEN/OLS have APIs:

```bash
# View OLS events page in browser
# Open DevTools → Network tab → Filter XHR/Fetch
# Look for JSON responses with event data
```

If you find API endpoints, we can update the scraper to use those directly.

### 2. Add Playwright for Stubborn Sites
If no APIs exist, install Playwright:

```bash
npm install playwright
```

Then I can update `harvest-html-pages.js` to use Playwright for JavaScript-rendered sites.

### 3. Hybrid Approach
- Use ICS feeds where available (RAIN, OTRADI) ✅
- Use APIs where discovered (OEN, OLS) 🔍
- Use Playwright as fallback for remaining sites
- Keep manual entry for special cases

## Running the Scrapers

```bash
# ICS feeds only (working now)
npm run harvest

# HTML pages (needs Playwright)
npm run harvest:html

# Both (needs Playwright)
npm run harvest:all

# Then validate and build
npm run validate
npm run build
```

## Files Created

- `scripts/harvest-html-pages.js` - HTML scraping framework (needs Playwright)
- `scripts/harvest-ics-feeds.js` - ICS feed scraper (working) ✅
- `package.json` - Updated with new npm scripts

## Notes

The HTML scraping framework in `harvest-html-pages.js` has:
- Event ID generation
- Region/category detection
- Date parsing and timezone handling
- Event deduplication
- All the structure needed

It just needs Playwright to handle JavaScript rendering, or API endpoints to fetch data directly.

## Want Me to Continue?

If you'd like, I can:
1. Install Playwright and update the scraper
2. Help you investigate APIs for OEN/OLS
3. Create a Playwright-based scraper for specific sites
4. Document the manual entry workflow instead

Let me know which approach you prefer!

## Innovation hub readers (`scripts/hub-scrapers.js`)

Added 2026-11-24. These readers cover the Business Oregon innovation hubs and two regional
development councils. `harvest-html-pages.js` loads them, and each one runs only while its
source is `"active": true` in `data/sources.json` (matched by name). They return finished
event objects with correct Pacific offsets, so they skip the text date parser.

| Source | How it is read |
|---|---|
| EDCO | Webflow cards on edcoinfo.com/events (dates only, no times) |
| Metro Region Innovation Hub | Wix Events: event links, then schema.org JSON-LD on each event page |
| Cascades West Innovation Hub | Public Google Calendar ICS (repeating events expanded, advising placeholders skipped) |
| South Coast Development Council | `article.event_post` list on the events page |
| Northwest Innovation Hub | No events listed yet; checks for JSON-LD and logs event links it finds |
| Mid-Columbia Innovation Hub | The Events Calendar REST API (`/wp-json/tribe/events/v1/events`) |
| Oregon Frontier Innovation Hub | Squarespace list with `Date:` / `Time:` / `Location:` / `Cost:` lines |
| Southern Oregon Innovation Hub | The Events Calendar REST API |
| Klamath & Lake Counties Innovation Hub | Static event cards, including "Next dates" for repeating events |

Repeating series are capped (12 dates per title, 8 for Southern Oregon) so a weekly lab does
not flood the pending list; later dates arrive on later weekly runs. EDCO and SCDC events with
no startup, innovation or life science words come in as `needs_review` with a `review_reason`.

Test one reader: `node scripts/harvest-html-pages.js --source "Mid-Columbia"`
