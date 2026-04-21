const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel environment variables' });
    return;
  }

  try {
    const body = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON body')); }
      });
      req.on('error', reject);
    });

    // Detect whether this request uses the web search tool
    const usesWebSearch = Array.isArray(body.tools) &&
      body.tools.some(t => t.type === 'web_search_20250305');

    const payload = JSON.stringify(body);

    const requestHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(payload),
    };

    // Only send the beta header when the request actually uses web search
    if (usesWebSearch) {
      requestHeaders['anthropic-beta'] = 'web-search-2025-03-05';
    }

    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: requestHeaders,
      };

      const apiReq = https.request(options, (apiRes) => {
        let responseData = '';
        apiRes.on('data', chunk => { responseData += chunk; });
        apiRes.on('end', () => {
          try {
            resolve({ status: apiRes.statusCode, body: JSON.parse(responseData) });
          } catch (e) {
            reject(new Error('Failed to parse Anthropic response'));
          }
        });
      });

      apiReq.on('error', reject);
      apiReq.setTimeout(55000, () => {
        apiReq.destroy(new Error('Anthropic request timed out after 55s'));
      });
      apiReq.write(payload);
      apiReq.end();
    });

    // Surface Anthropic errors clearly for debugging
    if (data.status >= 400) {
      res.status(data.status).json({
        error: data.body.error || data.body,
        _debug: 'Anthropic API error',
        _usesWebSearch: usesWebSearch,
      });
      return;
    }

    res.status(200).json(data.body);

  } catch (err) {
    res.status(500).json({ error: err.message, _debug: 'Proxy exception' });
  }
};
