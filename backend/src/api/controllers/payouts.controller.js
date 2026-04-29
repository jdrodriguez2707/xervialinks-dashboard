const payoutsService = require("../../application/services/payouts.service");

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthStartISO() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
}

async function getPayouts(req, res) {
  const { startDate: queryStartDate, endDate: queryEndDate } = req.query;
  const startDate = queryStartDate || currentMonthStartISO();
  const endDate = queryEndDate || todayISO();
  const requesterEmail = req.user.role === "worker" ? req.user.email : null;
  const result = await payoutsService.calculatePayouts(
    { startDate, endDate },
    requesterEmail
  );
  res.json({ data: result });
}

module.exports = { getPayouts };
