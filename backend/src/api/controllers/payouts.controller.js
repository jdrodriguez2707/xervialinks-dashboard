const payoutsService = require("../../application/services/payouts.service");
const paymentHistoryService = require("../../application/services/paymentHistory.service");
const gamNetworksService = require("../../application/services/gamNetworks.service");
const { todayISO, currentMonthStartISO } = require("../../application/services/clientTimezone");
const { clientTimeZoneFromRequest } = require("../utils/clientTz");

async function getPayouts(req, res) {
  const timeZone = clientTimeZoneFromRequest(req);
  const { startDate: queryStartDate, endDate: queryEndDate } = req.query;
  const startDate = queryStartDate || currentMonthStartISO(timeZone);
  const endDate = queryEndDate || todayISO(timeZone);
  const requesterEmail = req.user.role === "worker" ? req.user.email : null;
  const networkCode =
    req.user.role === "admin"
      ? gamNetworksService.resolveNetworkForAdminQuery(req.query.networkCode)
      : undefined;
  const result = await payoutsService.calculatePayouts(
    { startDate, endDate, timeZone, networkCode },
    requesterEmail,
  );
  res.json({ data: result });
}

async function putWorkerNetRevenueOverride(req, res) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Se requieren permisos de administrador" });
  }
  const body = req.body || {};
  const networkCode = gamNetworksService.resolveNetworkForAdminQuery(
    body.gamNetworkCode ?? req.query.networkCode,
  );
  const row = payoutsService.upsertWorkerNetRevenueOverrideAdmin({
    workerId: body.workerId,
    gamNetworkCode: networkCode,
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    netRevenue: body.netRevenue,
  });
  res.json({ data: row });
}

async function getPaymentHistory(req, res) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Se requieren permisos de administrador" });
  }
  const timeZone = clientTimeZoneFromRequest(req);
  const networkCode = gamNetworksService.resolveNetworkForAdminQuery(req.query.networkCode);
  const history = await paymentHistoryService.listPaymentHistory({ timeZone, networkCode });
  res.json({ data: history });
}

module.exports = { getPayouts, getPaymentHistory, putWorkerNetRevenueOverride };
