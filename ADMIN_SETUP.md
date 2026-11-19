# Admin Interface Setup

The admin interface allows you to review and manage event suggestions and issue reports submitted through the forms on the main calendar site.

## Accessing the Admin Interface

1. Navigate to: `https://oregonstartupeventscalendar.netlify.app/admin.html`
2. Enter the admin password (default: `oregon-events-2026`)
3. You'll see two tabs:
   - **Event Suggestions**: Users submitted new events
   - **Issue Reports**: Users reported problems with existing events

## Configuration Required

For the admin interface to work, you need to set up environment variables in Netlify:

### 1. Get a Netlify Personal Access Token

1. Go to Netlify Dashboard → User Settings → Applications
2. Click "New access token"
3. Give it a name like "Oregon Events Admin"
4. Copy the token (you won't see it again!)

### 2. Get Your Site ID

1. Go to Netlify Dashboard → Your Site → Site Settings
2. Under "Site information", find "API ID"
3. Copy the Site ID

### 3. Add Environment Variables

1. Go to Netlify Dashboard → Your Site → Site configuration → Environment variables
2. Click "Add a variable" → "Add a single variable"
3. Add the first variable:
   - **Key**: `NETLIFY_API_TOKEN`
   - **Value**: Your personal access token from step 1
   - **Scopes**: Check all scopes (Builds, Functions, Post-processing)
4. Click "Create variable"
5. Click "Add a variable" → "Add a single variable" again
6. Add the second variable:
   - **Key**: `CUSTOM_SITE_ID`
   - **Value**: Your site API ID from step 2
   - **Scopes**: Check all scopes (Builds, Functions, Post-processing)
7. Click "Create variable"

### 4. Redeploy Your Site

After adding environment variables, trigger a new deployment:

1. Go to Deploys tab
2. Click "Trigger deploy" → "Clear cache and deploy site"

## Changing the Admin Password

**IMPORTANT**: The default password is `oregon-events-2026` and should be changed!

To change it:

1. Open `site/admin.html` in your code editor
2. Find this line near the top of the `<script>` section:
   ```javascript
   const ADMIN_PASSWORD = 'oregon-events-2026'; // Change this!
   ```
3. Change the password to something secure
4. Commit and push your changes
5. Wait for Netlify to deploy

**Note**: This is basic password protection suitable for a low-security admin interface. For production use with sensitive data, consider implementing proper authentication (OAuth, Netlify Identity, etc.).

## Using the Admin Interface

### Managing Event Suggestions

When someone submits an event through the "Suggest Event" form:

1. It appears in the **Event Suggestions** tab
2. Review the event details
3. Options:
   - **✓ Approve & Add to Calendar**: Accept the event as-is (placeholder - manual process for now)
   - **✏️ Edit Before Approving**: Make changes before accepting (coming soon)
   - **✕ Reject**: Dismiss the submission

### Managing Issue Reports

When someone reports an issue with an event:

1. It appears in the **Issue Reports** tab
2. Review the issue type and details
3. Options:
   - **✓ Fix & Mark Resolved**: Acknowledge you'll fix it (placeholder - manual process for now)
   - **✕ Dismiss**: Ignore the report

## Current Limitations

The admin interface currently **displays** submissions but doesn't yet have full automation for:

- Automatically adding approved events to `data/events.json`
- Automatically updating events based on issue reports
- Deleting submissions from Netlify after processing

**Workaround for now**:

1. Review submissions in the admin interface
2. Manually add/edit events in `data/events.json`
3. Run `npm run validate` and `npm run build`
4. Commit and push changes
5. Manually delete processed submissions in Netlify Dashboard → Forms → Submissions

## Email Notifications

To get notified when someone submits a form:

1. Go to Netlify Dashboard → Your Site → Forms
2. Click "Settings and usage"
3. Scroll to "Form notifications"
4. Click "Add notification" → "Email notification"
5. Configure:
   - **Event to listen for**: New form submission
   - **Form**: Select `event-suggestions` or `event-issues`
   - **Email to notify**: Your email address
6. Repeat for the other form

You'll now receive an email whenever someone submits a form.

## Security Notes

- The admin password is stored in the client-side JavaScript (not very secure)
- The Netlify API token has access to your entire site's API
- Only share the admin password with trusted team members
- Consider IP restrictions or more robust authentication for production use

## Troubleshooting

### "Failed to load submissions" error

1. Check that you've added both `NETLIFY_API_TOKEN` and `CUSTOM_SITE_ID` environment variables in Netlify
2. Verify the token is correct and not revoked
3. Verify the Site ID matches your site's API ID
4. Trigger a new deployment after adding the variables
5. Check browser console for specific error messages

### Forms not appearing

1. Make sure forms are enabled in Netlify Dashboard → Forms
2. Verify forms have been submitted (test by submitting an event)
3. Check browser console for JavaScript errors

### "Method not allowed" error

The get-submissions function only accepts GET requests. If you see this, there may be a code issue.
