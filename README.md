# Oregon Events Calendar

A public, 12-month rolling calendar of startup, entrepreneurship, and bioscience industry events in Oregon and Southwest Washington.

## What's Included

This calendar tracks:
- Startup and entrepreneurship events (pitch competitions, demo days, founder meetups, accelerator programs)
- Startup training (workshops, bootcamps, SBIR/STTR and grant-writing training)
- Investor events (angel conferences, venture showcases)
- Biotech, bioscience, life science, medtech, and digital health industry events
- Programs supporting women and underrepresented founders

## What's Not Included

- Purely scientific research events with no commercialization angle
- Events outside Oregon and Southwest Washington
- Private or invitation-only events
- Generic small-business events without a startup or innovation focus

## Using the Calendar

**Website**: [View the calendar](#) (link to be added after deployment)

**Subscribe**: Click "Subscribe" on the website to add this calendar to Google Calendar, Outlook, or Apple Calendar. It updates automatically.

**Suggest an Event**: Use the "Suggest an event or source" form on the website.

## How It Works

This calendar is maintained semi-automatically:
1. A weekly automated process checks approved event sources across Oregon and Southwest Washington
2. New events are added, existing events are updated, and past events are archived
3. New sources are discovered and presented for manual approval
4. A weekly report summarizes all changes
5. After review, changes are published to the live site

## Data & Code

- **Events data**: `data/events.json`
- **Event sources**: `data/sources.json`
- **Archived events**: `data/archive/`
- **Build scripts**: `scripts/`
- **Website**: `site/`

This project uses a simple static site with no database or tracking. It's hosted on Netlify and built with Node.js scripts.

## Maintenance

See `RUNBOOK.md` for detailed maintenance instructions.

See `CLAUDE.md` for the full scope rules and data schemas.

## License

Data: Public domain (CC0)
Code: MIT License

---

Maintained by Shula Nema with assistance from Claude Code.
