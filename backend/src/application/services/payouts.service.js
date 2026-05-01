const reportsRepo = require("../../domain/repositories/reports.repository");
const workersRepo = require("../../domain/repositories/workers.repository");

/**
 * Calculates the payout for each worker based on their assigned properties
 * and the revenue from matching reports in the given date range.
 *
 * Formula: payout = assignedRevenue * (percentage / 100)
 *
 * @param {{ startDate?: string, endDate?: string, timeZone?: string }} filters
 * @param {string|null} requesterEmail  When set (worker role), only returns that worker's payout.
 */
async function calculatePayouts(filters = {}, requesterEmail = null) {
  const [reports, allWorkers] = await Promise.all([
    reportsRepo.findAll(filters),
    Promise.resolve(workersRepo.findAll({ includeDeleted: true })),
  ]);

  const workers = requesterEmail
    ? allWorkers.filter((w) => w.email === requesterEmail)
    : allWorkers;

  const payouts = workers
    .map((worker) => {
    const workerDeletedAt = normalizeDate(worker.deleted_at);
    const filterStart = filters.startDate || "0000-00-00";
    const filterEnd = filters.endDate || "9999-12-31";
    const effectiveStart = filterStart;
    const effectiveEnd =
      workerDeletedAt && workerDeletedAt < filterEnd ? workerDeletedAt : filterEnd;
    if (effectiveStart > effectiveEnd) return null;

    const assignedDomains = getAssignedDomains(worker.properties);
    const matchingReports = reports.filter((r) =>
      assignedDomains.includes(r.domain) &&
      r.date >= effectiveStart &&
      r.date <= effectiveEnd
    );

    const assignedRevenue = sumRevenue(matchingReports);
    const assignedImpressions = sumImpressions(matchingReports);
    const payout = computePayout(assignedRevenue, worker.percentage);

    if (workerDeletedAt && assignedRevenue === 0 && assignedImpressions === 0) {
      return null;
    }

    return {
      workerId: worker.id,
      name: worker.name,
      email: worker.email,
      percentage: worker.percentage,
      deletedAt: workerDeletedAt || null,
      assignedDomains,
      assignedProperties: worker.properties,
      assignedRevenue,
      assignedImpressions,
      payout,
    };
    })
    .filter(Boolean);

  const totalPayout = parseFloat(
    payouts.reduce((sum, w) => sum + w.payout, 0).toFixed(6)
  );

  return { payouts, totalPayout };
}

// ─── Pure helpers (easy to unit-test in isolation) ────────────────────────────

function getAssignedDomains(properties) {
  return properties
    .filter((p) => p.type === "domain")
    .map((p) => p.value);
}

function computePayout(revenue, percentage) {
  return parseFloat(((revenue * percentage) / 100).toFixed(6));
}

function sumRevenue(reports) {
  return parseFloat(
    reports.reduce((sum, r) => sum + r.revenue, 0).toFixed(6)
  );
}

function sumImpressions(reports) {
  return reports.reduce((sum, r) => sum + r.impressions, 0);
}

function normalizeDate(value) {
  if (!value || typeof value !== "string") return "";
  return value.slice(0, 10);
}

module.exports = {
  calculatePayouts,
  getAssignedDomains,
  computePayout,
  sumRevenue,
  sumImpressions,
};
