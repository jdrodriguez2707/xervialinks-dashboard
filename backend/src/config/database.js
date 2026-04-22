const Database = require("better-sqlite3");
const path = require("path");
const env = require("./env");

const DB_PATH =
  env.NODE_ENV === "test"
    ? ":memory:"
    : path.join(__dirname, "../../data/app.db");

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
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

function resetDb() {
  const database = getDb();
  database.exec(
    "DELETE FROM properties; DELETE FROM workers; DELETE FROM sqlite_sequence WHERE name IN ('workers', 'properties');"
  );
}

module.exports = { getDb, closeDb, resetDb };
