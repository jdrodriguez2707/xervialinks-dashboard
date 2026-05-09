const env = require("../../infrastructure/config/env");
const reportsRepo = require("../../domain/repositories/reports.repository");
const gamNetworksRepo = require("../../domain/repositories/gamNetworks.repository");
const { fetchReports } = require("../../infrastructure/integrations/gamReports");
const { buildMockReports } = require("../../infrastructure/integrations/mockReports");
const { getDefaultTimeZone, todayISO, daysAgoISO } = require("./clientTimezone");

const DEFAULT_BATCH_WINDOW_DAYS = env.REPORTS_BATCH_WINDOW_DAYS;
const TWELVE_MONTHS_WINDOW_DAYS = env.REPORTS_BACKFILL_WINDOW_DAYS;

function listNetworksToSync() {
  return gamNetworksRepo.listCodesWithAccessOk();
}

async function syncReportsBatch(options = {}) {
  const tz = options.timeZone || getDefaultTimeZone();
  const endDate = options.endDate || todayISO(tz);
  const startDate = options.startDate || daysAgoISO(DEFAULT_BATCH_WINDOW_DAYS, tz);
  const source = env.USE_REAL_GAM_API ? "gam-batch" : "mock-batch";

  let codes = listNetworksToSync();
  if (options.onlyNetworkCode != null && String(options.onlyNetworkCode).trim() !== "") {
    const one = String(options.onlyNetworkCode).trim();
    codes = codes.filter((c) => c === one);
  }
  if (codes.length === 0) {
    return {
      startDate,
      endDate,
      source,
      rowsSynced: 0,
      networks: [],
    };
  }

  let rowsSynced = 0;
  for (const networkCode of codes) {
    const rows = env.USE_REAL_GAM_API
      ? await fetchReports({ startDate, endDate, networkCode })
      : buildMockReports(tz, networkCode);
    const withNet = rows.map((row) => ({ ...row, networkCode, source }));
    reportsRepo.upsertMany(withNet);
    rowsSynced += rows.length;
  }

  return {
    startDate,
    endDate,
    source,
    rowsSynced,
    networks: codes,
  };
}

async function syncReportsBackfill12Months(options = {}) {
  const tz = options.timeZone || getDefaultTimeZone();
  const endDate = options.endDate || todayISO(tz);
  const startDate = options.startDate || daysAgoISO(TWELVE_MONTHS_WINDOW_DAYS, tz);
  const source = env.USE_REAL_GAM_API ? "gam-backfill-12m" : "mock-backfill-12m";

  let codes = listNetworksToSync();
  if (options.onlyNetworkCode != null && String(options.onlyNetworkCode).trim() !== "") {
    const one = String(options.onlyNetworkCode).trim();
    codes = codes.filter((c) => c === one);
  }
  if (codes.length === 0) {
    return {
      startDate,
      endDate,
      source,
      rowsSynced: 0,
      networks: [],
    };
  }

  let rowsSynced = 0;
  for (const networkCode of codes) {
    const rows = env.USE_REAL_GAM_API
      ? await fetchReports({ startDate, endDate, networkCode })
      : buildMockReports(tz, networkCode);
    const withNet = rows.map((row) => ({ ...row, networkCode, source }));
    reportsRepo.upsertMany(withNet);
    rowsSynced += rows.length;
  }

  return {
    startDate,
    endDate,
    source,
    rowsSynced,
    networks: codes,
  };
}

module.exports = { syncReportsBatch, syncReportsBackfill12Months, listNetworksToSync };
