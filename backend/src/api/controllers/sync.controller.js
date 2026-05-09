const syncStatusService = require("../../application/services/syncStatus.service");

function getSyncStatus(req, res) {
  const status = syncStatusService.getSyncStatus(req.query || {});
  res.json({ data: status });
}

module.exports = { getSyncStatus };
