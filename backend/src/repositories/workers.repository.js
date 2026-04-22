const { getDb } = require("../config/database");

function findAll() {
  const db = getDb();
  const workers = db.prepare("SELECT * FROM workers ORDER BY name ASC").all();
  return workers.map(attachProperties);
}

function findById(id) {
  const db = getDb();
  const worker = db.prepare("SELECT * FROM workers WHERE id = ?").get(id);
  if (!worker) return null;
  return attachProperties(worker);
}

function findByEmail(email) {
  const db = getDb();
  return db.prepare("SELECT * FROM workers WHERE email = ?").get(email) || null;
}

function create({ name, email, percentage }) {
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO workers (name, email, percentage) VALUES (?, ?, ?)"
    )
    .run(name, email, percentage);
  return findById(result.lastInsertRowid);
}

function addProperty(workerId, { type, value }) {
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO properties (worker_id, type, value) VALUES (?, ?, ?)"
    )
    .run(workerId, type, value);
  return db
    .prepare("SELECT * FROM properties WHERE id = ?")
    .get(result.lastInsertRowid);
}

function getProperties(workerId) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM properties WHERE worker_id = ? ORDER BY type, value")
    .all(workerId);
}

function attachProperties(worker) {
  return { ...worker, properties: getProperties(worker.id) };
}

module.exports = { findAll, findById, findByEmail, create, addProperty };
