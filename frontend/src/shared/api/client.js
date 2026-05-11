/**
 * Base URL for the API in production (Vercel + separate backend).
 * In local dev, leave empty so Vite proxy handles `/api/*`.
 * If the env value is host-only (missing scheme), browsers treat it as a path on the
 * current origin — prepend https:// so POST /api/* hits Railway, not Vercel.
 */
function normalizeApiBase(raw) {
  let base = String(raw || "").trim().replace(/\/$/, "");
  if (!base) return "";
  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  return base;
}

const API_BASE = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);

/**
 * @param {string} path  Must start with `/`, e.g. `/api/auth/login`
 */
export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}
