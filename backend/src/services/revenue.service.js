const reportsRepo = require("../repositories/reports.repository");

// ─── Date helpers (pure — easy to unit-test) ──────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function currentMonthStartISO() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

// ─── Revenue aggregation ──────────────────────────────────────────────────────

/**
 * Fetches reports for a date range, optionally filtered by domain list,
 * and returns aggregated revenue + impressions.
 *
 * @param {string} startDate
 * @param {string} endDate
 * @param {string[]|null} domains  null = all domains
 */
async function aggregateForRange(startDate, endDate, domains = null) {
  const reports = await reportsRepo.findAll({ startDate, endDate });

  const filtered =
    domains && domains.length > 0
      ? reports.filter((r) => domains.includes(r.domain))
      : reports;

  const revenue = parseFloat(
    filtered.reduce((sum, r) => sum + r.revenue, 0).toFixed(6)
  );
  const impressions = filtered.reduce((sum, r) => sum + r.impressions, 0);
  const ecpm = impressions > 0
    ? parseFloat(((revenue / impressions) * 1000).toFixed(4))
    : 0;

  return { revenue, impressions, ecpm };
}

async function getTodayRevenue(domains = null) {
  const today = todayISO();
  return aggregateForRange(today, today, domains);
}

async function getYesterdayRevenue(domains = null) {
  const yesterday = daysAgoISO(1);
  return aggregateForRange(yesterday, yesterday, domains);
}

async function getLast7DaysRevenue(domains = null) {
  // Use complete days only (yesterday back 7 days) so today's incomplete data
  // doesn't skew the result and the range matches GAM's "last 7 days" preset.
  return aggregateForRange(daysAgoISO(7), daysAgoISO(1), domains);
}

async function getCurrentMonthRevenue(domains = null) {
  return aggregateForRange(currentMonthStartISO(), todayISO(), domains);
}

// ─── Worker calculation ───────────────────────────────────────────────────────

/**
 * Applies a worker's percentage to a gross revenue value.
 * payout = revenue * (percentage / 100)
 *
 * @param {number} revenue
 * @param {number} percentage  (0 < percentage <= 100)
 * @returns {number} rounded to 2 decimal places
 */
function applyPercentage(revenue, percentage) {
  return parseFloat(((revenue * percentage) / 100).toFixed(2));
}

/**
 * Returns all 4 dashboard periods for a worker, each with revenue (net),
 * eCPM (gross — reflects site performance), and impressions.
 *
 * Periods:
 *   today        → current day (may be incomplete)
 *   yesterday    → previous complete day
 *   last7Days    → 7 complete days ending yesterday
 *   currentMonth → 1st of month → today
 *
 * @param {{ percentage: number, properties: Array }} worker
 */
async function getWorkerDashboardPeriods(worker) {
  const assignedDomains = worker.properties
    .filter((p) => p.type === "domain")
    .map((p) => p.value);

  const [rawToday, rawYesterday, rawLast7, rawMonth] = await Promise.all([
    aggregateForRange(todayISO(),            todayISO(),            assignedDomains),
    aggregateForRange(daysAgoISO(1),         daysAgoISO(1),         assignedDomains),
    aggregateForRange(daysAgoISO(7),         daysAgoISO(1),         assignedDomains),
    aggregateForRange(currentMonthStartISO(), todayISO(),           assignedDomains),
  ]);

  const pct = worker.percentage;
  const build = (raw) => ({
    revenue:     applyPercentage(raw.revenue, pct),
    ecpm:        raw.ecpm,
    impressions: raw.impressions,
  });

  return {
    today:        build(rawToday),
    yesterday:    build(rawYesterday),
    last7Days:    build(rawLast7),
    currentMonth: build(rawMonth),
  };
}

module.exports = {
  getTodayRevenue,
  getYesterdayRevenue,
  getLast7DaysRevenue,
  getCurrentMonthRevenue,
  applyPercentage,
  getWorkerDashboardPeriods,
  // exported for testing
  todayISO,
  daysAgoISO,
  currentMonthStartISO,
};
