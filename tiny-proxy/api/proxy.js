export const config = {
  api: {
    bodyParser: false, // Handle body manually for all methods
  },
};

export default async function handler(req, res) {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    res.status(400).json({ error: "Missing URL parameter" });
    return;
  }

  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    // Read body as stream and buffer it
    let body = undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      body = Buffer.concat(buffers);
    }

    const proxyRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": req.headers["content-type"] || "application/json",
      },
      body,
    });

    const contentType = proxyRes.headers.get("content-type") || "text/plain";
    const data = await proxyRes.text();

    res.setHeader("Content-Type", contentType);
    res.status(proxyRes.status).send(data);
  } catch (err) {
    res.status(500).json({ error: "Proxy failed", details: err.message });
  }
}
