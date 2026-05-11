const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authRepo = require("../../domain/repositories/auth.repository");
const env = require("../../infrastructure/config/env");
const { normalizeEmail } = require("../../domain/utils/email");

const MAX_EMAIL_LEN = 254;
const MAX_PASSWORD_LEN = 128;

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
  }
}

class UnauthorizedError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnauthorizedError";
    this.statusCode = 401;
  }
}

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConflictError";
    this.statusCode = 409;
  }
}

async function login(email, password) {
  if (!email || !password) {
    throw new ValidationError("Email y contraseña son requeridos");
  }
  if (typeof email !== "string" || typeof password !== "string") {
    throw new ValidationError("Email y contraseña son requeridos");
  }
  const normalized = normalizeEmail(email);
  if (normalized.length > MAX_EMAIL_LEN || String(password).length > MAX_PASSWORD_LEN) {
    throw new ValidationError("Credenciales inválidas");
  }

  const user = authRepo.findByEmail(normalized);
  if (!user) throw new UnauthorizedError("Credenciales inválidas");

  const valid = await bcrypt.compare(String(password), user.password_hash);
  if (!valid) throw new UnauthorizedError("Credenciales inválidas");
  const updatedUser = authRepo.updateLastLogin(user.id) || user;

  const token = jwt.sign({ userId: user.id, email: user.email, role: user.role }, env.JWT_SECRET, {
    expiresIn: "8h",
  });

  return {
    token,
    user: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      lastLoginAt: updatedUser.last_login_at || null,
    },
  };
}

async function register({ name, email, password, role = "worker" }) {
  if (!name || !email || !password) {
    throw new ValidationError("Nombre, email y contraseña son requeridos");
  }
  if (!["admin", "worker"].includes(role)) {
    throw new ValidationError("Rol inválido");
  }

  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail.length > MAX_EMAIL_LEN || String(password).length > MAX_PASSWORD_LEN) {
    throw new ValidationError("Datos inválidos");
  }

  const existing = authRepo.findByEmail(normalizedEmail);
  if (existing) throw new ConflictError(`El email ${normalizedEmail} ya está en uso`);

  const passwordHash = await bcrypt.hash(String(password), 10);
  return authRepo.create({ name, email: normalizedEmail, passwordHash, role });
}

function getAdminProfile(userId) {
  const user = authRepo.findById(Number(userId));
  if (!user || user.deleted_at) {
    throw new UnauthorizedError("Cuenta no disponible");
  }
  if (user.role !== "admin") {
    throw new UnauthorizedError("Solo el administrador puede acceder a este perfil");
  }
  return {
    name: user.name,
    email: user.email,
    lastLoginAt: user.last_login_at || null,
  };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function updateAdminProfile(userId, { name, email }) {
  const user = authRepo.findById(Number(userId));
  if (!user || user.deleted_at || user.role !== "admin") {
    throw new UnauthorizedError("Cuenta no disponible");
  }
  const nextName = String(name || "").trim();
  const nextEmail = normalizeEmail(email);
  if (!nextName || !nextEmail) {
    throw new ValidationError("Nombre y correo son requeridos");
  }
  if (nextEmail.length > MAX_EMAIL_LEN) {
    throw new ValidationError("El correo no tiene un formato válido");
  }
  if (!isValidEmail(nextEmail)) {
    throw new ValidationError("El correo no tiene un formato válido");
  }
  if (nextEmail !== user.email) {
    const existing = authRepo.findByEmailIncludingDeleted(nextEmail);
    if (existing && Number(existing.id) !== Number(user.id)) {
      throw new ConflictError(`El email ${nextEmail} ya está en uso`);
    }
  }
  const updated = authRepo.updateProfile(user.id, { name: nextName, email: nextEmail });
  return {
    name: updated.name,
    email: updated.email,
    lastLoginAt: updated.last_login_at || null,
  };
}

async function changeAdminPassword(userId, { currentPassword, newPassword, confirmPassword }) {
  const user = authRepo.findById(Number(userId));
  if (!user || user.deleted_at || user.role !== "admin") {
    throw new UnauthorizedError("Cuenta no disponible");
  }
  const dbUser = authRepo.findByEmail(user.email);
  if (!dbUser) throw new UnauthorizedError("Cuenta no disponible");
  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new ValidationError("Completa contraseña actual, nueva y confirmación");
  }
  if (String(newPassword).length < 6) {
    throw new ValidationError("La nueva contraseña debe tener al menos 6 caracteres");
  }
  if (newPassword !== confirmPassword) {
    throw new ValidationError("La confirmación no coincide con la nueva contraseña");
  }
  const validCurrent = await bcrypt.compare(String(currentPassword), dbUser.password_hash);
  if (!validCurrent) {
    throw new UnauthorizedError("La contraseña actual es incorrecta");
  }
  if (currentPassword === newPassword) {
    throw new ValidationError("La nueva contraseña debe ser diferente a la actual");
  }
  const nextHash = await bcrypt.hash(String(newPassword), 10);
  authRepo.updatePassword(user.id, nextHash);
}

module.exports = {
  login,
  register,
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
};
