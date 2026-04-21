const https = require('https');

// Notion API integration token from environment
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) {
    res.status(500).json({ error: 'NOTION_API_KEY not set in Vercel environment variables' });
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

    // Build Notion page properties based on the exact schema for each database
    let databaseId, properties;

    if (os === 'pm') {
      databaseId = '45ecc169-634b-49c2-9042-9e4fee1c0750';
      properties = {
        'Company': { title: [{ text: { content: company || '' } }] },
        'Role': { rich_text: [{ text: { content: role || '' } }] },
        'Tier': { select: { name: tier || 'B' } },
        'Stage': { select: { name: stage || 'Targeting' } },
        'Regulatory Complexity': { select: { name: reg || 'Medium' } },
        'Source': { select: { name: 'Agent Search' } },
        'date:Last Activity:start': { date: { start: today } },
      };
      if (url) properties['Job URL'] = { url: url };

    } else if (os === 'rmdm') {
      databaseId = '831f5122-169b-462e-bb34-fb55a4400582';
      properties = {
        'Company': { title: [{ text: { content: company || '' } }] },
        'Role Title': { rich_text: [{ text: { content: role || '' } }] },
        'Tier': { select: { name: tier || 'B' } },
        'Stage': { select: { name: stage || 'Targeting' } },
        'Regulatory Environment': { select: { name: reg || 'Standard SaaS' } },
        'Source': { select: { name: 'Agent Search' } },
        'date:Last Activity:start': { date: { start: today } },
      };
      if (url) properties['Job URL'] = { url: url };

    } else if (os === 'np') {
      databaseId = '8927f682-8c46-4c46-b54e-fe9280229c05';
      properties = {
        'Organization': { title: [{ text: { content: company || '' } }] },
        'Role Title': { rich_text: [{ text: { content: role || '' } }] },
        'Tier': { select: { name: tier || 'B' } },
        'Stage': { select: { name: stage || 'Targeting' } },
        'Engagement Type': { select: { name: 'Paid' } },
        'Source': { select: { name: 'Agent Search' } },
        'date:Last Activity:start': { date: { start: today } },
      };
      if (url) properties['Job URL'] = { url: url };
    } else {
      res.status(400).json({ error: 'Unknown OS type: ' + os });
      return;
    }

    const payload = JSON.stringify({
      parent: { database_id: databaseId },
      properties,
    });

    const result = await new Promise((resolve, reject) => {
      const apiReq = https.request({
        hostname: 'api.notion.com',
        path: '/v1/pages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + notionKey,
          'Notion-Version': '2022-06-28',
          'Content-Length': Buffer.byteLength(payload),
        },
      }, (apiRes) => {
        const chunks = [];
        apiRes.on('data', c => chunks.push(c));
        apiRes.on('end', () => {
          try {
            resolve({ status: apiRes.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
          } catch (e) {
            resolve({ status: apiRes.statusCode, body: {} });
          }
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
      res.status(result.status).json({ error: result.body.message || 'Notion API error', details: result.body });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
