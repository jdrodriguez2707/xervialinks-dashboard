const app = require("./app");
const env = require("./infrastructure/config/env");
const {
  startReportsSyncScheduler,
  runReportsSyncOnce,
  runReportsBackfill12MonthsOnce,
} = require("./application/services/reportsSyncScheduler.service");

async function bootstrap() {
  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
    // Non-blocking startup syncs: API starts serving immediately, while
    // report ingestion warms in background.
    runReportsBackfill12MonthsOnce("startup-backfill-12m");
    runReportsSyncOnce("startup");
    startReportsSyncScheduler();
  });
}

bootstrap();
