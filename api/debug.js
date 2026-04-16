export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return new Response(JSON.stringify({
      status: 'error',
      problem: 'ANTHROPIC_API_KEY environment variable is not set in Vercel',
      fix: 'Go to Vercel dashboard > your project > Settings > Environment Variables and add ANTHROPIC_API_KEY'
    }, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }

  // Send a minimal valid test request to Anthropic
  const testBody = {
    model: 'claude-sonnet-4-6',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'Say hi' }],
  };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(testBody),
    });

    const data = await res.json();

    return new Response(JSON.stringify({
      status: res.ok ? 'proxy working' : 'anthropic error',
      http_status: res.status,
      api_key_present: true,
      api_key_prefix: apiKey.substring(0, 10) + '...',
      anthropic_response: data,
    }, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      status: 'fetch error',
      error: err.message,
    }, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}
