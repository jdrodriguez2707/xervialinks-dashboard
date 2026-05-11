const { getDb } = require("../../infrastructure/database/database");

function findAll({ includeDeleted = false, paymentMonth = null } = {}) {
  const db = getDb();
  const workers = includeDeleted
    ? db.prepare("SELECT * FROM workers ORDER BY name ASC").all()
    : db.prepare("SELECT * FROM workers WHERE deleted_at IS NULL ORDER BY name ASC").all();
  return workers.map((worker) => attachProperties(worker, { paymentMonth }));
}

function findById(id, { includeDeleted = false, paymentMonth = null } = {}) {
  const db = getDb();
  const worker = includeDeleted
    ? db.prepare("SELECT * FROM workers WHERE id = ?").get(id)
    : db.prepare("SELECT * FROM workers WHERE id = ? AND deleted_at IS NULL").get(id);
  if (!worker) return null;
  return attachProperties(worker, { paymentMonth });
}

function findByEmail(email, { includeDeleted = false, paymentMonth = null } = {}) {
  const db = getDb();
  const worker = includeDeleted
    ? db.prepare("SELECT * FROM workers WHERE email = ?").get(email)
    : db.prepare("SELECT * FROM workers WHERE email = ? AND deleted_at IS NULL").get(email);
  return worker ? attachProperties(worker, { paymentMonth }) : null;
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
function createWithUser({ name, email, percentage }, { passwordHash, passwordCipher = null }) {
  const db = getDb();
  return db.transaction(() => {
    db.prepare(
      "INSERT INTO users (name, email, password_hash, password_cipher, role) VALUES (?, ?, ?, ?, 'worker')",
    ).run(name, email, passwordHash, passwordCipher);

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

function addProperty(workerId, { type, value, gamNetworkCode }) {
  const db = getDb();
  const net = String(gamNetworkCode || "").trim();
  if (!net) {
    throw new Error("gamNetworkCode is required for properties");
  }
  const result = db
    .prepare(
      "INSERT INTO properties (worker_id, type, value, gam_network_code) VALUES (?, ?, ?, ?)",
    )
    .run(workerId, type, value, net);
  return db.prepare("SELECT * FROM properties WHERE id = ?").get(result.lastInsertRowid);
}

function findPropertyByTypeAndValue(type, value, gamNetworkCode = null) {
  const db = getDb();
  if (type === "domain" && gamNetworkCode != null && String(gamNetworkCode).trim() !== "") {
    return db
      .prepare(
        `SELECT p.id, p.worker_id, p.type, p.value, p.gam_network_code AS gam_network_code
         FROM properties p
         INNER JOIN workers w ON w.id = p.worker_id
         WHERE p.type = ? AND p.value = ? AND p.gam_network_code = ? AND w.deleted_at IS NULL
         LIMIT 1`,
      )
      .get(type, value, String(gamNetworkCode).trim());
  }
  return db
    .prepare(
      `SELECT p.id, p.worker_id, p.type, p.value, p.gam_network_code AS gam_network_code
       FROM properties p
       INNER JOIN workers w ON w.id = p.worker_id
       WHERE p.type = ? AND p.value = ? AND w.deleted_at IS NULL
       LIMIT 1`,
    )
    .get(type, value);
}

function getProperties(workerId) {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, worker_id, type, value, gam_network_code AS gam_network_code, created_at
       FROM properties WHERE worker_id = ? ORDER BY created_at ASC, id ASC`,
    )
    .all(workerId);
}

function getPaymentInfo(workerId) {
  const db = getDb();
  return (
    db
      .prepare(
        `SELECT method_type AS methodType, payment_details AS paymentDetails, updated_at AS updatedAt
         FROM worker_payment_info
         WHERE worker_id = ?`,
      )
      .get(workerId) || null
  );
}

function getPaymentStatus(workerId, paymentMonth) {
  const full = getPaymentStatusRow(workerId, paymentMonth);
  return {
    paymentStatus: full.paymentStatus,
    paymentStatusUpdatedAt: full.paymentStatusUpdatedAt,
    paymentMonth: full.paymentMonth,
    paidTotalAmount: full.paidTotalAmount,
  };
}

/** Full row including frozen payout JSON when status is paid. */
function getPaymentStatusRow(workerId, paymentMonth) {
  const db = getDb();
  const month = String(paymentMonth || "").trim();
  if (!month) {
    return {
      paymentStatus: "pending",
      paymentStatusUpdatedAt: null,
      paymentMonth: null,
      paidTotalAmount: null,
      paidRowsJson: null,
    };
  }
  const row = db
    .prepare(
      `SELECT status AS paymentStatus,
              updated_at AS paymentStatusUpdatedAt,
              payment_month AS paymentMonth,
              paid_total_amount AS paidTotalAmount,
              paid_rows_json AS paidRowsJson
       FROM worker_payment_status
       WHERE worker_id = ? AND payment_month = ?`,
    )
    .get(workerId, month);
  return (
    row || {
      paymentStatus: "pending",
      paymentStatusUpdatedAt: null,
      paymentMonth: month,
      paidTotalAmount: null,
      paidRowsJson: null,
    }
  );
}

/**
 * @param {{ paidTotalAmount?: number|null, paidRowsJson?: string|null }} [snapshot] Al marcar paid, montos congelados. Al marcar pending, se conservan columnas paid_* si ya existían (no se borran).
 */
function upsertPaymentStatus(workerId, status, paymentMonth, snapshot = null) {
  const db = getDb();
  const month = String(paymentMonth || "").trim();
  const paidTotal =
    status === "paid" && snapshot && snapshot.paidTotalAmount != null
      ? Number(snapshot.paidTotalAmount)
      : null;
  const paidRows =
    status === "paid" && snapshot && snapshot.paidRowsJson != null ? String(snapshot.paidRowsJson) : null;

  db.prepare(
    `INSERT INTO worker_payment_status (worker_id, payment_month, status, updated_at, paid_total_amount, paid_rows_json)
     VALUES (?, ?, ?, datetime('now'), ?, ?)
     ON CONFLICT(worker_id, payment_month) DO UPDATE SET
       status = excluded.status,
       updated_at = datetime('now'),
       paid_total_amount = CASE
         WHEN excluded.status = 'paid' AND excluded.paid_total_amount IS NOT NULL THEN excluded.paid_total_amount
         ELSE worker_payment_status.paid_total_amount
       END,
       paid_rows_json = CASE
         WHEN excluded.status = 'paid' AND excluded.paid_rows_json IS NOT NULL THEN excluded.paid_rows_json
         ELSE worker_payment_status.paid_rows_json
       END`,
  ).run(workerId, month, status, paidTotal, paidRows);
  return getPaymentStatus(workerId, month);
}

function upsertPaymentInfo(workerId, { methodType, paymentDetails }) {
  const db = getDb();
  db.prepare(
    `INSERT INTO worker_payment_info (worker_id, method_type, payment_details, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(worker_id) DO UPDATE SET
       method_type = excluded.method_type,
       payment_details = excluded.payment_details,
       updated_at = datetime('now')`,
  ).run(workerId, methodType, paymentDetails);
  return getPaymentInfo(workerId);
}

function listPaidPaymentStatuses() {
  const db = getDb();
  return db
    .prepare(
      `SELECT
         ps.worker_id AS workerId,
         ps.payment_month AS paymentMonth,
         ps.updated_at AS paidAt,
         ps.paid_total_amount AS paidTotalAmount,
         ps.paid_rows_json AS paidRowsJson,
         w.name AS workerName,
         p.method_type AS methodType
       FROM worker_payment_status ps
       INNER JOIN workers w ON w.id = ps.worker_id
       LEFT JOIN worker_payment_info p ON p.worker_id = ps.worker_id
       WHERE ps.status = 'paid'
       ORDER BY ps.updated_at DESC, ps.id DESC`,
    )
    .all();
}

function attachProperties(worker, { paymentMonth = null } = {}) {
  const paymentStatus = getPaymentStatus(worker.id, paymentMonth);
  const rawProps = getProperties(worker.id);
  const properties = rawProps.map((p) => ({
    ...p,
    gamNetworkCode: p.gam_network_code,
  }));
  return {
    ...worker,
    properties,
    paymentInfo: getPaymentInfo(worker.id),
    paymentStatus: paymentStatus.paymentStatus,
    paymentStatusUpdatedAt: paymentStatus.paymentStatusUpdatedAt,
    paymentMonth: paymentStatus.paymentMonth,
    paidTotalAmount: paymentStatus.paidTotalAmount,
  };
}

/**
 * Updates worker row, linked worker user (by old email), and replaces domain properties
 * to match `domainAssignments` (value + gamNetworkCode per slot). Optional password: pass null to keep current hash.
 * `sessionInvalidation`: 0 = no cambio de sesión, 1 = invalidar tras cambio de perfil, 2 = invalidar por correo/contraseña.
 * Runs in a single transaction.
 */

function updateWorkerComplete(
  workerId,
  oldEmail,
  {
    name,
    email,
    percentage,
    passwordHash,
    passwordCipher,
    sessionInvalidation = 0,
  },
  domainAssignments,
) {
  const db = getDb();
  const inv = Number(sessionInvalidation) || 0;
  return db.transaction(() => {
    const wr = db
      .prepare(
        `UPDATE workers SET name = ?, email = ?, percentage = ?
         WHERE id = ? AND deleted_at IS NULL`,
      )
      .run(name, email, percentage, workerId);
    if (wr.changes === 0) {
      throw new Error("Worker not found or inactive");
    }

    const ur = db
      .prepare(
        `UPDATE users SET name = ?, email = ?, password_hash = COALESCE(?, password_hash), password_cipher = COALESCE(?, password_cipher),
           session_invalidated_at = CASE WHEN ? >= 1 THEN datetime('now') ELSE session_invalidated_at END,
           session_credentials_invalidated_at = CASE WHEN ? = 2 THEN datetime('now') ELSE session_credentials_invalidated_at END
         WHERE email = ? AND role = 'worker' AND deleted_at IS NULL`,
      )
      .run(name, email, passwordHash, passwordCipher, inv, inv, oldEmail);
    if (ur.changes === 0) {
      throw new Error("Linked user not found for worker");
    }

    const props = db
      .prepare(
        "SELECT id, value, gam_network_code AS gamNetworkCode FROM properties WHERE worker_id = ? AND type = 'domain'",
      )
      .all(workerId);
    const keyOf = (v, net) => `${String(v).trim()}|||${String(net).trim()}`;
    const desiredKeys = new Set(
      (domainAssignments || []).map((a) => keyOf(a.value, a.gamNetworkCode)),
    );
    for (const p of props) {
      if (!desiredKeys.has(keyOf(p.value, p.gamNetworkCode))) {
        db.prepare("DELETE FROM properties WHERE id = ?").run(p.id);
      }
    }
    const existingKeys = new Set(props.map((p) => keyOf(p.value, p.gamNetworkCode)));
    for (const a of domainAssignments || []) {
      const k = keyOf(a.value, a.gamNetworkCode);
      if (!existingKeys.has(k)) {
        db.prepare(
          "INSERT INTO properties (worker_id, type, value, gam_network_code) VALUES (?, 'domain', ?, ?)",
        ).run(workerId, String(a.value).trim(), String(a.gamNetworkCode).trim());
      }
    }

    return findById(workerId);
  })();
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
  getPaymentStatusRow,
  upsertPaymentStatus,
  upsertPaymentInfo,
  listPaidPaymentStatuses,
  getProperties,
  updateWorkerComplete,
};
