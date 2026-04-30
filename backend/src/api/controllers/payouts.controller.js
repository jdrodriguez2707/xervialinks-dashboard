const payoutsService = require("../../application/services/payouts.service");
const {
  todayISO,
  currentMonthStartISO,
} = require("../../application/services/clientTimezone");
const { clientTimeZoneFromRequest } = require("../utils/clientTz");

async function getPayouts(req, res) {
  const timeZone = clientTimeZoneFromRequest(req);
  const { startDate: queryStartDate, endDate: queryEndDate } = req.query;
  const startDate = queryStartDate || currentMonthStartISO(timeZone);
  const endDate = queryEndDate || todayISO(timeZone);
  const requesterEmail = req.user.role === "worker" ? req.user.email : null;
  const result = await payoutsService.calculatePayouts(
    { startDate, endDate, timeZone },
    requesterEmail
  );
  res.json({ data: result });
}

module.exports = { getPayouts };
