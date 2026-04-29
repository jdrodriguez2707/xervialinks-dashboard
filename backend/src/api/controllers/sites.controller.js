const sitesService = require("../../application/services/sites.service");

async function getSites(req, res) {
  const sites = await sitesService.getSites();
  res.json({ data: sites });
}

module.exports = { getSites };
