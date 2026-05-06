import { getClientTimeZone } from "../api/auth";

/** Must match backend default when the client zone is missing or invalid. */
const FALLBACK_TZ = "America/Bogota";

const TZ_SAFE = /^[A-Za-z0-9_/+-]+$/;

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

/** Same zone sent in X-Client-Timezone and used by the API for mock/report ranges. */
export function getReportCalendarTimeZone() {
  const raw = (getClientTimeZone() || "").trim();
  if (raw && isValidIanaTimeZone(raw)) return raw;
  return FALLBACK_TZ;
}

export function todayISOInReportTZ() {
  const tz = getReportCalendarTimeZone();
  return new Date().toLocaleDateString("en-CA", { timeZone: tz });
}

export function daysAgoISOInReportTZ(n) {
  const tz = getReportCalendarTimeZone();
  const today = todayISOInReportTZ();
  const [y, m, d] = today.split("-").map(Number);
  const anchorMs = Date.UTC(y, m - 1, d, 12, 0, 0) - n * 86400000;
  return new Date(anchorMs).toLocaleDateString("en-CA", { timeZone: tz });
}

export function currentMonthStartISOInReportTZ() {
  const tz = getReportCalendarTimeZone();
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
  });
  const parts = f.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const mo = parts.find((p) => p.type === "month")?.value;
  return `${y}-${mo}-01`;
}

/**
 * Date range query params for admin summary/payouts — aligned with X-Client-Timezone.
 */
export function getAdminDateRange(rangeKey) {
  switch (rangeKey) {
    case "today":
      return {
        startDate: todayISOInReportTZ(),
        endDate: todayISOInReportTZ(),
      };
    case "yesterday":
      return {
        startDate: daysAgoISOInReportTZ(1),
        endDate: daysAgoISOInReportTZ(1),
      };
    case "last7Days":
      return {
        startDate: daysAgoISOInReportTZ(7),
        endDate: daysAgoISOInReportTZ(1),
      };
    case "currentMonth":
    default:
      return {
        startDate: currentMonthStartISOInReportTZ(),
        endDate: todayISOInReportTZ(),
      };
  }
}
