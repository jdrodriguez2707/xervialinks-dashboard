require("dotenv").config();

const DEFAULT_JWT_SECRET = "change-this-secret-in-production";

const env = {
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || "development",

  // Auth
  JWT_SECRET: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
  PASSWORD_VIEW_SECRET: process.env.PASSWORD_VIEW_SECRET || "",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@example.com",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "admin123",

  /** Comma-separated list of allowed browser origins (e.g. https://app.vercel.app). Empty in dev = permissive CORS. */
  CORS_ORIGIN: process.env.CORS_ORIGIN || "",

  /** SQLite file path relative to process.cwd(); use with Railway volume (e.g. /data/app.db). */
  DATABASE_PATH: process.env.DATABASE_PATH || "",

  /** Shared secret for POST /api/internal/sync-reports (header X-Cron-Secret). */
  CRON_SECRET: process.env.CRON_SECRET || "",

  /**
   * When false, in-process sync intervals are disabled (use cron + internal endpoint).
   * Startup batch + backfill still run once unless SKIP_STARTUP_SYNC=true.
   */
  enableSyncScheduler: process.env.ENABLE_SYNC_SCHEDULER !== "false",

  /** When true, skip the one-off sync on server boot (optional for cron-only setups). */
  skipStartupSync: process.env.SKIP_STARTUP_SYNC === "true",

  // Google Ad Manager integration — always false in test env to use mock data
  USE_REAL_GAM_API: process.env.NODE_ENV !== "test" && process.env.USE_REAL_GAM_API === "true",
  GAM_NETWORK_CODE: process.env.GAM_NETWORK_CODE || "",
  /** Optional label for the default network in UI (fallback: network code). */
  GAM_NETWORK_DISPLAY_NAME: process.env.GAM_NETWORK_DISPLAY_NAME || "",
  GAM_CREDENTIALS_JSON: process.env.GAM_CREDENTIALS_JSON || "",
  GAM_KEY_FILE: process.env.GAM_KEY_FILE || "",

  /** Fallback IANA zone when the client does not send X-Client-Timezone */
  DEFAULT_REPORT_TIMEZONE: process.env.DEFAULT_REPORT_TIMEZONE || "",

  // Report sync tuning
  REPORTS_BATCH_INTERVAL_MS:
    parseInt(process.env.REPORTS_BATCH_INTERVAL_MS, 10) || 3 * 60 * 60 * 1000,
  REPORTS_BACKFILL_INTERVAL_MS:
    parseInt(process.env.REPORTS_BACKFILL_INTERVAL_MS, 10) || 24 * 60 * 60 * 1000,
  REPORTS_BATCH_WINDOW_DAYS: parseInt(process.env.REPORTS_BATCH_WINDOW_DAYS, 10) || 30,
  /** Historical backfill span (days). Default 120 (~4 months) to keep GAM createReport ranges smaller; set e.g. 370 for ~12 months. */
  REPORTS_BACKFILL_WINDOW_DAYS: parseInt(process.env.REPORTS_BACKFILL_WINDOW_DAYS, 10) || 120,
};

env.isProductionJwtWeak =
  env.nodeEnv === "production" && (!env.JWT_SECRET || env.JWT_SECRET === DEFAULT_JWT_SECRET);

module.exports = env;
