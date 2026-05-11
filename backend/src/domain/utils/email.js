/**
 * Normalizes email for lookup and storage (trim + lowercase).
 * @param {unknown} email
 * @returns {string}
 */
function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

module.exports = { normalizeEmail };
