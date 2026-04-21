const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });
    return;
  }

  // Mimic exact request the agent sends for a live job search
  const agentRequest = {
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: 'You are a job search agent for Chike Ugbode, a Senior Product Manager.',
    messages: [{
      role: 'user',
      content: 'Search the web right now for currently open "Senior Product Manager" job postings at growth-stage companies in the Fintech space with high regulatory complexity. For each role found: company name, exact role title, location or remote status, why it fits, direct job URL. Return at least 6 roles.'
    }],
    tools: [{ type: 'web_search_20250305', name: 'web_search' }]
  };

  const result = await makeRequest(apiKey, agentRequest, {});

  res.status(200).json({
    test: 'agent_mimic_web_search',
    http_status: result.status,
    ok: result.status === 200,
    stop_reason: result.status === 200 ? result.body.stop_reason : undefined,
    content_types: result.status === 200
      ? result.body.content?.map(b => b.type)
      : undefined,
    error: result.status !== 200 ? result.body : undefined,
    usage: result.status === 200 ? result.body.usage : undefined,
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

    const apiReq = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers,
    }, (apiRes) => {
      const chunks = [];
      apiRes.on('data', c => chunks.push(c));
      apiRes.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          resolve({ status: apiRes.statusCode, body: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: apiRes.statusCode, body: { parse_error: e.message, raw: raw.slice(0, 500) } });
        }
      });
    });

    apiReq.on('error', (e) => resolve({ status: 0, body: { network_error: e.message } }));
    apiReq.setTimeout(55000, () => { apiReq.destroy(); resolve({ status: 0, body: { error: 'timeout' } }); });
    apiReq.write(payload);
    apiReq.end();
  });
}
