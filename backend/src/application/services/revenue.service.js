const reportsRepo = require("../../domain/repositories/reports.repository");
const {
  getDefaultTimeZone,
  todayISO,
  daysAgoISO,
  currentMonthStartISO,
} = require("./clientTimezone");

// ─── Revenue aggregation ──────────────────────────────────────────────────────

/**
 * Fetches reports for a date range, optionally filtered by domain list,
 * and returns aggregated revenue + impressions.
 *
 * @param {string} startDate
 * @param {string} endDate
 * @param {string[]|null} domains  null = all domains
 * @param {string} [timeZone]  IANA — aligns mock rows with calendar boundaries
 */
async function aggregateForRange(startDate, endDate, domains = null, timeZone) {
  const tz = timeZone || getDefaultTimeZone();

  if (Array.isArray(domains) && domains.length === 0) {
    return { revenue: 0, impressions: 0, ecpm: 0 };
  }

  const reports = await reportsRepo.findAll({ startDate, endDate, timeZone: tz });

  const filtered =
    domains && domains.length > 0 ? reports.filter((r) => domains.includes(r.domain)) : reports;

  const revenue = parseFloat(filtered.reduce((sum, r) => sum + r.revenue, 0).toFixed(6));
  const impressions = filtered.reduce((sum, r) => sum + r.impressions, 0);
  const ecpm = impressions > 0 ? parseFloat(((revenue / impressions) * 1000).toFixed(4)) : 0;

  return { revenue, impressions, ecpm };
}

async function getTodayRevenue(domains = null, timeZone, referenceDate) {
  const tz = timeZone || getDefaultTimeZone();
  const today = todayISO(tz, referenceDate);
  return aggregateForRange(today, today, domains, tz);
}

async function getYesterdayRevenue(domains = null, timeZone, referenceDate) {
  const tz = timeZone || getDefaultTimeZone();
  const yesterday = daysAgoISO(1, tz, referenceDate);
  return aggregateForRange(yesterday, yesterday, domains, tz);
}

async function getLast7DaysRevenue(domains = null, timeZone, referenceDate) {
  const tz = timeZone || getDefaultTimeZone();
  return aggregateForRange(
    daysAgoISO(7, tz, referenceDate),
    daysAgoISO(1, tz, referenceDate),
    domains,
    tz,
  );
}

async function getCurrentMonthRevenue(domains = null, timeZone, referenceDate) {
  const tz = timeZone || getDefaultTimeZone();
  return aggregateForRange(
    currentMonthStartISO(tz, referenceDate),
    todayISO(tz, referenceDate),
    domains,
    tz,
  );
}

// ─── Worker calculation ───────────────────────────────────────────────────────

function applyPercentage(revenue, percentage) {
  return parseFloat(((revenue * percentage) / 100).toFixed(2));
}

/**
 * Returns all 4 dashboard periods for a worker, each with revenue (net),
 * eCPM (gross — reflects site performance), and impressions.
 *
 * @param {{ percentage: number, properties: Array }} worker
 * @param {string} timeZone  IANA timezone from the client (X-Client-Timezone)
 * @param {{ domain?: string, referenceDate?: string }} [filters] Optional worker metric scope
 */
async function getWorkerDashboardPeriods(worker, timeZone, filters = {}) {
  const tz = timeZone || getDefaultTimeZone();
  const referenceDate = filters.referenceDate || undefined;

  const assignedDomains = worker.properties.filter((p) => p.type === "domain").map((p) => p.value);

  const requestedDomain =
    typeof filters.domain === "string" && filters.domain.trim() ? filters.domain.trim() : null;
  const scopedDomains = requestedDomain ? [requestedDomain] : assignedDomains;

  if (scopedDomains.length === 0) {
    const empty = { revenue: 0, ecpm: 0, impressions: 0 };
    return {
      today: empty,
      yesterday: empty,
      last7Days: empty,
      currentMonth: empty,
    };
  }

  const monthStart = currentMonthStartISO(tz, referenceDate);
  const today = todayISO(tz, referenceDate);
  const yesterday = daysAgoISO(1, tz, referenceDate);
  const last7Start = daysAgoISO(7, tz, referenceDate);
  const baseStart = monthStart < last7Start ? monthStart : last7Start;

  const reports = await reportsRepo.findAll({
    startDate: baseStart,
    endDate: today,
    timeZone: tz,
  });
  const workerReports = reports.filter((r) => scopedDomains.includes(r.domain));

  const rawToday = aggregateReports(workerReports, today, today);
  const rawYesterday = aggregateReports(workerReports, yesterday, yesterday);
  const rawLast7 = aggregateReports(workerReports, last7Start, yesterday);
  const rawMonth = aggregateReports(workerReports, monthStart, today);

  const pct = worker.percentage;
  const build = (raw) => ({
    revenue: applyPercentage(raw.revenue, pct),
    ecpm: raw.ecpm,
    impressions: raw.impressions,
  });

  return {
    today: build(rawToday),
    yesterday: build(rawYesterday),
    last7Days: build(rawLast7),
    currentMonth: build(rawMonth),
  };
}

function aggregateReports(reports, startDate, endDate) {
  const filtered = reports.filter((r) => r.date >= startDate && r.date <= endDate);
  const revenue = parseFloat(filtered.reduce((sum, r) => sum + r.revenue, 0).toFixed(6));
  const impressions = filtered.reduce((sum, r) => sum + r.impressions, 0);
  const ecpm = impressions > 0 ? parseFloat(((revenue / impressions) * 1000).toFixed(4)) : 0;
  return { revenue, impressions, ecpm };
}

module.exports = {
  getTodayRevenue,
  getYesterdayRevenue,
  getLast7DaysRevenue,
  getCurrentMonthRevenue,
  applyPercentage,
  getWorkerDashboardPeriods,
  todayISO,
  daysAgoISO,
  currentMonthStartISO,
};
