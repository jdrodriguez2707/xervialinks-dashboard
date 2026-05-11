const env = require("../../infrastructure/config/env");

/**
 * Protects cron/internal routes with a shared secret header.
 * Returns 404 when CRON_SECRET is not configured (endpoint hidden).
 */
function requireCronSecret(req, res, next) {
  const secret = env.CRON_SECRET;
  if (!secret || !String(secret).trim()) {
    return res.status(404).json({ error: "Not found" });
  }
  const provided = req.get("X-Cron-Secret");
  if (provided !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

module.exports = { requireCronSecret };
