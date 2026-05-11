const rateLimit = require("express-rate-limit");
const env = require("../../infrastructure/config/env");

/**
 * Limits brute-force attempts on POST /api/auth/login.
 * Uses IP from `trust proxy` when enabled (Railway, etc.).
 */
module.exports = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.nodeEnv === "production" ? 20 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de inicio de sesión. Intenta más tarde." },
});
