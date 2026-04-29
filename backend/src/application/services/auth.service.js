const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authRepo = require("../../domain/repositories/auth.repository");
const env = require("../../infrastructure/config/env");

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

  const user = authRepo.findByEmail(email);
  if (!user) throw new UnauthorizedError("Credenciales inválidas");

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new UnauthorizedError("Credenciales inválidas");

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

async function register({ name, email, password, role = "worker" }) {
  if (!name || !email || !password) {
    throw new ValidationError("Nombre, email y contraseña son requeridos");
  }
  if (!["admin", "worker"].includes(role)) {
    throw new ValidationError("Rol inválido");
  }

  const existing = authRepo.findByEmail(email);
  if (existing) throw new ConflictError(`El email ${email} ya está en uso`);

  const passwordHash = await bcrypt.hash(password, 10);
  return authRepo.create({ name, email, passwordHash, role });
}

module.exports = { login, register };
