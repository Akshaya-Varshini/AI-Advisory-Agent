export default async function handler(req, res) {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    res.status(400).json({ error: 'Missing target URL' });
    return;
  }

  // Handle preflight (CORS) request
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).end();
    return;
  }

  try {
    const proxyRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        // Remove: ...req.headers (to avoid leaking origin headers)
      },
      body: req.method !== 'GET' && req.method !== 'HEAD'
        ? JSON.stringify(req.body)
        : null,
    });

    const data = await proxyRes.text();

    // ✅ Add CORS headers on final response
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    res.status(proxyRes.status).send(data);
  } catch (error) {
    res.status(500).json({ error: 'Proxy failed', details: error.message });
  }
}
