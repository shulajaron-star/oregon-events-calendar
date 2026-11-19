// This function deletes a form submission from Netlify Forms

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { submissionId } = JSON.parse(event.body);

    if (!submissionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'submissionId is required' })
      };
    }

    const netlifyToken = process.env.NETLIFY_API_TOKEN;

    if (!netlifyToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'NETLIFY_API_TOKEN not configured' })
      };
    }

    // Delete the submission from Netlify
    const response = await fetch(
      `https://api.netlify.com/api/v1/submissions/${submissionId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${netlifyToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to delete submission: ${response.status} ${response.statusText}`);
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        success: true,
        message: 'Submission deleted successfully'
      })
    };

  } catch (error) {
    console.error('Error deleting submission:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to delete submission',
        message: error.message
      })
    };
  }
};
