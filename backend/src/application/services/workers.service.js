const bcrypt = require("bcryptjs");
const workersRepo = require("../../domain/repositories/workers.repository");
const authRepo = require("../../domain/repositories/auth.repository");
const { isAssignableSubdomain } = require("./sites.service");

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 400;
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
    this.statusCode = 404;
  }
}

class ConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConflictError";
    this.statusCode = 409;
  }
}

function getAllWorkers() {
  return workersRepo.findAll();
}

function getWorkerByEmail(email) {
  return workersRepo.findByEmail(email) || null;
}

function getWorkerById(id) {
  const worker = workersRepo.findById(Number(id));
  if (!worker) throw new NotFoundError(`Worker ${id} not found`);
  return worker;
}

/**
 * Creates a worker and, if a password is provided, also creates their user
 * account atomically in a single SQLite transaction so both records are
 * always in sync.
 *
 * @param {{ name: string, email: string, percentage: number, password?: string }} data
 */
async function createWorker({ name, email, percentage, password }) {
  if (!name || !email || percentage == null) {
    throw new ValidationError("Nombre, email y porcentaje son requeridos");
  }
  if (typeof percentage !== "number" || percentage <= 0 || percentage > 100) {
    throw new ValidationError("El porcentaje debe ser un número entre 0 y 100 (exclusivo)");
  }

  const existingWorker = workersRepo.findByEmail(email);
  if (existingWorker) throw new ConflictError(`El email ${email} ya está en uso`);

  if (password) {
    const existingUser = authRepo.findByEmail(email);
    if (existingUser) throw new ConflictError(`Ya existe una cuenta de usuario con el email ${email}`);

    const passwordHash = await bcrypt.hash(password, 10);
    return workersRepo.createWithUser({ name, email, percentage }, { passwordHash });
  }

  return workersRepo.create({ name, email, percentage });
}

function deleteWorker(id) {
  const deleted = workersRepo.deleteById(Number(id));
  if (!deleted) throw new NotFoundError(`Worker ${id} not found`);
}

function addPropertyToWorker(workerId, { type, value }) {
  const VALID_TYPES = ["domain", "ad_unit"];
  if (!VALID_TYPES.includes(type)) {
    throw new ValidationError(`El tipo debe ser uno de: ${VALID_TYPES.join(", ")}`);
  }
  if (!value || typeof value !== "string" || !value.trim()) {
    throw new ValidationError("El valor es requerido y debe ser una cadena no vacía");
  }

  getWorkerById(workerId);
  const trimmedValue = value.trim();

  // Domain ownership is exclusive across workers.
  if (type === "domain") {
    if (!isAssignableSubdomain(trimmedValue)) {
      throw new ValidationError(
        "Solo se permiten subdominios asignables (ej: elvalerobux.barbacoadicto.com)"
      );
    }
    const existingDomain = workersRepo.findPropertyByTypeAndValue("domain", trimmedValue);
    if (existingDomain && existingDomain.worker_id !== Number(workerId)) {
      throw new ConflictError(
        `El subdominio ${trimmedValue} ya está asignado a otro trabajador`
      );
    }
  }

  try {
    return workersRepo.addProperty(Number(workerId), { type, value: trimmedValue });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      throw new ConflictError(`La propiedad (${type}: ${value}) ya está asignada a este trabajador`);
    }
    throw err;
  }
}

function updateWorkerPaymentInfoByEmail(email, { methodType, paymentDetails }) {
  const worker = getWorkerByEmail(email);
  if (!worker) {
    throw new NotFoundError("No tienes un perfil de trabajador asignado");
  }
  if (!methodType || typeof methodType !== "string" || !methodType.trim()) {
    throw new ValidationError("El tipo de método de pago es requerido");
  }
  if (!paymentDetails || typeof paymentDetails !== "string" || !paymentDetails.trim()) {
    throw new ValidationError("La información de pago es requerida");
  }

  return workersRepo.upsertPaymentInfo(worker.id, {
    methodType: methodType.trim(),
    paymentDetails: paymentDetails.trim(),
  });
}

module.exports = {
  getAllWorkers,
  getWorkerById,
  getWorkerByEmail,
  createWorker,
  deleteWorker,
  addPropertyToWorker,
  updateWorkerPaymentInfoByEmail,
};
