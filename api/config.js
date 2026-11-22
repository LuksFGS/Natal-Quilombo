const { put, list } = require("@vercel/blob");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");

  if (req.method === "GET") {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      res.status(200).json({ ok: true, config: null, blobConfigured: false });
      return;
    }
    try {
      const { blobs } = await list({ prefix: "dados/config.json", limit: 5 });
      const match = blobs.find(b => b.pathname === "dados/config.json") || blobs[0];
      if (!match) {
        res.status(200).json({ ok: true, config: null, blobConfigured: true });
        return;
      }
      const resp = await fetch(match.url + "?t=" + Date.now(), { cache: "no-store" });
      if (!resp.ok) {
        res.status(200).json({ ok: true, config: null, blobConfigured: true });
        return;
      }
      const config = await resp.json();
      res.status(200).json({ ok: true, config, blobConfigured: true });
    } catch (err) {
      res.status(200).json({ ok: false, config: null, error: err.message });
    }
    return;
  }

  if (req.method === "POST") {
    if (req.headers["x-editor-senha"] !== "0000") {
      res.status(401).json({ ok: false, error: "Senha inválida" });
      return;
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      res.status(503).json({
        ok: false,
        error: "Armazenamento Vercel Blob ainda não conectado ao projeto."
      });
      return;
    }
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
      const config = body.config || body;
      const blob = await put("dados/config.json", JSON.stringify(config, null, 2), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 0
      });
      res.status(200).json({ ok: true, url: blob.url });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
    return;
  }

  res.status(405).json({ ok: false, error: "Method not allowed" });
};
