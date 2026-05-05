const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");
const env = require("../config/env");

const DB_PATH =
  env.NODE_ENV === "test"
    ? ":memory:"
    : path.join(__dirname, "../../../data/app.db");

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
  ensureColumn(database, "workers", "deleted_at", "TEXT");
  ensureColumn(database, "reports", "source", "TEXT NOT NULL DEFAULT 'sync'");
  ensureColumn(database, "reports", "synced_at", "TEXT DEFAULT (datetime('now'))");
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date);
    CREATE INDEX IF NOT EXISTS idx_reports_domain ON reports(domain);
  `);
  ensureWorkerPaymentStatusMonthly(database);

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
  const existing = database
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(adminEmail);
  if (existing) return;

  const adminPassword = env.ADMIN_PASSWORD || "admin123";
  const passwordHash = bcrypt.hashSync(adminPassword, 10);

  database
    .prepare(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')"
    )
    .run("Admin", adminEmail, passwordHash);
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
    DELETE FROM sqlite_sequence WHERE name IN ('workers', 'properties', 'users', 'worker_payment_info', 'worker_payment_status', 'reports');
  `);
  seedAdminUser(database);
}

module.exports = { getDb, closeDb, resetDb };
