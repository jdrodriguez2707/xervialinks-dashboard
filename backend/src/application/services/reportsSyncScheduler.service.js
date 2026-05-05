const { syncReportsBatch } = require("./reportsSync.service");

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
let schedulerTimer = null;
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
}

module.exports = {
  startReportsSyncScheduler,
  runReportsSyncOnce,
};
