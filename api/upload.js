const { generateClientTokenFromReadWriteToken } = require("@vercel/blob/client");

const CLOUD_FALLBACK_ORIGIN = "https://natal-quilombo.vercel.app";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-editor-senha");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  if (req.headers["x-editor-senha"] !== "0000") {
    res.status(401).json({ ok: false, error: "Senha inválida" });
    return;
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  const pathname = body.pathname || "uploads/arquivo";

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const host = String(req.headers.host || "");
    if (!host.includes("natal-quilombo.vercel.app")) {
      try {
        const proxyRes = await fetch(CLOUD_FALLBACK_ORIGIN + "/api/upload", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-editor-senha": req.headers["x-editor-senha"]
          },
          body: JSON.stringify({ pathname })
        });
        const data = await proxyRes.json();
        res.status(proxyRes.status).json(data);
        return;
      } catch (_) {}
    }
    res.status(503).json({
      ok: false,
      error: "Vercel Blob não conectado"
    });
    return;
  }

  try {
    const clientToken = await generateClientTokenFromReadWriteToken({
      pathname,
      addRandomSuffix: true,
      allowOverwrite: true,
      maximumSizeInBytes: 500 * 1024 * 1024
    });
    res.status(200).json({ ok: true, clientToken });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
};
