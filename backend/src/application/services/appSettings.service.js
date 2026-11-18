const appSettingsRepository = require("../../domain/repositories/appSettings.repository");

function getWorkerDailyStatsEnabled() {
  return appSettingsRepository.getWorkerDailyStatsEnabled();
}

function setWorkerDailyStatsEnabled(enabled) {
  return appSettingsRepository.setWorkerDailyStatsEnabled(enabled);
}

module.exports = { getWorkerDailyStatsEnabled, setWorkerDailyStatsEnabled };
