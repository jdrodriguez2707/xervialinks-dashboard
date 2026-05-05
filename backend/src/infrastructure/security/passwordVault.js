const crypto = require("crypto");
const env = require("../config/env");

const ALGORITHM = "aes-256-gcm";

function getKey() {
  const secret = env.PASSWORD_VIEW_SECRET || env.JWT_SECRET || "local-password-vault-secret";
  return crypto.createHash("sha256").update(String(secret)).digest();
}

function encryptPassword(password) {
  const value = String(password || "");
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

function decryptPassword(cipherText) {
  const raw = String(cipherText || "").trim();
  if (!raw) return "";
  try {
    const [ivB64, tagB64, bodyB64] = raw.split(".");
    if (!ivB64 || !tagB64 || !bodyB64) return "";
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const encrypted = Buffer.from(bodyB64, "base64");
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return "";
  }
}

module.exports = { encryptPassword, decryptPassword };
