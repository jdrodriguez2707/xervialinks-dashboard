const { getDb } = require("../../infrastructure/database/database");

const WORKER_DAILY_STATS_SETTING = "worker_daily_stats_enabled";

function getWorkerDailyStatsEnabled() {
  const row = getDb()
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(WORKER_DAILY_STATS_SETTING);
  return row.value === "true";
}

function setWorkerDailyStatsEnabled(enabled) {
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = datetime('now')`,
    )
    .run(WORKER_DAILY_STATS_SETTING, String(enabled));
  return enabled;
}

module.exports = { getWorkerDailyStatsEnabled, setWorkerDailyStatsEnabled };
