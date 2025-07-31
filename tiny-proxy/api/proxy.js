export default async function handler(req, res) {
  // Set CORS headers for ALL responses
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight (OPTIONS)
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const targetUrl = req.query.url;

  if (!targetUrl) {
    res.status(400).json({ error: "Missing target URL" });
    return;
  }

  try {
    const proxyRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
      },
      body:
        req.method !== "GET" && req.method !== "HEAD"
          ? JSON.stringify(req.body)
          : null,
    });

    const contentType = proxyRes.headers.get("content-type") || "text/html";
    const data = await proxyRes.text();

    res.setHeader("Content-Type", contentType);
    res.status(proxyRes.status).send(data);
  } catch (error) {
    res.status(500).json({ error: "Proxy failed", details: error.message });
  }
}
