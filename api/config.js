const { put, list } = require("@vercel/blob");

const CLOUD_FALLBACK_ORIGIN = "https://natal-quilombo.vercel.app";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-editor-senha");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const host = String(req.headers.host || "");

  if (req.method === "GET") {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      if (!host.includes("natal-quilombo.vercel.app")) {
        try {
          const proxyRes = await fetch(CLOUD_FALLBACK_ORIGIN + "/api/config?t=" + Date.now(), {
            cache: "no-store"
          });
          const data = await proxyRes.json();
          res.status(proxyRes.status).json(data);
          return;
        } catch (_) {}
      }
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
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const config = body.config || body;

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      if (!host.includes("natal-quilombo.vercel.app")) {
        try {
          const proxyRes = await fetch(CLOUD_FALLBACK_ORIGIN + "/api/config", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-editor-senha": req.headers["x-editor-senha"]
            },
            body: JSON.stringify({ config })
          });
          const data = await proxyRes.json();
          res.status(proxyRes.status).json(data);
          return;
        } catch (_) {}
      }
      res.status(503).json({
        ok: false,
        error: "Armazenamento Vercel Blob ainda não conectado ao projeto."
      });
      return;
    }
    try {
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
