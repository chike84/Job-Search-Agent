const https = require('https');

module.exports = async function handler(req, res) {
  // CORS headers on every response
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

    const payload = JSON.stringify(body);

    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(payload),
        },
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

    res.status(data.status).json(data.body);

  } catch (err) {
    res.status(500).json({ error: err.message, _debug: 'Proxy exception' });
  }
};
