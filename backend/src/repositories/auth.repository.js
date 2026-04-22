const { getDb } = require("../config/database");

function findByEmail(email) {
  return getDb().prepare("SELECT * FROM users WHERE email = ?").get(email) || null;
}

function findById(id) {
  return (
    getDb()
      .prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?")
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

module.exports = { findByEmail, findById, create };
