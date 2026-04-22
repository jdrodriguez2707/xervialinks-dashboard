const reportsRepo = require("../repositories/reports.repository");
const workersRepo = require("../repositories/workers.repository");

/**
 * Calculates the payout for each worker based on their assigned properties
 * and the revenue from matching reports in the given date range.
 *
 * Formula: payout = assignedRevenue * (percentage / 100)
 *
 * @param {{ startDate?: string, endDate?: string }} filters
 */
async function calculatePayouts(filters = {}) {
  const [reports, workers] = await Promise.all([
    reportsRepo.findAll(filters),
    Promise.resolve(workersRepo.findAll()),
  ]);

  const payouts = workers.map((worker) => {
    const assignedDomains = getAssignedDomains(worker.properties);
    const matchingReports = reports.filter((r) =>
      assignedDomains.includes(r.domain)
    );

    const assignedRevenue = sumRevenue(matchingReports);
    const assignedImpressions = sumImpressions(matchingReports);
    const payout = computePayout(assignedRevenue, worker.percentage);

    return {
      workerId: worker.id,
      name: worker.name,
      email: worker.email,
      percentage: worker.percentage,
      assignedDomains,
      assignedRevenue,
      assignedImpressions,
      payout,
    };
  });

  const totalPayout = parseFloat(
    payouts.reduce((sum, w) => sum + w.payout, 0).toFixed(6)
  );

  return { payouts, totalPayout };
}

// ─── Pure helpers (easy to unit-test in isolation) ────────────────────────────

/**
 * Extracts domain values from a worker's properties list.
 *
 * @param {Array<{ type: string, value: string }>} properties
 * @returns {string[]}
 */
function getAssignedDomains(properties) {
  return properties.filter((p) => p.type === "domain").map((p) => p.value);
}

/**
 * @param {number} revenue
 * @param {number} percentage  (0 < percentage <= 100)
 * @returns {number} rounded to 6 decimal places
 */
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

module.exports = {
  calculatePayouts,
  getAssignedDomains,
  computePayout,
  sumRevenue,
  sumImpressions,
};
