const app = require("./app");
const env = require("./infrastructure/config/env");
const {
  startReportsSyncScheduler,
  runReportsSyncOnce,
} = require("./application/services/reportsSyncScheduler.service");

async function bootstrap() {
  await runReportsSyncOnce("startup");
  startReportsSyncScheduler();

  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
  });
}

bootstrap();
