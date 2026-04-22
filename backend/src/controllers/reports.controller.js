const reportsService = require("../services/reports.service");

/**
 * GET /api/reports
 * Query params: domain, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
function getReports(req, res) {
  const { domain, startDate, endDate } = req.query;
  const data = reportsService.getReports({ domain, startDate, endDate });
  res.json(data);
}

module.exports = { getReports };
