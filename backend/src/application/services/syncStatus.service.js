const env = require("../../infrastructure/config/env");
const reportsRepo = require("../../domain/repositories/reports.repository");

function getSyncStatus() {
  const status = reportsRepo.getSyncStatus();
  return {
    ...status,
    batchIntervalMs: env.REPORTS_BATCH_INTERVAL_MS,
    backfillIntervalMs: env.REPORTS_BACKFILL_INTERVAL_MS,
    batchWindowDays: env.REPORTS_BATCH_WINDOW_DAYS,
    backfillWindowDays: env.REPORTS_BACKFILL_WINDOW_DAYS,
  };
}

module.exports = { getSyncStatus };
