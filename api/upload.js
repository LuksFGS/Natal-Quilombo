const { generateClientTokenFromReadWriteToken } = require("@vercel/blob/client");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  if (req.headers["x-editor-senha"] !== "0000") {
    res.status(401).json({ ok: false, error: "Senha inválida" });
    return;
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(503).json({
      ok: false,
      error: "Vercel Blob não conectado"
    });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const pathname = body.pathname || "uploads/arquivo";
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
