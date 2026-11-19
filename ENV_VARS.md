# Environment Variables & API Keys

This document lists all environment variables and API keys required for the Oregon Events Calendar to function properly.

## Required Environment Variables

### GitHub API (Required for all admin functions)

**`GITHUB_TOKEN`**
- **Purpose**: Authenticate with GitHub API to read/write events.json and changelog.json
- **Used by**: All Netlify Functions (approve-event, manage-event, get-events, get-changelog, etc.)
- **Permissions needed**: 
  - `repo` scope (read/write access to repository)
  - Personal Access Token (classic) or Fine-grained token with repository contents read/write
- **How to create**: 
  - Go to GitHub Settings → Developer Settings → Personal Access Tokens
  - Generate new token with `repo` scope
- **Where to set**: Netlify Environment Variables (Site Settings → Environment Variables)

**`GITHUB_OWNER`** (Optional, defaults to 'shulajaron-star')
- **Purpose**: GitHub repository owner username
- **Used by**: Netlify Functions to construct GitHub API URLs
- **Default**: `shulajaron-star`
- **Where to set**: Netlify Environment Variables

**`GITHUB_REPO`** (Optional, defaults to 'oregon-events-calendar')
- **Purpose**: GitHub repository name
- **Used by**: Netlify Functions to construct GitHub API URLs
- **Default**: `oregon-events-calendar`
- **Where to set**: Netlify Environment Variables

### Admin Authentication (Required for admin access)

**`ADMIN_PASSWORD`** ⚠️ **CRITICAL - MUST BE SET**
- **Purpose**: Password for admin dashboard authentication
- **Used by**: `admin-login` Netlify Function
- **Security**: Stored securely in environment variable, NEVER in code
- **Current value**: `gegqsB7qwW9goczJkog0Q`
- **How to set**: 
  - Go to Netlify → Site Settings → Environment Variables
  - Add variable: `ADMIN_PASSWORD`
  - Value: `gegqsB7qwW9goczJkog0Q` (or your chosen password)
  - **IMPORTANT**: After setting, change the password to your own value
- **Where to set**: Netlify Environment Variables (Site Settings → Environment Variables)
- **Notes**: 
  - Login will NOT work without this variable set
  - Password is validated server-side, never exposed to browser
  - Change this password regularly for security

### Netlify (Automatically provided by Netlify)

**`NETLIFY_API_TOKEN`**
- **Purpose**: Access Netlify API (if needed for future features)
- **Used by**: Currently not used, but available
- **Automatically set**: Yes (by Netlify)

**`CUSTOM_SITE_ID`**
- **Purpose**: Identify the Netlify site
- **Used by**: Referenced in netlify.toml build environment
- **Automatically set**: Yes (by Netlify)

## Optional Environment Variables

### Future Considerations

**Email Service** (Not currently implemented)
- If email notifications are added, will need:
  - `SENDGRID_API_KEY` or `MAILGUN_API_KEY`
  - `FROM_EMAIL`
  - `ADMIN_EMAIL`

**Analytics** (Not currently implemented)
- If analytics tracking is added:
  - `GOOGLE_ANALYTICS_ID`
  - `PLAUSIBLE_API_KEY`

**Authentication** (Not currently implemented)
- If proper auth is added (instead of basic password):
  - `NETLIFY_IDENTITY_URL`
  - `AUTH0_DOMAIN`
  - `AUTH0_CLIENT_ID`
  - `AUTH0_CLIENT_SECRET`

## Current Configuration Status

### Production (Netlify)
✅ **GITHUB_TOKEN** - Set in Netlify Environment Variables  
✅ **GITHUB_OWNER** - Set to `shulajaron-star`  
✅ **GITHUB_REPO** - Set to `oregon-events-calendar`  
⚠️ **ADMIN_PASSWORD** - **MUST BE SET** in Netlify Environment Variables (see instructions above)  
✅ **NETLIFY_API_TOKEN** - Automatically set by Netlify  
✅ **CUSTOM_SITE_ID** - Automatically set by Netlify  

### Local Development
❌ Netlify Functions don't work locally without env vars  
❌ Forms don't work locally (Netlify Forms only work on deployed site)  
⚠️ For local testing, use the deployed admin interface  

## Security Best Practices

1. **Never commit API keys or tokens to the repository**
   - Keep sensitive values in Netlify Environment Variables only
   - Use `.env` files locally (add to `.gitignore`)

2. **Rotate tokens periodically**
   - GitHub tokens should be rotated every 6-12 months
   - Use fine-grained tokens with minimal required permissions

3. **Monitor token usage**
   - Check GitHub API rate limits regularly
   - Review Netlify function logs for unauthorized access attempts

4. **Restrict token permissions**
   - Only grant `repo` access to specific repositories if using fine-grained tokens
   - Don't use tokens with organization-wide access

## How to Add Environment Variables to Netlify

1. Log in to Netlify
2. Go to Site Settings
3. Navigate to Environment Variables (under "Build & Deploy")
4. Click "Add a variable"
5. Enter variable name and value
6. Set scope to "Same value for all deploy contexts" (or customize per deploy context)
7. Save
8. Redeploy site for changes to take effect

## Troubleshooting

**"GITHUB_TOKEN not configured" error**
- Ensure `GITHUB_TOKEN` is set in Netlify Environment Variables
- Check token hasn't expired (GitHub tokens can expire)
- Verify token has `repo` scope

**Functions return 401/403 errors**
- Check GitHub token permissions
- Verify repository name and owner are correct
- Check token hasn't been revoked

**Changes not appearing on site**
- Ensure environment variables are set
- Check Netlify deploy logs for errors
- Verify GitHub webhook is configured (should be automatic)

---

Last updated: 2026-11-19
