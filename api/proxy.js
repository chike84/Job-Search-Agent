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
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(new Error('Invalid JSON body')); }
      });
      req.on('error', reject);
    });

    const payload = JSON.stringify(body);

    // Web search is now GA — no beta header needed or accepted
    const requestHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(payload),
    };

    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: requestHeaders,
      };

      const apiReq = https.request(options, (apiRes) => {
        const chunks = [];
        apiRes.on('data', chunk => chunks.push(chunk));
        apiRes.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          try {
            resolve({ status: apiRes.statusCode, body: JSON.parse(raw) });
          } catch (e) {
            resolve({
              status: 500,
              body: { error: 'Failed to parse Anthropic response', _raw: raw.slice(0, 300) },
            });
          }
        });
        apiRes.on('error', reject);
      });

      apiReq.on('error', reject);
      apiReq.setTimeout(55000, () => {
        apiReq.destroy(new Error('Anthropic request timed out after 55s'));
      });
      apiReq.write(payload);
      apiReq.end();
    });

    if (result.status >= 400) {
      res.status(result.status).json({
        error: result.body.error || result.body,
        _debug: 'Anthropic API error',
      });
      return;
    }

    res.status(200).json(result.body);

  } catch (err) {
    res.status(500).json({ error: err.message, _debug: 'Proxy exception' });
  }
};
