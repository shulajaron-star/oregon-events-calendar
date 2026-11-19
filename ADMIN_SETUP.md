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

### 2. Get a GitHub Personal Access Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name like "Oregon Events Calendar Admin"
4. Select scopes: `repo` (Full control of private repositories)
5. Click "Generate token"
6. Copy the token (you won't see it again!)

### 3. Get Your Netlify Site ID

1. Go to Netlify Dashboard → Your Site → Site Settings
2. Under "Site information", find "API ID"
3. Copy the Site ID

### 4. Add Environment Variables

1. Go to Netlify Dashboard → Your Site → Site configuration → Environment variables
2. Add these three variables (click "Add a variable" → "Add a single variable" for each):

   **Variable 1:**
   - **Key**: `NETLIFY_API_TOKEN`
   - **Value**: Your Netlify personal access token from step 1
   - **Scopes**: Check all scopes (Builds, Functions, Post-processing)

   **Variable 2:**
   - **Key**: `GITHUB_TOKEN`
   - **Value**: Your GitHub personal access token from step 2
   - **Scopes**: Check all scopes (Builds, Functions, Post-processing)

   **Variable 3:**
   - **Key**: `CUSTOM_SITE_ID`
   - **Value**: Your Netlify site API ID from step 3
   - **Scopes**: Check all scopes (Builds, Functions, Post-processing)

3. Click "Create variable" after each one

### 5. Redeploy Your Site

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
   - **✓ Approve & Add to Calendar**: Automatically adds the event to data/events.json, commits to GitHub, and deletes the submission
   - **✏️ Edit Before Approving**: Make changes to any field, then approve with your edits
   - **✕ Reject**: Permanently deletes the submission from Netlify

**What happens when you approve:**
1. Event is added to `data/events.json` in GitHub
2. Automatic commit is made with descriptive message
3. GitHub triggers Netlify to rebuild the site
4. Form submission is deleted from Netlify
5. Event appears on calendar within 2-3 minutes

### Managing Issue Reports

When someone reports an issue with an event:

1. It appears in the **Issue Reports** tab
2. Review the issue type and details
3. Options:
   - **✕ Dismiss**: Permanently deletes the submission from Netlify

**Note:** Fixing reported issues still requires manual editing of `data/events.json`. The admin interface helps you track which issues have been addressed by removing them from view after dismissal.

### Managing Existing Events

The **Manage Events** tab lets you delete or update events already on the calendar:

1. Click the **Manage Events** tab
2. See all upcoming events (from 7 days ago forward)
3. Use the search box to filter by title, organizer, or event ID
4. For each event:
   - **⚠️ Mark as Cancelled**: Updates the event status to "cancelled" (keeps it on calendar but marks it cancelled)
   - **🗑️ Delete Event**: Permanently removes the event from the calendar

**What happens when you delete/cancel:**
1. Event is removed/updated in `data/events.json` on GitHub
2. Automatic commit is made with descriptive message
3. GitHub triggers Netlify to rebuild the site
4. Changes appear on calendar within 2-3 minutes

**Use cases:**
- Delete events that are no longer happening
- Mark events as cancelled when they're postponed or cancelled
- Clean up duplicate events
- Remove test events

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
