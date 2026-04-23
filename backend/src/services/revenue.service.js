const reportsRepo = require("../repositories/reports.repository");

// ─── Date helpers (pure — easy to unit-test) ──────────────────────────────────

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function currentMonthStartISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
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

  return { revenue, impressions };
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
  return aggregateForRange(daysAgoISO(6), todayISO(), domains);
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
 * Builds the full worker dashboard payload.
 * All monetary values are already multiplied by the worker's percentage —
 * the frontend never sees gross revenue.
 *
 * @param {{ percentage: number, properties: Array }} worker
 * @returns {Promise<{ today, yesterday, last7Days, currentMonth, impressions }>}
 */
async function getWorkerDashboard(worker) {
  const assignedDomains = worker.properties
    .filter((p) => p.type === "domain" || p.type === "ad_unit")
    .map((p) => p.value);

  const [today, yesterday, last7Days, currentMonth] = await Promise.all([
    getTodayRevenue(assignedDomains),
    getYesterdayRevenue(assignedDomains),
    getLast7DaysRevenue(assignedDomains),
    getCurrentMonthRevenue(assignedDomains),
  ]);

  const { percentage } = worker;

  return {
    today: applyPercentage(today.revenue, percentage),
    yesterday: applyPercentage(yesterday.revenue, percentage),
    last7Days: applyPercentage(last7Days.revenue, percentage),
    currentMonth: applyPercentage(currentMonth.revenue, percentage),
    impressions: currentMonth.impressions,
  };
}

module.exports = {
  getTodayRevenue,
  getYesterdayRevenue,
  getLast7DaysRevenue,
  getCurrentMonthRevenue,
  applyPercentage,
  getWorkerDashboard,
  // exported for testing
  todayISO,
  daysAgoISO,
  currentMonthStartISO,
};
