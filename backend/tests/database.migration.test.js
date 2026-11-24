const Database = require("better-sqlite3");
const { dropRevenueSharingSchema } = require("../src/infrastructure/database/database");

describe("dropRevenueSharingSchema", () => {
  function legacyDb() {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    db.exec(`
      CREATE TABLE workers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        percentage REAL NOT NULL CHECK (percentage > 0 AND percentage <= 100),
        created_at TEXT DEFAULT (datetime('now')),
        deleted_at TEXT
      );
      CREATE TABLE properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        gam_network_code TEXT NOT NULL
      );
      CREATE TABLE worker_payment_info (id INTEGER PRIMARY KEY, worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE);
      CREATE TABLE worker_payment_status (id INTEGER PRIMARY KEY, worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE);
      CREATE TABLE worker_net_revenue_overrides (id INTEGER PRIMARY KEY, worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE);
      CREATE TABLE worker_domain_net_revenue_overrides (id INTEGER PRIMARY KEY, worker_id INTEGER REFERENCES workers(id) ON DELETE CASCADE);
      INSERT INTO workers (id, name, email, percentage) VALUES (7, 'Cris', 'cris@mail.com', 70);
      INSERT INTO properties (worker_id, type, value, gam_network_code) VALUES (7, 'domain', 'a.example.com', '11');
    `);
    return db;
  }

  it("drops payment tables and the percentage column while keeping workers and properties", () => {
    const db = legacyDb();
    dropRevenueSharingSchema(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((t) => t.name);
    for (const removed of [
      "worker_payment_info",
      "worker_payment_status",
      "worker_net_revenue_overrides",
      "worker_domain_net_revenue_overrides",
    ]) {
      expect(tables).not.toContain(removed);
    }

    const cols = db.prepare("PRAGMA table_info(workers)").all().map((c) => c.name);
    expect(cols).not.toContain("percentage");
    expect(db.prepare("SELECT id, name, email FROM workers").all()).toEqual([
      { id: 7, name: "Cris", email: "cris@mail.com" },
    ]);
    expect(db.prepare("SELECT worker_id, value FROM properties").all()).toEqual([
      { worker_id: 7, value: "a.example.com" },
    ]);
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    db.close();
  });

  it("is idempotent", () => {
    const db = legacyDb();
    dropRevenueSharingSchema(db);
    expect(() => dropRevenueSharingSchema(db)).not.toThrow();
    db.close();
  });
});
