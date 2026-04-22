const reportsRepository = require("../repositories/reports.repository");

/**
 * Returns the list of reports with an aggregated summary.
 *
 * @param {{ domain?: string, startDate?: string, endDate?: string }} filters
 */
async function getReports(filters = {}) {
  const reports = await reportsRepository.findAll(filters);
  const summary = buildSummary(reports);

  return { reports, summary };
}

/**
 * Aggregates total impressions and revenue across all reports.
 * ecpm is recalculated from the totals to avoid averaging averages.
 *
 * @param {Array<{ impressions: number, revenue: number }>} reports
 */
function buildSummary(reports) {
  const totalImpressions = reports.reduce((sum, r) => sum + r.impressions, 0);
  const totalRevenue = reports.reduce((sum, r) => sum + r.revenue, 0);

  const ecpm =
    totalImpressions > 0
      ? parseFloat(((totalRevenue / totalImpressions) * 1000).toFixed(4))
      : 0;

  return {
    totalImpressions,
    totalRevenue: parseFloat(totalRevenue.toFixed(6)),
    ecpm,
  };
}

module.exports = { getReports };
