const summaryService = require("../services/summary.service");

async function getSummary(req, res) {
  const { startDate, endDate } = req.query;
  const summary = await summaryService.getSummary({ startDate, endDate });
  res.json({ data: summary });
}

module.exports = { getSummary };
