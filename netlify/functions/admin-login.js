// Secure admin authentication via Netlify Function
// Password is stored in environment variable, never sent to browser

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { password } = JSON.parse(event.body);

    // Get password from environment variable
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (!ADMIN_PASSWORD) {
      console.error('ADMIN_PASSWORD environment variable not set');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Server configuration error' })
      };
    }

    // Check password
    if (password === ADMIN_PASSWORD) {
      // Generate a simple session token (in production, use JWT or similar)
      const sessionToken = Buffer.from(`${Date.now()}-${Math.random()}`).toString('base64');

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        body: JSON.stringify({
          success: true,
          message: 'Login successful',
          token: sessionToken
        })
      };
    } else {
      // Incorrect password
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          success: false,
          message: 'Incorrect password'
        })
      };
    }

  } catch (error) {
    console.error('Login error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Login failed',
        message: error.message
      })
    };
  }
};
