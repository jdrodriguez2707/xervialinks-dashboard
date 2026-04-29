const payoutsService = require("../../application/services/payouts.service");

async function getPayouts(req, res) {
  const { startDate, endDate } = req.query;
  const requesterEmail = req.user.role === "worker" ? req.user.email : null;
  const result = await payoutsService.calculatePayouts(
    { startDate, endDate },
    requesterEmail
  );
  res.json({ data: result });
}

module.exports = { getPayouts };
