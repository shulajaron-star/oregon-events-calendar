# Weekly Automation - Event Harvesting

The Oregon Events Calendar has automated weekly harvesting that discovers new events from your approved sources.

## How It Works

**Every Monday at 9 AM Pacific** (or when manually triggered), GitHub Actions runs the weekly harvest workflow:

1. **Harvests Events**: Scrapes all active sources in `data/sources.json`
2. **Filters & Deduplicates**: Applies scope rules and removes duplicates
3. **Saves to Pending**: Stores discovered events in `data/events-pending.json`
4. **Creates PR**: Opens a pull request with pending events for review
5. **Notifies Admin**: You review and approve events in the admin interface

## Reviewing Pending Events

### In the Admin Interface

1. Go to: https://oregonstartupeventscalendar.netlify.app/admin.html
2. Log in with your admin password
3. Click the **"Pending Events"** tab
4. Review each discovered event:
   - **✓ Approve & Add to Calendar**: Adds event to published calendar
   - **✕ Reject**: Removes from pending list

When you approve an event:
- It's automatically added to `data/events.json`
- Commits to GitHub with descriptive message
- Triggers Netlify rebuild
- Appears on calendar within 2-3 minutes

## Manual Triggering

You can trigger the harvest manually without waiting for Monday:

1. Go to: https://github.com/shulajaron-star/oregon-events-calendar/actions
2. Click "Weekly Event Harvest" in the left sidebar
3. Click "Run workflow" button
4. Select branch: `main`
5. Click "Run workflow"

The harvest will run and create a PR if events are found.

## Workflow Outputs

After each harvest run, you'll see:

### GitHub Pull Request
- **Title**: "Weekly Harvest: X events pending review"
- **Contains**: Updated `data/events-pending.json` file
- **Labels**: `weekly-harvest`, `pending-review`
- **Description**: Summary of discovered events

**Do not merge the PR directly** - instead, approve events through the admin interface. The PR is for tracking and reference.

### Admin Interface
- Pending events appear in the **Pending Events** tab
- Shows event details: title, date, organizer, venue, source
- Approve button adds to calendar automatically
- Reject button removes from view

## What Gets Harvested

The workflow harvests from these active sources:

**HTML Scrapers** (uses Playwright):
- Oregon Life Sciences (OLS)
- Oregon Entrepreneurs Network (OEN)
- TiE Oregon
- Technology Association of Oregon (TAO)
- Built Oregon
- Oregon Startup Center
- OSU Advantage
- And 10+ more approved sources

**ICS Feeds** (native parser):
- RAIN (Regional Accelerator & Innovation Network)
- OTRADI (Oregon Bioscience Incubator)

See `data/sources.json` for the full list of active sources.

## Scope Rules

Events must match these criteria to be harvested:

**INCLUDE**:
- Startup and entrepreneurship events
- Investor events and pitch competitions
- Biotech, bioscience, life science, medtech events
- Startup training and workshops
- Located in Oregon or Southwest Washington
- Public events (not invitation-only)

**EXCLUDE**:
- Research seminars with no commercialization angle
- Events outside Oregon/SW Washington region
- Private or invitation-only events
- Generic small business events (unless startup-focused)

Events that don't clearly match are marked with `status: "needs_review"` for manual decision.

## Adding New Sources

If the harvester discovers an event from an organization NOT in your approved sources, it will:

1. Add the organization to `data/sources_pending.json`
2. Include 2-3 example events from that organization
3. Wait for your approval before harvesting from that source

You can then:
- **Approve**: Move source to `data/sources.json` (active: true)
- **Reject**: Move to `data/sources_rejected.json` with reason

## Troubleshooting

### No pending events after harvest

**Possible reasons**:
- All discovered events are already in the calendar
- No new events found on source websites
- Harvest workflow failed (check Actions tab for errors)

### Harvest workflow fails

1. Check GitHub Actions logs for error details
2. Common issues:
   - Playwright browser installation failed
   - Source website is down or changed structure
   - Network timeout

### Events not showing in admin

1. Make sure `data/events-pending.json` exists in GitHub
2. Check that `get-pending` Netlify Function is deployed
3. Verify GITHUB_TOKEN environment variable is set

## Configuration

### Environment Variables Required

Already configured in your Netlify environment:
- `GITHUB_TOKEN` - For reading/writing to GitHub
- `NETLIFY_API_TOKEN` - For form submissions
- `CUSTOM_SITE_ID` - Your Netlify site ID

### Workflow Schedule

To change the schedule, edit `.github/workflows/weekly-harvest.yml`:

```yaml
schedule:
  - cron: '0 17 * * 1'  # Monday 9 AM Pacific (5 PM UTC)
```

Change the cron expression to your preferred schedule.

## Best Practices

1. **Review Weekly**: Check pending events each Monday after the harvest runs
2. **Approve Quickly**: Events closer to their date are more valuable
3. **Reject Clearly**: If rejecting, consider if the source itself should be rejected
4. **Monitor PRs**: Keep weekly-harvest PRs for audit trail
5. **Update Sources**: Mark inactive sources as `active: false` in `sources.json`

## Future Enhancements

Planned improvements:
- Source Scout: Automatically discover new event sources
- Confidence scores: Rank pending events by relevance
- Batch approval: Approve multiple events at once
- Email notifications: Get notified when new events are pending
- Smart deduplication: Better detection of duplicate events across sources
