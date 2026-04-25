const reportsRepository = require("../repositories/reports.repository");

/**
 * Returns the sorted list of unique site domains seen in reports from the
 * last 30 days. Works with both mock data and the real GAM API.
 */
async function getSites() {
  const reports = await reportsRepository.findAll({});
  const unique = [...new Set(reports.map((r) => r.domain).filter(Boolean))].sort();
  return unique;
}

module.exports = { getSites };
