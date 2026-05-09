const { getDb } = require("../../infrastructure/database/database");

function listAll() {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, network_code AS networkCode, display_name AS displayName, is_default AS isDefault,
              access_status AS accessStatus, last_error AS lastError, last_verified_at AS lastVerifiedAt,
              created_at AS createdAt, updated_at AS updatedAt
       FROM gam_networks
       ORDER BY is_default DESC, display_name ASC, network_code ASC`,
    )
    .all();
}

function findByCode(networkCode) {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, network_code AS networkCode, display_name AS displayName, is_default AS isDefault,
              access_status AS accessStatus, last_error AS lastError, last_verified_at AS lastVerifiedAt,
              created_at AS createdAt, updated_at AS updatedAt
       FROM gam_networks WHERE network_code = ?`,
    )
    .get(String(networkCode || "").trim());
}

function getDefaultNetworkCode() {
  const db = getDb();
  const row = db
    .prepare("SELECT network_code AS networkCode FROM gam_networks WHERE is_default = 1 LIMIT 1")
    .get();
  return row?.networkCode || null;
}

function listCodesWithAccessOk() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT network_code AS networkCode FROM gam_networks WHERE access_status = 'ok' ORDER BY id ASC`,
    )
    .all();
  return rows.map((r) => r.networkCode);
}

function insert({ networkCode, displayName, accessStatus = "unknown" }) {
  const db = getDb();
  const code = String(networkCode || "").trim();
  const name = String(displayName || "").trim() || code;
  const result = db
    .prepare(
      `INSERT INTO gam_networks (network_code, display_name, is_default, access_status, updated_at)
       VALUES (?, ?, 0, ?, datetime('now'))`,
    )
    .run(code, name, accessStatus);
  return findById(result.lastInsertRowid);
}

function findById(id) {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, network_code AS networkCode, display_name AS displayName, is_default AS isDefault,
              access_status AS accessStatus, last_error AS lastError, last_verified_at AS lastVerifiedAt,
              created_at AS createdAt, updated_at AS updatedAt
       FROM gam_networks WHERE id = ?`,
    )
    .get(id);
}

function updateAccessStatus(networkCode, { accessStatus, lastError = null }) {
  const db = getDb();
  db.prepare(
    `UPDATE gam_networks SET
       access_status = ?,
       last_error = ?,
       last_verified_at = datetime('now'),
       updated_at = datetime('now')
     WHERE network_code = ?`,
  ).run(accessStatus, lastError, String(networkCode || "").trim());
  return findByCode(networkCode);
}

function updateDisplayName(networkCode, displayName) {
  const db = getDb();
  const name = String(displayName || "").trim();
  if (!name) return findByCode(networkCode);
  db.prepare(
    `UPDATE gam_networks SET display_name = ?, updated_at = datetime('now') WHERE network_code = ?`,
  ).run(name, String(networkCode || "").trim());
  return findByCode(networkCode);
}

function setDefaultNetwork(networkCode) {
  const db = getDb();
  const code = String(networkCode || "").trim();
  db.transaction(() => {
    db.prepare("UPDATE gam_networks SET is_default = 0").run();
    db.prepare("UPDATE gam_networks SET is_default = 1, updated_at = datetime('now') WHERE network_code = ?").run(
      code,
    );
  })();
  return findByCode(networkCode);
}

function getDisplayNameMap() {
  const db = getDb();
  const rows = db.prepare("SELECT network_code AS c, display_name AS n FROM gam_networks").all();
  const map = {};
  for (const r of rows) {
    map[String(r.c)] = String(r.n || r.c);
  }
  return map;
}

function deleteByCode(networkCode) {
  const db = getDb();
  const code = String(networkCode || "").trim();
  const def = getDefaultNetworkCode();
  if (def === code) {
    throw new Error("Cannot delete the default network");
  }
  const r = db.prepare("DELETE FROM gam_networks WHERE network_code = ?").run(code);
  return r.changes > 0;
}

module.exports = {
  listAll,
  findByCode,
  findById,
  getDefaultNetworkCode,
  listCodesWithAccessOk,
  getDisplayNameMap,
  insert,
  updateAccessStatus,
  updateDisplayName,
  setDefaultNetwork,
  deleteByCode,
};
