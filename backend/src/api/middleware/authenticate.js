const jwt = require("jsonwebtoken");
const env = require("../../infrastructure/config/env");
const authRepo = require("../../domain/repositories/auth.repository");

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Autenticación requerida" });
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const user = authRepo.findById(decoded.userId);
    if (!user || user.deleted_at) {
      return res
        .status(401)
        .json({ error: "Tu cuenta de trabajador fue eliminada. Contacta al administrador." });
    }
    if (user.role === "worker" && user.session_invalidated_at && decoded?.iat) {
      const invalidatedAtMs = Date.parse(
        String(user.session_invalidated_at).replace(" ", "T") + "Z",
      );
      const tokenIssuedAtMs = Number(decoded.iat) * 1000;
      if (Number.isFinite(invalidatedAtMs) && tokenIssuedAtMs <= invalidatedAtMs) {
        const credRaw = user.session_credentials_invalidated_at;
        const credentialsInvalidatedAtMs = credRaw
          ? Date.parse(String(credRaw).replace(" ", "T") + "Z")
          : NaN;
        const credentialBasedRevocation =
          Number.isFinite(credentialsInvalidatedAtMs) &&
          tokenIssuedAtMs <= credentialsInvalidatedAtMs;
        return res.status(401).json({
          error: credentialBasedRevocation
            ? "Tus credenciales fueron cambiadas por el administrador. Inicia sesión nuevamente y contacta al administrador si no reconoces este cambio."
            : "SESSION_REVOKED_PROFILE",
        });
      }
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Se requieren permisos de administrador" });
  }
  next();
}

module.exports = { authenticate, requireAdmin };
