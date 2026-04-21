const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // Supports both ntn_*** (new format) and secret_*** (legacy format)
  const notionToken = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;
  if (!notionToken) {
    res.status(500).json({ error: 'NOTION_TOKEN not set in Vercel environment variables' });
    return;
  }

  try {
    const body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', c => chunks.push(c));
      req.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(new Error('Invalid JSON')); }
      });
      req.on('error', reject);
    });

    const { os, company, role, tier, stage, reg, url, today } = body;

    // Database IDs and property names confirmed from schema fetch
    const configs = {
      pm: {
        databaseId: '45ecc169-634b-49c2-9042-9e4fee1c0750',
        buildProperties: () => {
          const p = {
            'Company': { title: [{ text: { content: company || '' } }] },
            'Role': { rich_text: [{ text: { content: role || '' } }] },
            'Tier': { select: { name: tier || 'B' } },
            'Stage': { select: { name: stage || 'Targeting' } },
            'Regulatory Complexity': { select: { name: reg || 'Medium' } },
            'Source': { select: { name: 'Agent Search' } },
          };
          if (url) p['Job URL'] = { url };
          return p;
        }
      },
      rmdm: {
        databaseId: '831f5122-169b-462e-bb34-fb55a4400582',
        buildProperties: () => {
          const p = {
            'Company': { title: [{ text: { content: company || '' } }] },
            'Role Title': { rich_text: [{ text: { content: role || '' } }] },
            'Tier': { select: { name: tier || 'B' } },
            'Stage': { select: { name: stage || 'Targeting' } },
            'Regulatory Environment': { select: { name: reg || 'Standard SaaS' } },
            'Source': { select: { name: 'Agent Search' } },
          };
          if (url) p['Job URL'] = { url };
          return p;
        }
      },
      np: {
        databaseId: '8927f682-8c46-4c46-b54e-fe9280229c05',
        buildProperties: () => {
          const p = {
            'Organization': { title: [{ text: { content: company || '' } }] },
            'Role Title': { rich_text: [{ text: { content: role || '' } }] },
            'Tier': { select: { name: tier || 'B' } },
            'Stage': { select: { name: stage || 'Targeting' } },
            'Engagement Type': { select: { name: 'Paid' } },
            'Source': { select: { name: 'Agent Search' } },
          };
          if (url) p['Job URL'] = { url };
          return p;
        }
      }
    };

    const cfg = configs[os];
    if (!cfg) {
      res.status(400).json({ error: 'Unknown OS: ' + os });
      return;
    }

    const payload = JSON.stringify({
      parent: { database_id: cfg.databaseId },
      properties: cfg.buildProperties(),
    });

    const result = await new Promise((resolve, reject) => {
      const apiReq = https.request({
        hostname: 'api.notion.com',
        path: '/v1/pages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + notionToken,
          'Notion-Version': '2022-06-28',
          'Content-Length': Buffer.byteLength(payload),
        },
      }, (apiRes) => {
        const chunks = [];
        apiRes.on('data', c => chunks.push(c));
        apiRes.on('end', () => {
          try { resolve({ status: apiRes.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); }
          catch (e) { resolve({ status: apiRes.statusCode, body: {} }); }
        });
      });

      apiReq.on('error', reject);
      apiReq.setTimeout(15000, () => { apiReq.destroy(new Error('Notion API timeout')); });
      apiReq.write(payload);
      apiReq.end();
    });

    if (result.status === 200) {
      res.status(200).json({ success: true, pageId: result.body.id });
    } else {
      // Return the full Notion error so we can diagnose it
      res.status(result.status).json({
        error: result.body.message || 'Notion API error',
        code: result.body.code,
        _debug: result.body,
      });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
