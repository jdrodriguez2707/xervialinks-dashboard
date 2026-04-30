const sitesService = require("../../application/services/sites.service");
const { clientTimeZoneFromRequest } = require("../utils/clientTz");

async function getSites(req, res) {
  const sites = await sitesService.getSites(clientTimeZoneFromRequest(req));
  res.json({ data: sites });
}

module.exports = { getSites };
