export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing URL' });
  }

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        ...req.headers, // forward original headers like Content-Type
      },
      body: req.method === 'GET' ? null : JSON.stringify(req.body),
    });

    const data = await response.text();
    res.status(response.status).send(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
