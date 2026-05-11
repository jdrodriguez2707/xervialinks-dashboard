const app = require("./app");
const env = require("./infrastructure/config/env");
const {
  startReportsSyncScheduler,
  runReportsSyncOnce,
  runReportsBackfill12MonthsOnce,
} = require("./application/services/reportsSyncScheduler.service");

function assertProductionSecrets() {
  if (env.isProductionJwtWeak) {
    console.error(
      "[fatal] NODE_ENV=production requires a strong JWT_SECRET (not the default placeholder).",
    );
    process.exit(1);
  }
}

async function bootstrap() {
  assertProductionSecrets();

  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);

    if (!env.skipStartupSync) {
      runReportsBackfill12MonthsOnce("startup-backfill-12m");
      runReportsSyncOnce("startup");
    } else {
      console.log("[reports-sync] Startup sync skipped (SKIP_STARTUP_SYNC=true).");
    }

    if (env.enableSyncScheduler) {
      startReportsSyncScheduler();
    } else {
      console.log(
        "[reports-sync] In-process scheduler disabled (ENABLE_SYNC_SCHEDULER=false). Use Railway Cron + POST /api/internal/sync-reports with X-Cron-Secret.",
      );
    }
  });
}

bootstrap();
