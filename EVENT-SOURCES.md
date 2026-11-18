# Oregon Events Calendar - Source Status

## ✅ Deduplication Added!

**New feature:** Automatic deduplication now runs after harvesting!

```bash
# Deduplication happens automatically
npm run harvest:all

# Or run manually anytime
npm run deduplicate
```

**How it works:**
- Compares events by title + date similarity
- Uses smart scoring (venue, city, description completeness)
- Keeps the version with the most complete data
- Removes auto-generated duplicates in favor of manual entries

---

## 🟢 Currently Working Sources (4)

### 1. **RAIN** - Regional Accelerator & Innovation Network
- **Status:** ✅ Working (ICS feed)
- **Coverage:** Statewide
- **Events:** Networking, workshops, pitch competitions
- **Harvester:** `npm run harvest` (automatic)

### 2. **OTRADI** - Oregon Bioscience Incubator
- **Status:** ✅ Working (ICS feed)
- **Coverage:** Portland Metro
- **Events:** Biotech happy hours, investor events
- **Harvester:** `npm run harvest` (automatic)

### 3. **Oregon Life Sciences (OLS)**
- **Status:** ✅ Working (Playwright scraper)
- **Coverage:** Statewide
- **Events:** Life science networking, training, conferences
- **Harvester:** `npm run harvest:html` (Playwright)

### 4. **Oregon Entrepreneurs Network (OEN)**
- **Status:** ✅ Working (Playwright scraper)
- **Coverage:** Statewide
- **Events:** Pitch events, office hours, training
- **Harvester:** `npm run harvest:html` (Playwright)

---

## 🟡 Ready to Add (17 sources)

These are pre-approved and ready to scrape. Just need Playwright scrapers built:

### **Statewide Organizations**

**TiE Oregon**
- URL: https://tie-oregon.org/calendar
- Focus: Entrepreneur support, mentorship
- Type: HTML scraping needed

**ONAMI** - Oregon Nanoscience Institute
- URL: https://techlabs.onami.us/resources/events
- Focus: Nanotech, advanced materials
- Type: HTML scraping needed

**Technology Association of Oregon (TAO)**
- URL: https://www.techoregon.org/events
- Focus: 120+ yearly tech events
- Type: HTML scraping needed

**Built Oregon**
- URL: https://www.builtoregon.com/events
- Focus: Consumer product entrepreneurs
- Type: HTML scraping needed

**Business Oregon / Innovation Council**
- URL: https://www.oregoninnovationshowcase.com
- Focus: Annual Innovation Showcase
- Type: HTML scraping needed

**Oregon Bio Women**
- URL: https://www.oregonlifesciences.org/events/obwevents
- Focus: Women in life sciences
- Type: Part of OLS (may already be captured)

### **Portland Metro**

**Oregon Startup Center**
- URL: https://www.oregonstartupcenter.org/events
- Focus: Startup programs, accelerator
- Type: HTML scraping needed

**OHSU Innovates**
- URL: https://www.ohsu.edu/tech-transfer
- Focus: Innovation, tech transfer
- Type: HTML scraping needed

**Portland State Business Accelerator**
- URL: https://www.pdx.edu/accelerator/events
- Focus: University startup programs
- Type: HTML scraping needed

**Oregon Bioscience Incubator (OBI)**
- URL: https://www.tickettailor.com/events/oregonbioscienceincubator
- Focus: Biotech startup expos
- Type: Tickettailor platform

### **Eugene / Willamette Valley**

**Collaborative EDO (Eugene)**
- URL: https://www.collaborativeedo.org/events
- Focus: Economic development, startups
- Type: HTML scraping needed

**UO Knight Campus**
- URL: https://knightcampus.uoregon.edu/events
- Focus: Innovation, commercialization
- Type: HTML scraping needed

**OSU Advantage Accelerator**
- URL: https://events.oregonstate.edu/department/osu_advantage
- Focus: University startup programs
- Type: HTML scraping needed

**Willamette Angel Conference**
- URL: https://www.willametteangelconference.com
- Focus: Annual investor conference
- Type: HTML scraping needed

### **Central Oregon**

**EDCO** - Economic Development for Central Oregon
- URL: https://www.bendvc.com
- Focus: Bend Venture Conference
- Type: HTML scraping needed

### **Southwest Washington**

**CREDC** - Columbia River Economic Development
- URL: https://www.credc.org
- Focus: Clark County investor events
- Type: HTML scraping needed

### **Inactive**

**RAIN Eugene**
- Status: ❌ Closed
- Notes: No longer in existence

---

## 📋 Recommended Next Steps

### Priority 1: High-Value Sources (3-5 sources)
These will give you the most event coverage:

1. **TiE Oregon** - Major statewide entrepreneur network
2. **TAO** - 120+ events/year
3. **OSU Advantage** - Major university accelerator
4. **Built Oregon** - Consumer product focus
5. **Oregon Startup Center** - Portland hub

### Priority 2: Regional Coverage (3-4 sources)
Fill geographic gaps:

1. **UO Knight Campus** - Eugene area
2. **EDCO/Bend VC** - Central Oregon
3. **CREDC** - Southwest Washington
4. **Willamette Angel Conference** - Annual major event

### Priority 3: Specialized Focus (3-4 sources)
Niche audiences:

1. **OHSU Innovates** - Healthcare/biotech
2. **ONAMI** - Advanced materials
3. **OBI** - Biotech incubator
4. **PSU Accelerator** - Student/university startups

---

## 🛠️ How to Add New Sources

### Option 1: Add to Playwright Scraper

Edit `scripts/harvest-html-pages.js` and add a new scraper function:

```javascript
async function scrapeTiEOregon(page) {
  console.log('📡 Scraping TiE Oregon...');

  await page.goto('https://tie-oregon.org/calendar', {
    waitUntil: 'load',
    timeout: 30000
  });

  await page.waitForTimeout(5000);

  const events = await page.evaluate(() => {
    // Add selectors specific to TiE Oregon's site
  });

  return events;
}
```

Then add to the scrapers array in `harvestHTMLPages()`.

### Option 2: Check for ICS Feeds

Some sites might have hidden ICS feeds. Look for:
- `/events/?ical=1`
- `/calendar.ics`
- `webcal://` links

If found, add to `scripts/harvest-ics-feeds.js` instead (much easier!).

### Option 3: Request My Help

I can build scrapers for specific sites you prioritize.

---

## 📊 Current Coverage

**Events:** 17 unique events
**Sources active:** 4 of 21 (19%)
**Geographic coverage:**
- ✅ Portland Metro
- ✅ Willamette Valley (Corvallis)
- ✅ Coast (Florence)
- ✅ Statewide/Virtual
- ⚠️  Eugene (limited)
- ⚠️  Central Oregon (none)
- ⚠️  Southern Oregon (none)
- ✅ Southwest Washington (limited)

---

## 🎯 Recommendation

**Start with these 5 sources for maximum impact:**

1. ✅ TiE Oregon (statewide coverage)
2. ✅ TAO (120+ events/year)
3. ✅ OSU Advantage (Corvallis area)
4. ✅ Built Oregon (product startups)
5. ✅ Oregon Startup Center (Portland hub)

This would likely **triple your event count** to 50+ events and provide comprehensive statewide coverage.

Would you like me to build scrapers for these 5 next?
