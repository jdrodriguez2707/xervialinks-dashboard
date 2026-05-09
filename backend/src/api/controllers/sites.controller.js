const sitesService = require("../../application/services/sites.service");
const gamNetworksService = require("../../application/services/gamNetworks.service");
const { clientTimeZoneFromRequest } = require("../utils/clientTz");

async function getSites(req, res) {
  const networkCode = gamNetworksService.resolveNetworkForAdminQuery(req.query.networkCode);
  const sites = await sitesService.getSites(clientTimeZoneFromRequest(req), { networkCode });
  res.json({ data: sites });
}

module.exports = { getSites };
