const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });
    return;
  }

  // Test 1: plain call (no tools)
  const plainResult = await makeRequest(apiKey, {
    model: 'claude-sonnet-4-6',
    max_tokens: 10,
    messages: [{ role: 'user', content: 'Say hi' }],
  }, {});

  // Test 2: web search call — no beta header
  const webSearchResult = await makeRequest(apiKey, {
    model: 'claude-sonnet-4-6',
    max_tokens: 100,
    messages: [{ role: 'user', content: 'Search the web for the current date' }],
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
  }, {});

  // Test 3: web search call WITH beta header (old way)
  const webSearchBetaResult = await makeRequest(apiKey, {
    model: 'claude-sonnet-4-6',
    max_tokens: 100,
    messages: [{ role: 'user', content: 'Search the web for the current date' }],
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
  }, { 'anthropic-beta': 'web-search-2025-03-05' });

  res.status(200).json({
    plain_call: { status: plainResult.status, ok: plainResult.status === 200 },
    web_search_no_beta: { status: webSearchResult.status, ok: webSearchResult.status === 200, error: webSearchResult.status !== 200 ? webSearchResult.body : undefined },
    web_search_with_beta: { status: webSearchBetaResult.status, ok: webSearchBetaResult.status === 200, error: webSearchBetaResult.status !== 200 ? webSearchBetaResult.body : undefined },
  });
};

function makeRequest(apiKey, body, extraHeaders) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(payload),
      ...extraHeaders,
    };

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers,
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
        } catch (e) {
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8').slice(0, 300) });
        }
      });
    });

    req.on('error', (e) => resolve({ status: 0, body: e.message }));
    req.setTimeout(30000, () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
    req.write(payload);
    req.end();
  });
}
