const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");
const env = require("../config/env");

function resolveDbPath() {
  if (process.env.NODE_ENV === "test") return ":memory:";
  const configured = String(env.DATABASE_PATH || "").trim();
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
  }
  return path.join(__dirname, "../../../data/app.db");
}

const DB_PATH = resolveDbPath();

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    applySchema(db);
  }
  return db;
}

function applySchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      password_cipher TEXT,
      role          TEXT    NOT NULL CHECK (role IN ('admin', 'worker')) DEFAULT 'worker',
      created_at    TEXT    DEFAULT (datetime('now')),
      deleted_at    TEXT
    );

    CREATE TABLE IF NOT EXISTS workers (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT    NOT NULL,
      email     TEXT    NOT NULL UNIQUE,
      created_at TEXT   DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS properties (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      type      TEXT    NOT NULL CHECK (type IN ('domain', 'ad_unit')),
      value     TEXT    NOT NULL,
      created_at TEXT   DEFAULT (datetime('now')),
      UNIQUE (worker_id, type, value)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      date        TEXT    NOT NULL,
      domain      TEXT    NOT NULL,
      impressions INTEGER NOT NULL DEFAULT 0,
      revenue     REAL    NOT NULL DEFAULT 0,
      ecpm        REAL    NOT NULL DEFAULT 0,
      source      TEXT    NOT NULL DEFAULT 'sync',
      synced_at   TEXT    DEFAULT (datetime('now')),
      UNIQUE (date, domain)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO app_settings (key, value)
    VALUES ('worker_daily_stats_enabled', 'false');
  `);
  ensureColumn(database, "users", "deleted_at", "TEXT");
  ensureColumn(database, "users", "password_cipher", "TEXT");
  ensureColumn(database, "users", "session_invalidated_at", "TEXT");
  ensureColumn(database, "users", "session_credentials_invalidated_at", "TEXT");
  ensureColumn(database, "users", "last_login_at", "TEXT");
  ensureColumn(database, "workers", "deleted_at", "TEXT");
  ensureColumn(database, "reports", "source", "TEXT NOT NULL DEFAULT 'sync'");
  ensureColumn(database, "reports", "synced_at", "TEXT DEFAULT (datetime('now'))");
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date);
    CREATE INDEX IF NOT EXISTS idx_reports_domain ON reports(domain);
  `);
  ensureMultiGamSchema(database);
  dropRevenueSharingSchema(database);

  seedAdminUser(database);
}

function ensureColumn(database, table, column, ddlType) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((c) => c.name === column);
  if (!exists) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddlType}`);
  }
}

function seedAdminUser(database) {
  const adminEmail = env.ADMIN_EMAIL || "admin@example.com";
  const existing = database.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
  if (existing) return;

  const adminPassword = env.ADMIN_PASSWORD || "admin123";
  const passwordHash = bcrypt.hashSync(adminPassword, 10);

  database
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')")
    .run("Admin", adminEmail, passwordHash);
}

/**
 * Multi Ad Manager networks: gam_networks table, network_code on reports/properties,
 * and unique (network_code, date, domain) on reports.
 */
function ensureMultiGamSchema(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS gam_networks (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      network_code    TEXT    NOT NULL UNIQUE,
      display_name    TEXT    NOT NULL,
      is_default      INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
      access_status   TEXT    NOT NULL DEFAULT 'unknown'
        CHECK (access_status IN ('unknown', 'ok', 'error')),
      last_error      TEXT,
      last_verified_at TEXT,
      created_at      TEXT    DEFAULT (datetime('now')),
      updated_at      TEXT    DEFAULT (datetime('now'))
    );
  `);

  const defaultCode = String(env.GAM_NETWORK_CODE || "").trim() || "default";
  const defaultDisplay =
    String(env.GAM_NETWORK_DISPLAY_NAME || "").trim() || defaultCode || "Red principal";

  const reportCols = database.prepare("PRAGMA table_info(reports)").all();
  const hasNetworkOnReports = reportCols.some((c) => c.name === "network_code");

  if (!hasNetworkOnReports) {
    database.transaction(() => {
      database.exec(`
        CREATE TABLE reports_new (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          network_code TEXT   NOT NULL,
          date        TEXT    NOT NULL,
          domain      TEXT    NOT NULL,
          impressions INTEGER NOT NULL DEFAULT 0,
          revenue     REAL    NOT NULL DEFAULT 0,
          ecpm        REAL    NOT NULL DEFAULT 0,
          source      TEXT    NOT NULL DEFAULT 'sync',
          synced_at   TEXT    DEFAULT (datetime('now')),
          UNIQUE (network_code, date, domain)
        );
      `);
      database
        .prepare(
          `INSERT INTO reports_new (id, network_code, date, domain, impressions, revenue, ecpm, source, synced_at)
           SELECT id, ?, date, domain, impressions, revenue, ecpm, source, synced_at FROM reports`,
        )
        .run(defaultCode);
      database.prepare("DROP TABLE reports").run();
      database.exec("ALTER TABLE reports_new RENAME TO reports;");
    })();
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date);
      CREATE INDEX IF NOT EXISTS idx_reports_domain ON reports(domain);
      CREATE INDEX IF NOT EXISTS idx_reports_network_code ON reports(network_code);
      CREATE INDEX IF NOT EXISTS idx_reports_net_date ON reports(network_code, date);
    `);
  }

  const propCols = database.prepare("PRAGMA table_info(properties)").all();
  const hasNetworkOnProps = propCols.some((c) => c.name === "gam_network_code");
  if (!hasNetworkOnProps) {
    database.transaction(() => {
      database.exec(`
        CREATE TABLE properties_new (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          worker_id        INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
          type             TEXT    NOT NULL CHECK (type IN ('domain', 'ad_unit')),
          value            TEXT    NOT NULL,
          gam_network_code TEXT    NOT NULL,
          created_at       TEXT    DEFAULT (datetime('now')),
          UNIQUE (worker_id, type, value, gam_network_code)
        );
      `);
      database
        .prepare(
          `INSERT INTO properties_new (id, worker_id, type, value, gam_network_code, created_at)
           SELECT id, worker_id, type, value, ?, created_at FROM properties`,
        )
        .run(defaultCode);
      database.prepare("DROP TABLE properties").run();
      database.exec("ALTER TABLE properties_new RENAME TO properties;");
    })();
  }

  const netCount = database.prepare("SELECT COUNT(*) AS c FROM gam_networks").get().c;
  if (netCount === 0) {
    database
      .prepare(
        `INSERT INTO gam_networks (network_code, display_name, is_default, access_status)
         VALUES (?, ?, 1, 'ok')`,
      )
      .run(defaultCode, defaultDisplay);
  } else {
    const hasDefault = database.prepare("SELECT 1 AS x FROM gam_networks WHERE is_default = 1 LIMIT 1").get();
    if (!hasDefault) {
      const first = database
        .prepare("SELECT network_code FROM gam_networks ORDER BY id ASC LIMIT 1")
        .get();
      if (first?.network_code) {
        database
          .prepare("UPDATE gam_networks SET is_default = 1 WHERE network_code = ?")
          .run(first.network_code);
      }
    }
  }
}

/**
 * The app only shares metrics; payouts, payment status/info, revenue overrides and
 * per-worker percentages were removed. Idempotent: drops legacy tables and rebuilds
 * `workers` without the `percentage` column when it still exists.
 */
function dropRevenueSharingSchema(database) {
  database.exec(`
    DROP TABLE IF EXISTS worker_payment_info;
    DROP TABLE IF EXISTS worker_payment_status;
    DROP TABLE IF EXISTS worker_payment_status_legacy;
    DROP TABLE IF EXISTS worker_net_revenue_overrides;
    DROP TABLE IF EXISTS worker_domain_net_revenue_overrides;
  `);

  const workerCols = database.prepare("PRAGMA table_info(workers)").all();
  if (!workerCols.some((c) => c.name === "percentage")) return;

  // FKs must be off while swapping tables, otherwise dropping `workers` cascades to `properties`.
  // The pragma is a no-op inside a transaction, so toggle it outside.
  const fkWasOn = database.pragma("foreign_keys", { simple: true }) === 1;
  if (fkWasOn) database.pragma("foreign_keys = OFF");
  try {
    database.transaction(() => {
      database.exec(`
        CREATE TABLE workers_new (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          name       TEXT    NOT NULL,
          email      TEXT    NOT NULL UNIQUE,
          created_at TEXT    DEFAULT (datetime('now')),
          deleted_at TEXT
        );
        INSERT INTO workers_new (id, name, email, created_at, deleted_at)
          SELECT id, name, email, created_at, deleted_at FROM workers;
        DROP TABLE workers;
        ALTER TABLE workers_new RENAME TO workers;
      `);
      const violations = database.pragma("foreign_key_check");
      if (violations.length > 0) {
        throw new Error("Foreign key check failed while removing workers.percentage");
      }
    })();
  } finally {
    if (fkWasOn) database.pragma("foreign_keys = ON");
  }
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

function resetDb() {
  const database = getDb();
  database.exec(`
    DELETE FROM properties;
    DELETE FROM workers;
    DELETE FROM users;
    DELETE FROM reports;
    DELETE FROM gam_networks;
    DELETE FROM app_settings;
    DELETE FROM sqlite_sequence WHERE name IN ('workers', 'properties', 'users', 'reports', 'gam_networks');
  `);
  ensureMultiGamSchema(database);
  database
    .prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)")
    .run("worker_daily_stats_enabled", "false");
  seedAdminUser(database);
}

module.exports = { getDb, closeDb, resetDb, dropRevenueSharingSchema };
