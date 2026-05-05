const syncStatusService = require("../../application/services/syncStatus.service");

function getSyncStatus(req, res) {
  const status = syncStatusService.getSyncStatus();
  res.json({ data: status });
}

module.exports = { getSyncStatus };
