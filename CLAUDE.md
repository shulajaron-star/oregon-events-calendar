# Oregon Events Calendar - Project Rules

This project maintains a 12-month rolling calendar of startup, entrepreneurship, and bioscience industry events in Oregon and Southwest Washington.

## Technical Overview

### What This Project Is
A static website with an admin interface that:
- Displays a public calendar of Oregon startup and bioscience events
- Allows users to suggest new events via forms
- Provides an admin dashboard for managing events, reviewing suggestions, and tracking changes
- Automatically syncs with GitHub and rebuilds on Netlify when changes are made

### Folder Structure
```
oregon-events-calendar/
├── data/
│   ├── events.json              # Master event data (source of truth)
│   ├── changelog.json           # History of all changes
│   ├── sources.json             # Approved event sources
│   ├── sources_pending.json     # Sources awaiting approval
│   ├── sources_rejected.json    # Rejected sources with reasons
│   └── archive/                 # Past events by year (YYYY.json)
├── site/
│   ├── index.html              # Public calendar page
│   ├── admin.html              # Admin dashboard
│   ├── events.json             # Generated: filtered events for display
│   └── events.ics              # Generated: iCalendar feed
├── netlify/functions/
│   ├── approve-event.js        # Approve event suggestions
│   ├── delete-submission.js    # Delete form submissions
│   ├── fetch-event.js          # Fetch event data
│   ├── get-changelog.js        # Get change log
│   ├── get-events.js           # Get events from GitHub
│   ├── get-pending.js          # Get pending items
│   ├── get-submissions.js      # Get form submissions
│   ├── manage-event.js         # Add/edit/delete events
│   └── run-weekly-harvest.js   # Scheduled event harvesting
├── scripts/
│   ├── build.js                # Build script: generates site/events.json and site/events.ics
│   └── validate.js             # Validates data/events.json schema
└── netlify.toml                # Netlify configuration

```

### How to Run Locally

**Prerequisites:**
- Node.js (v18+)
- Python 3 (for local server)

**Steps:**
1. Clone the repository
2. Install dependencies: `npm install`
3. Build the site: `npm run build`
4. Start local server: `cd site && python3 -m http.server 8000`
5. Open browser to `http://localhost:8000`

**Local Limitations:**
- Netlify Functions won't work (forms, event approval, changelog)
- Admin features require the deployed site
- Use deployed site for testing full functionality

### How Deploys to Netlify Work

**Automatic Deployment:**
1. Changes pushed to `main` branch on GitHub
2. GitHub webhook triggers Netlify build
3. Netlify runs `npm run build` (generates site/events.json and site/events.ics)
4. Netlify deploys site/ folder
5. Site goes live at https://oregonstartupeventscalendar.netlify.app/

**Build Process:**
- `scripts/build.js` reads `data/events.json`
- Filters events to 12-month rolling window (today → today + 12 months)
- Generates `site/events.json` (for web display)
- Generates `site/events.ics` (iCalendar subscription feed)

**Functions:**
- Netlify Functions are serverless and deployed automatically
- Functions use GitHub API to read/write data/events.json and data/changelog.json
- Changes trigger automatic rebuilds via GitHub webhooks

### Conventions

**Data Files:**
- All dates use ISO 8601 format with America/Los_Angeles timezone
- All-day events use `00:00:00` time
- Event IDs are stable slugs: `{organizer-slug}-{title-slug}-{date}`
- Categories are arrays (events can have multiple tags)

**Git Commits:**
- Descriptive messages with event titles/IDs
- Auto-generated commits include "🤖 Generated with Claude Code"
- Changelog updated automatically via Netlify Functions

**Admin Access:**
- Password protected (set in admin.html)
- Changes made in admin trigger GitHub commits
- All changes logged to data/changelog.json

**Color Coding:**
- Blue theme matches public and admin interfaces
- Event categories have specific colors:
  - Startup: #3b82f6
  - Training: #8b5cf6
  - Investor: #10b981
  - Life Science: #ec4899
  - Networking: #f59e0b
  - Conference: #6366f1
  - Underrepresented Founders: #14b8a6

## Scope Rules

### INCLUDE events that are any of:
- Startup and entrepreneurship events: pitch competitions, demo days, founder meetups, startup weeks, accelerator and incubator events, office hours open to the public
- Startup training: workshops, bootcamps, courses, I-Corps style programs, SBIR/STTR and grant-writing training, fundraising and IP/commercialization workshops
- Investor events: angel conferences, venture showcases, investor networking
- Biotech, bioscience, life science, medtech and digital health industry events: conferences, networking, industry panels, commercialization and tech transfer events, regulatory and reimbursement training, workforce events aimed at industry
- Women and underrepresented founder programs in the above areas

### EXCLUDE:
- Purely scientific research events: departmental seminars, journal clubs, thesis defenses, research symposia and lectures with no commercialization, industry or entrepreneurship angle
- Events outside Oregon and Southwest Washington. Southwest Washington means Clark, Cowlitz, Skamania, Wahkiakum, Pacific and Klickitat counties (Vancouver, Camas, Longview and nearby). Exception: virtual events hosted by an Oregon or Southwest Washington organization are included.
- Private or invitation-only events, internal meetings, and events behind a login you cannot see
- Generic small-business events with no startup, innovation or life science angle (for example basic bookkeeping classes), unless hosted by one of the core sources below and clearly aimed at founders

### Decision process:
When unsure, add the event with "status": "needs_review" and a one-line reason, rather than guessing.

### Rolling window:
Keep events from today through today + 12 months. Move past events to data/archive/YYYY.json instead of deleting them.

## Pre-approved Sources (Seed List)

These organizations are pre-approved. Find the official events page or calendar for each:

- Oregon Life Sciences (OLS)
- OTRADI (Oregon Translational Research and Development Institute)
- Oregon Startup Center
- Oregon Entrepreneurs Network (OEN), including Angel Oregon
- RAIN (Regional Accelerator & Innovation Network), all regional hubs
- OSU Advantage Accelerator
- City of Eugene Community & Economic Development (CEDO)
- University of Oregon Knight Campus (innovation and commercialization events only)
- OHSU (innovation, technology transfer and entrepreneurship events only, not research seminars)
- Portland State University (entrepreneurship and business accelerator events)
- TiE Oregon
- AOBIO
- Oregon Bio Women
- ONAMI

## Candidate Sources (require approval)

These need to be verified as active, then presented for approval:

- Business Oregon and the Oregon Innovation Council
- Oregon Small Business Development Center Network (and campus SBDCs such as Lane Community College)
- Technology Association of Oregon
- Portland Incubator Experiment (PIE), Built Oregon, Venture Portland, Prosper Portland
- Oregon State University Office of Commercialization; UO Lundquist Center for Entrepreneurship
- Economic Development for Central Oregon (Bend Venture Conference)
- Southern Oregon and Willamette Valley angel conferences
- Portland Seed Fund
- 1 Million Cups chapters in Oregon and Southwest Washington
- Southwest Washington: Columbia River Economic Development Council (CREDC), Greater Vancouver Chamber, Washington State University Vancouver (entrepreneurship and industry events), Clark County SBDC
- Oregon Manufacturing Extension Partnership (startup or medtech manufacturing events)
- Silicon Florist and the Portland Business Journal events calendar
- Event platforms: Eventbrite, Luma and Meetup searches scoped to Oregon and Southwest Washington (skip LinkedIn Events and anything that needs a login)

### Known rejected sources:
- Fertilab / Fertilab Thinkubator - closed years ago

## Data Schema

### Event object in events.json:
```json
{
  "id": "stable-id-derived-from-org-title-start",
  "title": "Event Title",
  "organizer": "Organization Name",
  "co_hosts": ["Org2", "Org3"],
  "start": "2026-03-15T09:00:00-07:00",
  "end": "2026-03-15T17:00:00-07:00",
  "format": "in_person | virtual | hybrid",
  "venue": "Venue name or virtual platform",
  "city": "Portland",
  "region": "Portland Metro | Southwest Washington | Willamette Valley | Eugene/Lane | Central Oregon | Southern Oregon | Coast | Eastern Oregon | Statewide/Virtual",
  "categories": ["startup", "training", "investor", "life_science", "networking", "conference", "underrepresented_founders"],
  "cost": "free | paid | unknown",
  "registration_url": "https://...",
  "virtual_meeting_url": "https://zoom.us/... (optional, direct join link for virtual or hybrid events)",
  "source_url": "https://...",
  "summary": "One or two sentences in your own words, never copied text",
  "status": "confirmed | needs_review | cancelled | postponed",
  "first_seen": "2026-01-15",
  "last_verified": "2026-01-15"
}
```

**Time zone**: All dates use America/Los_Angeles (Pacific Time). All-day events are marked with times of 00:00:00.

### Source object in sources.json:
```json
{
  "name": "Organization Name",
  "type": "organization | university | platform | newsletter",
  "url": "https://main-site.org",
  "events_url": "https://calendar-or-events-page.org",
  "region": "Portland Metro | Southwest Washington | Statewide | etc.",
  "how_to_read": "html page | ics feed | rss | platform search",
  "active": true,
  "added_on": "2026-01-15",
  "last_checked": "2026-01-15",
  "notes": "Any special instructions or status"
}
```

## Data Rules

- Never invent details. If a time, venue or cost is not stated, leave it empty or "unknown".
- Prefer an organization's own ICS or RSS feed when one exists; it is more reliable than reading a page.
- De-duplicate: the same event listed by two orgs becomes one entry with co_hosts filled in.
- Recurring events (for example a monthly meetup) become separate dated entries within the window.
- If a source event changes date, update it. If it disappears from the source and is not marked cancelled, set needs_review rather than deleting.
- Respect robots.txt and site terms. Do not log in anywhere. Keep requests light.

## Source Approval Process

**NEVER add a new source to sources.json without user approval.**

1. Source Scout finds new organizations and adds them to sources_pending.json with:
   - name, url, events_url, region
   - why it qualifies (one sentence)
   - 2-3 example upcoming events with links
   - date_found
   - "decision": "pending"

2. Weekly report lists each pending source as a checklist item

3. User decides by:
   - Telling Claude in plain words ("approve X, reject Y because...")
   - Setting "decision" to "approve" or "reject" in sources_pending.json

4. At the start of each weekly run:
   - Move approved items to sources.json (active: true, added_on: today)
   - Move rejected items to sources_rejected.json with reason
   - Leave undecided items pending; remind user in each report (oldest first)

5. When Event Harvester finds an in-scope event from an unapproved organizer:
   - DO NOT add the event
   - Add the organizer to sources_pending.json with that event as the example

## Agent Responsibilities

### Source Scout (.claude/agents/source-scout.md)
- Searches for Oregon and Southwest Washington event sources by region, topic, and city
- Skips anything already in sources.json, sources_pending.json, or sources_rejected.json
- Checks that each candidate is active (events in last 12 months or upcoming)
- Adds new candidates ONLY to sources_pending.json
- Marks quiet approved sources as active: false with a note

### Event Harvester (.claude/agents/event-harvester.md)
- Reads ONLY approved, active sources in sources.json
- Applies scope rules strictly
- Adds new events, updates changed ones, flags uncertain ones
- Archives past events to data/archive/YYYY.json
- Records last_checked for each source
- Notes any sources it could not read

### Weekly Update Command (.claude/commands/weekly-update.md)
Runs in order:
1. Apply source decisions from sources_pending.json
2. Source Scout
3. Event Harvester
4. scripts/validate (fix errors before continuing)
5. scripts/build
6. Write data/reports/YYYY-MM-DD.md
7. Commit to new branch and open PR with report as description

## Technical Stack

- Static site with FullCalendar library
- Build scripts in Node.js
- No database, no paid services
- Hosted on Netlify
- Automated via scheduled Claude Code runs or GitHub Actions

## Validation Rules

scripts/validate checks:
- JSON schema compliance
- Date range (today through today + 12 months)
- No duplicate IDs
- Required fields present
- Valid enum values (format, region, categories, cost, status)
- ISO 8601 dates with America/Los_Angeles timezone

## Build Process

scripts/build generates:
- site/events.json (filtered current events for web display)
- site/events.ics (iCalendar feed for subscriptions)

## User Maintenance

User reviews weekly reports to:
- Approve or reject pending organizations
- Review needs_review events and make scope calls
- Verify cancelled/postponed events
- Update scope rules in CLAUDE.md if needed

Typical weekly review: 10 minutes
