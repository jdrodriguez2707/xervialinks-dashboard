const appSettingsService = require("../../application/services/appSettings.service");

function getWorkerDailyStatsVisibility(req, res) {
  res.json({ data: { enabled: appSettingsService.getWorkerDailyStatsEnabled() } });
}

function updateWorkerDailyStatsVisibility(req, res) {
  const { enabled } = req.body || {};
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "El estado debe ser verdadero o falso." });
  }

  const updated = appSettingsService.setWorkerDailyStatsEnabled(enabled);
  res.json({ data: { enabled: updated } });
}

module.exports = { getWorkerDailyStatsVisibility, updateWorkerDailyStatsVisibility };
