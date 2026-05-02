const path = require("path");
const { GoogleAuth } = require("google-auth-library");
const env = require("../config/env");

const GAM_BASE_URL = "https://admanager.googleapis.com/v1";
const SCOPES = ["https://www.googleapis.com/auth/admanager"];

class GamAuthError extends Error {
  constructor(message, statusCode = 503) {
    super(message);
    this.name = "GamAuthError";
    this.statusCode = statusCode;
  }
}

/**
 * Returns a fresh OAuth2 access token using the configured service account.
 * Credentials are loaded from GAM_KEY_FILE (path) or GAM_CREDENTIALS_JSON (raw JSON string).
 */
async function getAccessToken() {
  try {
    const auth = new GoogleAuth({
      ...resolveCredentials(),
      scopes: SCOPES,
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token;
  } catch (err) {
    const raw = String(err?.message || err);
    if (
      /invalid_grant|Invalid JWT|short-lived token|reasonable timeframe|iat and exp/i.test(
        raw
      )
    ) {
      throw new GamAuthError(
        "No se pudo autenticar con Google Ad Manager: la fecha u hora del sistema no coincide con la hora real (los JWT deben emitirse en un margen válido). Restaura la fecha y hora correctas del equipo o VM, reinicia el proceso del backend y vuelve a intentar. Si no cambiaste el reloj, revisa las credenciales del servicio (GAM_KEY_FILE / GAM_CREDENTIALS_JSON).",
        503
      );
    }
    throw err;
  }
}

/**
 * Returns the appropriate GoogleAuth option depending on configuration.
 * GAM_KEY_FILE uses `keyFile` (resolved from project root, not this file's dir).
 * GAM_CREDENTIALS_JSON uses `credentials` (inline JSON string).
 */
function resolveCredentials() {
  if (env.GAM_CREDENTIALS_JSON) {
    return { credentials: JSON.parse(env.GAM_CREDENTIALS_JSON) };
  }
  if (env.GAM_KEY_FILE) {
    return { keyFile: path.resolve(process.cwd(), env.GAM_KEY_FILE) };
  }
  throw new Error(
    "GAM credentials not configured. Set GAM_CREDENTIALS_JSON or GAM_KEY_FILE."
  );
}

/**
 * Builds the full GAM REST API URL for a given path within the configured network.
 *
 * @param {string} path  e.g. "/reports" or "/reports/123:run"
 */
function networkUrl(path) {
  return `${GAM_BASE_URL}/networks/${env.GAM_NETWORK_CODE}${path}`;
}

module.exports = { getAccessToken, networkUrl, GamAuthError };
