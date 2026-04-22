const reportsService = require("../services/reports.service");

/**
 * GET /api/reports
 * Query params: domain, startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 */
async function getReports(req, res) {
  const { domain, startDate, endDate } = req.query;
  const data = await reportsService.getReports({ domain, startDate, endDate });
  res.json(data);
}

module.exports = { getReports };
