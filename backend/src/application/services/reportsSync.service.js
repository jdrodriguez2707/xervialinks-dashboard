const env = require("../../infrastructure/config/env");
const reportsRepo = require("../../domain/repositories/reports.repository");
const { fetchReports } = require("../../infrastructure/integrations/gamReports");
const { buildMockReports } = require("../../infrastructure/integrations/mockReports");
const {
  getDefaultTimeZone,
  todayISO,
  daysAgoISO,
} = require("./clientTimezone");

const DEFAULT_BATCH_WINDOW_DAYS = 30;

async function syncReportsBatch(options = {}) {
  const tz = options.timeZone || getDefaultTimeZone();
  const endDate = options.endDate || todayISO(tz);
  const startDate = options.startDate || daysAgoISO(DEFAULT_BATCH_WINDOW_DAYS, tz);
  const source = env.USE_REAL_GAM_API ? "gam-batch" : "mock-batch";

  const rows = env.USE_REAL_GAM_API
    ? await fetchReports({ startDate, endDate })
    : buildMockReports(tz);

  reportsRepo.upsertMany(rows.map((row) => ({ ...row, source })));

  return {
    startDate,
    endDate,
    source,
    rowsSynced: rows.length,
  };
}

module.exports = { syncReportsBatch };
