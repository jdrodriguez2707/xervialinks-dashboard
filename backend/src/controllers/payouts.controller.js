const payoutsService = require("../services/payouts.service");

async function getPayouts(req, res) {
  const { startDate, endDate } = req.query;
  const result = await payoutsService.calculatePayouts({ startDate, endDate });
  res.json({ data: result });
}

module.exports = { getPayouts };
