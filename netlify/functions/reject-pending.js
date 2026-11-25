// Reject a harvested pending event: remove it from data/events-pending.json and
// add it to data/events-rejected.json so the weekly harvest won't bring it back.
const { readJson, removeFromPending, rememberRejected } = require('./_shared/pending-store');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!process.env.GITHUB_TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GITHUB_TOKEN not configured' }) };
  }

  try {
    const { eventId } = JSON.parse(event.body || '{}');
    if (!eventId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'eventId is required' }) };
    }

    const removed = await removeFromPending(eventId, 'rejected');
    if (removed) await rememberRejected(removed);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, removed: Boolean(removed) })
    };
  } catch (error) {
    console.error('Error rejecting pending event:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to reject event', message: error.message })
    };
  }
};
