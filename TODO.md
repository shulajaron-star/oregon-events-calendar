# Oregon Events Calendar - TODO

## Open Items

### High Priority

1. **Admin UI Redesign (Item #6 from original request)**
   - Redesign admin console to fully match public page design
   - Add "Admin" label at top
   - Ensure visual consistency between public and admin interfaces
   - Status: Partial (color scheme updated, layout needs refinement)

2. **Change Log Tab Improvements**
   - Consider adding export functionality (CSV, JSON)
   - Add date range filtering
   - Add ability to undo/revert changes

3. **Event Validation**
   - Add more robust validation for event data
   - Validate URLs are reachable
   - Check for duplicate events across different sources
   - Validate timezone consistency

### Medium Priority

4. **Source Management**
   - Implement Source Scout agent (defined in .claude/agents/source-scout.md)
   - Implement Event Harvester agent (defined in .claude/agents/event-harvester.md)
   - Automate weekly update process (defined in .claude/commands/weekly-update.md)

5. **Calendar Features**
   - Add calendar subscription button (download .ics feed)
   - Add "Add to Google Calendar" / "Add to Outlook" links
   - Add event sharing functionality (share individual events)
   - Add print-friendly view

6. **Search & Filter Enhancements**
   - Add date range filter to public calendar
   - Add full-text search across event descriptions
   - Add "Upcoming This Week" / "This Month" quick filters
   - Add filter by cost (free vs paid)

7. **Mobile Responsiveness**
   - Test and optimize for mobile devices
   - Ensure admin interface works on tablets
   - Add mobile-friendly navigation

### Low Priority

8. **Analytics**
   - Track most viewed events
   - Track most used filters
   - Monitor form submission rates
   - Add basic usage statistics to admin

9. **Email Notifications**
   - Email digest of new events (weekly/monthly)
   - Email alerts for specific categories
   - Admin email notifications for new submissions

10. **Multi-day Event Display**
    - Improve how multi-day events appear on calendar
    - Add visual indicators for event duration
    - Consider showing events spanning multiple days differently

11. **Event Reminders**
    - Add "Remind me" functionality
    - Integration with calendar apps

## Known Issues

### Bugs

1. **TIE Pitch Club Event Date**
   - Event was submitted with wrong year (2027 instead of 2026)
   - User corrected via admin edit
   - Consider adding year validation to forms

2. **Local Development Limitations**
   - Forms don't work locally (Netlify Forms only work on deployed site)
   - Admin functions require deployed site
   - Consider adding mock data for local testing

3. **FullCalendar Button Styling**
   - Month/List toggle buttons required aggressive CSS overrides
   - White text on blue background fix applied
   - May need revisiting if FullCalendar library updates

### Potential Improvements

1. **Password Security**
   - Current admin uses basic password in JavaScript
   - Consider proper authentication (Netlify Identity, Auth0, etc.)
   - Add password change functionality

2. **Change Log Size**
   - Currently capped at 500 entries
   - Consider pagination or archiving strategy
   - Add ability to view archived changes

3. **Event Approval Workflow**
   - Currently single-step (approve/reject)
   - Consider adding "needs clarification" status
   - Add ability to edit before approving

4. **Source Approval Process**
   - Manual approval required
   - Consider semi-automated verification
   - Add source health monitoring (check if still active)

5. **Build Performance**
   - Build script runs on every deploy
   - Consider caching strategies
   - Optimize for large number of events (100+)

6. **Virtual Meeting Links**
   - Recently added field (virtual_meeting_url)
   - Need to add display in event details modal
   - Consider auto-detecting Zoom/Meet links

## Completed Features

✅ Admin login button on public calendar  
✅ Edit functionality for Issue Reports  
✅ Edit functionality for Manage Events  
✅ Calendar view in Manage Events  
✅ Direct "Add Event" feature for admins  
✅ Change Log tab with compact, expandable entries  
✅ Change Log sorting (by action date and event date)  
✅ Change Log filtering by action type  
✅ Color-coded category filter buttons  
✅ "All" button for category filters  
✅ Multi-day event support (end date field)  
✅ Optional event URL field  
✅ Virtual meeting link field  
✅ Category/tag editing in Manage Events  
✅ Blue color scheme matching across public and admin  
✅ Reduced padding above filters  
✅ Footer text update  
✅ Password hint removed from login  

## Future Considerations

- **Internationalization**: Support for Spanish language events
- **Recurring Events**: Better handling of weekly/monthly recurring events
- **Event Series**: Link related events (e.g., multi-week bootcamp)
- **Speaker/Presenter Info**: Add fields for event speakers
- **Event Capacity**: Track if events are full/have waitlists
- **Integration**: Consider API for other sites to pull event data
- **Social Media**: Auto-posting to Twitter/LinkedIn when events added
- **Maps Integration**: Show event locations on map view
- **Event Photos**: Support event banner images
- **User Accounts**: Let users save favorite events, get personalized recommendations

---

Last updated: 2026-11-19
