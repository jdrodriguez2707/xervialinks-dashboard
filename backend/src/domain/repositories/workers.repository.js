const { getDb } = require("../../infrastructure/database/database");

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
  const worker = db.prepare("SELECT * FROM workers WHERE email = ?").get(email);
  return worker ? attachProperties(worker) : null;
}

function create({ name, email, percentage }) {
  const db = getDb();
  const result = db
    .prepare("INSERT INTO workers (name, email, percentage) VALUES (?, ?, ?)")
    .run(name, email, percentage);
  return findById(result.lastInsertRowid);
}

/**
 * Creates a worker AND a user account in a single atomic transaction.
 * The password hash must be computed before calling this function.
 *
 * @param {{ name: string, email: string, percentage: number }} workerData
 * @param {{ passwordHash: string }} userCredentials
 */
function createWithUser({ name, email, percentage }, { passwordHash }) {
  const db = getDb();
  return db.transaction(() => {
    db.prepare(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'worker')"
    ).run(name, email, passwordHash);

    const result = db
      .prepare("INSERT INTO workers (name, email, percentage) VALUES (?, ?, ?)")
      .run(name, email, percentage);

    return findById(result.lastInsertRowid);
  })();
}

/**
 * Deletes a worker along with their properties and user account in a single
 * atomic transaction. Returns true if the worker existed, false otherwise.
 */
function deleteById(id) {
  const db = getDb();
  const worker = findById(id);
  if (!worker) return false;

  db.transaction(() => {
    db.prepare("DELETE FROM properties WHERE worker_id = ?").run(id);
    db.prepare("DELETE FROM users WHERE email = ?").run(worker.email);
    db.prepare("DELETE FROM workers WHERE id = ?").run(id);
  })();

  return true;
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

function getPaymentInfo(workerId) {
  const db = getDb();
  return (
    db
      .prepare(
        `SELECT method_type AS methodType, payment_details AS paymentDetails, updated_at AS updatedAt
         FROM worker_payment_info
         WHERE worker_id = ?`
      )
      .get(workerId) || null
  );
}

function upsertPaymentInfo(workerId, { methodType, paymentDetails }) {
  const db = getDb();
  db.prepare(
    `INSERT INTO worker_payment_info (worker_id, method_type, payment_details, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(worker_id) DO UPDATE SET
       method_type = excluded.method_type,
       payment_details = excluded.payment_details,
       updated_at = datetime('now')`
  ).run(workerId, methodType, paymentDetails);
  return getPaymentInfo(workerId);
}

function attachProperties(worker) {
  return {
    ...worker,
    properties: getProperties(worker.id),
    paymentInfo: getPaymentInfo(worker.id),
  };
}

module.exports = {
  findAll,
  findById,
  findByEmail,
  create,
  createWithUser,
  deleteById,
  addProperty,
  upsertPaymentInfo,
};
