# Weekly Update Command

Run the complete weekly update process for the Oregon Events Calendar.

## Process

Execute these steps in order:

### 1. Apply Source Decisions

Check data/sources_pending.json for any sources where the user has set:
- `"decision": "approve"` → Move to sources.json with `active: true` and `added_on: today`
- `"decision": "reject"` → Move to sources_rejected.json with the user's reason

Leave sources with `"decision": "pending"` in sources_pending.json.

### 2. Run Source Scout

Launch the Source Scout agent to search for new event sources across Oregon and Southwest Washington.

The agent will:
- Search by region, topic, and organization type
- Validate that candidates are active
- Add new candidates to sources_pending.json
- Skip anything already in sources.json, sources_pending.json, or sources_rejected.json

### 3. Run Event Harvester

Launch the Event Harvester agent to gather events from all approved, active sources.

The agent will:
- Read all sources in sources.json where `active: true`
- Fetch events from each source
- Apply scope rules from CLAUDE.md
- Add new events, update existing ones, flag uncertain ones
- Archive past events to data/archive/YYYY.json
- Update last_checked for each source

### 4. Validate Data

Run `npm run validate` to check:
- JSON schema compliance
- Date formats and ranges
- No duplicate IDs
- Required fields present
- Valid enum values

If validation fails, fix the errors before continuing.

### 5. Build Site

Run `npm run build` to generate:
- site/events.json (current events for website)
- site/events.ics (calendar subscription feed)

### 6. Generate Weekly Report

Create data/reports/YYYY-MM-DD.md with this structure:

```markdown
# Weekly Update Report - YYYY-MM-DD

## New Organizations Awaiting Your Approval

[If sources_pending.json has items with decision: "pending":]

- [ ] **Organization Name** (Region)
  - **Why it qualifies**: One sentence explanation
  - **Events URL**: https://...
  - **Example events**:
    - Event Title - Date - URL
    - Event Title - Date - URL
  - **Decision needed**: Approve or reject?

[For each pending source]

**To approve or reject**: Either tell me in plain words ("approve X, reject Y because...") or edit sources_pending.json to set "decision": "approve" or "decision": "reject".

---

## Events Summary

**Added**: X new events
**Updated**: X events
**Flagged for review**: X events
**Archived**: X past events
**Total current events**: X (within 12-month window)

### New Events Added

- Event Title (Organizer, Date, Region)
- Event Title (Organizer, Date, Region)
[List up to 20, then "... and X more"]

### Events Updated

- Event Title (Organizer, Change: date moved from X to Y)
- Event Title (Organizer, Change: status changed to cancelled)
[List significant changes]

### Events Needing Review

- [ ] **Event Title** (Organizer, Date)
  - **Reason**: Explanation of why flagged
  - **Decision needed**: Include or exclude?

[For each needs_review event]

### Events Archived

- Moved X events from YYYY to data/archive/YYYY.json

---

## Source Health

**Total sources**: X active, Y inactive
**Sources checked**: X
**Sources with errors**: Y

### Source Errors

- Organization Name: Error description (e.g., "404 on events page")
- Organization Name: Error description

**Action needed**: Please check these sources manually.

---

## Next Steps

1. Review and approve/reject pending organizations above
2. Review and make decisions on flagged events
3. If everything looks good, merge this update
4. Site will auto-deploy with new events

**Estimated review time**: 10 minutes
```

### 7. Create Pull Request

Commit all changes to a new branch named `weekly-update-YYYY-MM-DD` with message:

```
Weekly update - YYYY-MM-DD

- Source Scout: X new candidates found
- Event Harvester: X events added, Y updated, Z flagged
- Validation: Passed
- Build: Generated site files
```

Create a pull request with:
- **Title**: `Weekly Update - YYYY-MM-DD`
- **Description**: The full content of the weekly report from step 6

The PR allows you to:
- Review all changes in the GitHub UI
- See a Netlify deploy preview
- Approve pending sources and needs_review events
- Merge when ready

## Error Handling

If any step fails:
- Stop the process
- Report the error clearly
- Do not create a PR
- Wait for user to fix the issue

## Success Criteria

A successful weekly update:
- Processes all source decisions from previous week
- Finds and proposes new sources
- Harvests current events from all active sources
- Passes validation with no errors
- Generates a clear, actionable report
- Creates a reviewable pull request

## Notes

- This command is designed to run every Monday morning
- It can also be run manually anytime
- The user should review and merge the PR within a few days
- Pending sources and needs_review events stay pending until the user decides
