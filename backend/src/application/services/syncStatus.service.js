const env = require("../../infrastructure/config/env");
const reportsRepo = require("../../domain/repositories/reports.repository");
const gamNetworksService = require("./gamNetworks.service");

function getSyncStatus(query = {}) {
  const status = reportsRepo.getSyncStatus();
  const requested = query.networkCode;
  let activeNetworkCode = null;
  let networkLast = null;
  try {
    activeNetworkCode = gamNetworksService.resolveNetworkForAdminQuery(requested);
  } catch {
    activeNetworkCode = null;
  }
  if (activeNetworkCode) {
    networkLast = reportsRepo.getLastSyncForNetwork(activeNetworkCode);
  }

  return {
    ...status,
    activeNetworkCode,
    activeNetworkLastSyncedAt: networkLast?.lastSyncedAt || null,
    activeNetworkLastSource: networkLast?.lastSource || null,
    batchIntervalMs: env.REPORTS_BATCH_INTERVAL_MS,
    backfillIntervalMs: env.REPORTS_BACKFILL_INTERVAL_MS,
    batchWindowDays: env.REPORTS_BATCH_WINDOW_DAYS,
    backfillWindowDays: env.REPORTS_BACKFILL_WINDOW_DAYS,
  };
}

module.exports = { getSyncStatus };
