const summaryService = require("../../application/services/summary.service");
const gamNetworksService = require("../../application/services/gamNetworks.service");
const { todayISO, currentMonthStartISO } = require("../../application/services/clientTimezone");
const { clientTimeZoneFromRequest } = require("../utils/clientTz");

async function getSummary(req, res) {
  const timeZone = clientTimeZoneFromRequest(req);
  const startDate = req.query.startDate ?? currentMonthStartISO(timeZone);
  const endDate = req.query.endDate ?? todayISO(timeZone);
  const networkCode = gamNetworksService.resolveNetworkForAdminQuery(req.query.networkCode);
  const summary = await summaryService.getSummary({
    startDate,
    endDate,
    timeZone,
    networkCode,
  });
  res.json({ data: summary });
}

module.exports = { getSummary };
