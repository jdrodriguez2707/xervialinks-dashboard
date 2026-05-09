const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");
const env = require("../config/env");

const DB_PATH = env.NODE_ENV === "test" ? ":memory:" : path.join(__dirname, "../../../data/app.db");

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
      percentage REAL   NOT NULL CHECK (percentage > 0 AND percentage <= 100),
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

    CREATE TABLE IF NOT EXISTS worker_payment_info (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id       INTEGER NOT NULL UNIQUE REFERENCES workers(id) ON DELETE CASCADE,
      method_type     TEXT    NOT NULL,
      payment_details TEXT    NOT NULL,
      created_at      TEXT    DEFAULT (datetime('now')),
      updated_at      TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS worker_payment_status (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id   INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      payment_month TEXT  NOT NULL,
      status      TEXT    NOT NULL CHECK (status IN ('pending', 'paid')) DEFAULT 'pending',
      updated_at  TEXT    DEFAULT (datetime('now')),
      UNIQUE (worker_id, payment_month)
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
  `);
  ensureColumn(database, "users", "deleted_at", "TEXT");
  ensureColumn(database, "users", "password_cipher", "TEXT");
  ensureColumn(database, "users", "session_invalidated_at", "TEXT");
  ensureColumn(database, "users", "last_login_at", "TEXT");
  ensureColumn(database, "workers", "deleted_at", "TEXT");
  ensureColumn(database, "reports", "source", "TEXT NOT NULL DEFAULT 'sync'");
  ensureColumn(database, "reports", "synced_at", "TEXT DEFAULT (datetime('now'))");
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date);
    CREATE INDEX IF NOT EXISTS idx_reports_domain ON reports(domain);
  `);
  ensureWorkerPaymentStatusMonthly(database);
  ensureMultiGamSchema(database);

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

function ensureWorkerPaymentStatusMonthly(database) {
  const columns = database.prepare("PRAGMA table_info(worker_payment_status)").all();
  const hasPaymentMonth = columns.some((c) => c.name === "payment_month");
  if (hasPaymentMonth) return;

  database.exec(`
    ALTER TABLE worker_payment_status RENAME TO worker_payment_status_legacy;

    CREATE TABLE worker_payment_status (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id     INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      payment_month TEXT    NOT NULL,
      status        TEXT    NOT NULL CHECK (status IN ('pending', 'paid')) DEFAULT 'pending',
      updated_at    TEXT    DEFAULT (datetime('now')),
      UNIQUE (worker_id, payment_month)
    );

    INSERT INTO worker_payment_status (worker_id, payment_month, status, updated_at)
    SELECT worker_id,
           strftime('%Y-%m', 'now', 'start of month', '-1 month'),
           status,
           updated_at
    FROM worker_payment_status_legacy;

    DROP TABLE worker_payment_status_legacy;
  `);
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
    DELETE FROM worker_payment_info;
    DELETE FROM worker_payment_status;
    DELETE FROM properties;
    DELETE FROM workers;
    DELETE FROM users;
    DELETE FROM reports;
    DELETE FROM gam_networks;
    DELETE FROM sqlite_sequence WHERE name IN ('workers', 'properties', 'users', 'worker_payment_info', 'worker_payment_status', 'reports', 'gam_networks');
  `);
  ensureMultiGamSchema(database);
  seedAdminUser(database);
}

module.exports = { getDb, closeDb, resetDb };
