const { getDb } = require("../../infrastructure/database/database");

function findAll({ includeDeleted = false } = {}) {
  const db = getDb();
  const workers = includeDeleted
    ? db.prepare("SELECT * FROM workers ORDER BY name ASC").all()
    : db
        .prepare("SELECT * FROM workers WHERE deleted_at IS NULL ORDER BY name ASC")
        .all();
  return workers.map(attachProperties);
}

function findById(id, { includeDeleted = false } = {}) {
  const db = getDb();
  const worker = includeDeleted
    ? db.prepare("SELECT * FROM workers WHERE id = ?").get(id)
    : db
        .prepare("SELECT * FROM workers WHERE id = ? AND deleted_at IS NULL")
        .get(id);
  if (!worker) return null;
  return attachProperties(worker);
}

function findByEmail(email, { includeDeleted = false } = {}) {
  const db = getDb();
  const worker = includeDeleted
    ? db.prepare("SELECT * FROM workers WHERE email = ?").get(email)
    : db
        .prepare("SELECT * FROM workers WHERE email = ? AND deleted_at IS NULL")
        .get(email);
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
    db.prepare("UPDATE users SET deleted_at = datetime('now') WHERE email = ?").run(worker.email);
    db.prepare("UPDATE workers SET deleted_at = datetime('now') WHERE id = ?").run(id);
  })();

  return true;
}



function hardDeleteById(id) {
  const db = getDb();
  const worker = findById(id, { includeDeleted: true });
  if (!worker) return false;

  db.transaction(() => {
    db.prepare("DELETE FROM worker_payment_info WHERE worker_id = ?").run(id);
    db.prepare("DELETE FROM worker_payment_status WHERE worker_id = ?").run(id);
    db.prepare("DELETE FROM properties WHERE worker_id = ?").run(id);
    db.prepare("DELETE FROM workers WHERE id = ?").run(id);
    db.prepare("DELETE FROM users WHERE email = ? AND role = 'worker'").run(worker.email);
  })();

  return true;
}

function hardDeleteInactiveById(id) {
  const db = getDb();
  const worker = findById(id, { includeDeleted: true });
  if (!worker || !worker.deleted_at) return false;

  db.transaction(() => {
    db.prepare("DELETE FROM worker_payment_info WHERE worker_id = ?").run(id);
    db.prepare("DELETE FROM worker_payment_status WHERE worker_id = ?").run(id);
    db.prepare("DELETE FROM properties WHERE worker_id = ?").run(id);
    db.prepare("DELETE FROM workers WHERE id = ?").run(id);
    db.prepare("DELETE FROM users WHERE email = ? AND role = 'worker'").run(worker.email);
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

function findPropertyByTypeAndValue(type, value) {
  const db = getDb();
  return db
    .prepare(
      `SELECT p.id, p.worker_id, p.type, p.value
       FROM properties p
       INNER JOIN workers w ON w.id = p.worker_id
       WHERE p.type = ? AND p.value = ? AND w.deleted_at IS NULL
       LIMIT 1`
    )
    .get(type, value);
}

function getProperties(workerId) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM properties WHERE worker_id = ? ORDER BY created_at ASC, id ASC")
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

function getPaymentStatus(workerId) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT status AS paymentStatus, updated_at AS paymentStatusUpdatedAt
       FROM worker_payment_status
       WHERE worker_id = ?`
    )
    .get(workerId);
  return row || { paymentStatus: "pending", paymentStatusUpdatedAt: null };
}

function upsertPaymentStatus(workerId, status) {
  const db = getDb();
  db.prepare(
    `INSERT INTO worker_payment_status (worker_id, status, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(worker_id) DO UPDATE SET
       status = excluded.status,
       updated_at = datetime('now')`
  ).run(workerId, status);
  return getPaymentStatus(workerId);
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
  const paymentStatus = getPaymentStatus(worker.id);
  return {
    ...worker,
    properties: getProperties(worker.id),
    paymentInfo: getPaymentInfo(worker.id),
    ...paymentStatus,
  };
}

module.exports = {
  findAll,
  findById,
  findByEmail,
  create,
  createWithUser,
  deleteById,
  hardDeleteById,
  hardDeleteInactiveById,
  addProperty,
  findPropertyByTypeAndValue,
  getPaymentStatus,
  upsertPaymentStatus,
  upsertPaymentInfo,
};
