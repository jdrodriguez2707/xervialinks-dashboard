const env = require("../../infrastructure/config/env");

const DEFAULT_TZ = process.env.DEFAULT_REPORT_TIMEZONE || "America/Bogota";

const TZ_SAFE = /^[A-Za-z0-9_/+-]+$/;

/**
 * Validates IANA timezone names (throws RangeError if invalid).
 */
function isValidIanaTimeZone(tz) {
  if (!tz || typeof tz !== "string" || tz.length > 120 || !TZ_SAFE.test(tz)) {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function getDefaultTimeZone() {
  const fromEnv = env.DEFAULT_REPORT_TIMEZONE;
  if (fromEnv && isValidIanaTimeZone(fromEnv)) return fromEnv;
  return DEFAULT_TZ;
}

/**
 * Resolves the browser/client timezone from the request header, or default.
 * @param {string|undefined} headerValue  e.g. req.headers["x-client-timezone"]
 */
function resolveClientTimeZone(headerValue) {
  const raw = typeof headerValue === "string" ? headerValue.trim() : "";
  if (raw && isValidIanaTimeZone(raw)) return raw;
  return getDefaultTimeZone();
}

/** Calendar "today" as YYYY-MM-DD in the given IANA zone. */
function todayISO(timeZone, referenceDateISO) {
  const tz = timeZone || getDefaultTimeZone();
  if (isValidISODate(referenceDateISO)) return referenceDateISO;
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

/**
 * Calendar date N days before "today" in the same zone (handles month edges; DST-safe anchor).
 */
function daysAgoISO(n, timeZone, referenceDateISO) {
  const tz = timeZone || getDefaultTimeZone();
  const today = todayISO(tz, referenceDateISO);
  const [y, m, d] = today.split("-").map(Number);
  const anchorMs = Date.UTC(y, m - 1, d, 12, 0, 0) - n * 86400000;
  return new Date(anchorMs).toLocaleDateString("en-CA", { timeZone: tz });
}

/** First day of the calendar month containing "today" in the zone. */
function currentMonthStartISO(timeZone, referenceDateISO) {
  const tz = timeZone || getDefaultTimeZone();
  const ref = todayISO(tz, referenceDateISO);
  if (ref) {
    const [year, month] = ref.split("-");
    return `${year}-${month}-01`;
  }
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  });
  const parts = f.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}-01`;
}

function isValidISODate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Día 1–23 del mes: el periodo de pago "en curso" es el mes calendario anterior (se liquida el 23).
 * Día 24 en adelante: el periodo en curso es el mes calendario actual (liquidación el 23 del mes siguiente).
 * @param {string} [timeZone]
 * @param {Date} [referenceDate]
 * @returns {string} YYYY-MM
 */
function getDefaultPaymentMonthKey(timeZone, referenceDate = new Date()) {
  const tz = timeZone || getDefaultTimeZone();
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = f.formatToParts(referenceDate);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  if (d <= 23) {
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    return `${py}-${String(pm).padStart(2, "0")}`;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

module.exports = {
  resolveClientTimeZone,
  getDefaultTimeZone,
  isValidIanaTimeZone,
  todayISO,
  daysAgoISO,
  currentMonthStartISO,
  isValidISODate,
  getDefaultPaymentMonthKey,
};
