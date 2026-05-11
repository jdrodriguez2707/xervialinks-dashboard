const reportsSync = require("../../application/services/reportsSync.service");
const reportsRepo = require("../../domain/repositories/reports.repository");

/**
 * POST /api/internal/sync-reports
 * Intended for Railway Cron or similar (header X-Cron-Secret).
 * Runs batch window + 12-month backfill sequentially.
 */
async function postCronSyncReports(_req, res) {
  const batch = await reportsSync.syncReportsBatch({});
  const backfill = await reportsSync.syncReportsBackfill12Months({});
  reportsRepo.clearCache();
  res.json({
    data: {
      batch: {
        startDate: batch.startDate,
        endDate: batch.endDate,
        rowsSynced: batch.rowsSynced,
        source: batch.source,
        networks: batch.networks,
      },
      backfill: {
        startDate: backfill.startDate,
        endDate: backfill.endDate,
        rowsSynced: backfill.rowsSynced,
        source: backfill.source,
        networks: backfill.networks,
      },
    },
  });
}

module.exports = { postCronSyncReports };
