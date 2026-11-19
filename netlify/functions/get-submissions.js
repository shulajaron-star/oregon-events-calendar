exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Get Netlify API token from environment variable
    const netlifyToken = process.env.NETLIFY_API_TOKEN;

    if (!netlifyToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Missing configuration',
          message: 'NETLIFY_API_TOKEN environment variable must be set'
        })
      };
    }

    // Get the site ID - Netlify automatically provides this as an environment variable
    // But we can also accept it as a custom env var for local testing
    const siteId = process.env.NETLIFY_SITE_ID || process.env.CUSTOM_SITE_ID;

    if (!siteId) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Missing site ID',
          message: 'NETLIFY_SITE_ID not available. This should be set automatically by Netlify.'
        })
      };
    }

    // Fetch form submissions from Netlify API
    // https://docs.netlify.com/api/get-started/#submissions
    const formsResponse = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/forms`, {
      headers: {
        'Authorization': `Bearer ${netlifyToken}`
      }
    });

    if (!formsResponse.ok) {
      throw new Error(`Failed to fetch forms: ${formsResponse.status} ${formsResponse.statusText}`);
    }

    const forms = await formsResponse.json();

    // Find our two forms
    const suggestionForm = forms.find(f => f.name === 'event-suggestions');
    const issueForm = forms.find(f => f.name === 'event-issues');

    let suggestions = [];
    let issues = [];

    // Fetch submissions for event-suggestions form
    if (suggestionForm) {
      const suggestionsResponse = await fetch(
        `https://api.netlify.com/api/v1/forms/${suggestionForm.id}/submissions`,
        {
          headers: {
            'Authorization': `Bearer ${netlifyToken}`
          }
        }
      );

      if (suggestionsResponse.ok) {
        suggestions = await suggestionsResponse.json();
      }
    }

    // Fetch submissions for event-issues form
    if (issueForm) {
      const issuesResponse = await fetch(
        `https://api.netlify.com/api/v1/forms/${issueForm.id}/submissions`,
        {
          headers: {
            'Authorization': `Bearer ${netlifyToken}`
          }
        }
      );

      if (issuesResponse.ok) {
        issues = await issuesResponse.json();
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        suggestions: suggestions,
        issues: issues
      })
    };

  } catch (error) {
    console.error('Error fetching submissions:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to fetch form submissions',
        message: error.message
      })
    };
  }
};
