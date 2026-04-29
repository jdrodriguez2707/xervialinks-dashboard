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
      role          TEXT    NOT NULL CHECK (role IN ('admin', 'worker')) DEFAULT 'worker',
      created_at    TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workers (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT    NOT NULL,
      email     TEXT    NOT NULL UNIQUE,
      percentage REAL   NOT NULL CHECK (percentage > 0 AND percentage <= 100),
      created_at TEXT   DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS properties (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
      type      TEXT    NOT NULL CHECK (type IN ('domain', 'ad_unit')),
      value     TEXT    NOT NULL,
      created_at TEXT   DEFAULT (datetime('now')),
      UNIQUE (worker_id, type, value)
    );
  `);

  seedAdminUser(database);
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
    DELETE FROM sqlite_sequence WHERE name IN ('workers', 'properties', 'users');
  `);
  seedAdminUser(database);
}

module.exports = { getDb, closeDb, resetDb };
