const { syncReportsBatch, syncReportsBackfill12Months } = require("./reportsSync.service");

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const DAILY_MS = 24 * 60 * 60 * 1000;
let schedulerTimer = null;
let backfillTimer = null;
let runInFlight = null;

async function runReportsSyncOnce(trigger = "manual") {
  if (runInFlight) return runInFlight;
  runInFlight = syncReportsBatch()
    .then((result) => {
      console.log(
        `[reports-sync] trigger=${trigger} source=${result.source} rows=${result.rowsSynced} range=${result.startDate}->${result.endDate}`
      );
      return result;
    })
    .catch((error) => {
      console.error(`[reports-sync] trigger=${trigger} failed`, error.message || error);
      return null;
    })
    .finally(() => {
      runInFlight = null;
    });
  return runInFlight;
}

function startReportsSyncScheduler() {
  if (schedulerTimer) return;
  schedulerTimer = setInterval(() => {
    runReportsSyncOnce("interval-3h");
  }, THREE_HOURS_MS);
  if (typeof schedulerTimer.unref === "function") {
    schedulerTimer.unref();
  }

  if (!backfillTimer) {
    backfillTimer = setInterval(() => {
      runReportsBackfill12MonthsOnce("daily-backfill-12m");
    }, DAILY_MS);
    if (typeof backfillTimer.unref === "function") {
      backfillTimer.unref();
    }
  }
}

async function runReportsBackfill12MonthsOnce(trigger = "manual-backfill-12m") {
  if (runInFlight) return runInFlight;
  runInFlight = syncReportsBackfill12Months()
    .then((result) => {
      console.log(
        `[reports-sync] trigger=${trigger} source=${result.source} rows=${result.rowsSynced} range=${result.startDate}->${result.endDate}`
      );
      return result;
    })
    .catch((error) => {
      console.error(`[reports-sync] trigger=${trigger} failed`, error.message || error);
      return null;
    })
    .finally(() => {
      runInFlight = null;
    });
  return runInFlight;
}

module.exports = {
  startReportsSyncScheduler,
  runReportsSyncOnce,
  runReportsBackfill12MonthsOnce,
};
