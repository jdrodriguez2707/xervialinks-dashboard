const reportsRepository = require("../../domain/repositories/reports.repository");

/**
 * Returns aggregate metrics (totalRevenue, totalImpressions, ecpm) for the
 * admin dashboard summary — no individual report rows exposed.
 *
 * @param {{ startDate?: string, endDate?: string, networkCode?: string }} filters
 */
async function getSummary(filters = {}) {
  const reports = await reportsRepository.findAll({
    startDate: filters.startDate,
    endDate: filters.endDate,
    domain: filters.domain,
    timeZone: filters.timeZone,
    networkCode: filters.networkCode,
  });

  const totalImpressions = reports.reduce((sum, r) => sum + r.impressions, 0);
  const totalRevenue = reports.reduce((sum, r) => sum + r.revenue, 0);
  const ecpm =
    totalImpressions > 0 ? parseFloat(((totalRevenue / totalImpressions) * 1000).toFixed(4)) : 0;

  return {
    totalImpressions,
    totalRevenue: parseFloat(totalRevenue.toFixed(6)),
    ecpm,
  };
}

module.exports = { getSummary };
