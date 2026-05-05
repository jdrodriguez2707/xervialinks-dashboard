const { getDb } = require("../../infrastructure/database/database");

function findByEmail(email) {
  return (
    getDb()
      .prepare("SELECT * FROM users WHERE email = ? AND deleted_at IS NULL")
      .get(email) || null
  );
}

function findByEmailIncludingDeleted(email) {
  return (
    getDb()
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email) || null
  );
}

function findById(id) {
  return (
    getDb()
      .prepare(
        "SELECT id, name, email, role, created_at, deleted_at, session_invalidated_at, last_login_at FROM users WHERE id = ?"
      )
      .get(id) || null
  );
}

function create({ name, email, passwordHash, role = "worker" }) {
  const db = getDb();
  const result = db
    .prepare(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)"
    )
    .run(name, email, passwordHash, role);
  return findById(result.lastInsertRowid);
}

function updateLastLogin(userId) {
  const db = getDb();
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(userId);
  return findById(userId);
}

function updateProfile(userId, { name, email }) {
  const db = getDb();
  db.prepare(
    "UPDATE users SET name = ?, email = ? WHERE id = ? AND deleted_at IS NULL"
  ).run(name, email, userId);
  return findById(userId);
}

function updatePassword(userId, passwordHash) {
  const db = getDb();
  db.prepare("UPDATE users SET password_hash = ?, session_invalidated_at = datetime('now') WHERE id = ?").run(
    passwordHash,
    userId
  );
  return findById(userId);
}

module.exports = {
  findByEmail,
  findByEmailIncludingDeleted,
  findById,
  create,
  updateLastLogin,
  updateProfile,
  updatePassword,
};
